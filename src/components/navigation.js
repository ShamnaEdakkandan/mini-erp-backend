"use client";
import { useState } from "react";
import { Icon } from "./ui";
import { menus } from "./shared";
export function Sidebar({ page, navigate, open, onClose, lowCount }) {
  return (
    <>
      <div
        className={`sidebar-shade ${open ? "visible" : ""}`}
        onClick={onClose}
      />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <a
          className="brand"
          href="#Dashboard"
          onClick={() => navigate("Dashboard")}
        >
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          folio<span className="brand-dot">.</span>
        </a>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {menus.map((m, i) => (
            <div key={m}>
              {i === 9 && (
                <div className="nav-label administration">MANAGEMENT</div>
              )}
              <button
                className={`nav-item ${page === m ? "active" : ""}`}
                onClick={() => navigate(m)}
              >
                <Icon name={m.toLowerCase()} size={19} />
                <span>{m}</span>
                {m === "Inventory" && (
                  <span className="nav-count">{lowCount}</span>
                )}
                {page === m && <span className="active-dot" />}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="sidebar-profile"
            onClick={() => navigate("Profile")}
          >
            <span className="avatar alex">AM</span>
            <span>
              <b>Alex Morgan</b>
              <small>Workspace admin</small>
            </span>
            <Icon name="down" size={15} />
          </button>
        </div>
      </aside>
    </>
  );
}

export function Navbar({ page, onMenu, navigate, notify }) {
  const [search, setSearch] = useState("");
  return (
    <header className="navbar">
      <div className="breadcrumb">
        <button
          className="icon-button mobile-menu"
          aria-label="Open menu"
          onClick={onMenu}
        >
          <Icon name="menu" />
        </button>
        <Icon name="dashboard" size={17} />
        <span>/</span>
        <b>{page}</b>
      </div>
      <div className="navbar-right">
        <div className="global-search">
          <Icon name="search" size={17} />
          <input
            aria-label="Search modules"
            placeholder="Search anything…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <kbd>⌘ K</kbd>
          {search && (
            <div className="search-results">
              {menus
                .filter((m) => m.toLowerCase().includes(search.toLowerCase()))
                .map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      navigate(m);
                      setSearch("");
                    }}
                  >
                    {m}
                    <Icon name="chevron" size={15} />
                  </button>
                ))}
              {!menus.some((m) =>
                m.toLowerCase().includes(search.toLowerCase()),
              ) && <p>No matching modules</p>}
            </div>
          )}
        </div>
        <button
          className="icon-button"
          aria-label="Help"
          onClick={() => navigate("Help")}
        >
          <Icon name="help" />
        </button>
        <button
          className="icon-button notification"
          aria-label="Notifications"
          onClick={notify}
        >
          <Icon name="bell" />
          <i />
        </button>
        <div className="nav-divider" />
        <button
          className="avatar alex"
          aria-label="Your profile"
          onClick={() => navigate("Profile")}
        >
          AM
        </button>
      </div>
    </header>
  );
}
