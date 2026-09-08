# Folio Basic ERP backend

Django 5.2 and Django REST Framework now provide workspace authentication and roles, contacts, products, stock history, sales/purchases, payments, returns, expenses, settings, dashboard summaries and seven reports. Swagger documents the API and supports authenticated requests.

All Basic ERP React screens are connected to the Django APIs, including document posting, payments, returns, stock, reports, team users and company settings.

## Run locally

In a project-root terminal:

```powershell
npm run dev
```

In another terminal:

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

For a fresh environment, run inside backend first:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

SQLite data is in backend/db.sqlite3. The database and virtual environment are ignored by Git; migrations and pinned requirements are versioned. No business records or credentials are seeded.

## Open

- [ERP frontend](http://localhost:3000)
- [Swagger API explorer](http://127.0.0.1:8000/api/docs/)
- [OpenAPI schema](http://127.0.0.1:8000/api/schema/)
- [ReDoc](http://127.0.0.1:8000/api/redoc/)
- [Django Admin](http://127.0.0.1:8000/admin/)

Sign up in the ERP and use the same account in Swagger's login form. The localhost frontend and 127.0.0.1 documentation host may have separate cookies. Swagger handles CSRF automatically.

Create your own Django administrator with `.\.venv\Scripts\python.exe manage.py createsuperuser`. ERP Admin and Django superuser are different roles.

Read [API_GUIDE.md](API_GUIDE.md) for concepts, endpoints, examples, the purchase-to-sale-to-return workflow, calculation rules, permission rules, tests and limitations. The in-app Learning Guide records progress as well.
