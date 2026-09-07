import { StatusBadge } from "./ui";
import { money } from "@/lib/mock-data";
export const menus = [
  "Dashboard",
  "Sales",
  "Purchases",
  "Inventory",
  "Customers",
  "Suppliers",
  "Expenses",
  "Accounting",
  "Reports",
  "Users",
  "Settings",
];
export const stockStatus = (r) =>
  r.stock === 0 ? "Out of Stock" : r.stock < r.min ? "Low Stock" : "In Stock";
export const col = (key, label, render) => ({ key, label, render });
export const person = (v, r) => (
  <div className="person-cell">
    <span className={`avatar avatar-${v.length % 4}`}>
      {v
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")}
    </span>
    <div>
      <b>{v}</b>
      {r.email && <small>{r.email}</small>}
    </div>
  </div>
);
export const status = col("status", "Status", (v) => (
  <StatusBadge status={v} />
));
export const invoiceCols = [
  col("id", "Invoice no.", (v) => <span className="record-id">{v}</span>),
  col("name", "Customer"),
  col("date", "Date", (v) =>
    new Date(v + "T12:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }),
  ),
  col("total", "Amount", money),
  status,
];
