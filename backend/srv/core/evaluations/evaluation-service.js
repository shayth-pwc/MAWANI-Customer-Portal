'use strict';

const { AppError } = require('../utils/errors');
const v = require('../utils/validation');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function object(raw, label) {
  try {
    const value = JSON.parse(raw);
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value;
  } catch (_) { throw new AppError(400, `Invalid ${label} payload`); }
}
function uuid(value, label) {
  if (typeof value !== 'string' || !UUID.test(value)) throw new AppError(400, `Invalid ${label}`);
  return value;
}
function appId(value) {
  const result = v.text(value, 'application ID', { max: 100, required: true });
  if (!/^[A-Za-z0-9_.-]+$/.test(result)) throw new AppError(400, 'Invalid application ID');
  return result;
}
function score(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1000) throw new AppError(400, 'Invalid evaluation score');
  return value;
}
function date(value, label) {
  const parsed = typeof value === 'string' ? new Date(`${value}T00:00:00Z`) : null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed?.getTime()) || parsed.toISOString().slice(0, 10) !== value)
    throw new AppError(400, `Invalid ${label}`);
  return value;
}
function optionalText(value, label, max) {
  if (value === undefined || value === null || value === '') return '';
  return v.text(value, label, { max, required: false }) || '';
}
function questionInput(raw) {
  const value = object(raw, 'evaluation question');
  const minScore = score(value.minScore);
  const maxScore = score(value.maxScore);
  if (maxScore <= minScore) throw new AppError(400, 'Maximum score must be greater than minimum score');
  return {
    id: value.id === undefined || value.id === null || value.id === '' ? '' : uuid(value.id, 'question ID'),
    appId: appId(value.appId), question: v.text(value.question, 'question', { max: 1000, required: true }),
    questionAr: optionalText(value.questionAr, 'Arabic question', 1000), minScore, maxScore,
    displayOrder: v.int(value.displayOrder, 'display order', 1, 1, 100000),
    active: value.active === undefined ? true : v.boolean(value.active, 'active status'),
  };
}
function submissionInput(raw) {
  const value = object(raw, 'service evaluation');
  if (!Array.isArray(value.answers) || value.answers.length < 1 || value.answers.length > 50)
    throw new AppError(400, 'At least one and no more than 50 evaluation answers are required');
  return {
    requestUuid: uuid(value.requestUuid, 'request UUID'), appId: appId(value.appId),
    answers: value.answers.map(answer => {
      if (!answer || typeof answer !== 'object' || Array.isArray(answer)) throw new AppError(400, 'Invalid evaluation answer');
      return { questionId: uuid(answer.questionId, 'question ID'), score: score(answer.score), comment: optionalText(answer.comment, 'evaluation comment', 2000) };
    }),
  };
}
function reportInput(data) {
  const startDate = date(data.startDate, 'start date');
  const endDate = date(data.endDate, 'end date');
  if (startDate > endDate) throw new AppError(400, 'Start date must not be after end date');
  return { startDate, endDate, appId: data.appId ? appId(data.appId) : '' };
}
function createEvaluationService(repository) {
  if (!repository) throw new TypeError('Evaluation repository is required');
  return {
    getQuestions: app => repository.listQuestions(appId(app)),
    submit: (raw, actorUuid) => repository.createEvaluation(submissionInput(raw), uuid(actorUuid, 'portal user UUID')),
    upsertQuestion: (raw, actorUuid) => repository.upsertQuestion(questionInput(raw), actorUuid ? uuid(actorUuid, 'portal user UUID') : null),
    archiveQuestion: (questionId, actorUuid) => repository.archiveQuestion(uuid(questionId, 'question ID'), actorUuid ? uuid(actorUuid, 'portal user UUID') : null),
    applicationReport: data => repository.applicationReport(reportInput(data)),
    questionReport: data => repository.questionReport(reportInput(data)),
  };
}
module.exports = { createEvaluationService };
