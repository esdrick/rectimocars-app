import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post("/auth/login", { email, password });

      // Acepta varias formas comunes de respuesta
      const token =
        res.data?.access_token ??
        res.data?.token ??
        res.data?.accessToken ??
        res.data?.jwt;

      if (!token) {
        throw new Error("Login OK pero no llegó token en la respuesta.");
      }

      localStorage.setItem("token", token);

      // (Opcional) setearlo ya en axios para próximas requests
      api.defaults.headers.common.Authorization = `Bearer ${token}`;

      navigate("/dashboard");
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        err?.message ??
        "Error haciendo login";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="ui-panel ui-panel-body"
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 20,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Login</h2>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label className="ui-label">
            <span className="ui-label-text">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="tu@email.com"
              required
              className="ui-control"
              style={{ width: "100%" }}
            />
          </label>

          <label className="ui-label">
            <span className="ui-label-text">Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              required
              className="ui-control"
              style={{ width: "100%" }}
            />
          </label>

          <button type="submit" disabled={loading} className="ui-btn ui-btn-primary">
            {loading ? "Entrando..." : "Entrar"}
          </button>

          {error && <div className="ui-error">{error}</div>}
        </form>
      </div>
    </div>
  );
}
