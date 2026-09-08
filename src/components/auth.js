"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { FormInput } from "./ui";
export function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function checkSession() {
    setLoading(true);
    setError("");
    try {
      setUser((await api("auth/session/")).user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    checkSession();
    const refresh = () =>
      api("auth/session/")
        .then((result) => setUser(result.user))
        .catch(() => {});
    window.addEventListener("session-check", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("session-check", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api("auth/session/");
      const result = await api(signup ? "auth/signup/" : "auth/login/", {
        method: "POST",
        body: values,
      });
      setUser(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function signout() {
    await api("auth/logout/", { method: "POST" });
    setUser(null);
    setSignup(false);
  }
  if (user) return children({ user, signout });
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <a className="brand" href="#">
          folio<span className="brand-dot">.</span>
        </a>
        <h1>
          {loading
            ? "Opening your workspace"
            : signup
              ? "Create your account"
              : "Welcome back"}
        </h1>
        <p>
          {signup
            ? "Keep your customers in one place."
            : "Sign in to your workspace."}
        </p>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">Checking your session…</p>
        ) : (
          <form key={String(signup)} onSubmit={submit}>
            <FormInput
              label="Username"
              name="username"
              autoComplete="username"
              maxLength={150}
              required
            />
            <FormInput
              label="Password"
              name={signup ? "password1" : "password"}
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              required
            />
            {signup && (
              <>
                <FormInput
                  label="Confirm password"
                  name="password2"
                  type="password"
                  autoComplete="new-password"
                  required
                />
                <p className="form-description">
                  Use at least 8 characters. Avoid common passwords, only
                  numbers, or your username.
                </p>
              </>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Please wait…" : signup ? "Create account" : "Log in"}
            </button>
            <button
              className="text-button"
              type="button"
              disabled={busy}
              onClick={() => {
                setSignup(!signup);
                setError("");
              }}
            >
              {signup
                ? "Already have an account? Log in"
                : "New here? Create an account"}
            </button>
            {error && (
              <button
                className="text-button"
                type="button"
                onClick={checkSession}
              >
                Retry connection
              </button>
            )}
          </form>
        )}
      </section>
    </main>
  );
}
