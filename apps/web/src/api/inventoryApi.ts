import { api } from "./client";

export type InventoryItem = {
  id: string;
  code?: string | null;
  name: string;
  category?: string | null;
  active: boolean;
  stock_on_hand: string | number;
  stock_min?: string | number | null;
  totals?: {
    in_qty: string | number;
    out_qty: string | number;
  } | null;
};

export type InventoryItemCreate = {
  code?: string | null;
  name: string;
  category?: string | null;
  stock_on_hand?: string | number | null;
  stock_min?: string | number | null;
  active?: boolean;
  supplier?: string | null;
  unit_cost?: string | number | null;
};

export type InventoryItemUpdate = {
  code?: string | null;
  name?: string | null;
  category?: string | null;
  stock_on_hand?: string | number | null;
  stock_min?: string | number | null;
  active?: boolean;
};

export type Consumable = {
  item_id: string;
  qty: string | number;
  item_code?: string | null;
  item_name?: string | null;
};

export type ConsumableCreate = {
  item_id: string;
  qty: string | number;
};

export type ConsumableUpdate = {
  qty: string | number;
};

export type InventoryTotals = {
  in_qty: string | number;
  out_qty: string | number;
  stock_on_hand: string | number;
  status: "OK" | "LOW" | "OUT";
};

export type InventoryItemDetail = {
  item: InventoryItem;
  totals: InventoryTotals;
};

export type InventoryMovement = {
  id: string;
  item_id: string;
  type: "IN" | "OUT" | "ADJUST" | string;
  qty: string | number;
  unit_cost?: string | number | null;
  supplier?: string | null;
  payment_mode?: "CONTADO" | "CREDITO" | string | null;
  total_cost?: string | number | null;
  due_date?: string | null;
  linked_account_payable_id?: string | null;
  work_order_id?: string | null;
  order_number?: number | null;
  note?: string | null;
  created_at: string;
};

export type InventoryMovementCreate = {
  type: "IN" | "ADJUST";
  qty: string | number;
  unit_cost?: string | number | null;
  supplier?: string | null;
  payment_mode?: "CONTADO" | "CREDITO" | string | null;
  total_cost?: string | number | null;
  due_date?: string | null;
  note?: string | null;
  direction?: "UP" | "DOWN" | string | null;
};

export type InventorySummaryEntry = {
  created_at: string;
  supplier?: string | null;
  qty: string | number;
  unit_cost?: string | number | null;
  subtotal?: string | number | null;
  note?: string | null;
};

export type InventorySummaryExit = {
  created_at: string;
  work_order_id?: string | null;
  order_number?: number | null;
  qty: string | number;
  note?: string | null;
};

export type InventorySummaryTotals = {
  total_entries_amount: string | number;
  total_exits_qty: string | number;
};

export type InventorySummary = {
  month: string;
  entries: InventorySummaryEntry[];
  exits: InventorySummaryExit[];
  totals: InventorySummaryTotals;
};

export async function listItems(params?: {
  q?: string;
  include_inactive?: boolean;
  include_totals?: boolean;
  limit?: number;
  offset?: number;
}) {
  const res = await api.get<InventoryItem[]>("/inventory/items", { params });
  return res.data;
}

export async function listItemsPaged(params?: {
  q?: string;
  include_inactive?: boolean;
  include_totals?: boolean;
  stock_status?: "ALL" | "OK" | "LOW" | "OUT";
  limit?: number;
  offset?: number;
}) {
  const res = await api.get<InventoryItem[]>("/inventory/items", { params });
  const headerValue = res.headers?.["x-total-count"];
  const total = Number(headerValue);
  return {
    items: res.data,
    total: Number.isFinite(total) ? total : res.data.length,
  };
}

export async function createItem(payload: InventoryItemCreate) {
  const res = await api.post<InventoryItem>("/inventory/items", payload);
  return res.data;
}

export async function updateItem(id: string, payload: InventoryItemUpdate) {
  const res = await api.patch<InventoryItem>(`/inventory/items/${id}`, payload);
  return res.data;
}

export async function softDeleteItem(id: string) {
  const res = await api.delete<{ ok: boolean }>(`/inventory/items/${id}`);
  return res.data;
}

export async function listConsumables(orderId: string) {
  const res = await api.get<Consumable[]>(`/work-orders/${orderId}/consumables`);
  return res.data;
}

export async function addConsumable(orderId: string, payload: ConsumableCreate) {
  const res = await api.post<Consumable>(`/work-orders/${orderId}/consumables`, payload);
  return res.data;
}

export async function updateConsumable(orderId: string, itemId: string, payload: ConsumableUpdate) {
  const res = await api.patch<Consumable>(`/work-orders/${orderId}/consumables/${itemId}`, payload);
  return res.data;
}

export async function deleteConsumable(orderId: string, itemId: string) {
  const res = await api.delete<{ ok: boolean }>(`/work-orders/${orderId}/consumables/${itemId}`);
  return res.data;
}

export async function getItemDetail(itemId: string) {
  const res = await api.get<InventoryItemDetail>(`/inventory/items/${itemId}/detail`);
  return res.data;
}

export async function listMovements(
  itemId: string,
  params?: { type?: "IN" | "OUT" | "ADJUST"; limit?: number; offset?: number }
) {
  const res = await api.get<InventoryMovement[]>(`/inventory/items/${itemId}/movements`, { params });
  return res.data;
}

export async function createMovement(itemId: string, payload: InventoryMovementCreate) {
  const res = await api.post<InventoryMovement>(`/inventory/items/${itemId}/movements`, payload);
  return res.data;
}

export async function getInventorySummary(month?: string) {
  const res = await api.get<InventorySummary>("/inventory/summary", { params: { month } });
  return res.data;
}

export async function exportInventoryCsv() {
  const res = await api.get("/inventory/export", { responseType: "blob" });
  return res.data as Blob;
}

export async function importInventoryCsv(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post<{ created: number; skipped: number; errors: Array<{ row: number; reason: string }> }>(
    "/inventory/import",
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return res.data;
}
