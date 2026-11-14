'use strict';

const { LicenseError } = require('./errors');
const { parseRenewalSubmission, assertCommercialRegistration } = require('./submission-input');
const { payloadHash } = require('./submission-operations');
const { requireApprovedConfiguration } = require('./submission-service');

function readableError(error) {
  return error instanceof LicenseError ? error : new LicenseError('RENEWAL_UNCERTAIN',
    'Renewal outcome needs reconciliation before retrying', 503);
}

function isSuspended(account) {
  return String(account.LicenseStatus_KUT || '') === '121' ||
    String(account.LicenseStatus_KUTText || '').trim().toLowerCase() === 'suspended';
}

function createRenewalSubmitter({ crs, c4c, writer, operations, config }) {
  if (!crs || !c4c || !writer || !operations || !config) throw new TypeError('Renewal dependencies are required');

  async function submit({ actorUuid, identity, rawPayload }) {
    requireApprovedConfiguration(config);
    if (config.salesOrg !== 'S1600' || config.salesUnit !== 'S1600') {
      throw new LicenseError('C4C_RENEWAL_SALES_UNIT_REQUIRED',
        'Renewal requires the approved S1600 Sales Organisation and Sales Unit', 503);
    }
    if (!config.createContacts) {
      throw new LicenseError('C4C_CONTACT_UPDATES_NOT_READY',
        'Renewal requires approved C4C contact updates', 503);
    }
    const input = parseRenewalSubmission(rawPayload);
    const cr = await crs.requireOwned(actorUuid, input.crNationalNumber, input.crNumber);
    assertCommercialRegistration(cr, config.allowedStatuses);
    const accounts = await c4c.findAccountsForCr(cr);
    const account = accounts.find(row => String(row.AccountID) === input.accountId &&
      String(row.LicenseNumber_KUT || '') === input.licenseNumber &&
      String(row.RoleCode || '') === input.licenseType);
    if (!account) throw new LicenseError('LICENSE_NOT_AUTHORIZED', 'License is not available for renewal', 403);
    if (isSuspended(account)) throw new LicenseError('LICENSE_SUSPENDED', 'Suspended licenses cannot be renewed', 422);
    const quotes = await c4c.findQuotesForAccount(account.AccountID);
    if (quotes.some(row => (row.LicenceType_KUT === input.licenseType || row.Role1_KUT === input.licenseType) &&
      String(row.LiscenceStatus_KUT || '') !== '111')) {
      throw new LicenseError('RENEWAL_ALREADY_OPEN', 'An active renewal request already exists for this license', 409);
    }
    const id = await operations.claimRenewal(identity, input, input.licenseType, payloadHash(input));
    let stage = 'RESERVED';
    let remoteWriteStarted = false;
    let quote;
    const uploaded = [];
    try {
      stage = 'ACCOUNT_UPDATE';
      await operations.mark(id, { stage, accountID: account.AccountID });
      remoteWriteStarted = true;
      await writer.patchAccount(account.ObjectID, cr);

      stage = 'CONTACT_LOOKUP';
      await operations.mark(id, { stage, accountID: account.AccountID });
      const contacts = await writer.findMatchingContacts(account.AccountID, input.applicant.mobile);
      if (contacts.length > 1) throw new LicenseError('AMBIGUOUS_CONTACT', 'Multiple matching contacts need reconciliation', 409);
      if (!contacts.length) {
        stage = 'CONTACT_POST';
        await operations.mark(id, { stage, accountID: account.AccountID });
        await writer.createContact(account.AccountID, input);
      }

      stage = 'QUOTE_POST';
      await operations.mark(id, { stage, accountID: account.AccountID });
      quote = await writer.createRenewalQuote(account.AccountID, input.licenseType, input, config);
      await operations.mark(id, { stage: 'QUOTE_CREATED', accountID: account.AccountID,
        quoteID: quote.quoteID, quoteObjectID: quote.quoteObjectID });
      for (const attachment of input.attachments) {
        stage = 'ATTACHMENT_POST';
        await operations.mark(id, { stage, attachments: uploaded });
        uploaded.push(await writer.uploadAttachment(quote, attachment));
      }
      const result = { type: input.licenseType, status: 'SUCCEEDED', accountID: account.AccountID,
        quoteID: quote.quoteID, quoteObjectID: quote.quoteObjectID, attachments: uploaded };
      await operations.mark(id, { status: 'SUCCEEDED', stage: 'COMPLETE', accountID: account.AccountID,
        quoteID: quote.quoteID, quoteObjectID: quote.quoteObjectID, attachments: uploaded, result });
      return result;
    } catch (error) {
      const safe = readableError(error);
      const status = quote ? 'PARTIAL' : remoteWriteStarted ? 'UNCERTAIN' : 'FAILED';
      const result = { type: input.licenseType, status, accountID: account.AccountID,
        quoteID: quote?.quoteID || '', quoteObjectID: quote?.quoteObjectID || '', attachments: uploaded,
        errorCode: safe.code, message: safe.message };
      try {
        await operations.mark(id, { status, stage, accountID: account.AccountID, quoteID: quote?.quoteID,
          quoteObjectID: quote?.quoteObjectID, attachments: uploaded, result, errorCode: safe.code });
      } catch (_) {
        return { ...result, status: 'UNCERTAIN',
          message: 'Tracking update failed after C4C processing. Reconcile this renewal before retrying.' };
      }
      return result;
    }
  }
  return { submit };
}

module.exports = { createRenewalSubmitter };
