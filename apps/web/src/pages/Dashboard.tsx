import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { isAuthenticated, clearToken } from "../api/auth";

type Me = { id: string; email: string; role: string };
type Service = { id: string; name: string; active: boolean; price_td: string | number; price_sc: string | number };
type WorkOrder = {
  id: string;
  order_number?: number;
  status?: string;
  pricing_tier?: string;
  total?: string | number;
  created_at?: string;
  assigned_worker_id?: string | null;
  assigned_workers?: Array<{ id: string; name: string; job_role?: string | null }>;
};

type Worker = { id: string; name: string; job_role?: string; active: boolean };

function formatDateTime(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatStatusLabel(value?: string) {
  if (!value) return "-";
  return String(value).replaceAll("_", " ");
}

export default function Dashboard() {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  const navigate = useNavigate();

  const [me, setMe] = useState<Me | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeServices = useMemo(() => services.filter(s => s.active).length, [services]);

  const lastOrders = useMemo(() => {
    const copy = [...orders];
    copy.sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });
    return copy.slice(0, 5);
  }, [orders]);

  const workerAssignments = useMemo(() => {
    const activeWorkers = workers.filter((w) => w.active !== false);

    // group orders by assigned_workers
    const byWorker = new Map<string, WorkOrder[]>();
    for (const o of orders) {
      const assigned = Array.isArray(o.assigned_workers) ? o.assigned_workers : [];
      if (assigned.length > 0) {
        for (const w of assigned) {
          const arr = byWorker.get(w.id) ?? [];
          arr.push(o);
          byWorker.set(w.id, arr);
        }
        continue;
      }
      // fallback for legacy data
      const wid = o.assigned_worker_id;
      if (!wid) continue;
      const arr = byWorker.get(wid) ?? [];
      arr.push(o);
      byWorker.set(wid, arr);
    }

    // sort each worker's orders by created_at desc, pick latest
    const rows = activeWorkers.map((w) => {
      const list = byWorker.get(w.id) ?? [];
      const sorted = [...list].sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      });
      const orderNumbers = sorted.map((o) => o.order_number ?? (o.id ? `${o.id.slice(0, 8)}…` : "-"));
      return {
        id: w.id,
        name: w.name,
        job_role: w.job_role,
        assignedCount: list.length,
        orderNumbers,
      };
    });

    // show first workers with assignments, then the rest
    rows.sort((a, b) => {
      if (a.assignedCount === 0 && b.assignedCount > 0) return 1;
      if (a.assignedCount > 0 && b.assignedCount === 0) return -1;
      return a.name.localeCompare(b.name);
    });

    return rows;
  }, [workers, orders]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const meRes = await api.get("/auth/me");
      setMe(meRes.data);

      const sRes = await api.get("/services/");
      setServices(Array.isArray(sRes.data) ? sRes.data : []);

      const oRes = await api.get("/work-orders/");
      setOrders(Array.isArray(oRes.data) ? oRes.data : []);

      const wRes = await api.get("/workers/");
      setWorkers(Array.isArray(wRes.data) ? wRes.data : []);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      setError(String(detail || err?.message || "No se pudo cargar el dashboard"));

      if (status === 401) {
        clearToken();
        // te saca del dashboard si el token es inválido
        navigate("/login", { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ padding: 0, width: "100%", maxWidth: "100%", margin: 0, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, width: "100%" }}>
        <div>
          <h2 style={{ margin: "0 0 8px" }}>Dashboard</h2>
          <div style={{ opacity: 0.8, marginTop: 6 }}>
            {me ? (
              <>
                {me.email} — <strong>{me.role}</strong>
              </>
            ) : (
              "Cargando usuario…"
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={load} disabled={loading} className="ui-btn">
            {loading ? "Cargando…" : "Recargar"}
          </button>
        </div>
      </div>

      {error && <div className="ui-error" style={{ marginTop: 16 }}>{error}</div>}

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, width: "100%" }}>
        <div className="ui-metric-card">
          <div className="ui-metric-label">Servicios</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{loading ? "…" : services.length}</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>Activos: {loading ? "…" : activeServices}</div>
          <div style={{ marginTop: 10 }}>
            <Link to="/services" className="ui-text-button">Ver servicios</Link>
          </div>
        </div>

        <div className="ui-metric-card">
          <div className="ui-metric-label">Órdenes</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{loading ? "…" : orders.length}</div>
          <div style={{ marginTop: 10 }}>
            <Link to="/work-orders" className="ui-text-button">Ver órdenes</Link>
          </div>
        </div>

        <div className="ui-metric-card">
          <div className="ui-metric-label">Acciones</div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <Link to="/work-orders/new" className="ui-text-button">+ Crear nueva orden</Link>
            <Link to="/customers" className="ui-text-button">+ Crear / Gestionar clientes</Link>
            <Link to="/engine-models" className="ui-text-button">+ Tipos de motor</Link>
            <Link to="/received-parts" className="ui-text-button">+ Piezas recibidas</Link>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 12,
          width: "100%",
          alignItems: "start",
        }}
      >
        <div className="ui-panel ui-panel-body" style={{ minWidth: 520 }}>
          <h3 style={{ marginTop: 0 }}>Últimas órdenes</h3>

          {loading ? (
            <div>Cargando…</div>
          ) : lastOrders.length === 0 ? (
            <div style={{ opacity: 0.8 }}>Aún no hay órdenes.</div>
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Status</th>
                    <th>Tier</th>
                    <th>Total</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {lastOrders.map((o) => (
                    <tr
                      key={o.id}
                      style={{ borderBottom: "1px solid #f2f2f2", cursor: "pointer" }}
                      onClick={() => navigate(`/work-orders/${o.id}`)}
                    >
                      <td><code>{o.order_number ?? `${o.id.slice(0, 8)}…`}</code></td>
                      <td>{formatStatusLabel(o.status)}</td>
                      <td>{o.pricing_tier ?? "-"}</td>
                      <td>{o.total ?? "-"}</td>
                      <td>{formatDateTime(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="ui-panel ui-panel-body">
          <h3 style={{ marginTop: 0 }}>Asignaciones</h3>

          {loading ? (
            <div>…</div>
          ) : workerAssignments.length === 0 ? (
            <div style={{ opacity: 0.8 }}>No hay empleados.</div>
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Órdenes asignadas</th>
                    <th>#</th>
                  </tr>
                </thead>
                <tbody>
                  {workerAssignments.slice(0, 12).map((w) => (
                    <tr
                      key={w.id}
                      style={{ borderBottom: "1px solid #f2f2f2", cursor: w.assignedCount ? "pointer" : "default" }}
                      onClick={() => {
                        if (w.assignedCount && w.orderNumbers.length === 1) {
                          const only = w.orderNumbers[0];
                          const found = orders.find(
                            (o) => (o.order_number ? String(o.order_number) : `${o.id.slice(0, 8)}…`) === only
                          );
                          if (found) navigate(`/work-orders/${found.id}`);
                        }
                      }}
                    >
                      <td>
                        <div style={{ fontWeight: 600 }}>{w.name}</div>
                        {w.job_role ? <div style={{ opacity: 0.75, fontSize: 12 }}>{w.job_role}</div> : null}
                      </td>
                      <td>
                        {w.orderNumbers.length === 0 ? "-" : w.orderNumbers.join(", ")}
                      </td>
                      <td>{w.assignedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 10 }}>
                <Link to="/workers" className="ui-text-button">Ver empleados</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
