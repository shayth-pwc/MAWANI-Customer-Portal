# Mawani Customer Portal — SAP CAP backend v0.7.4

**Current release:** v0.7.4 (IAS update read-back, database synchronization, read-only profile GET, CSRF-protected first-login POST).

Read **[docs/V0.7.4-IAS-DB-SYNC-AND-POST-BOOTSTRAP.md](docs/V0.7.4-IAS-DB-SYNC-AND-POST-BOOTSTRAP.md)** for full changes, deployment and live acceptance testing.

## Architecture

- `mawani-portal-srv`: SAP CAP Node.js backend at `/admin` and `/profile`.
- `mawani-portal-router`: SAP IAS-authenticated Application Router. Root `/` is a minimal bootstrap HTML page until React replaces it. It uses a protected POST then read-only GET to load the human user's profile.
- `srv/core`: SCIM integration, verified identity checks, administrator IAS-group authorization, PostgreSQL user/audit repositories, transactional profile provisioning and synchronization.
- Existing physical tables only: `public."BTP_TBL_USERS"`, `public."BTP_TBL_AUDIT_LOG"`. No generated CDS persistence deployment.
- Existing Cloud Foundry resources only: `PostgreSQL-Hyperscaler-inst`, `CIS-app-Inst`.

## API overview

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/profile/me()` | Read-only authenticated profile; does not provision |
| POST | `/profile/provision` | Idempotent authenticated and CSRF-protected first-login creation/link |
| GET | `/admin/getUsers(limit=20,offset=0)` | Admin list of portal profiles |
| GET | `/admin/getIasUser(id='...')` | Admin IAS directory read |
| POST | `/admin/createIasUser` | Create IAS identity and PostgreSQL profile immediately |
| POST | `/admin/syncIasUserToPortal` | Insert if missing; existing profile kept unchanged |
| POST | `/admin/reconcileIasUserToPortal` | Explicitly align IAS email/name/status to portal |
| POST | `/admin/updateIasUser` | SCIM update with raw read-back plus DB sync and audit |
| POST | `/admin/setIasUserActive` | SCIM status verified, then DB sync and audit |
| POST | `/admin/updatePortalUser` | Local-only permitted PostgreSQL profile changes |

All `/admin` operations require verified IAS administrator-group membership. PostgreSQL `ACCOUNT_TYPE` never confers administrator authority. Existing inactive local profiles remain blocked during login.

## Build and validate in SAP BAS

```sh
npm install
npm run check
npm test
node test/qa-browser-v074.mock.cjs
mbt build
python3 scripts/verify-mtar.py mta_archives/mawani-customer-portal-backend_0.7.4.mtar
cf deploy mta_archives/mawani-customer-portal-backend_0.7.4.mtar
```

Do not check in `.env`, local IAS technical credentials or private service keys. Do not run `cds deploy` against the existing tables. Live IAS verification and PostgreSQL audit checks are required after deployment; offline success is not production acceptance.

## Historical design notes

Older documents in `docs/` describe earlier releases and may reference a side-effecting GET, an older administrator bootstrap, or older MTAR versions. **The v0.7.4 release note overrides those historical instructions.**
