"use client";
import { useEffect, useRef, useState } from "react";
export function Icon({ name, size = 20, ...props }) {
  const paths = {
    dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    sales: "M3 3v18h18 M7 14l4-4 4 3 6-8",
    purchases: "M3 4h2l3 12h11l3-9H6 M9 21h.01 M18 21h.01",
    inventory: "M3 7l9-5 9 5v10l-9 5-9-5z M3 7l9 5 9-5 M12 12v10 M8 4l9 5",
    customers:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-3.87",
    suppliers:
      "M3 21V7l9-4 9 4v14 M8 21v-6h8v6 M7 9h2 M15 9h2 M7 12h2 M15 12h2",
    expenses: "M6 3h12v18l-3-2-3 2-3-2-3 2z M9 7h6 M9 11h6 M9 15h3",
    accounting: "M3 7l9-5 9 5z M3 22h18 M5 10v8 M12 10v8 M19 10v8",
    reports: "M5 3h10l4 4v14H5z M14 3v5h5 M8 17v-3 M12 17v-6 M16 17v-4",
    users:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 8h5 M19.5 5.5v5",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z",
    search: "M21 21l-5-5 M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16",
    bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
    chevron: "M9 5l7 7-7 7",
    down: "M6 9l6 6 6-6",
    plus: "M12 5v14 M5 12h14",
    arrow: "M7 17L17 7 M7 7h10v10",
    calendar:
      "M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2 M7 2v6 M17 2v6 M3 11h18",
    download: "M12 3v12 M7 10l5 5 5-5 M4 15v6h16v-6",
    help: "M9 8a3 3 0 1 1 4 3c-1 1-1 2-1 3 M12 17h.01 M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20",
    menu: "M4 6h16 M4 12h16 M4 18h16",
    close: "M6 6l12 12 M18 6L6 18",
    wallet: "M3 6h17v15H3z M3 6V3h14 M15 11h6v5h-6z",
    profit: "M3 17l6-6 4 4 8-11 M15 4h6v6",
    stock: "M12 3L2 21h20z M12 9v5 M12 17h.01",
    check: "M5 12l4 4L19 6",
    filter: "M4 6h16 M7 12h10 M10 18h4",
    trash: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
    spark: "M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d={paths[name] || paths.reports} />
    </svg>
  );
}
export function StatusBadge({ status }) {
  return (
    <span
      className={`badge ${["Paid", "Active", "In Stock", "Completed"].includes(status) ? "green" : ["Partial", "Low Stock", "Pending"].includes(status) ? "amber" : "red"}`}
    >
      <i />
      {status}
    </span>
  );
}
export function FormInput({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
export function Select({ label, options, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select {...props}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
export function Modal({ title, children, onClose, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const old = document.activeElement;
    ref.current?.showModal();
    return () => old?.focus();
  }, []);
  return (
    <dialog
      aria-label={title}
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function SearchFilter({
  search,
  setSearch,
  filter,
  setFilter,
  options,
  placeholder = "Search records…",
}) {
  return (
    <div className="table-tools">
      <div className="input-search">
        <Icon name="search" size={17} />
        <input
          aria-label="Search records"
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {options && (
        <div className="filter-select">
          <Icon name="filter" size={16} />
          <select
            aria-label="Filter records"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="All">All {options.label || "statuses"}</option>
            {options.values.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
export function Pagination({ page, setPage, total, size }) {
  return (
    <div className="pagination">
      <span>
        Showing {total ? Math.min((page - 1) * size + 1, total) : 0}–
        {Math.min(page * size, total)} of {total} results
      </span>
      <div>
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span className="page-number">{page}</span>
        <button
          disabled={page * size >= total}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
export function DataTable({ columns, rows, onRow, onDelete, compact = false }) {
  const [page, setPage] = useState(1);
  const size = 6;
  const effectivePage = Math.min(
    page,
    Math.max(1, Math.ceil(rows.length / size)),
  );
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              {(onRow || onDelete) && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows
              .slice((effectivePage - 1) * size, effectivePage * size)
              .map((r, i) => (
                <tr key={r.id || i}>
                  {columns.map((c) => (
                    <td key={c.key}>
                      {c.render ? c.render(r[c.key], r) : r[c.key]}
                    </td>
                  ))}
                  {(onRow || onDelete) && (
                    <td>
                      <div className="row-actions">
                        {onRow && (
                          <button
                            className="icon-button"
                            aria-label={`View ${r.name || r.id}`}
                            onClick={() => onRow(r)}
                          >
                            <Icon name="chevron" size={16} />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            className="delete-button"
                            aria-label={`Delete ${r.id}`}
                            onClick={() => onDelete(r)}
                          >
                            <Icon name="trash" size={16} />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="empty">
            No records found. Try a different search or add a new record.
          </div>
        )}
      </div>
      {!compact && (
        <Pagination
          page={effectivePage}
          setPage={setPage}
          total={rows.length}
          size={size}
        />
      )}
    </>
  );
}
export function StatCard({ title, value, change, icon, negative, foot }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{title}</span>
        <span className="stat-icon">
          <Icon name={icon} size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <div className="stat-foot">
        {change && (
          <span className={negative ? "trend negative" : "trend"}>
            {negative ? "↘" : "↗"} {change}
          </span>
        )}
        <span>{foot || "vs. last month"}</span>
      </div>
    </div>
  );
}
