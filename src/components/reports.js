"use client";
import { useState } from "react";
import { Icon, FormInput, DataTable } from "./ui";
import { money } from "@/lib/mock-data";
import { col } from "./shared";
export function Reports({ data, toast }) {
  const [selected, setSelected] = useState("Sales Report"),
    [search, setSearch] = useState(""),
    [from, setFrom] = useState("2026-09-01"),
    [to, setTo] = useState("2026-09-30");
  const names = [
    "Sales Report",
    "Purchase Report",
    "Inventory Report",
    "Expense Report",
    "Customer Balance Report",
    "Supplier Balance Report",
    "Profit & Loss Summary",
  ];
  const keys = [
    "Sales",
    "Purchases",
    "Inventory",
    "Expenses",
    "Customers",
    "Suppliers",
    "Accounting",
  ];
  const key = keys[names.indexOf(selected)];
  const rows = data[key].filter(
    (r) =>
      (!r.date || (r.date >= from && r.date <= to)) &&
      r.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Reports</h1>
        </div>
        <button
          className="secondary"
          onClick={() =>
            toast(
              "Export preview only — file exports will be available when a backend is connected.",
            )
          }
        >
          <Icon name="download" size={17} />
          Export report
        </button>
      </div>
      <div className="report-grid">
        {names.map((n, i) => (
          <button
            key={n}
            onClick={() => setSelected(n)}
            className={`report-card ${selected === n ? "selected" : ""}`}
          >
            <span className="stat-icon">
              <Icon name={keys[i].toLowerCase()} />
            </span>
            <h3>{n}</h3>
            <p>View summary and detailed records</p>
            <Icon name="arrow" size={17} />
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>{selected}</h2>
          <span className="subtle">Illustrative data</span>
        </div>
        <div className="report-filters">
          <FormInput
            label="From"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <FormInput
            label="To"
            type="date"
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <FormInput
            label="Search"
            placeholder="Search report…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {selected === "Profit & Loss Summary" && (
          <div className="pl-summary">
            <div>
              <span>Revenue</span>
              <strong>$124,580.00</strong>
            </div>
            <div>
              <span>Cost of goods</span>
              <strong>−$68,240.00</strong>
            </div>
            <div>
              <span>Operating expenses</span>
              <strong>−$18,450.00</strong>
            </div>
            <div>
              <span>Net profit</span>
              <strong>$37,890.00</strong>
            </div>
            <p>
              Illustrative monthly summary · not calculated from transactions
              below
            </p>
          </div>
        )}
        <DataTable
          columns={[
            col("id", "Reference"),
            col("name", "Name"),
            ...(key === "Inventory"
              ? [col("stock", "Available stock"), col("min", "Minimum stock")]
              : [
                  col("amount", "Amount", (_, r) => money(r.total ?? r.amount)),
                  ...(["Customers", "Suppliers"].includes(key)
                    ? [col("balance", "Balance", money)]
                    : [col("date", "Date")]),
                ]),
          ]}
          rows={rows}
        />
      </section>
    </>
  );
}
