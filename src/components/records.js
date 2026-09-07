"use client";
import { useState } from "react";
import { Icon, StatusBadge, SearchFilter, DataTable, StatCard } from "./ui";
import { money } from "@/lib/mock-data";
import { stockStatus, col, person, status, invoiceCols } from "./shared";
export function Records({
  page,
  data,
  onNew,
  openRecord,
  stockAction,
  returns,
  onDelete,
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All"),
    [tab, setTab] = useState("Overview");
  let columns,
    options = { values: ["Active", "Inactive"] },
    filterKey = "status";
  let rows = data[page] || [];
  if (["Customers", "Suppliers"].includes(page))
    columns = [
      col("name", page === "Customers" ? "Customer" : "Supplier", person),
      col("phone", "Phone"),
      col(
        "total",
        page === "Customers" ? "Total sales" : "Total purchases",
        money,
      ),
      col(
        "balance",
        page === "Customers" ? "Outstanding" : "Amount payable",
        money,
      ),
      status,
    ];
  if (page === "Inventory") {
    options = {
      label: "categories",
      values: ["Electronics", "Furniture", "Stationery"],
    };
    filterKey = "category";
    columns = [
      col("name", "Product", (v) => <b>{v}</b>),
      col("sku", "SKU"),
      col("category", "Category"),
      col("price", "Selling price", money),
      col("stock", "Available stock", (v, r) => (
        <b>
          {v} <span className="subtle">{r.unit}</span>
        </b>
      )),
      col("min", "Minimum stock"),
      col("status", "Stock status", (_, r) => (
        <StatusBadge status={stockStatus(r)} />
      )),
    ];
  }
  if (["Sales", "Purchases"].includes(page)) {
    options = { values: ["Paid", "Partial", "Unpaid"] };
    columns = [
      ...invoiceCols.map((c) =>
        c.key === "name"
          ? col("name", page === "Sales" ? "Customer" : "Supplier")
          : c.key === "id"
            ? col("id", page === "Sales" ? "Invoice no." : "Purchase no.")
            : c,
      ),
      col("paid", "Paid amount", money),
      col("balance", "Balance", (_, r) => money(r.total - r.paid)),
    ];
    if (tab === "Returns") {
      rows = returns.filter((r) => r.module === page);
      columns = [
        col("id", "Return no."),
        col("reference", "Original document"),
        col("name", "Reason"),
        col("date", "Date"),
        col("amount", "Amount", money),
        status,
      ];
      options = { values: ["Pending", "Completed"] };
    }
  }
  if (page === "Expenses") {
    options = {
      label: "categories",
      values: ["Rent", "Utilities", "Office", "Transport", "Software"],
    };
    filterKey = "category";
    columns = [
      col("name", "Expense"),
      col("date", "Date"),
      col("category", "Category"),
      col("amount", "Amount", money),
      col("method", "Payment method"),
      col("description", "Description"),
    ];
  }
  if (page === "Users")
    columns = [col("name", "User", person), col("role", "Role"), status];
  if (page === "Accounting") {
    options = {
      label: "categories",
      values: ["Sales", "Purchases", "Expenses"],
    };
    filterKey = "category";
    columns = [
      col("id", "Transaction"),
      col("name", "Description"),
      col("date", "Date"),
      col("category", "Category"),
      col("amount", "Amount", money),
      col("method", "Payment method"),
      status,
    ];
  }
  rows = rows.filter(
    (r) =>
      Object.values(r).some((v) =>
        String(v).toLowerCase().includes(search.toLowerCase()),
      ) &&
      (filter === "All" || r[filterKey] === filter),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{page}</h1>
        </div>
        <div className="heading-actions">
          {page === "Inventory" && (
            <button className="secondary" onClick={stockAction}>
              <Icon name="inventory" size={17} />
              Adjust stock
            </button>
          )}
          {page !== "Accounting" && (
            <button className="primary" onClick={() => onNew(page, tab)}>
              <Icon name="plus" size={17} />
              {tab === "Returns"
                ? "Create return"
                : {
                    Customers: "Add customer",
                    Suppliers: "Add supplier",
                    Inventory: "Add product",
                    Sales: "Create invoice",
                    Purchases: "Create purchase order",
                    Expenses: "Add expense",
                    Users: "Add user",
                  }[page]}
            </button>
          )}
        </div>
      </div>
      {page === "Accounting" && (
        <div className="stats-grid accounting-stats">
          {[
            ["Total income", "$124,580", "sales"],
            ["Total expense", "$86,690", "expenses"],
            ["Receivables", "$24,680", "wallet"],
            ["Payables", "$12,450", "purchases"],
            ["Cash balance", "$12,840", "wallet"],
            ["Bank balance", "$58,240", "accounting"],
          ].map(([title, value, icon]) => (
            <StatCard
              key={title}
              {...{ title, value, icon }}
              foot="Static demo balance"
            />
          ))}
        </div>
      )}
      {["Sales", "Purchases", "Inventory"].includes(page) && (
        <div className="tabs">
          {(page === "Inventory"
            ? ["Overview", "Products"]
            : [
                "Overview",
                ...(page === "Purchases" ? ["Bills"] : []),
                "Returns",
              ]
          ).map((t) => (
            <button
              className={tab === t ? "selected" : ""}
              key={t}
              onClick={() => {
                setTab(t);
                setFilter("All");
              }}
            >
              {t === "Overview"
                ? page === "Sales"
                  ? "All invoices"
                  : page === "Purchases"
                    ? "Purchase orders"
                    : "Stock overview"
                : t}
            </button>
          ))}
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>
            {tab === "Returns"
              ? `${page} returns`
              : tab === "Bills"
                ? "Purchase bills"
                : `All ${page.toLowerCase()}`}{" "}
            <span className="count-pill">{rows.length}</span>
          </h2>
          <span className="subtle">
            Mock data · changes stay in this session
          </span>
        </div>
        <SearchFilter {...{ search, setSearch, filter, setFilter, options }} />
        <DataTable
          key={page + search + filter + tab}
          columns={
            page === "Inventory" && tab === "Products"
              ? [
                  col("name", "Product"),
                  col("sku", "SKU"),
                  col("category", "Category"),
                  col("cost", "Cost", money),
                  col("price", "Selling price", money),
                  col("unit", "Unit"),
                  col("tax", "Tax", (v) => v + "%"),
                  status,
                ]
              : columns
          }
          rows={rows}
          onDelete={(record) => onDelete(page, record, tab)}
          onRow={
            tab === "Returns" || page === "Accounting"
              ? undefined
              : (r) => openRecord(page, r, tab)
          }
        />
      </section>
    </>
  );
}
