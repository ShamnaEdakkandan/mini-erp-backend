"use client";
import { useState, useEffect } from "react";
import {
  Icon,
  StatusBadge,
  FormInput,
  Select,
  Modal,
  SearchFilter,
  DataTable,
  StatCard,
} from "./ui";
import { money } from "@/lib/mock-data";
import { menus, stockStatus, col, person, status, invoiceCols } from "./shared";
import { initialData } from "@/lib/mock-data";
import { Sidebar, Navbar } from "./navigation";
import { Dashboard } from "./dashboard";
import { Records } from "./records";
import { RecordForm, InvoiceForm } from "./record-forms";
import { Reports } from "./reports";
import { Settings } from "./settings";
export default function ERP() {
  const [page, setPage] = useState("Dashboard"),
    [data, setData] = useState(initialData),
    [mobile, setMobile] = useState(false),
    [modal, setModal] = useState(null),
    [message, setMessage] = useState(""),
    [returns, setReturns] = useState([]),
    [settings, setSettings] = useState({});
  useEffect(() => {
    const read = () => {
      const p = decodeURIComponent(window.location.hash.slice(1));
      if (menus.includes(p)) setPage(p);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [message]);
  function navigate(p) {
    if (p === "Help" || p === "Profile") {
      setModal({ type: p });
      return;
    }
    setPage(p);
    window.location.hash = p;
    setMobile(false);
  }
  function requestDelete(module, record, tab) {
    setModal({ type: "delete", module, record, tab });
  }
  function confirmDelete() {
    const { module, record, tab } = modal;
    if (tab === "Returns") {
      setReturns((current) =>
        current.filter((r) => !(r.id === record.id && r.module === module)),
      );
    } else {
      setData((current) => ({
        ...current,
        [module]: current[module].filter((r) => r.id !== record.id),
      }));
    }
    setModal(null);
    setMessage(`${record.id} deleted from this session.`);
  }
  function onNew(module, tab) {
    if (tab === "Returns" && !data[module].length) {
      setMessage("Create a document before adding a return.");
      return;
    }
    if (
      tab !== "Returns" &&
      ["Sales", "Purchases"].includes(module) &&
      (!data.Inventory.length ||
        !data[module === "Sales" ? "Customers" : "Suppliers"].length)
    ) {
      setMessage(
        "Add a product and a customer or supplier before creating a document.",
      );
      return;
    }
    setModal({ type: tab === "Returns" ? "return" : "edit", module });
  }
  function openRecord(module, record, tab) {
    setModal({
      type: ["Sales", "Purchases"].includes(module) ? "detail" : "edit",
      module,
      record,
      tab,
    });
  }
  function save(record) {
    if (!modal) return;
    const { module, record: existingRecord } = modal;
    setData((d) => ({
      ...d,
      [module]: existingRecord
        ? d[module].map((r) => (r.id === existingRecord.id ? record : r))
        : [record, ...d[module]],
    }));
    setModal(null);
    setMessage(
      "Record saved successfully. Changes are stored in this session.",
    );
  }
  return (
    <div className="app-shell">
      <Sidebar
        lowCount={data.Inventory.filter((r) => r.stock < r.min).length}
        {...{ page, navigate, open: mobile, onClose: () => setMobile(false) }}
      />
      <div className="main-shell">
        <Navbar
          {...{
            page,
            navigate,
            onMenu: () => setMobile(true),
            notify: () => setModal({ type: "notifications" }),
          }}
        />
        <main>
          {page === "Dashboard" ? (
            <Dashboard {...{ data, navigate, onNew, openRecord }} />
          ) : page === "Reports" ? (
            <Reports data={data} toast={setMessage} />
          ) : page === "Settings" ? (
            <Settings
              toast={setMessage}
              settings={settings}
              setSettings={setSettings}
            />
          ) : (
            <Records
              key={page}
              {...{
                page,
                data,
                onNew,
                openRecord,
                returns,
                onDelete: requestDelete,
                stockAction: () =>
                  data.Inventory.length
                    ? setModal({ type: "stock" })
                    : setMessage("Add a product before adjusting stock."),
              }}
            />
          )}
          <footer>
            <span>© 2026 Folio. A little clarity for your business.</span>
            <span>
              <i />
              All systems operational <span className="footer-dot">·</span>{" "}
              Frontend demo
            </span>
          </footer>
        </main>
      </div>
      {message && (
        <div className="toast" role="status">
          <Icon name="check" size={19} />
          {message}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setMessage("")}
          >
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal.type === "edit"
              ? `${modal.record ? "Edit" : "New"} ${{ Sales: "sales invoice", Purchases: "purchase order", Inventory: "product", Customers: "customer", Suppliers: "supplier", Expenses: "expense", Users: "user" }[modal.module]}`
              : modal.type === "detail"
                ? (modal.tab === "Bills" ? "Purchase bill · " : "") +
                  modal.record.id
                : {
                    delete: "Delete record?",
                    stock: "Stock movement",
                    return: "Create return",
                    notifications: "Notifications",
                    Help: "Welcome to your workspace",
                    Profile: "Your profile",
                  }[modal.type]
          }
          wide={["Sales", "Purchases"].includes(modal.module)}
          onClose={() => setModal(null)}
        >
          {modal.type === "delete" && (
            <div>
              <p>
                Delete <strong>{modal.record.name}</strong> ({modal.record.id})?
              </p>
              <p className="form-description">
                This removes only this record from the current demo session.
                Related records and balances will remain unchanged.
              </p>
              <div className="form-actions">
                <button className="secondary" onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button className="danger-button" onClick={confirmDelete}>
                  <Icon name="trash" size={17} />
                  Delete record
                </button>
              </div>
            </div>
          )}
          {modal.type === "edit" &&
            (["Sales", "Purchases"].includes(modal.module) ? (
              <InvoiceForm
                module={modal.module}
                data={data}
                record={modal.record}
                onSave={save}
                onClose={() => setModal(null)}
              />
            ) : (
              <RecordForm
                module={modal.module}
                record={modal.record}
                onSave={save}
                onClose={() => setModal(null)}
              />
            ))}
          {modal.type === "detail" && (
            <div className="detail">
              <div className="detail-header">
                <div>
                  <small>
                    {modal.module === "Sales" ? "BILL TO" : "SUPPLIER"}
                  </small>
                  <h2>{modal.record.name}</h2>
                  <p>{modal.record.date}</p>
                </div>
                <StatusBadge status={modal.record.status} />
              </div>
              <DataTable
                compact
                columns={[
                  col("product", "Product"),
                  col("quantity", "Quantity"),
                  col("price", "Price", money),
                  col("tax", "Tax", (v) => v + "%"),
                ]}
                rows={modal.record.items}
              />
              <div className="invoice-totals">
                <p>
                  Invoice total <b>{money(modal.record.total)}</b>
                </p>
                <p>
                  Paid <b>{money(modal.record.paid)}</b>
                </p>
                <h3>
                  Balance <b>{money(modal.record.total - modal.record.paid)}</b>
                </h3>
              </div>
              <p className="form-description">
                Review the products and payment details before making changes.
              </p>
              <div className="form-actions">
                <button className="secondary" onClick={() => setModal(null)}>
                  Close
                </button>
                <button
                  className="primary"
                  onClick={() => setModal({ ...modal, type: "edit" })}
                >
                  Edit document
                </button>
              </div>
            </div>
          )}
          {modal.type === "stock" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = Object.fromEntries(new FormData(e.currentTarget));
                const p = data.Inventory.find((r) => r.name === f.product);
                const next =
                  f.type === "Stock In"
                    ? p.stock + Number(f.quantity)
                    : f.type === "Stock Out"
                      ? p.stock - Number(f.quantity)
                      : Number(f.quantity);
                if (next < 0) {
                  setMessage("Not enough stock for this movement.");
                  return;
                }
                setData({
                  ...data,
                  Inventory: data.Inventory.map((r) =>
                    r.id === p.id ? { ...r, stock: next } : r,
                  ),
                });
                setModal(null);
                setMessage("Stock updated successfully.");
              }}
            >
              <div className="form-grid">
                <Select
                  label="Product"
                  name="product"
                  options={data.Inventory.map((r) => r.name)}
                />
                <Select
                  label="Movement type"
                  name="type"
                  options={["Stock In", "Stock Out", "Stock Adjustment"]}
                />
                <FormInput
                  label="Quantity (new balance for adjustment)"
                  name="quantity"
                  type="number"
                  min="0"
                  required
                />
                <FormInput label="Reason" name="reason" required />
              </div>
              <div className="form-actions">
                <button className="primary">Save movement</button>
              </div>
            </form>
          )}
          {modal.type === "return" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = Object.fromEntries(new FormData(e.currentTarget));
                setReturns([
                  ...returns,
                  {
                    ...f,
                    amount: Number(f.amount),
                    id: `RET-${Date.now().toString().slice(-6)}`,
                    module: modal.module,
                    status: "Pending",
                  },
                ]);
                setModal(null);
                setMessage("Return created for review.");
              }}
            >
              <div className="form-grid">
                <Select
                  label="Original document"
                  name="reference"
                  options={data[modal.module].map((r) => r.id)}
                />
                <FormInput
                  label="Return date"
                  name="date"
                  type="date"
                  defaultValue="2026-09-07"
                  required
                />
                <FormInput label="Reason" name="name" required />
                <FormInput
                  label="Return amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>
              <p className="form-description">
                Returns are preview records; stock and financial balances are
                not automatically changed.
              </p>
              <div className="form-actions">
                <button className="primary">Create return</button>
              </div>
            </form>
          )}
          {modal.type === "notifications" && (
            <div className="notification-list">
              <h3>Inventory needs attention</h3>
              <p>
                {data.Inventory.filter((r) => r.stock < r.min).length} products
                are below minimum stock.
              </p>
              <button
                className="text-button"
                onClick={() => {
                  setModal(null);
                  navigate("Inventory");
                }}
              >
                Review inventory <Icon name="arrow" size={16} />
              </button>
              <hr />
              <h3>You’re all set</h3>
              <p>Your demo workspace is ready to explore.</p>
            </div>
          )}
          {modal.type === "Help" && (
            <div className="notification-list">
              <p>
                Use the sidebar to explore your business. Create invoices, add
                customers, and manage products using the green action buttons.
              </p>
              <p>
                Search and filter tables to find records, then open a row with
                its arrow to view or edit it.
              </p>
              <p>
                This is a frontend prototype. All changes are temporary and
                reset when you reload.
              </p>
            </div>
          )}
          {modal.type === "Profile" && (
            <div className="profile-detail">
              <span className="avatar alex">AM</span>
              <h2>Alex Morgan</h2>
              <p>alex.morgan@acme.com</p>
              <StatusBadge status="Active" />
              <p>Admin · Acme Inc.</p>
              <button
                className="secondary"
                onClick={() => {
                  setModal(null);
                  navigate("Users");
                }}
              >
                Manage users
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
