"use client";
import { useState } from "react";
import { Icon, DataTable, StatCard } from "./ui";
import { money } from "@/lib/mock-data";
import { col, status, invoiceCols } from "./shared";
export function Chart() {
  const [period, setPeriod] = useState("This year");
  const [hover, setHover] = useState(null);
  const values =
    period === "This year"
      ? [27, 39, 31, 53, 43, 61, 47, 67, 55, 76, 66, 88]
      : [36, 28, 50, 44, 60, 48, 73, 56, 64, 82, 69, 91];
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <h2>Sales overview</h2>
          <p>A closer look at your business performance.</p>
        </div>
        <select
          aria-label="Chart period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option>This year</option>
          <option>Last year</option>
        </select>
      </div>
      <div className="chart-summary">
        <strong>
          {period === "This year" ? "$124,580.00" : "$108,240.00"}
        </strong>
        <span className="trend">↗ 12.8%</span>
        <div className="chart-legend">
          <span>
            <i />
            Sales
          </span>
          <span>
            <i />
            Purchases
          </span>
        </div>
      </div>
      <div className="chart">
        <div className="y-axis">
          {["$40k", "$30k", "$20k", "$10k", "$0"].map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>
        <div className="plot">
          <div className="grid-lines">
            {[1, 2, 3, 4, 5].map((i) => (
              <i key={i} />
            ))}
          </div>
          <div className="bars">
            {values.map((v, i) => (
              <div
                key={i}
                className={`bar-group ${hover === i ? "hover" : ""}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div className="bar-pair">
                  <div
                    className="bar sales-bar"
                    style={{ height: v + "%" }}
                    title={`Sales: ${money(v * 400)}`}
                  />
                  <div
                    className="bar purchase-bar"
                    style={{ height: v * 0.67 + "%" }}
                    title={`Purchases: ${money(v * 268)}`}
                  />
                </div>
                <span>
                  {
                    [
                      "Jan",
                      "Feb",
                      "Mar",
                      "Apr",
                      "May",
                      "Jun",
                      "Jul",
                      "Aug",
                      "Sep",
                      "Oct",
                      "Nov",
                      "Dec",
                    ][i]
                  }
                </span>
                {hover === i && (
                  <div className="chart-tooltip">Sales {money(v * 400)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Dashboard({ data, navigate, onNew, openRecord }) {
  const [range, setRange] = useState("This month");
  const factor =
    range === "Last month" ? 0.87 : range === "This year" ? 8.4 : 1;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Dashboard</h1>
        </div>
        <div className="heading-actions">
          <div className="date-picker">
            <Icon name="calendar" size={16} />
            <select
              aria-label="Dashboard date range"
              onChange={(e) => setRange(e.target.value)}
              value={range}
            >
              <option>This month</option>
              <option>Last month</option>
              <option>This year</option>
            </select>
          </div>
          <button className="primary" onClick={() => onNew("Sales")}>
            <Icon name="plus" size={17} />
            Create invoice
          </button>
        </div>
      </div>
      <div className="stats-grid">
        {[
          ["Total sales", "$124,580.00", "12.8%", "sales"],
          ["Total purchases", "$68,240.00", "8.2%", "purchases"],
          ["Total expenses", "$18,450.00", "3.1%", "expenses", true],
          ["Total profit", "$37,890.00", "16.4%", "profit"],
          [
            "Amount receivable",
            "$24,680.00",
            null,
            "wallet",
            false,
            "Across 18 unpaid invoices",
          ],
          [
            "Amount payable",
            "$12,450.00",
            null,
            "accounting",
            false,
            "Across 12 purchase bills",
          ],
          [
            "Total products",
            "1,248",
            "24 new",
            "inventory",
            false,
            "products this month",
          ],
          [
            "Low stock items",
            String(
              data.Inventory.filter((r) => r.stock < r.min).length,
            ).padStart(2, "0"),
            null,
            "stock",
            true,
            "Items need your attention",
          ],
        ].map(([title, value, change, icon, negative, foot]) => (
          <StatCard
            key={title}
            {...{
              title,
              value: value.startsWith("$")
                ? money(Number(value.replace(/[^0-9.]/g, "")) * factor)
                : value,
              change,
              icon,
              negative,
              foot,
            }}
          />
        ))}
      </div>
      <div className="dashboard-middle">
        <Chart />
        <section className="panel health-panel">
          <div className="panel-heading">
            <div>
              <h2>Cash flow</h2>
              <p>Your money, in and out.</p>
            </div>
            <span className="subtle">{range}</span>
          </div>
          <div className="donut">
            <div>
              <span>Net cash flow</span>
              <strong>{money(37890 * factor)}</strong>
              <small>↗ 16.4% this month</small>
            </div>
          </div>
          <div className="cash-row">
            <span>
              <i className="dot dark" />
              Money in
            </span>
            <b>{money(124580 * factor)}</b>
          </div>
          <div className="cash-row">
            <span>
              <i className="dot light" />
              Money out
            </span>
            <b>{money(86690 * factor)}</b>
          </div>
          <div className="cash-note">
            <Icon name="check" size={14} /> Your cash flow is looking healthy
          </div>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                Recent sales{" "}
                <span className="count-pill">{data.Sales.length}</span>
              </h2>
              <p>Your latest customer invoices.</p>
            </div>
            <button className="text-button" onClick={() => navigate("Sales")}>
              View all sales <Icon name="chevron" size={14} />
            </button>
          </div>
          <DataTable
            columns={invoiceCols.filter((c) => c.key !== "date")}
            rows={data.Sales.slice(0, 5)}
            compact
            onRow={(r) => openRecord("Sales", r)}
          />
        </section>
        <section className="panel low-stock">
          <div className="panel-heading">
            <div>
              <h2>
                <span className="stock-title-icon">
                  <Icon name="stock" size={17} />
                </span>
                Low stock products
              </h2>
              <p>A little restock goes a long way.</p>
            </div>
            <button
              className="icon-button"
              aria-label="View inventory"
              onClick={() => navigate("Inventory")}
            >
              <Icon name="arrow" size={17} />
            </button>
          </div>
          {data.Inventory.filter((r) => r.stock < r.min).map((r, i) => (
            <button
              className="stock-row"
              key={r.id}
              onClick={() => openRecord("Inventory", r)}
            >
              <span className={`product-visual product-${i}`}>
                <Icon name={i === 2 ? "spark" : "inventory"} size={23} />
              </span>
              <span>
                <b>{r.name}</b>
                <small>{r.sku}</small>
              </span>
              <span className={`stock-quantity ${r.stock === 0 ? "out" : ""}`}>
                <b>{r.stock} left</b>
                <small>Min. {r.min}</small>
              </span>
            </button>
          ))}
          <button
            className="restock-button"
            onClick={() => navigate("Inventory")}
          >
            Manage inventory <Icon name="chevron" size={14} />
          </button>
        </section>
      </div>
      <div className="dashboard-bottom lower">
        <section className="panel">
          <div className="panel-heading">
            <h2>Recent purchases</h2>
            <button
              className="text-button"
              onClick={() => navigate("Purchases")}
            >
              View all <Icon name="chevron" size={14} />
            </button>
          </div>
          <DataTable
            compact
            rows={data.Purchases.slice(0, 3)}
            columns={[
              col("id", "Purchase no."),
              col("name", "Supplier"),
              col("total", "Amount", money),
              status,
            ]}
            onRow={(r) => openRecord("Purchases", r)}
          />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Recent transactions</h2>
            <button
              className="text-button"
              onClick={() => navigate("Accounting")}
            >
              View all <Icon name="chevron" size={14} />
            </button>
          </div>
          {data.Accounting.slice(0, 3).map((r) => (
            <div className="transaction-row" key={r.id}>
              <span className="transaction-icon">
                <Icon name={r.amount > 0 ? "sales" : "purchases"} size={17} />
              </span>
              <span>
                <b>{r.name}</b>
                <small>{r.date}</small>
              </span>
              <strong className={r.amount > 0 ? "positive" : ""}>
                {money(r.amount)}
              </strong>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
