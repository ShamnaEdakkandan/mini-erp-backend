# Folio — Basic ERP frontend

A responsive Next.js 16 / React 19 frontend prototype with Tailwind CSS 4 and static mock data. No API routes, database, authentication service, or business backend.

## Run

- `npm install`
- `npm run dev` — local development at http://localhost:3000
- `npm run build` — production verification
- `npm start` — run the production build

## Screens

Dashboard, Sales and Returns, Purchase Orders/Bills and Returns, Inventory and Products, Customers, Suppliers, Expenses, Accounting, Reports, Users, and Settings.

## Structure

- `src/components/erp.js`: application state and modal coordination
- `src/components/navigation.js`: sidebar, navbar, workspace navigation
- `src/components/dashboard.js`: dashboard cards and charts
- `src/components/records.js`: searchable, filtered module lists
- `src/components/record-forms.js`: reusable record and invoice forms
- `src/components/reports.js`: report previews and date filters
- `src/components/settings.js`: session-scoped preferences
- `src/components/ui.js`: shared table, modal, inputs, badges, pagination, icons
- `src/components/shared.js`: shared table definitions and presentation helpers
- `src/lib/mock-data.js`: mock records, isolated for future API integration
- `src/app/globals.css`: responsive design system

Navigation uses URL fragments, including browser back/forward support. Data edits, invoices, returns, stock movements, and saved preferences live in React state for the current session and reset on reload. Invoice totals are calculated in the browser for preview only. Dashboard and accounting summaries are illustrative static figures. The export button is intentionally a preview, and returns do not post inventory or accounting entries.

## Verification

Production build verified. Browser checks cover desktop and mobile dashboard layouts, mobile navigation, customer search/status filters, and creating an invoice with a decimal partial payment.
