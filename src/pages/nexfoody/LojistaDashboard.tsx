import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import FeedRulesPanel from "../../components/FeedRulesPanel";
import PlaceSearch from "../../components/PlaceSearch";
import PDVDrawer, { CaixaAba } from "../../components/PDVDrawer";

interface VendaBalcao { id: string; total: number; pagamento: string; createdAt: any; produtos: { nome: string; preco: number; qty: number }[]; }

interface Plano { id: string; label: string; preco: number; limite: number; cor: string; ordem: number; }

const PLANOS_FALLBACK: Plano[] = [
  { id: "basico",       label: "Básico",      preco: 99,  limite: 50,   cor: "#60a5fa", ordem: 1 },
  { id: "profissional", label: "Profissional", preco: 199, limite: 200,  cor: "#a78bfa", ordem: 2 },
  { id: "premium",      label: "Premium",      preco: 349, limite: 9999, cor: "#f5c518", ordem: 3 },
];

function fmt(v: number) { return `R$ ${v.toFixed(2).replace(".", ",")}`; }

const MENU = [
  { icon: "🍽️", label: "Cardápio",      desc: "Produtos e categorias",     cor: "#7c3aed", href: (slug: string) => `/loja/${slug}/admin` },
  { icon: "📦", label: "Pedidos",       desc: "Acompanhar em tempo real",   cor: "#0891b2", href: (slug: string) => `/loja/${slug}/admin` },
  { icon: "🎟️", label: "Cupons",        desc: "Criar promoções",            cor: "#d97706", href: (slug: string) => `/loja/${slug}/admin` },
  { icon: "⭐", label: "Avaliações",    desc: "Reputação da loja",          cor: "#f5c518", href: (slug: string) => `/loja/${slug}/admin` },
  { icon: "👥", label: "Fãs",          desc: "Ranking e fidelização",      cor: "#ec4899", href: (slug: string) => `/loja/${slug}/admin` },
  { icon: "📸", label: "Feed / Posts", desc: "Engajamento nas redes",      cor: "#22c55e", href: (slug: string) => `/loja/${slug}/admin` },
  { icon: "📊", label: "Analytics",    desc: "Métricas e desempenho",      cor: "#6366f1", href: (slug: string) => `/loja/${slug}/admin` },
  { icon: "⚙️", label: "Configurações", desc: "Horário, tema, integrações", cor: "#94a3b8", href: (slug: string) => `/loja/${slug}/admin` },
];

export default function LojistaDashboard() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [lojaAberta, setLojaAberta] = useState(true);
  const [chatAberto, setChatAberto] = useState(false);
  const [stats, setStats] = useState({ pedidosHoje: 0, receitaHoje: 0, pedidosMes: 0, faturamentoMes: 0, ticketMedio: 0, totalFas: 0, avaliacao: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [planos, setPlanos] = useState<Plano[]>(PLANOS_FALLBACK);
  const [loja, setLoja] = useState<{ slug?: string; nome?: string; logo?: string; capa?: string; categoria?: string; chatAberto?: boolean; placeId?: string } | null>(null);
  const [vinculandoMaps, setVinculandoMaps] = useState(false);
  const [salvandoPlaceId, setSalvandoPlaceId] = useState(false);
  const [lojaDocId, setLojaDocId] = useState<string | null>(null);
  const [loadingLoja, setLoadingLoja] = useState(true);
  const [chatsClientes, setChatsClientes] = useState<any[]>([]);
  const [chatNaoLido, setChatNaoLido] = useState(0);
  const [abaAtiva, setAbaAtiva] = useState<"painel"|"chat">("painel");

  const [vendasBalcaoHoje, setVendasBalcaoHoje] = useState<VendaBalcao[]>([]);
  const [todasVendasBalcao, setTodasVendasBalcao] = useState<VendaBalcao[]>([]);
  const [showHistorico, setShowHistorico] = useState(false);
  const [caixaOpen, setCaixaOpen] = useState(false);
  const [caixaAba, setCaixaAba] = useState<CaixaAba>("venda");

  useEffect(() => {
    const lojistaOf = userData?.lojistaOf;
    if (!lojistaOf) { setLoadingLoja(false); return; }
    getDocs(query(collection(db, "lojas"), where("tenantId", "==", lojistaOf))).then(snap => {
      if (!snap.empty) {
        const d = snap.docs[0];
        const data = d.data() as typeof loja;
        setLoja(data);
        setLojaDocId(d.id);
        setChatAberto(data?.chatAberto ?? false);
      }
      setLoadingLoja(false);
    }).catch(() => setLoadingLoja(false));
  }, [userData?.lojistaOf]);

  // Conversas recebidas pela loja em tempo real
  useEffect(() => {
    if (!lojaDocId) return;
    const lojaVirtualId = `loja_${lojaDocId}`;
    const q = query(collection(db, "chats"), where("participantes", "array-contains", lojaVirtualId));
    return onSnapshot(q, snap => {
      const lista = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
      setChatsClientes(lista as any[]);
      const total = snap.docs.reduce((acc, d) => acc + (d.data().naoLido?.[lojaVirtualId] || 0), 0);
      setChatNaoLido(total);
    });
  }, [lojaDocId]);

  // Carrega planos do Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "planos"), snap => {
      if (snap.empty) return;
      const lista = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Plano))
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      setPlanos(lista);
    });
    return unsub;
  }, []);

  // Carrega stats reais
  useEffect(() => {
    const slug = userData?.lojistaOf;
    if (!slug) return;

    const inicioDia = new Date(); inicioDia.setHours(0,0,0,0);
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0,0,0,0);

    const q = query(
      collection(db, "pedidos"),
      where("tenantId", "==", slug),
      orderBy("createdAt", "desc"),
      limit(500)
    );

    const unsub = onSnapshot(q, snap => {
      const todos = snap.docs.map(d => ({ ...d.data(), id: d.id } as any));
      const validos = todos.filter((p: any) => p.status !== "cancelado");

      const hoje = validos.filter((p: any) => p.createdAt?.toDate() >= inicioDia);
      const mes  = validos.filter((p: any) => p.createdAt?.toDate() >= inicioMes);

      const receitaHoje     = hoje.reduce((a: number, p: any) => a + (p.total || 0), 0);
      const faturamentoMes  = mes.reduce((a: number, p: any) => a + (p.total || 0), 0);
      const ticketMedio     = mes.length > 0 ? faturamentoMes / mes.length : 0;

      setStats(p => ({ ...p, pedidosHoje: hoje.length, receitaHoje, pedidosMes: mes.length, faturamentoMes, ticketMedio }));
      setLoadingStats(false);
    });

    // Fãs (pontos na loja)
    getDocs(query(collection(db, `tenants/${slug}/pontos`))).then(snap => {
      setStats(p => ({ ...p, totalFas: snap.size }));
    }).catch(() => {});

    return unsub;
  }, [userData?.lojistaOf]);

  // Carrega vendas de balcão de hoje
  useEffect(() => {
    const slug = userData?.lojistaOf;
    if (!slug) return;
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, `tenants/${slug}/vendas-balcao`),
      where("createdAt", ">=", Timestamp.fromDate(inicioDia)),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, snap => {
      setVendasBalcaoHoje(snap.docs.map(d => ({ id: d.id, ...d.data() } as VendaBalcao)));
    });
  }, [userData?.lojistaOf]);

  // Carrega todas as vendas de balcão (histórico completo)
  useEffect(() => {
    const slug = userData?.lojistaOf;
    if (!slug) return;
    const q = query(collection(db, `tenants/${slug}/vendas-balcao`), orderBy("createdAt", "desc"), limit(500));
    return onSnapshot(q, snap => {
      setTodasVendasBalcao(snap.docs.map(d => ({ id: d.id, ...d.data() } as VendaBalcao)));
    });
  }, [userData?.lojistaOf]);

  const receitaBalcaoHoje = vendasBalcaoHoje.reduce((s, v) => s + (v.total || 0), 0);

  // Agrupa vendas por dia para o card histórico
  const vendasPorDia = todasVendasBalcao.reduce((acc, v) => {
    const data = v.createdAt?.toDate ? v.createdAt.toDate() : new Date();
    const chave = data.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
    if (!acc[chave]) acc[chave] = { vendas: [], total: 0, data };
    acc[chave].vendas.push(v);
    acc[chave].total += v.total || 0;
    return acc;
  }, {} as Record<string, { vendas: VendaBalcao[]; total: number; data: Date }>);

  const diasOrdenados = Object.entries(vendasPorDia).sort((a, b) => b[1].data.getTime() - a[1].data.getTime());

  const totalBalcaoMes = todasVendasBalcao.filter(v => {
    const d = v.createdAt?.toDate ? v.createdAt.toDate() : new Date();
    const agora = new Date();
    return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
  }).reduce((s, v) => s + (v.total || 0), 0);

  const toggleChatAberto = async () => {
    if (!lojaDocId) return;
    const novo = !chatAberto;
    setChatAberto(novo);
    await updateDoc(doc(db, "lojas", lojaDocId), { chatAberto: novo }).catch(() => {});
  };

  const salvarPlaceId = async (placeId: string) => {
    if (!lojaDocId) return;
    setSalvandoPlaceId(true);
    try {
      await updateDoc(doc(db, "lojas", lojaDocId), { placeId });
      setLoja(prev => prev ? { ...prev, placeId } : prev);
      setVinculandoMaps(false);
    } catch (e) {
      console.error("Erro ao salvar placeId:", e);
    } finally {
      setSalvandoPlaceId(false);
    }
  };

  if (loadingLoja) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080412" }}>
      <div style={{ width: 36, height: 36, border: "3px solid rgba(245,197,24,0.3)", borderTop: "3px solid #f5c518", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!userData?.lojistaOf) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: "#080412", textAlign: "center" }}>
      <div style={{ fontSize: "3.5rem", marginBottom: 16 }}>🏪</div>
      <h2 style={{ fontFamily: "'Fraunces', serif", color: "#f5c518", marginBottom: 8, fontSize: "1.5rem" }}>Nenhuma loja ainda</h2>
      <p style={{ color: "rgba(255,255,255,0.45)", marginBottom: 28, fontSize: "0.88rem" }}>Crie sua loja e comece a vender na maior rede social de delivery do Brasil.</p>
      <Link to="/lojista/cadastro" style={{ padding: "14px 28px", background: "linear-gradient(135deg, #f5c518, #e6a817)", borderRadius: 14, fontWeight: 800, color: "#0a0414", fontSize: "0.95rem", textDecoration: "none" }}>
        Criar minha loja →
      </Link>
    </div>
  );

  const slug = userData.lojistaOf;

  return (
    <div style={{ background: "#080412", minHeight: "100vh", fontFamily: "'Outfit', sans-serif", paddingBottom: 90, width: "100%" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.85)}}
        @keyframes count-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* ── CAPA + HEADER ───────────────────────────────────── */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        <div style={{
          height: 140,
          background: loja?.capa ? `url(${loja.capa}) center/cover` : "linear-gradient(135deg, #1a0a36, #2d1b69, #1a0a36)",
        }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(8,4,18,0.3) 0%, rgba(8,4,18,0.85) 100%)" }} />
        </div>

        {/* Ação voltar */}
        <button onClick={() => navigate("/")} style={{ position: "absolute", top: 12, left: 12, width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>←</button>

        {/* Toggles: loja + chat */}
        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <button onClick={() => setLojaAberta(p => !p)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "5px 10px",
            background: lojaAberta ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${lojaAberta ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
            borderRadius: 20, cursor: "pointer",
            color: lojaAberta ? "#22c55e" : "#ef4444",
            fontSize: "0.7rem", fontWeight: 700,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: lojaAberta ? "#22c55e" : "#ef4444", animation: lojaAberta ? "pulse-dot 1.5s infinite" : "none" }} />
            {lojaAberta ? "Aberta" : "Fechada"}
          </button>
          <button onClick={toggleChatAberto} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "5px 10px",
            background: chatAberto ? "rgba(124,58,237,0.18)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${chatAberto ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.12)"}`,
            borderRadius: 20, cursor: "pointer",
            color: chatAberto ? "#a78bfa" : "rgba(255,255,255,0.35)",
            fontSize: "0.7rem", fontWeight: 700,
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {chatAberto ? "Chat aberto" : "Chat fechado"}
            {chatNaoLido > 0 && <span style={{ background: "#ef4444", borderRadius: 10, padding: "0 5px", fontSize: "0.6rem", color: "#fff" }}>{chatNaoLido}</span>}
          </button>
        </div>

        {/* Info da loja */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 16px 16px", display: "flex", alignItems: "flex-end", gap: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, border: "2px solid rgba(245,197,24,0.4)", overflow: "hidden", background: "#1a0a36", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem" }}>
            {loja?.logo ? <img src={loja.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🏪"}
          </div>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.15rem", fontWeight: 900, color: "#fff" }}>{loja?.nome || "Minha Loja"}</div>
            <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {loja?.categoria || "Delivery"} · nexfoody.com/loja/{slug}
            </div>
          </div>
        </div>
      </div>

      {/* ── LIVRO CAIXA — botões abaixo do título ── */}
      {lojaAberta && (
        <div style={{ padding: "12px 16px 0", display: "flex", gap: 8 }}>
          <button onClick={() => { setCaixaAba("venda"); setCaixaOpen(true); }} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 0", background: "linear-gradient(135deg, #22c55e, #16a34a)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer", fontFamily: "'Outfit', sans-serif", boxShadow: "0 3px 14px rgba(34,197,94,0.35)" }}>
            <span>📝</span> Registrar Venda
          </button>
          <button onClick={() => { setCaixaAba("retirada"); setCaixaOpen(true); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 18px", background: "linear-gradient(135deg, #ef4444, #dc2626)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer", fontFamily: "'Outfit', sans-serif", boxShadow: "0 3px 14px rgba(239,68,68,0.35)" }}>
            <span>💸</span> Retirada
          </button>
        </div>
      )}

      {/* ── MÉTRICAS HOJE ───────────────────────────────────── */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)" }}>Hoje em tempo real</div>
          {receitaBalcaoHoje > 0 && (
            <div style={{ display: "flex", gap: 8, fontSize: "0.6rem" }}>
              <span style={{ color: "rgba(96,165,250,0.7)" }}>🌐 {fmt(stats.receitaHoje)}</span>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
              <span style={{ color: "rgba(34,197,94,0.7)" }}>🏪 {fmt(receitaBalcaoHoje)}</span>
            </div>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { icon: "💰", val: loadingStats ? "..." : fmt(stats.receitaHoje + receitaBalcaoHoje), label: "Receita hoje", cor: "#22c55e", bg: "rgba(34,197,94,0.08)" },
            { icon: "📦", val: loadingStats ? "..." : `${stats.pedidosHoje + vendasBalcaoHoje.length}`, label: "Vendas hoje", cor: "#60a5fa", bg: "rgba(96,165,250,0.08)" },
            { icon: "❤️", val: loadingStats ? "..." : `${stats.totalFas}`, label: "Total de Fãs", cor: "#f472b6", bg: "rgba(244,114,182,0.08)" },
            { icon: "🎯", val: loadingStats ? "..." : fmt(stats.ticketMedio), label: "Ticket médio", cor: "#f5c518", bg: "rgba(245,197,24,0.08)" },
          ].map((m, i) => (
            <div key={i} style={{ background: m.bg, border: `1px solid ${m.cor}22`, borderRadius: 16, padding: "14px 14px", display: "flex", alignItems: "center", gap: 10, animation: `count-up 0.4s ease ${i * 0.1}s both` }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${m.cor}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>{m.icon}</div>
              <div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: m.cor }}>{m.val}</div>
                <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Card Balcão de hoje */}
        {vendasBalcaoHoje.length > 0 && (
          <div style={{ marginTop: 10, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "1rem" }}>🏪</span>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#22c55e" }}>{vendasBalcaoHoje.length} venda{vendasBalcaoHoje.length > 1 ? "s" : ""} no balcão</div>
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{fmt(receitaBalcaoHoje)} · hoje</div>
                </div>
              </div>
              <button onClick={() => setShowHistorico(p => !p)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 10px", fontSize: "0.65rem", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>
                {showHistorico ? "Fechar" : "Ver histórico"}
              </button>
            </div>
            {showHistorico && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {vendasBalcaoHoje.map(v => (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "rgba(0,0,0,0.2)", borderRadius: 10 }}>
                    <div>
                      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{v.produtos?.map((p: any) => `${p.qty}x ${p.nome}`).join(", ") || "Venda avulsa"}</div>
                      <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                        {v.pagamento === "dinheiro" ? "💵" : v.pagamento === "pix" ? "📲" : "💳"} {v.pagamento}
                        {v.createdAt?.toDate ? ` · ${v.createdAt.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#22c55e" }}>{fmt(v.total)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── RESUMO DO MÊS ───────────────────────────────────── */}
      {(() => {
        const plano = [...planos].sort((a,b) => (a.ordem||0)-(b.ordem||0)).find(p => stats.pedidosMes <= p.limite) || planos[planos.length-1];
        const mesAtual = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        const proximoPlano = planos.find(p => (p.ordem||0) > (plano.ordem||0));
        const pctLimite = plano.limite < 9999 ? Math.min(100, Math.round(stats.pedidosMes / plano.limite * 100)) : 100;

        return (
          <div style={{ padding: "16px 16px 0" }}>
            <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
              Resumo de {mesAtual}
            </div>

            {/* Stats do mês */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              {[
                { label: "Pedidos", val: loadingStats ? "..." : `${stats.pedidosMes}`, cor: "#60a5fa" },
                { label: "Faturamento", val: loadingStats ? "..." : fmt(stats.faturamentoMes), cor: "#22c55e" },
                { label: "Ticket médio", val: loadingStats ? "..." : fmt(stats.ticketMedio), cor: "#f5c518" },
              ].map((s, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
                  <div style={{ fontWeight: 900, fontSize: "0.95rem", color: s.cor }}>{s.val}</div>
                  <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,.3)", textTransform: "uppercase", marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Plano atual + fatura estimada */}
            <div style={{ background: `${plano.cor}10`, border: `1px solid ${plano.cor}30`, borderRadius: 16, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: `${plano.cor}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>📋</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "0.82rem", color: "#fff" }}>Plano {plano.label}</div>
                    <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,.35)", marginTop: 1 }}>
                      {plano.limite < 9999 ? `Até ${plano.limite} pedidos/mês` : "Pedidos ilimitados"}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 900, fontSize: "1rem", color: plano.cor }}>{fmt(plano.preco)}</div>
                  <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,.3)" }}>próx. fatura</div>
                </div>
              </div>

              {/* Barra de uso */}
              {plano.limite < 9999 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,.35)" }}>Uso do plano</span>
                    <span style={{ fontSize: "0.6rem", color: plano.cor, fontWeight: 700 }}>{stats.pedidosMes}/{plano.limite} pedidos · {pctLimite}%</span>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,.08)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pctLimite}%`, background: pctLimite >= 90 ? "#ef4444" : plano.cor, borderRadius: 4, transition: "width 0.6s ease" }} />
                  </div>
                  {pctLimite >= 80 && proximoPlano && (
                    <div style={{ marginTop: 8, fontSize: "0.65rem", color: "#f59e0b" }}>
                      ⚠️ Próximo do limite — considere o plano {proximoPlano.label} ({fmt(proximoPlano.preco)}/mês)
                    </div>
                  )}
                </div>
              )}

              <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,.25)", borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 8 }}>
                💳 Cobrança via PIX no painel · Vence dia 1º de cada mês
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── AÇÕES RÁPIDAS ───────────────────────────────────── */}
      <div style={{ padding: "20px 16px 0" }}>
        <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>Ações rápidas</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { icon: "➕", label: "Novo produto", cor: "#7c3aed" },
            { icon: "🎟️", label: "Criar cupom", cor: "#d97706" },
            { icon: "📸", label: "Novo post", cor: "#22c55e" },
          ].map((a, i) => (
            <button key={i} onClick={() => navigate(`/loja/${slug}/admin`)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "12px 6px", background: `${a.cor}12`, border: `1px solid ${a.cor}30`, borderRadius: 14, cursor: "pointer", transition: "all 0.2s" }}>
              <span style={{ fontSize: "1.3rem" }}>{a.icon}</span>
              <span style={{ fontSize: "0.62rem", fontWeight: 600, color: "rgba(255,255,255,0.6)", textAlign: "center", lineHeight: 1.2 }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── MENU GESTÃO ─────────────────────────────────────── */}
      <div style={{ padding: "20px 16px 0" }}>
        <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>Gerir loja</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {MENU.map((item, i) => (
            <Link key={i} to={item.href(slug)} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, padding: "12px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, transition: "all 0.2s" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: `${item.cor}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>{item.icon}</div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</div>
                <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── VER LOJA ────────────────────────────────────────── */}
      <div style={{ padding: "20px 16px 0" }}>
        <Link to={`/loja/${slug}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(245,197,24,0.1))", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 16, textDecoration: "none", color: "#fff", fontSize: "0.88rem", fontWeight: 600 }}>
          <span>👁️</span> Ver loja como cliente
        </Link>
      </div>

      {/* ── VINCULAR AO GOOGLE MAPS ──────────────────────────── */}
      <div style={{ padding: "16px 16px 0" }}>
        {loja?.placeId ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.2)", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1rem" }}>📍</span>
              <div>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#22c55e" }}>Vinculada ao Google Maps</div>
                <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.35)", marginTop: 1 }}>Sua loja aparece corretamente no mapa NexFoody</div>
              </div>
            </div>
            <button
              onClick={() => setVinculandoMaps(true)}
              style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, padding: "5px 10px", fontSize: "0.65rem", color: "rgba(255,255,255,.4)", cursor: "pointer" }}
            >
              Alterar
            </button>
          </div>
        ) : (
          <div style={{ background: "rgba(245,197,24,.07)", border: "1px solid rgba(245,197,24,.22)", borderRadius: 14, padding: "14px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: vinculandoMaps ? 12 : 0 }}>
              <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>📍</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#f5c518", marginBottom: 3 }}>Vincule sua loja ao Google Maps</div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.45)", lineHeight: 1.6 }}>
                  Sem vínculo, outras lojas com nome parecido podem aparecer como cadastradas no mapa.
                </div>
              </div>
              {!vinculandoMaps && (
                <button
                  onClick={() => setVinculandoMaps(true)}
                  style={{ background: "linear-gradient(135deg,#f5c518,#e6a817)", border: "none", borderRadius: 10, padding: "7px 12px", fontSize: "0.72rem", fontWeight: 800, color: "#0a0414", cursor: "pointer", flexShrink: 0 }}
                >
                  Vincular
                </button>
              )}
            </div>
            {vinculandoMaps && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <PlaceSearch
                  placeholder="Busque o nome da sua loja..."
                  onSelect={(id) => salvarPlaceId(id)}
                />
                {salvandoPlaceId && (
                  <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.4)", textAlign: "center" }}>Salvando...</div>
                )}
                <button
                  onClick={() => setVinculandoMaps(false)}
                  style={{ background: "none", border: "none", fontSize: "0.68rem", color: "rgba(255,255,255,.3)", cursor: "pointer", padding: "4px 0" }}
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CHAT CLIENTES ───────────────────────────────────── */}
      {abaAtiva === "chat" && (
        <div style={{ padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Mensagens de clientes</span>
            {chatNaoLido > 0 && <span style={{ background: "#ef4444", borderRadius: 10, padding: "1px 7px", fontSize: "0.62rem", fontWeight: 800, color: "#fff" }}>{chatNaoLido}</span>}
          </div>

          {!chatAberto && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, padding: "12px 14px", marginBottom: 14, display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: "1.1rem" }}>💬</span>
              <div>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fca5a5" }}>Chat fechado</div>
                <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Ative o "Chat aberto" no topo para receber mensagens</div>
              </div>
            </div>
          )}

          {chatsClientes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 0", color: "rgba(255,255,255,0.25)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>💬</div>
              <div style={{ fontSize: "0.82rem" }}>Nenhuma conversa ainda</div>
            </div>
          ) : chatsClientes.map((conv: any) => {
            const lojaVirtualId = `loja_${lojaDocId}`;
            const userId = conv.participantes?.find((p: string) => p !== lojaVirtualId);
            const userInfo = conv.participantesInfo?.[userId] || {};
            const naoLido = conv.naoLido?.[lojaVirtualId] || 0;
            return (
              <div key={conv.id} onClick={() => navigate(`/chat/${conv.id}`)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", background: naoLido > 0 ? "rgba(124,58,237,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${naoLido > 0 ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius: 14, marginBottom: 8, cursor: "pointer" }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", fontWeight: 800, color: "#fff" }}>
                  {userInfo.foto ? <img src={userInfo.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : userInfo.nome?.[0]?.toUpperCase() || "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: naoLido > 0 ? 800 : 600, fontSize: "0.85rem", color: "#fff" }}>{userInfo.nome || "Cliente"}</div>
                  <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {conv.ultimaMensagem?.texto || "Nova conversa"}
                  </div>
                </div>
                {naoLido > 0 && (
                  <div style={{ minWidth: 20, height: 20, borderRadius: 10, background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", color: "#fff", fontWeight: 800, padding: "0 5px" }}>
                    {naoLido}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {abaAtiva === "painel" && (
        /* ── FEED RULES ──────────────────────────────────────── */
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", animation: "pulse-dot 1.5s infinite" }} />
            <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", fontWeight: 700 }}>
              Feed NexFoody · Sua cidade
            </div>
          </div>
          <FeedRulesPanel tenantId={slug} />
        </div>
      )}

      {/* ── CARD VENDAS NO BALCÃO ───────────────────────────── */}
      <div style={{ padding: "20px 16px 0" }}>
        <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>Vendas no balcão</div>
        <div style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 18, overflow: "hidden" }}>
          {/* Header do card */}
          <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(34,197,94,0.1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>🏪</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "#fff" }}>Balcão · este mês</div>
                <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{todasVendasBalcao.filter(v => { const d = v.createdAt?.toDate?.(); const n = new Date(); return d && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).length} vendas registradas</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 900, fontSize: "1.05rem", color: "#22c55e" }}>R$ {totalBalcaoMes.toFixed(2).replace(".", ",")}</div>
              <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>faturamento</div>
            </div>
          </div>
          {/* Empty state */}
          {todasVendasBalcao.length === 0 && (
            <div style={{ padding: "28px 16px", textAlign: "center" }}>
              <div style={{ fontSize: "1.8rem", marginBottom: 8 }}>🏪</div>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>Nenhuma venda no balcão ainda</div>
              <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.2)", marginTop: 4 }}>Use o botão verde flutuante para registrar</div>
            </div>
          )}
          {/* Dias */}
          {diasOrdenados.map(([dia, info], i) => {
            const isHoje = i === 0 && info.data.toDateString() === new Date().toDateString();
            const pagtos = info.vendas.reduce((acc, v) => { acc[v.pagamento] = (acc[v.pagamento] || 0) + (v.total || 0); return acc; }, {} as Record<string, number>);
            return (
              <div key={dia} style={{ padding: "12px 16px", borderBottom: i < diasOrdenados.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {isHoje && <span style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: 20, padding: "1px 7px", fontSize: "0.55rem", fontWeight: 800, color: "#22c55e" }}>HOJE</span>}
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff", textTransform: "capitalize" }}>{dia}</span>
                    <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)" }}>{info.vendas.length} venda{info.vendas.length > 1 ? "s" : ""}</span>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "#22c55e" }}>R$ {info.total.toFixed(2).replace(".", ",")}</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(pagtos).map(([pag, val]) => (
                    <span key={pag} style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.05)", borderRadius: 20, padding: "2px 8px" }}>
                      {pag === "dinheiro" ? "💵" : pag === "pix" ? "📲" : "💳"} R$ {(val as number).toFixed(2).replace(".", ",")}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <PDVDrawer tenantId={slug} nomeLoja={loja?.nome || "Minha Loja"} open={caixaOpen} aba={caixaAba} onClose={() => setCaixaOpen(false)} onChangeAba={setCaixaAba} />


      {/* ── BOTTOM NAV ──────────────────────────────────────── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(8,4,18,0.97)", backdropFilter: "blur(12px)", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", zIndex: 100 }}>
        {/* Painel */}
        <button onClick={() => setAbaAtiva("painel")} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 0", background: "none", border: "none", color: abaAtiva === "painel" ? "#f5c518" : "rgba(255,255,255,0.3)", fontSize: "0.6rem", fontWeight: 600, cursor: "pointer" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          Painel
        </button>
        {/* Pedidos */}
        <button onClick={() => navigate(`/loja/${slug}/admin`)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 0", background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: "0.6rem", fontWeight: 600, cursor: "pointer" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8h14M5 8a2 2 0 1 0-4 0 2 2 0 0 0 4 0zm14 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM5 8l1 8h12l1-8"/><path d="M10 12h4"/></svg>
          Pedidos
        </button>
        {/* Chat */}
        <button onClick={() => setAbaAtiva("chat")} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 0", background: "none", border: "none", color: abaAtiva === "chat" ? "#a78bfa" : "rgba(255,255,255,0.3)", fontSize: "0.6rem", fontWeight: 600, cursor: "pointer", position: "relative" }}>
          <div style={{ position: "relative" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {chatNaoLido > 0 && <span style={{ position: "absolute", top: -4, right: -6, background: "#ef4444", borderRadius: 10, padding: "0 4px", fontSize: "0.5rem", fontWeight: 800, color: "#fff", minWidth: 14, textAlign: "center" }}>{chatNaoLido}</span>}
          </div>
          Chat
        </button>
        {/* Cardápio */}
        <button onClick={() => navigate(`/loja/${slug}/admin`)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 0", background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: "0.6rem", fontWeight: 600, cursor: "pointer" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
          Cardápio
        </button>
        {/* Fãs */}
        <button onClick={() => navigate(`/loja/${slug}/admin`)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 0", background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: "0.6rem", fontWeight: 600, cursor: "pointer" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Fãs
        </button>
      </div>
    </div>
  );
}
