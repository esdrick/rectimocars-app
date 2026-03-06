import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { clearToken } from "../api/auth";

export default function Navbar() {
  const location = useLocation();

  const [showCatalog, setShowCatalog] = useState(false);
  const catalogRef = useRef<HTMLDivElement | null>(null);

  const [showFinances, setShowFinances] = useState(false);
  const financesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;

      // Close Catalog if click outside
      if (catalogRef.current && !catalogRef.current.contains(target)) {
        setShowCatalog(false);
      }

      // Close Finances if click outside
      if (financesRef.current && !financesRef.current.contains(target)) {
        setShowFinances(false);
      }
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    setShowCatalog(false);
    setShowFinances(false);
  }, [location.pathname]);

  function logout() {
    clearToken();
    window.location.href = "/login";
  }

  function isActivePath(to: string) {
    return location.pathname.startsWith(to);
  }

  function navClassName(active: boolean) {
    return active ? "navbar-link is-active" : "navbar-link";
  }

  const Item = ({ to, label }: { to: string; label: string }) => (
    <Link to={to} className={navClassName(isActivePath(to))}>
      {label}
    </Link>
  );

  const CatalogItem = ({ to, label }: { to: string; label: string }) => (
    <Link
      to={to}
      onClick={() => setShowCatalog(false)}
      className={navClassName(isActivePath(to))}
    >
      {label}
    </Link>
  );

  const FinanceItem = ({ to, label }: { to: string; label: string }) => (
    <Link
      to={to}
      onClick={() => setShowFinances(false)}
      className={navClassName(isActivePath(to))}
    >
      {label}
    </Link>
  );
  const financesActive =
    location.pathname.startsWith("/accounts-receivable") ||
    location.pathname.startsWith("/accounts-payable") ||
    location.pathname.startsWith("/reports/");
  const catalogActive =
    location.pathname.startsWith("/services") ||
    location.pathname.startsWith("/engine-models") ||
    location.pathname.startsWith("/received-parts");

  return (
    <div className="navbar">
      <strong className="navbar-brand">Rectimocars Aragua</strong>

      <Item to="/dashboard" label="Dashboard" />
      <Item to="/work-orders" label="Órdenes" />
      <Item to="/customers" label="Clientes" />

      <div className="navbar-dropdown" ref={financesRef}>
        <button
          type="button"
          onClick={() => {
            setShowFinances((v) => !v);
            setShowCatalog(false);
          }}
          className={navClassName(showFinances || financesActive)}
        >
          Finanzas ▾
        </button>

        {showFinances && (
          <div className="navbar-menu">
            <FinanceItem to="/accounts-receivable" label="Cuentas por Cobrar" />
            <FinanceItem to="/accounts-payable" label="Cuentas por Pagar" />
            <FinanceItem to="/reports/cashflow" label="Flujo de Caja" />
          </div>
        )}
      </div>

      <Item to="/workers" label="Empleados" />
      <Item to="/inventory" label="Inventario" />

      <div className="navbar-dropdown" ref={catalogRef}>
        <button
          type="button"
          onClick={() => {
            setShowCatalog((v) => !v);
            setShowFinances(false);
          }}
          className={navClassName(showCatalog || catalogActive)}
        >
          Catálogo ▾
        </button>

        {showCatalog && (
          <div className="navbar-menu">
            <CatalogItem to="/services" label="Servicios" />
            <CatalogItem to="/engine-models" label="Tipos de motor" />
            <CatalogItem to="/received-parts" label="Piezas recibidas" />
          </div>
        )}
      </div>

      <div className="navbar-spacer" />

      <button type="button" onClick={logout} className="ui-btn">
        Salir
      </button>
    </div>
  );
}
