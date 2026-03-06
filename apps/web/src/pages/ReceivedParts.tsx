import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";


type ReceivedPart = {
  id: string;
  label: string;
  active: boolean;
  created_at?: string;
};

export default function ReceivedParts() {
  const [parts, setParts] = useState<ReceivedPart[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<ReceivedPart | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parts;
    return parts.filter((p) => String(p.label ?? "").toLowerCase().includes(q));
  }, [parts, query]);

  const editHasChanges = useMemo(() => {
    if (!editing) return false;
    const originalLabel = String(editing.label ?? "").trim();
    return editLabel.trim() !== originalLabel || editActive !== Boolean(editing.active);
  }, [editing, editLabel, editActive]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await api.get("/received-parts/", { params: { include_inactive: true } });
      setParts(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudieron cargar las piezas";
      setError(String(msg));
      setParts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    const label = newLabel.trim();
    if (!label) {
      setError("El nombre es obligatorio");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await api.post("/received-parts/", { label });
      setNewLabel("");
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo crear la pieza";
      setError(String(msg));
    } finally {
      setCreating(false);
    }
  }

  function openEdit(p: ReceivedPart) {
    setEditing(p);
    setEditLabel(p.label ?? "");
    setEditActive(Boolean(p.active));
  }

  function cancelEdit() {
    if (saving) return;
    setEditing(null);
  }

  async function saveEdit() {
    if (!editing) return;
    const label = editLabel.trim();
    if (!label) {
      setError("El nombre es obligatorio");
      return;
    }
    const originalLabel = String(editing.label ?? "").trim();
    const hasChanges = label !== originalLabel || editActive !== Boolean(editing.active);
    if (!hasChanges) return;

    setSaving(true);
    setError(null);
    try {
      await api.patch(`/received-parts/${editing.id}`, { label, active: editActive });
      setEditing(null);
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo actualizar la pieza";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: ReceivedPart) {
    setError(null);
    try {
      await api.patch(`/received-parts/${p.id}`, { active: !p.active });
      setParts((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: !p.active } : x)));
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo cambiar el estado";
      setError(String(msg));
    }
  }

  return (
    <div style={{ padding: 20, width: "100%" }}>
      <h2>Piezas recibidas</h2>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          placeholder="Buscar pieza…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ui-control"
          style={{ minWidth: 240 }}
        />
        <input
          placeholder="Nueva pieza recibida"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className="ui-control"
          style={{ minWidth: 240 }}
        />
        <button
          type="button"
          onClick={create}
          disabled={creating || !newLabel.trim()}
          className="ui-btn ui-btn-primary"
        >
          {creating ? "Creando…" : "Crear"}
        </button>
        <button type="button" onClick={load} disabled={loading} className="ui-btn">
          {loading ? "Cargando..." : "Recargar"}
        </button>
      </div>

      {error && <div className="ui-error">{error}</div>}

      {loading ? (
        <div>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ opacity: 0.8 }}>No hay piezas registradas.</div>
      ) : (
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    {editing?.id === p.id ? (
                      <input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="ui-control"
                        style={{ minWidth: 220 }}
                      />
                    ) : (
                      p.label
                    )}
                  </td>
                  <td>
                    {editing?.id === p.id ? (
                      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                        <span>{editActive ? "Activo" : "Inactivo"}</span>
                      </label>
                    ) : (
                      p.active ? "Activo" : "Inactivo"
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {editing?.id === p.id ? (
                        <>
                          <button
                            type="button"
                            onClick={saveEdit}
                            disabled={saving || !editLabel.trim() || !editHasChanges}
                            className="ui-btn ui-btn-primary"
                          >
                            {saving ? "Guardando…" : "Guardar"}
                          </button>
                          <button type="button" onClick={cancelEdit} disabled={saving} className="ui-btn">
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => openEdit(p)} className="ui-btn">
                            Editar
                          </button>
                          <button type="button" onClick={() => toggleActive(p)} className="ui-btn">
                            {p.active ? "Desactivar" : "Activar"}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
