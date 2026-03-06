import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

type WorkOrder = {
  id: string;
  // backend puede devolver snake_case o camelCase
  order_number?: string | number;
  orderNumber?: string | number;
  customer_id?: string;
  customer_name?: string;
  status?: string;
  total?: string | number;
  paid_total?: string | number;
  balance?: string | number;
  items_count?: string | number;
  itemsCount?: string | number;
  payment_status?: string;
  pricing_tier?: "TD" | "SC" | string;
  created_at?: string;
};

function fmtMoney(v: any) {
  if (v === null || v === undefined) return "-";
  return String(v);
}

function formatStatusLabel(status: string | null | undefined) {
  if (!status) return "-";
  return String(status).toUpperCase().replaceAll("_", " ");
}

function normalizeWorkOrder(o: any): WorkOrder {
  const rawOrderNumber = o?.order_number ?? o?.orderNumber ?? o?.orderNo ?? o?.number;
  const parsedOrderNumber = rawOrderNumber === null || rawOrderNumber === undefined
    ? undefined
    : Number(rawOrderNumber);

  return {
    ...o,
    order_number: Number.isFinite(parsedOrderNumber) ? parsedOrderNumber : undefined,
    customer_id: o?.customer_id ?? o?.customerId,
    pricing_tier: o?.pricing_tier ?? o?.pricingTier,
    created_at: o?.created_at ?? o?.createdAt,
    items_count: o?.items_count ?? o?.itemsCount ?? o?.items_count,
  };
}

export default function WorkOrders() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ["DRAFT", "RECIBIDO"],
    RECIBIDO: ["RECIBIDO", "EN_PROCESO"],
    EN_PROCESO: ["EN_PROCESO", "LISTO"],
    LISTO: ["LISTO", "ENTREGADO"],
    ENTREGADO: ["ENTREGADO", "LISTO", "CERRADO"],
    CERRADO: ["CERRADO"],
  };

  function num(v: any): number {
    if (v === null || v === undefined) return 0;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function getStatus(o: WorkOrder): string {
    return String(o.status ?? "DRAFT").toUpperCase();
  }

  function canClose(o: WorkOrder): boolean {
    // Backend rule: cannot close if saldo != 0
    return num(o.balance) === 0;
  }

  function hasItems(o: WorkOrder): boolean {
    const cnt = num((o as any).items_count ?? (o as any).itemsCount);
    if (cnt > 0) return true;
    // fallback (best-effort): if total > 0, assume there are items
    return num(o.total) > 0;
  }

  function getAllowedNextStatuses(o: WorkOrder): string[] {
    const current = getStatus(o);

    // UX rule: cannot leave DRAFT without at least one service/item.
    if (current === "DRAFT" && !hasItems(o)) {
      return ["DRAFT"]; 
    }

    const allowed = ALLOWED_TRANSITIONS[current] ?? [current];

    // UX simplification: don’t offer re-opening ENTREGADO back to LISTO from the list.
    // (Re-opening can still happen automatically when editing content.)
    const noReopenFromDelivered =
      current === "ENTREGADO" ? allowed.filter((s) => s !== "LISTO") : allowed;

    // If not DRAFT, don’t allow going back to DRAFT from the UI.
    const filtered = noReopenFromDelivered.filter((s) => s !== "DRAFT" || current === "DRAFT");

    // Apply close rule in UI.
    return filtered.filter((s) => (s === "CERRADO" ? canClose(o) : true));
  }

  const filteredOrders = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    const status = statusFilter.trim().toUpperCase();
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;

    return orders.filter((o) => {
      if (q) {
        const name = String(o.customer_name ?? "").toLowerCase();
        if (!name.includes(q)) return false;
      }

      if (status) {
        const st = getStatus(o);
        if (st !== status) return false;
      }

      if (from || to) {
        const raw = o.created_at ?? (o as any).createdAt;
        if (!raw) return false;
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return false;
        if (from && d < from) return false;
        if (to) {
          const toEnd = new Date(to);
          toEnd.setHours(23, 59, 59, 999);
          if (d > toEnd) return false;
        }
      }

      return true;
    });
  }, [orders, customerQuery, statusFilter, dateFrom, dateTo]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const [ordersRes, customersRes] = await Promise.all([
        api.get("/work-orders/"),
        api.get("/customers/"),
      ]);

      const ordersRaw = Array.isArray(ordersRes.data) ? ordersRes.data : [];
      const base = ordersRaw.map((o: any) => normalizeWorkOrder(o));

      const customersRaw = Array.isArray(customersRes.data) ? customersRes.data : [];
      const map: Record<string, string> = {};
      for (const c of customersRaw) {
        const id = c?.id;
        const name = c?.name;
        if (id && name) map[String(id)] = String(name);
      }

      const enriched = base.map((o: WorkOrder) => {
        const name = o.customer_id ? map[o.customer_id] : undefined;
        return { ...o, customer_name: o.customer_name ?? name };
      });

      setOrders(enriched);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? "Error cargando órdenes";
      setError(String(msg));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(orderId: string, nextStatus: string) {
    setUpdatingStatusId(orderId);
    setError(null);
    try {
      const { data } = await api.patch(`/work-orders/${orderId}`, { status: String(nextStatus).toUpperCase() });
      const updated = normalizeWorkOrder(data);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)));
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? "No se pudo actualizar el estado";
      setError(String(msg));
    } finally {
      setUpdatingStatusId(null);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <h2>Órdenes</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" onClick={() => navigate("/work-orders/new")} className="ui-btn ui-btn-primary">
            Crear nueva orden
          </button>
          <button type="button" onClick={() => navigate("/customers")} className="ui-btn">
            Ver clientes
          </button>
          <button type="button" onClick={load} disabled={loading} className="ui-btn">
            {loading ? "Cargando..." : "Recargar"}
          </button>
        </div>
      </div>

      {/* Crear */}
      <div style={{ marginTop: 10, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <input
          placeholder="Buscar cliente por nombre…"
          value={customerQuery}
          onChange={(e) => setCustomerQuery(e.target.value)}
          className="ui-control"
          style={{ minWidth: 260 }}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="ui-control"
        >
          <option value="">Estado (todos)</option>
          <option value="DRAFT">DRAFT</option>
          <option value="RECIBIDO">RECIBIDO</option>
          <option value="EN_PROCESO">EN PROCESO</option>
          <option value="LISTO">LISTO</option>
          <option value="ENTREGADO">ENTREGADO</option>
          <option value="CERRADO">CERRADO</option>
        </select>

        <label className="ui-label">
          <span className="ui-label-text">Desde</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="ui-control"
          />
        </label>

        <label className="ui-label">
          <span className="ui-label-text">Hasta</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="ui-control"
          />
        </label>

        <button
          type="button"
          onClick={() => {
            setCustomerQuery("");
            setStatusFilter("");
            setDateFrom("");
            setDateTo("");
          }}
          className="ui-btn"
        >
          Limpiar filtros
        </button>
      </div>

      {error && (
        <div className="ui-error">
          {error}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div>Cargando...</div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ opacity: 0.8 }}>No hay órdenes aún.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filteredOrders.map((o) => (
            <div
              key={o.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 12,
                cursor: "pointer",
              }}
              onClick={() => navigate(`/work-orders/${o.id}`)}
              title="Abrir detalle"
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <strong>Orden #{o.order_number ?? o.id.slice(0, 8)}</strong>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>
                    Cliente: {o.customer_name ?? "Sin nombre"}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13 }}>
                    {formatStatusLabel(o.payment_status ?? o.status)} • {o.pricing_tier ?? "-"}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.85 }}>
                    Total: {fmtMoney(o.total)} • Pagado: {fmtMoney(o.paid_total)} • Saldo: {fmtMoney(o.balance)}
                  </div>
                  {getStatus(o) === "ENTREGADO" && !canClose(o) && (
                    <div style={{ fontSize: 12, color: "#a15c00", marginTop: 4 }}>
                      No se puede CERRAR: saldo pendiente.
                    </div>
                  )}
                  {getStatus(o) === "DRAFT" && !hasItems(o) && (
                    <div style={{ fontSize: 12, color: "#a15c00", marginTop: 4 }}>
                      Agrega al menos un servicio para poder avanzar.
                    </div>
                  )}
                  <div style={{ marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
                    <select
                      value={String(o.status ?? "DRAFT")}
                      onChange={(e) => updateStatus(o.id, e.target.value)}
                      disabled={updatingStatusId === o.id}
                      style={{ padding: "4px 6px" }}
                    >
                      {getAllowedNextStatuses(o).map((s) => (
                        <option key={s} value={s}>
                          {formatStatusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
