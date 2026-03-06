import { useEffect, useMemo, useState } from "react";
import { createSupplier, listSuppliers, updateSupplier, type Supplier } from "../api/suppliersApi";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [name, setName] = useState("");
  const [suppliesType, setSuppliesType] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const [editing, setEditing] = useState<Supplier | null>(null);
  const [editName, setEditName] = useState("");
  const [editSuppliesType, setEditSuppliesType] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [updating, setUpdating] = useState(false);

  const canCreate = useMemo(() => !!name.trim(), [name]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await listSuppliers({ include_inactive: includeInactive });
      setSuppliers(Array.isArray(res) ? res : []);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "No se pudieron cargar los proveedores");
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [includeInactive]);

  async function submitCreate() {
    if (!canCreate) return;
    setSaving(true);
    setError(null);
    try {
      await createSupplier({
        name: name.trim(),
        supplies_type: suppliesType.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        active: true,
      });
      setName("");
      setSuppliesType("");
      setPhone("");
      setEmail("");
      setAddress("");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "No se pudo crear el proveedor");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setEditName(s.name ?? "");
    setEditSuppliesType(s.supplies_type ?? "");
    setEditPhone(s.phone ?? "");
    setEditEmail(s.email ?? "");
    setEditAddress(s.address ?? "");
    setEditActive(!!s.active);
  }

  function closeEdit() {
    if (updating) return;
    setEditing(null);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editName.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setUpdating(true);
    setError(null);
    try {
      await updateSupplier(editing.id, {
        name: editName.trim(),
        supplies_type: editSuppliesType.trim() || null,
        phone: editPhone.trim() || null,
        email: editEmail.trim() || null,
        address: editAddress.trim() || null,
        active: editActive,
      });
      await load();
      closeEdit();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "No se pudo actualizar el proveedor");
    } finally {
      setUpdating(false);
    }
  }

  async function toggleActive(s: Supplier) {
    setError(null);
    try {
      await updateSupplier(s.id, { active: !s.active });
      setSuppliers((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: !s.active } : x)));
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "No se pudo cambiar el estado");
    }
  }

  return (
    <div style={{ padding: 20, width: "100%" }}>
      <div style={{ marginBottom: 8 }}>
        <a href="/inventory" className="ui-link-btn">← Volver a inventario</a>
      </div>
      <h2>Proveedores</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="ui-btn"
        >
          {showCreate ? "Cerrar" : "Crear proveedor"}
        </button>
        <button type="button" onClick={load} disabled={loading} className="ui-btn">
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

      {showCreate && (
        <div className="ui-panel ui-panel-body" style={{ display: "grid", gap: 8, marginBottom: 16, maxWidth: 720 }}>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
            <input className="ui-control" placeholder="Nombre *" value={name} onChange={(e) => setName(e.target.value)} />
            <input
              className="ui-control"
              placeholder="Tipo de insumos"
              value={suppliesType}
              onChange={(e) => setSuppliesType(e.target.value)}
            />
          </div>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
            <input className="ui-control" placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className="ui-control" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <input className="ui-control" placeholder="Dirección" value={address} onChange={(e) => setAddress(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={submitCreate} disabled={!canCreate || saving} className="ui-btn ui-btn-primary">
              {saving ? "Creando..." : "Guardar proveedor"}
            </button>
          </div>
        </div>
      )}

      {error && <div className="ui-error">{error}</div>}

      {loading ? (
        <div>Cargando proveedores...</div>
      ) : suppliers.length === 0 ? (
        <div style={{ opacity: 0.8 }}>No hay proveedores aún.</div>
      ) : (
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo de insumos</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Dirección</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.supplies_type ?? "-"}</td>
                  <td>{s.phone ?? "-"}</td>
                  <td>{s.email ?? "-"}</td>
                  <td>{s.address ?? "-"}</td>
                  <td>{s.active ? "Activo" : "Inactivo"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => openEdit(s)} className="ui-btn">
                        Editar
                      </button>
                      <button type="button" onClick={() => toggleActive(s)} className="ui-btn">
                        {s.active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div className="ui-panel ui-panel-body" style={{ minWidth: 320, maxWidth: 520, width: "100%" }}>
            <h3 style={{ marginTop: 0 }}>Editar proveedor</h3>
            <div style={{ display: "grid", gap: 8 }}>
              <input className="ui-control" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <input className="ui-control" value={editSuppliesType} onChange={(e) => setEditSuppliesType(e.target.value)} />
              <input className="ui-control" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              <input className="ui-control" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              <input className="ui-control" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                />
                <span>{editActive ? "Activo" : "Inactivo"}</span>
              </label>
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={closeEdit} disabled={updating} className="ui-btn">
                Cancelar
              </button>
              <button type="button" onClick={saveEdit} disabled={updating} className="ui-btn ui-btn-primary">
                {updating ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
