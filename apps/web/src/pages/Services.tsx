import { useEffect, useMemo, useState } from "react";
import { listServices, createService } from "../api/services";
import { api } from "../api/client";
import ServiceCreateModal from "../components/Services/ServiceCreateModal";


type Service = {
  id: string;
  name: string;
  description?: string | null;
  cilindraje?: string | null;
  valvulas?: string | null;
  sellos?: string | null;
  price_td: string | number;
  price_sc: string | number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

function toNumber(value: string): number {
  // Accept "", "0", "0.00", etc.
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(v: any): string {
  const n = toNumber(String(v ?? 0));
  return n.toFixed(2);
}

const SERVICE_TEMPLATES: { label: string; name: string }[] = [
  { label: "Rectificar cilindros", name: "Rectificar cilindros" },
  { label: "Bruñido / Honeado cilindros", name: "Bruñido / Honeado cilindros" },
  { label: "Asentar válvulas", name: "Asentar válvulas" },
  { label: "Cambiar guías de válvula", name: "Cambiar guías de válvula" },
  { label: "Cambiar sellos de válvula", name: "Cambiar sellos de válvula" },
  { label: "Rectificar / Planear tapa", name: "Rectificar / Planear tapa" },
  { label: "Rectificar cigüeñal", name: "Rectificar cigüeñal" },
  { label: "Rectificar bielas", name: "Rectificar bielas" },
  { label: "Rectificar bancada", name: "Rectificar bancada" },
  { label: "Revisión / Diagnóstico", name: "Revisión / Diagnóstico" },
  { label: "Armado / Desarmado", name: "Armado / Desarmado" },
  { label: "Limpieza química", name: "Limpieza química" },
];

function formatOption(value: string) {
  return value === "NO_APLICA" ? "No aplica" : value;
}

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceQuery, setServiceQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editService, setEditService] = useState<Service | null>(null);
  const [updating, setUpdating] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => {
      const name = (s.name ?? "").toLowerCase();
      const desc = (s.description ?? "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [services, serviceQuery]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const data = await listServices();
      // Be defensive: ensure it's an array
      setServices(Array.isArray(data) ? (data as Service[]) : []);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        err?.message ??
        "No se pudieron cargar los servicios";
      setError(String(msg));
      setServices([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(payload: any) {
    await createService(payload);
    await load();
  }

  function openEdit(s: Service) {
    setEditService(s);
    setEditOpen(true);
  }

  function closeEdit() {
    if (updating) return;
    setEditOpen(false);
    setEditService(null);
  }

  async function saveEdit(payload: any) {
    if (!editService) return;
    setUpdating(true);
    setError(null);
    try {
      await api.patch(`/services/${editService.id}`, payload);
      await load();
      closeEdit();
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? "No se pudo actualizar el servicio";
      setError(String(msg));
    } finally {
      setUpdating(false);
    }
  }

  async function toggleActive(s: Service) {
    setError(null);
    try {
      await api.patch(`/services/${s.id}`, { active: !s.active });
      setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: !s.active } : x)));
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? "No se pudo cambiar el estado del servicio";
      setError(String(msg));
    }
  }

  return (
    <div style={{ padding: 20, width: "100%" }}>
      <h2>Servicios</h2>

      {/* Crear servicio */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          placeholder="Buscar servicio…"
          value={serviceQuery}
          onChange={(e) => setServiceQuery(e.target.value)}
          className="ui-control"
          style={{ minWidth: 240 }}
        />
        <button type="button" onClick={() => setCreateOpen(true)} className="ui-btn ui-btn-primary">
          + Nuevo servicio
        </button>
        <button type="button" onClick={load} disabled={loading} className="ui-btn">
          {loading ? "Cargando..." : "Recargar"}
        </button>
      </div>

      {error && <div className="ui-error">{error}</div>}

      {/* Tabla de servicios */}
        {loading ? (
          <div>Cargando servicios...</div>
        ) : filteredServices.length === 0 ? (
          <div style={{ opacity: 0.8 }}>
            {serviceQuery.trim()
              ? "No se encontraron servicios con ese criterio."
              : "No hay servicios aún."}
          </div>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Cilindraje</th>
                  <th>Válvulas</th>
                  <th>Sellos</th>
                  <th>Precio TD ($)</th>
                  <th>Precio SC ($)</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td style={{ maxWidth: 320 }} title={s.description ?? ""}>
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
                        {s.description ? s.description : "-"}
                      </span>
                    </td>
                    <td>{formatOption(String(s.cilindraje ?? "NO_APLICA"))}</td>
                    <td>{formatOption(String(s.valvulas ?? "NO_APLICA"))}</td>
                    <td>{formatOption(String(s.sellos ?? "NO_APLICA"))}</td>
                    <td>{fmtMoney(s.price_td)}</td>
                    <td>{fmtMoney(s.price_sc)}</td>
                    <td>{s.active ? "Activo" : "Inactivo"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => openEdit(s)} className="ui-btn">
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(s)}
                          className="ui-btn"
                        >
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

      <ServiceCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        templates={SERVICE_TEMPLATES}
      />

      <ServiceCreateModal
        open={editOpen}
        onClose={closeEdit}
        onSubmit={saveEdit}
        title="Editar servicio"
        submitLabel="Guardar cambios"
        initialValues={
          editService
            ? {
                name: editService.name ?? "",
                description: editService.description ?? "",
                cilindraje: String(editService.cilindraje ?? "NO_APLICA"),
                valvulas: String(editService.valvulas ?? "NO_APLICA"),
                sellos: String(editService.sellos ?? "NO_APLICA"),
                price_td: fmtMoney(editService.price_td),
                price_sc: fmtMoney(editService.price_sc),
                active: !!editService.active,
              }
            : undefined
        }
        showTemplates={false}
      />

    </div>
  );
}
