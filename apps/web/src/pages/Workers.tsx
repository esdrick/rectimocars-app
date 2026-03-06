import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

type Worker = {
  id: string;
  name: string;
  phone?: string | null;
  job_role?: string | null;
  active: boolean;
  created_at?: string;
};

function normalizePhone(v: string) {
  return v.trim();
}

export default function Workers() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobRole, setJobRole] = useState("");

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editWorker, setEditWorker] = useState<Worker | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editJobRole, setEditJobRole] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [updating, setUpdating] = useState(false);

  const canCreate = useMemo(() => {
    return !!name.trim();
  }, [name]);

  const editHasChanges = useMemo(() => {
    if (!editWorker) return false;
    const originalName = String(editWorker.name ?? "").trim();
    const originalPhone = String(editWorker.phone ?? "").trim();
    const originalJobRole = String(editWorker.job_role ?? "").trim();
    const nextName = editName.trim();
    const nextPhone = editPhone.trim();
    const nextJobRole = editJobRole.trim();
    return (
      nextName !== originalName ||
      nextPhone !== originalPhone ||
      nextJobRole !== originalJobRole ||
      editActive !== Boolean(editWorker.active)
    );
  }, [editWorker, editName, editPhone, editJobRole, editActive]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Worker[]>("/workers/");
      setWorkers(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "No se pudieron cargar los empleados");
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createWorker() {
    if (!canCreate) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/workers/", {
        name: name.trim(),
        phone: phone.trim() ? normalizePhone(phone) : null,
        job_role: jobRole.trim() ? jobRole.trim() : null,
        active: true,
      });
      setName("");
      setPhone("");
      setJobRole("");
      setShowCreate(false);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "No se pudo crear el empleado");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(w: Worker) {
    setEditWorker(w);
    setEditName(w.name ?? "");
    setEditPhone(String(w.phone ?? ""));
    setEditJobRole(String(w.job_role ?? ""));
    setEditActive(!!w.active);
    setEditOpen(true);
  }

  function closeEdit() {
    if (updating) return;
    setEditOpen(false);
    setEditWorker(null);
  }

  async function saveEdit() {
    if (!editWorker) return;
    const nextName = editName.trim();
    const nextPhone = editPhone.trim();
    const nextJobRole = editJobRole.trim();
    if (!nextName) {
      setError("El nombre es obligatorio");
      return;
    }
    if (!editHasChanges) return;
    setUpdating(true);
    setError(null);
    try {
      await api.patch(`/workers/${editWorker.id}`, {
        name: nextName,
        phone: nextPhone ? normalizePhone(nextPhone) : null,
        job_role: nextJobRole ? nextJobRole : null,
        active: !!editActive,
      });
      await load();
      closeEdit();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "No se pudo actualizar el empleado");
    } finally {
      setUpdating(false);
    }
  }

  async function toggleActive(w: Worker) {
    setError(null);
    try {
      await api.patch(`/workers/${w.id}`, { active: !w.active });
      setWorkers((prev) => prev.map((x) => (x.id === w.id ? { ...x, active: !w.active } : x)));
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "No se pudo cambiar el estado");
    }
  }

  return (
    <div style={{ padding: 20, width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Empleados</h2>
        <div className="ui-section-actions">
          <button type="button" onClick={() => setShowCreate((v) => !v)} className="ui-btn">
            {showCreate ? "Cerrar formulario" : "Registrar empleado"}
          </button>
          <button type="button" onClick={load} disabled={loading} className="ui-btn">
            {loading ? "Cargando..." : "Recargar"}
          </button>
        </div>
      </div>

      {/* Crear */}
      {showCreate && (
        <div className="ui-panel ui-panel-body" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <input
            placeholder="Nombre *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="ui-control"
            style={{ minWidth: 220 }}
          />
          <input
            placeholder="Teléfono (opcional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="ui-control"
            style={{ minWidth: 200 }}
          />
          <input
            placeholder="Rol (opcional) — ej: Mecánico"
            value={jobRole}
            onChange={(e) => setJobRole(e.target.value)}
            className="ui-control"
            style={{ minWidth: 220 }}
          />
          <button type="button" onClick={createWorker} disabled={!canCreate || saving} className="ui-btn ui-btn-primary">
            {saving ? "Creando..." : "Crear"}
          </button>
        </div>
      )}

      {error && <div className="ui-error">{error}</div>}

      {/* Lista */}
      {loading ? (
        <div>Cargando empleados...</div>
      ) : workers.length === 0 ? (
        <div style={{ opacity: 0.8 }}>No hay empleados aún.</div>
      ) : (
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id}>
                  <td>{w.name}</td>
                  <td>{w.phone ?? "-"}</td>
                  <td>{w.job_role ?? "-"}</td>
                  <td>{w.active ? "Activo" : "Inactivo"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => openEdit(w)} className="ui-btn">
                        Editar
                      </button>
                      <button type="button" onClick={() => toggleActive(w)} className="ui-btn">
                        {w.active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal editar */}
      {editOpen && editWorker && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={closeEdit}
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
              width: "min(560px, 100%)",
              background: "white",
              borderRadius: 12,
              padding: 16,
              border: "1px solid rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Editar empleado</div>
                <div style={{ fontSize: 16 }}>
                  <b>{editWorker.name}</b>
                </div>
              </div>
              <button type="button" onClick={closeEdit} disabled={updating} className="ui-btn">
                Cerrar
              </button>
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              <label className="ui-label">
                <span className="ui-label-text">Nombre</span>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="ui-control" />
              </label>

              <label className="ui-label">
                <span className="ui-label-text">Teléfono</span>
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="ui-control" />
              </label>

              <label className="ui-label">
                <span className="ui-label-text">Rol</span>
                <input value={editJobRole} onChange={(e) => setEditJobRole(e.target.value)} className="ui-control" />
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                <span style={{ fontSize: 13 }}>Empleado activo</span>
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={closeEdit} disabled={updating} className="ui-btn">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={updating || !editName.trim() || !editHasChanges}
                  className="ui-btn ui-btn-primary"
                >
                  {updating ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
