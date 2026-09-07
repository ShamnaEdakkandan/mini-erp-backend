"use client";
import { useState } from "react";
import { Icon, FormInput, Select } from "./ui";
import { money } from "@/lib/mock-data";
export function RecordForm({ module, record, onSave, onClose }) {
  const fields = {
    Customers: [
      ["name", "Customer name"],
      ["phone", "Phone"],
      ["email", "Email", "email"],
      ["address", "Address"],
      ["total", "Total sales", "number"],
      ["balance", "Outstanding balance", "number"],
    ],
    Suppliers: [
      ["name", "Supplier name"],
      ["phone", "Phone"],
      ["email", "Email", "email"],
      ["address", "Address"],
      ["total", "Total purchases", "number"],
      ["balance", "Amount payable", "number"],
    ],
    Inventory: [
      ["name", "Product name"],
      ["sku", "SKU"],
      ["cost", "Cost price", "number"],
      ["price", "Selling price", "number"],
      ["stock", "Current stock", "number"],
      ["min", "Minimum stock", "number"],
      ["unit", "Unit"],
      ["tax", "Tax (%)", "number"],
    ],
    Expenses: [
      ["name", "Expense name"],
      ["date", "Date", "date"],
      ["amount", "Amount", "number"],
      ["description", "Description"],
    ],
    Users: [
      ["name", "Name"],
      ["email", "Email", "email"],
    ],
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const values = Object.fromEntries(new FormData(e.currentTarget));
        fields[module].forEach(([k, , t]) => {
          if (t === "number") values[k] = Number(values[k]);
        });
        onSave({
          ...record,
          ...values,
          id:
            record?.id ||
            `${module.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
        });
      }}
    >
      <p className="form-description">
        {record
          ? "Review and update the details below."
          : "Add a new record to your workspace."}
      </p>
      <div className="form-grid">
        {fields[module].map(([k, label, type]) => (
          <FormInput
            key={k}
            name={k}
            label={label}
            type={type || "text"}
            min={type === "number" ? 0 : undefined}
            step={type === "number" ? "0.01" : undefined}
            required={["name", "email", "sku", "amount", "date"].includes(k)}
            defaultValue={
              record?.[k] ??
              (type === "number" ? 0 : type === "date" ? "2026-09-07" : "")
            }
          />
        ))}
        {module === "Inventory" && (
          <Select
            label="Category"
            name="category"
            options={["Electronics", "Furniture", "Stationery"]}
            defaultValue={record?.category}
          />
        )}
        {module === "Users" && (
          <Select
            label="Role"
            name="role"
            options={["Admin", "Manager", "Staff"]}
            defaultValue={record?.role || "Staff"}
          />
        )}
        {module === "Expenses" ? (
          <>
            <Select
              label="Category"
              name="category"
              options={["Rent", "Utilities", "Office", "Transport", "Software"]}
              defaultValue={record?.category}
            />
            <Select
              label="Payment method"
              name="method"
              options={["Cash", "Bank transfer", "Card"]}
              defaultValue={record?.method}
            />
          </>
        ) : (
          <Select
            label="Status"
            name="status"
            options={["Active", "Inactive"]}
            defaultValue={record?.status}
          />
        )}
      </div>
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="primary" type="submit">
          {record ? "Save changes" : "Create record"}
        </button>
      </div>
    </form>
  );
}

export function InvoiceForm({ module, data, record, onSave, onClose }) {
  const purchase = module === "Purchases";
  const [items, setItems] = useState(
    record?.items || [
      {
        product: data.Inventory[0]?.name || "",
        quantity: 1,
        price: purchase
          ? data.Inventory[0]?.cost || 0
          : data.Inventory[0]?.price || 0,
        tax: 5,
      },
    ],
  );
  const [discount, setDiscount] = useState(record?.discount || 0),
    [paid, setPaid] = useState(record?.paid || 0);
  const subtotal = items.reduce((s, r) => s + r.quantity * r.price, 0),
    tax = items.reduce((s, r) => s + (r.quantity * r.price * r.tax) / 100, 0),
    total = Math.max(0, subtotal + tax - Number(discount));
  function change(i, key, value) {
    setItems(
      items.map((r, j) =>
        j !== i
          ? r
          : {
              ...r,
              [key]: value,
              ...(key === "product"
                ? {
                    price: data.Inventory.find((p) => p.name === value)?.[
                      purchase ? "cost" : "price"
                    ] ?? r.price,
                  }
                : {}),
            },
      ),
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        onSave({
          ...record,
          id: f.id,
          name: f.name,
          date: f.date,
          items,
          discount: Number(discount),
          paid: Number(paid),
          total,
          status:
            Number(paid) >= total
              ? "Paid"
              : Number(paid) > 0
                ? "Partial"
                : "Unpaid",
        });
      }}
    >
      <div className="form-grid">
        <FormInput
          label={purchase ? "Purchase number" : "Invoice number"}
          name="id"
          required
          defaultValue={
            record?.id ||
            `${purchase ? "PO" : "INV"}-2026-${Date.now().toString().slice(-5)}`
          }
        />
        <Select
          label={purchase ? "Supplier" : "Customer"}
          name="name"
          options={[
            ...new Set([
              ...data[purchase ? "Suppliers" : "Customers"].map((r) => r.name),
              ...(record?.name ? [record.name] : []),
            ]),
          ]}
          defaultValue={record?.name}
        />
        <FormInput
          label="Date"
          name="date"
          type="date"
          required
          defaultValue={record?.date || "2026-09-07"}
        />
      </div>
      <h3 className="items-title">Products</h3>
      {items.map((r, i) => (
        <div className="invoice-line" key={i}>
          <Select
            label="Product"
            options={[
              ...new Set([...data.Inventory.map((p) => p.name), r.product]),
            ]}
            value={r.product}
            onChange={(e) => change(i, "product", e.target.value)}
          />
          <FormInput
            label="Qty"
            type="number"
            min="1"
            required
            value={r.quantity}
            onChange={(e) => change(i, "quantity", Number(e.target.value))}
          />
          <FormInput
            label={purchase ? "Cost" : "Price"}
            type="number"
            min="0"
            step="0.01"
            required
            value={r.price}
            onChange={(e) => change(i, "price", Number(e.target.value))}
          />
          <FormInput
            label="Tax %"
            type="number"
            min="0"
            max="100"
            required
            value={r.tax}
            onChange={(e) => change(i, "tax", Number(e.target.value))}
          />
          <button
            type="button"
            className="icon-button"
            aria-label="Remove product"
            disabled={items.length === 1}
            onClick={() => setItems(items.filter((_, j) => j !== i))}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
      <button
        disabled={!data.Inventory.length}
        type="button"
        className="text-button add-line"
        onClick={() =>
          setItems([
            ...items,
            {
              product: data.Inventory[0]?.name || "",
              quantity: 1,
              price: purchase
                ? data.Inventory[0].cost
                : data.Inventory[0].price,
              tax: 5,
            },
          ])
        }
      >
        <Icon name="plus" size={16} />
        Add product
      </button>
      <div className="invoice-bottom">
        <div>
          <FormInput
            label="Discount ($)"
            type="number"
            step="0.01"
            min="0"
            max={subtotal + tax}
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
          <FormInput
            label="Paid amount ($)"
            type="number"
            step="0.01"
            min="0"
            max={total}
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
          />
        </div>
        <div className="invoice-totals">
          <p>
            Subtotal <b>{money(subtotal)}</b>
          </p>
          <p>
            Tax <b>{money(tax)}</b>
          </p>
          <p>
            Discount <b>−{money(discount)}</b>
          </p>
          <h3>
            Total <b>{money(total)}</b>
          </h3>
          <p>
            Balance <b>{money(total - paid)}</b>
          </p>
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="primary" type="submit">
          {record
            ? "Save changes"
            : purchase
              ? "Create purchase order"
              : "Create invoice"}
        </button>
      </div>
    </form>
  );
}
