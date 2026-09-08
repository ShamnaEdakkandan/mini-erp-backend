import { StatusBadge } from "./ui";
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
    <span aria-hidden="true" className={`avatar avatar-${v.length % 4}`}>
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
