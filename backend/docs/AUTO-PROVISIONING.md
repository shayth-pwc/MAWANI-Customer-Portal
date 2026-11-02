# IAS first-login portal provisioning — v0.7.2

## Business rule

When an authenticated human IAS user first calls the Mawani backend, the portal checks whether that verified user has a record in `public."BTP_TBL_USERS"`. If absent, it verifies the **same IAS directory user** through SCIM and inserts a portal-local record. The application does **not** create or modify the user in IAS.

This feature changes the earlier first-phase decision to leave automatic login provisioning disabled. It does **not** automatically grant administrator roles.

## Trigger

The SAP Application Router authenticates users, but the CAP backend cannot execute code merely because the IAS sign-in page succeeded: it must receive an authenticated request. There are two entry points:

1. **New `/profile/me()` API** — available to any authenticated human IAS user. It performs idempotent provisioning and returns the current user's portal profile, including a `created` boolean. When the router is opened at `/`, the router forwards to this endpoint. Thus opening the portal's home URL after login runs first-login provisioning.
2. **Existing `/admin/*` APIs** — for successful IAS portal administrators, the existing `AdminGuard` runs first and then provisions a missing local profile. Users who are not portal administrators can use `/profile/me()` but cannot access `/admin/*`.

When React is introduced, call `GET /profile/me()` at application startup, before requesting business data. The temporary router root mapping can then be replaced with a React welcome route.

## Identity safety and profile rules

- IAS authentication is enforced by CAP. The identity is derived only from verified `iss`, `sub`, and `user_uuid` JWT claims in CAP's authentication context; client-supplied IDs, emails, or raw JWT headers are not trusted as identity.
- IAS SCIM `GET /Users/{user_uuid}` must return an exact matching `id` and `active: true` before writes.
- New records have a generated local UUID; `IAS_ID` is the SCIM user ID, `IAS_ISSUER`/`IAS_SUBJECT` contain the verified token identity; primary email, given name, family name come from SCIM if present. `PERNR`, secondary/third names, phone and country remain NULL pending business-domain onboarding.
- `ACCOUNT_TYPE` for first-login records is **`PORTAL_USER`** and `ACTIVE_STATUS` is `true`; no admin role is assigned in PostgreSQL or IAS. Admin API access remains dependent on the already-verified IAS `Administrator Role` group.
- Existing profiles are not duplicated, reactivated, or overwritten. An existing record matching `IAS_ID` but lacking IAS issuer/subject is linked after verification, **without modifying any business fields or active status**.
- Inactive or out-of-validity portal accounts are denied, regardless of valid IAS membership. Inactive IAS users are denied. Mismatching or duplicate identity linkages fail closed.
- The database transaction takes a PostgreSQL advisory lock keyed on the verified SCIM user ID, covering first-login lookup, insert/link and audit. This protects concurrent logins even before adding unique indexes.
- Raw PostgreSQL INSERT/UPDATE statements do **not** assume that CAP returns a row array. The repository reads back the affected UUID inside the same transaction and verifies identity or changed fields before auditing. The first-login INSERT read-back is mandatory before reporting `created: true`.
- Audit action `PORTAL_USER_AUTO_CREATE` or `PORTAL_USER_IDENTITY_LINK` is inserted into `BTP_TBL_AUDIT_LOG` in the same transaction; rollback on audit failure.

## Post-deployment verification in BAS

Build and validate the edited project, preserving local secrets and CF app env:

```sh
npm run check
npm test
mbt build
python3 scripts/verify-mtar.py mta_archives/mawani-customer-portal-backend_0.7.2.mtar
cf deploy mta_archives/mawani-customer-portal-backend_0.7.2.mtar
cf apps
```

Open the Application Router's **home page** (the domain URL ending in `/`) in a private browser window and sign in with an IAS test user. It should return an OData JSON response from `/profile/me()` similar to:

```json
{
  "@odata.context": "$metadata#ProfileService.MyProfile",
  "UUID": "<generated database uuid>",
  "IAS_ID": "<verified SCIM user uuid>",
  "ACCOUNT_TYPE": "PORTAL_USER",
  "ACTIVE_STATUS": true,
  "created": true
}
```

The context and shape depend on CAP serialization; other fields may be present. Reopening `/profile/me()` must return `created: false` and the **same** database UUID. The existing admin `/admin/getUsers(limit=20,offset=0)` should show the new user record if an authorized administrator opens it. This is read-only verification and must not create duplicate accounts. Check corresponding `PORTAL_USER_AUTO_CREATE` audit rows in the database using your authorized database query workflow.

## Operational limitations

- A successful IAS sign-in to the IAS console itself does not run provisioning in this portal; an authenticated request must reach CAP (the router root or `/profile/me()`).
- This release has offline tests but is **not yet live-tested** on the bound Cloud Foundry PostgreSQL database. Verify with one approved test user before granting broad access.
- If the IAS user has been pre-created manually in PostgreSQL and marked inactive, login does not activate the profile. That requires an explicit authorized administrative process.
- Maintain secure service credentials outside source control, and inspect the MTAR before deployment. Do not expose IAS client secrets or browser authentication tokens.
- The DB currently has no unique constraint on `IAS_ID` or (`IAS_ISSUER`, `IAS_SUBJECT`). The advisory lock prevents concurrent writes through this code path, but an authorized DBA should eventually assess unique indexes after checking for duplicate legacy data and coordinating with other writers.

### Read-only verification of audit counts from Cloud Foundry

Because the BAS terminal may not have access to the private PostgreSQL endpoint,
run the bundled, read-only reporting script as a one-off Cloud Foundry task:

```sh
cf run-task mawani-portal-srv --command "node scripts/provisioning-preflight.js" --name mawani-provisioning-preflight
cf tasks mawani-portal-srv
cf logs mawani-portal-srv --recent
```

Look for `portalUserCount`, `verifiedIdentityLinkCount`, and `provisioningAuditActions`
from the task logs; they contain **counts only**. Confirm the task state is
`SUCCEEDED`. A fresh test login should increase `PORTAL_USER_AUTO_CREATE` by
one; the next login should not increment it again.
