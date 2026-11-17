'use strict';

const { randomUUID } = require('node:crypto');
const { AppError } = require('../utils/errors');

const QUESTIONS = 'public."BTP_TBL_SERVICE_EVALUATION_QUESTIONS"';
const EVALUATIONS = 'public."BTP_TBL_SERVICE_EVALUATIONS"';
const ANSWERS = 'public."BTP_TBL_SERVICE_EVALUATION_ANSWERS"';

function rowQuestion(row) {
  return {
    id: row.ID, appId: row.APP_ID, question: row.QUESTION_TEXT,
    questionAr: row.QUESTION_TEXT_AR || '', minScore: Number(row.MIN_SCORE),
    maxScore: Number(row.MAX_SCORE), displayOrder: Number(row.DISPLAY_ORDER), active: row.ACTIVE_STATUS === true,
  };
}

function createEvaluationRepository(db) {
  if (!db?.run || !db?.tx) throw new TypeError('CAP PostgreSQL database is required');

  async function listQuestions(appId, includeInactive = false, runner = db) {
    const active = includeInactive ? '' : 'AND "ACTIVE_STATUS" = true';
    const rows = await runner.run(
      `SELECT "ID", "APP_ID", "QUESTION_TEXT", "QUESTION_TEXT_AR", "MIN_SCORE", "MAX_SCORE", "DISPLAY_ORDER", "ACTIVE_STATUS"
       FROM ${QUESTIONS} WHERE "APP_ID" = $1::text ${active} ORDER BY "DISPLAY_ORDER", "CREATED_ON", "ID"`, [appId],
    );
    return (rows || []).map(rowQuestion);
  }

  async function upsertQuestion(input, actorUuid) {
    if (!input.id) {
      const id = randomUUID();
      const rows = await db.run(
        `INSERT INTO ${QUESTIONS} ("ID","APP_ID","QUESTION_TEXT","QUESTION_TEXT_AR","MIN_SCORE","MAX_SCORE","DISPLAY_ORDER","ACTIVE_STATUS","CREATED_BY","CHANGED_BY")
         VALUES ($1::uuid,$2::text,$3::text,$4::text,$5::integer,$6::integer,$7::integer,$8::boolean,$9::uuid,$9::uuid)
         RETURNING "ID", "APP_ID", "QUESTION_TEXT", "QUESTION_TEXT_AR", "MIN_SCORE", "MAX_SCORE", "DISPLAY_ORDER", "ACTIVE_STATUS"`,
        [id, input.appId, input.question, input.questionAr || null, input.minScore, input.maxScore, input.displayOrder, input.active, actorUuid],
      );
      return rowQuestion(rows[0]);
    }
    const rows = await db.run(
      `UPDATE ${QUESTIONS} SET "QUESTION_TEXT"=$3::text, "QUESTION_TEXT_AR"=$4::text, "MIN_SCORE"=$5::integer,
       "MAX_SCORE"=$6::integer, "DISPLAY_ORDER"=$7::integer, "ACTIVE_STATUS"=$8::boolean,
       "CHANGED_ON"=CURRENT_TIMESTAMP, "CHANGED_BY"=$9::uuid
       WHERE "ID"=$1::uuid AND "APP_ID"=$2::text
       RETURNING "ID", "APP_ID", "QUESTION_TEXT", "QUESTION_TEXT_AR", "MIN_SCORE", "MAX_SCORE", "DISPLAY_ORDER", "ACTIVE_STATUS"`,
      [input.id, input.appId, input.question, input.questionAr || null, input.minScore, input.maxScore, input.displayOrder, input.active, actorUuid],
    );
    if (!rows?.length) throw new AppError(404, 'Evaluation question was not found');
    return rowQuestion(rows[0]);
  }

  async function archiveQuestion(id, actorUuid) {
    const rows = await db.run(
      `UPDATE ${QUESTIONS} SET "ACTIVE_STATUS"=false, "CHANGED_ON"=CURRENT_TIMESTAMP, "CHANGED_BY"=$2::uuid
       WHERE "ID"=$1::uuid AND "ACTIVE_STATUS"=true RETURNING "ID"`, [id, actorUuid],
    );
    if (!rows?.length) throw new AppError(404, 'Active evaluation question was not found');
  }

  async function createEvaluation(input, actorUuid) {
    return db.tx(async tx => {
      const questions = await listQuestions(input.appId, false, tx);
      if (!questions.length) throw new AppError(422, 'No active evaluation questions are configured for this application');
      const questionById = new Map(questions.map(question => [question.id, question]));
      if (input.answers.length !== questions.length || new Set(input.answers.map(answer => answer.questionId)).size !== input.answers.length ||
        input.answers.some(answer => !questionById.has(answer.questionId)))
        throw new AppError(400, 'An answer is required for every active evaluation question');

      const normalized = input.answers.map(answer => {
        const question = questionById.get(answer.questionId);
        if (answer.score < question.minScore || answer.score > question.maxScore)
          throw new AppError(400, 'Evaluation score is outside the configured range');
        return { ...answer, question };
      });
      const averageScore = normalized.reduce((sum, answer) => sum + answer.score, 0) / normalized.length;
      const averagePercent = normalized.reduce((sum, answer) =>
        sum + ((answer.score - answer.question.minScore) * 100 / (answer.question.maxScore - answer.question.minScore)), 0) / normalized.length;
      const id = randomUUID();
      const claimed = await tx.run(
        `INSERT INTO ${EVALUATIONS} ("ID","REQUEST_UUID","APP_ID","USER_UUID","AVERAGE_SCORE","AVERAGE_PERCENT","QUESTION_COUNT","CREATED_BY")
         VALUES ($1::uuid,$2::uuid,$3::text,$4::uuid,$5::numeric,$6::numeric,$7::integer,$4::uuid)
         ON CONFLICT ("REQUEST_UUID","APP_ID") DO NOTHING RETURNING "ID"`,
        [id, input.requestUuid, input.appId, actorUuid, averageScore, averagePercent, normalized.length],
      );
      if (!claimed?.length) throw new AppError(409, 'An evaluation already exists for this application request');
      for (const answer of normalized) {
        await tx.run(
          `INSERT INTO ${ANSWERS} ("ID","EVALUATION_ID","QUESTION_ID","QUESTION_TEXT","QUESTION_TEXT_AR","MIN_SCORE","MAX_SCORE","SCORE","COMMENT")
           VALUES ($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::integer,$7::integer,$8::integer,$9::text)`,
          [randomUUID(), id, answer.question.id, answer.question.question, answer.question.questionAr || null,
            answer.question.minScore, answer.question.maxScore, answer.score, answer.comment || null],
        );
      }
      return { evaluationId: id, appId: input.appId, requestUuid: input.requestUuid, averageScore, averagePercent, questionCount: normalized.length, status: 'SUBMITTED' };
    });
  }

  async function applicationReport({ startDate, endDate, appId }) {
    const rows = await db.run(
      `SELECT "APP_ID", COUNT(*)::integer AS "EVALUATION_COUNT", AVG("AVERAGE_SCORE") AS "AVERAGE_SCORE",
       AVG("AVERAGE_PERCENT") AS "AVERAGE_PERCENT", MIN("AVERAGE_SCORE") AS "MINIMUM_SCORE", MAX("AVERAGE_SCORE") AS "MAXIMUM_SCORE",
       COALESCE((SELECT COUNT(*)::integer FROM ${ANSWERS} a WHERE a."EVALUATION_ID" IN
         (SELECT e2."ID" FROM ${EVALUATIONS} e2 WHERE e2."APP_ID"=e."APP_ID" AND e2."CREATED_ON">=$1::date AND e2."CREATED_ON"<($2::date + INTERVAL '1 day'))
         AND a."COMMENT" IS NOT NULL AND a."COMMENT" <> ''), 0) AS "COMMENTS_COUNT"
       FROM ${EVALUATIONS} e WHERE "CREATED_ON">=$1::date AND "CREATED_ON"<($2::date + INTERVAL '1 day')
       AND ($3::text='' OR "APP_ID"=$3::text) GROUP BY "APP_ID" ORDER BY "APP_ID"`, [startDate, endDate, appId || ''],
    );
    return (rows || []).map(row => ({ appId: row.APP_ID, evaluationCount: Number(row.EVALUATION_COUNT), averageScore: Number(row.AVERAGE_SCORE), averagePercent: Number(row.AVERAGE_PERCENT), minimumScore: Number(row.MINIMUM_SCORE), maximumScore: Number(row.MAXIMUM_SCORE), commentsCount: Number(row.COMMENTS_COUNT) }));
  }

  async function questionReport({ startDate, endDate, appId }) {
    const rows = await db.run(
      `SELECT e."APP_ID", a."QUESTION_ID", MAX(a."QUESTION_TEXT") AS "QUESTION_TEXT", MAX(a."QUESTION_TEXT_AR") AS "QUESTION_TEXT_AR",
       COUNT(*)::integer AS "EVALUATION_COUNT", AVG(a."SCORE") AS "AVERAGE_SCORE",
       AVG((a."SCORE"-a."MIN_SCORE")*100.0/NULLIF(a."MAX_SCORE"-a."MIN_SCORE",0)) AS "AVERAGE_PERCENT",
       COUNT(*) FILTER (WHERE a."COMMENT" IS NOT NULL AND a."COMMENT" <> '')::integer AS "COMMENTS_COUNT"
       FROM ${ANSWERS} a JOIN ${EVALUATIONS} e ON e."ID"=a."EVALUATION_ID"
       WHERE e."CREATED_ON">=$1::date AND e."CREATED_ON"<($2::date + INTERVAL '1 day')
       AND ($3::text='' OR e."APP_ID"=$3::text)
       GROUP BY e."APP_ID", a."QUESTION_ID" ORDER BY e."APP_ID", a."QUESTION_ID"`, [startDate, endDate, appId || ''],
    );
    return (rows || []).map(row => ({ appId: row.APP_ID, questionId: row.QUESTION_ID, question: row.QUESTION_TEXT, questionAr: row.QUESTION_TEXT_AR || '', evaluationCount: Number(row.EVALUATION_COUNT), averageScore: Number(row.AVERAGE_SCORE), averagePercent: Number(row.AVERAGE_PERCENT), commentsCount: Number(row.COMMENTS_COUNT) }));
  }

  return { listQuestions, upsertQuestion, archiveQuestion, createEvaluation, applicationReport, questionReport };
}
module.exports = { createEvaluationRepository };
