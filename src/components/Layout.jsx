// src/components/Layout.js
import React, { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { ToastProvider } from "./Toast";
import { useFCM } from "../hooks/useFCM";
import OfflineBanner from "./OfflineBanner";
import { getBadges } from "./RankingFas";

const LOGO_URL = "https://i.ibb.co/Z1R8Y83G/Whats-App-Image-2026-03-20-at-20-32-27.jpg";

const IconHome = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const IconCart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>
);
const IconStar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);
const IconHistory = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="12 8 12 12 14 14"/>
    <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/>
  </svg>
);
const IconUser = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconAdmin = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userData, isAdmin, isLojista } = useAuth();
  const { config, cartCount } = useStore();
  const { theme, setTheme } = useTheme();
  const path = location.pathname;
  const [installPrompt, setInstallPrompt] = useState(null);
  const [pedidoAtualizado, setPedidoAtualizado] = useState(false);
  const ultimoStatusRef = useRef({});
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [rankingPos, setRankingPos] = useState(null);

  // FCM — notificações push
  useFCM(user?.uid);

  // Buscar posição no ranking do cliente
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "users"), orderBy("rankingPts", "desc"));
    const unsub = onSnapshot(q, snap => {
      const lista = snap.docs.map((d, i) => ({ id: d.id, ...d.data(), posicao: i + 1 }));
      const meu = lista.find(u => u.id === user.uid);
      if (meu) setRankingPos(meu.posicao);
    });
    return unsub;
  }, [user?.uid]);

  // Monitorar mudança de status dos pedidos
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "pedidos"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    const unsub = onSnapshot(q, snap => {
      snap.docChanges().forEach(change => {
        const pedido = change.doc.data();
        const id = change.doc.id;
        if (change.type === "modified") {
          const statusAnterior = ultimoStatusRef.current[id];
          if (statusAnterior && statusAnterior !== pedido.status) {
            if (window.location.pathname !== "/historico") {
              setPedidoAtualizado(true);
            }
          }
        }
        ultimoStatusRef.current[id] = pedido.status;
      });
    });
    return unsub;
  }, [user?.uid]);

  // Apagar badge ao entrar no histórico
  useEffect(() => {
    if (path === "/historico") setPedidoAtualizado(false);
  }, [path]);

  // Registrar Service Worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js")
        .then(reg => console.log("SW registrado:", reg.scope))
        .catch(err => console.warn("SW erro:", err));
    }
  }, []);

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Mostrar banner só se não instalado e não dispensado
      const dispensado = localStorage.getItem("pwa_dispensado");
      if (!dispensado) setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstallBanner(false);
      setInstallPrompt(null);
    }
  };

  const dispensarInstall = () => {
    setShowInstallBanner(false);
    localStorage.setItem("pwa_dispensado", "1");
  };

  const slug = location.pathname.split("/loja/")[1]?.split("/")[0] || "";
  const baseLoja = slug ? `/loja/${slug}` : "";

  const navItems = [
    { path: baseLoja || "/",      label: "Cardápio",  icon: <IconHome /> },
    { path: `${baseLoja}/carrinho`, label: "Pedido",   icon: <IconCart />, badge: cartCount() },
    { path: `${baseLoja}/pontos`,   label: "Pontos",   icon: <IconStar /> },
    { path: `${baseLoja}/historico`,label: "Histórico",icon: <IconHistory />, alertBadge: pedidoAtualizado },
    { path: `${baseLoja}/conta`,    label: "Social",   icon: <IconUser /> },
    ...((isAdmin || isLojista) ? [{ path: `${baseLoja}/admin`, label: "Admin", icon: <IconAdmin /> }] : []),
  ];

  const isAdminRoute = location.pathname.includes("/admin");

  return (
    <ToastProvider>
      <div className={`app-shell${isAdminRoute ? " admin-mode" : ""}`}>
        <OfflineBanner />
        {/* Banner de instalação PWA */}
        {showInstallBanner && (
          <div style={{
            background: "linear-gradient(135deg, #2d1055, #1e0a36)",
            borderBottom: "1px solid rgba(245,197,24,0.3)",
            padding: "10px 16px",
            display: "flex", alignItems: "center", gap: 10,
            zIndex: 200,
          }}>
            <img src={config?.logoUrl || LOGO_URL} alt="Logo" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>Instalar o app</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text2)" }}>Adicione à tela inicial para acesso rápido</div>
            </div>
            <button onClick={handleInstall} style={{
              background: "var(--gold)", color: "var(--bg)",
              border: "none", borderRadius: 8, padding: "6px 12px",
              fontWeight: 700, fontSize: "0.78rem", cursor: "pointer",
              fontFamily: "'Outfit', sans-serif",
            }}>
              Instalar
            </button>
            <button onClick={dispensarInstall} style={{
              background: "none", border: "none", color: "var(--text3)",
              cursor: "pointer", fontSize: "1.1rem", padding: "0 4px",
            }}>✕</button>
          </div>
        )}

        <header className="topbar">
          <div className="topbar-brand" style={{ gap: 10 }}>
            <img
              src={config?.logoUrl || LOGO_URL}
              alt={config?.nomeLoja || "Loja"}
              style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }}
            />
            <span>{config?.nomeLoja || "Loja"}</span>
          </div>
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text2)", display: "flex", alignItems: "center", gap: 6 }}>
                <span>Olá, {userData?.nome?.split(" ")[0] || "Cliente"} 👋</span>
                {rankingPos && getBadges(rankingPos, 0).slice(0, 1).map(b => (
                  <span key={b.id} title={`${b.label} — ${rankingPos}º no ranking`} style={{ fontSize: "0.9rem" }}>{b.emoji}</span>
                ))}
                {rankingPos > 10 && (
                  <span style={{ fontSize: "0.68rem", color: "var(--text3)" }}>#{rankingPos}</span>
                )}
              </span>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
                style={{
                  background: "var(--bg2)", border: "1px solid var(--border)",
                  borderRadius: 20, padding: "4px 10px", cursor: "pointer",
                  fontSize: "0.72rem", fontWeight: 700, color: "var(--text2)",
                  display: "flex", alignItems: "center", gap: 4,
                }}
                title="Alternar tema"
              >
                {theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "⚙️"}
              </button>
            </div>
          )}
        </header>

        {config && !config.cardapioAtivo && (
          <div className="pause-banner">
            ⚠️ {config.mensagemPausa}
          </div>
        )}

        <main className="main-content">
          <Outlet />
        </main>

        <nav className="bottom-nav">
          {navItems.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${path === item.path ? "active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              <div style={{ position: "relative" }}>
                {item.icon}
                {item.alertBadge && (
                  <div style={{
                    position: "absolute", top: -3, right: -4,
                    width: 10, height: 10,
                    background: "#ef4444",
                    borderRadius: "50%",
                    border: "2px solid var(--bg)",
                    animation: "pulseBadge 1.2s ease-in-out infinite",
                  }} />
                )}
              </div>
              {item.label}
              {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
              <style>{`@keyframes pulseBadge { 0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(239,68,68,0.7)} 50%{transform:scale(1.3);box-shadow:0 0 0 6px rgba(239,68,68,0)} }`}</style>
            </button>
          ))}
        </nav>
      </div>
    </ToastProvider>
  );
}
