"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { allRecords, documentRow } from "./erp-api";

export function useWorkspace(user) {
  const [state, setState] = useState({
    data: null,
    error: "",
    loading: true,
    revision: 0,
  });
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const ticket = ++generation.current;
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const [
        Customers,
        Suppliers,
        Inventory,
        documents,
        Expenses,
        Users,
        Accounting,
        returns,
        movements,
        settings,
        summary,
      ] = await Promise.all([
        allRecords("customers/"),
        allRecords("suppliers/"),
        allRecords("products/"),
        allRecords("documents/"),
        allRecords("expenses/"),
        user.role === "Admin" ? allRecords("users/") : Promise.resolve([]),
        allRecords("transactions/"),
        allRecords("returns/"),
        allRecords("stock-movements/"),
        api("settings/"),
        api("accounting/"),
      ]);
      if (ticket !== generation.current) return;
      const docs = documents.map((record) =>
        documentRow(record, Customers, Suppliers),
      );
      setState((current) => ({
        loading: false,
        error: "",
        revision: current.revision + 1,
        data: {
          Customers,
          Suppliers,
          Inventory,
          Expenses,
          Users,
          Accounting,
          documents: docs,
          Sales: docs.filter((record) => record.kind === "Sale"),
          Purchases: docs.filter((record) => record.kind !== "Sale"),
          returns,
          movements,
          settings,
          summary,
        },
      }));
    } catch (error) {
      if (ticket === generation.current)
        setState((current) => ({
          ...current,
          loading: false,
          error: error.message,
        }));
    }
  }, [user.id, user.role, user.workspace_id]);
  useEffect(() => {
    reload();
    return () => {
      generation.current += 1;
    };
  }, [reload]);
  return { ...state, reload };
}
