"use client";
import { createContext, useContext } from "react";

export const CurrencyContext = createContext("USD");
export function useMoney() {
  const currency = useContext(CurrencyContext);
  return (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
}
