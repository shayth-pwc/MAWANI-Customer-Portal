'use strict';
const cds = require('@sap/cds');
const { createRegistrationRepository } = require('./srv/core/registration/registration-repository');
const { nafathIdentity } = require('./srv/core/registration/external-clients');

// The external Nafath browser flow calls this public endpoint. It never
// returns identity data and only marks a pre-created, short-lived challenge.
cds.on('bootstrap', app => app.get('/public-registration/nafath-callback', async (req, res) => {
  const tokenId = typeof req.query.TokenID === 'string' && /^[A-Za-z0-9._-]{8,1000}$/.test(req.query.TokenID) ? req.query.TokenID : '';
  if (!tokenId) return res.status(400).type('html').send('Invalid validation request.');
  try {
    const identity = await nafathIdentity(tokenId);
    const documentNumber = String(identity.id || '');
    if (!/^\d{8,16}$/.test(documentNumber)) throw new Error('invalid identity');
    const repo = createRegistrationRepository(await cds.connect.to('db'));
    if (!await repo.validation(documentNumber)) throw new Error('expired challenge');
    await repo.setValidated(documentNumber, tokenId, identity);
    return res.type('html').send('Validation completed. Please close this tab and return to registration.');
  } catch (_) { return res.status(422).type('html').send('Validation could not be completed. Please return to registration and try again.'); }
}));
module.exports = cds.server;
