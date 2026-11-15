'use strict';
const { randomUUID } = require('node:crypto');
const { AppError } = require('../utils/errors');
const USERS = 'public."BTP_TBL_USERS"';
const NAFATH = 'public."GENERAL_TBL_TEMP_NAFATH"';
function createRegistrationRepository(db) {
  async function documentExists(documentNumber) { return (await db.run(`SELECT 1 FROM ${USERS} WHERE "DOCUMENT_NUMBER"=$1 LIMIT 1`, [documentNumber])).length > 0; }
  async function emailExists(email) { return (await db.run(`SELECT 1 FROM ${USERS} WHERE lower("EMAIL")=lower($1) LIMIT 1`, [email])).length > 0; }
  async function startValidation(input) {
    await db.run(`DELETE FROM ${NAFATH} WHERE "CREATED_ON" < CURRENT_TIMESTAMP - INTERVAL '10 minutes'`);
    await db.run(`INSERT INTO ${NAFATH} ("DOCUMENT_NUMBER","DOCUMENT_TYPE","VALIDATION_NAFATH_STATUS","CREATED_ON","LANGUAGE") VALUES ($1,$2,'WAITING',CURRENT_TIMESTAMP,$3) ON CONFLICT ("DOCUMENT_NUMBER") DO UPDATE SET "DOCUMENT_TYPE"=EXCLUDED."DOCUMENT_TYPE", "VALIDATION_NAFATH_STATUS"='WAITING', "API_RESP_JSON"=NULL, "API_TOKEN"=NULL, "CHANGED_ON"=CURRENT_TIMESTAMP, "LANGUAGE"=EXCLUDED."LANGUAGE"`, [input.documentNumber, input.documentType, input.language]);
  }
  async function validation(documentNumber) { return (await db.run(`SELECT "DOCUMENT_NUMBER","VALIDATION_NAFATH_STATUS","API_RESP_JSON" FROM ${NAFATH} WHERE "DOCUMENT_NUMBER"=$1 AND "CREATED_ON" >= CURRENT_TIMESTAMP - INTERVAL '10 minutes' LIMIT 1`, [documentNumber]))[0] || null; }
  async function setValidated(documentNumber, token, identity) { await db.run(`UPDATE ${NAFATH} SET "VALIDATION_NAFATH_STATUS"='VALID', "API_TOKEN"=$2, "API_RESP_JSON"=$3, "CHANGED_ON"=CURRENT_TIMESTAMP WHERE "DOCUMENT_NUMBER"=$1`, [documentNumber, token, JSON.stringify(identity).slice(0, 5000)]); }
  async function createUser({ ias, input, identity }) {
    const id = randomUUID();
    await db.run(`INSERT INTO ${USERS} ("UUID","IAS_ID","EMAIL","ACCOUNT_TYPE","FNAME","SNAME","TNAME","LNAME","DATE_OF_BIRTH","GENDER","MOBILE_KEY","MOBILE_NUMBER","CCODE","ACTIVE_STATUS","DOCUMENT_TYPE","DOCUMENT_NUMBER","CREATED_ON","CHANGED_ON","BEGDA") VALUES ($1::uuid,$2,$3,'POA_AGENT',$4,$5,$6,$7,$8::date,$9,$10,$11,'SA',true,$12,$13,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_DATE)`, [id, ias.id, input.email, identity.firstName, identity.fatherName, identity.grandName, identity.familyName, identity.dateOfBirth || null, identity.gender || null, input.phoneCountryCode, input.mobile, input.documentType, input.documentNumber]);
    return id;
  }
  return { documentExists, emailExists, startValidation, validation, setValidated, createUser };
}
module.exports = { createRegistrationRepository };
