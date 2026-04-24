import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, Timestamp, addDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

interface LojaCard {
  slug: string;
  nome: string;
  logo: string;
  ativo: boolean;
  pedidosHoje: number;
  receitaHoje: number;
  plano?: string;
  planoExpiraEm?: Date | null;
  metaFaturamento?: number;
  pedidoPendente?: number;
  receitaOntem?: number;
  pedidosOntem?: number;
  clientesNovos?: number;
  pedidoRecente?: { numero: number; status: string; nomeCliente: string } | null;
}

function fmt(v: number) {
  if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
  return `R$${v.toFixed(0)}`;
}
function fmtFull(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}
function pct(a: number, b: number) {
  if (!b) return null;
  const p = ((a - b) / b) * 100;
  return { val: Math.abs(p).toFixed(0), up: p >= 0 };
}

export default function LojistaHub() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [lojas, setLojas] = useState<LojaCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!userData?.uid) return;
    getDocs(query(collection(db, "lojas"), where("ownerId", "==", userData.uid))).then(snap => {
      const lista = snap.docs.map(d => {
        const data = d.data();
        return {
          slug: data.slug || data.tenantId,
          nome: data.nome || data.tenantId,
          logo: data.logo || "",
          ativo: data.ativo ?? true,
          pedidosHoje: 0,
          receitaHoje: 0,
          plano: data.plano,
          planoExpiraEm: data.planoExpiraEm?.toDate?.() ?? null,
          metaFaturamento: 1500,
          pedidoPendente: 0,
          receitaOntem: 0,
          pedidosOntem: 0,
          clientesNovos: 0,
          pedidoRecente: null,
        } as LojaCard;
      });
      setLojas(lista);
      setLoading(false);
    });
  }, [userData?.uid]);

  // Listener HOJE + ONTEM por loja
  useEffect(() => {
    if (lojas.length === 0) return;
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const inicioOntem = new Date(inicioHoje);
    inicioOntem.setDate(inicioOntem.getDate() - 1);

    const unsubs = lojas.map((loja, idx) => {
      const qHoje = query(
        collection(db, "pedidos"),
        where("tenantId", "==", loja.slug),
        where("createdAt", ">=", Timestamp.fromDate(inicioHoje)),
        orderBy("createdAt", "desc"),
        limit(200)
      );
      const qOntem = query(
        collection(db, "pedidos"),
        where("tenantId", "==", loja.slug),
        where("createdAt", ">=", Timestamp.fromDate(inicioOntem)),
        where("createdAt", "<", Timestamp.fromDate(inicioHoje)),
        limit(200)
      );

      const unsub1 = onSnapshot(qHoje, snap => {
        const peds = snap.docs.filter(d => d.data().status !== "cancelado");
        const pendentes = peds.filter(d => d.data().status === "pendente");
        const primeiro = snap.docs[0]?.data();
        setLojas(prev => prev.map((l, i) =>
          i === idx ? {
            ...l,
            pedidosHoje: peds.length,
            receitaHoje: peds.reduce((s, d) => s + (d.data().total || 0), 0),
            pedidoPendente: pendentes.length,
            pedidoRecente: primeiro ? { numero: primeiro.numeroPedido, status: primeiro.status, nomeCliente: primeiro.nomeCliente } : null,
          } : l
        ));
      });

      const unsub2 = onSnapshot(qOntem, snap => {
        const peds = snap.docs.filter(d => d.data().status !== "cancelado");
        setLojas(prev => prev.map((l, i) =>
          i === idx ? {
            ...l,
            receitaOntem: peds.reduce((s, d) => s + (d.data().total || 0), 0),
            pedidosOntem: peds.length,
          } : l
        ));
      });

      return () => { unsub1(); unsub2(); };
    });

    return () => unsubs.forEach(u => u());
  }, [lojas.length]);

  const toggleLoja = async (loja: LojaCard) => {
    setToggling(loja.slug);
    try {
      await updateDoc(doc(db, "lojas", loja.slug), { ativo: !loja.ativo });
      setLojas(prev => prev.map(l => l.slug === loja.slug ? { ...l, ativo: !l.ativo } : l));
    } catch {}
    setToggling(null);
  };

  const statsTotais = {
    pedidos: lojas.reduce((s, l) => s + l.pedidosHoje, 0),
    receita: lojas.reduce((s, l) => s + l.receitaHoje, 0),
  };

  // Ranking por faturamento
  const ranking = [...lojas].sort((a, b) => b.receitaHoje - a.receitaHoje);

  // Crescimento por loja
  const crescimento = (l: LojaCard) => pct(l.receitaHoje, l.receitaOntem || 0);

  // Alertas críticos
  const alertas = [
    ...lojas.filter(l => !l.ativo && (l.pedidoPendente ?? 0) > 0).map(l => `🔴 ${l.nome} — pausada com ${l.pedidoPendente} pedido(s) pendente(s)`),
    ...lojas.filter(l => l.ativo && l.pedidosHoje === 0).map(l => `🔴 ${l.nome} — sem vendas hoje`),
    ...lojas.filter(l => {
      const variacao = pct(l.receitaHoje, l.receitaOntem || 0);
      return variacao && !variacao.up && parseFloat(variacao.val) >= 30;
    }).map(l => `⚠️ ${l.nome} — ${pct(l.receitaHoje, l.receitaOntem || 0)?.val}% abaixo de ontem`),
  ];

  // Qual loja mais vendeu
  const lojaTop = ranking[0];

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "rgba(255,255,255,.4)", fontSize: "0.9rem" }}>Carregando suas lojas...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Outfit', sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(135deg, var(--bg) 0%, var(--bg2) 100%)", borderBottom: "1px solid rgba(245,197,24,.15)", padding: "20px 16px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "1.4rem" }}>🏪</span>
                <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "1.3rem", color: "#f5c518", margin: 0 }}>Hub de Lojas — Nexfoody</h1>
              </div>
              <p style={{ color: "rgba(255,255,255,.35)", fontSize: "0.72rem", margin: "3px 0 0" }}>Controle total das suas lojas em tempo real</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ background: "rgba(245,197,24,.1)", border: "1px solid rgba(245,197,24,.2)", borderRadius: 12, padding: "8px 14px", textAlign: "center" }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#f5c518" }}>{statsTotais.pedidos}</div>
                <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,.4)" }}>pedidos</div>
              </div>
              <div style={{ background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.2)", borderRadius: 12, padding: "8px 14px", textAlign: "center" }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#22c55e" }}>{fmt(statsTotais.receita)}</div>
                <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,.4)" }}>faturamento</div>
              </div>
            </div>
          </div>

          {/* Barra meta total */}
          {(() => {
            const metaTotal = 1500 * lojas.length;
            const pct_ = Math.min((statsTotais.receita / metaTotal) * 100, 100);
            return (
              <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#22c55e" }}>🎯 META DIÁRIA TOTAL</span>
                  <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.4)" }}>{fmt(statsTotais.receita)} / {fmt(metaTotal)}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,.08)" }}>
                  <div style={{ height: "100%", width: `${pct_}%`, background: pct_ >= 100 ? "linear-gradient(90deg,#22c55e,#4ade80)" : "linear-gradient(90deg,#22c55e,#86efac)", borderRadius: 4, transition: "width .4s", boxShadow: "0 0 10px rgba(34,197,94,.4)" }} />
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "16px 16px 40px" }}>

        {/* ── LAYOUT: COLUNA PRINCIPAL + RANKING ── */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

          {/* ── COLUNA PRINCIPAL ── */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Alertas Críticos */}
            {alertas.length > 0 && (
              <div style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 14, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#ef4444", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>🚨 Alertas Críticos</div>
                {alertas.map((a, i) => (
                  <div key={i} style={{ fontSize: "0.78rem", color: "#ef4444", marginBottom: 4, fontWeight: 600 }}>{a}</div>
                ))}
              </div>
            )}

            {/* Crescimento + Status lado a lado */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              {/* Crescimento */}
              <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: "14px" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>📈 Crescimento</div>
                {lojas.slice(0, 4).map(loja => {
                  const crsc = crescimento(loja);
                  return (
                    <div key={loja.slug} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{loja.nome}</span>
                      {crsc ? (
                        <span style={{ fontSize: "0.68rem", fontWeight: 800, color: crsc.up ? "#22c55e" : "#ef4444" }}>
                          {crsc.up ? "🟢" : "🔴"} {crsc.val}%
                        </span>
                      ) : <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.25)" }}>—</span>}
                    </div>
                  );
                })}
              </div>

              {/* Status das Lojas */}
              <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: "14px" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>🟢 Status das Lojas</div>
                {lojas.slice(0, 4).map(loja => (
                  <div key={loja.slug} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.6)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loja.nome}</span>
                    <button
                      onClick={() => toggleLoja(loja)}
                      disabled={toggling === loja.slug}
                      style={{
                        padding: "3px 10px", borderRadius: 20, border: "none", cursor: "pointer",
                        fontSize: "0.65rem", fontWeight: 800,
                        background: loja.ativo ? "rgba(239,68,68,.15)" : "rgba(34,197,94,.15)",
                        color: loja.ativo ? "#ef4444" : "#22c55e",
                        transition: "all .15s",
                      }}
                    >
                      {toggling === loja.slug ? "..." : loja.ativo ? "🔴 Fechar" : "🟢 Abrir"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat Interno */}
            <HubChatSection lojas={lojas} userData={userData} />

            {/* Grid de Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {lojas.map(loja => {
                const crsc = crescimento(loja);
                const pctLoja = Math.min((loja.receitaHoje / (loja.metaFaturamento || 1500)) * 100, 100);
                return (
                  <div
                    key={loja.slug}
                    onClick={() => navigate(`/loja/${loja.slug}/admin`)}
                    style={{
                      background: loja.pedidoPendente && loja.ativo ? "rgba(245,197,24,.05)" : "rgba(255,255,255,.04)",
                      border: `1px solid ${loja.pedidoPendente && loja.ativo ? "rgba(245,197,24,.25)" : "rgba(255,255,255,.08)"}`,
                      borderRadius: 14, padding: 16, cursor: "pointer",
                      transition: "transform .15s, border-color .15s",
                      animation: loja.pedidoPendente && loja.ativo ? "pulseLoja 2s infinite" : "none",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                      (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(245,197,24,.3)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                      (e.currentTarget as HTMLDivElement).style.borderColor = loja.pedidoPendente && loja.ativo ? "rgba(245,197,24,.25)" : "rgba(255,255,255,.08)";
                    }}
                  >
                    <style>{`@keyframes pulseLoja { 0%,100%{border-color:rgba(245,197,24,.15)} 50%{border-color:rgba(245,197,24,.5)} }`}</style>

                    {/* Logo + nome */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      {loja.logo ? (
                        <img src={loja.logo} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(245,197,24,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>🏪</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: "0.78rem", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loja.nome}</div>
                        <div style={{ fontSize: "0.58rem", fontWeight: 700, color: loja.ativo ? "#22c55e" : "#ef4444" }}>
                          {loja.ativo ? "🟢 Aberta" : "🔴 Fechada"}
                        </div>
                        {loja.plano && (
                          <div style={{
                            fontSize: "0.55rem", fontWeight: 800,
                            color: loja.plano === "max" ? "#a855f7" : loja.plano === "pro" ? "#3b82f6" : "#22c55e",
                            marginTop: 2,
                          }}>
                            {loja.plano === "max" ? "🟣 MAX" : loja.plano === "pro" ? "🔵 PRO" : "🟢 BASIC"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      <div style={{ flex: 1, textAlign: "center", background: "rgba(255,255,255,.04)", borderRadius: 8, padding: "6px 4px" }}>
                        <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#f5c518" }}>{loja.pedidosHoje}</div>
                        <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,.35)", textTransform: "uppercase" }}>pedidos</div>
                      </div>
                      <div style={{ flex: 1, textAlign: "center", background: "rgba(255,255,255,.04)", borderRadius: 8, padding: "6px 4px" }}>
                        <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#22c55e" }}>{fmt(loja.receitaHoje)}</div>
                        <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,.35)", textTransform: "uppercase" }}>receita</div>
                      </div>
                      {crsc && (
                        <div style={{ flex: 1, textAlign: "center", background: "rgba(255,255,255,.04)", borderRadius: 8, padding: "6px 4px" }}>
                          <div style={{ fontSize: "0.9rem", fontWeight: 900, color: crsc.up ? "#22c55e" : "#ef4444" }}>{crsc.up ? "↑" : "↓"} {crsc.val}%</div>
                          <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,.35)", textTransform: "uppercase" }}>vs ontem</div>
                        </div>
                      )}
                    </div>

                    {/* Barra meta */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span style={{ fontSize: "0.55rem", color: "rgba(255,255,255,.4)" }}>meta</span>
                        <span style={{ fontSize: "0.55rem", fontWeight: 800, color: pctLoja >= 100 ? "#4ade80" : "#22c55e" }}>{pctLoja.toFixed(0)}%</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,.08)" }}>
                        <div style={{ height: "100%", borderRadius: 3, width: `${pctLoja}%`, background: pctLoja >= 100 ? "#22c55e" : "#7c3aed", transition: "width .3s" }} />
                      </div>
                    </div>

                    {/* Ações */}
                    <div style={{ display: "flex", gap: 5 }}>
                      <div style={{ flex: 1, textAlign: "center", padding: "5px 0", background: "rgba(245,197,24,.08)", border: "1px solid rgba(245,197,24,.15)", borderRadius: 8 }}>
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#f5c518" }}>→ Gerenciar</span>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/loja/${loja.slug}/admin?tab=17`); }}
                        style={{
                          padding: "5px 8px", background: "rgba(6,182,212,.1)", border: "1px solid rgba(6,182,212,.25)",
                          borderRadius: 8, cursor: "pointer", color: "#22d3ee",
                          fontSize: "0.65rem", fontWeight: 700,
                        }}
                      >
                        💬
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── COLUNA RANKING ── */}
          <div style={{ width: 260, flexShrink: 0 }}>
            <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: "16px", position: "sticky", top: 16 }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>🏆 Ranking do Dia</div>
              {ranking.map((loja, i) => {
                const medais = ["#f5c518", "#c0c0c0", "#cd7f32"];
                const crsc = crescimento(loja);
                return (
                  <div key={loja.slug} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "8px 10px", background: i === 0 ? "rgba(245,197,24,.08)" : "rgba(255,255,255,.02)", borderRadius: 10 }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 900, width: 16, color: medais[i] || "rgba(255,255,255,.3)" }}>#{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.72rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loja.nome}</div>
                      <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,.06)", marginTop: 4 }}>
                        <div style={{ height: "100%", borderRadius: 2, background: medais[i] || "#7c3aed", width: `${(loja.receitaHoje / (ranking[0]?.receitaHoje || 1)) * 100}%`, transition: "width .3s" }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: "0.72rem", color: "#22c55e" }}>{fmt(loja.receitaHoje)}</div>
                      {crsc && (
                        <div style={{ fontSize: "0.55rem", fontWeight: 700, color: crsc.up ? "#22c55e" : "#ef4444" }}>
                          {crsc.up ? "↑" : "↓"} {crsc.val}%
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {lojas.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,.3)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🏪</div>
            <p style={{ fontSize: "0.88rem" }}>Nenhuma loja cadastrada ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CHAT INTERNO ──
function HubChatSection({ lojas, userData }: { lojas: LojaCard[]; userData: any }) {
  const [chatAberto, setChatAberto] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [convList, setConvList] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [openChats, setOpenChats] = useState<Record<string, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  // Carrega todas conversas do lojista
  useEffect(() => {
    if (!userData?.uid) return;
    const q = query(
      collection(db, "chats"),
      where("participantes", "array-contains", userData.uid),
      orderBy("updatedAt", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(q, snap => {
      setConvList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [userData?.uid]);

  // Abre/fecha chat de uma loja
  const toggleChat = (lojaSlug: string) => {
    const novo = { ...openChats, [lojaSlug]: !openChats[lojaSlug] };
    setOpenChats(novo);
    if (!openChats[lojaSlug]) {
      const lojaVirtualId = `loja_${lojaSlug}`;
      const conv = convList.find(c =>
        c.participantes?.includes(userData?.uid) && c.participantes?.includes(lojaVirtualId)
      );
      if (conv) {
        setChatAberto(conv.id);
        loadMensagens(conv.id);
      } else {
        setChatAberto(null);
        setMensagens([]);
      }
    }
  };

  const loadMensagens = (chatId: string) => {
    setLoadingChat(true);
    const q = query(collection(db, "chats", chatId, "mensagens"), orderBy("createdAt", "asc"), limit(100));
    onSnapshot(q, snap => {
      setMensagens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingChat(false);
    });
  };

  const enviarMsg = async (lojaSlug: string) => {
    if (!msg.trim() || !chatAberto) return;
    const lojaVirtualId = `loja_${lojaSlug}`;
    await addDoc(collection(db, "chats", chatAberto, "mensagens"), {
      texto: msg.trim(),
      autorId: userData.uid,
      autorNome: userData.nome || "Dono",
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "chats", chatAberto), { updatedAt: serverTimestamp() });
    setMsg("");
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  // Lista de conversas por loja virtual
  const chatsPorLoja = lojas.map(loja => {
    const lojaVirtualId = `loja_${loja.slug}`;
    const conv = convList.find(c =>
      c.participantes?.includes(userData?.uid) && c.participantes?.includes(lojaVirtualId)
    );
    return { ...loja, lojaVirtualId, conv };
  });

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>💬 Comunicação Interna</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
        {chatsPorLoja.map(({ slug, nome, logo, conv }) => (
          <div key={slug} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, overflow: "hidden" }}>
            {/* Header da loja */}
            <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              {logo ? <img src={logo} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} /> : <span style={{ fontSize: "1rem" }}>🏪</span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.78rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</div>
                <div style={{ fontSize: "0.6rem", color: conv ? "#22d3ee" : "rgba(255,255,255,.3)" }}>{conv ? "💬 Conversa aberta" : "Sem conversa ainda"}</div>
              </div>
              <button
                onClick={() => toggleChat(slug)}
                style={{
                  padding: "4px 10px", borderRadius: 20, border: "none", cursor: "pointer",
                  background: openChats[slug] ? "rgba(6,182,212,.2)" : "rgba(6,182,212,.1)",
                  color: "#22d3ee", fontSize: "0.65rem", fontWeight: 800,
                }}
              >
                {openChats[slug] ? "✕ Fechar" : "💬 Chat"}
              </button>
            </div>

            {/* Chat aberto */}
            {openChats[slug] && (
              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8, maxHeight: 260 }}>
                {loadingChat ? (
                  <div style={{ textAlign: "center", color: "rgba(255,255,255,.3)", fontSize: "0.72rem", padding: 10 }}>Carregando...</div>
                ) : mensagens.length === 0 ? (
                  <div style={{ textAlign: "center", color: "rgba(255,255,255,.25)", fontSize: "0.72rem", padding: "8px 0" }}>
                    Nenhuma mensagem ainda.<br />Diga olá para o gerente! 👋
                  </div>
                ) : (
                  <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, maxHeight: 160 }}>
                    {mensagens.map(m => (
                      <div key={m.id} style={{
                        alignSelf: m.autorId === userData.uid ? "flex-end" : "flex-start",
                        background: m.autorId === userData.uid ? "rgba(6,182,212,.2)" : "rgba(255,255,255,.06)",
                        borderRadius: "10px 10px 10px 3px",
                        padding: "6px 10px",
                        maxWidth: "85%",
                      }}>
                        <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#22d3ee", marginBottom: 2 }}>{m.autorNome}</div>
                        <div style={{ fontSize: "0.75rem", color: "#fff" }}>{m.texto}</div>
                      </div>
                    ))}
                    <div ref={bottomRef} />
                  </div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    value={msg}
                    onChange={e => setMsg(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && enviarMsg(slug)}
                    placeholder="Digite..."
                    style={{
                      flex: 1, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)",
                      borderRadius: 20, padding: "6px 12px", color: "#fff",
                      fontSize: "0.75rem", outline: "none",
                    }}
                  />
                  <button
                    onClick={() => enviarMsg(slug)}
                    disabled={!msg.trim()}
                    style={{
                      width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer",
                      background: msg.trim() ? "rgba(6,182,212,.3)" : "rgba(255,255,255,.04)",
                      color: msg.trim() ? "#22d3ee" : "rgba(255,255,255,.2)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem",
                    }}
                  >
                    ➤
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
