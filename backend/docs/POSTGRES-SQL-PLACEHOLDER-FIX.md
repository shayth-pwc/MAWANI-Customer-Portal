# v0.6.1 — PostgreSQL parameter binding fix

## Cause

The IAS administrator guard reached `UserRepository.findByIdentity()` after validating the user and checking IAS SCIM group membership. PostgreSQL returned SQLSTATE `42601` from a raw SQL query containing `?` parameter placeholders.

`@cap-js/postgres` passes plain SQL to the `pg` driver without converting `?` into numbered `$n` placeholders. PostgreSQL requires `$1`, `$2`, etc. in these prepared SQL statements.

## Scope

- `UserRepository`: find all, find by UUID, find by IAS ID, find by issuer + subject, update dynamic profile fields, create disabled portal profile.
- `AuditRepository.create`: audit inserts.
- `UserService.createFromIas`: advisory lock.
- Unit regression tests now assert numbered parameter placeholders and matching bind parameter positions.
- Existing schema and IAS/Cloud Foundry configuration remain unchanged.

## Build and deploy

From SAP BAS inside the existing project:

```sh
npm run check
npm test
mbt build
python3 scripts/verify-mtar.py mta_archives/mawani-customer-portal-backend_0.6.1.mtar
cf deploy mta_archives/mawani-customer-portal-backend_0.6.1.mtar
```

The guard should continue to reject unauthenticated/nonadmin users. Test via the Application Router URL, NOT the direct CAP route:

`/admin/listIasGroups(startIndex=1,count=50)`

No DB schema migration or administrator table bootstrap is needed. Do not commit `.env` or reveal raw tokens. Keep Cloud Foundry SCIM credentials secure.
