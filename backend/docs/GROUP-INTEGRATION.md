# IAS group integration — read-only phase

This module exposes paginated IAS group metadata through CAP. Users and group
memberships are deliberately not returned. It calls the SAP Cloud Identity
Services Identity Directory SCIM `/scim/Groups` endpoint.

The local IAS tenant screenshot showed the following *names* (these are not
verified SCIM ids): `Admin`, `Anonymous`, `DEVELOPER`,
`MAWANI_DEVELOPERS_CF`, `MAWANI_EMPLOYEES`, `MAWANI_EXTERNAL_USERS`,
`MAWANI_PORTAL_END_USER`, `MAWANI_SYSTEM_ADMIN`, and `POA_AGENT`.

Read-only CAP operations:

- `GET /admin/listIasGroups(startIndex=1,count=50)`
- `GET /admin/getIasGroup(id='SCIM-GROUP-ID')`

Authorization: both operations are guarded by the existing database-backed
`SYSTEM_ADMIN` access checks. IAS groups are **not** interchangeable with
portal `ACCOUNT_TYPE` classification. Mapping group claims into authorization
requires separate verified token/membership evidence and an approved mapping
policy. Do not equate an IAS application-specific `Admin` group with the
BTP infrastructure `MAWANI_SYSTEM_ADMIN` group.

To verify: execute `node --env-file=.env scripts/ias-groups.js` in BAS
(read-only); its output is the authoritative source for the live SCIM group
identifiers, not the screenshot. After storing IAS technical client credentials
securely in Cloud Foundry and establishing the initial portal administrator,
call the CAP endpoints with a correctly authenticated *human* IAS session.

Before introducing membership write operations, add a dedicated authorization
policy, disallow privileged group modification by default, use SCIM version/ETag
preconditions where supported, add secure audit events, and test against a
nonprivileged dedicated test account. This phase does not do any of these
writes.

In v5 IAS group membership for the configured portal-admin group IS used for authorization; see IAS-ADMIN-AUTHORIZATION.md.
