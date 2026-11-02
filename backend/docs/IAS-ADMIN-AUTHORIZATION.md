# IAS group authorization for portal administrators (Phase 1 v5)

## Why this differs from v4

The old guard demanded a PostgreSQL portal profile with `ACCOUNT_TYPE=SYSTEM_ADMIN`.
In v5, portal administrator access depends on **current IAS group membership**, not a
portal classification in `BTP_TBL_USERS`.

The IAS group called `Admin` for the **Mawani Portal** application is the proposed
privilege group. `MAWANI_SYSTEM_ADMIN` is described as BTP/service administration
and must NOT automatically grant portal-wide identity administration.

## Required configuration

Set `MAWANI_PORTAL_ADMIN_GROUP_ID` to the **SCIM UUID** of the group approved as the
Mawani Portal administrative group. Find it using `node --env-file=.env scripts/ias-groups.js`.
Ensure the selected group has the correct application scope and membership.
Never configure a group by user-supplied display name or email address.

Ensure IAS credentials (`IAS_SCIM_*`) are also provided to the **deployed** app
through secure Cloud Foundry secret configuration. A local `.env` does not deploy.

## Verified identity and authorization

- CAP IAS middleware must first validate token signature, audience, and issuer.
- The JWT must contain `iss`, `sub` and `user_uuid`. Configure `user_uuid`
  (Global User ID) for this IAS application if absent.
- The guard calls `/scim/Users/{user_uuid}?attributes=id,active,groups`
  using server-side IAS technical credentials.
- It requires the active returned SCIM user to have a `groups[].value` exactly
  matching the configured privileged group UUID.
- A missing or unrecognized group, missing user, SCIM failure, or missing claim
  fails closed. If a local portal profile exists but is inactive or outside
  BEGDA/ENDDA, access is denied.
- No `BTP_TBL_USERS` row is automatically created.
- When the actor has no portal row, IAS Global User ID + issuer + subject are
  recorded in `BTP_TBL_AUDIT_LOG.ACTION_DESCRIPTION` for write audit.

## Cautions

- SCIM `groups` inclusion/pagination must be confirmed against the real IAS
  tenant before using privileged production endpoints. Empty groups fail closed.
- Access is granted by the approved portal-admin group only, not all IAS groups.
- Verify the exact SCIM group ID and membership from the IAS console before
  deploying. Do not enable admin access for unrelated BTP infrastructure groups.
- Every admin request currently results in a SCIM read. For future scale,
  consider AMS, scoped policies, availability strategy and safe short-term caching.
- For high assurance audit, a dedicated actor-identity field is recommended
  in a future reviewed schema migration. No migrations are performed in Phase 1.
- Do not test user updates or deactivation until authorization has been verified
  with a human IAS token and a dedicated test identity.

## Check

```sh
npm run check
npm test
mbt build
cf deploy mta_archives/mawani-customer-portal-backend_0.5.0.mtar
```

A SCIM technical-client service key alone is NOT a human IAS user token. A
browser-based login through an IAS-enabled App Router may be needed for testing.
