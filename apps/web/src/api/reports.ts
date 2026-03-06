import { api } from "./client";

export type CashflowItem = {
  id: string;
  kind: string;
  description: string;
  amount: string | number;
  occurred_at: string;
  source_type?: string | null;
  source_id?: string | null;
};

export type CashflowDay = {
  day: string;
  incomes_total: string | number;
  expenses_total: string | number;
  net_total: string | number;
};

export type CashflowReport = {
  from_date: string;
  to_date: string;
  ingresos_total: string | number;
  egresos_total: string | number;
  neto: string | number;
  pendientes_total: string | number;
  breakdown_by_day: CashflowDay[];
  incomes: CashflowItem[];
  expenses: CashflowItem[];
};

export async function getCashflowReport(params: { from: string; to: string; include_details?: boolean }) {
  const res = await api.get<CashflowReport>("/reports/cashflow", { params });
  return res.data;
}
