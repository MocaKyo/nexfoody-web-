// src/App.tsx — Zuppei Platform
//
// © 2026 Zuppei Tecnologia LTDA — Todos os direitos reservados.
// Zuppei ⚡ Pede fácil. Recebe rápido.
// Propriedade intelectual protegida pela Lei 9.610/98 e registro de software no INPI.
// Reprodução total ou parcial sem autorização expressa é proibida.
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { StoreProvider } from "./contexts/StoreContext";
import { TenantProvider, useTenant } from "./contexts/TenantContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { VISUAL_PADRAO } from "./types/tenant";
import Layout from "./components/Layout";
import { ToastProvider } from "./components/Toast";
import { useEffect } from "react";
import { doc, setDoc, serverTimestamp, increment } from "firebase/firestore";
import { db } from "./lib/firebase";

// Store pages (used by /loja/:slug multi-tenant)
import Cardapio from "./pages/Cardapio";
import Carrinho from "./pages/Carrinho";
import MeusPontos from "./pages/MeusPontos";
import Historico from "./pages/Historico";
import Conta from "./pages/Conta";
import Admin from "./pages/Admin";
import KDS from "./pages/KDS";
import Entregador from "./pages/Entregador";
import Mesa from "./pages/Mesa";
import PagamentoSucesso from "./pages/PagamentoSucesso";
import PerfilLoja from "./pages/PerfilLoja";
import FeedLoja from "./pages/acai-puro-gosto/FeedLoja";
import Favoritos from "./pages/Favoritos";
import RankingFas from "./components/RankingFas";
import Social from "./pages/Social";
import Cupons from "./pages/Cupons";
import FotoPage from "./pages/FotoPage";
import PremiosGanhadores from "./pages/PremiosGanhadores";
import PerfilCliente from "./pages/PerfilCliente";
import ChatPage from "./pages/ChatPage";

// NexFoody platform pages
import LojistaLogin from "./pages/nexfoody/LojistaLogin";
import FuncionarioLogin from "./pages/nexfoody/FuncionarioLogin";
import RegisterLojista from "./pages/nexfoody/RegisterLojista";
import RegisterCatalogo from "./pages/nexfoody/RegisterCatalogo";
import LojistaDashboard from "./pages/nexfoody/LojistaDashboard";
import LojistaHub from "./pages/nexfoody/LojistaHub";
import PlanosPage from "./pages/nexfoody/PlanosPage";
import NexfoodyHome from "./pages/nexfoody/NexfoodyHome";
import NexfoodyFeedHome from "./pages/nexfoody/NexfoodyFeedHome";
import NexfoodyLojas from "./pages/nexfoody/NexfoodyLojas";
import NexfoodyWelcome from "./pages/nexfoody/NexfoodyWelcome";
import NexfoodyMapa from "./pages/nexfoody/NexfoodyMapa";
import NexfoodyLogin from "./pages/nexfoody/NexfoodyLogin";
import NexfoodyRegister from "./pages/nexfoody/NexfoodyRegister";
import Carteira from "./pages/nexfoody/Carteira";
import ComoFunciona from "./pages/nexfoody/ComoFunciona";
import AdminSaques from "./pages/nexfoody/AdminSaques";
import AdminSetup from "./pages/nexfoody/AdminSetup";
import AdminDashboard from "./pages/nexfoody/AdminDashboard";
import AdminConvites from "./pages/nexfoody/AdminConvites";
import AdminEmbaixadores from "./pages/nexfoody/AdminEmbaixadores";
import AdminPlataforma from "./pages/nexfoody/AdminPlataforma";
import AdminLojas from "./pages/nexfoody/AdminLojas";
import AdminUsuarios from "./pages/nexfoody/AdminUsuarios";
import AdminDashboardPlataforma from "./pages/nexfoody/AdminDashboardPlataforma";
import AdminLojasAnalytics from "./pages/nexfoody/AdminLojasAnalytics";
import AdminPlanos from "./pages/nexfoody/AdminPlanos";
import AdminBroadcast from "./pages/nexfoody/AdminBroadcast";
import AdminLanding from "./pages/nexfoody/AdminLanding";
import AdminInstrucoes from "./pages/nexfoody/AdminInstrucoes";
import Instrucoes from "./pages/nexfoody/Instrucoes";
import Rankings from "./pages/nexfoody/Rankings";
import StoreRanking from "./pages/nexfoody/StoreRanking";
import RankingsHub from "./pages/nexfoody/RankingsHub";

/** Retorna true se a cor hex for escura (luminância < 0.5) */
function hexEscuro(hex: string): boolean {
  try {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b < 0.5;
  } catch { return true; }
}

// Theme manager (inside TenantProvider) — aplica tema global + CSS variables da loja
function ThemeManager() {
  const { tenantConfig } = useTenant();
  const { resolvedTheme, theme } = useTheme();
  useEffect(() => {
    const v = { ...VISUAL_PADRAO, ...(tenantConfig?.visual || {}) };
    const html = document.documentElement;

    // Base theme: if user explicitly chose dark/light (not "system"), use that.
    // Tenant's temaBase only overrides when user is in "system" mode.
    const tenantTema = v.temaBase as string | undefined;
    const userExplicitlySet = theme !== "system";
    const baseTema = userExplicitlySet ? resolvedTheme : (tenantTema || resolvedTheme);
    const isClaro = baseTema === "light" || baseTema === "white";

    // Define data-tema para o CSS base (dark/light)
    html.setAttribute("data-tema", isClaro ? "light" : "dark");

    const bannerBg = v.bannerGradiente
      ? `linear-gradient(${v.bannerDirecao}, ${v.bannerCorA}, ${v.bannerCorB})`
      : v.bannerCorA;

    // Cores base conforme temaBase
    const bgPuro  = baseTema === "white"  ? "#ffffff" : isClaro ? "#f8f8f8" : v.corFundo;
    const bg2Puro = baseTema === "white"  ? "#f4f4f4" : isClaro ? "#eeeeee" : undefined;
    const textoPrincipal = isClaro ? "#111111" : undefined;
    const textoSecundario = isClaro ? "#374151" : undefined;
    const textoMudo       = isClaro ? "#6b7280" : undefined;
    const borderClaro     = isClaro ? "rgba(0,0,0,0.1)" : undefined;

    // Override vars base quando tema claro
    if (isClaro) {
      html.style.setProperty("--bg",      bgPuro);
      html.style.setProperty("--bg2",     bg2Puro!);
      html.style.setProperty("--bg3",     baseTema === "white" ? "#e8e8e8" : "#dddddd");
      html.style.setProperty("--text",    textoPrincipal!);
      html.style.setProperty("--text2",   textoSecundario!);
      html.style.setProperty("--text3",   textoMudo!);
      html.style.setProperty("--border",  borderClaro!);
      html.style.setProperty("--border2", "rgba(0,0,0,0.18)");
      html.style.setProperty("--gold",    v.corPrimaria); // "gold" segue a cor primária da loja
    } else {
      // Dark: remove overrides (deixa o CSS nativo do data-tema="dark")
      ["--bg","--bg2","--bg3","--text","--text2","--text3","--border","--border2","--gold"]
        .forEach(k => html.style.removeProperty(k));
    }

    // Texto do banner — sempre contrasta com o fundo do banner
    const bannerTexto = hexEscuro(v.bannerCorA) ? "#ffffff" : "#111111";
    // Texto do header — contrasta com corHeader (mesma lógica do banner)
    const headerTexto = hexEscuro(v.corHeader) ? "#ffffff" : "#111111";
    // Texto dos botões primários — contrasta com corPrimaria
    const btnTexto = hexEscuro(v.corPrimaria) ? "#ffffff" : "#111111";

    // CSS variables da loja
    html.style.setProperty("--loja-cor-primaria",   v.corPrimaria);
    html.style.setProperty("--loja-cor-acento",     v.corAcento);
    html.style.setProperty("--loja-header-bg",      v.corHeader);
    html.style.setProperty("--loja-header-texto",  headerTexto);
    html.style.setProperty("--loja-fundo",          bgPuro);
    html.style.setProperty("--loja-banner-bg",      bannerBg);
    html.style.setProperty("--loja-banner-texto",   bannerTexto);
    html.style.setProperty("--loja-btn-texto",      btnTexto);
    html.style.setProperty("--loja-fonte",          `'${v.fonte}', sans-serif`);
    html.style.setProperty("--loja-radius",         v.bordaArredondada ? "16px" : "8px");

    // Botões seguem corPrimaria da loja (não roxo fixo)
    html.style.setProperty("--loja-btn-bg",    `linear-gradient(135deg, ${v.corPrimaria}, ${v.corAcento})`);
    const shadowColor = v.corPrimaria + "55";
    html.style.setProperty("--loja-btn-shadow", `0 6px 20px ${shadowColor}`);
    // Ícones de ação seguem corPrimaria (favorito, curtida, etc)
    html.style.setProperty("--loja-cor-icon",  "#f5c518");

    // Topbar
    const topBg = isClaro ? `rgba(255,255,255,0.97)` : `rgba(15,5,24,0.92)`;
    html.style.setProperty("--loja-topbar-bg",     v.topbarBg || topBg);
    html.style.setProperty("--loja-topbar-border", isClaro ? "rgba(0,0,0,0.1)" : "rgba(138,92,246,0.18)");
    html.style.setProperty("--loja-topbar-texto",  v.topbarTexto || (isClaro ? v.corPrimaria : v.corPrimaria));

    // Bottom nav
    const navBg = isClaro ? `rgba(255,255,255,0.97)` : `rgba(19,8,42,0.96)`;
    html.style.setProperty("--loja-nav-bg",     v.navBg     || navBg);
    html.style.setProperty("--loja-nav-border", v.navBorder || (isClaro ? "rgba(0,0,0,0.1)" : "rgba(138,92,246,0.18)"));
    html.style.setProperty("--loja-nav-texto",  v.navTexto  || (isClaro ? textoMudo! : "#7a6a9a"));
    html.style.setProperty("--loja-nav-ativo",  v.corPrimaria);

    const ALL_VARS = [
      "--loja-cor-primaria","--loja-cor-acento","--loja-header-bg","--loja-fundo",
      "--loja-banner-bg","--loja-banner-texto","--loja-btn-texto","--loja-fonte","--loja-radius",
      "--loja-topbar-bg","--loja-topbar-border","--loja-topbar-texto",
      "--loja-nav-bg","--loja-nav-border","--loja-nav-texto","--loja-nav-ativo",
      "--bg","--bg2","--bg3","--text","--text2","--text3","--border","--border2","--gold",
    ];

    return () => {
      html.removeAttribute("data-tema");
      ALL_VARS.forEach(k => html.style.removeProperty(k));
    };
  }, [tenantConfig?.visual, resolvedTheme]);
  return null;
}

// Visitor tracking
function useVisitorTracking() {
  useEffect(() => {
    const trackVisit = async () => {
      try {
        const hoje = new Date().toISOString().split("T")[0];
        const sessionKey = `visited_${hoje}`;
        const onlineKey = `online_${Date.now()}_${Math.random()}`;
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, "1");
          await setDoc(doc(db, "analytics", hoje), {
            data: hoje,
            visitas: increment(1),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
        const onlineRef = doc(db, "analytics_online", onlineKey);
        await setDoc(onlineRef, {
          timestamp: serverTimestamp(),
          pagina: window.location.pathname,
          userAgent: navigator.userAgent.includes("Mobile") ? "mobile" : "desktop",
        });
        const interval = setInterval(async () => {
          await setDoc(onlineRef, {
            timestamp: serverTimestamp(),
            pagina: window.location.pathname,
            userAgent: navigator.userAgent.includes("Mobile") ? "mobile" : "desktop",
          });
        }, 60000);
        const cleanup = async () => {
          clearInterval(interval);
          try { await setDoc(onlineRef, { timestamp: serverTimestamp(), saiu: true }, { merge: true }); } catch {}
        };
        window.addEventListener("beforeunload", cleanup);
        return () => { cleanup(); window.removeEventListener("beforeunload", cleanup); };
      } catch (e: unknown) { console.warn("Analytics:", (e as Error).message); }
    };
    trackVisit();
  }, []);
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/nexfoody/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, userData, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/nexfoody/login" replace />;
  if (userData?.role !== "admin" && userData?.role !== "lojista" && userData?.role !== "funcionario") return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Multi-tenant store layout (NexFoody hosts stores at /loja/:slug)
function TenantLayout() {
  return (
    <TenantProvider>
      <StoreProvider>
        <ThemeManager />
        <Layout />
      </StoreProvider>
    </TenantProvider>
  );
}

export default function App() {
  useVisitorTracking();
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              {/* NexFoody platform */}
              <Route path="/" element={<NexfoodyFeedHome />} />
          <Route path="/nexfoody/welcome" element={<Navigate to="/nexfoody/login" replace />} />
          <Route path="/nexfoody/login" element={<NexfoodyLogin />} />
          <Route path="/nexfoody/cadastro" element={<NexfoodyRegister />} />
          <Route path="/welcome" element={<Navigate to="/nexfoody/welcome" replace />} />
          <Route path="/login" element={<Navigate to="/nexfoody/login" replace />} />
          <Route path="/cadastro" element={<Navigate to="/nexfoody/cadastro" replace />} />
          <Route path="/mapa" element={<NexfoodyMapa />} />
          <Route path="/landing" element={<NexfoodyHome />} />
          <Route path="/app" element={<NexfoodyFeedHome />} />
          <Route path="/lojas" element={<NexfoodyLojas />} />
          <Route path="/lojista/login" element={<LojistaLogin />} />
          <Route path="/lojista/funcionario" element={<FuncionarioLogin />} />
          <Route path="/lojista/funcionario/:slug" element={<FuncionarioLogin />} />
          <Route path="/lojista/cadastro" element={<RegisterLojista />} />
          <Route path="/lojista/catalogo" element={<RegisterCatalogo />} />
          <Route path="/lojista/dashboard" element={<ProtectedRoute><LojistaDashboard /></ProtectedRoute>} />
          <Route path="/lojista/hub" element={<ProtectedRoute><LojistaHub /></ProtectedRoute>} />
          <Route path="/lojista/planos" element={<PlanosPage />} />
          <Route path="/planos" element={<PlanosPage />} />
          <Route path="/carteira" element={<ProtectedRoute><Carteira /></ProtectedRoute>} />
          <Route path="/como-funciona" element={<ComoFunciona />} />
          <Route path="/admin" element={<AdminRoute><AdminPlataforma /></AdminRoute>} />
          <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboardPlataforma /></AdminRoute>} />
          <Route path="/admin/embaixadores-hub" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/saques" element={<AdminRoute><AdminSaques /></AdminRoute>} />
          <Route path="/admin/convites" element={<AdminRoute><AdminConvites /></AdminRoute>} />
          <Route path="/admin/embaixadores" element={<AdminRoute><AdminEmbaixadores /></AdminRoute>} />
          <Route path="/admin/lojas" element={<AdminRoute><AdminLojas /></AdminRoute>} />
          <Route path="/admin/lojas/analytics" element={<AdminRoute><AdminLojasAnalytics /></AdminRoute>} />
          <Route path="/admin/planos" element={<AdminRoute><AdminPlanos /></AdminRoute>} />
          <Route path="/admin/broadcast" element={<AdminRoute><AdminBroadcast /></AdminRoute>} />
          <Route path="/admin/landing" element={<AdminRoute><AdminLanding /></AdminRoute>} />
          <Route path="/admin/usuarios" element={<AdminRoute><AdminUsuarios /></AdminRoute>} />
          <Route path="/admin/setup" element={<AdminSetup />} />
          <Route path="/admin/instrucoes" element={<AdminRoute><AdminInstrucoes /></AdminRoute>} />
          <Route path="/instrucoes" element={<Instrucoes />} />

          {/* Standalone pages */}
          <Route path="/ranking" element={<RankingFas />} />
          <Route path="/rankings" element={<Rankings />} />
          <Route path="/rankings/:slug" element={<StoreRanking />} />
          <Route path="/rankings-hub" element={<RankingsHub />} />
          <Route path="/premios" element={<PremiosGanhadores />} />
          <Route path="/perfil/:userId" element={<PerfilCliente />} />
          <Route path="/meu-perfil" element={<PerfilCliente />} />
          <Route path="/cupons" element={<Cupons />} />
          <Route path="/foto/:foto" element={<FotoPage />} />
          <Route path="/kds/:slug" element={<AdminRoute><KDS /></AdminRoute>} />
          <Route path="/kds" element={<AdminRoute><KDS /></AdminRoute>} />
          <Route path="/entregador/:entregadorId" element={<Entregador />} />
          <Route path="/mesa/:mesaId" element={<Mesa />} />
          <Route path="/pagamento/sucesso" element={<PagamentoSucesso />} />
          <Route path="/pagamento/falha" element={<PagamentoSucesso />} />
          <Route path="/pagamento/pendente" element={<PagamentoSucesso />} />
          <Route path="/feed" element={<FeedLoja />} />
          <Route path="/favoritos" element={<ProtectedRoute><Favoritos /></ProtectedRoute>} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:chatId" element={<ChatPage />} />
          <Route path="/social" element={<Social />} />

          {/* Multi-tenant store routes — NexFoody hospeda lojas aqui */}
          <Route path="/loja/:slug" element={<TenantLayout />}>
            <Route index element={<Cardapio />} />
            <Route path="feed" element={<FeedLoja />} />
            <Route path="carrinho" element={<Carrinho />} />
            <Route path="pontos" element={<ProtectedRoute><MeusPontos /></ProtectedRoute>} />
            <Route path="historico" element={<ProtectedRoute><Historico /></ProtectedRoute>} />
            <Route path="conta" element={<ProtectedRoute><Conta /></ProtectedRoute>} />
            <Route path="admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="perfil" element={<ProtectedRoute><PerfilLoja /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
