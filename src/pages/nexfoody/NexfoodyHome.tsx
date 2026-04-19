import { useEffect, useState, useRef, useCallback } from "react";
import { motion, useInView, animate, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { LojaMeta } from "../../types/tenant";

// ─── LANDING CONFIG (editável pelo admin) ─────────────────────
interface LandingCfg {
  hero?: { headline?: string; subtitle?: string; };
  stats?: { lojas?: number; clientes?: number; pedidos?: number; premios?: number; };
  dor?: { icon: string; title: string; desc: string; }[];
  crescimento?: { titulo?: string; desc?: string; stat1Val?: string; stat1Label?: string; stat2Val?: string; stat2Label?: string; };
  chatIA?: { titulo?: string; desc?: string; };
  gerenteIA?: { titulo?: string; desc?: string; };
  social?: { titulo?: string; desc?: string; };
  tikTok?: { imageUrl?: string; emoji?: string; name?: string; store?: string; price?: string; tag?: string; }[];
  inovacoes?: { icon: string; titulo: string; desc: string; badge: string; cor: string; }[];
}
function useLandingCfg() {
  const [cfg, setCfg] = useState<LandingCfg>({});
  useEffect(() => {
    getDoc(doc(db, "plataforma", "landingPage")).then(s => { if (s.exists()) setCfg(s.data() as LandingCfg); });
  }, []);
  return cfg;
}

// ─── CONSTANTS ────────────────────────────────────────────────
const LIVE_FEED = [
  { icon: "🏆", name: "Marcos P.", action: "subiu para #1 em Bacabal-MA", time: "agora" },
  { icon: "🍓", name: "Julia R.", action: "fez pedido na Puro Gosto", time: "1min" },
  { icon: "💎", name: "Carlos M.", action: "ganhou 340 diamantes", time: "2min" },
  { icon: "🎉", name: "Ana S.", action: "desbloqueou badge Fã Fiel", time: "3min" },
  { icon: "🛒", name: "Diego V.", action: "resgatou prêmio — R$50 voucher", time: "4min" },
  { icon: "🔥", name: "Fernanda L.", action: "entrou no Top 10 da cidade", time: "5min" },
  { icon: "⭐", name: "Rafael C.", action: "avaliou com 5 estrelas", time: "6min" },
  { icon: "📸", name: "Letícia M.", action: "postou no feed da loja", time: "7min" },
];

const JOURNEY = [
  { step: "01", icon: "📱", title: "Baixa o app", desc: "Grátis na App Store e Google Play" },
  { step: "02", icon: "🗺️", title: "Descobre lojas", desc: "Todas as lojas da sua cidade" },
  { step: "03", icon: "🛒", title: "Faz um pedido", desc: "Rápido, fácil, seguro" },
  { step: "04", icon: "💎", title: "Ganha diamantes", desc: "Cada real gasto vira pontos" },
  { step: "05", icon: "🏆", title: "Sobe no ranking", desc: "Compita com sua cidade toda" },
  { step: "06", icon: "🎁", title: "Ganha prêmios reais", desc: "TV, celular, vouchers e mais" },
];

const COMPARATIVO = [
  ["💬 Chat tipo WhatsApp integrado",      "❌",          "✅ Nativo"],
  ["🤖 Robô IA que recebe pedidos 24/7",   "❌",          "✅ Incluso"],
  ["Taxa por pedido",                        "12 – 27%",    "R$1 · teto R$300/mês 🎉"],
  ["Programa de fidelidade / pontos",       "❌",          "✅ Ranking + prêmios"],
  ["Link e app da sua própria loja",        "❌",          "✅"],
  ["Seus dados de clientes",                "❌ Do iFood", "✅ São seus"],
  ["Rede social da loja (feed + stories)",  "❌",          "✅"],
  ["Cupons e promoções",                    "Pago à parte","✅ Incluso"],
  ["Recursos bloqueados por plano",         "✅ Sim",      "❌ Plataforma completa"],
  ["📒 Livro Caixa (controle do balcão)",   "❌",          "✅ Exclusivo NexFoody"],
];

const INOVACOES = [
  {
    icon: "📸",
    cor: "#e1306c",
    glow: "rgba(225,48,108,0.3)",
    titulo: "Rede Social tipo Instagram",
    desc: "Cada loja tem seu próprio feed e stories. Clientes seguem, curtem e comentam — gerando engajamento orgânico sem anúncio.",
    badge: "Exclusivo NexFoody",
  },
  {
    icon: "🤖",
    cor: "#818cf8",
    glow: "rgba(129,140,248,0.3)",
    titulo: "Gerente IA 24/7",
    desc: "Robô inteligente que recebe pedidos pelo chat, responde dúvidas, sugere pratos e nunca deixa um cliente esperando.",
    badge: "Powered by IA",
  },
  {
    icon: "💬",
    cor: "#25d366",
    glow: "rgba(37,211,102,0.3)",
    titulo: "Chat tipo WhatsApp",
    desc: "Pedidos direto pelo chat integrado. Sem terceiros, sem comissão — a conversa fica entre você e seu cliente.",
    badge: "Integrado",
  },
  {
    icon: "🏆",
    cor: "#f5c518",
    glow: "rgba(245,197,24,0.3)",
    titulo: "Gamificação & Ranking",
    desc: "Clientes ganham diamantes a cada compra e competem no ranking da cidade. Quem lidera ganha prêmios reais todo mês.",
    badge: "Viral",
  },
  {
    icon: "🎟️",
    cor: "#fb923c",
    glow: "rgba(251,146,60,0.3)",
    titulo: "Cupons & Promoções",
    desc: "Crie e dispare ofertas em segundos. Programa de fidelidade automático que traz o cliente de volta sem esforço.",
    badge: "Incluso",
  },
  {
    icon: "📊",
    cor: "#22c55e",
    glow: "rgba(34,197,94,0.3)",
    titulo: "Analytics em Tempo Real",
    desc: "Veja o que seus clientes fazem: produtos mais vistos, horário de pico, taxa de conversão e muito mais.",
    badge: "Dashboard",
  },
  {
    icon: "📒",
    cor: "#16a34a",
    glow: "rgba(22,163,74,0.3)",
    titulo: "Livro Caixa Flutuante",
    desc: "Registre vendas do balcão, retiradas e avulsos em segundos — direto do celular. Caixa sempre aberto, relatório PDF em um toque. Nenhum outro app tem isso.",
    badge: "Só na NexFoody",
  },
];

// Novo modelo de precificação — uma só estrutura
const PLANO_CATALOGO = {
  id: "catalogo",
  nome: "Catálogo Digital",
  badge: null,
  precoLabel: "Grátis",
  mensalLabel: null,
  cap: null,
  cor: "#22c55e",
  glow: "rgba(34,197,94,0.2)",
  destaque: false,
  desc: "Link e QR Code do seu cardápio para compartilhar no WhatsApp e Instagram. Sem delivery.",
  features: [
    { ok: true,  txt: "Cardápio digital com fotos" },
    { ok: true,  txt: "Link próprio da loja" },
    { ok: true,  txt: "QR Code para imprimir" },
    { ok: false, txt: "Pedidos online / delivery" },
    { ok: false, txt: "Chat IA (tipo WhatsApp)" },
    { ok: false, txt: "Gerente IA 24/7" },
    { ok: false, txt: "Ranking + fidelidade" },
    { ok: false, txt: "Livro Caixa Flutuante" },
  ],
};

const PLANOS = [
  {
    id: "basico",
    nome: "Básico",
    badge: null,
    precoLabel: "R$1/pedido",
    mensalLabel: null,
    cap: 150,
    cor: "#818cf8",
    glow: "rgba(129,140,248,0.2)",
    destaque: false,
    desc: "Cardápio digital + pedidos online. Ideal para quem está começando.",
    features: [
      { ok: true,  txt: "Cardápio digital" },
      { ok: true,  txt: "Pedidos online" },
      { ok: true,  txt: "App e link próprio da loja" },
      { ok: true,  txt: "Presença no MapaFoody" },
      { ok: true,  txt: "Feed & Stories da loja" },
      { ok: true,  txt: "Ranking + fidelidade" },
      { ok: true,  txt: "Gestão de entregadores" },
      { ok: false, txt: "Chat IA (tipo WhatsApp)" },
      { ok: false, txt: "Gerente IA 24/7" },
      { ok: false, txt: "Analytics avançado com IA" },
    ],
    exemplos: [
      { label: "20 pedidos/mês", valor: "Grátis", cor: "#22c55e" },
      { label: "60 pedidos/mês", valor: "R$60", cor: "#818cf8" },
      { label: "150+ pedidos/mês", valor: "R$150", cor: "#f5c518" },
    ],
  },
  {
    id: "ia",
    nome: "IA Avançada",
    badge: "MAIS POPULAR",
    precoLabel: "R$1/pedido",
    mensalLabel: "+ R$39/mês",
    cap: 300,
    cor: "#f5c518",
    glow: "rgba(245,197,24,0.2)",
    destaque: true,
    desc: "Tudo do Básico + Chat IA e Gerente IA. A loja que atende e vende enquanto você dorme.",
    features: [
      { ok: true, txt: "Cardápio digital" },
      { ok: true, txt: "Pedidos online" },
      { ok: true, txt: "App e link próprio da loja" },
      { ok: true, txt: "Presença no MapaFoody" },
      { ok: true, txt: "Feed & Stories da loja" },
      { ok: true, txt: "Ranking + fidelidade" },
      { ok: true, txt: "Gestão de entregadores" },
      { ok: true, txt: "Chat IA (tipo WhatsApp)" },
      { ok: true, txt: "Gerente IA 24/7" },
      { ok: true, txt: "Analytics avançado com IA" },
    ],
    exemplos: [
      { label: "20 pedidos/mês", valor: "R$39", cor: "#22c55e" },
      { label: "60 pedidos/mês", valor: "R$99", cor: "#818cf8" },
      { label: "150+ pedidos/mês", valor: "R$189", cor: "#f5c518" },
    ],
  },
];

const MERCHANT_FEATURES = [
  { icon: "⚡", title: "App próprio em minutos", desc: "Cardápio digital, pedidos e pagamento prontos." },
  { icon: "❤️", title: "Fidelidade automática", desc: "Sistema de pontos e ranking sem esforço." },
  { icon: "📸", title: "Rede social inclusa", desc: "Feed da loja, stories, comentários reais." },
  { icon: "📊", title: "Analytics em tempo real", desc: "Veja o que seus clientes fazem e sentem." },
  { icon: "🏆", title: "Ranking que fideliza", desc: "Clientes competem para ser o #1 da sua loja." },
  { icon: "🎟️", title: "Cupons e promoções", desc: "Crie e dispare ofertas em segundos." },
];

const GAMIFICATION = [
  { icon: "💎", color: "#818cf8", glow: "rgba(129,140,248,0.4)", label: "Diamantes", desc: "Cada compra gera diamantes que sobem seu ranking" },
  { icon: "🚀", color: "#f472b6", glow: "rgba(244,114,182,0.4)", label: "Rockets", desc: "Boost semanal que multiplica seus pontos" },
  { icon: "🔥", color: "#fb923c", glow: "rgba(251,146,60,0.4)", label: "Turbo", desc: "Modo especial que triplica seus ganhos" },
  { icon: "👑", color: "#f5c518", glow: "rgba(245,197,24,0.4)", label: "Ranking", desc: "Lidere sua cidade e ganhe prêmios reais" },
];

// ─── MAPAFOODY DATA ──────────────────────────────────────────
const LOJAS_MAPA = [
  // Cadastradas na NexFoody
  { id: 1, nome: "Açaí Puro Gosto", cat: "🍧", top: "52%", left: "48%", ativo: true, destaque: true },
  { id: 2, nome: "Lanches Naturais", cat: "🥗", top: "38%", left: "56%", ativo: true },
  { id: 3, nome: "Pizza da Vila", cat: "🍕", top: "65%", left: "60%", ativo: true },
  { id: 4, nome: "Burguer Mais", cat: "🍔", top: "44%", left: "36%", ativo: true },
  // Não cadastradas (potenciais)
  { id: 5, nome: "Restaurante Bom Sabor", cat: "🍽️", top: "28%", left: "44%", ativo: false },
  { id: 6, nome: "Sushi House", cat: "🍣", top: "72%", left: "42%", ativo: false },
  { id: 7, nome: "Crepe & Cia", cat: "🥞", top: "58%", left: "70%", ativo: false },
  { id: 8, nome: "Sorvetes Gelado", cat: "🍦", top: "34%", left: "64%", ativo: false },
  { id: 9, nome: "Churrasco do Zé", cat: "🥩", top: "76%", left: "55%", ativo: false },
  { id: 10, nome: "Tapioca da Manu", cat: "🫓", top: "48%", left: "24%", ativo: false },
  { id: 11, nome: "Pastelaria Central", cat: "🥟", top: "22%", left: "52%", ativo: false },
  { id: 12, nome: "Doceria Mel", cat: "🍰", top: "62%", left: "30%", ativo: false },
];

// ─── MAPAFOODY COMPONENT ─────────────────────────────────────
function MapaFoody() {
  const [hoveredPin, setHoveredPin] = useState<number | null>(null);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  const ativos = LOJAS_MAPA.filter(l => l.ativo).length;
  const pendentes = LOJAS_MAPA.filter(l => !l.ativo).length;

  return (
    <Section style={{ padding: "100px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Cabeçalho */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#22c55e", marginBottom: 12, fontWeight: 700 }}>MapaFoody</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: 16 }}>
            Sua cidade<br />
            <span className="gradient-text">no mapa.</span>
          </h2>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "1rem", maxWidth: 480, margin: "0 auto" }}>
            Veja quais lojas já estão na NexFoody e quais ainda não descobriram o poder da rede social de delivery.
          </p>
        </div>

        {/* Contador de lojas */}
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 36, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 40, padding: "10px 20px" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", flexShrink: 0, display: "inline-block" }} />
            <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#22c55e" }}>{ativos} lojas na NexFoody</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 40, padding: "10px 20px" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.2)", flexShrink: 0, display: "inline-block" }} />
            <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>{pendentes} ainda fora do mapa</span>
          </div>
        </div>

        {/* Mapa visual */}
        <div ref={ref} style={{ position: "relative", borderRadius: 28, overflow: "hidden", border: "1px solid rgba(255,255,255,0.09)", background: "#0d0820" }}>
          {/* Grade de ruas */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.07, pointerEvents: "none" }}>
            {/* Linhas horizontais */}
            {Array.from({ length: 12 }, (_, i) => (
              <line key={`h${i}`} x1="0" y1={`${(i + 1) * 8}%`} x2="100%" y2={`${(i + 1) * 8}%`} stroke="#a855f7" strokeWidth="0.5" />
            ))}
            {/* Linhas verticais */}
            {Array.from({ length: 14 }, (_, i) => (
              <line key={`v${i}`} x1={`${(i + 1) * 7}%`} y1="0" x2={`${(i + 1) * 7}%`} y2="100%" stroke="#a855f7" strokeWidth="0.5" />
            ))}
            {/* Ruas principais (mais largas) */}
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#7c3aed" strokeWidth="1.5" />
            <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#7c3aed" strokeWidth="1.5" />
          </svg>

          {/* Brilho central */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(124,58,237,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

          {/* Container do mapa com altura */}
          <div style={{ position: "relative", height: 380, padding: 24 }}>
            {/* Label da cidade */}
            <div style={{ position: "absolute", bottom: 20, left: 20, background: "rgba(8,4,18,0.85)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "6px 12px", fontSize: "0.68rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              📍 Bacabal — MA
            </div>

            {/* Pins */}
            {LOJAS_MAPA.map((loja, i) => (
              <motion.div
                key={loja.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={inView ? { scale: 1, opacity: 1 } : {}}
                transition={{ delay: i * 0.08 + 0.2, type: "spring", stiffness: 400, damping: 15 }}
                style={{ position: "absolute", top: loja.top, left: loja.left, transform: "translate(-50%, -100%)", zIndex: hoveredPin === loja.id ? 20 : 10, cursor: "pointer" }}
                onMouseEnter={() => setHoveredPin(loja.id)}
                onMouseLeave={() => setHoveredPin(null)}
              >
                {/* Tooltip */}
                {hoveredPin === loja.id && (
                  <motion.div initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", background: "rgba(8,4,18,0.95)", backdropFilter: "blur(12px)", border: `1px solid ${loja.ativo ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.15)"}`, borderRadius: 10, padding: "7px 12px", whiteSpace: "nowrap", pointerEvents: "none" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: loja.ativo ? "#22c55e" : "rgba(255,255,255,0.6)" }}>{loja.cat} {loja.nome}</div>
                    <div style={{ fontSize: "0.6rem", color: loja.ativo ? "rgba(34,197,94,0.7)" : "rgba(255,255,255,0.3)", marginTop: 2 }}>
                      {loja.ativo ? "✓ Na NexFoody" : "Ainda fora · Cadastre grátis"}
                    </div>
                    {/* Seta */}
                    <div style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", width: 8, height: 8, background: loja.ativo ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.15)", clipPath: "polygon(0 0, 100% 0, 50% 100%)" }} />
                  </motion.div>
                )}

                {/* Pin */}
                <div style={{ position: "relative" }}>
                  {/* Pulsar (só para lojas ativas) */}
                  {loja.ativo && (
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: loja.destaque ? 32 : 24, height: loja.destaque ? 32 : 24, borderRadius: "50%", background: "rgba(34,197,94,0.25)", animation: "ping 1.8s infinite" }} />
                  )}
                  {/* Pin body */}
                  <div style={{
                    width: loja.destaque ? 40 : 30,
                    height: loja.destaque ? 40 : 30,
                    borderRadius: "50% 50% 50% 0",
                    transform: "rotate(-45deg)",
                    background: loja.ativo
                      ? (loja.destaque ? "linear-gradient(135deg, #22c55e, #16a34a)" : "rgba(34,197,94,0.85)")
                      : "rgba(255,255,255,0.1)",
                    border: loja.ativo
                      ? `2px solid ${loja.destaque ? "#4ade80" : "rgba(34,197,94,0.6)"}`
                      : "1px solid rgba(255,255,255,0.2)",
                    boxShadow: loja.ativo ? `0 4px 16px ${loja.destaque ? "rgba(34,197,94,0.6)" : "rgba(34,197,94,0.3)"}` : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ transform: "rotate(45deg)", fontSize: loja.destaque ? "1rem" : "0.7rem" }}>{loja.cat}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA para lojistas */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }} style={{ marginTop: 32, background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(124,58,237,0.1))", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 20, padding: "24px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: "#fff", marginBottom: 4 }}>
              Sua loja ainda não está no mapa?
            </div>
            <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
              Cadastre grátis e apareça para milhares de clientes na sua cidade.
            </div>
          </div>
          <a href="/lojista/cadastro" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 24px", background: "linear-gradient(135deg, #22c55e, #16a34a)", borderRadius: 50, fontWeight: 800, fontSize: "0.88rem", color: "#fff", textDecoration: "none", whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(34,197,94,0.35)", flexShrink: 0 }}>
            📍 Entrar no mapa grátis →
          </a>
        </motion.div>
      </div>
    </Section>
  );
}

// ─── ANIMATED COUNTER ────────────────────────────────────────
function AnimatedCounter({ to, prefix = "", suffix = "", duration = 2.5 }: { to: number; prefix?: string; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, { duration, ease: "easeOut", onUpdate: v => setVal(Math.floor(v)) });
    return controls.stop;
  }, [inView, to, duration]);
  return (
    <span ref={ref}>
      {prefix}{val.toLocaleString("pt-BR")}{suffix}
    </span>
  );
}

// ─── FLOATING PARTICLES ──────────────────────────────────────
function Particles() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 8}s`,
    duration: `${6 + Math.random() * 8}s`,
    size: `${2 + Math.random() * 4}px`,
    opacity: 0.2 + Math.random() * 0.4,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: "absolute", bottom: "-10px", left: p.left,
          width: p.size, height: p.size, borderRadius: "50%",
          background: Math.random() > 0.5 ? "#f5c518" : "#a855f7",
          opacity: p.opacity,
          animation: `floatUp ${p.duration} ${p.delay} infinite linear`,
        }} />
      ))}
    </div>
  );
}

// ─── SECTION WRAPPER ─────────────────────────────────────────
function Section({ children, style = {}, id }: { children: React.ReactNode; style?: React.CSSProperties; id?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.section id={id} ref={ref} initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, ease: "easeOut" }} style={style}>
      {children}
    </motion.section>
  );
}

// ═══════════════════════════════════════════════════════════════
export default function NexfoodyHome() {
  const cfg = useLandingCfg();
  const [lojas, setLojas] = useState<LojaMeta[]>([]);
  const [feedIdx, setFeedIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // helpers para ler config com fallback
  const h = (key: keyof NonNullable<LandingCfg["hero"]>, fb: string) => cfg.hero?.[key] ?? fb;
  const st = (key: keyof NonNullable<LandingCfg["stats"]>, fb: number) => cfg.stats?.[key] ?? fb;
  const cr = (key: keyof NonNullable<LandingCfg["crescimento"]>, fb: string) => cfg.crescimento?.[key] ?? fb;

  useEffect(() => {
    getDocs(query(collection(db, "lojas"), where("ativo", "==", true))).then(s => setLojas(s.docs.map(d => ({ tenantId: d.id, ...d.data() } as LojaMeta))));
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setFeedIdx(p => (p + 1) % LIVE_FEED.length), 3000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ background: "#080412", color: "#fff", fontFamily: "'Outfit', sans-serif", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Fraunces:wght@700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes floatUp { 0%{transform:translateY(0) scale(1);opacity:var(--op,0.3)} 100%{transform:translateY(-100vh) scale(0.5);opacity:0} }
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 20px var(--glow)} 50%{box-shadow:0 0 40px var(--glow),0 0 60px var(--glow)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes spin-slow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes ticker-slide { 0%{transform:translateY(100%);opacity:0} 15%{transform:translateY(0);opacity:1} 85%{transform:translateY(0);opacity:1} 100%{transform:translateY(-100%);opacity:0} }
        @keyframes gradient-shift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes ping { 0%{transform:scale(1);opacity:1} 75%,100%{transform:scale(2);opacity:0} }
        @keyframes bounce-in { 0%{transform:scale(0.3);opacity:0} 60%{transform:scale(1.1)} 80%{transform:scale(0.95)} 100%{transform:scale(1);opacity:1} }
        .gradient-text { background: linear-gradient(135deg, #f5c518 0%, #a855f7 50%, #f5c518 100%); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: shimmer 4s linear infinite; }
        .btn-gold { display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:16px 32px;background:linear-gradient(135deg,#f5c518,#e6a817);color:#0a0414;border-radius:50px;font-weight:800;font-size:1rem;text-decoration:none;transition:transform 0.2s,box-shadow 0.2s;box-shadow:0 4px 24px rgba(245,197,24,0.35); }
        .btn-gold:hover { transform:translateY(-2px);box-shadow:0 8px 32px rgba(245,197,24,0.5); }
        .btn-outline { display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:15px 32px;background:transparent;color:#fff;border:2px solid rgba(255,255,255,0.25);border-radius:50px;font-weight:700;font-size:1rem;text-decoration:none;transition:all 0.2s; }
        .btn-outline:hover { border-color:rgba(255,255,255,0.6);background:rgba(255,255,255,0.05); }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#080412} ::-webkit-scrollbar-thumb{background:#7c3aed;border-radius:2px}
      `}</style>

      {/* ── NAV ──────────────────────────────────────────────── */}
      <motion.nav initial={{ y: -80 }} animate={{ y: 0 }} transition={{ duration: 0.6 }} style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrolled ? "rgba(8,4,18,0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.07)" : "none",
        transition: "all 0.3s",
      }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.5rem", fontWeight: 900, color: "#f5c518" }}>
          🍓 NexFoody
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link to="/lojista/login" className="btn-outline" style={{ padding: "8px 20px", fontSize: "0.82rem" }}>Lojista</Link>
          <Link to="/lojista/cadastro" className="btn-gold" style={{ padding: "8px 20px", fontSize: "0.82rem" }}>Começar grátis</Link>
        </div>
      </motion.nav>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", padding: "100px 24px 80px", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 100% 70% at 50% 0%, rgba(124,58,237,0.5) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 40% at 90% 50%, rgba(245,197,24,0.1) 0%, transparent 60%)", pointerEvents: "none" }} />
        <Particles />

        <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center", position: "relative", zIndex: 1 }}>
          {/* Left — texto */}
          <div>
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 20, padding: "6px 16px", marginBottom: 24, fontSize: "0.78rem", fontWeight: 700, color: "#fca5a5" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block", position: "relative" }}>
                <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#ef4444", animation: "ping 1.5s infinite" }} />
              </span>
              LIVE — {lojas.length > 0 ? `${lojas.length} lojas ativas` : "Plataforma ao vivo"}
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }}
              style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2.2rem, 4.5vw, 4rem)", fontWeight: 900, lineHeight: 1.08, marginBottom: 20 }}>
              {h("headline", "A primeira rede social de delivery do Brasil.")}
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.7 }}
              style={{ fontSize: "1.15rem", color: "rgba(255,255,255,0.55)", marginBottom: 16, lineHeight: 1.6, maxWidth: 480 }}>
              {h("subtitle", "Com a NexFoody suas vendas podem disparar. Chat com IA, rede social, gamificação e muito mais — plataforma completa para todo lojista.")}
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
              style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 40 }}>
              <Link to="/lojista/cadastro" className="btn-gold">🏪 Criar loja grátis</Link>
              <Link to="/" className="btn-outline">📱 Sou cliente</Link>
            </motion.div>

            {/* Live activity ticker */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} style={{ height: 44, overflow: "hidden", maxWidth: 420 }}>
              <AnimatePresence mode="wait">
                <motion.div key={feedIdx} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} transition={{ duration: 0.3 }}
                  style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "10px 16px", fontSize: "0.78rem", color: "rgba(255,255,255,0.7)" }}>
                  <span>{LIVE_FEED[feedIdx].icon}</span>
                  <span><b style={{ color: "#f5c518" }}>{LIVE_FEED[feedIdx].name}</b> {LIVE_FEED[feedIdx].action}</span>
                  <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.3)", fontSize: "0.68rem" }}>{LIVE_FEED[feedIdx].time}</span>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Right — app mockups */}
          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, duration: 0.9 }} style={{ position: "relative", height: 520, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* Glow */}
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.3), transparent 70%)", pointerEvents: "none" }} />

            {/* Tablet (atrás, esquerda) */}
            <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%) rotate(-6deg)", width: 180, height: 240, background: "linear-gradient(145deg,#1a0a36,#0d0820)", border: "3px solid rgba(124,58,237,0.4)", borderRadius: 20, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
              <div style={{ background: "rgba(124,58,237,0.3)", height: 40, display: "flex", alignItems: "center", padding: "0 12px", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3 }} />
              </div>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ margin: "8px 10px", height: 36, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, display: "flex", alignItems: "center", gap: 8, padding: "0 8px" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: `hsl(${i*60+200},60%,40%)`, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 5, background: "rgba(255,255,255,0.15)", borderRadius: 3, marginBottom: 4 }} />
                    <div style={{ height: 4, width: "60%", background: "rgba(255,255,255,0.08)", borderRadius: 3 }} />
                  </div>
                </div>
              ))}
              <div style={{ textAlign: "center", padding: "8px 0", fontSize: "0.55rem", color: "rgba(255,255,255,0.3)" }}>Cardápio Digital</div>
            </div>

            {/* Phone principal (centro) */}
            <div style={{ position: "relative", zIndex: 10, width: 200, height: 420, background: "linear-gradient(145deg,#1a0a36,#0d0820)", border: "4px solid rgba(168,85,247,0.6)", borderRadius: 36, overflow: "hidden", boxShadow: "0 30px 80px rgba(124,58,237,0.4), 0 0 0 1px rgba(255,255,255,0.08)" }}>
              {/* Notch */}
              <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 60, height: 14, background: "#080412", borderRadius: 7, zIndex: 20 }} />
              {/* Screen content — chat */}
              <div style={{ padding: "30px 12px 12px", height: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ textAlign: "center", fontSize: "0.6rem", color: "rgba(255,255,255,0.4)", borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: 8, marginBottom: 4 }}>🤖 NexBot · Açaí Puro Gosto</div>
                {/* Bot bubble */}
                <div style={{ background: "rgba(124,58,237,0.3)", border: "1px solid rgba(124,58,237,0.4)", borderRadius: "12px 12px 12px 2px", padding: "8px 10px", fontSize: "0.55rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.4, maxWidth: "85%" }}>
                  Olá! 😊 Seja bem-vindo! Sou o NexBot. O que você deseja hoje?
                </div>
                {/* Cliente bubble */}
                <div style={{ background: "rgba(245,197,24,0.2)", border: "1px solid rgba(245,197,24,0.3)", borderRadius: "12px 12px 2px 12px", padding: "8px 10px", fontSize: "0.55rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.4, maxWidth: "80%", alignSelf: "flex-end" }}>
                  Quero um açaí 500ml com granola e leite condensado
                </div>
                {/* Bot bubble */}
                <div style={{ background: "rgba(124,58,237,0.3)", border: "1px solid rgba(124,58,237,0.4)", borderRadius: "12px 12px 12px 2px", padding: "8px 10px", fontSize: "0.55rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.4, maxWidth: "85%" }}>
                  Perfeito! 🍧 Açaí 500ml + granola + leite condensado = R$22. Confirma?
                </div>
                {/* Botoes */}
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <div style={{ flex: 1, background: "linear-gradient(135deg,#f5c518,#e6a817)", borderRadius: 20, padding: "5px 0", textAlign: "center", fontSize: "0.52rem", fontWeight: 800, color: "#000" }}>✓ Confirmar</div>
                  <div style={{ flex: 1, background: "rgba(255,255,255,0.07)", borderRadius: 20, padding: "5px 0", textAlign: "center", fontSize: "0.52rem", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>Editar</div>
                </div>
                <div style={{ marginTop: "auto", background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3 }} />
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(124,58,237,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.55rem" }}>↑</div>
                </div>
              </div>
            </div>

            {/* Notebook (atrás, direita) */}
            <div style={{ position: "absolute", right: 0, bottom: 40, width: 220, zIndex: 5 }}>
              <div style={{ background: "linear-gradient(145deg,#1a0a36,#0d0820)", border: "2px solid rgba(245,197,24,0.3)", borderRadius: "12px 12px 0 0", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", height: 140 }}>
                <div style={{ background: "rgba(245,197,24,0.15)", height: 24, display: "flex", alignItems: "center", padding: "0 10px", gap: 5 }}>
                  {["#ef4444","#f5c518","#22c55e"].map((c,i) => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />)}
                  <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, marginLeft: 8 }} />
                </div>
                <div style={{ padding: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {[["💰","R$4.820","Hoje"],["📦","142","Pedidos"],["⭐","4.9","Avaliação"],["👥","89","Clientes"]].map(([ic,val,lab],i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "6px 8px" }}>
                      <div style={{ fontSize: "0.65rem" }}>{ic}</div>
                      <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#f5c518" }}>{val}</div>
                      <div style={{ fontSize: "0.52rem", color: "rgba(255,255,255,0.3)" }}>{lab}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: "linear-gradient(145deg,#1a0036,#0d0820)", border: "2px solid rgba(245,197,24,0.2)", borderTop: "none", borderRadius: "0 0 4px 4px", height: 10, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }} />
              <div style={{ background: "rgba(245,197,24,0.1)", height: 4, borderRadius: "0 0 8px 8px", marginTop: 2 }} />
            </div>
          </motion.div>
        </div>

        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }} style={{ position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)", color: "rgba(255,255,255,0.2)", fontSize: "0.75rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span>↓</span><span>Descubra mais</span>
        </motion.div>
      </div>

      {/* ── STATS BAR ────────────────────────────────────────── */}
      <Section>
        <div style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(245,197,24,0.08))", borderTop: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "40px 24px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 32, textAlign: "center" }}>
            {[
              { label: "Lojas cadastradas", value: st("lojas", 127), suffix: "+", color: "#a855f7" },
              { label: "Clientes ativos", value: st("clientes", 8432), suffix: "+", color: "#f5c518" },
              { label: "Pedidos realizados", value: st("pedidos", 24850), suffix: "+", color: "#22c55e" },
              { label: "Prêmios entregues", value: st("premios", 48), suffix: "", color: "#f472b6" },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 900, color: s.color, lineHeight: 1 }}>
                  <AnimatedCounter to={s.value} suffix={s.suffix} />
                </div>
                <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.4)", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── DOR ──────────────────────────────────────────────── */}
      <Section style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#f87171", marginBottom: 12, fontWeight: 700 }}>Você provavelmente está assim</div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: 12 }}>
              Já chega de depender<br />
              <span className="gradient-text">de plataforma de terceiros.</span>
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 48 }}>
            {[
              ...(cfg.dor ?? [
                { icon: "😤", title: "iFood leva até 27%", desc: "De cada R$100 que você vende, R$27 ficam pra eles. Todo mês, todo pedido." },
                { icon: "📵", title: "Dados não são seus", desc: "Os clientes são deles. Você não tem contato, não tem histórico, não tem controle." },
                { icon: "😩", title: "WhatsApp te consome", desc: "Fica olhando a tela esperando pedido, conferindo comprovante, respondendo a mesma pergunta mil vezes." },
                { icon: "😰", title: "Cliente não volta", desc: "Sem fidelização, sem relacionamento. Cada venda é como se fosse a primeira. Você começa do zero todo dia." },
              ]),
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 20, padding: "24px 20px" }}>
                <div style={{ fontSize: "2rem", marginBottom: 12 }}>{item.icon}</div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: 8, color: "#fca5a5" }}>{item.title}</div>
                <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{item.desc}</div>
              </motion.div>
            ))}
          </div>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ textAlign: "center", background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(124,58,237,0.1))", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 24, padding: "28px 32px" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>💡</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(1.2rem, 3vw, 1.8rem)", fontWeight: 900, marginBottom: 8 }}>
              A NexFoody resolve tudo isso.
            </div>
            <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.55)", maxWidth: 520, margin: "0 auto" }}>
              Seu próprio canal, seus clientes, sua marca — com IA, rede social e gamificação inclusos.
            </div>
          </motion.div>
        </div>
      </Section>

      {/* ── CRESCIMENTO ──────────────────────────────────────── */}
      <Section style={{ padding: "100px 24px", background: "linear-gradient(180deg, transparent, rgba(34,197,94,0.05), transparent)" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#22c55e", marginBottom: 12, fontWeight: 700 }}>Resultado real</div>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}>
                Suas vendas podem<br />
                <span className="gradient-text">disparar todo mês.</span>
              </h2>
              <p style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 28, fontSize: "0.95rem" }}>
                Lojas na NexFoody vendem mais porque os clientes voltam — não por obrigação, mas porque querem subir no ranking, resgatar prêmios e interagir com a marca.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { emoji: "📈", label: "Mais pedidos recorrentes" },
                  { emoji: "❤️", label: "Clientes fiéis que promovem sua loja" },
                  { emoji: "🎯", label: "Marketing zero — a plataforma faz por você" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.88rem", color: "rgba(255,255,255,0.7)" }}>
                    <span style={{ fontSize: "1.1rem" }}>{item.emoji}</span>{item.label}
                  </div>
                ))}
              </div>
            </div>
            {/* Gráfico de crescimento */}
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: "28px 24px", position: "relative", overflow: "hidden" }}>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.08em" }}>Pedidos mensais — loja exemplo</div>
              <div style={{ position: "relative", height: 160 }}>
                <svg viewBox="0 0 300 140" style={{ width: "100%", height: "100%" }}>
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Grid lines */}
                  {[0,1,2,3].map(i => <line key={i} x1="0" y1={i*40} x2="300" y2={i*40} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />)}
                  {/* Area fill */}
                  <motion.path
                    initial={{ pathLength: 0, opacity: 0 }}
                    whileInView={{ pathLength: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    d="M0,120 L50,100 L100,85 L150,65 L200,40 L250,20 L300,5 L300,140 L0,140Z"
                    fill="url(#chartGrad)"
                  />
                  {/* Line */}
                  <motion.path
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    d="M0,120 L50,100 L100,85 L150,65 L200,40 L250,20 L300,5"
                    fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"
                  />
                  {/* Dots */}
                  {[[0,120],[50,100],[100,85],[150,65],[200,40],[250,20],[300,5]].map(([x,y],i) => (
                    <motion.circle key={i} cx={x} cy={y} r="4" fill="#22c55e"
                      initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.2 + 0.8 }} />
                  ))}
                </svg>
                {/* Rocket */}
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  style={{ position: "absolute", top: -10, right: 0, fontSize: "2rem" }}>🚀</motion.div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                {["Jan","Fev","Mar","Abr","Mai","Jun","Jul"].map((m,i) => (
                  <div key={i} style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.25)" }}>{m}</div>
                ))}
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 16 }}>
                <div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.6rem", fontWeight: 900, color: "#22c55e" }}>{cr("stat1Val","+340%")}</div>
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)" }}>{cr("stat1Label","em 6 meses")}</div>
                </div>
                <div style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", paddingLeft: 16 }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.6rem", fontWeight: 900, color: "#f5c518" }}>{cr("stat2Val","87%")}</div>
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)" }}>{cr("stat2Label","clientes que voltam")}</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ── CHAT IA ──────────────────────────────────────────── */}
      <Section style={{ padding: "100px 24px", background: "linear-gradient(180deg, transparent, rgba(124,58,237,0.06), transparent)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
            {/* Chat mockup */}
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              style={{ background: "linear-gradient(145deg,#13062a,#0d0820)", border: "1px solid rgba(124,58,237,0.4)", borderRadius: 28, overflow: "hidden", boxShadow: "0 24px 80px rgba(124,58,237,0.25)" }}>
              {/* Header */}
              <div style={{ background: "rgba(124,58,237,0.25)", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>🤖</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>NexBot</div>
                  <div style={{ fontSize: "0.65rem", color: "#22c55e" }}>● Online agora</div>
                </div>
              </div>
              {/* Messages */}
              <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { from: "bot", text: "Oi! 😊 Sou o NexBot da Açaí Puro Gosto. Posso te ajudar? Temos açaí, tapioca e lanches hoje!" },
                  { from: "user", text: "Quero um açaí 500ml com granola e leite condensado" },
                  { from: "bot", text: "Perfeito! 🍧 Açaí 500ml + granola + leite condensado = R$22,00. Endereço de entrega?" },
                  { from: "user", text: "Rua das Flores, 142" },
                  { from: "bot", text: "✅ Pedido confirmado! Tempo estimado: 25 min. Pague na entrega ou Pix (chave: loja@pix). Qualquer dúvida, é só chamar!" },
                ].map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                    style={{ maxWidth: "82%", alignSelf: msg.from === "user" ? "flex-end" : "flex-start",
                      background: msg.from === "bot" ? "rgba(124,58,237,0.25)" : "rgba(245,197,24,0.2)",
                      border: msg.from === "bot" ? "1px solid rgba(124,58,237,0.35)" : "1px solid rgba(245,197,24,0.3)",
                      borderRadius: msg.from === "bot" ? "14px 14px 14px 2px" : "14px 14px 2px 14px",
                      padding: "10px 14px", fontSize: "0.78rem", color: "rgba(255,255,255,0.88)", lineHeight: 1.5 }}>
                    {msg.text}
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <div>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#818cf8", marginBottom: 12, fontWeight: 700 }}>Sugestão 1</div>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}>
                O fim do atendimento<br />
                <span className="gradient-text">estressante no WhatsApp.</span>
              </h2>
              <div style={{ display: "inline-block", background: "rgba(129,140,248,0.12)", border: "1px solid rgba(129,140,248,0.35)", borderRadius: 12, padding: "10px 18px", marginBottom: 20 }}>
                <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff" }}>Seu atendente que nunca falta, nunca atrasa e nunca cansa.</span>
              </div>
              <p style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 24, fontSize: "0.95rem" }}>
                Nosso robô humanizado é super inteligente e sabe <strong style={{ color: "#fff" }}>tudo da sua loja</strong> e de todos os produtos. Você não precisa ficar olhando a tela nem conferir comprovante.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { icon: "🛒", text: "Adiciona produtos ao carrinho automaticamente" },
                  { icon: "🧠", text: "Sabe o histórico e preferências de cada cliente" },
                  { icon: "💳", text: "Confirma pagamento sem você precisar checar" },
                  { icon: "⏰", text: "Atende 24 horas, 7 dias por semana, sem parar" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(129,140,248,0.15)", border: "1px solid rgba(129,140,248,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>{item.icon}</div>
                    <div style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.5, paddingTop: 8 }}>{item.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── GERENTE IA ───────────────────────────────────────── */}
      <Section style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#818cf8", marginBottom: 12, fontWeight: 700 }}>Sugestão 2</div>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}>
                Gerente IA —<br />
                <span className="gradient-text">sabe tudo da sua loja.</span>
              </h2>
              <p style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 24, fontSize: "0.95rem" }}>
                Quantos pedidos foram feitos, quanto entrou, quanto foi no Pix, dinheiro ou cartão. Ele manda um resumo em texto e um relatório em PDF com gráficos e comparativos.
              </p>
              <p style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 32, fontSize: "0.88rem", fontStyle: "italic" }}>
                "Você pode viajar tranquilo — saberá tudo o que aconteceu no seu delivery."
              </p>
              <Link to="/lojista/cadastro" className="btn-gold">Quero meu Gerente IA →</Link>
            </div>

            {/* Dashboard mockup */}
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              style={{ background: "linear-gradient(145deg,#13062a,#0d0820)", border: "1px solid rgba(129,140,248,0.3)", borderRadius: 28, padding: "24px", boxShadow: "0 24px 80px rgba(129,140,248,0.15)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#818cf8,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>🤖</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>Resumo de Hoje — Gerente IA</div>
                  <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.35)" }}>Seg, 18 Abr · 23:59</div>
                </div>
              </div>
              <div style={{ background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.15)", borderRadius: 16, padding: "14px 16px", marginBottom: 14, fontSize: "0.78rem", color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
                Boa noite! 👋 Hoje sua loja teve <strong style={{ color: "#f5c518" }}>47 pedidos</strong>, faturamento de <strong style={{ color: "#22c55e" }}>R$1.240</strong>. Pix: R$820 · Cartão: R$320 · Dinheiro: R$100. Ticket médio: R$26,38. Seu melhor dia da semana!
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
                {[
                  { label: "Pedidos", value: "47", icon: "📦", cor: "#818cf8" },
                  { label: "Faturamento", value: "R$1.240", icon: "💰", cor: "#22c55e" },
                  { label: "Avaliação", value: "4.9⭐", icon: "⭐", cor: "#f5c518" },
                ].map((s, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: "1rem", marginBottom: 4 }}>{s.icon}</div>
                    <div style={{ fontWeight: 800, fontSize: "0.88rem", color: s.cor }}>{s.value}</div>
                    <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>📄 Relatório PDF completo</div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.15)", borderRadius: 8, padding: "4px 10px" }}>Baixar</div>
              </div>
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ── LIVRO CAIXA FLUTUANTE ───────────────────────────── */}
      <Section style={{ padding: "100px 24px", background: "linear-gradient(180deg, transparent, rgba(22,163,74,0.06), transparent)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>

            {/* Mockup do PDV */}
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              style={{ position: "relative" }}>
              <div style={{ background: "linear-gradient(145deg,#0b1a0d,#0d0820)", border: "1px solid rgba(22,163,74,0.4)", borderRadius: 28, overflow: "hidden", boxShadow: "0 24px 80px rgba(22,163,74,0.2)" }}>
                {/* Header */}
                <div style={{ background: "rgba(22,163,74,0.18)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ fontSize: "1.4rem" }}>📒</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>Livro Caixa — Açaí Puro Gosto</div>
                    <div style={{ fontSize: "0.62rem", color: "#4ade80" }}>● Caixa aberto</div>
                  </div>
                </div>
                {/* Tab buttons */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
                  {[
                    { bg: "#16a34a", cor: "#fff", label: "📦 Venda" },
                    { bg: "#f5c518", cor: "#0a0414", label: "✏️ Avulso" },
                    { bg: "#ef4444", cor: "#fff", label: "💸 Retirada" },
                    { bg: "#7c3aed", cor: "#fff", label: "📋 Histórico" },
                  ].map((t, i) => (
                    <div key={i} style={{ background: t.bg, padding: "10px 0", textAlign: "center", fontSize: "0.62rem", fontWeight: 800, color: t.cor }}>
                      {t.label}
                    </div>
                  ))}
                </div>
                {/* Lançamentos */}
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Lançamentos de hoje</div>
                  {[
                    { icon: "📦", label: "Açaí 500ml ×2", valor: "+R$44,00", cor: "#4ade80" },
                    { icon: "✏️", label: "Refrigerante avulso", valor: "+R$5,00", cor: "#4ade80" },
                    { icon: "💸", label: "Retirada — troco coca-cola", valor: "-R$35,00", cor: "#f87171" },
                    { icon: "📦", label: "Combo açaí + suco", valor: "+R$35,00", cor: "#4ade80" },
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: "0.9rem" }}>{item.icon}</span>
                      <div style={{ flex: 1, fontSize: "0.72rem", color: "rgba(255,255,255,0.7)" }}>{item.label}</div>
                      <div style={{ fontWeight: 800, fontSize: "0.78rem", color: item.cor }}>{item.valor}</div>
                    </div>
                  ))}
                  {/* Saldo */}
                  <div style={{ background: "rgba(22,163,74,0.12)", border: "1px solid rgba(22,163,74,0.25)", borderRadius: 12, padding: "10px 14px", marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.55)" }}>Saldo líquido do caixa</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: "#4ade80", fontSize: "1.05rem" }}>R$49,00</div>
                  </div>
                  {/* Botões */}
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <div style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "9px 0", textAlign: "center", fontSize: "0.7rem", fontWeight: 700, color: "#fff" }}>
                      📄 Fechar Caixa
                    </div>
                    <div style={{ background: "#25d366", borderRadius: 10, padding: "9px 16px", fontSize: "0.7rem", fontWeight: 700, color: "#fff" }}>
                      📤 WA
                    </div>
                  </div>
                </div>
              </div>
              {/* Badge flutuante */}
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.5 }}
                style={{ position: "absolute", top: -14, right: -14, background: "linear-gradient(135deg,#f5c518,#e6a817)", color: "#0a0414", borderRadius: 12, padding: "6px 14px", fontSize: "0.62rem", fontWeight: 900, letterSpacing: "0.05em", boxShadow: "0 4px 20px rgba(245,197,24,0.4)", whiteSpace: "nowrap" }}>
                🏆 EXCLUSIVO NEXFOODY
              </motion.div>
            </motion.div>

            {/* Texto */}
            <div>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#4ade80", marginBottom: 12, fontWeight: 700 }}>Diferencial único no mercado</div>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: 16 }}>
                Livro Caixa<br />
                <span className="gradient-text">Flutuante.</span>
              </h2>
              <div style={{ display: "inline-block", background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.3)", borderRadius: 12, padding: "10px 18px", marginBottom: 20 }}>
                <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "#fff" }}>Nenhum app de delivery tem isso. Só a NexFoody.</span>
              </div>
              <p style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 24, fontSize: "0.95rem" }}>
                Enquanto você atende no balcão, registre cada venda em segundos. O gerente pediu para retirar R$35 para comprar coca-cola? Um toque. Produto fora do cardápio? Avulso na hora. Tudo controlado, sem papel e sem planilha.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
                {[
                  { icon: "📦", cor: "#16a34a", bg: "rgba(22,163,74,0.1)", text: "Venda do balcão — adicione produtos do catálogo em segundos" },
                  { icon: "✏️", cor: "#ca8a04", bg: "rgba(245,197,24,0.1)", text: "Avulso — qualquer valor, empilhável, sem precisar ter no delivery" },
                  { icon: "💸", cor: "#dc2626", bg: "rgba(239,68,68,0.1)", text: "Sangria & Retirada — registre saídas para não perder o controle" },
                  { icon: "📋", cor: "#7c3aed", bg: "rgba(124,58,237,0.1)", text: "Fechamento de Caixa em PDF + envio direto pelo WhatsApp" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: item.bg, border: `1px solid ${item.cor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>{item.icon}</div>
                    <div style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.5, paddingTop: 8 }}>{item.text}</div>
                  </div>
                ))}
              </div>
              <Link to="/lojista/cadastro" className="btn-gold">Quero meu Livro Caixa →</Link>
            </div>
          </div>
        </div>
      </Section>

      {/* ── REDE SOCIAL + GAMIFICAÇÃO ────────────────────────── */}
      <Section style={{ padding: "100px 24px", background: "linear-gradient(180deg, transparent, rgba(225,48,108,0.05), transparent)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#e1306c", marginBottom: 12, fontWeight: 700 }}>Rede Social + Gamificação</div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: 16 }}>
              Seus clientes vendem<br />
              <span className="gradient-text">por você — todo dia.</span>
            </h2>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "1rem", maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
              Enquanto outros apps vendem <em>por você</em>, a NexFoody faz seus <strong style={{ color: "#f5c518" }}>clientes venderem por você</strong> — compartilhando, comentando e competindo.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 40 }}>
            {/* Feed mockup */}
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(225,48,108,0.25)", borderRadius: 24, overflow: "hidden" }}>
              <div style={{ background: "rgba(225,48,108,0.12)", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#e1306c,#f56040)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>🍧</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>Açaí Puro Gosto</div>
                  <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.35)" }}>🍓 Verificada · 1.2k seguidores</div>
                </div>
              </div>
              {[
                { img: "🍧", txt: "Açaí especial do dia com cobertura de morango! 😍", likes: 84, cmts: 12 },
                { img: "🎉", txt: "Promoção de terça: compre 2 e ganhe 1! Só hoje!", likes: 127, cmts: 31 },
              ].map((post, i) => (
                <div key={i} style={{ padding: "14px 18px", borderBottom: i === 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, height: 80, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem", marginBottom: 10 }}>{post.img}</div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.65)", marginBottom: 8, lineHeight: 1.4 }}>{post.txt}</div>
                  <div style={{ display: "flex", gap: 16 }}>
                    {[["❤️", post.likes], ["💬", post.cmts], ["🔗", ""], ["⭐", ""]].map(([ic, val], j) => (
                      <div key={j} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.72rem", color: "rgba(255,255,255,0.4)" }}>
                        <span>{ic}</span>{val && <span>{val}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Ranking de fãs */}
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }}
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(245,197,24,0.2)", borderRadius: 24, overflow: "hidden" }}>
              <div style={{ background: "rgba(245,197,24,0.1)", padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "#f5c518" }}>🏆 Ranking de Fãs — Açaí Puro Gosto</div>
                <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Quem é o maior fã do mês?</div>
              </div>
              {[
                { pos: 1, name: "Fernanda Lima", pts: 840, badge: "👑", cor: "#f5c518", pct: "100%" },
                { pos: 2, name: "Rafael Costa", pts: 720, badge: "🥈", cor: "#94a3b8", pct: "86%" },
                { pos: 3, name: "Ana Beatriz", pts: 610, badge: "🥉", cor: "#cd7c2f", pct: "73%" },
                { pos: 4, name: "Lucas Mendes", pts: 480, badge: "4º", cor: "#818cf8", pct: "57%" },
                { pos: 5, name: "Carla Santos", pts: 310, badge: "5º", cor: "#a855f7", pct: "37%" },
              ].map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <div style={{ fontSize: "1rem", width: 24, textAlign: "center", flexShrink: 0 }}>{f.badge}</div>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${f.cor}22`, border: `1px solid ${f.cor}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", flexShrink: 0 }}>👤</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700 }}>{f.name}</div>
                    <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: f.pct, background: `linear-gradient(90deg,${f.cor},${f.cor}88)`, borderRadius: 2, transition: "width 1s" }} />
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "0.88rem", fontWeight: 900, color: f.cor, flexShrink: 0 }}>{f.pts}</div>
                </div>
              ))}
              <div style={{ padding: "12px 18px", textAlign: "center" }}>
                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)" }}>💎 Ganhe diamantes a cada compra e suba no ranking</div>
              </div>
            </motion.div>
          </div>

          {/* Gamificação chips */}
          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            {GAMIFICATION.map((g, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                style={{ display: "flex", alignItems: "center", gap: 8, background: `${g.color}12`, border: `1px solid ${g.color}30`, borderRadius: 40, padding: "10px 18px" }}>
                <span style={{ fontSize: "1.2rem" }}>{g.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem", color: g.color }}>{g.label}</div>
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)", maxWidth: 160 }}>{g.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── COMO É FÁCIL PEDIR ───────────────────────────────── */}
      <Section style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#f5c518", marginBottom: 12, fontWeight: 700 }}>Cardápio único</div>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}>
                Pedir nunca foi<br />
                <span className="gradient-text">tão fácil e divertido.</span>
              </h2>
              <p style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 24, fontSize: "0.95rem" }}>
                Cardápio visual, interativo e cheio de vida. O cliente curte, comenta, compartilha e favorita diretamente no produto. Cada card é uma experiência.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { icon: "💬", text: "Botão de chat com IA direto no cardápio" },
                  { icon: "❤️", text: "Curtir, comentar, compartilhar e favoritar" },
                  { icon: "📸", text: "Fotos e vídeos dos produtos em destaque" },
                  { icon: "🔎", text: "Busca e filtros por categoria" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.88rem", color: "rgba(255,255,255,0.65)" }}>
                    <span style={{ fontSize: "1rem" }}>{item.icon}</span>{item.text}
                  </div>
                ))}
              </div>
            </div>

            {/* Cardápio mockup */}
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              style={{ background: "linear-gradient(145deg,#13062a,#0d0820)", border: "1px solid rgba(245,197,24,0.25)", borderRadius: 28, overflow: "hidden", boxShadow: "0 24px 80px rgba(245,197,24,0.1)" }}>
              {/* Top bar */}
              <div style={{ background: "rgba(245,197,24,0.12)", padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(245,197,24,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>🍧</div>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>Açaí Puro Gosto</div>
                </div>
                {/* Chat button */}
                <div style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", borderRadius: 20, padding: "5px 12px", fontSize: "0.68rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                  💬 Chat
                </div>
              </div>
              {/* Category tabs */}
              <div style={{ padding: "10px 18px", display: "flex", gap: 8, borderBottom: "1px solid rgba(255,255,255,0.05)", overflowX: "auto" }}>
                {["🍧 Açaí","🥤 Sucos","🥪 Lanches"].map((cat, i) => (
                  <div key={i} style={{ padding: "4px 12px", borderRadius: 20, fontSize: "0.68rem", fontWeight: 700, background: i === 0 ? "rgba(245,197,24,0.2)" : "rgba(255,255,255,0.04)", border: `1px solid ${i === 0 ? "rgba(245,197,24,0.4)" : "rgba(255,255,255,0.08)"}`, color: i === 0 ? "#f5c518" : "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>{cat}</div>
                ))}
              </div>
              {/* Product cards */}
              {[
                { name: "Açaí 500ml", price: "R$22", emoji: "🍧", likes: 84, popular: true },
                { name: "Açaí 700ml", price: "R$30", emoji: "🍧", likes: 62, popular: false },
              ].map((prod, i) => (
                <div key={i} style={{ margin: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
                    <div style={{ width: 56, height: 56, borderRadius: 12, background: "rgba(245,197,24,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", flexShrink: 0 }}>{prod.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{prod.name}</div>
                        {prod.popular && <div style={{ background: "rgba(34,197,94,0.2)", color: "#22c55e", borderRadius: 6, padding: "1px 6px", fontSize: "0.55rem", fontWeight: 800 }}>🔥 TOP</div>}
                      </div>
                      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: "#f5c518", fontSize: "0.95rem" }}>{prod.price}</div>
                    </div>
                    <div style={{ background: "linear-gradient(135deg,#f5c518,#e6a817)", borderRadius: 10, padding: "6px 12px", fontSize: "0.7rem", fontWeight: 800, color: "#000" }}>+ Add</div>
                  </div>
                  {/* Interaction bar */}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "8px 14px", display: "flex", gap: 16 }}>
                    {[["❤️",prod.likes],["💬",""],["↗️",""],["⭐",""]].map(([ic,val],j) => (
                      <div key={j} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
                        <span>{ic}</span>{val && <span>{val}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ── TIKTOK HOME ──────────────────────────────────────── */}
      <Section style={{ padding: "100px 24px", background: "linear-gradient(180deg, transparent, rgba(124,58,237,0.06), transparent)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#a855f7", marginBottom: 12, fontWeight: 700 }}>Home estilo TikTok</div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: 16 }}>
              Seus produtos aparecem<br />
              <span className="gradient-text">para quem já quer comprar.</span>
            </h2>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "1rem", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
              O cliente escolhe o que quer ver na home — e os produtos da sua loja aparecem exatamente para quem tem interesse. Sem pagar por anúncio.
            </p>
          </div>

          {/* TikTok-style cards */}
          {(() => {
            const CORS = ["#e1306c","#f5c518","#22c55e","#818cf8"];
            const DEFAULT_TIKTOK = [
              { imageUrl: "", emoji: "🍧", name: "Açaí Especial", store: "Puro Gosto", price: "R$22", tag: "🔥 Trend" },
              { imageUrl: "", emoji: "🍔", name: "Burguer Duplo", store: "Burguer Mais", price: "R$35", tag: "⭐ Top" },
              { imageUrl: "", emoji: "🍕", name: "Pizza 8 fatias", store: "Pizza da Vila", price: "R$48", tag: "🎉 Promo" },
              { imageUrl: "", emoji: "🥗", name: "Bowl Saudável", store: "Lanches Naturais", price: "R$28", tag: "✨ Novo" },
            ];
            const cards = cfg.tikTok ?? DEFAULT_TIKTOK;
            return (
              <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
                {cards.map((item, i) => {
                  const cor = CORS[i % CORS.length];
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                      style={{ width: 180, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, overflow: "hidden" }}>
                      <div style={{ height: 140, background: `linear-gradient(145deg, ${cor}20, rgba(0,0,0,0.3))`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "3.5rem", position: "relative", overflow: "hidden" }}>
                        {item.imageUrl
                          ? <img src={item.imageUrl} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                          : item.emoji}
                        <div style={{ position: "absolute", top: 8, right: 8, background: `${cor}30`, border: `1px solid ${cor}50`, borderRadius: 10, padding: "2px 8px", fontSize: "0.58rem", fontWeight: 800, color: cor, backdropFilter: "blur(4px)" }}>{item.tag}</div>
                      </div>
                      <div style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: 2 }}>{item.name}</div>
                        <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>{item.store}</div>
                        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: "#f5c518", fontSize: "1rem" }}>{item.price}</div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            );
          })()}

          <div style={{ textAlign: "center", marginTop: 36 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 40, padding: "10px 20px", fontSize: "0.82rem", color: "rgba(255,255,255,0.55)" }}>
              <span>✅</span> Visibilidade orgânica — sem pagar por anúncio
            </div>
          </div>
        </div>
      </Section>

      {/* ── MAPAFOODY ────────────────────────────────────────── */}
      <MapaFoody />

      {/* ── VS IFOOD ─────────────────────────────────────────── */}
      <Section style={{ padding: "100px 24px", background: "linear-gradient(180deg, transparent, rgba(239,68,68,0.04), transparent)" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#f87171", marginBottom: 12, fontWeight: 700 }}>Sem taxa de intermediação</div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: 16 }}>
              Chega de pagar<br />
              <span className="gradient-text">27% pro iFood.</span>
            </h2>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "1rem", maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
              Na NexFoody você tem seu próprio canal com <strong style={{ color: "#f5c518" }}>chat integrado tipo WhatsApp</strong> — grátis até 20 pedidos, depois apenas <strong style={{ color: "#22c55e" }}>R$1 por pedido</strong> com teto de R$300/mês.
            </p>
          </div>

          {/* Tabela comparativa */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ padding: "14px 24px", fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Funcionalidade</div>
              <div style={{ padding: "14px 0", textAlign: "center", fontWeight: 800, fontSize: "0.88rem", color: "#ef4444" }}>iFood</div>
              <div style={{ padding: "14px 0", textAlign: "center", fontWeight: 800, fontSize: "0.88rem", color: "#f5c518" }}>🍓 NexFoody</div>
            </div>
            {COMPARATIVO.map(([feature, ifood, nexfoody], i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", borderBottom: i < COMPARATIVO.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                <div style={{ padding: "13px 24px", fontSize: "0.85rem", color: "rgba(255,255,255,0.75)", display: "flex", alignItems: "center" }}>{feature}</div>
                <div style={{ padding: "13px 0", textAlign: "center", fontSize: "0.82rem", color: ifood.startsWith("❌") ? "#ef4444" : "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>{ifood}</div>
                <div style={{ padding: "13px 0", textAlign: "center", fontSize: "0.82rem", fontWeight: 700, color: nexfoody.startsWith("✅") ? "#22c55e" : "#f5c518", display: "flex", alignItems: "center", justifyContent: "center" }}>{nexfoody}</div>
              </motion.div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.5 }} style={{ marginTop: 32, textAlign: "center" }}>
            <Link to="/lojista/cadastro" className="btn-gold">Começar grátis agora →</Link>
            <p style={{ marginTop: 12, fontSize: "0.72rem", color: "rgba(255,255,255,0.3)" }}>Sem cartão de crédito · Sem taxa de adesão · Cancele quando quiser</p>
          </motion.div>
        </div>
      </Section>

      {/* ── INOVAÇÕES ────────────────────────────────────────── */}
      <Section style={{ padding: "100px 24px", background: "linear-gradient(180deg, transparent, rgba(129,140,248,0.04), transparent)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#818cf8", marginBottom: 12, fontWeight: 700 }}>Inovações</div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: 16 }}>
              Muito além de um<br />
              <span className="gradient-text">app de delivery.</span>
            </h2>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "1rem", maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
              NexFoody é a primeira plataforma que combina delivery, rede social, IA e gamificação em um só lugar.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
            {INOVACOES.map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: "28px 24px", position: "relative", overflow: "hidden" }}>
                {/* Glow bg */}
                <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: `radial-gradient(circle, ${item.glow}, transparent 70%)`, pointerEvents: "none" }} />
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: `${item.cor}18`, border: `1px solid ${item.cor}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem" }}>{item.icon}</div>
                    <span style={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: item.cor, background: `${item.cor}18`, border: `1px solid ${item.cor}35`, borderRadius: 20, padding: "3px 10px" }}>{item.badge}</span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: "1.05rem", marginBottom: 8, color: "#fff" }}>{item.titulo}</div>
                  <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── PLANOS ───────────────────────────────────────────── */}
      <Section id="planos" style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#a855f7", marginBottom: 12, fontWeight: 700 }}>Preço</div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: 16 }}>
              Dois planos.<br />
              <span className="gradient-text">Paga só o que usar.</span>
            </h2>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "1rem", maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
              Até 20 pedidos por mês é sempre grátis. Depois, você escolhe com ou sem IA.
            </p>
          </div>

          {/* Faixa gratuita */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 16, padding: "14px 24px", marginBottom: 24, textAlign: "center" }}>
            <span style={{ fontSize: "1.4rem" }}>🌱</span>
            <div>
              <span style={{ fontWeight: 800, color: "#22c55e", fontSize: "0.95rem" }}>Grátis nos primeiros 20 pedidos/mês </span>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.82rem" }}>— para qualquer plano, sempre.</span>
            </div>
          </motion.div>

          {/* Card Catálogo — destaque separado, entrada fácil */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 24, padding: "24px 28px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ fontSize: "2.4rem" }}>🛍️</div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", fontWeight: 900, color: "#fff" }}>Catálogo Digital</span>
                  <span style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: 20, padding: "2px 10px", fontSize: "0.62rem", fontWeight: 800, color: "#22c55e" }}>GRÁTIS PARA SEMPRE</span>
                </div>
                <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.45)", maxWidth: 420 }}>
                  Link + QR Code do seu cardápio para compartilhar no WhatsApp. Sem delivery, sem mensalidade, sem cartão.
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                  {["✅ Link próprio", "✅ QR Code", "✅ Fotos e preços", "❌ Sem delivery"].map((f, i) => (
                    <span key={i} style={{ fontSize: "0.72rem", color: f.startsWith("✅") ? "#4ade80" : "rgba(255,255,255,0.3)" }}>{f}</span>
                  ))}
                </div>
              </div>
            </div>
            <Link to="/lojista/catalogo"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 24px", background: "rgba(34,197,94,0.15)", border: "1.5px solid rgba(34,197,94,0.4)", borderRadius: 50, fontWeight: 800, fontSize: "0.88rem", color: "#22c55e", textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}>
              Criar catálogo grátis →
            </Link>
          </motion.div>

          {/* Cards dos planos */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20, marginBottom: 32 }}>
            {PLANOS.map((plano, i) => (
              <motion.div key={plano.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                style={{ position: "relative", background: plano.destaque ? `linear-gradient(145deg, rgba(245,197,24,0.12), rgba(124,58,237,0.08))` : "rgba(255,255,255,0.03)", border: `1.5px solid ${plano.destaque ? "rgba(245,197,24,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 28, padding: "36px 28px", overflow: "hidden" }}>

                {/* Glow de fundo */}
                <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: `radial-gradient(circle, ${plano.glow}, transparent 70%)`, pointerEvents: "none" }} />

                {/* Badge */}
                {plano.badge && (
                  <div style={{ position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg,#f5c518,#e6a817)", color: "#0a0414", borderRadius: "0 0 12px 12px", padding: "4px 18px", fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.1em", whiteSpace: "nowrap" }}>{plano.badge}</div>
                )}

                <div style={{ position: "relative" }}>
                  {/* Nome do plano */}
                  <div style={{ marginBottom: 24, marginTop: plano.badge ? 12 : 0 }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.6rem", fontWeight: 900, color: "#fff", marginBottom: 4 }}>{plano.nome}</div>
                    <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{plano.desc}</div>
                  </div>

                  {/* ── O QUE VOCÊ PAGA ── */}
                  <div style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.12em", color: plano.cor, fontWeight: 800, marginBottom: 10 }}>O que você paga</div>
                  <div style={{ background: "rgba(0,0,0,0.2)", border: `1px solid ${plano.cor}25`, borderRadius: 16, padding: "16px 18px", marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.55)" }}>Até 20 pedidos/mês</span>
                      <span style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 900, color: "#22c55e" }}>Grátis</span>
                    </div>
                    {plano.mensalLabel && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.55)" }}>Mensalidade IA</span>
                        <span style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 900, color: "#f5c518" }}>R$39/mês</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.55)" }}>Cada pedido acima de 20</span>
                      <span style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 900, color: plano.cor }}>R$1,00</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff" }}>Você paga no máximo</div>
                        <div style={{ fontSize: "0.72rem", color: "#22c55e", fontWeight: 700, marginTop: 2 }}>Pedidos ilimitados</div>
                      </div>
                      <span style={{ fontFamily: "'Fraunces', serif", fontSize: "1.4rem", fontWeight: 900, color: plano.cor }}>R${plano.cap}/mês</span>
                    </div>
                  </div>

                  {/* Exemplos rápidos */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 24 }}>
                    {plano.exemplos.map((ex, j) => (
                      <div key={j} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                        <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{ex.label}</div>
                        <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.05rem", fontWeight: 900, color: ex.cor }}>{ex.valor}</div>
                      </div>
                    ))}
                  </div>

                  {/* ── O QUE VOCÊ RECEBE ── */}
                  <div style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.12em", color: plano.cor, fontWeight: 800, marginBottom: 10 }}>O que você recebe</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
                    {plano.features.map((f, j) => (
                      <div key={j} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: "0.82rem", color: f.ok ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.2)" }}>
                        <span style={{ color: f.ok ? "#22c55e" : "rgba(255,255,255,0.15)", fontSize: "0.9rem", flexShrink: 0 }}>{f.ok ? "✓" : "✕"}</span>
                        {f.txt}
                      </div>
                    ))}
                  </div>

                  <Link to="/lojista/cadastro"
                    style={{ display: "block", textAlign: "center", background: plano.destaque ? "linear-gradient(135deg,#f5c518,#e6a817)" : "rgba(255,255,255,0.08)", border: plano.destaque ? "none" : "1px solid rgba(255,255,255,0.15)", borderRadius: 20, padding: "14px 24px", fontWeight: 800, fontSize: "0.9rem", color: plano.destaque ? "#0a0414" : "#fff", textDecoration: "none" }}>
                    Começar grátis →
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>

          <p style={{ textAlign: "center", fontSize: "0.72rem", color: "rgba(255,255,255,0.25)" }}>
            Sem cartão de crédito · Sem contrato · Cancele quando quiser · Preços em BRL
          </p>
        </div>
      </Section>

      {/* ── DOWNLOAD ─────────────────────────────────────────── */}
      <Section id="download" style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ position: "relative", borderRadius: 32, overflow: "hidden", background: "linear-gradient(135deg, #1a0a36, #2d1b69)", border: "1px solid rgba(124,58,237,0.4)", padding: "60px 40px", textAlign: "center" }}>
            <div style={{ position: "absolute", top: -40, left: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,197,24,0.15), transparent 70%)" }} />
            <div style={{ position: "absolute", bottom: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.2), transparent 70%)" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 3 }} style={{ fontSize: "4rem", marginBottom: 20, display: "block" }}>📱</motion.div>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 900, marginBottom: 12 }}>
                Sua cidade está<br />
                <span className="gradient-text">esperando por você.</span>
              </h2>
              <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 40, fontSize: "1rem" }}>
                Baixe grátis e comece a ganhar pontos hoje mesmo.
              </p>
              <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
                <a href="#" className="btn-gold" style={{ background: "#000", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}>
                  🍎 App Store
                </a>
                <a href="#" className="btn-gold" style={{ background: "#000", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}>
                  ▶ Google Play
                </a>
              </div>
              <div style={{ marginTop: 32, padding: "16px", background: "rgba(255,255,255,0.05)", borderRadius: 16, display: "inline-block" }}>
                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Ou acesse direto no browser</div>
                <div style={{ fontFamily: "'Fraunces', serif", color: "#f5c518", fontWeight: 700 }}>nexfoody.com</div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "40px 24px", textAlign: "center" }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.5rem", fontWeight: 900, color: "#f5c518", marginBottom: 12 }}>🍓 NexFoody</div>
        <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.3)", marginBottom: 20 }}>A rede social de consumo local do Brasil.</div>
        <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { label: "Explorar lojas", to: "/" },
            { label: "Ranking", to: "/ranking" },
            { label: "Prêmios", to: "/premios" },
            { label: "Lojistas", to: "/lojista/cadastro" },
          ].map((l, i) => (
            <Link key={i} to={l.to} style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.82rem", textDecoration: "none" }}>{l.label}</Link>
          ))}
        </div>
        <div style={{ marginTop: 32, fontSize: "0.7rem", color: "rgba(255,255,255,0.2)" }}>© 2026 NexFoody · Bacabal-MA · Todos os direitos reservados</div>
      </footer>
    </div>
  );
}
