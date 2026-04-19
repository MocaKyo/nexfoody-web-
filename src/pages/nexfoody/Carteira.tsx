// src/pages/nexfoody/Carteira.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  collection, doc, getDoc, getDocs, query, where,
  setDoc, addDoc, serverTimestamp, orderBy,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { motion, AnimatePresence } from "framer-motion";

// ─── Tipos ───────────────────────────────────────────────────
interface Carteira {
  saldoDisponivel: number;
  saldoPendente: number;
  totalGanho: number;
  totalSacado: number;
  pixKey: string;
  pixTipo: string;
  lojasAtivas: number;
}

interface Convite {
  id: string;
  nomeLoja: string;
  lojaPlaceId: string;
  status: "enviado" | "cadastrado" | "ativo";
  creditoCadastro: number;
  creditoPrimeiroPedido: number;
  recorrenteAcumulado: number;
  createdAt: { toDate: () => Date } | null;
  lojaSlug?: string;
}

interface Saque {
  id: string;
  valor: number;
  pixKey: string;
  status: "pendente" | "processado" | "cancelado";
  createdAt: { toDate: () => Date } | null;
}

// ─── Níveis ───────────────────────────────────────────────────
const NIVEIS = [
  { nome: "Explorador",  min: 0,  max: 4,  cor: "#94a3b8", bg: "rgba(148,163,184,.1)",  ganho: 20, icon: "🌱" },
  { nome: "Conector",    min: 5,  max: 14, cor: "#60a5fa", bg: "rgba(96,165,250,.1)",    ganho: 25, icon: "🔗" },
  { nome: "Embaixador",  min: 15, max: 999, cor: "#f5c518", bg: "rgba(245,197,24,.12)",  ganho: 30, icon: "👑" },
];

function getNivel(lojasAtivas: number) {
  return NIVEIS.find(n => lojasAtivas >= n.min && lojasAtivas <= n.max) || NIVEIS[0];
}

function getProximoNivel(lojasAtivas: number) {
  const idx = NIVEIS.findIndex(n => lojasAtivas >= n.min && lojasAtivas <= n.max);
  return idx < NIVEIS.length - 1 ? NIVEIS[idx + 1] : null;
}

const STATUS_INFO = {
  enviado:    { label: "Aguardando cadastro", cor: "#f59e0b", bg: "rgba(245,158,11,.1)",  icon: "🟡" },
  cadastrado: { label: "Aguardando 1º pedido", cor: "#60a5fa", bg: "rgba(96,165,250,.1)", icon: "🔵" },
  ativo:      { label: "Ativo — ganhando!",    cor: "#22c55e", bg: "rgba(34,197,94,.1)",  icon: "🟢" },
};

const PIX_TIPOS = ["CPF/CNPJ", "E-mail", "Telefone", "Chave aleatória"];

// ─── Componente principal ─────────────────────────────────────
export default function Carteira() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();

  const [carteira, setCarteira] = useState<Carteira | null>(null);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [saques, setSaques] = useState<Saque[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<"carteira" | "convites" | "saques">("carteira");

  // Modal saque
  const [modalSaque, setModalSaque] = useState(false);
  const [pixKey, setPixKey] = useState("");
  const [pixTipo, setPixTipo] = useState("CPF/CNPJ");
  const [valorSaque, setValorSaque] = useState("");
  const [salvandoSaque, setSalvandoSaque] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    carregarDados();
  }, [user]);

  const carregarDados = async () => {
    if (!user) return;
    setCarregando(true);
    try {
      // Carteira
      const carteiraSnap = await getDoc(doc(db, "carteiras", user.uid));
      if (carteiraSnap.exists()) {
        const data = carteiraSnap.data() as Carteira;
        setCarteira(data);
        setPixKey(data.pixKey || "");
        setPixTipo(data.pixTipo || "CPF/CNPJ");
      } else {
        setCarteira({ saldoDisponivel: 0, saldoPendente: 0, totalGanho: 0, totalSacado: 0, pixKey: "", pixTipo: "CPF/CNPJ", lojasAtivas: 0 });
      }

      // Convites
      const convitesSnap = await getDocs(
        query(collection(db, "convites"), where("embaixadorId", "==", user.uid), orderBy("createdAt", "desc"))
      );
      setConvites(convitesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Convite)));

      // Saques
      const saquesSnap = await getDocs(
        query(collection(db, "saques"), where("userId", "==", user.uid), orderBy("createdAt", "desc"))
      );
      setSaques(saquesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Saque)));
    } catch (e) {
      console.error("Erro ao carregar carteira:", e);
    } finally {
      setCarregando(false);
    }
  };

  const solicitarSaque = async () => {
    if (!user || !carteira) return;
    const valor = parseFloat(valorSaque.replace(",", "."));
    if (!pixKey.trim()) { setToastMsg("Informe sua chave PIX"); return; }
    if (isNaN(valor) || valor < 30) { setToastMsg("Valor mínimo de saque é R$ 30,00"); return; }
    if (valor > carteira.saldoDisponivel) { setToastMsg("Saldo insuficiente"); return; }

    setSalvandoSaque(true);
    try {
      await addDoc(collection(db, "saques"), {
        userId: user.uid,
        nomeUsuario: userData?.nome || user.displayName || "Usuário",
        valor,
        pixKey,
        pixTipo,
        status: "pendente",
        createdAt: serverTimestamp(),
      });

      // Atualiza carteira localmente (otimista)
      await setDoc(doc(db, "carteiras", user.uid), {
        saldoDisponivel: carteira.saldoDisponivel - valor,
        saldoPendente: (carteira.saldoPendente || 0),
        totalSacado: (carteira.totalSacado || 0) + valor,
        pixKey,
        pixTipo,
      }, { merge: true });

      setCarteira(prev => prev ? {
        ...prev,
        saldoDisponivel: prev.saldoDisponivel - valor,
        totalSacado: prev.totalSacado + valor,
        pixKey,
        pixTipo,
      } : prev);

      setModalSaque(false);
      setValorSaque("");
      toast("✓ Saque solicitado! Em até 2 dias úteis via PIX 🎉");
      carregarDados();
    } catch (e) {
      toast("Erro ao solicitar saque. Tente novamente.");
    } finally {
      setSalvandoSaque(false);
    }
  };

  const toast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  };

  const nivel = getNivel(carteira?.lojasAtivas || 0);
  const proximoNivel = getProximoNivel(carteira?.lojasAtivas || 0);
  const progressoNivel = proximoNivel
    ? ((carteira?.lojasAtivas || 0) - nivel.min) / (proximoNivel.min - nivel.min)
    : 1;

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#080412", padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>💰</div>
        <div style={{ fontFamily: "'Fraunces',serif", fontSize: "1.3rem", fontWeight: 900, color: "#fff", marginBottom: 8 }}>Sua Carteira NexFoody</div>
        <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,.45)", marginBottom: 24 }}>Faça login para acessar seus ganhos</div>
        <button onClick={() => navigate("/nexfoody/welcome")} style={{ padding: "12px 28px", background: "linear-gradient(135deg,#f5c518,#e6a817)", border: "none", borderRadius: 14, fontWeight: 800, color: "#0a0414", cursor: "pointer", fontSize: "0.95rem" }}>
          Entrar
        </button>
      </div>
    );
  }

  if (carregando) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080412" }}>
      <div style={{ width: 36, height: 36, border: "3px solid rgba(245,197,24,.3)", borderTop: "3px solid #f5c518", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#080412", fontFamily: "'Outfit',sans-serif", paddingBottom: 32 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
      `}</style>

      {/* ── HEADER ──────────────────────────────────────────── */}
      <div style={{ position: "relative", background: "linear-gradient(135deg, #1a0a36, #0f0720)", padding: "48px 20px 80px", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 30% 50%, rgba(245,197,24,.08) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(124,58,237,.12) 0%, transparent 50%)" }} />

        <button onClick={() => navigate(-1)} style={{ position: "absolute", top: 16, left: 16, background: "rgba(255,255,255,.08)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>

        <div style={{ position: "relative", textAlign: "center" }}>
          <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,.4)", marginBottom: 8 }}>Sua Carteira</div>
          <div style={{ fontSize: "3rem", fontWeight: 900, fontFamily: "'Fraunces',serif", color: "#f5c518", lineHeight: 1, marginBottom: 4, animation: "fadeUp .4s ease" }}>
            R$ {(carteira?.saldoDisponivel || 0).toFixed(2).replace(".", ",")}
          </div>
          <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,.4)", marginBottom: 20 }}>
            disponível · R$ {(carteira?.saldoPendente || 0).toFixed(2).replace(".", ",")} pendente
          </div>

          <button
            onClick={() => setModalSaque(true)}
            disabled={(carteira?.saldoDisponivel || 0) < 30}
            style={{
              padding: "12px 32px",
              background: (carteira?.saldoDisponivel || 0) >= 30
                ? "linear-gradient(135deg,#f5c518,#e6a817)"
                : "rgba(255,255,255,.08)",
              border: "none", borderRadius: 16,
              fontWeight: 800, fontSize: "0.95rem",
              color: (carteira?.saldoDisponivel || 0) >= 30 ? "#0a0414" : "rgba(255,255,255,.3)",
              cursor: (carteira?.saldoDisponivel || 0) >= 30 ? "pointer" : "not-allowed",
              boxShadow: (carteira?.saldoDisponivel || 0) >= 30 ? "0 6px 24px rgba(245,197,24,.4)" : "none",
            }}
          >
            {(carteira?.saldoDisponivel || 0) >= 30 ? "💸 Sacar via PIX" : `Mínimo R$ 30 · faltam R$ ${(30 - (carteira?.saldoDisponivel || 0)).toFixed(2).replace(".", ",")}`}
          </button>
        </div>
      </div>

      {/* ── ALERTA CHAVE PIX ────────────────────────────────── */}
      {!carteira?.pixKey && (
        <div style={{ margin: "16px 16px 0", background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 16, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: "1.4rem", flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#f59e0b", marginBottom: 3 }}>Cadastre sua chave PIX</div>
            <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.45)", lineHeight: 1.6 }}>
              Para receber seus ganhos você precisa informar uma chave PIX. Faça isso ao solicitar seu primeiro saque (mínimo R$ 30).
            </div>
          </div>
        </div>
      )}

      {/* ── NÍVEL ───────────────────────────────────────────── */}
      <div style={{ margin: "-36px 16px 0", position: "relative", zIndex: 10 }}>
        <div style={{ background: nivel.bg, border: `1px solid ${nivel.cor}30`, borderRadius: 20, padding: "16px 18px", backdropFilter: "blur(20px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.4rem" }}>{nivel.icon}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: nivel.cor }}>{nivel.nome}</div>
                <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.4)" }}>
                  {carteira?.lojasAtivas || 0} loja{(carteira?.lojasAtivas || 0) !== 1 ? "s" : ""} ativa{(carteira?.lojasAtivas || 0) !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.35)" }}>ganho por loja</div>
              <div style={{ fontWeight: 900, fontSize: "1rem", color: nivel.cor }}>R$ {nivel.ganho},00</div>
            </div>
          </div>

          {proximoNivel && (
            <>
              <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progressoNivel * 100}%`, background: `linear-gradient(90deg, ${nivel.cor}, ${proximoNivel.cor})`, borderRadius: 3, transition: "width 1s ease" }} />
              </div>
              <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,.3)", marginTop: 5 }}>
                {proximoNivel.min - (carteira?.lojasAtivas || 0)} loja{proximoNivel.min - (carteira?.lojasAtivas || 0) !== 1 ? "s" : ""} para {proximoNivel.icon} {proximoNivel.nome} · R$ {proximoNivel.ganho}/loja
              </div>
            </>
          )}
          {!proximoNivel && (
            <div style={{ fontSize: "0.68rem", color: nivel.cor, marginTop: 4, fontWeight: 700 }}>
              👑 Nível máximo + 0,5% recorrente por 6 meses!
            </div>
          )}
        </div>
      </div>

      {/* ── STATS ───────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "16px 16px 0" }}>
        {[
          { label: "Total ganho", val: `R$ ${(carteira?.totalGanho || 0).toFixed(0)}`, icon: "💰", cor: "#22c55e" },
          { label: "Total sacado", val: `R$ ${(carteira?.totalSacado || 0).toFixed(0)}`, icon: "✅", cor: "#60a5fa" },
          { label: "Convites", val: `${convites.length}`, icon: "📨", cor: "#f5c518" },
        ].map((s, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: "1.2rem", marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: s.cor }}>{s.val}</div>
            <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── ABAS ────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 0, margin: "20px 16px 0", background: "rgba(255,255,255,.04)", borderRadius: 14, padding: 4 }}>
        {(["carteira", "convites", "saques"] as const).map(a => (
          <button key={a} onClick={() => setAba(a)} style={{
            flex: 1, padding: "9px 4px", border: "none", borderRadius: 11, cursor: "pointer",
            fontFamily: "'Outfit',sans-serif", fontSize: "0.72rem", fontWeight: 700,
            background: aba === a ? "rgba(245,197,24,.15)" : "none",
            color: aba === a ? "#f5c518" : "rgba(255,255,255,.35)",
            transition: "all .2s",
          }}>
            {a === "carteira" ? "💳 Como ganhar" : a === "convites" ? `📨 Convites (${convites.length})` : `💸 Saques`}
          </button>
        ))}
      </div>

      {/* ── ABA: COMO GANHAR ─────────────────────────────────── */}
      {aba === "carteira" && (
        <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>

          {/* CTA convite */}
          <button
            onClick={() => navigate("/mapa")}
            style={{ width: "100%", padding: "16px", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", border: "none", borderRadius: 18, fontWeight: 800, fontSize: "1rem", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 6px 24px rgba(124,58,237,.4)" }}
          >
            🗺️ Encontrar lojas para convidar
          </button>

          {/* Como funciona */}
          <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "16px" }}>
            <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,.35)", marginBottom: 12 }}>Como funciona</div>
            {[
              { icon: "🗺️", titulo: "1. Encontre uma loja no mapa", desc: "Busque restaurantes e açaís que ainda não estão no NexFoody (pin cinza)" },
              { icon: "📲", titulo: "2. Envie o convite", desc: "Toque na loja → clique em WhatsApp ou Compartilhar para enviar o convite personalizado" },
              { icon: "✅", titulo: "3. Loja se cadastra", desc: "Quando entrar com seu código, você recebe R$ 10,00 imediatamente", destaque: `R$ 10` },
              { icon: "📦", titulo: "4. Loja faz o 1º pedido", desc: "Confirmado o primeiro pedido, mais R$ 10,00 creditados", destaque: `R$ 10` },
              { icon: "📈", titulo: "5. Ganhe recorrente", desc: "0,5% dos pedidos por 6 meses ou até R$ 50,00", destaque: "até R$ 50" },
            ].map((p, i) => (
              <div key={i} style={{ display: "flex", gap: 12, marginBottom: i < 4 ? 14 : 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(245,197,24,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>{p.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#fff", marginBottom: 2 }}>
                    {p.titulo}
                    {p.destaque && <span style={{ marginLeft: 6, background: "rgba(34,197,94,.15)", color: "#22c55e", fontSize: "0.65rem", fontWeight: 800, padding: "1px 7px", borderRadius: 20 }}>{p.destaque}</span>}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.4)", lineHeight: 1.6 }}>{p.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Dúvidas */}
          <button
            onClick={() => navigate("/como-funciona")}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: "14px 16px", cursor: "pointer", textAlign: "left" }}>
            <span style={{ fontSize: "1.3rem" }}>❓</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#fff" }}>Dúvidas sobre o programa?</div>
              <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.35)", marginTop: 1 }}>Regras, prazos, níveis e perguntas frequentes</div>
            </div>
            <span style={{ color: "rgba(255,255,255,.3)", fontSize: "0.9rem" }}>→</span>
          </button>

          {/* Tabela de níveis */}
          <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "16px" }}>
            <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,.35)", marginBottom: 12 }}>Seus níveis</div>
            {NIVEIS.map((n, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: nivel.nome === n.nome ? n.bg : "transparent", border: `1px solid ${nivel.nome === n.nome ? n.cor + "40" : "transparent"}`, borderRadius: 12, marginBottom: i < 2 ? 6 : 0 }}>
                <span style={{ fontSize: "1.2rem" }}>{n.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.8rem", color: n.cor }}>{n.nome}</div>
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.35)" }}>{n.min === 15 ? "15+" : `${n.min}–${n.max}`} lojas ativas</div>
                </div>
                <div style={{ fontWeight: 900, fontSize: "0.95rem", color: n.cor }}>R$ {n.ganho}/loja</div>
                {nivel.nome === n.nome && <span style={{ fontSize: "0.6rem", fontWeight: 800, color: n.cor, background: n.bg, padding: "2px 7px", borderRadius: 10, border: `1px solid ${n.cor}40` }}>Você</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ABA: CONVITES ────────────────────────────────────── */}
      {aba === "convites" && (
        <div style={{ padding: "16px 16px 0" }}>
          {convites.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,.25)" }}>
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>📨</div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "rgba(255,255,255,.4)", marginBottom: 6 }}>Nenhum convite ainda</div>
              <div style={{ fontSize: "0.78rem", marginBottom: 24 }}>Busque lojas no mapa e envie convites para começar a ganhar</div>
              <button onClick={() => navigate("/mapa")} style={{ padding: "12px 24px", background: "linear-gradient(135deg,#f5c518,#e6a817)", border: "none", borderRadius: 14, fontWeight: 800, color: "#0a0414", cursor: "pointer", fontSize: "0.88rem" }}>
                🗺️ Ir para o Mapa
              </button>
            </div>
          ) : convites.map(c => {
            const info = STATUS_INFO[c.status];
            const ganhoTotal = c.creditoCadastro + c.creditoPrimeiroPedido + (c.recorrenteAcumulado || 0);
            return (
              <div key={c.id} style={{ background: info.bg, border: `1px solid ${info.cor}25`, borderRadius: 16, padding: "14px", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "#fff", marginBottom: 3 }}>{c.nomeLoja}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: "0.7rem" }}>{info.icon}</span>
                      <span style={{ fontSize: "0.7rem", color: info.cor, fontWeight: 700 }}>{info.label}</span>
                    </div>
                  </div>
                  {ganhoTotal > 0 && (
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.35)" }}>ganho</div>
                      <div style={{ fontWeight: 900, fontSize: "1rem", color: "#22c55e" }}>
                        R$ {ganhoTotal.toFixed(2).replace(".", ",")}
                      </div>
                    </div>
                  )}
                </div>

                {/* Progresso de ganho */}
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { label: "Cadastro", val: c.creditoCadastro, max: 10 },
                    { label: "1º pedido", val: c.creditoPrimeiroPedido, max: 10 },
                    { label: "Recorrente", val: c.recorrenteAcumulado || 0, max: 50 },
                  ].map((etapa, i) => (
                    <div key={i} style={{ flex: 1, background: "rgba(255,255,255,.05)", borderRadius: 8, padding: "6px 8px" }}>
                      <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,.3)", marginBottom: 3 }}>{etapa.label}</div>
                      <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(etapa.val / etapa.max) * 100}%`, background: etapa.val > 0 ? "#22c55e" : "transparent", borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: "0.65rem", fontWeight: 700, color: etapa.val > 0 ? "#22c55e" : "rgba(255,255,255,.2)", marginTop: 2 }}>
                        R$ {etapa.val.toFixed(0)}
                      </div>
                    </div>
                  ))}
                </div>

                {c.createdAt && (
                  <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,.2)", marginTop: 8 }}>
                    Convidado em {c.createdAt.toDate().toLocaleDateString("pt-BR")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── ABA: SAQUES ──────────────────────────────────────── */}
      {aba === "saques" && (
        <div style={{ padding: "16px 16px 0" }}>
          {saques.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,.25)" }}>
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>💸</div>
              <div style={{ fontSize: "0.85rem" }}>Nenhum saque realizado ainda</div>
            </div>
          ) : saques.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "14px", marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>R$ {s.valor.toFixed(2).replace(".", ",")}</div>
                <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.35)", marginTop: 2 }}>
                  PIX · {s.pixKey}
                </div>
                {s.createdAt && (
                  <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,.2)", marginTop: 2 }}>
                    {s.createdAt.toDate().toLocaleDateString("pt-BR")}
                  </div>
                )}
              </div>
              <span style={{
                padding: "4px 10px", borderRadius: 20, fontSize: "0.65rem", fontWeight: 800,
                background: s.status === "processado" ? "rgba(34,197,94,.15)" : s.status === "cancelado" ? "rgba(239,68,68,.15)" : "rgba(245,158,11,.15)",
                color: s.status === "processado" ? "#22c55e" : s.status === "cancelado" ? "#ef4444" : "#f59e0b",
              }}>
                {s.status === "processado" ? "✓ Pago" : s.status === "cancelado" ? "Cancelado" : "Em processamento"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL SAQUE ──────────────────────────────────────── */}
      <AnimatePresence>
        {modalSaque && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setModalSaque(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 1000 }} />
            <motion.div
              initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1001, background: "#0f0720", borderRadius: "24px 24px 0 0", border: "1px solid rgba(255,255,255,.1)", padding: "20px 20px 40px" }}
            >
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,.2)" }} />
              </div>

              <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.2rem", color: "#fff", marginBottom: 4 }}>Sacar via PIX</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.4)", marginBottom: 20 }}>
                Disponível: <span style={{ color: "#f5c518", fontWeight: 700 }}>R$ {(carteira?.saldoDisponivel || 0).toFixed(2).replace(".", ",")}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.4)", marginBottom: 6 }}>Tipo da chave PIX</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {PIX_TIPOS.map(t => (
                      <button key={t} onClick={() => setPixTipo(t)} style={{ padding: "6px 12px", borderRadius: 20, border: `1px solid ${pixTipo === t ? "#f5c518" : "rgba(255,255,255,.12)"}`, background: pixTipo === t ? "rgba(245,197,24,.12)" : "none", color: pixTipo === t ? "#f5c518" : "rgba(255,255,255,.4)", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer" }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.4)", marginBottom: 6 }}>Chave PIX</div>
                  <input
                    value={pixKey}
                    onChange={e => setPixKey(e.target.value)}
                    placeholder="Digite sua chave PIX"
                    style={{ width: "100%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, padding: "12px 14px", color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.88rem", outline: "none", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.4)", marginBottom: 6 }}>Valor (mín. R$ 30,00)</div>
                  <input
                    value={valorSaque}
                    onChange={e => setValorSaque(e.target.value)}
                    placeholder="0,00"
                    type="number"
                    style={{ width: "100%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, padding: "12px 14px", color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "1.2rem", fontWeight: 800, outline: "none", boxSizing: "border-box" }}
                  />
                </div>

                <button
                  onClick={solicitarSaque}
                  disabled={salvandoSaque}
                  style={{ width: "100%", padding: "15px", background: "linear-gradient(135deg,#f5c518,#e6a817)", border: "none", borderRadius: 16, fontWeight: 800, fontSize: "1rem", color: "#0a0414", cursor: "pointer", marginTop: 4 }}
                >
                  {salvandoSaque ? "Solicitando..." : "Confirmar saque"}
                </button>

                <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.25)", textAlign: "center", lineHeight: 1.6 }}>
                  Prazo de até 2 dias úteis · Processado manualmente pela equipe NexFoody
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── TOAST ────────────────────────────────────────────── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "rgba(15,7,32,.95)", border: "1px solid rgba(245,197,24,.3)", borderRadius: 14, padding: "12px 20px", fontSize: "0.82rem", fontWeight: 700, color: "#fff", zIndex: 2000, whiteSpace: "nowrap", backdropFilter: "blur(12px)" }}>
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
