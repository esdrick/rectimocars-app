import { Link } from "react-router-dom";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  accountPayableExpenseTypeOptions,
  createAccountPayable,
  listAccountsPayable,
  markAccountPayablePaid,
  markAccountPayableUnpaid,
  type AccountPayable,
  type AccountPayableExpenseType,
  updateAccountPayable,
} from "../api/accountsPayable";

function money(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function shortDate(value?: string | null) {
  if (!value) return "—";
  return String(value).slice(0, 10);
}

function dateTime(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

function statusColor(status: string) {
  const normalized = String(status).toUpperCase();
  if (normalized === "VENCIDO") return { background: "#fce7e7", color: "#991b1b", border: "#fecaca" };
  if (normalized === "POR_VENCER") return { background: "#fff4db", color: "#9a6700", border: "#f3d19c" };
  return { background: "#e6f6eb", color: "#166534", border: "#b7e2c3" };
}

type FormState = {
  description: string;
  expense_type: AccountPayableExpenseType;
  amount: string;
  due_date: string;
  notes: string;
};

const initialForm: FormState = {
  description: "",
  expense_type: "SERVICIOS",
  amount: "",
  due_date: "",
  notes: "",
};

export default function AccountsPayable() {
  const [rows, setRows] = useState<AccountPayable[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(initialForm);
  const [editing, setEditing] = useState<AccountPayable | null>(null);
  const [editForm, setEditForm] = useState<FormState>(initialForm);

  const [statusFilter, setStatusFilter] = useState("");
  const [paidFilter, setPaidFilter] = useState("");
  const [expenseTypeFilter, setExpenseTypeFilter] = useState("");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const amount = Number(row.amount || 0);
        if (row.paid) acc.paid += amount;
        else acc.pending += amount;
        if (String(row.status).toUpperCase() === "VENCIDO" && !row.paid) acc.overdue += amount;
        return acc;
      },
      { paid: 0, pending: 0, overdue: 0 }
    );
  }, [rows]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const paid =
        paidFilter === "true" ? true : paidFilter === "false" ? false : undefined;
      const data = await listAccountsPayable({
        paid,
        status: (statusFilter || undefined) as "vigente" | "por_vencer" | "vencido" | undefined,
        expense_type: expenseTypeFilter || undefined,
        q: appliedQuery || undefined,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? "No se pudo cargar cuentas por pagar.";
      setError(String(msg));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter, paidFilter, expenseTypeFilter, appliedQuery]);

  function updateForm(
    setter: Dispatch<SetStateAction<FormState>>,
    key: keyof FormState,
    value: string
  ) {
    setter((current) => ({ ...current, [key]: value }));
  }

  async function submitCreate() {
    if (!createForm.description.trim() || !createForm.amount.trim() || !createForm.due_date) {
      setError("Descripción, monto y vencimiento son obligatorios.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAccountPayable({
        description: createForm.description.trim(),
        expense_type: createForm.expense_type,
        amount: createForm.amount,
        due_date: createForm.due_date,
        notes: createForm.notes.trim() || undefined,
      });
      setCreateForm(initialForm);
      setShowCreate(false);
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? "No se pudo crear la cuenta por pagar.";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(row: AccountPayable) {
    setEditing(row);
    setEditForm({
      description: row.description,
      expense_type: row.expense_type as AccountPayableExpenseType,
      amount: String(row.amount ?? ""),
      due_date: shortDate(row.due_date),
      notes: row.notes ?? "",
    });
  }

  async function submitEdit() {
    if (!editing) return;
    if (!editForm.description.trim() || !editForm.amount.trim() || !editForm.due_date) {
      setError("Descripción, monto y vencimiento son obligatorios.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateAccountPayable(editing.id, {
        description: editForm.description.trim(),
        expense_type: editForm.expense_type,
        amount: editForm.amount,
        due_date: editForm.due_date,
        notes: editForm.notes.trim() || undefined,
      });
      setEditing(null);
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? "No se pudo actualizar la cuenta por pagar.";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  }

  async function togglePaid(row: AccountPayable) {
    setSaving(true);
    setError(null);
    try {
      if (row.paid) await markAccountPayableUnpaid(row.id);
      else await markAccountPayablePaid(row.id);
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? "No se pudo actualizar el estado de pago.";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  }

  const formBlock = (
    form: FormState,
    setter: Dispatch<SetStateAction<FormState>>,
    action: () => Promise<void>,
    submitLabel: string
  ) => (
    <div className="ui-panel ui-panel-body" style={{ display: "grid", gap: 12 }}>
      <div className="ui-label">
        <span className="ui-label-text">Descripción</span>
        <input
          value={form.description}
          onChange={(e) => updateForm(setter, "description", e.target.value)}
          className="ui-control"
          placeholder="Ej. alquiler local de marzo"
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <label className="ui-label">
          <span className="ui-label-text">Tipo de gasto</span>
          <select
            value={form.expense_type}
            onChange={(e) => updateForm(setter, "expense_type", e.target.value)}
            className="ui-control"
          >
            {accountPayableExpenseTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ui-label">
          <span className="ui-label-text">Monto</span>
          <input
            value={form.amount}
            onChange={(e) => updateForm(setter, "amount", e.target.value)}
            className="ui-control"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
          />
        </label>
        <label className="ui-label">
          <span className="ui-label-text">Fecha de vencimiento</span>
          <input
            value={form.due_date}
            onChange={(e) => updateForm(setter, "due_date", e.target.value)}
            className="ui-control"
            type="date"
          />
        </label>
      </div>
      <div className="ui-label">
        <span className="ui-label-text">Notas</span>
        <textarea
          value={form.notes}
          onChange={(e) => updateForm(setter, "notes", e.target.value)}
          className="ui-control"
          style={{ minHeight: 90, resize: "vertical" }}
          placeholder="Opcional"
        />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button
          type="button"
          onClick={action}
          disabled={saving}
          className="ui-btn"
        >
          {saving ? "Guardando..." : submitLabel}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Cuentas por pagar</h2>
          <div style={{ opacity: 0.8 }}>Seguimiento de egresos pendientes y pagos realizados.</div>
          <div style={{ marginTop: 6 }}>
            <Link to="/reports/cashflow" className="ui-link-btn">Ver flujo de caja</Link>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((current) => !current)}
          className="ui-btn"
        >
          {showCreate ? "Cerrar formulario" : "Agregar cuenta por pagar"}
        </button>
      </div>

      <div className="ui-metric-grid" style={{ marginTop: 16 }}>
        <div className="ui-metric-card">
          <div className="ui-metric-label">Pendiente</div>
          <div className="ui-metric-value">{money(totals.pending)}</div>
        </div>
        <div className="ui-metric-card">
          <div className="ui-metric-label">Pagado</div>
          <div className="ui-metric-value">{money(totals.paid)}</div>
        </div>
        <div className="ui-metric-card">
          <div className="ui-metric-label">Vencido</div>
          <div className="ui-metric-value" style={{ color: "#991b1b" }}>{money(totals.overdue)}</div>
        </div>
      </div>

      {showCreate ? <div style={{ marginTop: 16 }}>{formBlock(createForm, setCreateForm, submitCreate, "Guardar cuenta")}</div> : null}

      <div className="ui-panel ui-panel-body" style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <label className="ui-label">
            <span className="ui-label-text">Estado</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="ui-control">
              <option value="">Todos</option>
              <option value="vigente">Vigente</option>
              <option value="por_vencer">Por vencer</option>
              <option value="vencido">Vencido</option>
            </select>
          </label>
          <label className="ui-label">
            <span className="ui-label-text">Pagado</span>
            <select value={paidFilter} onChange={(e) => setPaidFilter(e.target.value)} className="ui-control">
              <option value="">Todos</option>
              <option value="false">No</option>
              <option value="true">Sí</option>
            </select>
          </label>
          <label className="ui-label">
            <span className="ui-label-text">Tipo de gasto</span>
            <select value={expenseTypeFilter} onChange={(e) => setExpenseTypeFilter(e.target.value)} className="ui-control">
              <option value="">Todos</option>
              {accountPayableExpenseTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ui-label">
            <span className="ui-label-text">Buscar</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setAppliedQuery(query.trim());
              }}
              className="ui-control"
              placeholder="Descripción o nota"
            />
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setAppliedQuery(query.trim())} className="ui-btn">
            Aplicar filtros
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("");
              setPaidFilter("");
              setExpenseTypeFilter("");
              setQuery("");
              setAppliedQuery("");
            }}
            className="ui-btn"
          >
            Limpiar
          </button>
        </div>
      </div>

      {error ? <div className="ui-error" style={{ marginTop: 12 }}>{error}</div> : null}

      <div className="ui-panel" style={{ marginTop: 16, overflow: "hidden" }}>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                {["Descripción", "Tipo de gasto", "Monto", "Vence", "Días", "Estado", "Pagado", "Fecha pago", "Acciones"].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: 20 }}>
                    Cargando...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 20 }}>
                    No hay cuentas por pagar con los filtros actuales.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const badge = statusColor(row.status);
                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: "1px solid #f2f2f2",
                        background:
                          !row.paid && String(row.status).toUpperCase() === "VENCIDO"
                            ? "#fff8f8"
                            : !row.paid && String(row.status).toUpperCase() === "POR_VENCER"
                              ? "#fffcf3"
                              : "#fff",
                      }}
                    >
                      <td style={{ padding: "10px 8px", minWidth: 240 }}>
                        <div style={{ fontWeight: 600 }}>{row.description}</div>
                        {row.notes ? <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{row.notes}</div> : null}
                      </td>
                      <td>{row.expense_type}</td>
                      <td style={{ fontWeight: 600 }}>{money(row.amount)}</td>
                      <td>{shortDate(row.due_date)}</td>
                      <td>{row.days_available}</td>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: badge.background,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td>{row.paid ? "Sí" : "No"}</td>
                      <td>{dateTime(row.paid_at)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => togglePaid(row)} disabled={saving} className="ui-btn">
                            {row.paid ? "Desmarcar" : "Marcar pagado"}
                          </button>
                          <button type="button" onClick={() => openEdit(row)} className="ui-btn">
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.35)", display: "grid", placeItems: "center", padding: 20 }}>
          <div style={{ width: "min(760px, 100%)", display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff" }}>
              <h3 style={{ margin: 0 }}>Editar cuenta por pagar</h3>
              <button type="button" onClick={() => setEditing(null)} className="ui-btn">
                Cerrar
              </button>
            </div>
            {formBlock(editForm, setEditForm, submitEdit, "Guardar cambios")}
          </div>
        </div>
      ) : null}
    </div>
  );
}
