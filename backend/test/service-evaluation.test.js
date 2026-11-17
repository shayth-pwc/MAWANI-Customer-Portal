'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createEvaluationService } = require('../srv/core/evaluations/evaluation-service');
const { createEvaluationRepository } = require('../srv/core/evaluations/evaluation-repository');

const ACTOR = '4df5f4cf-90ce-4ce9-b3f9-9c8b8d60a1b4';
const REQUEST = '8a6d11a9-3c2c-4af2-bf27-dde8deebc2d1';
const Q1 = 'a14197a3-1e67-4f0c-a349-43f5a2a4d604';
const Q2 = 'b47a9509-5462-4756-82a3-2f624394ea39';
const questions = [
  { id: Q1, appId: 'LICENSES', question: 'How was the service?', questionAr: '', minScore: 1, maxScore: 5, displayOrder: 1, active: true },
  { id: Q2, appId: 'LICENSES', question: 'How clear was the request?', questionAr: '', minScore: 0, maxScore: 10, displayOrder: 2, active: true },
];
function fakeRepository() {
  const calls = []; const repo = {
    listQuestions: async appId => { calls.push(['listQuestions', appId]); return questions; },
    createEvaluation: async (input, actor) => { calls.push(['createEvaluation', input, actor]); return { evaluationId: 'c56dcf25-61d5-4a42-9074-8189c3d437ae', appId: input.appId, requestUuid: input.requestUuid, averageScore: 5, averagePercent: 75, questionCount: input.answers.length, status: 'SUBMITTED' }; },
    upsertQuestion: async (input, actor) => { calls.push(['upsertQuestion', input, actor]); return { ...input, id: input.id || Q1 }; },
    archiveQuestion: async (id, actor) => { calls.push(['archiveQuestion', id, actor]); },
    applicationReport: async input => { calls.push(['applicationReport', input]); return []; },
    questionReport: async input => { calls.push(['questionReport', input]); return []; },
  }; return { repo, calls };
}
function repositoryWithQuestions() {
  const calls = [];
  const db = {
    tx: async work => work({ run: async (sql, values) => {
      calls.push([sql, values]);
      if (sql.includes('BTP_TBL_SERVICE_EVALUATION_QUESTIONS')) return questions.map(question => ({
        ID: question.id, APP_ID: question.appId, QUESTION_TEXT: question.question, QUESTION_TEXT_AR: question.questionAr,
        MIN_SCORE: question.minScore, MAX_SCORE: question.maxScore, DISPLAY_ORDER: question.displayOrder, ACTIVE_STATUS: true,
      }));
      if (sql.includes('BTP_TBL_SERVICE_EVALUATIONS')) return [{ ID: values[0] }];
      if (sql.includes('BTP_TBL_SERVICE_EVALUATION_ANSWERS')) return [];
      throw new Error('Unexpected database statement');
    }}),
    run: async () => { throw new Error('Unexpected direct database statement'); },
  };
  return { service: createEvaluationService(createEvaluationRepository(db)), calls };
}
test('submits one scored answer per configured question and preserves an optional comment', async () => {
  const { service, calls } = repositoryWithQuestions();
  const result = await service.submit(JSON.stringify({ requestUuid: REQUEST, appId: 'LICENSES', answers: [
    { questionId: Q1, score: 4, comment: 'Fast response' }, { questionId: Q2, score: 8 },
  ] }), ACTOR);
  assert.equal(result.status, 'SUBMITTED');
  assert.equal(result.questionCount, 2);
  assert.equal(calls.filter(call => call[0].includes('BTP_TBL_SERVICE_EVALUATIONS')).length, 1);
  assert.equal(calls.filter(call => call[0].includes('BTP_TBL_SERVICE_EVALUATION_ANSWERS')).length, 2);
});
test('rejects a submission without every active evaluation question before writing', async () => {
  const { service, calls } = repositoryWithQuestions();
  await assert.rejects(service.submit(JSON.stringify({ requestUuid: REQUEST, appId: 'LICENSES', answers: [{ questionId: Q1, score: 4 }] }), ACTOR), /every active evaluation question/);
  assert.equal(calls.filter(call => call[0].includes('BTP_TBL_SERVICE_EVALUATIONS')).length, 0);
});
test('rejects scores outside each question configured range before writing', async () => {
  const { service, calls } = repositoryWithQuestions();
  await assert.rejects(service.submit(JSON.stringify({ requestUuid: REQUEST, appId: 'LICENSES', answers: [{ questionId: Q1, score: 7 }, { questionId: Q2, score: 8 }] }), ACTOR), /outside the configured range/);
  assert.equal(calls.filter(call => call[0].includes('BTP_TBL_SERVICE_EVALUATIONS')).length, 0);
});
test('admin question upsert validates the configured score boundaries', async () => {
  const { repo, calls } = fakeRepository(); const service = createEvaluationService(repo);
  assert.throws(() => service.upsertQuestion(JSON.stringify({ appId: 'LICENSES', question: 'Rate', minScore: 5, maxScore: 5 }), ACTOR), /Maximum score/);
  const question = await service.upsertQuestion(JSON.stringify({ appId: 'LICENSES', question: 'Rate', questionAr: 'قيّم', minScore: 1, maxScore: 5, displayOrder: 3, active: true }), ACTOR);
  assert.equal(question.appId, 'LICENSES'); assert.equal(calls[0][0], 'upsertQuestion');
});
test('management reports require a valid ordered date range and can be filtered by app', async () => {
  const { repo, calls } = fakeRepository(); const service = createEvaluationService(repo);
  assert.throws(() => service.applicationReport({ startDate: '2026-11-30', endDate: '2026-11-01', appId: '' }), /Start date/);
  await service.applicationReport({ startDate: '2026-11-01', endDate: '2026-11-30', appId: 'LICENSES' });
  await service.questionReport({ startDate: '2026-11-01', endDate: '2026-11-30', appId: '' });
  assert.deepEqual(calls.slice(-2), [
    ['applicationReport', { startDate: '2026-11-01', endDate: '2026-11-30', appId: 'LICENSES' }],
    ['questionReport', { startDate: '2026-11-01', endDate: '2026-11-30', appId: '' }],
  ]);
});
