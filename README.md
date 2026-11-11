# MAWANI Customer Portal

> **License branch audit (2026-11-04):** See [backend/docs/LICENSES_BRANCH_AUDIT.md](backend/docs/LICENSES_BRANCH_AUDIT.md) for confirmed fixes, C4C/CR authorization gaps and required DEV validation. Do not deploy the license actions until those prerequisites are resolved.

**Developer guide — React frontend, SAP CAP backend, SAP IAS, PostgreSQL and SAP BTP Cloud Foundry**  
**Baseline:** Phase 2 DEV integration, SAP CAP backend `0.7.4`  
**Repository:** https://github.com/shayth-pwc/MAWANI-Customer-Portal

> **Read this first.** This guide describes the **combined repository** where the React application remains at the repository root and the SAP CAP project lives in `backend/`. The current BAS working copy has these changes, but developers must confirm that the backend and Phase 2 frontend changes have been pushed and merged before assuming a fresh GitHub clone contains them. The original GitHub `main` branch was frontend-only when this guide was prepared. Commands below are for the agreed combined layout; they are not instructions to recreate IAS, PostgreSQL, or Cloud Foundry services.
>
> **Security:** Never commit `.env` files, service keys, IAS SCIM secrets, private certificates, database credentials, temporary backups, generated `dist/` files or MTAR archives. Keep existing SAP BTP services and database tables. Deploy only to an approved environment after reviews and tests.

## Contents

1. [System overview](#1-system-overview)
2. [Source layout and ownership](#2-source-layout-and-ownership)
3. [Prerequisites and access](#3-prerequisites-and-access)
4. [First-time clone and setup](#4-first-time-clone-and-setup)
5. [Frontend team: develop and test](#5-frontend-team-develop-and-test)
6. [Backend team: develop and test](#6-backend-team-develop-and-test)
7. [Identity, sessions and administrative APIs](#7-identity-sessions-and-administrative-apis)
8. [Git branching, commits and pull requests](#8-git-branching-commits-and-pull-requests)
9. [Build and deploy the integrated portal to DEV](#9-build-and-deploy-the-integrated-portal-to-dev)
10. [Post-deployment acceptance tests](#10-post-deployment-acceptance-tests)
11. [Security and repository hygiene](#11-security-and-repository-hygiene)
12. [Troubleshooting](#12-troubleshooting)
13. [Rollback, release management and responsibilities](#13-rollback-release-management-and-responsibilities)
14. [Command reference](#14-command-reference)

## 1. System overview

The portal uses **one Git repository** and **two deployable SAP BTP modules**:

```text
Browser (React 19 + Vite 8 + Tailwind CSS 4)
    |
    | HTTPS, same-origin cookies
    v
SAP BTP Application Router: mawani-portal-router
    |-- SAP IAS sign-in, session and /logout
    |-- /assets/* and React SPA HTML
    |-- /profile/* and /admin/* -> srv-api destination
    v
SAP CAP Node.js service: mawani-portal-srv
    |-- /profile : authenticated profile and first-login provisioning
    |-- /admin   : IAS and portal-user management (admin only)
    |-- IAS Directory SCIM (technical credentials held server-side)
    `-- PostgreSQL Hyperscaler (existing portal users and audit logs)
```

| Area | Technology / service | Purpose |
| --- | --- | --- |
| Frontend | React, Vite, React Router, Tailwind CSS | Existing Arabic/English, RTL-capable customer UI |
| Authentication | SAP Identity Authentication Service (IAS) | End-user sign-in and IAS directory |
| Edge/router | `@sap/approuter` | Session handling, static files and protected API routing |
| Backend | SAP CAP (Node.js), OData actions/functions | API logic, validation, authorization and IAS synchronization |
| Persistence | PostgreSQL Hyperscaler | Existing portal-user and audit records |
| Hosting | SAP BTP Cloud Foundry | DEV deployment, tasks, logs and service bindings |

### What is implemented

- IAS sign-in through the Application Router, session verification, logout and first-login provisioning.
- `/profile/me()` as read-only profile retrieval; `/profile/provision` as CSRF-protected provisioning.
- An admin-only React **User Management** screen at `/user-management`, using the CAP `/admin` service.
- IAS user listing, lookup, creation, name/email updates, activation/deactivation, portal synchronization and reconciliation.
- Existing user and audit tables, verified IAS-to-PostgreSQL synchronization and administrative audit logging.
- Existing portal screens and Arabic/English UI/RTL behavior.

**Not yet covered by real business APIs:** Some dashboard, commercial registration, licensing, invoicing, visits, requests and violations data is still demonstration/mock data. A working screen does not imply a live business-service integration. IAS group membership management is **read-only** in this baseline; there is no supported UI action to assign or remove group memberships.

## 2. Source layout and ownership

The **target, version-controlled** structure is:

```text
MAWANI-Customer-Portal/              # Git repository root / React project
├── src/                             # React UI, routes, hooks, services, contexts
│   ├── pages/admin/                 # IAS User Management UI
│   ├── services/adminIasApi.js      # Admin CAP API client
│   ├── services/portalSession.js    # IAS session and profile bootstrap
│   └── services/portalProfile.js    # Profile mapping
├── public/                          # Source assets
├── deploy/xs-app.btp.json           # App Router routing template (source)
├── scripts/stage-react-to-btp.mjs   # Vite -> App Router staging script
├── test/                            # Frontend session/admin API tests
├── package.json                     # React npm scripts
├── package-lock.json
├── vite.config.js
├── eslint.config.js
├── .env.example                     # Placeholder values only
├── .gitignore
├── README.md                        # This guide
└── backend/                         # SAP CAP + MTA project
    ├── srv/                         # CDS services, controllers, security, IAS/DB logic
    ├── scripts/                     # Preflight, checks, diagnostics, MTAR scanner
    ├── test/                        # CAP/unit/security tests
    ├── docs/                        # Backend implementation notes
    ├── .deploy/app-router/
    │   ├── package.json
    │   └── xs-app.json              # App Router routing configuration (source)
    ├── mta.yaml                     # MTA modules, destinations, existing services
    ├── package.json
    └── package-lock.json            # Keep if present/generated and reviewed
```

**Generated locally, not stored in Git:** root `node_modules/`, `dist/`; backend `node_modules/`, `gen/`, `mta_archives/`; and `backend/.deploy/app-router/portal-bootstrap/` (the staged React output). The stage script regenerates the last directory before a deployment build.

**Team boundaries:** Frontend owns root `src/`, React config and React tests; backend owns `backend/srv/`, backend services and tests. **Both** teams review changes to `deploy/xs-app.btp.json`, `backend/.deploy/app-router/xs-app.json`, `backend/mta.yaml`, authentication, shared API contracts and staging scripts.

## 3. Prerequisites and access

### Tools

Install or use these tools in an approved workstation / **SAP Business Application Studio (BAS)** environment:

- Git and access to the GitHub repository.
- Node.js and npm compatible with the project lockfiles. CAP backend declares Node `^22 || ^24`; the validated Cloud Foundry backend used Node 24.22.1. Check `node -v` and `npm -v`. Use a consistent supported version per team.
- SAP BAS or a compatible IDE; SAP CAP development tools (`@sap/cds-dk`) installed via backend dev dependencies.
- Cloud Foundry CLI (`cf`), Cloud MTA Build Tool (`mbt`) and the Cloud Foundry **MultiApps** plugin (providing `cf deploy`) for deployment roles.
- Python 3 for `backend/scripts/verify-mtar.py`.
- Permissions for the **existing** DEV Cloud Foundry organization/space, if deploying or running CF tasks.
- Authorized IAS test accounts. Backend changes that touch IAS/DB require explicit access and approved test identities.

Check tools:

```bash
node -v
npm -v
git --version
cf --version
cf plugins
mbt --version
python3 --version
```

The production-acceptance tenant, Cloud Foundry org and runtime services are managed by the platform team. **Do not create substitute databases, IAS tenants or service instances.**

### Known DEV environment (not for production)

| Item | Value |
| --- | --- |
| CF API | `https://api.cf.sa30.hana.ondemand.com` |
| CF org | `mawani-btp-dev` |
| CF space | `mawani-btp-dev-SP` |
| CAP CF application | `mawani-portal-srv` |
| Application Router CF application | `mawani-portal-router` |
| Existing PostgreSQL service instance | `PostgreSQL-Hyperscaler-inst` |
| Existing IAS service instance | `CIS-app-Inst` |
| Portal | `https://mawani-btp-dev-mawani-btp-dev-sp-mawani-portal-router.cfapps.sa30.hana.ondemand.com/` |

Do not hardcode production hosts, secret values, or personal credentials in source code.

## 4. First-time clone and setup

### Step 1: Clone the repository

```bash
cd /home/user/projects

git clone https://github.com/shayth-pwc/MAWANI-Customer-Portal.git mawani-react-frontend
cd mawani-react-frontend

git remote -v
git branch --show-current
git status --short
```

The commands below assume that `/home/user/projects/mawani-react-frontend` is your repo root. If you use another location, substitute that path.

### Step 2: Confirm the combined repository is available

```bash
ls package.json
ls backend/package.json
ls backend/mta.yaml
ls backend/.deploy/app-router/xs-app.json
ls scripts/stage-react-to-btp.mjs
```

If `backend/` or the Phase 2 scripts are **missing**, you cloned an older/frontend-only branch. **Stop and ask the repository maintainer to merge the approved combined frontend/backend changes first.** Do not run old patch ZIP installers on a fresh repo or create an empty backend folder as a substitute.

### Maintainer-only: import the existing backend once (if GitHub is still frontend-only)

This is a **one-time migration**, not a step every developer repeats. Run it only in the BAS checkout that already contains the tested standalone backend, and only after creating a reviewed integration branch. If `backend/package.json` already exists, **skip this step**; do not overwrite backend changes.

```bash
cd /home/user/projects/mawani-react-frontend

git switch -c feature/combine-react-cap-projects
mkdir -p backend

tar -C /home/user/projects/mawani-customer-portal-phase1-configured \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.env*' \
  --exclude='default-env.json' \
  --exclude='.cdsrc-private.json' \
  --exclude='.mawani-*' \
  --exclude='*backup*' \
  --exclude='_archive' \
  --exclude='dist' \
  --exclude='gen' \
  --exclude='coverage' \
  --exclude='mta_archives' \
  --exclude='portal-bootstrap' \
  --exclude='*_mta_build_tmp' \
  --exclude='*.mtar' \
  --exclude='*.zip' \
  --exclude='*.pem' \
  --exclude='*.key' \
  --exclude='*.p12' \
  --exclude='*.log' \
  --exclude='service-key*' \
  -cf - . | tar -C backend -xf -
```

Review the result before adding files:

```bash
ls backend/srv backend/test backend/.deploy/app-router
find backend -type d \( -name node_modules -o -name mta_archives -o -name portal-bootstrap -o -name '*backup*' \) -print
git status --short --untracked-files=all
```

Expected `find` output: **nothing**. Review `.gitignore` in Section 11, run the complete build in Section 9, and stage **only approved source**. Use a PR to merge the combined project into `main`. Keep the original standalone backend until the merged repo has been cloned and built successfully. Do not run old integration overlay installers on the new combined source.

### Step 3: Install frontend dependencies

```bash
# Repository root
npm ci
```

Use `npm ci` for the committed frontend lockfile. If dependencies change intentionally, update and commit the reviewed `package-lock.json` along with `package.json`.

### Step 4: Install backend dependencies

```bash
cd backend

if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

cd ..
```

The backend v0.7.4 source archive did not contain a lockfile, although the working BAS checkout may have one. **If your combined repo lacks `backend/package-lock.json`, generate it deliberately, review it, and commit it in a dependency-maintenance PR** to make future builds reproducible.

### Step 5: Inspect local configuration

```bash
cat .env.example
cat backend/package.json
cat backend/mta.yaml
```

`.env.example` is public documentation **only** and must contain no secrets. The frontend must **not** be given `VITE_API_TOKEN`, IAS SCIM client credentials, bearer tokens or database passwords. The integrated frontend uses same-origin Application Router sessions, not an embedded technical token.

## 5. Frontend team: develop and test

### Step 1: Create a feature branch

```bash
cd /home/user/projects/mawani-react-frontend
git switch main
git pull --ff-only origin main
git switch -c feature/FE-123-description
```

Replace `FE-123-description` with the actual ticket and description.

### Step 2: Start the Vite development server (UI-only)

```bash
npm ci
npm run dev -- --host 0.0.0.0
```

Use the BAS preview URL or the address printed by Vite. **Important limitation:** Vite by itself is *not* SAP Application Router and does not create an IAS session or CAP destination. Protected pages and real `/profile` and `/admin` requests may fail in a standalone Vite preview. For real authentication, current-user data and administrator operations, use the integrated **DEV** App Router deployment or an explicitly configured, approved local auth/proxy environment. Never fake production IAS authentication to make an API test pass.

For a static production-build preview (same limitation):

```bash
npm run build
npm run preview -- --host 0.0.0.0
```

### Step 3: Change React source

- Screens and components: `src/pages/`, `src/components/`, `src/layouts/`.
- Navigation: `src/routes/AppRoutes.jsx`, `src/components/layout/Sidebar.jsx`.
- Session and profile: `src/services/portalSession.js`, `src/services/portalProfile.js`, `src/context/`.
- IAS admin operations: `src/pages/admin/`, `src/hooks/useAdminAccess.js`, `src/services/adminIasApi.js`.
- Styles, translations and RTL: keep existing behavior unchanged unless the ticket explicitly calls for a change.

Use **relative, same-origin API URLs** (`/profile/...`, `/admin/...`) with browser session cookies. Do not call IAS SCIM endpoints directly from React. Do not expose `backend` technical credentials in `VITE_*` variables: Vite embeds those values in browser assets.

### Step 4: Run frontend quality gates

```bash
# Repository root
npm run lint
npm run test:btp
npm run test:admin
npm run build
```

| Script | Verifies |
| --- | --- |
| `npm run dev` | Start Vite for UI-focused development |
| `npm run lint` | ESLint checks for the React codebase |
| `npm run test:btp` | Session / CSRF / provisioning / identity checks (`test/btp-session.test.mjs`) |
| `npm run test:admin` | IAS admin API-client checks, permissions and write safety (`test/admin-ias.test.mjs`) |
| `npm run build` | Generate deployable Vite output in `dist/` |
| `npm run preview` | Preview the compiled frontend (not a substitute for IAS integration) |
| `npm run stage:btp` | Validate/copy built React assets to backend App Router; see deployment section |

After dependency changes, review `npm audit --omit=dev` and `npm audit` results and record security findings. Do not use `npm audit fix --force` without a reviewed compatibility plan.

### Step 5: Verify integration without deploying

```bash
# Build first, then check staging. Check mode never writes backend files.
npm run build
npm run stage:btp -- "$PWD/backend" --check
```

A passing check proves the build and staging inputs are structurally compatible; **it does not prove live IAS login, user permissions, or API persistence**.

### Step 6: Review and commit

Follow [Section 8](#8-git-branching-commits-and-pull-requests). Frontend changes that alter routes, auth, admin access or API payloads need backend review. A UI component change alone does not require an MTA deployment until the feature is ready for integrated DEV verification.

## 6. Backend team: develop and test

### Step 1: Create your branch

```bash
cd /home/user/projects/mawani-react-frontend
git switch main
git pull --ff-only origin main
git switch -c feature/BE-123-description
cd backend
```

### Step 2: Understand backend structure

| Location | Responsibility |
| --- | --- |
| `backend/srv/admin-service.cds` and `.js` | Admin OData contract, handlers and access control |
| `backend/srv/profile-service.cds` and `.js` | Current-user profile and POST provisioning |
| `backend/srv/core/controllers/` | Request-level controller logic |
| `backend/srv/core/services/` | IAS/user/business operations |
| `backend/srv/core/clients/ias.client.js` | IAS SCIM HTTP interactions |
| `backend/srv/core/repositories/` | Parameterized PostgreSQL SQL and audit writes |
| `backend/srv/core/security/` | Verified identity and administrator restrictions |
| `backend/test/` | Backend regression, security and provisioning tests |
| `backend/mta.yaml` | SAP BTP modules, existing services, bindings and CF resources |

The backend uses **existing physical PostgreSQL tables**:

- `public."BTP_TBL_USERS"`
- `public."BTP_TBL_AUDIT_LOG"`

**Never run `cds deploy` against these existing tables.** Schema changes require a separately approved migration and coordination with the database owner.

### Step 3: Install, run checks and test

```bash
cd /home/user/projects/mawani-react-frontend/backend

if [ -f package-lock.json ]; then npm ci; else npm install; fi

npm run check
npm test
node test/qa-browser-v074.mock.cjs
```

Backend scripts in `backend/package.json`:

| Script | Purpose | Needs live bindings? |
| --- | --- | --- |
| `npm run check` | JavaScript syntax verification | No |
| `npm test` | Unit/security/IAS-DB contract tests | No live IAS writes; router fixture may require frontend staging |
| `npm run build` | CAP production build (`cds build --production`) | Depends on build configuration |
| `npm run dev` | `cds watch` local development | **Yes**, for real IAS/Postgres behavior |
| `npm start` | `cds-serve` | **Yes**, for live services |
| `npm run check:ias` | IAS SCIM connectivity/preflight | Yes |
| `npm run check:db` | PostgreSQL permissions/read-only preflight | Yes |
| `npm run check:ias:groups` | IAS group directory inspection | Yes |
| `npm run check:provisioning` | Provisioning preflight | Yes |
| `npm run diagnose:provisioning` | Provisioning diagnosis | Yes |
| `npm run check:admin:audit -- <IAS_ID>` | Read-only audit action summary | Database binding required |

**Integration routing tests:** `backend/test/phase1-v074.test.js` and `backend/test/user-provisioning.test.js` validate the staged React App Router. On a fresh clone, run the frontend build/staging steps in [Section 9](#9-build-and-deploy-the-integrated-portal-to-dev) **before** expecting the complete backend test suite to pass. Do not delete the tests to hide a missing build artifact.

### Step 4: Optional local CAP watch, only with approved configuration

```bash
cd /home/user/projects/mawani-react-frontend/backend
npm run dev
```

This command starts the CAP watch process; it **does not automatically configure IAS, PostgreSQL or SCIM credentials**. The backend requires valid Cloud Foundry service bindings or an approved local development configuration. Obtain these through the platform team and the supported SAP CAP/BAS binding workflow. Never copy live service keys into Git, frontend files, screenshots or pull requests.

Required IAS SCIM environment variable **names** (values are environment-specific, never committed):

```text
IAS_SCIM_BASE_URL
IAS_SCIM_AUTH_MODE          # basic or oauth2
IAS_SCIM_CLIENT_ID
IAS_SCIM_CLIENT_SECRET
IAS_SCIM_TOKEN_URL          # only when oauth2 mode is used
IAS_SCIM_TIMEOUT_MS        # optional
MAWANI_PORTAL_ADMIN_GROUP_ID
```

The database is provided by the **PostgreSQL Hyperscaler Cloud Foundry service binding** (not an unprotected browser or direct frontend connection). Do not replace the binding with a hardcoded password or service-key JSON.

### Step 5: Run read-only preflight checks on Cloud Foundry

Use CF tasks when local binding is not available; the deployed `mawani-portal-srv` has the service bindings. Only run these against the approved DEV target:

```bash
cf target
cf run-task mawani-portal-srv --command "npm run check:db" --name mawani-db-preflight
cf run-task mawani-portal-srv --command "npm run check:ias" --name mawani-ias-preflight
cf tasks mawani-portal-srv
cf logs mawani-portal-srv --recent
```

These example tasks are intended as preflight checks. Inspect script contents and permissions before adding new tasks; never assume every diagnostic is read-only.

### Step 6: Update tests alongside contracts

- Add/modify CDS definitions and CAP implementations together.
- For IAS writes, verify a fresh IAS SCIM read-back before reporting success.
- For PostgreSQL changes, use parameterized statements, transactional audit writes and a SELECT/read-back.
- Preserve issuer/subject identity linkage and disabled/expired-account restrictions.
- Do not use email or frontend state as proof of administrative authority.
- If IAS succeeded but local DB sync failed (`IAS_PORTAL_SYNC_PENDING` / HTTP 503), **inspect first**; do not automatically repeat remote create/PATCH operations.
- Changes to `/profile`, `/admin` or security behavior require matching frontend API tests and router regression checks.

## 7. Identity, sessions and administrative APIs

### Authentication sequence

1. Visitor opens a protected React route on the **Application Router**.
2. App Router redirects to IAS if there is no valid session.
3. After successful IAS authentication, React requests a CSRF token from `GET /profile/$metadata`.
4. React calls `POST /profile/provision` for safe first-login creation/linking.
5. React reads `GET /profile/me()` and displays the **server-owned** identity.
6. React calls `/admin` endpoints only if the current user is entitled to administrator operations. **Every `/admin` request is independently authorized by CAP**.
7. Logout uses the Application Router `/logout` endpoint and the `/signed-out` landing page.

`GET /profile/me()` is **read-only**. Do not change it to create database records on GET.

### Core CAP API reference

| Method | Path | Access / purpose |
| --- | --- | --- |
| GET | `/profile/me()` | Signed-in user's current PostgreSQL profile |
| POST | `/profile/provision` | Signed-in user first-login provision/link; CSRF required |
| GET | `/admin/getUsers(limit=20,offset=0)` | Admin portal DB users |
| GET | `/admin/listIasUsers(startIndex=1,count=25)` | Admin IAS directory page |
| GET | `/admin/getIasUser(id='...')` | Admin IAS user by SCIM ID |
| POST | `/admin/createIasUser` | Admin create IAS user and portal DB profile |
| POST | `/admin/updateIasUser` | Admin update IAS-sourced details, with read-back and DB sync |
| POST | `/admin/setIasUserActive` | Admin activate/deactivate IAS and local profile |
| POST | `/admin/syncIasUserToPortal` | Create missing portal row, preserve existing row |
| POST | `/admin/reconcileIasUserToPortal` | Explicitly overwrite IAS-owned local fields from IAS |
| POST | `/admin/updatePortalUser` | Admin update permitted local-only portal attributes |
| GET | `/admin/listIasGroups(startIndex=1,count=50)` | Admin IAS group list (**read only**) |

The backend AdminService also exposes `getUser`, `createPortalUser` and `getIasGroup`. Check `backend/srv/admin-service.cds` for the authoritative parameter and return contracts before changing clients.

### Administrator authorization

- Admin IAS group name: `MAWANI_SYSTEM_ADMIN`; its environment-specific ID is provided by `MAWANI_PORTAL_ADMIN_GROUP_ID` in the backend deployment configuration.
- CAP checks verified IAS group membership and local-account restrictions; a React sidebar link is **not** an authorization boundary.
- Ordinary authenticated users must receive **HTTP 403** for admin calls, including direct API requests.
- The React `User Management` menu and `/user-management` page are not a substitute for server-side enforcement.
- Read-only group listing is available; group-assignment APIs are **not** part of v0.7.4.

### Example request flow (browser DevTools, authenticated App Router origin)

```javascript
// Read-only self profile; response contains personal data — don't paste publicly.
const profileResponse = await fetch('/profile/me()', {
  credentials: 'same-origin',
});
console.log(profileResponse.status);

// Admin access probe: HTTP 200 for authorized admins, 403 for non-admins.
const adminResponse = await fetch('/admin/listIasUsers(startIndex=1,count=1)', {
  credentials: 'same-origin',
});
console.log(adminResponse.status);
```

For write operations, **use the tested API client** in `src/services/adminIasApi.js` or obtain the App Router CSRF token. Never place IAS technical credentials or personal passwords in browser requests.

## 8. Git branching, commits and pull requests

### Team policy (recommended)

- `main`: reviewed, deployable code only. Do not develop directly on it.
- `feature/FE-...`: React/UI changes.
- `feature/BE-...`: CAP/IAS/DB changes.
- `fix/...`: defects and security patches.
- Every functional change gets a descriptive commit and pull request (PR). Cross-layer changes require **both** frontend and backend review.
- Do not merge a PR with failing tests or unreviewed secrets. An authorized release owner performs Cloud Foundry deployment.

### Step 1: Sync before starting

```bash
cd /home/user/projects/mawani-react-frontend

git switch main
git pull --ff-only origin main
git switch -c feature/FE-123-user-table
```

### Step 2: Make changes and run the appropriate tests

Frontend example:

```bash
npm run lint
npm run test:btp
npm run test:admin
npm run build
```

Backend example:

```bash
cd backend
npm run check
npm test
cd ..
```

For an integrated change, run the full staged build described in Section 9 as well.

### Step 3: Inspect source changes and prevent accidental files

```bash
git status --short --untracked-files=all
git diff --check
git diff --stat
```

Stage **only intended paths** whenever practical:

```bash
# Example — adjust to files you actually changed.
git add src/pages/admin src/services/adminIasApi.js test/admin-ias.test.mjs

git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
```

If a sensitive/generated file was staged by mistake, unstage it before commit:

```bash
git restore --staged path/to/unwanted-file
```

If a sensitive file was *previously tracked*, `.gitignore` alone does not remove it from Git history. Stop and involve the repository/security owner to remove it from tracking/history and rotate any exposed credentials.

### Step 4: Commit and push the branch

```bash
git commit -m "feat(admin): improve IAS user management table"
git push -u origin feature/FE-123-user-table
```

Create a PR from that branch into `main`. Include: what changed, screenshots for UI changes, test output, security implications, migration/deployment impact, and rollback notes.

### Step 5: Update an existing feature branch

For a branch that has already been pushed and shared for review, merge the latest `main` rather than rewriting shared history:

```bash
git fetch origin
git merge origin/main
# Resolve conflicts carefully; rerun tests.
git push
```

A branch that has **never** been pushed may instead be rebased onto `origin/main` according to team policy. **Do not use `git push --force`** to rewrite a shared/protected branch.

### Step 6: After PR approval/merge

```bash
git switch main
git pull --ff-only origin main
```

**First-time monorepo import:** Before pushing the existing BAS integration into GitHub, review the `backend/` copy and all staged paths. Include backend **source**, tests, `.deploy/app-router/xs-app.json`, `mta.yaml` and source lockfiles; exclude all temporary patch ZIPs, `.mawani-*` backups, `dist/`, staged React assets, `node_modules/`, credentials and MTARs. Don't delete the original separate BAS backend folder until a clean clone and complete build have been verified.

## 9. Build and deploy the integrated portal to DEV

**Important:** Only approved deployers should run `cf deploy`. This procedure uses the **combined monorepo**, *not* the old sibling folder path. It updates **two existing apps** (`mawani-portal-router`, `mawani-portal-srv`); it does not create a new frontend application.

### Step 1: Start from the reviewed release commit

```bash
cd /home/user/projects/mawani-react-frontend

git status --short
git log -1 --oneline
```

Expected: clean working tree, or only explicitly understood ignored generated files. Record the exact commit SHA in the deployment/change ticket.

### Step 2: Install and test the frontend

```bash
# Repository root
npm ci
npm run lint
npm run test:btp
npm run test:admin
npm run build
```

Do not continue on a failed command. The commands are presented separately to make failure location obvious.

### Step 3: Stage the React build into backend App Router

```bash
# Still at repository root
npm run stage:btp -- "$PWD/backend" --check
npm run stage:btp -- "$PWD/backend"
```

`--check` validates routes, required build assets and security-sensitive inputs **without modifying files**. The real staging command copies `dist/` to `backend/.deploy/app-router/portal-bootstrap/` and applies the reviewed routing template from `deploy/xs-app.btp.json` to `backend/.deploy/app-router/xs-app.json`. It makes **local timestamped backups** (ignored by Git); those backups must not be included in commits or MTARs.

Check the actual staged configuration:

```bash
cat backend/.deploy/app-router/xs-app.json
ls backend/.deploy/app-router/portal-bootstrap
```

Expected behavior: IAS-protected React fallback; `/profile`, `/profile/registration`, `/profile/password` served by React; actual `/profile/...` API calls and `/admin/...` forwarded to `srv-api` with IAS/CSRF; `/logout` handled by App Router; only intended public login/static pages excluded from IAS protection.

### Step 4: Validate backend and MTA source

```bash
cd backend
if [ -f package-lock.json ]; then npm ci; else npm install; fi
npm run check
npm test
node test/qa-browser-v074.mock.cjs
```

The validated Phase 2 baseline had **87 backend tests**, **10 frontend session tests** and **11 admin API-client tests**; counts may increase with future work. All tests must pass. The backend test suite depends on the staged router configuration from Step 3.

### Step 5: Build the MTA

```bash
# Inside backend/
mbt build
ls -lh mta_archives/
```

Expected current baseline archive:

```text
backend/mta_archives/mawani-customer-portal-backend_0.7.4.mtar
```

Do not type placeholders such as `<generated-file>` literally in a shell command; substitute the actual filename shown by `mbt build`.

### Step 6: Verify the MTAR and audit dependencies

```bash
# Inside backend/
python3 scripts/verify-mtar.py \
  mta_archives/mawani-customer-portal-backend_0.7.4.mtar

unzip -l mta_archives/mawani-customer-portal-backend_0.7.4.mtar
npm audit --omit=dev
```

`verify-mtar.py` is a **filename-oriented credential check**, including nested ZIPs. A PASS does **not** mean every file has been scanned for embedded secrets or that dependencies are secure. Confirm the router module actually contains the generated React files and that API/IAS routes and CF service bindings are still correct.

**Known open findings at the time of this baseline:** backend install reported **3 high-severity npm advisories**, and App Router logged a **ReDoS warning** for the regex `^/(profile|admin)(/.*)?$`. Triage and resolve/approve these before production promotion; don't run `npm audit fix --force` without review. The React bundle also previously reported a >500 kB chunk-size warning (performance, not a build failure).

### Step 7: Log in to Cloud Foundry and verify target

```bash
cf login -a https://api.cf.sa30.hana.ondemand.com --sso
cf target -o mawani-btp-dev -s mawani-btp-dev-SP
cf target
cf apps
cf services
```

Confirm the exact **DEV** target and both existing services. Do not deploy if the CLI is targeting a different org/space or if a required binding is missing. Avoid pasting full `cf env` output because it can include credentials.

### Step 8: Deploy approved MTAR to DEV

```bash
# From repository root, or use an absolute path:
cd /home/user/projects/mawani-react-frontend/backend
cf deploy mta_archives/mawani-customer-portal-backend_0.7.4.mtar
```

This is a consequential action: it updates Cloud Foundry apps and may restart running instances. Follow the project's change-approval process, inform testers and retain the previous approved MTAR for rollback. The services in `backend/mta.yaml` are declared as **existing services**; do not change their type to a newly managed service without platform approval.

### Step 9: Verify Cloud Foundry health

```bash
cf apps
cf logs mawani-portal-router --recent
cf logs mawani-portal-srv --recent
cf tasks mawani-portal-srv
```

Both `mawani-portal-router` and `mawani-portal-srv` should report `started`, `web:1/1` (or the approved expected instance count), with successful initialization. A login redirect before authentication is expected, but **a 302/HTML login page is not proof that the React app authenticated and loaded**.

## 10. Post-deployment acceptance tests

Use the DEV portal:

https://mawani-btp-dev-mawani-btp-dev-sp-mawani-portal-router.cfapps.sa30.hana.ondemand.com/

### Frontend acceptance (frontend team + QA)

1. Open a fresh private browser session; confirm protected routes redirect to IAS.
2. Sign in as an **active** test user and verify React renders, the dashboard loads and the correct profile identity appears (not sample identity).
3. Verify `POST /profile/provision` and `GET /profile/me()` succeed after login (DevTools Network; do not share tokens or PII).
4. Open `/profile` directly and refresh. Confirm it renders the React profile page rather than a CAP 404.
5. Check `/profile/registration` and `/profile/password` route to React where used.
6. Check English/Arabic, RTL, responsive layout and navigation.
7. Sign out using `/logout`; check session termination behavior under the IAS tenant SSO policy.
8. Confirm demo/business data is clearly distinguished from real API responses.

### Administrator acceptance (backend + frontend + authorized QA)

1. Sign in as an **approved**, active IAS member of `MAWANI_SYSTEM_ADMIN`; verify `/user-management` and the menu link appear.
2. List IAS users with pagination and retrieve one permitted test user by IAS ID.
3. Run IAS create/update/status/sync/reconcile **only against approved test identities**; verify IAS and PostgreSQL results and audit records. Avoid modifying a normal employee or administrator.
4. If a write returns 503 or uncertain synchronization, **verify IAS and PostgreSQL state before retrying**.
5. Sign in as a nonadministrator in a separate browser session; verify the admin link is absent, `/user-management` denies access, and direct `/admin` calls return HTTP **403**.

### Read-only audit verification task

The v0.7.4 backend includes a read-only audit summary script. Use an **approved test IAS ID**:

```bash
# Replace YOUR_APPROVED_TEST_IAS_ID with the actual approved ID.
cf run-task mawani-portal-srv \
  --command "node scripts/admin-audit-verify.js YOUR_APPROVED_TEST_IAS_ID" \
  --name mawani-admin-audit-check
cf tasks mawani-portal-srv
cf logs mawani-portal-srv --recent
```

**Do not run browser-based write acceptance scripts casually or repeatedly.** They can temporarily deactivate IAS identities and modify PostgreSQL records.

## 11. Security and repository hygiene

### Keep source, exclude generated or sensitive files

Recommended **root `.gitignore` rules** (merge with existing rules rather than overwriting the file):

```gitignore
# Dependencies and build outputs
**/node_modules/
**/dist/
**/coverage/
**/gen/
**/mta_archives/
**/*_mta_build_tmp/
**/*.mtar

# Generated React output staged into App Router
/backend/.deploy/app-router/portal-bootstrap/

# Local patch installers, temp backups and archives
**/.mawani-*/
**/*backup*/
**/_archive/
*.zip

# Credentials and local service binding configuration
**/.env
**/.env.*
!**/.env.example
**/default-env.json
**/.cdsrc-private.json
**/service-key*
**/*.pem
**/*.key
**/*.p12
**/*.pfx

# Local editor/log artefacts
.DS_Store
*.log
```

**Notes:** `.env.example` must still be reviewed for real values. Never rely on `.gitignore` as your sole security control. Check already-tracked files with `git ls-files` and staged changes with `git diff --cached --name-only`. The ignore pattern `*.zip` is for this repository's temporary installers; remove or narrow it only if a future source-controlled ZIP is explicitly required.

### Never commit or expose

- IAS SCIM client IDs/secrets, OAuth tokens, passwords or activation links.
- Cloud Foundry `VCAP_SERVICES`, service keys, `default-env.json`, certificates/private keys or database passwords.
- Raw `cf env` dumps, private account records, audit rows with personal details or token-bearing browser network captures.
- Temporary integration/patch directories and backups (`.mawani-*`, `mawani-phase2-*`, original ZIP packages).
- Built React assets, generated MTAR files or installed dependencies.

Use the existing server-side IAM/SCIM credentials and secure environment configuration. **Do not add a privileged admin credential to React.** Review dependency audit findings and the ReDoS warning before production release.

## 12. Troubleshooting

| Symptom | Likely cause | Resolution |
| --- | --- | --- |
| `rsync: command not found` | BAS does not include rsync | Not needed after monorepo merge; `git clone` is the supported workflow |
| `cd..: command not found` | Missing space | Use `cd ..` |
| `npm ci` fails due to missing lockfile | Lockfile was not committed | For backend only, use `npm install` once, review and commit lockfile in approved PR |
| `npm run test:admin` is unknown | Old frontend-only checkout | Confirm Phase 2/admin UI commit is on your branch |
| Vite page cannot call `/profile` or `/admin` | Bare Vite has no IAS App Router session | Use deployed DEV App Router for full integration testing |
| `GET /profile` returns CAP error | React route order not staged correctly | Verify source template, rerun `stage:btp`, recheck router tests |
| Backend router tests fail on `bootstrap.js` | Old v0.7.4 tests or unstaged React | Use the integrated backend tests; build and stage React first |
| HTTP 401 / redirect to IAS | No valid authenticated App Router session | Sign in via the DEV router origin; don't use bare CAP route for browser login |
| IAS says “could not authenticate you” | Possible locked/inactive/password issue | Check IAS account state and IAS troubleshooting events; avoid repeated attempts |
| HTTP 403 for `/admin` | Missing IAS admin group, inactive/expired local profile or denied identity | Verify with IAS admin and CAP security logs; never bypass guard in frontend |
| Missing CSRF token on POST | Incorrect route/session or token fetch | Use tested `/profile/$metadata` or `/admin/$metadata` client flow |
| `IAS_PORTAL_SYNC_PENDING` / HTTP 503 | IAS operation may have succeeded while local DB update failed | Inspect IAS state and portal row; use approved reconciliation, **do not blindly retry create** |
| `cf deploy` not recognized | MultiApps plugin missing | Ask platform team to install/enable CF MultiApps plugin |
| `cf apps` shows stopped/crashed app | Startup or binding error | Check `cf logs <app> --recent`, services and recent deploy events |
| `bash: generated-file: No such file` | Typed literal `<generated-file>` in shell | Use actual `.mtar` filename from `ls mta_archives/` |
| MTAR filename scan passes but advisories remain | Filename check is not dependency scanning | Run `npm audit --omit=dev`, triage with security owner |
| Large Vite bundle warning | Chunk larger than Vite threshold | Consider code-splitting in a separate performance ticket; build can still succeed |

## 13. Rollback, release management and responsibilities

### Safe release practice

1. Record the reviewed Git commit SHA and the exact generated MTAR filename.
2. Retain a securely stored copy of the **previous approved MTAR** and its release notes.
3. Verify CF org/space and approved maintenance window before deployment.
4. After deployment, complete the live tests in Section 10.
5. If a regression occurs, stop write-based acceptance tests, capture logs and get approval to redeploy the previous known-good MTAR. Be aware that restoring an old application package **does not undo IAS or PostgreSQL data changes**.

### Versioning caveat

The backend package and MTA are at **`0.7.4`**, while the combined release now includes React and admin UI features. The current `stage-react-to-btp.mjs` includes a **v0.7.4 baseline check**. When making a new release version, coordinate updates to `backend/mta.yaml`, backend `package.json`, release tests and staging script; don't change only one version string.

### Team ownership / sign-off

| Activity | Frontend team | Backend team | Platform / security | QA / release owner |
| --- | --- | --- | --- | --- |
| React pages, accessibility, language/RTL | Own | Consult | — | Validate |
| Session/admin API clients | Own | Review contract/security | Review auth assumptions | Validate |
| CAP CDS, IAS SCIM, DB repositories | Consult | Own | Review sensitive operations | Validate |
| App Router route template and MTA | Review | Review/own | Approve platform/security changes | Validate |
| Local/unit tests | Run FE tests | Run BE tests | — | Review evidence |
| Cloud Foundry deployment | Support | Support | Authorize access | Approve/coordinate |
| Live IAS/DB write tests | UI verification | API/audit verification | Approve test identities | Coordinate and restore |

## 14. Command reference

### Frontend — repository root

```bash
npm ci
npm run dev -- --host 0.0.0.0
npm run lint
npm run test:btp
npm run test:admin
npm run build
npm run preview -- --host 0.0.0.0
npm run stage:btp -- "$PWD/backend" --check
npm run stage:btp -- "$PWD/backend"
```

### Backend — `cd backend`

```bash
npm run check
npm test
node test/qa-browser-v074.mock.cjs
npm run dev             # Requires approved IAS/PostgreSQL local binding
npm run build           # CAP build; separate from mbt MTA packaging
npm run check:db        # Requires bound PostgreSQL
npm run check:ias       # Requires IAS SCIM credentials
npm run check:ias:groups
npm run check:provisioning
npm run diagnose:provisioning
mbt build
python3 scripts/verify-mtar.py mta_archives/mawani-customer-portal-backend_0.7.4.mtar
```

### Cloud Foundry — approved DEV deployer

```bash
cf login -a https://api.cf.sa30.hana.ondemand.com --sso
cf target -o mawani-btp-dev -s mawani-btp-dev-SP
cf target
cf apps
cf services
cf deploy mta_archives/mawani-customer-portal-backend_0.7.4.mtar  # from backend/
cf logs mawani-portal-router --recent
cf logs mawani-portal-srv --recent
cf tasks mawani-portal-srv
```

---

**Maintainers:** Keep this README up to date whenever routes, scripts, runtime dependencies, IAS/DB contracts or deployment steps change. The authoritative API definitions remain in `backend/srv/*.cds`; the source deployment rules remain in `deploy/xs-app.btp.json`, `backend/.deploy/app-router/xs-app.json` and `backend/mta.yaml`. Backend historical design notes in `backend/docs/` may describe obsolete flows; prefer the current integrated source and tests.
