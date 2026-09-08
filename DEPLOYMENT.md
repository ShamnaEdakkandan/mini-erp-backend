# GitHub and Vercel deployment

Status: instructions only. Nothing has been pushed or deployed. The application currently uses local-development Django settings and SQLite; the production preparation below must be implemented before deploying the backend. Setting environment variables alone does not change the current hard-coded settings.

## 1. Keep frontend and backend together on GitHub

Your repository already has `origin` set to https://github.com/ShamnaEdakkandan/mini-erp.git and your branch is `main`. No new repository or second `git init` is needed.

- Root: Next.js frontend, package.json, src/.
- backend/: Django code, requirements.txt, models and migrations.
- Git stores code and migrations. PostgreSQL will store deployed accounts and business records.

From a terminal in `C:\Users\shamn\mini-erp`:

```powershell
git status
git add .
git diff --cached --stat
git diff --cached --name-only
git commit -m "Connect ERP backend and refine account UI"
git push origin main
```

Review staged files before committing. `.gitignore` excludes node_modules, virtual environments, SQLite databases, environment files and test output. Never add account credentials, database exports or real secrets. The existing `django-insecure-...` key is development-only and must not be used online. If Git rejects a push because the remote has newer commits, fetch and reconcile those changes before retrying; do not force push.

If your own terminal reports dubious ownership, verify that this is your project, then run `git config --global --add safe.directory C:/Users/shamn/mini-erp` for this exact folder. Do not use a wildcard exception.

## 2. Deployment architecture

One GitHub repository → two Vercel projects → one hosted PostgreSQL database:

| Project   | Root directory | Framework | Purpose                                         |
| --------- | -------------- | --------- | ----------------------------------------------- |
| folio-web | ./             | Next.js   | Screens and same-origin /api proxy              |
| folio-api | backend        | Django    | Authentication, business rules, database access |

The browser calls folio-web/api/...; the existing Next.js rewrite forwards it to folio-api/api/.... This keeps frontend requests and session cookies on the frontend origin. Test login, CSRF and cookie forwarding after deployment. Swagger on the backend domain has its own browser session.

Vercel supports Django with manage.py and the configured WSGI entrypoint. The existing config.wsgi.application is the appropriate entrypoint. A hosted PostgreSQL database is necessary; local SQLite is not persistent application storage on Vercel. See [Django on Vercel](https://vercel.com/docs/frameworks/full-stack/django), [monorepos](https://vercel.com/docs/monorepos) and [SQLite limitations](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel).

## 3. Prepare Django before deployment — not implemented yet

Update backend/config/settings.py and requirements.txt to:

1. Read a new random SECRET_KEY from an environment variable, with DEBUG=False in production and a startup error if the production secret is missing.
2. Add a PostgreSQL driver and database URL parser (for example psycopg and dj-database-url), pin compatible versions, and configure DATABASES from DATABASE_URL. Do not copy SQLite-only transaction_mode/timeout options to PostgreSQL. Use the provider's SSL and pooling settings; test transaction/stock workflows against PostgreSQL.
3. Read ALLOWED_HOSTS from explicit backend/frontend hostnames and CSRF_TRUSTED_ORIGINS from explicit HTTPS frontend/backend origins. Avoid broad wildcards. Configure secure session/CSRF cookies and verified proxy HTTPS handling.
4. Set STATIC_ROOT and an absolute STATIC_URL of /static/ so admin and Swagger assets can be collected. Vercel's Django integration handles collection when STATIC_ROOT is configured.
5. Keep host-only session cookies for the existing proxy design. Verify the deployed cookie and CSRF flow instead of enabling unrestricted CORS.
6. Run Django tests and `python manage.py check --deploy` with production settings. Address the findings, including the real HTTPS/proxy configuration. Decide registration policy, login rate limiting and backup/recovery arrangements before allowing public business access.

These are configuration tasks, not values already supported by this repository. Do not deploy the current DEBUG=True backend as your production app.

## 4. Create the backend project and database

1. In Vercel, import the existing GitHub repository. Name the project folio-api, choose root directory backend and Django framework.
2. Create a hosted PostgreSQL database (for example through Vercel Marketplace) and connect its DATABASE_URL to this backend project. Use a separate database for previews/tests.
3. After implementing step 3, configure the matching environment variables: production secret, DATABASE_URL, allowed hosts and trusted HTTPS origins. Keep secrets on the backend project, never in NEXT_PUBLIC_ variables.
4. Run migrations once from a controlled release environment with production variables: `python manage.py migrate`. Do not run migrations inside each incoming request. Coordinate migrations separately from preview builds.
5. Deploy the backend. Verify /api/auth/session/, /api/docs/, and /admin/. Create a production superuser with `python manage.py createsuperuser` in that same controlled environment if you need Django Admin.

## 5. Create the frontend project

1. Import the same GitHub repository again, name it folio-web, select root ./ and framework Next.js.
2. Keep the normal install/build commands (`npm install` or npm's detected install command; `npm run build`).
3. Set `DJANGO_API_ORIGIN=https://YOUR-BACKEND-DOMAIN` without a trailing slash. This variable is already read by next.config.mjs.
4. Add the final frontend HTTPS domain to the backend's trusted origins. Redeploy affected projects after changing configuration; the frontend rewrite is built from its environment.
5. Use compatible deployment-protection settings so the frontend proxy can reach the API. Do not publish a bypass token in client code.
6. Deploy and verify sign-up/login, save/refresh, posting, payments, stock, Staff restrictions and logout. Open Swagger directly at the backend's /api/docs/.

## 6. Accounts, existing data and later updates

Your local SQLite users, the newly created Staff account and business records do not automatically appear in PostgreSQL. Either create production accounts through the deployed ERP or plan a backed-up data migration, including ownership and memberships. Do not commit SQLite or a credential-bearing export to GitHub.

After setup: edit locally → test → commit → push → linked Vercel deployments build. Coordinate backend changes and migrations so the frontend remains compatible during rollout. Keep preview deployments on separate data.

GitHub reference: [push existing local code](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).
