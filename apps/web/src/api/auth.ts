import { api } from "./client";

/* ===== TOKEN ===== */

const TOKEN_KEY = "token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  delete api.defaults.headers.common.Authorization;
}

/* ===== AUTH STATE ===== */

export function isAuthenticated(): boolean {
  return !!getToken();
}

/* ===== INIT ===== */
// Se llama una sola vez al arrancar la app
export function initAuth() {
  const token = getToken();
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  }
}