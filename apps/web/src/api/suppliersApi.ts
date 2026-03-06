import { api } from "./client";

export type Supplier = {
  id: string;
  name: string;
  supplies_type?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  active: boolean;
  created_at?: string;
};

export type SupplierCreate = {
  name: string;
  supplies_type?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  active?: boolean;
};

export type SupplierUpdate = {
  name?: string | null;
  supplies_type?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  active?: boolean;
};

export async function listSuppliers(params?: { include_inactive?: boolean }) {
  const res = await api.get<Supplier[]>("/suppliers/", { params });
  return res.data;
}

export async function createSupplier(payload: SupplierCreate) {
  const res = await api.post<Supplier>("/suppliers/", payload);
  return res.data;
}

export async function updateSupplier(id: string, payload: SupplierUpdate) {
  const res = await api.patch<Supplier>(`/suppliers/${id}`, payload);
  return res.data;
}
