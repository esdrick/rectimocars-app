import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { exportInventoryCsv, importInventoryCsv, listItemsPaged } from "../api/inventoryApi";
import { listSuppliers, type Supplier } from "../api/suppliersApi";

type InventoryItem = {
  id: string;
  code?: string | null;
  name: string;
  category?: string | null;
  active: boolean;
  stock_on_hand: string | number;
  stock_min?: string | number | null;
  totals?: { in_qty: string | number; out_qty: string | number } | null;
};

function formatQty(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(0);
}

function resolveStatus(item: InventoryItem): "OK" | "LOW" | "OUT" {
  const stock = Number(item.stock_on_hand || 0);
  if (stock <= 0) return "OUT";
  if (stock < 10) return "LOW";
  return "OK";
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

export default function Inventory() {
  const navigate = useNavigate();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [appliedIncludeInactive, setAppliedIncludeInactive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stockFilter, setStockFilter] = useState<"ALL" | "OK" | "LOW" | "OUT">("ALL");
  const [appliedStockFilter, setAppliedStockFilter] = useState<"ALL" | "OK" | "LOW" | "OUT">("ALL");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 30;
  const [totalCount, setTotalCount] = useState(0);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [stockOnHand, setStockOnHand] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [active, setActive] = useState(true);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: Array<{ row: number; reason: string }> } | null>(null);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => items, [items]);
  const editingItem = useMemo(
    () => (editingId ? items.find((x) => x.id === editingId) ?? null : null),
    [items, editingId]
  );
  const editHasChanges = useMemo(() => {
    if (!editingItem) return false;
    const originalName = String(editingItem.name ?? "").trim();
    const originalCategory = String(editingItem.category ?? "").trim();
    const nextName = editName.trim();
    const nextCategory = editCategory.trim();
    return (
      nextName !== originalName ||
      nextCategory !== originalCategory ||
      editActive !== Boolean(editingItem.active)
    );
  }, [editingItem, editName, editCategory, editActive]);
  const totalPages = useMemo(() => {
    if (totalCount <= 0) return 1;
    return Math.max(1, Math.ceil(totalCount / pageSize));
  }, [totalCount]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      const res = await listItemsPaged({
        q: appliedQuery || undefined,
        include_inactive: appliedIncludeInactive,
        include_totals: true,
        stock_status: appliedStockFilter === "ALL" ? undefined : appliedStockFilter,
        limit: pageSize,
        offset,
      });
      setItems(Array.isArray(res.items) ? res.items : []);
      setTotalCount(res.total || 0);
      setAppliedStockFilter(stockFilter);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo cargar el inventario";
      setError(String(msg));
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }

  async function loadSuppliers() {
    try {
      const res = await listSuppliers({ include_inactive: false });
      setSuppliers(Array.isArray(res) ? res : []);
    } catch {
      setSuppliers([]);
    }
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const blob = await exportInventoryCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inventario_export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo exportar el inventario";
      setError(String(msg));
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const res = await importInventoryCsv(file);
      setImportResult(res);
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo importar el inventario";
      setError(String(msg));
    } finally {
      setImporting(false);
    }
  }

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    load();
  }, [page, appliedQuery, appliedIncludeInactive, appliedStockFilter]);

  useEffect(() => {
    loadSuppliers();
  }, []);

  function handleReload() {
    setAppliedQuery(query.trim());
    setAppliedIncludeInactive(includeInactive);
    setAppliedStockFilter(stockFilter);
    setPage(1);
  }

  async function createItem() {
    const nameValue = name.trim();
    if (!nameValue) {
      setError("El nombre es obligatorio");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const payload: any = {
        name: nameValue,
        active,
      };
      if (code.trim()) payload.code = code.trim();
      if (category.trim()) payload.category = category.trim();
      if (stockOnHand.trim() !== "") payload.stock_on_hand = Number(stockOnHand);
      const selectedSupplier = suppliers.find((s) => s.id === supplierId);
      if (selectedSupplier?.name) payload.supplier = selectedSupplier.name;
      if (unitCost.trim() !== "") payload.unit_cost = Number(unitCost);
      // stock_min se calcula de forma interna

      await api.post("/inventory/items", payload);
      setCode("");
      setName("");
      setCategory("");
      setStockOnHand("");
      setSupplierId("");
      setUnitCost("");
      setActive(true);
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo crear el item";
      setError(String(msg));
    } finally {
      setCreating(false);
    }
  }


  function openEdit(item: InventoryItem) {
    setEditingId(item.id);
    setEditName(item.name ?? "");
    setEditCategory(item.category ?? "");
    setEditActive(Boolean(item.active));
  }

  function cancelEdit() {
    if (saving) return;
    setEditingId(null);
  }

  async function saveEdit(itemId: string) {
    if (!editName.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    const original = items.find((x) => x.id === itemId);
    if (original) {
      const originalName = String(original.name ?? "").trim();
      const originalCategory = String(original.category ?? "").trim();
      const nextName = editName.trim();
      const nextCategory = editCategory.trim();
      const hasChanges =
        nextName !== originalName ||
        nextCategory !== originalCategory ||
        editActive !== Boolean(original.active);
      if (!hasChanges) return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        name: editName.trim(),
        active: editActive,
      };
      if (editCategory.trim()) payload.category = editCategory.trim();

      await api.patch(`/inventory/items/${itemId}`, payload);
      setEditingId(null);
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo actualizar el item";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  }


  return (
    <div style={{ padding: 20, width: "100%" }}>
      <h2>Inventario</h2>

      <div style={{ display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="Buscar por código, nombre o categoría…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ui-control"
          style={{ minWidth: 240 }}
        />
        <button type="button" onClick={() => setShowCreate(true)} className="ui-btn ui-btn-primary">
          Crear item
        </button>
        <button type="button" onClick={() => navigate("/inventory/summary")} className="ui-btn">
          Resumen general
        </button>
        <button type="button" onClick={() => navigate("/suppliers")} className="ui-btn">
          Proveedores
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button type="button" onClick={handleExport} disabled={exporting} className="ui-btn">
            {exporting ? "Exportando..." : "Exportar"}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="ui-btn"
          >
            {importing ? "Importando..." : "Importar"}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
            if (e.target) e.target.value = "";
          }}
        />
      </div>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Filtrar por stock</span>
          <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value as any)} className="ui-control">
            <option value="ALL">Todos</option>
            <option value="OK">OK</option>
            <option value="LOW">Poco stock</option>
            <option value="OUT">Sin stock</option>
          </select>
        </label>
        <button type="button" onClick={handleReload} disabled={loading} className="ui-btn">
          {loading ? "Cargando..." : "Recargar"}
        </button>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          <span>Incluir inactivos</span>
        </label>
      </div>

      {importResult && (
        <div className="ui-panel ui-panel-body" style={{ marginBottom: 12, background: "#eef2ff" }}>
          Importación completada: {importResult.created} creados, {importResult.skipped} omitidos, {importResult.errors.length} errores
        </div>
      )}

      {showCreate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div className="ui-panel ui-panel-body" style={{ width: "100%", maxWidth: 640, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>Nuevo item</div>
              <button type="button" onClick={() => setShowCreate(false)} className="ui-btn">
                Cerrar
              </button>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <input className="ui-control" placeholder="Nombre *" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="ui-control" placeholder="Categoría (opcional)" value={category} onChange={(e) => setCategory(e.target.value)} />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  className="ui-control"
                  placeholder="Stock actual"
                  type="number"
                  value={stockOnHand}
                  onChange={(e) => setStockOnHand(e.target.value)}
                  style={{ minWidth: 180 }}
                />
                <input
                  className="ui-control"
                  placeholder="Costo unitario (opcional)"
                  type="number"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  style={{ minWidth: 180 }}
                />
              </div>
              <label style={{ display: "grid", gap: 6 }}>
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="ui-control">
                  <option value="">Sin proveedor</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.supplies_type ? ` · ${s.supplies_type}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                <span>Activo</span>
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setShowCreate(false)} disabled={creating} className="ui-btn">
                Cancelar
              </button>
              <button
                type="button"
                onClick={createItem}
                disabled={creating || !name.trim()}
                className="ui-btn ui-btn-primary"
              >
                {creating ? "Creando…" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="ui-error">{error}</div>}

      {loading ? (
        <div>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ opacity: 0.8 }}>No hay items registrados.</div>
      ) : (
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Entradas</th>
                <th>Salidas</th>
                <th>Stock</th>
                <th>Estado</th>
                <th>Estado stock</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id}>
                  <td>
                    {it.code ?? "—"}
                  </td>
                  <td>
                    {editingId === it.id ? (
                      <input className="ui-control" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    ) : (
                      <a href={`/inventory/${it.id}`} style={{ textDecoration: "none", color: "#1f2937" }}>
                        {it.name}
                      </a>
                    )}
                  </td>
                  <td>
                    {editingId === it.id ? (
                      <input className="ui-control" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} />
                    ) : (
                      it.category ?? "—"
                    )}
                  </td>
                  <td>{formatQty(it.totals?.in_qty)}</td>
                  <td>{formatQty(it.totals?.out_qty)}</td>
                  <td>
                    {editingId === it.id ? (
                      <div>
                        <div>{formatQty(it.stock_on_hand)}</div>
                        <div style={{ fontSize: 11, opacity: 0.6 }}>Solo por movimientos</div>
                      </div>
                    ) : (
                      formatQty(it.stock_on_hand)
                    )}
                  </td>
                  <td>
                    {editingId === it.id ? (
                      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={editActive}
                          onChange={(e) => setEditActive(e.target.checked)}
                        />
                        <span>{editActive ? "Activo" : "Inactivo"}</span>
                      </label>
                    ) : (
                      it.active ? "Activo" : "Inactivo"
                    )}
                  </td>
                  <td>
                    {(() => {
                      const s = resolveStatus(it);
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
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          {statusLabel(s)}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    {editingId === it.id ? (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => saveEdit(it.id)}
                          disabled={saving || !editName.trim() || !editHasChanges}
                          className="ui-btn ui-btn-primary"
                        >
                          {saving ? "Guardando…" : "Guardar"}
                        </button>
                        <button type="button" onClick={cancelEdit} disabled={saving} className="ui-btn">
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => openEdit(it)} className="ui-btn">
                          Editar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ opacity: 0.75 }}>
              Página {page} de {totalPages} · {totalCount} items
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="ui-btn"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="ui-btn"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
