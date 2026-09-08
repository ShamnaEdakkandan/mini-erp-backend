"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { dateToday, documentRow } from "@/lib/erp-api";
import { DataTable, FormInput, Pagination, StatCard } from "./ui";
import { useMoney } from "./currency";
const reportNames = [
  ["sales", "Sales Report"],
  ["purchases", "Purchase Report"],
  ["inventory", "Inventory Report"],
  ["expenses", "Expense Report"],
  ["customer-balances", "Customer Balance Report"],
  ["supplier-balances", "Supplier Balance Report"],
  ["profit-loss", "Profit & Loss Summary"],
];
export function Reports({ data, revision, toast }) {
  const money = useMoney();
  const [selected, setSelected] = useState("sales");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(dateToday().slice(0, 7) + "-01");
  const [to, setTo] = useState(dateToday());
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let active = true;
    setState({ loading: true });
    const timer = setTimeout(() => {
      const query = new URLSearchParams({
        search,
        limit: "6",
        offset: String((page - 1) * 6),
      });
      if (from) query.set("date_from", from);
      if (to) query.set("date_to", to);
      api(`reports/${selected}/?${query}`)
        .then((result) => {
          if (active) setState({ result });
        })
        .catch((error) => {
          if (active) setState({ error: error.message });
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selected, search, from, to, page, revision, retry]);
  const result = state.result;
  let rows = result?.results || [];
  const balanceReport = selected.endsWith("balances");
  if (["sales", "purchases"].includes(selected))
    rows = rows.map((row) => documentRow(row, data.Customers, data.Suppliers));
  let columns = [{ key: "name", label: "Name" }];
  if (selected === "inventory")
    columns.push(
      { key: "sku", label: "SKU" },
      { key: "stock", label: "Stock" },
      { key: "min", label: "Minimum" },
    );
  else if (balanceReport)
    columns.push(
      ...[
        ["total", "Net total"],
        ["paid", "Paid"],
        ["balance", "Balance"],
        ["credit", "Credit"],
      ].map(([key, label]) => ({ key, label, render: money })),
    );
  else
    columns = [
      {
        key: "number",
        label: "Reference",
        render: (_, row) => row.number || row.id,
      },
      ...columns,
      { key: "date", label: "Date" },
      {
        key: "total",
        label: "Amount",
        render: (_, row) => money(row.total ?? row.amount),
      },
    ];
  return (
    <>
      <div className="page-heading">
        <h1>Reports</h1>
        <button
          className="secondary"
          onClick={() =>
            toast(
              "File exports are not included in this V1. The displayed report uses saved records.",
            )
          }
        >
          Export report
        </button>
      </div>
      <div className="report-grid">
        {reportNames.map(([key, label]) => (
          <button
            key={key}
            className={`report-card ${selected === key ? "selected" : ""}`}
            onClick={() => {
              setSelected(key);
              setPage(1);
            }}
          >
            <h3>{label}</h3>
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>{reportNames.find(([key]) => key === selected)[1]}</h2>
        </div>
        <div className="report-filters">
          <FormInput
            label="From"
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
            disabled={balanceReport || selected === "inventory"}
          />
          <FormInput
            label="To"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
            disabled={selected === "inventory"}
          />
          <FormInput
            label="Search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            disabled={selected === "profit-loss"}
          />
        </div>
        <p className="form-description">
          {selected === "inventory"
            ? "Current inventory; date filters do not change stock."
            : balanceReport
              ? "Balances are cumulative through the To date."
              : "Posted records and returns within the date range."}
        </p>
        {state.loading ? (
          <p role="status">Loading report...</p>
        ) : state.error ? (
          <div className="auth-error" role="alert">
            {state.error}
            <button
              className="secondary"
              onClick={() => setRetry((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        ) : selected === "profit-loss" ? (
          <div className="stats-grid">
            {[
              ["Net sales excluding tax", "net_sales_excluding_tax"],
              ["Cost of goods", "cost_of_goods"],
              ["Expenses", "expenses"],
              ["Profit", "profit"],
            ].map(([title, key]) => (
              <StatCard
                key={key}
                title={title}
                value={money(result.summary[key])}
                icon="reports"
              />
            ))}
            <p>{result.summary.basis}</p>
          </div>
        ) : (
          <>
            <DataTable compact rows={rows} columns={columns} />
            <Pagination
              page={page}
              setPage={setPage}
              size={6}
              total={result.count}
            />
          </>
        )}
      </section>
    </>
  );
}
