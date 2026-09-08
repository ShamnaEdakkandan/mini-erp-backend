"use client";
import { useState } from "react";
import { DataTable, FormInput, Select, StatusBadge } from "./ui";
import { useMoney } from "./currency";
import { dateToday } from "@/lib/erp-api";

export function DocumentDetail({
  record,
  data,
  canWrite,
  busy,
  onAction,
  onClose,
}) {
  const money = useMoney();
  return (
    <div className="detail">
      <div className="detail-header">
        <div>
          <h3>{record.number}</h3>
          <p>{data.settings.company}</p>
          {data.settings.show_address && <p>{data.settings.address}</p>}
          <p>
            {record.name} · {record.date}
          </p>
          <p>{record.kind}</p>
        </div>
        <StatusBadge status={record.status} />
      </div>
      <DataTable
        columns={[
          { key: "product_name", label: "Product" },
          { key: "quantity", label: "Quantity" },
          { key: "price", label: "Unit price", render: money },
          { key: "tax", label: "Tax %" },
          { key: "total", label: "Line total", render: money },
        ]}
        rows={record.items}
      />
      <div className="invoice-totals">
        <p>
          Subtotal <b>{money(record.subtotal)}</b>
        </p>
        <p>
          Discount <b>{money(record.discount)}</b>
        </p>
        <p>
          Tax <b>{money(record.tax_total)}</b>
        </p>
        <h3>
          Total <b>{money(record.total)}</b>
        </h3>
        {record.status === "Posted" && record.kind !== "Purchase Order" && (
          <>
            <p>
              Returned <b>{money(record.balances.returned)}</b>
            </p>
            <p>
              Paid, less refunds <b>{money(record.balances.paid)}</b>
            </p>
            <p>
              Balance <b>{money(record.balances.balance)}</b>
            </p>
            <p>
              Credit available <b>{money(record.balances.credit)}</b>
            </p>
            <StatusBadge status={record.balances.payment_status} />
          </>
        )}
      </div>
      {record.notes && <p>{record.notes}</p>}
      {record.status === "Posted" && (
        <p className="form-description">
          Posted documents are locked. Payments and returns are recorded
          separately.
        </p>
      )}
      <div className="form-actions">
        <button className="secondary" disabled={busy} onClick={onClose}>
          Close
        </button>
        {canWrite && record.status === "Draft" && (
          <>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => onAction("edit-document", record)}
            >
              Edit draft
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => onAction("post", record)}
            >
              {record.kind === "Purchase Order"
                ? "Confirm order"
                : "Post document"}
            </button>
          </>
        )}
        {canWrite &&
          record.status === "Posted" &&
          record.kind === "Purchase Order" &&
          !data.Purchases.some((row) => row.source_order === record.id) && (
            <button
              className="primary"
              disabled={busy}
              onClick={() => onAction("convert", record)}
            >
              Create bill from order
            </button>
          )}
        {canWrite &&
          record.status === "Posted" &&
          record.kind !== "Purchase Order" && (
            <>
              {Number(record.balances.balance) > 0 && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => onAction("payment", record)}
                >
                  Record payment
                </button>
              )}
              {Number(record.balances.credit) > 0 && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => onAction("refund", record)}
                >
                  Record refund
                </button>
              )}
              <button
                className="secondary"
                disabled={busy}
                onClick={() => onAction("return", record)}
              >
                Create return
              </button>
            </>
          )}
      </div>
    </div>
  );
}

export function PaymentForm({ record, refund, onSave, busy }) {
  const money = useMoney();
  const limit = record.balances[refund ? "credit" : "balance"];
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy)
          onSave({
            ...Object.fromEntries(new FormData(event.currentTarget)),
            refund,
          });
      }}
    >
      <p>
        {record.number} · {refund ? "Credit" : "Amount due"}: {money(limit)}
      </p>
      <fieldset className="form-fieldset form-grid" disabled={busy}>
        <FormInput
          label="Amount"
          name="amount"
          type="number"
          min="0.01"
          max={limit}
          step="0.01"
          required
          defaultValue={limit}
        />
        <Select
          label="Payment method"
          name="method"
          options={["Cash", "Bank transfer", "Card"]}
        />
        <FormInput
          label="Date"
          name="date"
          type="date"
          min={record.date}
          required
          defaultValue={dateToday()}
        />
      </fieldset>
      <div className="form-actions">
        <button className="primary" disabled={busy}>
          Save {refund ? "refund" : "payment"}
        </button>
      </div>
    </form>
  );
}

export function ReturnForm({ data, module, record, onSave, busy }) {
  const documents = data[module].filter(
    (row) => row.status === "Posted" && row.kind !== "Purchase Order",
  );
  const [documentId, setDocumentId] = useState(
    record?.id || documents[0]?.id || "",
  );
  const document = documents.find((row) => row.id === Number(documentId));
  const [quantities, setQuantities] = useState({});
  const returned = data.returns
    .filter((row) => row.document === Number(documentId))
    .flatMap((row) => row.items);
  const available = (line) =>
    line.quantity -
    returned
      .filter((row) => row.line === line.id)
      .reduce((sum, row) => sum + row.quantity, 0);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        onSave({
          ...Object.fromEntries(new FormData(event.currentTarget)),
          document: Number(documentId),
          items: document.items
            .filter((line) => Number(quantities[line.id]) > 0)
            .map((line) => ({
              line: line.id,
              quantity: Number(quantities[line.id]),
            })),
        });
      }}
    >
      <fieldset className="form-fieldset" disabled={busy}>
        <div className="form-grid">
          <Select
            label="Original document"
            value={documentId}
            required
            options={documents.map((row) => ({
              value: row.id,
              label: `${row.number} · ${row.name}`,
            }))}
            onChange={(event) => {
              setDocumentId(event.target.value);
              setQuantities({});
            }}
          />
          <FormInput
            name="date"
            label="Return date"
            type="date"
            min={document?.date}
            defaultValue={dateToday()}
            required
          />
          <FormInput name="reason" label="Reason" maxLength={300} required />
        </div>
        {document?.items.map((line) => (
          <FormInput
            key={line.id}
            label={`${line.product_name} (${available(line)} available to return)`}
            type="number"
            min="0"
            max={available(line)}
            step="1"
            value={quantities[line.id] || 0}
            onChange={(event) =>
              setQuantities((current) => ({
                ...current,
                [line.id]: event.target.value,
              }))
            }
          />
        ))}
        <p className="form-description">
          The return amount uses the original document prices, discount and tax.
          A refund is recorded separately if a credit remains.
        </p>
      </fieldset>
      <div className="form-actions">
        <button
          className="primary"
          disabled={
            busy ||
            !document ||
            !Object.values(quantities).some((value) => Number(value) > 0)
          }
        >
          Save return
        </button>
      </div>
    </form>
  );
}

export function MovementForm({ data, busy, onSave }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy)
          onSave(Object.fromEntries(new FormData(event.currentTarget)));
      }}
    >
      <fieldset className="form-grid form-fieldset" disabled={busy}>
        <Select
          label="Product"
          name="product"
          required
          options={data.Inventory.map((row) => ({
            value: row.id,
            label: `${row.name} (${row.sku}) · ${row.stock} in stock`,
          }))}
        />
        <Select
          label="Movement"
          name="kind"
          options={[
            { value: "In", label: "Stock In" },
            { value: "Out", label: "Stock Out" },
            { value: "Adjustment", label: "Adjustment (new balance)" },
          ]}
        />
        <FormInput
          name="quantity"
          label="Quantity (new balance for adjustment)"
          type="number"
          min="0"
          step="1"
          required
        />
        <FormInput name="reason" label="Reason" maxLength={300} required />
      </fieldset>
      <div className="form-actions">
        <button className="primary" disabled={busy || !data.Inventory.length}>
          Save movement
        </button>
      </div>
    </form>
  );
}

export function OpeningForm({ onSave, busy }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy)
          onSave(Object.fromEntries(new FormData(event.currentTarget)));
      }}
    >
      <p className="form-description">
        Set an opening balance once per method. It contributes to your cash or
        bank balance.
      </p>
      <fieldset className="form-fieldset form-grid" disabled={busy}>
        <FormInput
          label="Amount"
          name="amount"
          type="number"
          step="0.01"
          required
        />
        <Select
          name="method"
          label="Method"
          options={["Cash", "Bank transfer"]}
        />
        <FormInput
          name="date"
          label="Date"
          type="date"
          defaultValue={dateToday()}
          required
        />
      </fieldset>
      <div className="form-actions">
        <button className="primary" disabled={busy}>
          Save opening balance
        </button>
      </div>
    </form>
  );
}
