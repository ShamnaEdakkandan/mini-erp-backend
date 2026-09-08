"use client";
import { FormInput, Select } from "./ui";
export function Settings({ settings, onSave, busy, readOnly }) {
  return (
    <>
      <div className="page-heading">
        <h1>Settings</h1>
      </div>
      <form
        className="panel settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (readOnly || busy) return;
          const form = event.currentTarget;
          onSave({
            ...Object.fromEntries(new FormData(form)),
            low_stock: form.elements.low_stock.checked,
            show_address: form.elements.show_address.checked,
          });
        }}
      >
        {readOnly && (
          <p className="form-description">
            Only workspace Admins can change these settings.
          </p>
        )}
        <fieldset className="form-fieldset" disabled={readOnly || busy}>
          <h2>Company information</h2>
          <div className="form-grid">
            {[
              ["company", "Company name"],
              ["email", "Business email", "email"],
              ["phone", "Phone"],
              ["address", "Address"],
            ].map(([name, label, type]) => (
              <FormInput
                key={name}
                name={name}
                label={label}
                type={type || "text"}
                defaultValue={settings[name]}
              />
            ))}
          </div>
          <hr />
          <h2>Currency and tax</h2>
          <div className="form-grid">
            <Select
              label="Currency"
              name="currency"
              options={["USD", "INR", "EUR", "GBP"]}
              defaultValue={settings.currency}
            />
            <FormInput
              label="Default tax (%)"
              name="tax"
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              defaultValue={settings.tax}
            />
          </div>
          <p className="form-description">
            Currency is locked after financial records exist. Existing documents
            keep their original amounts.
          </p>
          <hr />
          <h2>Invoice numbering</h2>
          <div className="form-grid">
            <FormInput
              label="Invoice prefix"
              name="prefix"
              maxLength={30}
              required
              defaultValue={settings.prefix}
            />
            <FormInput
              label="Next number"
              name="next_number"
              type="number"
              min={settings.next_number}
              step="1"
              required
              defaultValue={settings.next_number}
            />
          </div>
          <hr />
          <h2>Preferences</h2>
          <label className="check-field">
            <input
              type="checkbox"
              name="low_stock"
              defaultChecked={settings.low_stock}
            />
            Show low stock notifications
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              name="show_address"
              defaultChecked={settings.show_address}
            />
            Show company address on documents
          </label>
        </fieldset>
        {!readOnly && (
          <div className="form-actions">
            <button className="primary" disabled={busy}>
              Save preferences
            </button>
          </div>
        )}
      </form>
    </>
  );
}
