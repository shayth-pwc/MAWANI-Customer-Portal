'use strict';
const cds = require('@sap/cds');
const { randomUUID } = require('node:crypto');
const { AppError } = require('../utils/errors');
const validate = require('../utils/validation');

const TABLE = 'public."BTP_TBL_USERS"';
const PROJECTION = `"UUID", "PERNR", "IAS_ID", "IAS_ISSUER", "IAS_SUBJECT", "EMAIL", "ACCOUNT_TYPE",
  "FNAME", "SNAME", "TNAME", "LNAME", "MOBILE_KEY", "MOBILE_NUMBER",
  "CCODE", "ACTIVE_STATUS", "CREATED_ON", "CHANGED_ON", "BEGDA", "ENDDA"`;
const UPDATABLE = Object.freeze({
  FNAME: 100, SNAME: 100, TNAME: 100, LNAME: 100,
  MOBILE_KEY: 10, MOBILE_NUMBER: 25, CCODE: 2, ACTIVE_STATUS: 0
});

class UserRepository {
  constructor(getDb = () => cds.connect.to('db')) { this.getDb = getDb; }
  async findAll(limit = 50, offset = 0, tx) {
    const db = tx || await this.getDb();
    return db.run(`SELECT ${PROJECTION} FROM ${TABLE}
      ORDER BY "CREATED_ON" DESC NULLS LAST, "UUID" LIMIT $1 OFFSET $2`, [limit, offset]);
  }
  async findById(uuid, tx) {
    const db = tx || await this.getDb();
    const result = await db.run(`SELECT ${PROJECTION} FROM ${TABLE} WHERE "UUID" = $1::uuid`, [validate.uuid(uuid)]);
    return result[0] || null;
  }
  async findByIasId(iasId, tx) {
    const db = tx || await this.getDb();
    const result = await db.run(`SELECT ${PROJECTION} FROM ${TABLE} WHERE "IAS_ID" = $1 LIMIT 2`,
      [validate.text(iasId, 'IAS user ID', { max: 150, required: true })]);
    if (result.length > 1) throw new AppError(409, 'Duplicate IAS account linkage');
    return result[0] || null;
  }
  async findByIdentity(issuer, subject, tx) {
    const db = tx || await this.getDb();
    const result = await db.run(`SELECT ${PROJECTION} FROM ${TABLE}
      WHERE "IAS_ISSUER" = $1 AND "IAS_SUBJECT" = $2 LIMIT 2`, [issuer, subject]);
    if (result.length > 1) throw new AppError(403, 'Ambiguous portal identity');
    return result[0] || null;
  }
  async updateProfile(uuid, changes, tx) {
    const keys = Object.keys(changes).filter(key => changes[key] !== undefined);
    if (!keys.length) throw new AppError(400, 'No permitted portal profile fields supplied');
    const values = [];
    const assignments = keys.map(key => {
      if (!Object.hasOwn(UPDATABLE, key)) throw new AppError(400, `Field ${key} is not editable`);
      const value = key === 'ACTIVE_STATUS' ? validate.boolean(changes[key], key)
        : validate.text(changes[key], key, { max: UPDATABLE[key], required: true });
      values.push(value);
      return `"${key}" = $${values.length}`;
    });
    values.push(validate.uuid(uuid));
    const db = tx || await this.getDb();
    // Do not depend on a raw DML query returning a row array: CAP adapters
    // can report affected rows rather than PostgreSQL's RETURNING rows.
    await db.run(`UPDATE ${TABLE} SET ${assignments.join(', ')},
      "CHANGED_ON" = CURRENT_TIMESTAMP WHERE "UUID" = $${values.length}::uuid`, values);
    const profile = await this.findById(uuid, db);
    // A missing row or a write that did not persist the requested changes
    // must not be reported or audited as a successful update.
    return profile && keys.every((key, index) => profile[key] === values[index])
      ? profile : null;
  }
  /**
   * IAS-authoritative attributes are written only after a verified SCIM
   * mutation or a deliberate administrator reconciliation. Portal business
   * fields and token identity linkage are never changed here.
   */
  async updateVerifiedIasFields(uuid, changes, tx) {
    const allowed = { EMAIL: 254, FNAME: 100, LNAME: 100, ACTIVE_STATUS: 0 };
    const keys = Object.keys(changes);
    if (!keys.length || keys.some(key => !Object.hasOwn(allowed, key)))
      throw new AppError(400, 'No permitted IAS synchronization fields supplied');
    const values = keys.map(key => key === 'ACTIVE_STATUS'
      ? validate.boolean(changes[key], key)
      : key === 'EMAIL' ? validate.email(changes[key])
        : validate.text(changes[key], key, { max: allowed[key], required: true }));
    const assignments = keys.map((key, index) => `"${key}" = $${index + 1}`);
    values.push(validate.uuid(uuid));
    const db = tx || await this.getDb();
    await db.run(`UPDATE ${TABLE} SET ${assignments.join(', ')},
      "CHANGED_ON" = CURRENT_TIMESTAMP WHERE "UUID" = $${values.length}::uuid`, values);
    const profile = await this.findById(uuid, db);
    if (!profile || !keys.every((key, index) => profile[key] === values[index]))
      throw new AppError(503, 'IAS-to-portal synchronization could not be verified');
    return profile;
  }

  async bindVerifiedIdentity(uuid, { globalUserId, issuer, subject }, tx) {
    const db = tx || await this.getDb();
    // Only attach the trusted identity to a record with no conflicting linkage.
    await db.run(`UPDATE ${TABLE}
      SET "IAS_ID" = COALESCE("IAS_ID", $1),
          "IAS_ISSUER" = COALESCE("IAS_ISSUER", $2),
          "IAS_SUBJECT" = COALESCE("IAS_SUBJECT", $3),
          "CHANGED_ON" = CURRENT_TIMESTAMP
      WHERE "UUID" = $4::uuid
        AND ("IAS_ID" IS NULL OR "IAS_ID" = $1)
        AND ("IAS_ISSUER" IS NULL OR "IAS_ISSUER" = $2)
        AND ("IAS_SUBJECT" IS NULL OR "IAS_SUBJECT" = $3)`,
      [globalUserId, issuer, subject, validate.uuid(uuid)]);
    const profile = await this.findById(uuid, db);
    // An identity conflict makes UPDATE affect zero rows; a subsequent SELECT
    // alone is not sufficient proof that the secure linkage succeeded.
    return profile && profile.IAS_ID === globalUserId &&
      profile.IAS_ISSUER === issuer && profile.IAS_SUBJECT === subject
      ? profile : null;
  }

  async createFromVerifiedLogin({ iasUser, globalUserId, issuer, subject }, tx) {
    const db = tx || await this.getDb();
    // The SCIM response was already checked against validated token's user_uuid.
    if (!iasUser || iasUser.id !== globalUserId || iasUser.active !== true)
      throw new AppError(403, 'Active IAS user required');
    const optional = (value, max) => {
      if (typeof value !== 'string') return null;
      const v = value.trim();
      return v && v.length <= max && !/[\u0000-\u001f]/.test(v) ? v : null;
    };
    const emails = Array.isArray(iasUser.emails) ? iasUser.emails : [];
    const email = optional(emails.find(e => e && e.primary)?.value ||
      emails[0]?.value, 254);
    const firstName = optional(iasUser.name?.givenName, 100);
    const lastName = optional(iasUser.name?.familyName, 100);
    const uuid = randomUUID();
    await db.run(`INSERT INTO ${TABLE}
      ("UUID", "IAS_ID", "IAS_ISSUER", "IAS_SUBJECT", "EMAIL",
       "FNAME", "LNAME", "ACCOUNT_TYPE", "ACTIVE_STATUS", "CREATED_ON", "CHANGED_ON")
      VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, 'PORTAL_USER', TRUE,
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [uuid, globalUserId, issuer, subject, email, firstName, lastName]);
    // Read back within the *same transaction*; CAP may return a number or
    // write-result object for raw INSERT rather than an array of rows.
    const profile = await this.findById(uuid, db);
    if (!profile || profile.UUID !== uuid || profile.IAS_ID !== globalUserId ||
        profile.IAS_ISSUER !== issuer || profile.IAS_SUBJECT !== subject ||
        profile.ACCOUNT_TYPE !== 'PORTAL_USER' || profile.ACTIVE_STATUS !== true)
      throw new Error('Inserted portal profile read-back mismatch');
    return profile;
  }

  /**
   * Administrator-created IAS identities are immediately registered in the portal.
   * No human login token exists yet: issuer and subject must stay NULL until
   * the real user signs in and the existing first-login flow verifies both.
   */
  async createFromAdministrativeIas(iasUser, tx) {
    const iasId = validate.text(iasUser?.id, 'IAS user ID', { max: 150, required: true });
    if (typeof iasUser.active !== 'boolean')
      throw new AppError(502, 'IAS user activation state is unavailable');
    const optional = (value, max) => {
      if (typeof value !== 'string') return null;
      const v = value.trim();
      return v && v.length <= max && !/[\u0000-\u001f]/.test(v) ? v : null;
    };
    const emails = Array.isArray(iasUser.emails) ? iasUser.emails : [];
    const email = optional(emails.find(e => e && e.primary)?.value || emails[0]?.value, 254);
    const firstName = optional(iasUser.name?.givenName, 100);
    const lastName = optional(iasUser.name?.familyName, 100);
    const id = randomUUID();
    const db = tx || await this.getDb();
    await db.run(`INSERT INTO ${TABLE}
      ("UUID", "IAS_ID", "IAS_ISSUER", "IAS_SUBJECT", "EMAIL", "FNAME", "LNAME",
       "ACCOUNT_TYPE", "ACTIVE_STATUS", "CREATED_ON", "CHANGED_ON")
      VALUES ($1::uuid, $2, NULL, NULL, $3, $4, $5,
              'PORTAL_USER', $6::boolean, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, iasId, email, firstName, lastName, iasUser.active]);
    const profile = await this.findById(id, db);
    if (!profile || profile.UUID !== id || profile.IAS_ID !== iasId ||
        profile.IAS_ISSUER != null || profile.IAS_SUBJECT != null ||
        profile.ACCOUNT_TYPE !== 'PORTAL_USER' || profile.ACTIVE_STATUS !== iasUser.active)
      throw new Error('Administratively created portal profile read-back mismatch');
    return profile;
  }

  async createFromIas(iasUser, tx) {
    if (!iasUser.id) throw new AppError(502, 'IAS user ID missing');
    const id = randomUUID();
    const db = tx || await this.getDb();
    // Do NOT infer issuer or token subject from the SCIM ID.
    // Manual admin creation has no authenticated human token to bind.
    await db.run(`INSERT INTO ${TABLE}
      ("UUID", "IAS_ID", "EMAIL", "ACTIVE_STATUS", "CREATED_ON", "CHANGED_ON")
      VALUES ($1::uuid, $2, $3, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, iasUser.id, iasUser.email || null]);
    const profile = await this.findById(id, db);
    if (!profile || profile.UUID !== id || profile.IAS_ID !== iasUser.id ||
        profile.ACTIVE_STATUS !== false)
      throw new Error('Manually inserted portal profile read-back mismatch');
    return profile;
  }
}
module.exports = UserRepository;
