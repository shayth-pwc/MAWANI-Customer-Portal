'use strict';

const cds = require('@sap/cds');
const UserProvisioningService = require('./core/services/user-provisioning.service');
const AdminGuard = require('./core/security/admin.guard');
const { createEvaluationRepository } = require('./core/evaluations/evaluation-repository');
const { createEvaluationService } = require('./core/evaluations/evaluation-service');
const { AppError, safeError } = require('./core/utils/errors');

module.exports = cds.service.impl(function () {
  let dbPromise;
  const database = () => (dbPromise ||= cds.connect.to('db'));
  const provisioning = new UserProvisioningService();
  const adminGuard = new AdminGuard();
  const adminEvents = new Set(['upsertEvaluationQuestion', 'archiveEvaluationQuestion', 'getEvaluationReport', 'getQuestionEvaluationReport']);
  const log = cds.log('mawani-service-evaluations');

  async function evaluationApi() {
    return createEvaluationService(createEvaluationRepository(await database()));
  }
  function reject(req, error, operation) {
    const safe = error instanceof AppError ? error : safeError(error);
    if (safe.status >= 500) log.error(`Service evaluation ${operation} failed (code=${error?.code || 'unknown'})`);
    return req.reject(safe.status, safe.message);
  }
  this.before('*', async req => {
    if (!adminEvents.has(req.event)) return;
    try { req.mawaniEvaluationAdmin = await adminGuard.authorize(req); }
    catch (error) { return reject(req, error, 'admin-authorization'); }
  });

  this.on('getEvaluationQuestions', async req => {
    try {
      await provisioning.read(req);
      return await (await evaluationApi()).getQuestions(req.data.appId);
    } catch (error) { return reject(req, error, 'get-questions'); }
  });
  this.on('submitServiceEvaluation', async req => {
    try {
      const actor = (await provisioning.read(req)).profile;
      return await (await evaluationApi()).submit(req.data.payload, actor.UUID);
    } catch (error) { return reject(req, error, 'submit'); }
  });
  this.on('upsertEvaluationQuestion', async req => {
    try { return await (await evaluationApi()).upsertQuestion(req.data.payload, req.mawaniEvaluationAdmin?.UUID || null); }
    catch (error) { return reject(req, error, 'upsert-question'); }
  });
  this.on('archiveEvaluationQuestion', async req => {
    try { await (await evaluationApi()).archiveQuestion(req.data.questionId, req.mawaniEvaluationAdmin?.UUID || null); return true; }
    catch (error) { return reject(req, error, 'archive-question'); }
  });
  this.on('getEvaluationReport', async req => {
    try { return await (await evaluationApi()).applicationReport(req.data); }
    catch (error) { return reject(req, error, 'application-report'); }
  });
  this.on('getQuestionEvaluationReport', async req => {
    try { return await (await evaluationApi()).questionReport(req.data); }
    catch (error) { return reject(req, error, 'question-report'); }
  });
});
