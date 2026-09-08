# Folio — Basic ERP frontend

A responsive Next.js 16 / React 19 / Tailwind CSS 4 interface connected to a Django REST Framework backend. All Basic ERP modules use workspace-scoped SQLite records, session login and role-based permissions.

## Run

- `npm install`
- `npm run dev` — local development at http://localhost:3000
- `npm run build` — production verification
- `npm start` — run the production build

For Django, open a second terminal from the repository root:

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver
```

This runs Django at http://127.0.0.1:8000. See [the backend setup guide](backend/README.md)
for the file explanations and environment installation steps.

## Screens

The Learning Guide has been removed from navigation. Backend explanations remain in `backend/API_GUIDE.md`.

Dashboard, Sales and Returns, Purchase Orders/Bills and Returns, Inventory and Products, Customers, Suppliers, Expenses, Accounting, Reports, Users, and Settings.

## Structure

- `src/components/erp.js`: application state and modal coordination
- `src/components/navigation.js`: sidebar, navbar, workspace navigation
- `src/components/dashboard.js`: dashboard cards and charts
- `src/components/records.js`: searchable, filtered module lists
- `src/components/record-forms.js`: reusable record and invoice forms
- `src/components/reports.js`: database reports and date filters
- `src/components/settings.js`: database-backed company preferences
- `src/components/ui.js`: shared table, modal, inputs, badges, pagination, icons
- `src/components/shared.js`: shared table definitions and presentation helpers
- `src/lib/mock-data.js`: historical mock fixture; not imported by the running UI
- `src/app/globals.css`: responsive design system

Navigation uses URL fragments, including browser back/forward support. All business changes persist through Django. Invoices and bills are saved as drafts and posted explicitly. Payments and returns are separate records. Dashboard, accounting and reports are calculated by Django. Export is still a preview button, as specified for V1.

## Verification

- `npm run build` checks the frontend production build.
- `npm run test:e2e` runs browser workflows in installed Microsoft Edge. It starts separate servers on ports 3100/8001 and uses `backend/.e2e.sqlite3`, never your normal database.
- From backend, `.\.venv\Scripts\python.exe manage.py test` tests validation, ownership, permissions and financial/stock workflows.
- From backend, `.\.venv\Scripts\python.exe manage.py spectacular --file schema.yaml --validate --fail-on-warn` validates OpenAPI.

## Basic ERP backend and Swagger

The backend now includes all V1 module APIs, workspace roles, document posting, stock movements, payments, returns, expenses, settings and reports. Open [Swagger](http://127.0.0.1:8000/api/docs/) and sign in with your ERP account to try them. Read [the backend API guide](backend/API_GUIDE.md) for concepts and a purchase-to-sale-to-return walkthrough.

All frontend modules are connected. The backend API guide includes backend and Swagger explanations. No default admin credentials were created.

## UI update — 2026-09-08

Removed Learning Guide navigation and help links. The navbar stays visible while the main content scrolls inside the viewport; wide tables scroll within their own panels and dialogs remain within the screen.

Verification: production build passed. Browser checks passed at desktop (1440px), tablet (768px), and mobile (390px), confirming a stationary navbar and no document-level overflow.

Scrollbar placement fix: removed the centered width cap and auto margins from the scrolling main area, so its scrollbar sits at the window’s far-right edge at every screen size.

## Profile and deployment guide — 2026-09-08

Replaced the plain profile with an account card showing username, role, workspace, status and access. Restored compact dialog widths and added logout busy/error handling. GitHub and two-project Vercel instructions are in [DEPLOYMENT.md](DEPLOYMENT.md), including the production configuration still required. A local Staff membership was created in the active workspace; credentials are not stored in source files.

Profile verification: production build passed; browser checks verified account details, compact width on desktop/mobile and successful logout. Updated OpenAPI validation passed.
