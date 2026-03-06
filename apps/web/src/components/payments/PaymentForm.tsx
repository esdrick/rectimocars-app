import { useMemo, useState } from "react";
import { api } from "../../api/client";

export type PaymentType = "ABONO" | "FINAL" | "DEVOLUCION";
export type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "AJUSTE";
export type PaymentCurrency = "USD" | "EUR" | "VES";

export type PaymentOut = {
  id: string;
  order_id: string;
  amount: string | number;
  currency: string;
  method: string;
  type: string;
  created_at: string;
};

type Props = {
  orderId: string;
  title?: string;
  defaultType?: PaymentType;
  defaultCurrency?: PaymentCurrency;
  defaultMethod?: PaymentMethod;
  allowedTypes?: PaymentType[];
  allowedMethods?: PaymentMethod[];
  onSuccess?: (payment: PaymentOut) => void;
  onCancel?: () => void;
  /** If true, renders with tighter spacing (good for modals). */
  compact?: boolean;
};

function parseAmount(input: string): number {
  // allow "10", "10.5", "10,5"
  const normalized = input.replace(/\s+/g, "").replace(",", ".");
  const n = Number(normalized);
  return n;
}

export default function PaymentForm({
  orderId,
  title = "Registrar pago",
  defaultType = "ABONO",
  defaultCurrency = "USD",
  defaultMethod = "EFECTIVO",
  allowedTypes,
  allowedMethods,
  onSuccess,
  onCancel,
  compact = false,
}: Props) {
  const [amountText, setAmountText] = useState("");
  const [type, setType] = useState<PaymentType>(defaultType);
  const [currency, setCurrency] = useState<PaymentCurrency>(defaultCurrency);
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNumber = useMemo(() => parseAmount(amountText), [amountText]);
  const types = allowedTypes && allowedTypes.length > 0 ? allowedTypes : ["ABONO", "FINAL", "DEVOLUCION"];
  const methods =
    allowedMethods && allowedMethods.length > 0 ? allowedMethods : ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "AJUSTE"];

  const canSubmit = useMemo(() => {
    if (!orderId) return false;
    if (!amountText.trim()) return false;
    if (!Number.isFinite(amountNumber)) return false;
    if (amountNumber <= 0) return false;
    return true;
  }, [orderId, amountText, amountNumber]);

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      // Backend PaymentCreate fields: amount, currency, method, type
      const payload = {
        amount: String(amountNumber),
        currency,
        method,
        type,
      };

      const res = await api.post<PaymentOut>(`/work-orders/${orderId}/payments`, payload);

      // Reset amount only (keep selections)
      setAmountText("");

      onSuccess?.(res.data);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo registrar el pago";
      setError(String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  const gap = compact ? 10 : 12;
  const pad = compact ? "10px 12px" : "12px 14px";

  return (
    <div
      style={{
        padding: compact ? 0 : 0,
        display: "grid",
        gap,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {onCancel ? (
          <button type="button" onClick={onCancel} disabled={submitting} className="ui-btn">
            Cerrar
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="ui-error">{error}</div>
      ) : null}

      <div style={{ display: "grid", gap }}>
        <label className="ui-label">
          <span className="ui-label-text">Monto</span>
          <input
            inputMode="decimal"
            placeholder="Ej: 20.00"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            className="ui-control"
            style={{ padding: pad }}
          />
        </label>

        <div style={{ display: "flex", gap, flexWrap: "wrap" }}>
          <label className="ui-label" style={{ flex: "1 1 160px" }}>
            <span className="ui-label-text">Tipo</span>
            <select value={type} onChange={(e) => setType(e.target.value as PaymentType)} className="ui-control" style={{ padding: pad }}>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="ui-label" style={{ flex: "1 1 160px" }}>
            <span className="ui-label-text">Moneda</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as PaymentCurrency)} className="ui-control" style={{ padding: pad }}>
              <option value="USD">$</option>
              <option value="EUR">EUR</option>
              <option value="VES">VES</option>
            </select>
          </label>

          <label className="ui-label" style={{ flex: "1 1 200px" }}>
            <span className="ui-label-text">Método</span>
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="ui-control" style={{ padding: pad }}>
              {methods.map((m) => (
                <option key={m} value={m}>
                  {m === "EFECTIVO" ? "Efectivo" : m === "TRANSFERENCIA" ? "Transferencia" : m === "TARJETA" ? "Tarjeta" : "Ajuste"}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
          {onCancel ? (
            <button type="button" onClick={onCancel} disabled={submitting} className="ui-btn">
              Cancelar
            </button>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="ui-btn ui-btn-primary"
          >
            {submitting ? "Guardando…" : "Registrar pago"}
          </button>
        </div>

        {amountText.trim() && (!Number.isFinite(amountNumber) || amountNumber <= 0) ? (
          <div style={{ fontSize: 12, opacity: 0.75 }}>Monto inválido. Usa un número mayor a 0.</div>
        ) : null}
      </div>
    </div>
  );
}
