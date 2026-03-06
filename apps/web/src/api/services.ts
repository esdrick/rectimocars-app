import { api } from "./client";

export type ServiceCreate = {
  name: string;
  description?: string | null;
  cilindraje?: string | null;
  valvulas?: string | null;
  sellos?: string | null;
  price_td: string; // Decimal como string
  price_sc: string;
  active?: boolean;
};

export async function listServices() {
  const { data } = await api.get("/services/");
  return data;
}

export async function createService(payload: ServiceCreate) {
  const { data } = await api.post("/services/", payload);
  return data;
}
