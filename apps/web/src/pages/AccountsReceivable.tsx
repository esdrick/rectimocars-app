
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import PaymentForm, { type PaymentOut } from "../components/payments/PaymentForm";

type ReceivableRow = {
  id: string;
  order_number?: string | number | null;
  customer_id?: string | null;
  customer_name?: string | null;
  status?: string | null;
  pricing_tier?: string | null;
  created_at?: string | null;
  collection_status?: string | null;
  days_since_created?: number | null;
  total?: string | number | null;
  paid_total?: string | number | null;
  balance?: string | number | null;
};

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
};

function num(v: any): number {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(v: any): string {
  if (v === null || v === undefined) return "-";
  const n = num(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(2);
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "-";
  return String(iso).slice(0, 10);
}

function fmtLabel(value?: string | null): string {
  if (!value) return "-";
  return String(value).replaceAll("_", " ");
}

function collectionBadge(status?: string | null) {
  const normalized = String(status ?? "").toUpperCase();
  if (normalized === "VENCIDA") return { label: "VENCIDA", background: "#fee2e2", color: "#b91c1c", borderColor: "#fecaca" };
  if (normalized === "POR_VENCER") return { label: "POR VENCER", background: "#fef9c3", color: "#a16207", borderColor: "#fde68a" };
  if (normalized === "AL_DIA") return { label: "AL DÍA", background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" };
  return { label: "AL DÍA", background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" };
}

export default function AccountsReceivable() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<ReceivableRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerQuery, setCustomerQuery] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [collectionStatus, setCollectionStatus] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [minBalance, setMinBalance] = useState<string>("");

  const [payOpen, setPayOpen] = useState(false);
  const [payOrder, setPayOrder] = useState<ReceivableRow | null>(null);

  const customerMap = useMemo(() => {
    const map: Record<string, Customer> = {};
    for (const c of customers) map[c.id] = c;
    return map;
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q));
  }, [customers, customerQuery]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const balance = num(row.balance);
        acc.total += balance;
        if (String(row.collection_status).toUpperCase() === "VENCIDA") acc.overdue += balance;
        if (String(row.status).toUpperCase() === "ENTREGADO") acc.delivered += balance;
        acc.orders += 1;
        return acc;
      },
      { total: 0, overdue: 0, delivered: 0, orders: 0 }
    );
  }, [rows]);

  async function loadCustomers() {
    try {
      const res = await api.get("/customers/");
      const list = Array.isArray(res.data) ? res.data : [];
      setCustomers(
        list
          .filter((x: any) => x?.id && x?.name)
          .map((x: any) => ({ id: String(x.id), name: String(x.name), phone: x.phone ?? null }))
      );
    } catch {
      setCustomers([]);
    }
  }

  async function loadReceivables() {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (customerId) params.customer_id = customerId;
      if (status) params.status = status;
      if (collectionStatus) params.collection_status = collectionStatus;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (minBalance.trim()) params.min_balance = Number(minBalance);

      const res = await api.get("/work-orders/accounts-receivable", { params });
      const list = Array.isArray(res.data) ? res.data : [];

      const enriched: ReceivableRow[] = list.map((r: any) => {
        const id = String(r?.id);
        const cid = r?.customer_id ? String(r.customer_id) : null;
        const c = cid ? customerMap[cid] : undefined;
        return {
          id,
          order_number: r?.order_number ?? null,
          customer_id: cid,
          customer_name: r?.customer_name ?? (c ? c.name : null),
          status: r?.status ?? null,
          pricing_tier: r?.pricing_tier ?? null,
          created_at: r?.created_at ?? null,
          collection_status: r?.collection_status ?? null,
          days_since_created: r?.days_since_created ?? null,
          total: r?.total ?? null,
          paid_total: r?.paid_total ?? null,
          balance: r?.balance ?? null,
        };
      });

      setRows(enriched);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? "Error cargando cuentas por cobrar";
      setError(String(msg));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    loadReceivables();
  }, [customerId, status, collectionStatus, dateFrom, dateTo, minBalance, customers.length]);

  function openPay(r: ReceivableRow) {
    setPayOrder(r);
    setPayOpen(true);
  }

  function closePay() {
    setPayOpen(false);
    setPayOrder(null);
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2>Cuentas por cobrar</h2>
          <div style={{ marginTop: 6, opacity: 0.8 }}>
            Cartera activa: <b>{fmtMoney(totals.total)}</b> · Vencida 60 días: <b>{fmtMoney(totals.overdue)}</b> · Órdenes: <b>{totals.orders}</b>
          </div>
        </div>
        <div className="ui-section-actions">
          <button type="button" onClick={() => navigate("/work-orders")} className="ui-btn">
            Volver a órdenes
          </button>
          <button type="button" onClick={loadReceivables} disabled={loading} className="ui-btn">
            {loading ? "Cargando…" : "Recargar"}
          </button>
        </div>
      </div>

      <div className="ui-metric-grid" style={{ marginTop: 14 }}>
        <div className="ui-metric-card">
          <div className="ui-metric-label">Total por cobrar</div>
          <div className="ui-metric-value">{fmtMoney(totals.total)}</div>
        </div>
        <div className="ui-metric-card">
          <div className="ui-metric-label">Total vencido</div>
          <div className="ui-metric-value" style={{ color: "#b91c1c" }}>{fmtMoney(totals.overdue)}</div>
        </div>
        <div className="ui-metric-card">
          <div className="ui-metric-label">Entregadas con saldo</div>
          <div className="ui-metric-value">{fmtMoney(totals.delivered)}</div>
        </div>
      </div>

      <div className="ui-panel ui-panel-body" style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="ui-label">
            <span className="ui-label-text">Estado orden</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="ui-control">
              <option value="">(todos)</option>
              <option value="RECIBIDO">RECIBIDO</option>
              <option value="EN_PROCESO">EN PROCESO</option>
              <option value="LISTO">LISTO</option>
              <option value="ENTREGADO">ENTREGADO</option>
              <option value="CERRADO">CERRADO</option>
            </select>
          </label>

          <label className="ui-label">
            <span className="ui-label-text">Estado cobranza</span>
            <select value={collectionStatus} onChange={(e) => setCollectionStatus(e.target.value)} className="ui-control">
              <option value="">(todos)</option>
              <option value="AL_DIA">AL DIA</option>
              <option value="POR_VENCER">POR VENCER 45 DIAS</option>
              <option value="VENCIDA">VENCIDA</option>
            </select>
          </label>

          <label className="ui-label">
            <span className="ui-label-text">Fecha orden desde</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="ui-control" />
          </label>

          <label className="ui-label">
            <span className="ui-label-text">Fecha orden hasta</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="ui-control" />
          </label>

          <label className="ui-label">
            <span className="ui-label-text">Saldo mínimo</span>
            <input
              inputMode="decimal"
              placeholder="0"
              value={minBalance}
              onChange={(e) => setMinBalance(e.target.value)}
              className="ui-control"
              style={{ width: 140 }}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="ui-label" style={{ minWidth: 280 }}>
            <span className="ui-label-text">Buscar cliente</span>
            <input
              placeholder="Escribe para filtrar…"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              className="ui-control"
            />
          </label>

          <label className="ui-label" style={{ minWidth: 320 }}>
            <span className="ui-label-text">Cliente (opcional)</span>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="ui-control">
              <option value="">(todos)</option>
              {filteredCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              setCustomerId("");
              setCustomerQuery("");
              setStatus("");
              setCollectionStatus("");
              setDateFrom("");
              setDateTo("");
              setMinBalance("");
            }}
            className="ui-btn"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {error && <div className="ui-error" style={{ marginTop: 12 }}>{error}</div>}

      <div style={{ marginTop: 14 }}>
        {loading ? (
          <div>Cargando…</div>
        ) : rows.length === 0 ? (
          <div style={{ opacity: 0.8 }}>No hay cuentas por cobrar con los filtros actuales.</div>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Cobranza</th>
                  <th>Antigüedad</th>
                  <th>Total</th>
                  <th>Pagado</th>
                  <th>Saldo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const badge = collectionBadge(r.collection_status);
                  const ageDays = r.days_since_created ?? 0;
                  const daysLabel = `${ageDays} días`;
                  return (
                    <tr key={r.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => navigate(`/work-orders/${r.id}`)}
                          className="ui-text-button"
                          title="Abrir detalle"
                        >
                          #{r.order_number ?? r.id.slice(0, 8)}
                        </button>
                      </td>
                      <td>
                        {r.customer_id ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/customers/${r.customer_id}`)}
                            className="ui-text-button"
                            title="Abrir cliente"
                          >
                            {r.customer_name ?? r.customer_id ?? "-"}
                          </button>
                        ) : (
                          r.customer_name ?? r.customer_id ?? "-"
                        )}
                      </td>
                      <td>{fmtLabel(r.status)}</td>
                      <td>{fmtDate(r.created_at)}</td>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 10px",
                            borderRadius: 999,
                            border: `1px solid ${badge.borderColor}`,
                            background: badge.background,
                            color: badge.color,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td>{daysLabel}</td>
                      <td>{fmtMoney(r.total)}</td>
                      <td>{fmtMoney(r.paid_total)}</td>
                      <td>
                        <b>{fmtMoney(r.balance)}</b>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button type="button" onClick={() => openPay(r)} className="ui-btn">
                          Registrar pago
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {payOpen && payOrder && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => closePay()}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              background: "white",
              borderRadius: 12,
              padding: 16,
              border: "1px solid rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Registrar pago</div>
                <div style={{ fontSize: 16 }}>
                  <b>Orden #{payOrder.order_number ?? payOrder.id.slice(0, 8)}</b>
                </div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  Cliente: {payOrder.customer_name ?? payOrder.customer_id ?? "-"} · Saldo: <b>{fmtMoney(payOrder.balance)}</b>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <PaymentForm
                orderId={payOrder.id}
                defaultType="ABONO"
                defaultCurrency="USD"
                defaultMethod="EFECTIVO"
                allowedTypes={["ABONO", "FINAL"]}
                allowedMethods={["EFECTIVO", "TRANSFERENCIA", "TARJETA"]}
                onCancel={closePay}
                compact
                onSuccess={async (_p: PaymentOut) => {
                  setPayOpen(false);
                  setPayOrder(null);
                  await loadReceivables();
                }}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
