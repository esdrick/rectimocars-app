import { api } from "./client";

export type AccountPayableStatus = "VIGENTE" | "POR_VENCER" | "VENCIDO";
export type AccountPayableExpenseType =
  | "COMPRA_INVENTARIO"
  | "SERVICIOS"
  | "ALQUILER"
  | "NOMINA"
  | "IMPUESTOS"
  | "MANTENIMIENTO"
  | "OTROS";

export const accountPayableExpenseTypeOptions: Array<{ value: AccountPayableExpenseType; label: string }> = [
  { value: "COMPRA_INVENTARIO", label: "Compra inventario" },
  { value: "SERVICIOS", label: "Servicios" },
  { value: "ALQUILER", label: "Alquiler" },
  { value: "NOMINA", label: "Nómina" },
  { value: "IMPUESTOS", label: "Impuestos" },
  { value: "MANTENIMIENTO", label: "Mantenimiento" },
  { value: "OTROS", label: "Otros" },
];

export type AccountPayable = {
  id: string;
  description: string;
  expense_type: AccountPayableExpenseType | string;
  amount: string | number;
  due_date: string;
  days_available: number;
  status: AccountPayableStatus | string;
  paid: boolean;
  paid_at?: string | null;
  notes?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type AccountPayableCreate = {
  description: string;
  expense_type: AccountPayableExpenseType | string;
  amount: string | number;
  due_date: string;
  notes?: string | null;
};

export type AccountPayableUpdate = Partial<AccountPayableCreate>;

export async function listAccountsPayable(params?: {
  paid?: boolean;
  status?: "vigente" | "por_vencer" | "vencido";
  expense_type?: string;
  due_from?: string;
  due_to?: string;
  q?: string;
}) {
  const res = await api.get<AccountPayable[]>("/accounts-payable", { params });
  return res.data;
}

export async function createAccountPayable(payload: AccountPayableCreate) {
  const res = await api.post<AccountPayable>("/accounts-payable", payload);
  return res.data;
}

export async function updateAccountPayable(id: string, payload: AccountPayableUpdate) {
  const res = await api.patch<AccountPayable>(`/accounts-payable/${id}`, payload);
  return res.data;
}

export async function markAccountPayablePaid(id: string, payload?: { paid_at?: string }) {
  const res = await api.post<AccountPayable>(`/accounts-payable/${id}/mark-paid`, payload ?? {});
  return res.data;
}

export async function markAccountPayableUnpaid(id: string) {
  const res = await api.post<AccountPayable>(`/accounts-payable/${id}/mark-unpaid`);
  return res.data;
}
