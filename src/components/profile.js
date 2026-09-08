"use client";
import { useState } from "react";
import { Icon, StatusBadge } from "./ui";

export function Profile({ user, company, signout, onError }) {
  const [leaving, setLeaving] = useState(false);
  async function logout() {
    if (leaving) return;
    setLeaving(true);
    try {
      await signout();
    } catch (error) {
      onError(error.message);
      setLeaving(false);
    }
  }
  return (
    <section className="account-profile">
      <div className="account-identity">
        <span className="account-avatar" aria-hidden="true">
          {user.username.slice(0, 2).toUpperCase()}
        </span>
        <h3>{user.username}</h3>
        <span className="account-role">{user.role}</span>
      </div>
      <dl className="account-facts">
        <div>
          <dt>Workspace</dt>
          <dd>{company || "Business workspace"}</dd>
        </div>
        <div>
          <dt>Account status</dt>
          <dd>
            <StatusBadge status="Active" />
          </dd>
        </div>
        <div>
          <dt>Access</dt>
          <dd>
            {user.role === "Admin"
              ? "Business records, team and settings"
              : user.role === "Manager"
                ? "Manage business records"
                : "Add and update business records"}
          </dd>
        </div>
      </dl>
      <div className="account-footer">
        <span>
          <Icon name="check" size={16} /> Signed in
        </span>
        <button className="secondary" disabled={leaving} onClick={logout}>
          {leaving ? "Logging out…" : "Log out"}
        </button>
      </div>
    </section>
  );
}
