import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";


type EngineModel = {
  id: string;
  label: string;
  active: boolean;
  created_at?: string;
};

export default function EngineModels() {
  const [models, setModels] = useState<EngineModel[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<EngineModel | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => String(m.label ?? "").toLowerCase().includes(q));
  }, [models, query]);

  const editHasChanges = useMemo(() => {
    if (!editing) return false;
    const originalLabel = String(editing.label ?? "").trim();
    return editLabel.trim() !== originalLabel || editActive !== Boolean(editing.active);
  }, [editing, editLabel, editActive]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await api.get("/engine-models/", { params: { include_inactive: true } });
      setModels(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudieron cargar los tipos de motor";
      setError(String(msg));
      setModels([]);
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
      await api.post("/engine-models/", { label });
      setNewLabel("");
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo crear el tipo de motor";
      setError(String(msg));
    } finally {
      setCreating(false);
    }
  }

  function openEdit(m: EngineModel) {
    setEditing(m);
    setEditLabel(m.label ?? "");
    setEditActive(Boolean(m.active));
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
      await api.patch(`/engine-models/${editing.id}`, { label, active: editActive });
      setEditing(null);
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo actualizar el tipo de motor";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(m: EngineModel) {
    setError(null);
    try {
      await api.patch(`/engine-models/${m.id}`, { active: !m.active });
      setModels((prev) => prev.map((x) => (x.id === m.id ? { ...x, active: !m.active } : x)));
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "No se pudo cambiar el estado";
      setError(String(msg));
    }
  }

  return (
    <div style={{ padding: 20, width: "100%" }}>
      <h2>Tipos de motor</h2>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          placeholder="Buscar tipo de motor…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ui-control"
          style={{ minWidth: 240 }}
        />
        <input
          placeholder="Nuevo tipo de motor"
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
        <div style={{ opacity: 0.8 }}>No hay tipos de motor.</div>
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
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td>
                    {editing?.id === m.id ? (
                      <input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="ui-control"
                        style={{ minWidth: 220 }}
                      />
                    ) : (
                      m.label
                    )}
                  </td>
                  <td>
                    {editing?.id === m.id ? (
                      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                        <span>{editActive ? "Activo" : "Inactivo"}</span>
                      </label>
                    ) : (
                      m.active ? "Activo" : "Inactivo"
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {editing?.id === m.id ? (
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
                          <button type="button" onClick={() => openEdit(m)} className="ui-btn">
                            Editar
                          </button>
                          <button type="button" onClick={() => toggleActive(m)} className="ui-btn">
                            {m.active ? "Desactivar" : "Activar"}
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
