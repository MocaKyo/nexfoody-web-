import { useParams, Link, Outlet, useLocation } from "react-router-dom";
import { useTenant } from "../contexts/TenantContext";
import { useAuth } from "../contexts/AuthContext";
import LojistaDashboard from "../pages/nexfoody/LojistaDashboard";

interface TenantLayoutProps {
  adminContent?: boolean;
}

export default function TenantLayout({ adminContent }: TenantLayoutProps) {
  const { slug } = useParams<{ slug: string }>();
  const { tenantConfig, isLoading } = useTenant();
  const { userData } = useAuth();
  const location = useLocation();

  const base = `/loja/${slug}`;

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === base;
    return location.pathname.startsWith(`${base}${path}`);
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!tenantConfig && slug) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
        background: "var(--bg)",
      }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔍</div>
        <h2 style={{ color: "var(--text)", marginBottom: 8 }}>Loja não encontrada</h2>
        <p style={{ color: "var(--text2)" }}>Esta loja não existe ou foi desativada.</p>
        <Link to="/" className="btn btn-outline" style={{ marginTop: 16 }}>
          ← Voltar para Nexfoody
        </Link>
      </div>
    );
  }

  const isAdmin = userData?.role === "admin";

  const clientNavItems = [
    { path: "/", icon: "🍽️", label: "Cardápio" },
    { path: "/feed", icon: "📱", label: "Feed" },
    { path: "/carrinho", icon: "🛒", label: "Pedido" },
    { path: "/pontos", icon: "⭐", label: "Pontos" },
    { path: "/historico", icon: "📋", label: "Histórico" },
    { path: "/conta", icon: "👤", label: "Conta" },
    ...(isAdmin ? [{ path: "/admin", icon: "🛡️", label: "Admin" }] : []),
  ];

  const adminNavItems = [
    { path: "/admin", icon: "🏪", label: "Dashboard" },
    { path: "/admin/cardapio", icon: "🍽️", label: "Cardápio" },
    { path: "/admin/pedidos", icon: "📦", label: "Pedidos" },
    { path: "/admin/cupons", icon: "🎟️", label: "Cupons" },
    { path: "/admin/config", icon: "⚙️", label: "Config" },
  ];

  const navItems = adminContent ? adminNavItems : clientNavItems;

  return (
    <div className={`app-shell${adminContent ? " admin-mode" : ""}`}>
      {/* Pause banner */}
      {(!tenantConfig?.cardapioAtivo) && (
        <div className="pause-banner">
          {tenantConfig?.mensagemPausa || "🔒 Loja fechada neste momento"}
        </div>
      )}

      {/* Top bar */}
      <div className="topbar">
        {adminContent ? (
          <div className="topbar-brand">
            <span className="berry">🍓</span>
            <span>{tenantConfig?.nomeLoja || slug} · Admin</span>
          </div>
        ) : (
          <Link to={`/loja/${slug}`} style={{ textDecoration: "none" }}>
            <div className="topbar-brand">
              <span className="berry">🍓</span>
              <span>{tenantConfig?.nomeLoja || slug}</span>
            </div>
          </Link>
        )}
        <div className="topbar-actions">
          {adminContent ? (
            <Link
              to={`/loja/${slug}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                background: "var(--gold-dim)",
                border: "1px solid rgba(245,197,24,0.3)",
                borderRadius: 20,
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "var(--gold)",
                textDecoration: "none",
              }}
            >
              👁️ Ver loja
            </Link>
          ) : (
            <>
              {(tenantConfig?.paginaFeed || slug) && (
                <Link
                  to={`/loja/${slug}/feed`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 10px",
                    background: "rgba(245,197,24,.1)",
                    border: "1px solid rgba(245,197,24,.3)",
                    borderRadius: 20,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "var(--gold)",
                    textDecoration: "none",
                  }}
                >
                  📱 @{tenantConfig?.paginaFeed || slug}
                </Link>
              )}
              <Link
                to="/rankings-hub"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 10px",
                  background: "rgba(124,58,237,.1)",
                  border: "1px solid rgba(124,58,237,.3)",
                  borderRadius: 20,
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "#a855f7",
                  textDecoration: "none",
                }}
              >
                🏆 Ranking
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className={`main-content${adminContent ? " admin-full" : ""}`}>
        {adminContent ? <LojistaDashboard /> : <Outlet />}
      </div>

      {/* Bottom nav */}
      <nav className="bottom-nav">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={`/loja/${slug}${item.path}`}
            className={`nav-item ${isActive(item.path) ? "active" : ""}`}
            style={{ textDecoration: "none" }}
          >
            <span style={{ fontSize: "1.2rem" }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
