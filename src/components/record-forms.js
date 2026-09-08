"use client";
import { useState } from "react";
import { FormInput, Select, Icon } from "./ui";
import { dateToday } from "@/lib/erp-api";

export function RecordForm({
  module,
  record,
  onSave,
  onClose,
  busy = false,
  readOnly = false,
  defaultTax = 0,
}) {
  const fields = {
    Customers: [
      ["name", "Customer name"],
      ["phone", "Phone"],
      ["email", "Email", "email"],
      ["address", "Address"],
    ],
    Suppliers: [
      ["name", "Supplier name"],
      ["phone", "Phone"],
      ["email", "Email", "email"],
      ["address", "Address"],
    ],
    Inventory: [
      ["name", "Product name"],
      ["sku", "SKU"],
      ["category", "Category"],
      ["cost", "Cost price", "number"],
      ["price", "Selling price", "number"],
      ["min", "Minimum stock", "number"],
      ["unit", "Unit"],
      ["tax", "Tax (%)", "number"],
    ],
    Expenses: [
      ["name", "Expense name"],
      ["date", "Date", "date"],
      ["category", "Category"],
      ["amount", "Amount", "number"],
      ["description", "Description"],
    ],
    Users: [
      ["username", "Username"],
      ["name", "Name"],
      ["email", "Email", "email"],
      [
        "password",
        record ? "New password (leave blank to keep)" : "Password",
        "password",
      ],
    ],
  };
  function submit(event) {
    event.preventDefault();
    if (readOnly || busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (module === "Users" && !values.password) delete values.password;
    onSave(values);
  }
  return (
    <form onSubmit={submit}>
      {module === "Inventory" && (
        <p className="form-description">
          Stock is changed through stock movements or posted documents.
        </p>
      )}
      <fieldset disabled={busy || readOnly} className="form-fieldset">
        <div className="form-grid">
          {fields[module].map(([name, label, type = "text"]) => (
            <FormInput
              key={name}
              name={name}
              label={label}
              type={type}
              required={
                [
                  "name",
                  "sku",
                  "category",
                  "date",
                  "amount",
                  "username",
                  "unit",
                ].includes(name) ||
                (name === "password" && !record)
              }
              defaultValue={
                name === "password"
                  ? ""
                  : (record?.[name] ??
                    (type === "number"
                      ? name === "tax"
                        ? defaultTax
                        : 0
                      : type === "date"
                        ? dateToday()
                        : name === "unit"
                          ? "pcs"
                          : ""))
              }
              min={
                type === "number"
                  ? name === "amount"
                    ? "0.01"
                    : "0"
                  : undefined
              }
              max={name === "tax" ? "100" : undefined}
              step={
                name === "min" ? "1" : type === "number" ? "0.01" : undefined
              }
              autoComplete={type === "password" ? "new-password" : undefined}
            />
          ))}
          {module === "Users" && (
            <Select
              name="role"
              label="Role"
              options={["Admin", "Manager", "Staff"]}
              defaultValue={record?.role || "Staff"}
            />
          )}
          {module === "Expenses" ? (
            <Select
              name="method"
              label="Payment method"
              options={["Cash", "Bank transfer", "Card"]}
              defaultValue={record?.method || "Cash"}
            />
          ) : (
            <Select
              label="Status"
              name="status"
              options={["Active", "Inactive"]}
              defaultValue={record?.status || "Active"}
            />
          )}
        </div>
      </fieldset>
      <div className="form-actions">
        <button
          className="secondary"
          type="button"
          onClick={onClose}
          disabled={busy}
        >
          {readOnly ? "Close" : "Cancel"}
        </button>
        {!readOnly && (
          <button className="primary" disabled={busy}>
            {busy ? "Saving..." : record ? "Save changes" : "Create record"}
          </button>
        )}
      </div>
    </form>
  );
}

export function InvoiceForm({
  kind,
  data,
  record,
  onSave,
  onClose,
  busy = false,
}) {
  const purchase = kind !== "Sale";
  const products = data.Inventory.filter(
    (product) => product.status === "Active",
  );
  const contacts = data[purchase ? "Suppliers" : "Customers"].filter(
    (contact) =>
      contact.status === "Active" ||
      contact.id === record?.[purchase ? "supplier" : "customer"],
  );
  function line(product = products[0]) {
    return {
      product: product?.id || "",
      quantity: 1,
      price: product?.[purchase ? "cost" : "price"] || "0.00",
      tax: product?.tax ?? data.settings.tax,
    };
  }
  const [items, setItems] = useState(
    record?.items.map((item) => ({
      product: item.product,
      quantity: item.quantity,
      price: item.price,
      tax: item.tax,
    })) || [line()],
  );
  function change(index, key, value) {
    setItems((current) =>
      current.map((item, position) =>
        position === index
          ? key === "product"
            ? line(products.find((product) => String(product.id) === value))
            : { ...item, [key]: value }
          : item,
      ),
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        const values = Object.fromEntries(new FormData(event.currentTarget));
        onSave({
          ...values,
          kind,
          items: items.map((item) => ({
            ...item,
            product: Number(item.product),
            quantity: Number(item.quantity),
          })),
        });
      }}
    >
      <p className="form-description">
        Save a draft to review calculated totals. Posting is a separate step.
      </p>
      <fieldset className="form-fieldset" disabled={busy}>
        <div className="form-grid">
          <FormInput
            label="Document number"
            value={record?.number || "Assigned when saved"}
            readOnly
          />
          <Select
            label={purchase ? "Supplier" : "Customer"}
            name={purchase ? "supplier" : "customer"}
            required
            defaultValue={record?.[purchase ? "supplier" : "customer"] || ""}
            options={[
              { value: "", label: "Select a contact" },
              ...contacts.map((contact) => ({
                value: contact.id,
                label: `${contact.name} (#${contact.id})`,
              })),
            ]}
          />
          <FormInput
            name="date"
            label="Date"
            type="date"
            required
            defaultValue={record?.date || dateToday()}
          />
          <FormInput
            name="discount"
            label="Discount amount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={record?.discount || 0}
            required
          />
          <FormInput
            name="notes"
            label="Notes"
            defaultValue={record?.notes || ""}
          />
        </div>
        <h3 className="items-title">Products</h3>
        {items.map((item, index) => (
          <div className="invoice-line" key={index}>
            <Select
              label="Product"
              value={item.product}
              required
              onChange={(event) => change(index, "product", event.target.value)}
              options={[
                { value: "", label: "Select product" },
                ...data.Inventory.filter(
                  (product) =>
                    product.status === "Active" ||
                    product.id === Number(item.product),
                ).map((product) => ({
                  value: product.id,
                  label: `${product.name} (${product.sku})`,
                })),
              ]}
            />
            <FormInput
              label="Quantity"
              type="number"
              min="1"
              max="1000000"
              step="1"
              required
              value={item.quantity}
              onChange={(event) =>
                change(index, "quantity", event.target.value)
              }
            />
            <FormInput
              label={purchase ? "Cost" : "Price"}
              type="number"
              min="0"
              step="0.01"
              required
              value={item.price}
              onChange={(event) => change(index, "price", event.target.value)}
            />
            <FormInput
              label="Tax (%)"
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              value={item.tax}
              onChange={(event) => change(index, "tax", event.target.value)}
            />
            <button
              type="button"
              className="icon-button"
              aria-label="Remove product"
              disabled={items.length === 1}
              onClick={() =>
                setItems((current) =>
                  current.filter((_, position) => position !== index),
                )
              }
            >
              <Icon name="close" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-button"
          disabled={
            items.length >= 100 ||
            !products.some(
              (product) =>
                !items.some((item) => Number(item.product) === product.id),
            )
          }
          onClick={() =>
            setItems((current) => [
              ...current,
              line(
                products.find(
                  (product) =>
                    !current.some(
                      (item) => Number(item.product) === product.id,
                    ),
                ),
              ),
            ])
          }
        >
          Add product
        </button>
      </fieldset>
      <div className="form-actions">
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="primary"
          disabled={busy || !products.length || !contacts.length}
        >
          Save draft
        </button>
      </div>
    </form>
  );
}
