

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

// Tipado básico alineado con backend
export type Customer = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  created_at?: string;
};

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await api.get<Customer[]>("/customers");
        if (!mounted) return;
        setCustomers(res.data);
      } catch (e: any) {
        if (!mounted) return;
        const msg =
          e?.response?.data?.detail ??
          e?.message ??
          "No se pudieron cargar los clientes";
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
  }, [api]);

  return (
    <div style={{ padding: 16, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Clientes</h2>
        <Link to="/customers/new" className="ui-link-btn ui-link-btn-primary">+ Nuevo cliente</Link>
      </div>

      {loading && <p>Cargando clientes…</p>}

      {error && <div className="ui-error">{error}</div>}

      {!loading && !error && customers.length === 0 && (
        <p style={{ opacity: 0.7 }}>No hay clientes registrados.</p>
      )}

      {!loading && !error && customers.length > 0 && (
        <div className="ui-table-wrap" style={{ marginTop: 12 }}>
          <table className="ui-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Dirección</th>
                <th>Notas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.phone ?? "—"}</td>
                  <td>{c.email ?? "—"}</td>
                  <td>{c.address ?? "—"}</td>
                  <td
                    style={{ maxWidth: 320 }}
                    title={c.notes ?? ""}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        maxWidth: 320,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        verticalAlign: "bottom",
                      }}
                    >
                      {c.notes ? c.notes : "—"}
                    </span>
                  </td>
                  <td>
                    <Link to={`/customers/${c.id}`} className="ui-link-btn">Ver</Link>
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
