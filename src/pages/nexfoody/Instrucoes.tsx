// src/pages/nexfoody/Instrucoes.tsx
// Guia completo para novos lojistas — conteúdo editável pelo Admin
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { motion, AnimatePresence } from "framer-motion";

interface Secao {
  id: string;
  icon: string;
  titulo: string;
  conteudo: string;
}

interface Suporte {
  whatsapp?: string;
  email?: string;
  mensagem?: string;
}

interface InstrucoesData {
  titulo?: string;
  subtitulo?: string;
  secoes?: Secao[];
  suporte?: Suporte;
}

const DEFAULT_DATA: InstrucoesData = {
  titulo: "Como montar sua loja",
  subtitulo: "Guia completo do zero ao primeiro pedido",
  secoes: [
    {
      id: "config",
      icon: "⚙️",
      titulo: "Configurações básicas",
      conteudo: "Acesse o Admin da sua loja e clique em Configurações. Lá você define o nome da loja, logo, foto de capa, horário de funcionamento e categoria.\n\nEscolha uma boa foto de capa — ela é a primeira coisa que o cliente vê.\n\nA categoria define onde sua loja aparece no feed (comida, moda, beleza, serviços...).",
    },
    {
      id: "categorias",
      icon: "🏷️",
      titulo: "Criando categorias",
      conteudo: "As categorias organizam seus produtos/itens dentro da loja.\n\nExemplos: 🍧 Açaí, 🥤 Bebidas, 🍕 Pizza, 👕 Camisetas, 💅 Serviços...\n\nPara criar: Admin → Categorias → Nova categoria. Coloque um nome curto e um emoji.\n\nDica: use no máximo 6 categorias para não confundir o cliente.",
    },
    {
      id: "produtos",
      icon: "🛍️",
      titulo: "Adicionando seus itens",
      conteudo: "Admin → Produtos → Novo produto.\n\nCampos importantes:\n• Nome: curto e direto\n• Descrição: o que tem, o que acompanha\n• Preço: o valor cobrado\n• Foto: fundamental! Produto com foto vende 3× mais\n• Categoria: escolha a categoria criada antes\n• Destaque: marque para aparecer no topo\n\nVocê pode cadastrar quantos itens quiser.",
    },
    {
      id: "delivery",
      icon: "🚚",
      titulo: "Configurando o delivery",
      conteudo: "Admin → Configurações → Delivery.\n\nDefina:\n• Raio de entrega (km)\n• Taxa de entrega (ou grátis acima de X reais)\n• Tempo estimado de entrega\n• Endereço da loja\n\nO mapa mostrará a área de cobertura para o cliente. Você pode ajustar a qualquer momento.",
    },
    {
      id: "ia",
      icon: "🤖",
      titulo: "Ativando a IA no atendimento",
      conteudo: "O NexFoody usa inteligência artificial para atender seus clientes automaticamente.\n\nA IA:\n• Responde dúvidas sobre o cardápio\n• Monta o pedido no carrinho\n• Informa preços e disponibilidade\n• Funciona 24h sem intervenção sua\n\nPara ativar: Admin → Configurações → Atendimento IA → Ativo.\n\nVocê também pode personalizar o nome e o estilo da IA.",
    },
    {
      id: "feed",
      icon: "📱",
      titulo: "Aparecendo no feed",
      conteudo: "O feed TikTok do NexFoody é onde clientes descobrem novas lojas.\n\nSua loja aparece automaticamente quando:\n• Tem pelo menos 3 produtos cadastrados\n• Está marcada como ativa\n• Tem foto de capa\n\nVocê também pode criar posts de promoção, novidade ou aviso. Esses posts aparecem no feed de todos os usuários da plataforma.\n\nAdmin → Feed → Nova postagem.",
    },
    {
      id: "pedidos",
      icon: "🛒",
      titulo: "Gerenciando pedidos",
      conteudo: "Quando chegar um pedido, você recebe uma notificação.\n\nAcesse: Admin → Pedidos para ver todos os pedidos em tempo real.\n\nO KDS (Kitchen Display System) mostra os pedidos na cozinha em ordem de chegada. Acesse em: /kds/SEU-SLUG\n\nMarca o pedido como Pronto quando estiver feito, e como Entregue quando o cliente receber.",
    },
  ],
  suporte: {
    whatsapp: "",
    email: "",
    mensagem: "Ficou com dúvida? Nossa equipe está aqui para ajudar. Entre em contato e te respondemos rapidinho! 🚀",
  },
};

export default function Instrucoes() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const slug = params.get("slug") || "";

  const [data, setData] = useState<InstrucoesData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [secaoAberta, setSecaoAberta] = useState<string | null>("config");

  useEffect(() => {
    getDoc(doc(db, "plataforma", "instrucoes")).then(d => {
      if (d.exists()) {
        const saved = d.data() as InstrucoesData;
        setData({
          titulo: saved.titulo || DEFAULT_DATA.titulo,
          subtitulo: saved.subtitulo || DEFAULT_DATA.subtitulo,
          secoes: saved.secoes?.length ? saved.secoes : DEFAULT_DATA.secoes,
          suporte: { ...DEFAULT_DATA.suporte, ...(saved.suporte || {}) },
        });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const secoes = data.secoes || DEFAULT_DATA.secoes!;

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#07030f", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid rgba(124,58,237,.3)", borderTop: "3px solid #7c3aed", animation: "spin 1s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#07030f,#0f0520)", paddingBottom: 60, fontFamily: "'Outfit',sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(7,3,15,.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,.07)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.07)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "1rem" }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>Guia do lojista</div>
          <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.4)" }}>NexFoody</div>
        </div>
        {slug && (
          <button onClick={() => navigate(`/loja/${slug}/admin`)} style={{ background: "linear-gradient(135deg,#f5c518,#e6a817)", border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 800, fontSize: "0.78rem", color: "#0a0414", cursor: "pointer" }}>
            Ir pro Admin →
          </button>
        )}
      </div>

      {/* ── HERO ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ padding: "32px 20px 24px", textAlign: "center" }}>
        <div style={{ fontSize: "3.5rem", marginBottom: 12 }}>📚</div>
        <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: "clamp(1.8rem,6vw,2.4rem)", fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1.15 }}>
          {data.titulo}
        </h1>
        <p style={{ color: "rgba(255,255,255,.45)", marginTop: 10, fontSize: "0.9rem", lineHeight: 1.6 }}>
          {data.subtitulo}
        </p>

        {/* Progresso visual */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 20 }}>
          {secoes.map((s, i) => (
            <div key={s.id} onClick={() => setSecaoAberta(s.id)} style={{ width: secaoAberta === s.id ? 24 : 8, height: 8, borderRadius: 4, background: secaoAberta === s.id ? "#f5c518" : "rgba(255,255,255,.2)", cursor: "pointer", transition: "all .3s" }} />
          ))}
        </div>
      </motion.div>

      {/* ── SEÇÕES ACCORDION ── */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {secoes.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            style={{ background: secaoAberta === s.id ? "rgba(124,58,237,.12)" : "rgba(255,255,255,.03)", border: `1px solid ${secaoAberta === s.id ? "rgba(124,58,237,.4)" : "rgba(255,255,255,.07)"}`, borderRadius: 16, overflow: "hidden", transition: "all .25s" }}>

            {/* Cabeçalho da seção */}
            <button onClick={() => setSecaoAberta(secaoAberta === s.id ? null : s.id)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: secaoAberta === s.id ? "rgba(124,58,237,.25)" : "rgba(255,255,255,.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0, transition: "all .25s" }}>
                {s.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#fff" }}>{s.titulo}</div>
                <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,.3)", marginTop: 2 }}>
                  {secaoAberta === s.id ? "Toque para fechar" : "Toque para ver"}
                </div>
              </div>
              <motion.div animate={{ rotate: secaoAberta === s.id ? 180 : 0 }} transition={{ duration: .25 }}
                style={{ color: secaoAberta === s.id ? "#a78bfa" : "rgba(255,255,255,.3)", fontSize: "1rem" }}>
                ▾
              </motion.div>
            </button>

            {/* Conteúdo expandido */}
            <AnimatePresence>
              {secaoAberta === s.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .25 }}
                  style={{ overflow: "hidden" }}>
                  <div style={{ padding: "0 16px 18px 68px" }}>
                    {s.conteudo.split("\n").map((linha, li) => (
                      <p key={li} style={{ margin: "0 0 6px", fontSize: "0.85rem", color: "rgba(255,255,255,.7)", lineHeight: 1.7, fontFamily: "'Outfit',sans-serif" }}>
                        {linha || <>&nbsp;</>}
                      </p>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* ── BOTÃO ADMIN ── */}
      {slug && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .4 }}
          style={{ padding: "28px 16px 0" }}>
          <button onClick={() => navigate(`/loja/${slug}/admin`)}
            style={{ width: "100%", padding: "16px", background: "linear-gradient(135deg,#f5c518,#e6a817)", border: "none", borderRadius: 16, fontFamily: "'Outfit',sans-serif", fontWeight: 900, fontSize: "1.05rem", color: "#0a0414", cursor: "pointer", boxShadow: "0 8px 24px rgba(245,197,24,.25)" }}>
            ⚙️ Montar minha loja agora →
          </button>
          <p style={{ textAlign: "center", fontSize: "0.7rem", color: "rgba(255,255,255,.25)", marginTop: 10 }}>
            Você pode voltar aqui a qualquer hora em Admin → Ajuda
          </p>
        </motion.div>
      )}

      {/* ── SUPORTE ── */}
      {data.suporte && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .5 }}
          style={{ margin: "28px 16px 0", background: "linear-gradient(135deg,rgba(34,197,94,.08),rgba(16,185,129,.04))", border: "1px solid rgba(34,197,94,.2)", borderRadius: 20, padding: "20px 20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(34,197,94,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>💬</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>Suporte NexFoody</div>
              <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.35)" }}>Estamos aqui para ajudar</div>
            </div>
          </div>

          <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,.6)", lineHeight: 1.6, marginBottom: 16 }}>
            {data.suporte.mensagem || DEFAULT_DATA.suporte!.mensagem}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.suporte.whatsapp && (
              <a href={`https://wa.me/${data.suporte.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(34,197,94,.12)", border: "1px solid rgba(34,197,94,.3)", borderRadius: 12, padding: "12px 14px", textDecoration: "none" }}>
                <span style={{ fontSize: "1.2rem" }}>📱</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#4ade80" }}>WhatsApp</div>
                  <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.4)" }}>{data.suporte.whatsapp}</div>
                </div>
              </a>
            )}
            {data.suporte.email && (
              <a href={`mailto:${data.suporte.email}`}
                style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(96,165,250,.1)", border: "1px solid rgba(96,165,250,.25)", borderRadius: 12, padding: "12px 14px", textDecoration: "none" }}>
                <span style={{ fontSize: "1.2rem" }}>✉️</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#60a5fa" }}>E-mail</div>
                  <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.4)" }}>{data.suporte.email}</div>
                </div>
              </a>
            )}
            {!data.suporte.whatsapp && !data.suporte.email && (
              <div style={{ textAlign: "center", fontSize: "0.78rem", color: "rgba(255,255,255,.3)", padding: "8px 0" }}>
                Contato será configurado em breve pelo administrador.
              </div>
            )}
          </div>
        </motion.div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
