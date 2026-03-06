import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";

/* =======================
   Types
======================= */

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at?: string;
};

type WorkOrder = {
  id: string;
  order_number?: number;
  status?: string;
  pricing_tier?: string;
  created_at?: string;
  total?: number;
  paid?: number;
  paid_total?: number;
  balance?: number;
  collection_status?: string;
  days_since_created?: number;
};

/* =======================
   Utils
======================= */

function formatMoney(value: number | undefined) {
  if (value === undefined || value === null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function formatStatusLabel(value?: string | null): string {
  if (!value) return "—";
  return String(value).replaceAll("_", " ");
}

function formatPricingTier(value?: string | null): string {
  const normalized = String(value ?? "").toUpperCase();
  if (normalized === "TD") return "Cliente directo";
  if (normalized === "SC") return "Cliente subcontrato";
  return value || "—";
}


/* =======================
   Component
======================= */

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();

  const api = useMemo(() => {
    const baseURL =
      (import.meta as any)?.env?.VITE_API_URL ||
      (import.meta as any)?.env?.VITE_API_BASE_URL ||
      "http://localhost:8000";

    const instance = axios.create({ baseURL });

    instance.interceptors.request.use((config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers = config.headers ?? {};
        (config.headers as any).Authorization = `Bearer ${token}`;
      }
      return config;
    });

    return instance;
  }, []);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);

  const totals = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        const balance = Number(order.balance || 0);
        acc.total += balance;
        if (String(order.collection_status || "").toUpperCase() === "VENCIDA") acc.overdue += balance;
        if (balance > 0) acc.pendingOrders += 1;
        return acc;
      },
      { total: 0, overdue: 0, pendingOrders: 0 }
    );
  }, [orders]);

  const customerEditHasChanges = useMemo(() => {
    if (!customer) return false;
    const originalName = String(customer.name ?? "").trim();
    const originalPhone = String(customer.phone ?? "").trim();
    const originalEmail = String(customer.email ?? "").trim();
    const originalAddress = String(customer.address ?? "").trim();
    const originalNotes = String(customer.notes ?? "").trim();
    return (
      formName.trim() !== originalName ||
      formPhone.trim() !== originalPhone ||
      formEmail.trim() !== originalEmail ||
      formAddress.trim() !== originalAddress ||
      formNotes.trim() !== originalNotes
    );
  }, [customer, formName, formPhone, formEmail, formAddress, formNotes]);

  /* =======================
     Load data
  ======================= */

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!id) {
        setError("ID de cliente no válido");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Cliente
        const customerRes = await api.get<Customer>(`/customers/${id}`);
        if (!mounted) return;
        setCustomer(customerRes.data);
        setFormName(customerRes.data?.name ?? "");
        setFormPhone(String(customerRes.data?.phone ?? ""));
        setFormEmail(String(customerRes.data?.email ?? ""));
        setFormAddress(String(customerRes.data?.address ?? ""));
        setFormNotes(String(customerRes.data?.notes ?? ""));

        // Órdenes del cliente
        try {
          let ordersData: WorkOrder[] | null = null;
          try {
            const r1 = await api.get<WorkOrder[]>(`/customers/${id}/work-orders`);
            ordersData = r1.data;
          } catch {
            const r2 = await api.get<WorkOrder[]>(`/work-orders?customer_id=${id}`);
            ordersData = r2.data;
          }

          if (!mounted) return;
          const normalized = (Array.isArray(ordersData) ? ordersData : []).map((order: any) => ({
            id: String(order.id),
            order_number: order.order_number ?? order.orderNumber,
            status: order.status ?? null,
            pricing_tier: order.pricing_tier ?? order.pricingTier ?? null,
            created_at: order.created_at ?? null,
            total: order.total !== undefined ? Number(order.total) : undefined,
            paid_total:
              order.paid_total !== undefined
                ? Number(order.paid_total)
                : order.paid !== undefined
                  ? Number(order.paid)
                  : undefined,
            balance: order.balance !== undefined ? Number(order.balance) : undefined,
            collection_status: order.collection_status ?? null,
            days_since_created: order.days_since_created ?? null,
          }));
          setOrders(normalized);
        } catch {
          // Si no existe ninguno de los endpoints, no rompemos nada
          if (!mounted) return;
          setOrders([]);
        }
      } catch (e: any) {
        if (!mounted) return;
        const msg =
          e?.response?.data?.detail ??
          e?.message ??
          "No se pudo cargar el cliente";
        setError(String(msg));
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [api, id]);

  function startEdit() {
    if (!customer) return;
    setFormName(customer.name ?? "");
    setFormPhone(String(customer.phone ?? ""));
    setFormEmail(String(customer.email ?? ""));
    setFormAddress(String(customer.address ?? ""));
    setFormNotes(String(customer.notes ?? ""));
    setEmailTouched(false);
    setEditing(true);
  }

  function cancelEdit() {
    if (!customer) {
      setEditing(false);
      return;
    }
    setFormName(customer.name ?? "");
    setFormPhone(String(customer.phone ?? ""));
    setFormEmail(String(customer.email ?? ""));
    setFormAddress(String(customer.address ?? ""));
    setFormNotes(String(customer.notes ?? ""));
    setEmailTouched(false);
    setEditing(false);
  }

  async function saveCustomer() {
    if (!customer) return;
    const nextName = formName.trim();
    const nextPhone = formPhone.trim();
    const nextEmail = formEmail.trim();
    const nextAddress = formAddress.trim();
    const nextNotes = formNotes.trim();
    if (!nextName) {
      setError("El nombre es obligatorio");
      return;
    }
    if (!isValidEmail(nextEmail)) {
      setEmailTouched(true);
      return;
    }
    if (!customerEditHasChanges) return;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: nextName,
        phone: nextPhone ? nextPhone : null,
        email: nextEmail ? nextEmail : null,
        address: nextAddress ? nextAddress : null,
        notes: nextNotes ? nextNotes : null,
      };

      const res = await api.patch<Customer>(`/customers/${customer.id}`, payload);
      setCustomer(res.data);
      setFormName(res.data?.name ?? "");
      setFormPhone(String(res.data?.phone ?? ""));
      setFormEmail(String(res.data?.email ?? ""));
      setFormAddress(String(res.data?.address ?? ""));
      setFormNotes(String(res.data?.notes ?? ""));
      setEditing(false);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo guardar el cliente";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  }

  /* =======================
     States
  ======================= */

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <p>Cargando cliente…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <Link to="/customers" className="ui-link-btn">← Volver a clientes</Link>
        <div className="ui-error" style={{ marginTop: 12 }}>{error}</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div style={{ padding: 16 }}>
        <Link to="/customers" className="ui-link-btn">← Volver a clientes</Link>
        <p>No se encontró el cliente.</p>
      </div>
    );
  }

  /* =======================
     Render
  ======================= */

  return (
    <div style={{ padding: 16, maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <Link to="/customers" className="ui-link-btn">← Volver a clientes</Link>
          <h2 style={{ margin: "0 0 8px" }}>{customer.name}</h2>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          {!editing ? (
            <button type="button" onClick={startEdit} className="ui-btn">
              Editar cliente
            </button>
          ) : (
            <>
              <button type="button" onClick={cancelEdit} disabled={saving} className="ui-btn">
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveCustomer}
                disabled={saving || !formName.trim() || !isValidEmail(formEmail) || !customerEditHasChanges}
                className="ui-btn ui-btn-primary"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Datos cliente */}

      {/* Datos cliente */}
      <div className="ui-panel ui-panel-body" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Datos del cliente</h3>

        {!editing ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "3fr 3fr 3fr",
              gap: 12,
              alignItems: "start",
            }}
          >
            <div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Teléfono</div>
              <div>{customer.phone ?? "—"}</div>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Email</div>
              <div>{customer.email ?? "—"}</div>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Dirección</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{customer.address ?? "—"}</div>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Notas</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{customer.notes ?? "—"}</div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="ui-label">
              <span className="ui-label-text">Nombre</span>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} className="ui-control" />
            </label>

            <label className="ui-label">
              <span className="ui-label-text">Teléfono</span>
              <input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="ui-control" />
            </label>

            <label className="ui-label">
              <span className="ui-label-text">Email</span>
              <input
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                className="ui-control"
                style={{
                  border: emailTouched && !isValidEmail(formEmail) ? "1px solid #dc2626" : "1px solid #d0d0d0",
                }}
              />
              {emailTouched && !isValidEmail(formEmail) && (
                <span style={{ color: "#dc2626", fontSize: 12 }}>
                  El email no tiene un formato válido.
                </span>
              )}
            </label>

            <label className="ui-label">
              <span className="ui-label-text">Dirección</span>
              <input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} className="ui-control" />
            </label>

            <label className="ui-label" style={{ gridColumn: "1 / -1" }}>
              <span className="ui-label-text">Notas</span>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={3}
                className="ui-control"
                style={{ resize: "vertical" }}
                placeholder="Notas del cliente (opcional)"
              />
            </label>
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <div className="ui-metric-card">
          <div className="ui-metric-label">Deuda total</div>
          <div className="ui-metric-value">{formatMoney(totals.total)}</div>
        </div>
        <div className="ui-metric-card">
          <div className="ui-metric-label">Deuda vencida</div>
          <div className="ui-metric-value">{formatMoney(totals.overdue)}</div>
        </div>
        <div className="ui-metric-card">
          <div className="ui-metric-label">Órdenes con saldo</div>
          <div className="ui-metric-value">{totals.pendingOrders}</div>
        </div>
      </div>

      {/* Órdenes */}
      <div style={{ marginTop: 20 }}>
        <h3>Órdenes del cliente</h3>

        {orders.length === 0 ? (
          <p style={{ opacity: 0.7 }}>
            Este cliente no tiene órdenes registradas (o el endpoint de órdenes aún no está disponible).
          </p>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Estado</th>
                  <th>Tipo</th>
                  <th>Cobranza</th>
                  <th>Días</th>
                  <th>Total</th>
                  <th>Pagado</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                      <td>
                        <Link to={`/work-orders/${o.id}`} className="ui-link-btn">
                          {o.order_number ? `#${o.order_number}` : "—"}
                        </Link>
                      </td>
                    <td>{formatStatusLabel(o.status)}</td>
                    <td>{formatPricingTier(o.pricing_tier)}</td>
                    <td>{formatStatusLabel(o.collection_status)}</td>
                    <td>{o.days_since_created ?? "—"}</td>
                    <td>{formatMoney(o.total)}</td>
                    <td>{formatMoney(o.paid_total)}</td>
                    <td>{formatMoney(o.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
