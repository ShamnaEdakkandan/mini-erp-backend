# Folio backend: concepts and working process

This is the Basic ERP V1 backend for local development. All Basic ERP React screens are connected to Django. Swagger offers another interface to the same authenticated APIs.

## Use Swagger

1. Run Django on port 8000 and Next.js on port 3000.
2. Open [Swagger](http://127.0.0.1:8000/api/docs/).
3. Use the login form at the top with an account created in the ERP. The documentation host and frontend may have separate browser cookies, so sign in again there if needed.
4. Expand an endpoint, choose **Try it out**, fill in the fields, and **Execute**.
5. Use the IDs returned by your own requests. Example IDs are placeholders, not seeded records.

Swagger writes change real data. A successful payment, movement, or return is a new event; do not resubmit it. After a timeout, inspect the document/history before retrying. Posting a document twice is rejected without repeating stock changes.

The Authorize dialog is unnecessary for session authentication. The login form sets the Django session cookie. Swagger obtains a current CSRF token automatically before every write, including login and sign-up. The [OpenAPI schema](http://127.0.0.1:8000/api/schema/) is the machine-readable contract; [ReDoc](http://127.0.0.1:8000/api/redoc/) is an alternative reading view.

## Concepts and code

| Concept            | Meaning and ERP example                                                       | File                                                         |
| ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Model              | Describes stored fields, such as a product's SKU, price and stock.            | operations/models.py                                         |
| Foreign key        | Links a line to its product and invoice.                                      | DocumentLine model                                           |
| Migration          | Creates tables while preserving existing customer records.                    | operations/migrations/0001_initial.py                        |
| Serializer         | Validates JSON and rejects invalid quantities or another workspace's product. | operations/serializers.py                                    |
| Service            | Executes a business operation such as posting a sale.                         | operations/services.py                                       |
| Atomic transaction | If one sale item has insufficient stock, every change is rolled back.         | services.py and views.py                                     |
| Permission         | Checks the user's workspace and role on every request.                        | operations/permissions.py                                    |
| View and router    | Map an HTTP address to an operation.                                          | operations/views.py and urls.py                              |
| Reporting          | Reads actual posted records and computes summaries.                           | operations/reports.py                                        |
| Swagger            | Documents requests/responses and lets you execute them.                       | schema.yaml and operations/templates/operations/swagger.html |
| Tests              | Check calculations, permissions, rollback, and error cases.                   | operations/tests.py and customers/test\_\*.py                |

## Workspaces and roles

Existing sign-ups remain owners of their own workspaces. They are ERP Admins, not Django staff or superusers. Customers retain their existing owners. Unowned legacy customers remain hidden until deliberately assigned by a Django superuser.

An ERP Admin creates a **new** team account through `POST /api/users/`, supplying username, password, name, email, role and status. This cannot attach unrelated existing accounts or grant Django staff/superuser flags.

| Role    | Read business records | Write business records | Manage team and settings |
| ------- | --------------------- | ---------------------- | ------------------------ |
| Admin   | Yes                   | Yes                    | Yes                      |
| Manager | Yes                   | Yes                    | No                       |
| Staff   | Yes                   | Add/update; no delete  | No                       |

Deleting a team user deactivates them; it does not erase their identity. You cannot deactivate/demote yourself or the workspace owner. Inactive users cannot sign in. All lists, detail URLs, reports and related-record fields enforce workspace ownership.

## Endpoint map

All paths start with `/api/`. See Swagger for exact request and response fields.

| Path                                    | Purpose                                                     |
| --------------------------------------- | ----------------------------------------------------------- |
| auth/session/                           | GET current user, role, workspace and CSRF token            |
| auth/signup/, auth/login/, auth/logout/ | POST account operations                                     |
| customers/, customers/{id}/             | Customer CRUD                                               |
| suppliers/, suppliers/{id}/             | Supplier CRUD                                               |
| products/, products/{id}/               | Product CRUD/current inventory; stock is read-only          |
| stock-movements/, stock-movements/{id}/ | POST movement, GET immutable movement history               |
| documents/, documents/{id}/             | Sales, purchase orders and bills; edit/delete drafts only   |
| documents/{id}/post/                    | POST finalize a draft                                       |
| documents/{id}/convert-to-bill/         | POST create one draft bill from a posted purchase order     |
| documents/{id}/payments/                | POST payment or refund                                      |
| returns/, returns/{id}/                 | POST return, GET immutable return history                   |
| expenses/, expenses/{id}/               | Expense CRUD with synchronized cash entry                   |
| transactions/, transactions/{id}/       | GET cash register                                           |
| transactions/opening-balance/           | Admin POST one opening balance per Cash/Bank transfer       |
| settings/                               | GET company settings, Admin PATCH changes                   |
| users/, users/{id}/                     | Admin-only team management                                  |
| dashboard/                              | GET summaries, recent records, low stock, monthly sales     |
| accounting/                             | GET cash, income, expenses, profit and outstanding balances |
| reports/{report}/                       | GET one of the seven reports                                |

New lists return `{count, next, previous, results}` and accept `limit` (default 25, maximum 500) and `offset`. Customers retains its existing plain-array contract so its frontend keeps working. Search and applicable status/category/kind/date filters are documented in Swagger.

Money is returned as decimal strings. Dates use YYYY-MM-DD. Quantities are whole units. A document supports up to 100 distinct product lines. Numeric record IDs are distinct from human-readable document numbers.

## Walkthrough: purchase, sale, payment and return

### Create contacts and a product

Create a customer and supplier with their respective endpoints. Only a name is required for contacts. Create a product using `POST products/`:

```json
{
  "name": "Keyboard",
  "sku": "KEY-001",
  "category": "Electronics",
  "cost": "20.00",
  "price": "35.00",
  "min": 5,
  "unit": "pcs",
  "tax": "5.00",
  "status": "Active"
}
```

Stock starts at zero. Add it through a purchase bill or a stock movement. The product's cost is a configured reference cost; a purchase bill does not automatically replace it.

### Receive a purchase

Create a document with `kind: "Purchase Bill"`, a supplier ID, and items containing product ID, quantity, unit `price` (purchase cost) and tax. POST its `post/` action to receive stock and establish the payable. Make payments separately when money leaves cash/bank.

Alternatively, create a Purchase Order, post it to confirm it, then use `convert-to-bill/`. Conversion creates a draft bill. A posted order has no stock, cash or payable effect. A linked bill still needs posting before goods are received.

### Create and post a sale

Use your saved customer and product IDs with `POST documents/`:

```json
{
  "kind": "Sale",
  "customer": 1,
  "date": "2026-09-07",
  "discount": "0.00",
  "items": [{ "product": 1, "quantity": 2, "price": "35.00", "tax": "5.00" }]
}
```

Django computes subtotal 70.00, tax 3.50 and total 73.50. It generates a unique number from Settings. Drafts can be edited/deleted and do not affect stock or outstanding balances.

Posting checks active contacts/products and sufficient stock, reduces inventory, stores the product cost snapshot for profit reporting, writes stock history and locks the document. Failed posting leaves every product and the draft unchanged.

Discount is a fixed amount allocated proportionally **before tax**, using cumulative rounding so lines reconcile to the total. Line tax defaults to zero if omitted; settings/preferences do not silently rewrite line values.

### Record payment

POST to `documents/{id}/payments/`:

```json
{ "amount": "73.50", "method": "Cash", "date": "2026-09-07", "refund": false }
```

Payments cannot exceed the remaining balance. Sales receipts are positive cash entries; supplier payments are negative. Paid/Partial/Unpaid is derived from actual payments, not trusted from submitted JSON.

### Return one item and refund its credit

POST to `returns/`, using the document's **line ID**, not its product ID:

```json
{
  "document": 1,
  "date": "2026-09-07",
  "reason": "One keyboard returned",
  "items": [{ "line": 1, "quantity": 1 }]
}
```

A sales return adds stock; a purchase return removes it and fails if insufficient stock remains. Total returned quantity cannot exceed the original line quantity. Original discounted prices/tax/cost are used, even after catalogue prices change. Repeated partial returns reconcile exactly to the original total.

After full payment in this example, the return creates a credit of 36.75. Refund it through the payments endpoint with `refund: true`. Refunds cannot exceed available credit. Payments and returns must be dated on or after the latest event for the document.

## Other working rules

- Stock movements accept In, Out, or Adjustment. Adjustment quantity is the desired absolute stock balance. A reason is required. Negative stock is rejected; history cannot be edited/deleted.
- Expenses are paid immediately. Editing updates the linked negative cash entry; deleting removes it. This is a simple cash register, not immutable statutory bookkeeping.
- Currency is locked after financial records exist. Document numbering cannot move backwards. Tax/display preferences do not recalculate historical documents.
- Referenced products, customers and suppliers cannot be deleted: mark them Inactive. Posted documents cannot be deleted/edited: use returns/refunds. Products with stock history are also protected.

## Reports and accounting basis

Report names: sales, purchases, inventory, expenses, customer-balances, supplier-balances, profit-loss.

Responses include report, count, results, and summary. Report detail pagination defaults to 50 rows (maximum 500). Search filters detail rows; summary covers the workspace/date range, not just the current page/search.

- Sales/purchases include posted sales/bills, reduced by returns dated in the selected period. Detail rows show original documents separately.
- Profit = sales excluding tax - product cost captured at sale posting - paid expenses. Returns reverse original revenue/tax/cost.
- This is configured-cost reporting, not FIFO or weighted-average inventory valuation.
- Receivables/payables and credits are cumulative through date_to, ignoring date_from.
- Cash/bank balances are cumulative through date_to, including opening balances, payments, refunds and expenses. Card is grouped with bank.
- Inventory reports show current stock; historical stock reconstruction is not included.
- Generated CSV/PDF exports are not included; the original V1 scope requested export button UI only.

## Django admin and verification

Create your own administrator in a backend terminal:

```powershell
.\.venv\Scripts\python.exe manage.py createsuperuser
```

There are no seeded credentials. [Django Admin](http://127.0.0.1:8000/admin/) can manage customers and assign legacy unowned customers. Operational/financial models are registered for inspection, with writes disabled so admin edits cannot bypass stock/payment workflows. Use the API for those changes.

Run checks from backend:

```powershell
.\.venv\Scripts\python.exe manage.py test customers operations
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe manage.py spectacular --file schema.yaml --validate --fail-on-warn
```

SQLite uses IMMEDIATE transactions to serialize writes at the start of atomic workflows. Services re-read documents before posting/paying/returning and use conditional stock updates. SQLite has no row-level select_for_update locks. This is local development, not a tested high-throughput deployment; busy database errors return 503 with a check-before-retry message.

Production hosting/security configuration, email verification, password reset, login rate limiting, advanced audit trails, double-entry accounting and multi-currency conversion remain outside this implementation. Django retains local development settings. No HR, payroll, manufacturing or other advanced ERP modules were added.

### Verified in this implementation

All 46 Django tests and the frontend production build passed. Schema generation with validation and fail-on-warn passed. Swagger rendered with all documented modules. A live temporary workspace completed purchase order conversion, bill receipt, a sale, payment, return/refund, expense entry, report calculation, team login and Staff write denial. Only the generated verification records were removed afterward; existing user data was preserved.

## How Swagger UI was created

1. Added `drf-spectacular` and `drf-spectacular-sidecar` to `requirements.txt`. Spectacular generates the OpenAPI contract; sidecar supplies local JavaScript/CSS assets.
2. Registered both Django apps in `config/settings.py`. Set `REST_FRAMEWORK["DEFAULT_SCHEMA_CLASS"]` to `drf_spectacular.openapi.AutoSchema`. `SPECTACULAR_SETTINGS` provides the title, version and asset settings.
3. Defined serializer fields and annotated custom actions with `extend_schema`. These describe request bodies, responses and filters rather than creating a separate API implementation.
4. Added three routes in `config/urls.py`: `SpectacularAPIView` serves `/api/schema/`, `SpectacularSwaggerView` renders `/api/docs/`, and `SpectacularRedocView` renders `/api/redoc/`.
5. Extended the Swagger template in `operations/templates/operations/swagger.html` with a login form and request interceptor. Login establishes the Django session; the interceptor obtains a CSRF token before writes. Both documentation and frontend call the same protected views.
6. Generated `schema.yaml` using `manage.py spectacular --file schema.yaml --validate --fail-on-warn`. The file is a snapshot; `/api/schema/` reflects the current code.

## Frontend integration audit — 2026-09-08

| Screen                | Live Django source and actions                                         |
| --------------------- | ---------------------------------------------------------------------- |
| Dashboard             | dashboard/ with date range and actual recent records                   |
| Customers / Suppliers | customers/, suppliers/ CRUD and calculated balances                    |
| Inventory / Products  | products/ CRUD; stock-movements/ for In, Out and Adjustment            |
| Sales                 | documents/ drafts, posting, payments and returns/                      |
| Purchases             | documents/ orders, conversion to bills, posting, payments and returns/ |
| Expenses              | expenses/ CRUD with linked cash/bank transactions                      |
| Accounting            | accounting/, transactions/ and opening-balance action                  |
| Reports               | reports/ endpoints with search, dates and server pagination            |
| Users                 | users/ role-aware management and deactivation                          |
| Settings              | settings/ persisted company, tax, currency and numbering               |
| Accounts              | auth/ signup, login, session and logout                                |

The shared `src/lib/api.js` handles cookies, CSRF and nested validation errors. `erp-api.js` loads paginated collections, and `use-workspace.js` refreshes related data after saves. Server values determine totals and stock. `currency.js` formats the saved currency. Reports paginate on the server; workspace tables fetch all pages and filter locally, appropriate for V1 small datasets.

Browser tests run with `npm run test:e2e` and installed Microsoft Edge. Their two servers use ports 3100/8001, `.next-e2e` and `backend/.e2e.sqlite3`; they never use the normal business database. The test database retains disposable randomly named workspaces across runs. Export remains a button preview, matching the original V1 requirement. Production deployment/security and statutory accounting remain outside this local V1 completion.


Verification completed: 46 Django tests passed; three ERP browser tests passed (full workflow/persistence/mobile, Staff permissions, failed-save recovery); the separate Swagger rendering/login/schema test passed. Production build passed. OpenAPI validation passed without warnings, and makemigrations --check --dry-run reported no changes.

## Staff data entry — 2026-09-08

Staff can create and update business records, post documents, and record payments, returns and stock movements. Staff cannot delete records, manage users, change company settings, or set opening balances. Admin and Manager retain business deletion permissions. The backend enforces permissions on every request; the frontend exposes the corresponding controls.

Workflow: an Admin creates a Staff account under Users. Staff logs in to the same workspace, adds contacts/products, receives stock through posted purchase bills, creates and posts sales, and records payments or expenses. Returns reverse goods; refunds settle resulting credits. Managers/Admins review reports and handle deletion of eligible records. Do not sign up separately to join an existing workspace.

Verification: all 28 operations tests passed, including Staff create/update, denied deletion and Admin-only boundaries. Browser verification confirmed Staff can save a customer, cannot see deletion/user controls, and cannot edit settings. OpenAPI schema validation passed without warnings.
