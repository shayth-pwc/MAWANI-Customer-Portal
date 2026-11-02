# Application Router integration — Phase 1 v0.6.0

This package preserves one existing CAP backend (`mawani-portal-srv`), one new Application Router (`mawani-portal-router`), and existing Cloud Foundry services (`PostgreSQL-Hyperscaler-inst`, `CIS-app-Inst`). It does **not** create a new managed IAS service or duplicate CAP app.

## IAS callback prerequisites

`CIS-app-Inst` is an **existing** identity service. MTA `existing-service` references do **not** update the underlying service instance's OAuth redirect-URI allowlist. Before attempting browser login, inspect the IAS application associated with `CIS-app-Inst`, and register the exact Application Router callback URI for this service instance, preserving existing redirect URIs:

`https://<actual-router-route>/login/callback?authType=ias`

Depending on the IAS/AppRouter callback behavior, you may also need the bare `/login/callback` URI; check the exact requested `redirect_uri` and register that exact value rather than using a broad wildcard. Use your authorized IAS administrator workflow to update the underlying IAS application or service instance. Don't replace existing URI settings or service configuration blindly.

## Deployment

1. Bring these files into your BAS project, retaining your local `.env` and working IAS technical credentials in Cloud Foundry.
2. Run `npm run check && npm test` in the project root.
3. Run `mbt build`. Before deployment, run `python3 scripts/verify-mtar.py mta_archives/mawani-customer-portal-backend_0.6.0.mtar` to inspect the MTAR (including nested module ZIPs) for local credential files. Package exclusion must be verified; `.gitignore` is **not** sufficient.
4. Run `cf deploy mta_archives/mawani-customer-portal-backend_0.6.0.mtar`.
5. Run `cf apps && cf app mawani-portal-router` to retrieve the actual router URL.
6. Confirm the service instance allows its precise login callback URI.
7. Open `https://<actual-router-route>/admin/listIasGroups(startIndex=1,count=50)` in a browser **via the router**, not the backend direct URL.

## Runtime checks

If IAS login succeeds but CAP responds 403, inspect *redacted* backend logs and verify the validated human IAS token provides `user_uuid`, the SCIM global ID matches the human IAS account, the IAS account is active, and it belongs to admin group `f42bbefb-eef9-49b9-be08-fac5e73636ba`. Do not print raw JWTs or service credentials.

## Security

- These APIs must remain protected by IAS authentication and application-level administrator checks.
- The router is a login entry point, not a replacement for CAP API authorization.
- CSRF protection remains enabled for state-changing methods.
- `.deploy/app-router/default-env.json` is intentionally excluded from this package; do not copy credentials there for deployment.
- A local `.env` is not deployed by this package. Existing CF environment variables remain separately configured but verify them after deployment.
- Run `npm audit --omit=dev` before production promotion.
