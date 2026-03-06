import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getInventorySummary, type InventorySummary } from "../api/inventoryApi";

function formatQty(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(0);
}

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(2);
}

function monthLabel(value: string) {
  if (!value) return "—";
  const [y, m] = value.split("-");
  return `${m}/${y}`;
}

export default function InventorySummaryPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${m}`;
  });
  const [data, setData] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await getInventorySummary(month);
      setData(res);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo cargar el resumen";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [month]);

  const totals = useMemo(() => data?.totals, [data]);
  const topSupplier = useMemo(() => {
    if (!data || !data.entries || data.entries.length === 0) return null;
    const bySupplier = new Map<string, number>();
    for (const m of data.entries) {
      const supplier = (m.supplier ?? "").trim() || "Sin proveedor";
      const qty = Number(m.qty || 0);
      const unit = Number(m.unit_cost || 0);
      const amount = Number.isFinite(qty) && Number.isFinite(unit) ? qty * unit : 0;
      bySupplier.set(supplier, (bySupplier.get(supplier) ?? 0) + amount);
    }
    let best: { name: string; amount: number } | null = null;
    for (const [name, amount] of bySupplier.entries()) {
      if (!best || amount > best.amount) best = { name, amount };
    }
    return best;
  }, [data]);

  return (
    <div style={{ padding: 20, width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <Link to="/inventory" className="ui-link-btn">← Volver a inventario</Link>
          <h2 style={{ margin: "8px 0 0" }}>Resumen general</h2>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label className="ui-label">
            <span className="ui-label-text">Mes</span>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="ui-control" />
          </label>
          <button type="button" onClick={load} disabled={loading} className="ui-btn">
            {loading ? "Cargando…" : "Recargar"}
          </button>
        </div>
      </div>

      {error && <div className="ui-error" style={{ marginTop: 12 }}>{error}</div>}

      {!data ? null : (
        <>
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div className="ui-metric-card">
              <div className="ui-metric-label">Mes</div>
              <div className="ui-metric-value">{monthLabel(data.month)}</div>
            </div>
            <div className="ui-metric-card">
              <div className="ui-metric-label">GASTOS INSUMOS POR MES ($)</div>
              <div className="ui-metric-value">{formatMoney(totals?.total_entries_amount)} $</div>
            </div>
            <div className="ui-metric-card">
              <div className="ui-metric-label">Proveedor con mayor gasto</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {topSupplier ? topSupplier.name : "—"}
              </div>
              <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>
                {topSupplier ? `${formatMoney(topSupplier.amount)} $` : ""}
              </div>
            </div>
            <div className="ui-metric-card">
              <div className="ui-metric-label">Total salidas (Cantidad)</div>
              <div className="ui-metric-value">{formatQty(totals?.total_exits_qty)}</div>
            </div>
          </div>

          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="ui-panel ui-panel-body">
              <h3 style={{ marginTop: 0 }}>Entradas</h3>
              {data.entries.length === 0 ? (
                <div style={{ opacity: 0.7 }}>No hay entradas.</div>
              ) : (
                <div className="ui-table-wrap">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Proveedor</th>
                        <th>Qty</th>
                        <th>Costo</th>
                        <th>Subtotal</th>
                        <th>Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.entries.map((m, idx) => (
                        <tr key={`${m.created_at}-${idx}`}>
                          <td>{m.created_at ? new Date(m.created_at).toLocaleString() : "—"}</td>
                          <td>{m.supplier ?? "—"}</td>
                          <td>{formatQty(m.qty)}</td>
                          <td>{formatMoney(m.unit_cost)}</td>
                          <td>{formatMoney(m.subtotal)}</td>
                          <td>{m.note ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="ui-panel ui-panel-body">
              <h3 style={{ marginTop: 0 }}>Salidas</h3>
              {data.exits.length === 0 ? (
                <div style={{ opacity: 0.7 }}>No hay salidas.</div>
              ) : (
                <div className="ui-table-wrap">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Orden</th>
                        <th>Qty</th>
                        <th>Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.exits.map((m, idx) => (
                        <tr key={`${m.created_at}-${idx}`}>
                          <td>{m.created_at ? new Date(m.created_at).toLocaleString() : "—"}</td>
                          <td>{m.order_number ?? m.work_order_id ?? "—"}</td>
                          <td>{formatQty(m.qty)}</td>
                          <td>{m.note ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
