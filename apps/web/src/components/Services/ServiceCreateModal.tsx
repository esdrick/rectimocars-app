import { useMemo, useState, useEffect } from "react";

export type ServiceTemplate = { label: string; name: string };

export type ServiceFormPayload = {
  name: string;
  description?: string | null;
  cilindraje?: string | null;
  valvulas?: string | null;
  sellos?: string | null;
  price_td: string;
  price_sc: string;
  active?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: ServiceFormPayload) => Promise<any>;
  templates?: ServiceTemplate[];
  title?: string;
  submitLabel?: string;
  initialValues?: Partial<ServiceFormPayload>;
  showTemplates?: boolean;
};

const CILINDRAJE_OPTIONS = ["4", "6", "8", "NO_APLICA"] as const;
const VALVULAS_OPTIONS = ["8", "12", "16", "24", "NO_APLICA"] as const;
const SELLOS_OPTIONS = ["2", "4", "NO_APLICA"] as const;

function toNumber(value: string): number {
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function formatOption(value: string) {
  return value === "NO_APLICA" ? "No aplica" : value;
}
function formatParamInline(value: string) {
  return value === "NO_APLICA" ? "—" : value;
}

export default function ServiceCreateModal({
  open,
  onClose,
  onSubmit,
  templates = [],
  title = "Nuevo servicio",
  submitLabel = "Crear",
  initialValues,
  showTemplates = true,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cilindraje, setCilindraje] = useState("NO_APLICA");
  const [valvulas, setValvulas] = useState("NO_APLICA");
  const [sellos, setSellos] = useState("NO_APLICA");
  const [priceTd, setPriceTd] = useState("0.00");
  const [priceSc, setPriceSc] = useState("0.00");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState("");

  const canCreate = useMemo(() => {
    if (!name.trim()) return false;
    if (toNumber(priceTd) < 0) return false;
    if (toNumber(priceSc) < 0) return false;
    return true;
  }, [name, priceTd, priceSc]);

  const preview = useMemo(() => {
    const parts = [
      name.trim() || "(sin nombre)",
      `Cil ${formatParamInline(cilindraje)}`,
      `Val ${formatParamInline(valvulas)}`,
      `Sel ${formatParamInline(sellos)}`,
      `TD ${priceTd.replace(",", ".")}`,
      `SC ${priceSc.replace(",", ".")}`,
    ];
    return parts.join(" · ");
  }, [name, cilindraje, valvulas, sellos, priceTd, priceSc]);

  function resetForm(next?: Partial<ServiceFormPayload>) {
    setName(next?.name ?? "");
    setDescription(next?.description ?? "");
    setCilindraje(next?.cilindraje ?? "NO_APLICA");
    setValvulas(next?.valvulas ?? "NO_APLICA");
    setSellos(next?.sellos ?? "NO_APLICA");
    setPriceTd(next?.price_td ?? "0.00");
    setPriceSc(next?.price_sc ?? "0.00");
    setActive(next?.active ?? true);
    setTemplate("");
    setError(null);
  }

  useEffect(() => {
    if (!open) return;
    if (initialValues) {
      resetForm(initialValues);
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit() {
    if (!canCreate) return;
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        cilindraje: cilindraje || "NO_APLICA",
        valvulas: valvulas || "NO_APLICA",
        sellos: sellos || "NO_APLICA",
        price_td: priceTd.replace(",", "."),
        price_sc: priceSc.replace(",", "."),
        active,
      });
      resetForm();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? "No se pudo crear el servicio";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  }

  function applyTemplate(value: string) {
    setTemplate(value);
    const t = templates.find((x) => x.name === value);
    if (t) setName(t.name);
  }

  if (!open) return null;

  function handleClose() {
    if (saving) return;
    resetForm(initialValues);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ui-panel ui-panel-body"
        style={{
          width: "100%",
          maxWidth: 520,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
          <button type="button" onClick={handleClose} disabled={saving} className="ui-btn">
            Cerrar
          </button>
        </div>

        <div style={{ fontSize: 12, opacity: 0.75 }}>
          <b>Vista previa:</b> {preview}
        </div>

        {showTemplates && templates.length > 0 && (
          <label className="ui-label">
            <span className="ui-label-text">Plantillas (opcional)</span>
            <select value={template} onChange={(e) => applyTemplate(e.target.value)} className="ui-control">
              <option value="">Selecciona…</option>
              {templates.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="ui-label">
          <span className="ui-label-text">Nombre *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="ui-control" />
        </label>

        <label className="ui-label">
          <span className="ui-label-text">Descripción</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="ui-control" />
        </label>

        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
          Parámetros de la variante
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label className="ui-label" style={{ flex: "1 1 140px" }}>
            <span className="ui-label-text">Cilindraje (si aplica)</span>
            <select value={cilindraje} onChange={(e) => setCilindraje(e.target.value)} className="ui-control">
              {CILINDRAJE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {formatOption(opt)}
                </option>
              ))}
            </select>
          </label>

          <label className="ui-label" style={{ flex: "1 1 140px" }}>
            <span className="ui-label-text">Válvulas (si aplica)</span>
            <select value={valvulas} onChange={(e) => setValvulas(e.target.value)} className="ui-control">
              {VALVULAS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {formatOption(opt)}
                </option>
              ))}
            </select>
          </label>

          <label className="ui-label" style={{ flex: "1 1 140px" }}>
            <span className="ui-label-text">Sellos (si aplica)</span>
            <select value={sellos} onChange={(e) => setSellos(e.target.value)} className="ui-control">
              {SELLOS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {formatOption(opt)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label className="ui-label" style={{ flex: "1 1 160px" }}>
            <span className="ui-label-text">Precio TD *</span>
            <input inputMode="decimal" value={priceTd} onChange={(e) => setPriceTd(e.target.value)} className="ui-control" />
          </label>

          <label className="ui-label" style={{ flex: "1 1 160px" }}>
            <span className="ui-label-text">Precio SC *</span>
            <input inputMode="decimal" value={priceSc} onChange={(e) => setPriceSc(e.target.value)} className="ui-control" />
          </label>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Activo
        </label>

        {error && <div className="ui-error">{error}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={handleClose} disabled={saving} className="ui-btn">
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} disabled={!canCreate || saving} className="ui-btn ui-btn-primary">
            {saving ? "Guardando…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
