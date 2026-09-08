"use client";
import { useState } from "react";
import { DataTable, SearchFilter, StatusBadge, StatCard, Icon } from "./ui";
import { useMoney } from "./currency";
import { col, person } from "./shared";

export function Records({
  page,
  data,
  onNew,
  openRecord,
  stockAction,
  openingAction,
  onDelete,
  canWrite,
  user,
}) {
  const money = useMoney();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [tab, setTab] = useState("Overview");
  let rows = data[page] || [];
  let options = { values: ["Active", "Inactive"] };
  let filterKey = "status";
  let columns = [];
  const badge = col("status", "Status", (value) => (
    <StatusBadge status={value} />
  ));
  const documents = ["Sales", "Purchases"].includes(page);
  if (["Customers", "Suppliers"].includes(page))
    columns = [
      col("name", "Name", person),
      col("phone", "Phone"),
      col("total", page === "Customers" ? "Net sales" : "Net purchases", money),
      col("balance", "Outstanding", money),
      col("credit", "Credit", money),
      badge,
    ];
  if (page === "Inventory") {
    options = {
      label: "categories",
      values: [...new Set(data.Inventory.map((row) => row.category))],
    };
    filterKey = "category";
    columns =
      tab === "Products"
        ? [
            col("name", "Product"),
            col("sku", "SKU"),
            col("category", "Category"),
            col("cost", "Cost", money),
            col("price", "Price", money),
            col("unit", "Unit"),
            col("tax", "Tax %"),
            badge,
          ]
        : [
            col("name", "Product"),
            col("sku", "SKU"),
            col("category", "Category"),
            col("stock", "Available stock"),
            col("min", "Minimum"),
            col("unit", "Unit"),
            col("stock_status", "Stock status", (value) => (
              <StatusBadge status={value} />
            )),
          ];
    if (tab === "Movements") {
      rows = data.movements.map((row) => ({
        ...row,
        name:
          data.Inventory.find((product) => product.id === row.product)?.name ||
          row.product,
      }));
      options = {
        values: [
          "In",
          "Out",
          "Adjustment",
          "Sale",
          "Purchase Bill",
          "Sales Return",
          "Purchase Return",
        ],
        label: "movements",
      };
      filterKey = "kind";
      columns = [
        col("name", "Product"),
        col("kind", "Movement"),
        col("quantity", "Change"),
        col("balance", "Stock after"),
        col("reason", "Reason"),
        col("created_at", "Recorded", (value) =>
          new Date(value).toLocaleString(),
        ),
      ];
    }
  }
  if (documents) {
    if (page === "Purchases")
      rows = rows.filter(
        (row) =>
          row.kind === (tab === "Bills" ? "Purchase Bill" : "Purchase Order"),
      );
    options = { values: ["Draft", "Posted", "Paid", "Partial", "Unpaid"] };
    columns = [
      col("number", "Document no."),
      col("name", page === "Sales" ? "Customer" : "Supplier"),
      col("date", "Date"),
      col("total", "Total", money),
      badge,
    ];
    if (page === "Sales" || tab === "Bills")
      columns.push(
        col("paid", "Paid", money),
        col("balance", "Balance", money),
        col("credit", "Credit", money),
        col("payment_status", "Payment", (value, row) =>
          row.status === "Draft" ? (
            "Not posted"
          ) : (
            <StatusBadge status={value} />
          ),
        ),
      );
    if (tab === "Returns") {
      rows = data.returns
        .filter((row) => data[page].some((doc) => doc.id === row.document))
        .map((row) => ({
          ...row,
          reference: data.documents.find((doc) => doc.id === row.document)
            ?.number,
          status: "Completed",
        }));
      columns = [
        col("id", "Return no."),
        col("reference", "Document"),
        col("date", "Date"),
        col("reason", "Reason"),
        col("total", "Return amount", money),
        badge,
      ];
      options = null;
    }
  }
  if (page === "Expenses") {
    options = {
      label: "categories",
      values: [...new Set(rows.map((row) => row.category))],
    };
    filterKey = "category";
    columns = [
      col("name", "Expense"),
      col("date", "Date"),
      col("category", "Category"),
      col("amount", "Amount", money),
      col("method", "Method"),
      col("description", "Description"),
    ];
  }
  if (page === "Users") {
    rows = rows.map((row) => ({ ...row, name: row.name || row.username }));
    columns = [
      col("name", "Name", person),
      col("username", "Username"),
      col("role", "Role"),
      badge,
    ];
  }
  if (page === "Accounting") {
    options = {
      label: "categories",
      values: ["Sales", "Purchases", "Expenses", "Opening balance"],
    };
    filterKey = "category";
    columns = [
      col("id", "Reference"),
      col("name", "Description"),
      col("date", "Date"),
      col("category", "Category"),
      col("amount", "Amount", money),
      col("method", "Method"),
    ];
  }
  rows = rows.filter(
    (row) =>
      JSON.stringify(row).toLowerCase().includes(search.toLowerCase()) &&
      (filter === "All" ||
        row[filterKey] === filter ||
        (documents &&
          row.status === "Posted" &&
          row.payment_status === filter)),
  );
  const readOnly =
    page === "Accounting" || tab === "Returns" || tab === "Movements";
  function canDelete(record) {
    return (
      !readOnly &&
      (!documents || record.status === "Draft") &&
      (page !== "Users" ||
        (record.id !== user.id && record.id !== user.workspace_id))
    );
  }
  return (
    <>
      <div className="page-heading">
        <h1>{page}</h1>
        <div className="heading-actions">
          {page === "Inventory" && canWrite && (
            <button
              className="secondary"
              disabled={!data.Inventory.length}
              onClick={stockAction}
            >
              Adjust stock
            </button>
          )}
          {page === "Accounting" && user.role === "Admin" && (
            <button className="secondary" onClick={openingAction}>
              Opening balance
            </button>
          )}
          {page !== "Accounting" && canWrite && (
            <button
              className="primary"
              onClick={() =>
                onNew(page, tab === "Movements" ? "Products" : tab)
              }
            >
              <Icon name="plus" size={17} />
              {tab === "Returns"
                ? "Create return"
                : {
                    Customers: "Add customer",
                    Suppliers: "Add supplier",
                    Inventory: "Add product",
                    Sales: "Create invoice",
                    Purchases:
                      tab === "Bills"
                        ? "Create purchase bill"
                        : "Create purchase order",
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
            ["Income", "sales"],
            ["Expenses", "expenses"],
            ["Receivables", "receivables"],
            ["Payables", "payables"],
            ["Cash balance", "cash_balance"],
            ["Bank balance", "bank_balance"],
          ].map(([title, key]) => (
            <StatCard
              key={key}
              title={title}
              value={money(data.summary[key])}
              icon="accounting"
            />
          ))}
        </div>
      )}
      {(documents || page === "Inventory") && (
        <div className="tabs">
          {(page === "Inventory"
            ? ["Overview", "Products", "Movements"]
            : [
                "Overview",
                ...(page === "Purchases" ? ["Bills"] : []),
                "Returns",
              ]
          ).map((value) => (
            <button
              key={value}
              className={tab === value ? "selected" : ""}
              onClick={() => {
                setTab(value);
                setFilter("All");
                setSearch("");
              }}
            >
              {value === "Overview"
                ? page === "Sales"
                  ? "All invoices"
                  : page === "Purchases"
                    ? "Purchase orders"
                    : "Stock overview"
                : value}
            </button>
          ))}
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <h2>
            {tab === "Overview" ? `All ${page.toLowerCase()}` : tab}{" "}
            <span className="count-pill">{rows.length}</span>
          </h2>
          {!canWrite && <span className="subtle">Read-only access</span>}
        </div>
        <SearchFilter {...{ search, setSearch, filter, setFilter, options }} />
        <DataTable
          key={page + tab + filter + search}
          columns={columns}
          rows={rows}
          onRow={
            page === "Accounting" || tab === "Movements"
              ? undefined
              : (row) => openRecord(page, row, tab)
          }
          onDelete={
            canWrite && user.role !== "Staff" && !readOnly ? (row) => onDelete(page, row) : undefined
          }
          canDelete={canDelete}
        />
      </section>
    </>
  );
}
