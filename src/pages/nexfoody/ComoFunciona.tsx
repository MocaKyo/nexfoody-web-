// src/pages/nexfoody/ComoFunciona.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const SECOES = [
  {
    id: "plataforma",
    icon: "🍓",
    titulo: "O que é o NexFoody?",
    cor: "#f5c518",
    itens: [
      {
        p: "A primeira rede social de delivery do Brasil",
        r: "O NexFoody une delivery e redes sociais num só lugar. Seus clientes fazem pedidos, postam fotos, ganham pontos e viralizam sua loja — tudo no mesmo app, estilo TikTok e Instagram.",
      },
      {
        p: "É gratuito para o lojista?",
        r: "Sim! O cadastro é 100% gratuito. Não cobramos mensalidade, taxa de adesão nem comissão por pedido. Você vende, você fica com tudo.",
      },
      {
        p: "Como minha loja aparece no feed?",
        r: "Cada pedido feito, foto postada ou promoção criada alimenta o feed da sua cidade. Seus produtos aparecem organicamente para clientes próximos — como um post no TikTok.",
      },
      {
        p: "O que é o Ranking de Fãs?",
        r: "Cada loja tem seu próprio ranking. Clientes ganham pontos ao pedir, postar fotos e interagir. Os mais fiéis aparecem no topo — isso gera orgulho, boca a boca e fidelização real.",
      },
    ],
  },
  {
    id: "lojista",
    icon: "🏪",
    titulo: "Para o lojista",
    cor: "#a78bfa",
    itens: [
      {
        p: "Como me cadastro?",
        r: "Acesse nexfoody.com/lojista/cadastro, preencha os dados da sua loja e pronto. Em menos de 5 minutos você já tem cardápio digital, link próprio e aparece no mapa NexFoody.",
      },
      {
        p: "Preciso de um site ou app separado?",
        r: "Não. O NexFoody é tudo-em-um: cardápio, pedidos, fidelização, feed social e chat com clientes. Funciona direto no celular do seu cliente, sem baixar nada.",
      },
      {
        p: "Como recebo os pedidos?",
        r: "Pelo painel do lojista em tempo real. Você vê cada pedido, confirma, avisa o cliente e acompanha tudo pelo celular — igual um KDS (Kitchen Display System).",
      },
      {
        p: "E o programa de fidelidade?",
        r: "Automático. Cada pedido gera pontos para o cliente. Você define quanto vale cada ponto e quais prêmios oferecer. O cliente acumula, resgata e volta mais vezes.",
      },
      {
        p: "Posso criar cupons e promoções?",
        r: "Sim! Crie cupons de desconto, promoções por tempo limitado e ofertas relâmpago direto pelo painel. Elas aparecem no feed da cidade automaticamente.",
      },
    ],
  },
  {
    id: "embaixador",
    icon: "💰",
    titulo: "Programa Embaixador",
    cor: "#22c55e",
    itens: [
      {
        p: "Como funciona o programa?",
        r: "Você encontra lojas no mapa NexFoody que ainda não estão cadastradas, envia o convite pelo WhatsApp com seu código único e ganha dinheiro de verdade quando elas entram.",
      },
      {
        p: "Quanto ganho por loja?",
        r: "R$ 10 quando a loja se cadastra + R$ 10 quando ela processa o 1º pedido + até R$ 50 de comissão recorrente (0,5% dos pedidos por 6 meses). Máximo de R$ 70 por loja.",
      },
      {
        p: "Como recebo o dinheiro?",
        r: "Via PIX, diretamente na sua conta. Saldo mínimo de R$ 30 para solicitar. Processamos em até 2 dias úteis. Acesse sua Carteira pelo seu perfil.",
      },
      {
        p: "Posso convidar qualquer loja?",
        r: "Apenas lojas que aparecem no Mapa NexFoody. Isso garante que são estabelecimentos reais e evita fraudes. Toque num pin cinza no mapa → convide.",
      },
      {
        p: "Quais são os níveis?",
        r: "🌱 Explorador (1–4 lojas): R$ 20/loja\n🔗 Conector (5–14 lojas): R$ 25/loja\n👑 Embaixador (15+ lojas): R$ 30/loja + 0,5% recorrente por 6 meses",
      },
      {
        p: "Meu código expira?",
        r: "Não. Seu código é permanente e único. Se uma loja usar seu código hoje ou daqui a 1 ano, você recebe normalmente.",
      },
    ],
  },
  {
    id: "regras",
    icon: "📋",
    titulo: "Regras e termos",
    cor: "#60a5fa",
    itens: [
      {
        p: "É proibido criar contas falsas para ganhar comissão?",
        r: "Sim. Tentativas de fraude (contas falsas, lojas fictícias, auto-convite) resultam em bloqueio imediato da conta e cancelamento de todos os saldos pendentes.",
      },
      {
        p: "Uma loja pode ser convidada por várias pessoas?",
        r: "Não. O primeiro convite registrado no sistema é o válido. Por isso, quando encontrar uma loja no mapa, registre seu convite imediatamente ao enviar.",
      },
      {
        p: "O recorrente de 0,5% é garantido?",
        r: "Sim, desde que a loja continue ativa no NexFoody. Se ela pausar ou sair da plataforma, a comissão para automaticamente. Se voltar, retoma de onde parou (dentro do período de 6 meses).",
      },
      {
        p: "Posso indicar minha própria loja?",
        r: "Não. O sistema detecta automaticamente quando o dono da loja e o embaixador são a mesma conta e cancela a comissão.",
      },
      {
        p: "O NexFoody pode alterar as regras?",
        r: "Sim. Qualquer alteração no programa será comunicada com 30 dias de antecedência por notificação no app. Saldos já ganhos são sempre preservados.",
      },
    ],
  },
];

interface ItemFAQ {
  p: string;
  r: string;
}

function ItemAcordeon({ item, cor }: { item: ItemFAQ; cor: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div
      onClick={() => setAberto(!aberto)}
      style={{
        borderBottom: "1px solid rgba(255,255,255,.06)",
        cursor: "pointer",
        padding: "14px 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: aberto ? "#fff" : "rgba(255,255,255,.75)", lineHeight: 1.5, flex: 1 }}>
          {item.p}
        </div>
        <div style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
          background: aberto ? `${cor}20` : "rgba(255,255,255,.06)",
          border: `1px solid ${aberto ? cor + "50" : "rgba(255,255,255,.1)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.75rem", color: aberto ? cor : "rgba(255,255,255,.3)",
          transition: "all .2s",
          transform: aberto ? "rotate(45deg)" : "none",
        }}>
          +
        </div>
      </div>
      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,.5)", lineHeight: 1.75, paddingTop: 10, whiteSpace: "pre-line" }}>
              {item.r}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ComoFunciona() {
  const navigate = useNavigate();
  const [secaoAtiva, setSecaoAtiva] = useState("plataforma");

  const secao = SECOES.find(s => s.id === secaoAtiva) || SECOES[0];

  return (
    <div style={{ minHeight: "100vh", background: "#080412", fontFamily: "'Outfit',sans-serif" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* ── HEADER ──────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(135deg,#1a0a36,#0f0720)", padding: "52px 20px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 20% 50%, rgba(245,197,24,.07) 0%, transparent 60%)" }} />
        <button onClick={() => navigate(-1)} style={{ position: "absolute", top: 16, left: 16, background: "rgba(255,255,255,.08)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>

        <div style={{ position: "relative", textAlign: "center" }}>
          <div style={{ fontSize: "2.2rem", marginBottom: 10 }}>🍓</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.5rem", color: "#fff", marginBottom: 6 }}>
            Como funciona o NexFoody
          </div>
          <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,.4)", lineHeight: 1.7 }}>
            Tire suas dúvidas, entenda as regras<br />e comece a ganhar
          </div>
        </div>
      </div>

      {/* ── ABAS DE SEÇÃO ────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, padding: "16px 16px 0", overflowX: "auto", scrollbarWidth: "none" }}>
        {SECOES.map(s => (
          <button
            key={s.id}
            onClick={() => setSecaoAtiva(s.id)}
            style={{
              flexShrink: 0, padding: "8px 14px",
              background: secaoAtiva === s.id ? `${s.cor}18` : "rgba(255,255,255,.04)",
              border: `1px solid ${secaoAtiva === s.id ? s.cor + "40" : "rgba(255,255,255,.08)"}`,
              borderRadius: 20, cursor: "pointer",
              fontFamily: "'Outfit',sans-serif",
              fontSize: "0.72rem", fontWeight: 700,
              color: secaoAtiva === s.id ? s.cor : "rgba(255,255,255,.4)",
              transition: "all .2s",
              whiteSpace: "nowrap",
            }}
          >
            {s.icon} {s.titulo}
          </button>
        ))}
      </div>

      {/* ── CONTEÚDO ─────────────────────────────────────────── */}
      <div style={{ padding: "16px 16px 0" }}>
        <motion.div
          key={secaoAtiva}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 20, padding: "6px 18px 4px" }}>
            {secao.itens.map((item, i) => (
              <ItemAcordeon key={i} item={item} cor={secao.cor} />
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <div style={{ padding: "24px 16px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
        <Link to="/lojista/cadastro" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "15px", background: "linear-gradient(135deg,#f5c518,#e6a817)", borderRadius: 16, textDecoration: "none", fontWeight: 800, fontSize: "1rem", color: "#0a0414", boxShadow: "0 6px 24px rgba(245,197,24,.35)" }}>
          🏪 Cadastrar minha loja gratuitamente
        </Link>
        <Link to="/mapa" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", background: "rgba(124,58,237,.15)", border: "1px solid rgba(124,58,237,.3)", borderRadius: 16, textDecoration: "none", fontWeight: 700, fontSize: "0.9rem", color: "#a78bfa" }}>
          🗺️ Explorar o mapa e ganhar como embaixador
        </Link>
        <Link to="/app" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, textDecoration: "none", fontWeight: 600, fontSize: "0.88rem", color: "rgba(255,255,255,.5)" }}>
          Ver o feed NexFoody
        </Link>
      </div>
    </div>
  );
}
