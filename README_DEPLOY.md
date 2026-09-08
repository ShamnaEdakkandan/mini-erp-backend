Deployment guide
================

Frontend (Vercel)
- Connect your GitHub repo to Vercel and import the project.
- Framework: Next.js. Build command: `npm run build`.
- Set environment variable `NEXT_PUBLIC_API_BASE` to your deployed backend URL.

Backend (Render / Railway / Heroku)
- Use a managed Postgres and set `DATABASE_URL` env var.
- Ensure `DJANGO_SETTINGS_MODULE=config.settings` if needed.
- Add `ALLOWED_HOSTS` and CORS origins for your frontend domain.
- Run migrations: `python manage.py migrate` on the host or via deploy hooks.

Notes
- This repo uses SQLite locally; migrate to Postgres for production.
- The repo includes `Procfile`, `runtime.txt`, and production `requirements.txt` entries to simplify deployment.
