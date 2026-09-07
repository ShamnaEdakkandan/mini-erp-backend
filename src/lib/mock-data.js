export const money = (v) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(v) || 0);
export const products = [
  ["Wireless Keyboard", "ACC-WK-001", "Electronics", 35, 59, 8, 15],
  ["Ergonomic Office Chair", "FUR-OC-002", "Furniture", 120, 199, 24, 10],
  ["USB-C Hub · 7-in-1", "ACC-UC-003", "Electronics", 22, 45, 5, 10],
  ["A5 Hardcover Notebook", "STA-NB-004", "Stationery", 4, 12, 142, 25],
  ["LED Desk Lamp", "FUR-DL-005", "Furniture", 18, 39, 0, 10],
  ["Wireless Mouse", "ACC-WM-006", "Electronics", 15, 29, 12, 20],
  ["Standing Desk", "FUR-SD-007", "Furniture", 210, 349, 32, 5],
].map(([name, sku, category, cost, price, stock, min], i) => ({
  id: `PRD-00${i + 1}`,
  name,
  sku,
  category,
  cost,
  price,
  stock,
  min,
  unit: "pcs",
  tax: 5,
  status: "Active",
}));
export const customers = [
  "Acme Corporation",
  "Olivia Rhye",
  "Layers Studio",
  "Phoenix Digital",
  "Lana Steiner",
  "Summit Technologies",
  "Atlas Creative",
].map((name, i) => ({
  id: `CUS-00${i + 1}`,
  name,
  phone: `+1 (415) 555-010${i}`,
  email: `hello@${name.toLowerCase().replaceAll(" ", "")}.com`,
  address: `${120 + i * 15} Market Street, San Francisco, CA`,
  total: [12450, 8240, 6820, 5480, 3210, 9240, 2100][i],
  balance: [1250, 0, 820, 480, 0, 240, 100][i],
  status: i === 6 ? "Inactive" : "Active",
}));
export const suppliers = [
  "TechSupply Co.",
  "Modern Office Ltd.",
  "Paper & Co.",
  "Global Essentials",
  "Bright Works",
].map((name, i) => ({
  ...customers[i],
  id: `SUP-00${i + 1}`,
  name,
  email: `orders@supplier${i + 1}.com`,
  total: 8500 + i * 1250,
  balance: i * 420,
}));
export const sales = customers.map((c, i) => ({
  id: `INV-2026-${1048 - i}`,
  name: c.name,
  date: `2026-09-0${7 - i}`,
  total: [2450, 1280, 3600, 845, 1920, 4200, 680][i],
  paid: [2450, 500, 0, 845, 1920, 2000, 0][i],
  status: ["Paid", "Partial", "Unpaid", "Paid", "Paid", "Partial", "Unpaid"][i],
  items: [
    {
      product: "Wireless Keyboard",
      quantity: 1,
      price: [2450, 1280, 3600, 845, 1920, 4200, 680][i],
      tax: 0,
    },
  ],
  discount: 0,
}));
export const purchases = suppliers.map((c, i) => ({
  id: `PO-2026-${208 - i}`,
  name: c.name,
  date: `2026-09-0${7 - i}`,
  total: [3850, 2400, 680, 1920, 1450][i],
  paid: i === 1 ? 0 : 500,
  status: i === 1 ? "Unpaid" : "Partial",
  items: [
    {
      product: "Wireless Keyboard",
      quantity: 1,
      price: [3850, 2400, 680, 1920, 1450][i],
      tax: 0,
    },
  ],
  discount: 0,
}));
export const expenses = [
  "Office rent",
  "Internet & phone",
  "Team supplies",
  "Delivery services",
  "Software subscriptions",
  "Electricity",
].map((name, i) => ({
  id: `EXP-00${i + 1}`,
  name,
  date: "2026-09-05",
  category: [
    "Rent",
    "Utilities",
    "Office",
    "Transport",
    "Software",
    "Utilities",
  ][i],
  amount: [1800, 120, 85, 245, 199, 140][i],
  method: i % 2 ? "Cash" : "Bank transfer",
  description: `September ${name.toLowerCase()}`,
}));
export const users = [
  "Alex Morgan",
  "Olivia Rhye",
  "Drew Cano",
  "Lana Steiner",
].map((name, i) => ({
  id: `USR-00${i + 1}`,
  name,
  email: name.toLowerCase().replace(" ", ".") + "@acme.com",
  role: ["Admin", "Manager", "Staff", "Staff"][i],
  status: i === 3 ? "Inactive" : "Active",
}));
export const transactions = [
  {
    id: "TRX-0091",
    name: "Payment from Acme Corporation",
    date: "2026-09-07",
    category: "Sales",
    amount: 2450,
    method: "Bank transfer",
    status: "Completed",
  },
  {
    id: "TRX-0090",
    name: "Payment to TechSupply Co.",
    date: "2026-09-07",
    category: "Purchases",
    amount: -1850,
    method: "Bank transfer",
    status: "Completed",
  },
  {
    id: "TRX-0089",
    name: "Office rent",
    date: "2026-09-06",
    category: "Expenses",
    amount: -1800,
    method: "Bank transfer",
    status: "Completed",
  },
  {
    id: "TRX-0088",
    name: "Payment from Olivia Rhye",
    date: "2026-09-06",
    category: "Sales",
    amount: 500,
    method: "Cash",
    status: "Completed",
  },
];
export const initialData = {
  Customers: customers,
  Suppliers: suppliers,
  Inventory: products,
  Sales: sales,
  Purchases: purchases,
  Expenses: expenses,
  Users: users,
  Accounting: transactions,
};
