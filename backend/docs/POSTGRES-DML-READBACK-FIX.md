# PostgreSQL write result fix — v0.7.2

## Evidence

Cloud Foundry v0.7.1 diagnostics reported:

```text
PASS db-connect
PASS db-read-and-table-privileges
PASS transaction-lock-and-select
PASS scim-user-detail
Profile provisioning failed (stage=insert-new-profile, type=Error, code=unknown, category=unexpected-insert-result)
```

The original user repository executed `INSERT ... RETURNING` and used `rows[0]`
as the inserted profile. With `@cap-js/postgres`, raw DML results must not be
assumed to have that shape. The missing `UUID` triggered an exception inside
the auto-provisioning transaction.

## Changes

- `createFromVerifiedLogin`: parameterized raw INSERT followed by SELECT
  of the generated UUID **using the same transaction handle**. The returned
  row must match the verified IAS ID, issuer, subject, default portal role,
  and active status before the provisioning service writes its audit entry.
- `createFromIas`: an explicit manual create similarly reads back its disabled
  portal profile and confirms the IAS ID.
- `bindVerifiedIdentity`: UPDATE followed by SELECT. The result is accepted
  only if all three identity identifiers match, so an unsuccessful guarded
  UPDATE cannot be mistaken for a successful link.
- `updateProfile`: UPDATE followed by SELECT, returning success only when
  the requested allowed fields were persisted.
- All SQL uses PostgreSQL `$1`, `$2`, etc. placeholders and the existing
  quoted uppercase tables. No DDL or schema deployment.

## Deployment

From SAP Business Application Studio, integrate the updated files **without
replacing `.env` or Cloud Foundry service credentials**:

```sh
npm run check
npm test
mbt build
python3 scripts/verify-mtar.py mta_archives/mawani-customer-portal-backend_0.7.2.mtar
cf deploy mta_archives/mawani-customer-portal-backend_0.7.2.mtar
```

Then open the existing router root URL while logged in with a permitted,
active human IAS user:

```text
https://mawani-btp-dev-mawani-btp-dev-sp-mawani-portal-router.cfapps.sa30.hana.ondemand.com/
```

Expected first successful visit: `created: true`; subsequent visit:
`created: false` with the **same** UUID. If a prior failed transaction
rolled back, the first visit after the fix should create the profile.

To check the result without exposing user data:

```sh
cf run-task mawani-portal-srv --command "npm run check:provisioning" --name mawani-provisioning-verify
cf tasks mawani-portal-srv
cf logs mawani-portal-srv --recent | grep -E 'portalUserCount|verifiedIdentityLinkCount|PORTAL_USER_AUTO_CREATE|PORTAL_USER_IDENTITY_LINK'
```

A successful user creation should insert `PORTAL_USER_AUTO_CREATE` in the
existing audit table. Do not repeat browser tests until the first response
succeeds without an HTTP 500. The test suite uses an in-memory PostgreSQL
adapter simulation; live Cloud Foundry insert and audit remain unverified
until executed against the bound service.
