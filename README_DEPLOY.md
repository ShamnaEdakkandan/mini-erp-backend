Deployment guide
================

Frontend (Vercel)
- Connect your GitHub repo to Vercel and import the project.
- Framework: Next.js. Build command: `npm run build`.
- Set environment variable `NEXT_PUBLIC_API_BASE` to your deployed backend URL.
- Automated deploy: a GitHub Actions workflow is included at `.github/workflows/deploy-frontend-vercel.yml`.
  - This workflow requires the repository secrets: `VERCEL_TOKEN` and `NEXT_PUBLIC_API_BASE`.
  - Alternatively you can run `scripts/deploy_frontend_vercel.sh` locally with environment variables.

Backend (Render)
- Create a Web Service on Render and connect it to the `mini-erp-backend` GitHub repo.
- Use a managed Postgres and set the `DATABASE_URL` env var on Render.
- Set environment variables on Render: `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=False`, `DJANGO_ALLOWED_HOSTS`, and `CORS_ALLOWED_ORIGINS`.
- Start/Deploy command: `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT` (Procfile is provided).
- Automated deploy: a GitHub Actions workflow is included at `.github/workflows/deploy-backend-render.yml`.
  - This workflow triggers a Render deploy via the Render API and requires the repository secrets: `RENDER_API_KEY` and `RENDER_SERVICE_ID`.
  - If you prefer, run `scripts/deploy_backend_render.sh` locally with `RENDER_API_KEY` and `RENDER_SERVICE_ID` environment variables.

Steps to enable automation (summary)
1. Frontend (Vercel):
   - Create a Vercel token: https://vercel.com/account/tokens
   - Add two repository secrets in GitHub: `VERCEL_TOKEN` and `NEXT_PUBLIC_API_BASE` (the backend URL).
   - The GitHub Actions workflow will build and deploy on push to `main`.

2. Backend (Render):
   - Create a Render API key: https://dashboard.render.com/account/api-keys
   - Create a Render Service (Web Service) connected to your backend repo.
   - In Render's service settings note the `Service ID` (in URL or API) and set a managed Postgres; copy its `DATABASE_URL`.
   - Add GitHub repository secrets: `RENDER_API_KEY` and `RENDER_SERVICE_ID`.
   - The GitHub Actions workflow will POST to Render's deploy API to trigger a deploy on push to `main`.

Security
- Store tokens/API keys in GitHub repository secrets — never commit them to source control.

Local deploy helper scripts
- `scripts/deploy_frontend_vercel.sh` — uses `VERCEL_TOKEN` and `NEXT_PUBLIC_API_BASE` env vars.
- `scripts/deploy_backend_render.sh` — uses `RENDER_API_KEY` and `RENDER_SERVICE_ID` env vars.

If you want, I can:
- add GitHub Actions to the backend repo (`mini-erp-backend`) as well, or
- proceed to help you create the Render service (I will need Render access / API key), or
- walk you through the GUI steps for both providers.
