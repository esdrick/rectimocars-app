import { useEffect, useMemo, useState } from "react";
import {
  addConsumable,
  deleteConsumable,
  listConsumables,
  listItems,
  updateConsumable,
  type Consumable,
  type InventoryItem,
} from "../../api/inventoryApi";

type Props = {
  orderId?: string | null;
  title: string;
  emptyMessage?: string;
  containerStyle?: React.CSSProperties;
};

export default function ConsumablesSection({
  orderId,
  title,
  emptyMessage = "Primero crea la orden para poder agregar insumos.",
  containerStyle,
}: Props) {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [consumablesLoading, setConsumablesLoading] = useState(false);
  const [consumablesError, setConsumablesError] = useState<string | null>(null);

  const [consumableSearch, setConsumableSearch] = useState("");
  const [showConsumableForm, setShowConsumableForm] = useState(false);
  const [selectedConsumableId, setSelectedConsumableId] = useState("");
  const [consumableQty, setConsumableQty] = useState(1);
  const [addingConsumable, setAddingConsumable] = useState(false);
  const [consumableStockError, setConsumableStockError] = useState<string | null>(null);
  const [editingConsumableId, setEditingConsumableId] = useState<string | null>(null);
  const [editingConsumableQty, setEditingConsumableQty] = useState("");
  const [savingConsumable, setSavingConsumable] = useState(false);
  const [deletingConsumableId, setDeletingConsumableId] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    let mounted = true;

    (async () => {
      try {
        setInventoryLoading(true);
        setInventoryError(null);
        const list = await listItems({ include_inactive: false });
        if (!mounted) return;
        setInventoryItems(Array.isArray(list) ? list : []);
      } catch (e: any) {
        if (!mounted) return;
        const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo cargar el inventario";
        setInventoryError(String(msg));
        setInventoryItems([]);
      } finally {
        if (!mounted) return;
        setInventoryLoading(false);
      }

      try {
        setConsumablesLoading(true);
        setConsumablesError(null);
        const list = await listConsumables(orderId);
        if (!mounted) return;
        setConsumables(Array.isArray(list) ? list : []);
      } catch (e: any) {
        if (!mounted) return;
        const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudieron cargar los insumos";
        setConsumablesError(String(msg));
        setConsumables([]);
      } finally {
        if (!mounted) return;
        setConsumablesLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [orderId]);

  async function addConsumableToOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId) return;
    if (!selectedConsumableId) {
      setConsumableStockError("Selecciona un insumo.");
      return;
    }
    const stock = Number(
      inventoryItems.find((it) => it.id === selectedConsumableId)?.stock_on_hand ?? 0
    );
    if (!Number.isFinite(stock) || stock <= 0) {
      setConsumableStockError("Stock insuficiente. Disponible: 0.00");
      return;
    }
    if (!Number.isFinite(consumableQty) || consumableQty <= 0) {
      setConsumableStockError("La cantidad debe ser mayor a 0.");
      return;
    }

    setAddingConsumable(true);
    setConsumableStockError(null);
    try {
      await addConsumable(orderId, { item_id: selectedConsumableId, qty: consumableQty });
      setSelectedConsumableId("");
      setConsumableQty(1);
      const list = await listConsumables(orderId);
      setConsumables(Array.isArray(list) ? list : []);
      const inv = await listItems({ include_inactive: false });
      setInventoryItems(Array.isArray(inv) ? inv : []);
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.message ?? "No se pudo agregar el insumo";
      setConsumableStockError(String(detail));
    } finally {
      setAddingConsumable(false);
    }
  }

  const filteredInventoryItems = useMemo(() => {
    const q = consumableSearch.trim().toLowerCase();
    if (!q) return inventoryItems;
    return inventoryItems.filter((it) => {
      const hay = [it.code, it.name].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [inventoryItems, consumableSearch]);

  function openEditConsumable(c: Consumable) {
    setEditingConsumableId(c.item_id);
    setEditingConsumableQty(String(c.qty ?? ""));
  }

  function cancelEditConsumable() {
    if (savingConsumable) return;
    setEditingConsumableId(null);
    setEditingConsumableQty("");
  }

  async function saveConsumableQty(itemId: string) {
    if (!orderId) return;
    const nextQty = Number(editingConsumableQty);
    if (!Number.isFinite(nextQty) || nextQty <= 0) {
      setConsumableStockError("La cantidad debe ser mayor a 0.");
      return;
    }
    const current = consumables.find((c) => c.item_id === itemId);
    const stock = inventoryItems.find((it) => it.id === itemId)?.stock_on_hand;
    const available = Number(stock || 0) + Number(current?.qty || 0);
    if (Number.isFinite(available) && nextQty > available) {
      setConsumableStockError(`Stock insuficiente. Disponible: ${available.toFixed(2)}`);
      return;
    }
    setSavingConsumable(true);
    setConsumableStockError(null);
    try {
      await updateConsumable(orderId, itemId, { qty: nextQty });
      const list = await listConsumables(orderId);
      setConsumables(Array.isArray(list) ? list : []);
      const inv = await listItems({ include_inactive: false });
      setInventoryItems(Array.isArray(inv) ? inv : []);
      setEditingConsumableId(null);
      setEditingConsumableQty("");
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.message ?? "No se pudo actualizar el insumo";
      setConsumableStockError(String(detail));
    } finally {
      setSavingConsumable(false);
    }
  }

  async function removeConsumable(itemId: string) {
    if (!orderId) return;
    setDeletingConsumableId(itemId);
    setConsumableStockError(null);
    try {
      await deleteConsumable(orderId, itemId);
      const list = await listConsumables(orderId);
      setConsumables(Array.isArray(list) ? list : []);
      const inv = await listItems({ include_inactive: false });
      setInventoryItems(Array.isArray(inv) ? inv : []);
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.message ?? "No se pudo eliminar el insumo";
      setConsumableStockError(String(detail));
    } finally {
      setDeletingConsumableId(null);
    }
  }

  const wrapperStyle: React.CSSProperties =
    containerStyle ?? {
      marginTop: 16,
      padding: 16,
      border: "1px solid rgba(0,0,0,0.12)",
      borderRadius: 10,
    };

  return (
    <div style={wrapperStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h3 style={{ marginTop: 0, marginBottom: 0 }}>{title}</h3>
        {orderId && (
          <button
            type="button"
            onClick={() => {
              setShowConsumableForm((v) => {
                const next = !v;
                if (!next) {
                  setConsumableStockError(null);
                }
                return next;
              });
            }}
            className="ui-btn"
          >
            {showConsumableForm ? "Cerrar" : "Agregar insumo"}
          </button>
        )}
      </div>

      {!orderId ? (
        <p style={{ opacity: 0.75 }}>{emptyMessage}</p>
      ) : (
        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {showConsumableForm && (
            <div className="ui-panel ui-panel-body">
              {inventoryLoading ? (
                <div style={{ opacity: 0.75 }}>Cargando inventario…</div>
              ) : inventoryError ? (
                <div className="ui-error">{inventoryError}</div>
              ) : inventoryItems.length === 0 ? (
                <div style={{ opacity: 0.75 }}>No hay items disponibles.</div>
              ) : (
                <form onSubmit={addConsumableToOrder} style={{ display: "grid", gap: 10 }}>
                  <label className="ui-label">
                    <span className="ui-label-text">Buscar</span>
                    <input
                      placeholder="Buscar por código o nombre…"
                      value={consumableSearch}
                      onChange={(e) => setConsumableSearch(e.target.value)}
                      className="ui-control"
                    />
                  </label>
                  <label className="ui-label">
                    <span className="ui-label-text">Producto *</span>
                    <select value={selectedConsumableId} onChange={(e) => setSelectedConsumableId(e.target.value)} className="ui-control">
                      <option value="">— Selecciona —</option>
                      {filteredInventoryItems.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.code ? `${it.code} · ` : ""}{it.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedConsumableId && (() => {
                    const item = inventoryItems.find((it) => it.id === selectedConsumableId);
                    const stock = Number(item?.stock_on_hand || 0);
                    return (
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Stock disponible: <b>{Number.isFinite(stock) ? stock.toFixed(0) : "—"}</b>
                      </div>
                    );
                  })()}

                  <label className="ui-label">
                    <span className="ui-label-text">Cantidad</span>
                    <input
                      type="number"
                      min={1}
                      value={consumableQty}
                      onChange={(e) => setConsumableQty(Number(e.target.value))}
                      className="ui-control"
                    />
                  </label>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="submit"
                      disabled={
                        addingConsumable ||
                        Number(
                          inventoryItems.find((it) => it.id === selectedConsumableId)?.stock_on_hand ?? 0
                        ) <= 0
                      }
                      className="ui-btn ui-btn-primary"
                    >
                      {addingConsumable ? "Guardando…" : "Guardar"}
                    </button>
                  </div>
                </form>
              )}

              {consumableStockError && (
                <div className="ui-error" style={{ marginTop: 10 }}>
                  {consumableStockError}
                </div>
              )}
            </div>
          )}

          {consumablesLoading ? (
            <div style={{ marginTop: 10, opacity: 0.75 }}>Cargando insumos…</div>
          ) : consumablesError ? (
            <div className="ui-error" style={{ marginTop: 10 }}>{consumablesError}</div>
          ) : consumables.length === 0 ? (
            <div style={{ marginTop: 10, opacity: 0.75 }}>Aún no hay insumos registrados.</div>
          ) : (
            <div className="ui-table-wrap" style={{ marginTop: 10 }}>
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {consumables.map((c) => (
                    <tr key={c.item_id}>
                      <td>
                        {c.item_name ?? c.item_code ?? c.item_id}
                      </td>
                      <td>
                        {editingConsumableId === c.item_id ? (
                          <input
                            type="number"
                            min={1}
                            value={editingConsumableQty}
                            onChange={(e) => setEditingConsumableQty(e.target.value)}
                            className="ui-control"
                            style={{ width: 90 }}
                          />
                        ) : (
                          c.qty
                        )}
                      </td>
                      <td>
                        {editingConsumableId === c.item_id ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => saveConsumableQty(c.item_id)}
                              disabled={savingConsumable}
                              className="ui-btn ui-btn-primary"
                            >
                              {savingConsumable ? "Guardando…" : "Guardar"}
                            </button>
                            <button type="button" onClick={cancelEditConsumable} disabled={savingConsumable} className="ui-btn">
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => removeConsumable(c.item_id)}
                              disabled={deletingConsumableId === c.item_id || savingConsumable}
                              className="ui-btn"
                            >
                              {deletingConsumableId === c.item_id ? "Eliminando…" : "Eliminar"}
                            </button>
                            <div style={{ fontSize: 12, opacity: 0.7, alignSelf: "center" }}>
                              Stock disponible:{" "}
                              {(() => {
                                const item = inventoryItems.find((it) => it.id === c.item_id);
                                const stock = Number(item?.stock_on_hand || 0);
                                return Number.isFinite(stock) ? stock.toFixed(0) : "—";
                              })()}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" onClick={() => openEditConsumable(c)} className="ui-btn">
                              Editar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
