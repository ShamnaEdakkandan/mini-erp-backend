"use client";
import { FormInput, Select } from "./ui";
export function Settings({ toast, settings, setSettings }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Settings</h1>
        </div>
      </div>
      <form
        className="panel settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget;
          setSettings({
            ...Object.fromEntries(new FormData(f)),
            lowStock: f.elements.lowStock.checked,
            showAddress: f.elements.showAddress.checked,
          });
          toast("Settings saved for this session.");
        }}
      >
        <h2>Company information</h2>
        <p className="subtle">
          These details appear on your business documents.
        </p>
        <div className="form-grid">
          <FormInput
            label="Company name"
            name="company"
            defaultValue={settings.company ?? "Acme Inc."}
            required
          />
          <FormInput
            label="Business email"
            name="email"
            defaultValue={settings.email ?? "hello@acme.com"}
            type="email"
            required
          />
          <FormInput
            label="Phone"
            name="phone"
            defaultValue={settings.phone ?? "+1 (415) 555-0100"}
          />
          <FormInput
            label="Address"
            name="address"
            defaultValue={
              settings.address ?? "120 Market Street, San Francisco, CA"
            }
          />
        </div>
        <hr />
        <h2>Currency & tax</h2>
        <div className="form-grid">
          <Select
            label="Default currency"
            name="currency"
            defaultValue={settings.currency}
            options={[
              "USD — US Dollar",
              "INR — Indian Rupee",
              "EUR — Euro",
              "GBP — British Pound",
            ]}
          />
          <FormInput
            label="Default tax (%)"
            name="tax"
            type="number"
            min="0"
            max="100"
            defaultValue={settings.tax ?? 5}
          />
        </div>
        <hr />
        <h2>Invoice numbering</h2>
        <div className="form-grid">
          <FormInput
            label="Invoice prefix"
            name="prefix"
            defaultValue={settings.prefix ?? "INV-2026-"}
            required
          />
          <FormInput
            label="Next invoice number"
            name="nextNumber"
            type="number"
            min="1"
            defaultValue={settings.nextNumber ?? 1049}
          />
        </div>
        <hr />
        <h2>General preferences</h2>
        <label className="check-field">
          <input
            name="lowStock"
            type="checkbox"
            defaultChecked={settings.lowStock ?? true}
          />
          Show low stock notifications
        </label>
        <label className="check-field">
          <input
            name="showAddress"
            type="checkbox"
            defaultChecked={settings.showAddress ?? true}
          />
          Show company address on invoices
        </label>
        <p className="form-description">
          Prototype preferences only. Currency and tax changes do not
          recalculate existing demo data.
        </p>
        <div className="form-actions">
          <button className="primary" type="submit">
            Save preferences
          </button>
        </div>
      </form>
    </>
  );
}
