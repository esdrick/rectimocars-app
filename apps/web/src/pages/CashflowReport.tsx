import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getCashflowReport, type CashflowReport } from "../api/reports";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartString() {
  const now = new Date();
  const local = new Date(now.getFullYear(), now.getMonth(), 1);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatDay(value?: string | null) {
  if (!value) return "—";
  return String(value).slice(0, 10);
}

function formatKind(value?: string | null) {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "ACCOUNT_PAYABLE") return "Cuenta por pagar";
  if (normalized === "ABONO") return "Abono";
  if (normalized === "FINAL") return "Pago final";
  if (normalized === "DEVOLUCION") return "Devolución";
  return value || "—";
}

export default function CashflowReportPage() {
  const [fromDate, setFromDate] = useState(monthStartString);
  const [toDate, setToDate] = useState(todayString);
  const [data, setData] = useState<CashflowReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getCashflowReport({ from: fromDate, to: toDate, include_details: true });
      setData(response);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo cargar el flujo de caja.";
      setError(String(msg));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const topExpenseDay = useMemo(() => {
    if (!data?.breakdown_by_day?.length) return null;
    return [...data.breakdown_by_day].sort((a, b) => Number(b.expenses_total) - Number(a.expenses_total))[0];
  }, [data]);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <Link to="/accounts-payable" className="ui-link-btn">← Volver a finanzas</Link>
          <h2 style={{ margin: "8px 0 4px" }}>Flujo de caja</h2>
          <div style={{ opacity: 0.8 }}>Ingresos por pagos de órdenes y egresos por cuentas por pagar liquidadas.</div>
        </div>
        <button type="button" onClick={load} disabled={loading} className="ui-btn">
          {loading ? "Cargando..." : "Recargar"}
        </button>
      </div>

      <div className="ui-panel ui-panel-body" style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <label className="ui-label">
            <span className="ui-label-text">Desde</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="ui-control" />
          </label>
          <label className="ui-label">
            <span className="ui-label-text">Hasta</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="ui-control" />
          </label>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={load} disabled={loading} className="ui-btn">
            Aplicar rango
          </button>
        </div>
      </div>

      {error ? <div className="ui-error" style={{ marginTop: 12 }}>{error}</div> : null}

      {data ? (
        <>
          <div className="ui-metric-grid" style={{ marginTop: 16 }}>
            <div className="ui-metric-card">
              <div className="ui-metric-label">Ingresos</div>
              <div className="ui-metric-value">{formatMoney(data.ingresos_total)}</div>
            </div>
            <div className="ui-metric-card">
              <div className="ui-metric-label">Egresos</div>
              <div className="ui-metric-value">{formatMoney(data.egresos_total)}</div>
            </div>
            <div className="ui-metric-card">
              <div className="ui-metric-label">Neto</div>
              <div className="ui-metric-value" style={{ color: Number(data.neto) < 0 ? "#991b1b" : "#166534" }}>
                {formatMoney(data.neto)}
              </div>
            </div>
            <div className="ui-metric-card">
              <div className="ui-metric-label">Pendiente</div>
              <div className="ui-metric-value">{formatMoney(data.pendientes_total)}</div>
            </div>
          </div>

          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            <div className="ui-metric-card">
              <div className="ui-metric-label">Rango</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{formatDay(data.from_date)} a {formatDay(data.to_date)}</div>
            </div>
            <div className="ui-metric-card">
              <div className="ui-metric-label">Día con más egresos</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{topExpenseDay ? formatDay(topExpenseDay.day) : "—"}</div>
              <div style={{ opacity: 0.7, marginTop: 4 }}>{topExpenseDay ? formatMoney(topExpenseDay.expenses_total) : ""}</div>
            </div>
          </div>

          <div className="ui-panel ui-panel-body" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Desglose diario</h3>
            {data.breakdown_by_day.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No hubo movimientos en el rango.</div>
            ) : (
              <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Ingresos</th>
                    <th>Egresos</th>
                    <th>Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.breakdown_by_day.map((row) => (
                    <tr key={row.day}>
                      <td>{formatDay(row.day)}</td>
                      <td>{formatMoney(row.incomes_total)}</td>
                      <td>{formatMoney(row.expenses_total)}</td>
                      <td style={{ color: Number(row.net_total) < 0 ? "#991b1b" : "#166534", fontWeight: 700 }}>
                        {formatMoney(row.net_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>

          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="ui-panel ui-panel-body">
              <h3 style={{ marginTop: 0 }}>Ingresos</h3>
              {data.incomes.length === 0 ? (
                <div style={{ opacity: 0.7 }}>No hay ingresos en el rango.</div>
              ) : (
                <div className="ui-table-wrap">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Descripción</th>
                      <th>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.incomes.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDateTime(row.occurred_at)}</td>
                        <td>{formatKind(row.kind)}</td>
                        <td>{row.description}</td>
                        <td>{formatMoney(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>

            <div className="ui-panel ui-panel-body">
              <h3 style={{ marginTop: 0 }}>Egresos</h3>
              {data.expenses.length === 0 ? (
                <div style={{ opacity: 0.7 }}>No hay egresos en el rango.</div>
              ) : (
                <div className="ui-table-wrap">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Descripción</th>
                      <th>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expenses.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDateTime(row.occurred_at)}</td>
                        <td>{formatKind(row.kind)}</td>
                        <td>{row.description}</td>
                        <td>{formatMoney(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
