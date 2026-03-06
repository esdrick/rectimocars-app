import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  createMovement,
  getItemDetail,
  listMovements,
  type InventoryItemDetail,
  type InventoryMovement,
} from "../api/inventoryApi";
import { listSuppliers, type Supplier } from "../api/suppliersApi";

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

function statusStyle(status: "OK" | "LOW" | "OUT") {
  if (status === "OUT") return { background: "#fee2e2", color: "#b91c1c", borderColor: "#fecaca" };
  if (status === "LOW") return { background: "#fef9c3", color: "#a16207", borderColor: "#fde68a" };
  return { background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" };
}

function statusLabel(status: "OK" | "LOW" | "OUT") {
  if (status === "OUT") return "SIN STOCK";
  if (status === "LOW") return "POCO STOCK";
  return "OK";
}

export default function InventoryDetail() {
  const { id } = useParams<{ id: string }>();

  if (id === "summary") {
    return <Navigate to="/inventory/summary" replace />;
  }

  const [detail, setDetail] = useState<InventoryItemDetail | null>(null);
  const [movIn, setMovIn] = useState<InventoryMovement[]>([]);
  const [movOut, setMovOut] = useState<InventoryMovement[]>([]);
  const [movAdjust, setMovAdjust] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showEntry, setShowEntry] = useState(false);
  const [movementType, setMovementType] = useState<"IN" | "ADJUST">("IN");
  const [adjustDirection, setAdjustDirection] = useState<"UP" | "DOWN">("UP");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CONTADO" | "CREDITO">("CONTADO");
  const [totalCost, setTotalCost] = useState("");
  const [creditDueDate, setCreditDueDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const subtotal = useMemo(() => {
    const q = Number(qty || 0);
    const u = Number(unitCost || 0);
    if (!Number.isFinite(q) || !Number.isFinite(u)) return "—";
    return (q * u).toFixed(2);
  }, [qty, unitCost]);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const d = await getItemDetail(id);
      const ins = await listMovements(id, { type: "IN" });
      const outs = await listMovements(id, { type: "OUT" });
      const adjusts = await listMovements(id, { type: "ADJUST" });
      setDetail(d);
      setMovIn(Array.isArray(ins) ? ins : []);
      setMovOut(Array.isArray(outs) ? outs : []);
      setMovAdjust(Array.isArray(adjusts) ? adjusts : []);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo cargar el detalle";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    async function loadSuppliers() {
      try {
        const res = await listSuppliers({ include_inactive: false });
        setSuppliers(Array.isArray(res) ? res : []);
      } catch {
        setSuppliers([]);
      }
    }
    loadSuppliers();
  }, []);

  async function submitEntry() {
    if (!id) return;
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) {
      setError("La cantidad debe ser mayor a 0.");
      return;
    }
    if (movementType === "IN" && paymentMode === "CREDITO") {
      const total = Number(totalCost || 0);
      if (!Number.isFinite(total) || total <= 0) {
        setError("El total de la compra debe ser mayor a 0 para crédito.");
        return;
      }
      if (!creditDueDate) {
        setError("Debes indicar la fecha de vencimiento para compras a crédito.");
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      await createMovement(id, {
        type: movementType,
        qty: q,
        unit_cost: movementType === "IN" && unitCost ? Number(unitCost) : undefined,
        supplier:
          movementType === "IN"
            ? suppliers.find((s) => s.id === supplierId)?.name || undefined
            : undefined,
        payment_mode: movementType === "IN" ? paymentMode : undefined,
        total_cost: movementType === "IN" && totalCost ? Number(totalCost) : undefined,
        due_date: movementType === "IN" && paymentMode === "CREDITO" ? creditDueDate : undefined,
        note: note.trim() || undefined,
        direction: movementType === "ADJUST" ? adjustDirection : undefined,
      });
      setSupplierId("");
      setQty("");
      setUnitCost("");
      setPaymentMode("CONTADO");
      setTotalCost("");
      setCreditDueDate("");
      setNote("");
      setMovementType("IN");
      setAdjustDirection("UP");
      setShowEntry(false);
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo registrar la entrada";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  }

  if (!id) {
    return (
      <div style={{ padding: 20 }}>
        <Link to="/inventory">← Volver</Link>
        <p>Falta el ID del item.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <Link to="/inventory">← Volver a inventario</Link>
          <h2 style={{ margin: "8px 0 0" }}>{detail?.item?.name ?? "Detalle de item"}</h2>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            {detail?.item?.code ? `Código: ${detail.item.code}` : "Sin código"}
          </div>
        </div>
        <button type="button" onClick={() => setShowEntry((v) => !v)} style={{ padding: "10px 16px" }}>
          {showEntry ? "Cerrar" : "Registrar entrada"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 6, background: "#ffe6e6" }}>
          {error}
        </div>
      )}

      {showEntry && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 10,
            display: "grid",
            gap: 8,
            maxWidth: 520,
          }}
        >
          <div style={{ fontWeight: 700 }}>Movimiento de inventario</div>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.75 }}>Tipo</span>
            <select value={movementType} onChange={(e) => setMovementType(e.target.value as "IN" | "ADJUST")}>
              <option value="IN">Entrada</option>
              <option value="ADJUST">Ajuste</option>
            </select>
          </label>

          {movementType === "ADJUST" ? (
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Dirección</span>
              <select value={adjustDirection} onChange={(e) => setAdjustDirection(e.target.value as "UP" | "DOWN")}>
                <option value="UP">Subir stock</option>
                <option value="DOWN">Bajar stock</option>
              </select>
            </label>
          ) : (
            <>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Proveedor</span>
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value=""> Sin proveedor </option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.supplies_type ? ` · ${s.supplies_type}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Modo de pago</span>
                <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as "CONTADO" | "CREDITO")}>
                  <option value="CONTADO">Contado</option>
                  <option value="CREDITO">Crédito</option>
                </select>
              </label>
            </>
          )}
          <input
            placeholder="Cantidad *"
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          {movementType === "IN" && (
            <>
              <input
                placeholder="Costo unitario (opcional)"
                type="number"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
              <input
                placeholder={paymentMode === "CREDITO" ? "Total compra *" : "Total compra (opcional)"}
                type="number"
                min={0}
                step="0.01"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
              />
              {paymentMode === "CREDITO" ? (
                <input
                  type="date"
                  value={creditDueDate}
                  onChange={(e) => setCreditDueDate(e.target.value)}
                />
              ) : null}
            </>
          )}
          <input placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {movementType === "IN" ? (
              <>
                Subtotal: <b>{totalCost || subtotal}</b>
              </>
            ) : (
              <>Subtotal: <b>—</b></>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={submitEntry} disabled={saving} style={{ padding: "10px 16px" }}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 12 }}>Cargando…</div>
      ) : detail ? (
        <>
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Entrada</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{formatQty(detail.totals.in_qty)}</div>
            </div>
            <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Salida</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{formatQty(detail.totals.out_qty)}</div>
            </div>
            <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Stock actual</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{formatQty(detail.totals.stock_on_hand)}</div>
            </div>
            <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Estado</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {(() => {
                  const s = detail.totals.status as "OK" | "LOW" | "OUT";
                  const style = statusStyle(s);
                  return (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 12px",
                        borderRadius: 999,
                        border: `1px solid ${style.borderColor}`,
                        background: style.background,
                        color: style.color,
                        fontSize: 15,
                        fontWeight: 700,
                      }}
                    >
                      {statusLabel(s)}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
              <h3 style={{ marginTop: 0 }}>Entradas</h3>
              {movIn.length === 0 ? (
                <div style={{ opacity: 0.7 }}>No hay entradas.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #eee" }}>
                        <th style={{ textAlign: "left", padding: 8 }}>Proveedor</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Qty</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Costo</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Subtotal</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Pago</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Vence</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Fecha</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Nota</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Cuenta por pagar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movIn.map((m) => (
                        <tr key={m.id} style={{ borderBottom: "1px solid #f2f2f2" }}>
                          <td style={{ padding: 8 }}>{m.supplier ?? "—"}</td>
                          <td style={{ padding: 8 }}>{formatQty(m.qty)}</td>
                          <td style={{ padding: 8 }}>{formatMoney(m.unit_cost)}</td>
                          <td style={{ padding: 8 }}>
                            {m.total_cost !== null && m.total_cost !== undefined && m.total_cost !== ""
                              ? formatMoney(m.total_cost)
                              : Number.isFinite(Number(m.qty)) && Number.isFinite(Number(m.unit_cost))
                                ? (Number(m.qty) * Number(m.unit_cost)).toFixed(2)
                                : "—"}
                          </td>
                          <td style={{ padding: 8 }}>{m.payment_mode ?? "CONTADO"}</td>
                          <td style={{ padding: 8 }}>{m.due_date ?? "—"}</td>
                          <td style={{ padding: 8 }}>{m.created_at ? new Date(m.created_at).toLocaleString() : "—"}</td>
                          <td style={{ padding: 8 }}>{m.note ?? "—"}</td>
                          <td style={{ padding: 8 }}>
                            {m.linked_account_payable_id ? (
                              <Link to="/accounts-payable">Ver cuenta</Link>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
              <h3 style={{ marginTop: 0 }}>Salidas</h3>
              {movOut.length === 0 ? (
                <div style={{ opacity: 0.7 }}>No hay salidas.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #eee" }}>
                        <th style={{ textAlign: "left", padding: 8 }}>Orden</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Qty</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Fecha</th>
                        <th style={{ textAlign: "left", padding: 8 }}>Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movOut.map((m) => (
                        <tr key={m.id} style={{ borderBottom: "1px solid #f2f2f2" }}>
                          <td style={{ padding: 8 }}>{m.order_number ?? (m.work_order_id ?? "—")}</td>
                          <td style={{ padding: 8 }}>{formatQty(m.qty)}</td>
                          <td style={{ padding: 8 }}>{m.created_at ? new Date(m.created_at).toLocaleString() : "—"}</td>
                          <td style={{ padding: 8 }}>{m.note ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Ajustes</h3>
            {movAdjust.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No hay ajustes.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #eee" }}>
                      <th style={{ textAlign: "left", padding: 8 }}>Tipo</th>
                      <th style={{ textAlign: "left", padding: 8 }}>Qty</th>
                      <th style={{ textAlign: "left", padding: 8 }}>Fecha</th>
                      <th style={{ textAlign: "left", padding: 8 }}>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movAdjust.map((m) => (
                      <tr key={m.id} style={{ borderBottom: "1px solid #f2f2f2" }}>
                        <td style={{ padding: 8 }}>{m.type}</td>
                        <td style={{ padding: 8 }}>{formatQty(m.qty)}</td>
                        <td style={{ padding: 8 }}>{m.created_at ? new Date(m.created_at).toLocaleString() : "—"}</td>
                        <td style={{ padding: 8 }}>{m.note ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
