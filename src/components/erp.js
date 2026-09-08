"use client";
import { useEffect, useRef, useState } from "react";
import { Profile } from "./profile";
import { AuthGate } from "./auth";
import { CurrencyContext } from "./currency";
import { Sidebar, Navbar } from "./navigation";
import { Dashboard } from "./dashboard";
import { Records } from "./records";
import { Reports } from "./reports";
import { Settings } from "./settings";
import { RecordForm, InvoiceForm } from "./record-forms";
import {
  DocumentDetail,
  PaymentForm,
  ReturnForm,
  MovementForm,
  OpeningForm,
} from "./business-forms";
import { Modal, DataTable } from "./ui";
import { menus } from "./shared";
import { api } from "@/lib/api";
import { endpoints, documentRow } from "@/lib/erp-api";
import { useWorkspace } from "@/lib/use-workspace";

export default function ERP() {
  return (
    <AuthGate>
      {({ user, signout }) => (
        <Workspace
          key={`${user.id}:${user.workspace_id}`}
          user={user}
          signout={signout}
        />
      )}
    </AuthGate>
  );
}
function Workspace({ user, signout }) {
  const { data, loading, error, reload, revision } = useWorkspace(user);
  const [page, setPage] = useState("Dashboard");
  const [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const canWrite = ["Admin", "Manager", "Staff"].includes(user.role);
  useEffect(() => {
    const read = () => {
      try {
        const value = decodeURIComponent(window.location.hash.slice(1));
        if (menus.includes(value)) setPage(value);
      } catch {
        setPage("Dashboard");
      }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  function open(value) {
    if (!lock.current && !loading) {
      setActionError("");
      setModal(value);
    }
  }
  function close() {
    if (!lock.current) {
      setModal(null);
      setActionError("");
    }
  }
  function navigate(value) {
    if (["Help", "Profile"].includes(value)) {
      open({ type: value });
      return;
    }
    setPage(value);
    window.location.hash = value;
    setMobile(false);
  }
  function onNew(module, tab) {
    if (!canWrite || !data || loading || error) return;
    if (tab === "Returns") {
      open({ type: "return", module });
      return;
    }
    if (["Sales", "Purchases"].includes(module)) {
      const kind =
        module === "Sales"
          ? "Sale"
          : tab === "Bills"
            ? "Purchase Bill"
            : "Purchase Order";
      if (
        !data.Inventory.some((row) => row.status === "Active") ||
        !data[module === "Sales" ? "Customers" : "Suppliers"].some(
          (row) => row.status === "Active",
        )
      ) {
        setMessage("Add an active product and a customer or supplier first.");
        return;
      }
      open({ type: "edit-document", module, kind });
      return;
    }
    open({ type: "edit", module });
  }
  function openRecord(module, record, tab) {
    if (tab === "Returns") {
      open({ type: "return-detail", module, record });
      return;
    }
    open({
      type: ["Sales", "Purchases"].includes(module) ? "document" : "edit",
      module,
      record,
      kind: record.kind,
    });
  }
  function action(type, record) {
    open({
      type,
      record,
      kind: record.kind,
      module: record.kind === "Sale" ? "Sales" : "Purchases",
    });
  }
  async function run(
    path,
    method,
    body,
    text = "Saved to your workspace.",
    showDocument = false,
  ) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionError("");
    try {
      const result = await api(path, { method, body });
      setModal(null);
      setMessage(text);
      await reload();
      if (showDocument)
        setModal({
          type: "document",
          module: result.kind === "Sale" ? "Sales" : "Purchases",
          record: documentRow(result, data.Customers, data.Suppliers),
        });
      return result;
    } catch (failure) {
      setActionError(failure.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function save(values) {
    const path = endpoints[modal.module];
    return run(
      `${path}${modal.record ? modal.record.id + "/" : ""}`,
      modal.record ? "PATCH" : "POST",
      values,
    );
  }
  const titles = {
    edit: `${modal?.record ? (canWrite ? "Edit" : "View") : "Add"} ${modal?.module || "record"}`,
    "edit-document": modal?.record
      ? "Edit draft"
      : `New ${modal?.kind?.toLowerCase() || "document"}`,
    document: modal?.record?.number,
    delete: modal?.module === "Users" ? "Deactivate user?" : "Delete record?",
    post:
      modal?.record?.kind === "Purchase Order"
        ? "Confirm purchase order?"
        : "Post document?",
    convert: "Create purchase bill?",
    payment: "Record payment",
    refund: "Record refund",
    return: "Create return",
    "return-detail": "Return details",
    stock: "Stock movement",
    opening: "Opening balance",
    Profile: "Your profile",
    Help: "Help",
    notifications: "Notifications",
  };
  return (
    <CurrencyContext.Provider value={data?.settings.currency || "USD"}>
      <div className="app-shell">
        <Sidebar
          page={page}
          navigate={navigate}
          open={mobile}
          onClose={() => setMobile(false)}
          user={user}
          lowCount={data?.summary.low_stock_items || 0}
        />
        <div className="main-shell">
          <Navbar
            page={page}
            user={user}
            navigate={navigate}
            onMenu={() => setMobile(true)}
            notify={() => open({ type: "notifications" })}
          />
          <main>
            {loading && !data ? (
              <p role="status" className="panel connection-state">
                Loading your workspace...
              </p>
            ) : error ? (
              <div role="alert" className="panel connection-state">
                <p>{error}</p>
                <button className="primary" onClick={reload}>
                  Retry connection
                </button>
              </div>
            ) : (
              data && (
                <>
                  {loading && <p role="status">Refreshing saved data...</p>}
                  <div className="workspace-refresh">
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={reload}
                    >
                      Refresh data
                    </button>
                  </div>
                  {page === "Dashboard" ? (
                    <Dashboard
                      data={data}
                      revision={revision}
                      navigate={navigate}
                      onNew={onNew}
                      openRecord={openRecord}
                      canWrite={canWrite}
                    />
                  ) : page === "Reports" ? (
                    <Reports
                      data={data}
                      revision={revision}
                      toast={setMessage}
                    />
                  ) : page === "Settings" ? (
                    <Settings
                      key={revision}
                      settings={data.settings}
                      readOnly={user.role !== "Admin"}
                      busy={busy}
                      onSave={(values) =>
                        run(
                          "settings/",
                          "PATCH",
                          values,
                          "Company settings saved.",
                        )
                      }
                    />
                  ) : page === "Users" && user.role !== "Admin" ? (
                    <p className="panel connection-state">
                      Only workspace Admins can manage team accounts.
                    </p>
                  ) : (
                    <Records
                      key={page}
                      page={page}
                      data={data}
                      onNew={onNew}
                      openRecord={openRecord}
                      canWrite={canWrite}
                      user={user}
                      onDelete={(module, record) =>
                        open({ type: "delete", module, record })
                      }
                      stockAction={() => open({ type: "stock" })}
                      openingAction={() => open({ type: "opening" })}
                    />
                  )}
                </>
              )
            )}
            {actionError && !modal && (
              <p className="auth-error" role="alert">
                {actionError}
              </p>
            )}
            <footer>
              <span>Folio · Business workspace</span>
              <span>
                {error
                  ? "Connection needs attention"
                  : loading
                    ? "Connecting"
                    : "Connected to your database"}
              </span>
            </footer>
          </main>
        </div>
        {message && (
          <div className="toast" role="status">
            <span>{message}</span>
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => setMessage("")}
            >
              ×
            </button>
          </div>
        )}
        {modal && (
          <Modal
            title={titles[modal.type]}
            wide={["document", "edit-document"].includes(modal.type)}
            onClose={close}
          >
            {actionError && (
              <p className="auth-error" role="alert">
                {actionError}
              </p>
            )}
            {busy && <p role="status">Saving...</p>}
            {modal.type === "edit" && (
              <RecordForm
                module={modal.module}
                defaultTax={data.settings.tax}
                record={modal.record}
                readOnly={!canWrite}
                busy={busy}
                onClose={close}
                onSave={save}
              />
            )}
            {modal.type === "edit-document" && (
              <InvoiceForm
                kind={modal.kind}
                data={data}
                record={modal.record}
                busy={busy}
                onClose={close}
                onSave={(values) =>
                  run(
                    `documents/${modal.record ? modal.record.id + "/" : ""}`,
                    modal.record ? "PATCH" : "POST",
                    values,
                    "Draft saved. Review it before posting.",
                    true,
                  )
                }
              />
            )}
            {modal.type === "document" && (
              <DocumentDetail
                record={modal.record}
                data={data}
                canWrite={canWrite}
                busy={busy}
                onAction={action}
                onClose={close}
              />
            )}
            {["post", "convert"].includes(modal.type) && (
              <>
                <p>
                  {modal.type === "convert"
                    ? "This creates a draft bill from the order. Stock changes when the bill is posted."
                    : modal.record.kind === "Purchase Order"
                      ? "This confirms and locks the order. No stock or money changes yet."
                      : `This locks ${modal.record.number} and ${modal.record.kind === "Sale" ? "reduces" : "increases"} stock. Changes are handled through returns after posting.`}
                </p>
                <div className="form-actions">
                  <button className="secondary" disabled={busy} onClick={close}>
                    Cancel
                  </button>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      run(
                        `documents/${modal.record.id}/${modal.type === "post" ? "post" : "convert-to-bill"}/`,
                        "POST",
                        {},
                        modal.type === "post"
                          ? "Document posted."
                          : "Bill draft created.",
                        true,
                      )
                    }
                  >
                    Confirm
                  </button>
                </div>
              </>
            )}
            {["payment", "refund"].includes(modal.type) && (
              <PaymentForm
                record={modal.record}
                refund={modal.type === "refund"}
                busy={busy}
                onSave={(values) =>
                  run(`documents/${modal.record.id}/payments/`, "POST", values)
                }
              />
            )}
            {modal.type === "return" && (
              <ReturnForm
                module={modal.module}
                defaultTax={data.settings.tax}
                record={modal.record}
                data={data}
                busy={busy}
                onSave={(values) =>
                  run(
                    "returns/",
                    "POST",
                    values,
                    "Return saved and stock updated.",
                  )
                }
              />
            )}
            {modal.type === "return-detail" && (
              <>
                <p>
                  {modal.record.reason} · {modal.record.date}
                </p>
                <DataTable
                  columns={[
                    { key: "line", label: "Original line" },
                    { key: "quantity", label: "Quantity" },
                    { key: "amount", label: "Amount" },
                  ]}
                  rows={modal.record.items}
                />
              </>
            )}
            {modal.type === "stock" && (
              <MovementForm
                data={data}
                busy={busy}
                onSave={(values) =>
                  run("stock-movements/", "POST", values, "Stock updated.")
                }
              />
            )}
            {modal.type === "opening" && (
              <OpeningForm
                busy={busy}
                onSave={(values) =>
                  run("transactions/opening-balance/", "POST", values)
                }
              />
            )}
            {modal.type === "delete" && (
              <>
                <p>
                  {modal.module === "Users" ? "Deactivate" : "Delete"}{" "}
                  <strong>
                    {modal.record.name ||
                      modal.record.username ||
                      modal.record.number}
                  </strong>
                  ?
                </p>
                <p className="form-description">
                  {modal.module === "Users"
                    ? "This user will no longer be able to sign in. Their identity is preserved."
                    : modal.module === "Expenses"
                      ? "This also removes its linked cash entry."
                      : "This removes the record from the database. Referenced records are protected."}
                </p>
                <div className="form-actions">
                  <button className="secondary" disabled={busy} onClick={close}>
                    Cancel
                  </button>
                  <button
                    className="danger-button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        `${endpoints[modal.module]}${modal.record.id}/`,
                        "DELETE",
                        undefined,
                        modal.module === "Users"
                          ? "User deactivated."
                          : "Record deleted.",
                      )
                    }
                  >
                    Confirm{" "}
                    {modal.module === "Users" ? "deactivation" : "delete"}
                  </button>
                </div>
              </>
            )}
            {modal.type === "Profile" && (
              <Profile
                user={user}
                company={data?.settings.company}
                signout={signout}
                onError={setActionError}
              />
            )}
            {modal.type === "Help" && (
              <>
                <p>
                  Changes are saved to your workspace. Save invoices and bills
                  as drafts, review them, then post them to update stock.
                  Payments and returns are separate actions.
                </p>
              </>
            )}
            {modal.type === "notifications" && (
              <p>
                {data?.settings.low_stock === false
                  ? "Low stock notifications are turned off in Settings."
                  : `${data?.summary.low_stock_items || 0} products need stock attention.`}
              </p>
            )}
          </Modal>
        )}
      </div>
    </CurrencyContext.Provider>
  );
}
