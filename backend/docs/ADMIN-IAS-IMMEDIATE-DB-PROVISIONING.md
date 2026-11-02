# Administrator IAS creation now immediately creates PostgreSQL portal user — v0.7.3

## Required behavior

When an authorized portal administrator calls `POST /admin/createIasUser`, the CAP backend:

1. Creates the identity with the configured IAS SCIM technical client (active, as in v0.7.2).
2. Reads back the new IAS user by the exact SCIM `id`, ensuring the directory record is available.
3. Within a single PostgreSQL transaction, takes the same advisory lock used by first-login provisioning, checks for a portal profile with that IAS ID, and inserts one if missing.
4. Writes `PORTAL_USER_ADMIN_CREATE` (for a new PostgreSQL profile) and `IAS_USER_CREATE` (for a new IAS identity) audit records in that database transaction.
5. Returns the IAS details plus `portalUserUuid` and `portalCreated`. The response is **not** returned as a success until the database transaction has committed.

New PostgreSQL profile fields: `UUID` = generated random UUID; `IAS_ID` = exact IAS SCIM ID; `EMAIL`, `FNAME`, `LNAME` = values from SCIM; `ACCOUNT_TYPE = 'PORTAL_USER'`; `ACTIVE_STATUS` = actual IAS active flag; `CREATED_ON` and `CHANGED_ON` = database timestamp. `IAS_ISSUER` and `IAS_SUBJECT` are initially `NULL`, because there is no verified login token for the newly created user. On the new user's first login, `/profile/me()` verifies the real IAS `iss`, `sub`, and `user_uuid`, links those values, and preserves the existing profile UUID, role classification and active status.

Group/administrator permissions are **not** granted to the created user by this flow. The administrator's own authority remains based on the existing IAS `Administrator Role` group. No existing database tables or IAM service resources are recreated.

## What to do for an IAS user created before v0.7.3

Your existing test account is already in IAS:

- Username: `mawani.test.user01`
- SCIM ID: `83c30c52-6933-4223-b916-18f0a6b751dc`

Do **not** call `createIasUser` a second time. After deploying v0.7.3, call the new administrator-only OData V4 action:

```http
POST /admin/syncIasUserToPortal
Content-Type: application/json
X-CSRF-Token: <valid CSRF token from your authenticated router session>

{"id":"83c30c52-6933-4223-b916-18f0a6b751dc"}
```

The action performs IAS **GET** and PostgreSQL insert-if-missing, with the same audit behavior and locking. It does not update the IAS user or generate a second IAS identity. It returns a `PortalSyncResult` with `profile` and `created: true` on initial sync, then `created: false` on repeats. Existing portal profiles, including manually disabled ones, are never overwritten or reactivated.

The existing `createPortalUser(iasId)` action remains available for its original explicit **disabled-profile** creation workflow; prefer `syncIasUserToPortal` for immediate normal onboarding.

## Important cross-system failure behavior

IAS and PostgreSQL cannot share one ACID transaction. If IAS creation completes but the SCIM follow-up read, PostgreSQL insert, or audit commit fails, the action returns HTTP `503` with code `IAS_PORTAL_SYNC_PENDING`. IAS has **already** created the user in this scenario. **Do not retry `createIasUser`**, as it may cause a conflict. Locate the IAS user by its username or ID and use `syncIasUserToPortal` to finish the database step. A best-effort `IAS_USER_CREATE_PROFILE_PENDING` audit event with `UNCERTAIN` status is also attempted; an unavailable database may prevent even that event. Monitor these errors and reconcile deliberately.

No automatic deletion of IAS users is attempted on failure. Avoid logging sensitive IAS user details or security tokens.

## Deploy with existing SAP BAS + Cloud Foundry setup

```sh
npm run check
npm test
mbt build
python3 scripts/verify-mtar.py mta_archives/mawani-customer-portal-backend_0.7.3.mtar
cf deploy mta_archives/mawani-customer-portal-backend_0.7.3.mtar
```

Keep your `.env` and Cloud Foundry service secrets out of Git and MTAR archives; the bundled `mta.yaml` continues using your existing `CIS-app-Inst`, `PostgreSQL-Hyperscaler-inst` bindings, app routes and admin group ID. The current Cloud Foundry environment must retain its working IAS SCIM technical credentials.

## Read-only validation

After the sync, call `/admin/getUsers(limit=20,offset=0)` and confirm the new IAS_ID appears with `ACCOUNT_TYPE: PORTAL_USER` and `ACTIVE_STATUS: true`. Repeating `syncIasUserToPortal` must return the **same UUID** and `created: false`. A local `PORTAL_USER_ADMIN_CREATE` audit record should exist once for that profile. The `IAS_USER_CREATE` audit is recorded for newly created IAS identities through the updated combined action, not retroactively when reconciling the pre-existing test user.

First-login fallback still works as before for an IAS account created through another channel. Login does not overwrite existing portal profiles. A future production-hardening change remains outstanding: move GET-triggered first-login database writes to an authenticated POST, without altering this administrator provisioning behavior.

This release passed offline unit tests. Cloud Foundry execution, SCIM propagation behavior and transaction commit must still be verified after deployment.
