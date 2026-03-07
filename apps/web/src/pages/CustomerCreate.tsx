import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";

type Customer = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
};

function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}


export default function CustomersCreate() {
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const canSubmit = !!name.trim() && isValidEmail(email);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!isValidEmail(email)) {
      setEmailTouched(true);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: cleanName,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      const { data } = await api.post<Customer>("/customers", payload);

      // ✅ tras crear, ir al detalle o volver a lista
      navigate(`/customers/${data.id}`);
      // si aún no tienes detalle, usa: navigate("/customers");
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        err?.message ??
        "No se pudo crear el cliente";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Nuevo cliente</h2>
        <Link to="/customers" className="ui-link-btn">← Volver</Link>
      </div>

      {error && <div className="ui-error">{error}</div>}

      <form
        onSubmit={onSubmit}
        className="ui-panel ui-panel-body"
        style={{ marginTop: 12, display: "grid", gap: 12 }}
      >
        <label className="ui-label">
          <span className="ui-label-text">Nombre *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="ui-control" />
        </label>

        <label className="ui-label">
          <span className="ui-label-text">Teléfono</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="ui-control" />
        </label>

        <label className="ui-label">
          <span className="ui-label-text">Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmailTouched(true)}
            className="ui-control"
            style={{
              border: emailTouched && !isValidEmail(email) ? "1px solid #dc2626" : "1px solid #d0d0d0",
            }}
          />
          {emailTouched && !isValidEmail(email) && (
            <span style={{ color: "#dc2626", fontSize: 12 }}>
              El email no tiene un formato válido.
            </span>
          )}
        </label>

        <label className="ui-label">
          <span className="ui-label-text">Dirección</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="ui-control" />
        </label>

        <label className="ui-label">
          <span className="ui-label-text">Notas</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="ui-control"
          />
        </label>

        <button type="submit" disabled={saving || !canSubmit} className="ui-btn ui-btn-primary">
          {saving ? "Creando..." : "Crear cliente"}
        </button>
      </form>
    </div>
  );
}
