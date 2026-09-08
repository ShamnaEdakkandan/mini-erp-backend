import { api } from "./api";

export const endpoints = {
  Customers: "customers/",
  Suppliers: "suppliers/",
  Inventory: "products/",
  Sales: "documents/",
  Purchases: "documents/",
  Expenses: "expenses/",
  Users: "users/",
};

export async function allRecords(path) {
  const rows = [];
  let offset = 0;
  while (true) {
    const separator = path.includes("?") ? "&" : "?";
    const page = await api(`${path}${separator}limit=500&offset=${offset}`);
    if (Array.isArray(page)) return page;
    if (!Array.isArray(page?.results))
      throw new Error("The server returned an unexpected list response.");
    rows.push(...page.results);
    if (!page.next) return rows;
    if (!page.results.length)
      throw new Error("Pagination stopped before all records loaded.");
    offset += page.results.length;
  }
}

export function documentRow(record, customers, suppliers) {
  return {
    ...record,
    name:
      (record.kind === "Sale"
        ? customers.find((row) => row.id === record.customer)
        : suppliers.find((row) => row.id === record.supplier)
      )?.name || record.number,
    paid: record.balances.paid,
    balance: record.balances.balance,
    credit: record.balances.credit,
    payment_status: record.balances.payment_status,
  };
}

export function dateToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
