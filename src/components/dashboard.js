"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { documentRow } from "@/lib/erp-api";
import { DataTable, StatCard, StatusBadge } from "./ui";
import { useMoney } from "./currency";

function periodQuery(period) {
  const now = new Date();
  const month = period === "Last month" ? now.getMonth() - 1 : now.getMonth();
  const start = new Date(
    now.getFullYear(),
    period === "This year" ? 0 : month,
    1,
  );
  const end =
    period === "This year"
      ? new Date(now.getFullYear(), 11, 31)
      : new Date(now.getFullYear(), month + 1, 0);
  const format = (value) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  return `date_from=${format(start)}&date_to=${format(end)}`;
}
export function Dashboard({
  data,
  revision,
  navigate,
  onNew,
  openRecord,
  canWrite,
}) {
  const money = useMoney();
  const [range, setRange] = useState("This month");
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let active = true;
    setState({ loading: true });
    api(`dashboard/?${periodQuery(range)}`)
      .then((result) => {
        if (active) setState({ result });
      })
      .catch((error) => {
        if (active) setState({ error: error.message });
      });
    return () => {
      active = false;
    };
  }, [range, revision, attempt]);
  const result = state.result;
  const documents = (rows) =>
    rows.map((record) => documentRow(record, data.Customers, data.Suppliers));
  const columns = [
    { key: "number", label: "Document" },
    { key: "name", label: "Contact" },
    { key: "total", label: "Total", render: money },
    {
      key: "payment_status",
      label: "Payment",
      render: (value) => <StatusBadge status={value} />,
    },
  ];
  const max = result
    ? Math.max(
        1,
        ...result.sales_overview.map((row) => Math.abs(Number(row.total))),
      )
    : 1;
  return (
    <>
      <div className="page-heading">
        <h1>Dashboard</h1>
        <div className="heading-actions">
          <select
            aria-label="Dashboard date range"
            value={range}
            onChange={(event) => setRange(event.target.value)}
          >
            <option>This month</option>
            <option>Last month</option>
            <option>This year</option>
          </select>
          {canWrite && (
            <button className="primary" onClick={() => onNew("Sales")}>
              Create invoice
            </button>
          )}
        </div>
      </div>
      {state.loading ? (
        <p role="status">Loading dashboard...</p>
      ) : state.error ? (
        <div role="alert" className="auth-error">
          {state.error}
          <button
            className="secondary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            {[
              ["Total sales", "sales", "sales"],
              ["Total purchases", "purchases", "purchases"],
              ["Total expenses", "expenses", "expenses"],
              ["Total profit", "profit", "profit"],
              ["Amount receivable", "receivables", "wallet"],
              ["Amount payable", "payables", "accounting"],
              ["Total products", "products", "inventory"],
              ["Low stock items", "low_stock_items", "stock"],
            ].map(([title, key, icon]) => (
              <StatCard
                key={key}
                title={title}
                value={
                  ["products", "low_stock_items"].includes(key)
                    ? String(result[key])
                    : money(result[key])
                }
                icon={icon}
                foot={
                  ["receivables", "payables"].includes(key)
                    ? "Balance through period end"
                    : undefined
                }
              />
            ))}
          </div>
          <div className="dashboard-middle">
            <section className="panel chart-panel">
              <div className="panel-heading">
                <h2>Sales overview</h2>
                <span>{range}</span>
              </div>
              {result.sales_overview.length ? (
                <div
                  className="live-chart"
                  role="img"
                  aria-label={`Monthly net sales: ${result.sales_overview.map((row) => `${row.month} ${money(row.total)}`).join(", ")}`}
                >
                  {result.sales_overview.map((row) => (
                    <div className="live-bar-column" key={row.month}>
                      <span>{money(row.total)}</span>
                      <div
                        className={`live-bar ${Number(row.total) < 0 ? "negative" : ""}`}
                        style={{
                          height: `${Math.max(2, (Math.abs(Number(row.total)) / max) * 150)}px`,
                        }}
                      />
                      <small>{row.month}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty">
                  No posted sales or returns in this period.
                </p>
              )}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>Cash and bank</h2>
              </div>
              <div className="invoice-totals">
                <p>
                  Cash balance <b>{money(result.cash_balance)}</b>
                </p>
                <p>
                  Bank balance <b>{money(result.bank_balance)}</b>
                </p>
                <p>
                  Customer credits <b>{money(result.customer_credit)}</b>
                </p>
                <p>
                  Supplier credits <b>{money(result.supplier_credit)}</b>
                </p>
              </div>
              <p className="form-description">
                Cumulative balances through the selected period end.
              </p>
              <button
                className="text-button"
                onClick={() => navigate("Accounting")}
              >
                View transactions
              </button>
            </section>
          </div>
          <div className="dashboard-bottom">
            <section className="panel">
              <div className="panel-heading">
                <h2>Recent sales</h2>
                <button
                  className="text-button"
                  onClick={() => navigate("Sales")}
                >
                  View all
                </button>
              </div>
              <DataTable
                compact
                columns={columns}
                rows={documents(result.recent_sales)}
                onRow={(row) => openRecord("Sales", row)}
              />
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>Low stock products</h2>
                <button
                  className="text-button"
                  onClick={() => navigate("Inventory")}
                >
                  Inventory
                </button>
              </div>
              <DataTable
                columns={[
                  { key: "name", label: "Product" },
                  { key: "stock", label: "Stock" },
                  { key: "min", label: "Minimum" },
                ]}
                rows={result.low_stock_products}
                onRow={(row) => openRecord("Inventory", row)}
              />
            </section>
          </div>
          <div className="dashboard-bottom lower">
            <section className="panel">
              <div className="panel-heading">
                <h2>Recent purchases</h2>
              </div>
              <DataTable
                compact
                columns={columns}
                rows={documents(result.recent_purchases)}
                onRow={(row) => openRecord("Purchases", row)}
              />
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>Recent transactions</h2>
              </div>
              <DataTable
                compact
                columns={[
                  { key: "name", label: "Description" },
                  { key: "amount", label: "Amount", render: money },
                  { key: "date", label: "Date" },
                ]}
                rows={result.recent_transactions}
              />
            </section>
          </div>
        </>
      )}
    </>
  );
}
