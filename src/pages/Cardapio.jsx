// src/pages/Cardapio.js
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useStore } from "../contexts/StoreContext";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../components/Toast";
import { collection, onSnapshot, doc, setDoc, updateDoc, increment, deleteField, getDoc, getDocs } from "firebase/firestore";
import { AvaliacaoProduto } from "../components/Avaliacoes";
import ModalProduto from "../components/ModalProduto";
import ComentariosProduto from "../components/ComentariosProduto";
import DeliveryMap from "../components/DeliveryMap";
import { db } from "../lib/firebase";

const LOGO_URL = "https://i.ibb.co/Z1R8Y83G/Whats-App-Image-2026-03-20-at-20-32-27.jpg";

const FILTROS_DISPONIVEIS = [
  { id: "popular",    label: "🔥 Popular",   tipo: "sistema" },
  { id: "favoritos",  label: "❤️ Favoritos", tipo: "nav",     path: "/favoritos" },
  { id: "cupons",     label: "🎟️ Cupons",   tipo: "nav",     path: "/feed" },
  { id: "preco_asc",  label: "💰 Menor",     tipo: "sistema" },
  { id: "preco_desc", label: "💎 Maior",     tipo: "sistema" },
];

// Filtros ordernar por config do admin
function getFiltrosOrdenados(config) {
  const ordem = config?.filtrosOrdem;
  if (!ordem || !Array.isArray(ordem)) return FILTROS_DISPONIVEIS;
  const visivel = config?.filtros || {};
  return FILTROS_DISPONIVEIS
    .filter(f => visivel[f.id] !== false)
    .sort((a, b) => {
      const ia = ordem.indexOf(a.id);
      const ib = ordem.indexOf(b.id);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
}

// Helper to create Instagram-like slug from store name
const toSlug = (name) => {
  if (!name) return "loja";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9\s]/g, "") // remove special chars
    .trim()
    .replace(/\s+/g, "") // remove spaces
    .substring(0, 20); // max 20 chars
};

// ── Ícones SVG outline ───────────────────────────────────────
const IconComment = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconShare = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const SkeletonCard = () => (
  <div style={{ background: "var(--bg2)", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)" }}>
    <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    <div style={{ width: "100%", paddingTop: "100%", backgroundImage: "linear-gradient(90deg, var(--bg3) 25%, rgba(255,255,255,0.05) 50%, var(--bg3) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
    <div style={{ padding: "10px 10px 12px" }}>
      <div style={{ height: 13, backgroundImage: "linear-gradient(90deg, var(--bg3) 25%, rgba(255,255,255,0.05) 50%, var(--bg3) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 6, marginBottom: 8, width: "80%" }} />
      <div style={{ height: 10, backgroundImage: "linear-gradient(90deg, var(--bg3) 25%, rgba(255,255,255,0.05) 50%, var(--bg3) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 6, marginBottom: 10, width: "60%" }} />
      <div style={{ height: 16, backgroundImage: "linear-gradient(90deg, var(--bg3) 25%, rgba(255,255,255,0.05) 50%, var(--bg3) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 6, width: "40%" }} />
    </div>
  </div>
);

export default function Cardapio() {
  const { config, produtos, addToCart, cartCount, pontos } = useStore();
  const isCatalogo = config?.modoOperacao === "catalogo";
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { slug: slugParam } = useParams();

  // ── Tour do novo lojista ──────────────────────────────────────
  const tourParams = new URLSearchParams(location.search);
  const isTour = tourParams.get("tour") === "true";
  const tourSlug = tourParams.get("slug") || "";
  const [tourFechado, setTourFechado] = React.useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState("todos");
  const [categorias, setCategorias] = useState([]);
  const [adicionados, setAdicionados] = useState({});
  const { cartItems } = useStore();
  const noCarrinho = (id) => !!cartItems[id];
  const [produtoModal, setProdutoModal] = useState(null);
  const [comentarioModal, setComentarioModal] = useState(null);
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState("padrao");
  const [mostrarPromo, setMostrarPromo] = useState(true);
  const [userScrolled, setUserScrolled] = useState(false);
  const [mediasAvaliacoes, setMediasAvaliacoes] = useState({});
  const [loadingProdutos, setLoadingProdutos] = useState(true);
  const [stats, setStats] = useState({});
  const [favoritos, setFavoritos] = useState(() => {
    try { return JSON.parse(localStorage.getItem("produtosFavoritos") || "{}"); } catch { return {}; }
  });
  const [comentariosCount, setComentariosCount] = useState({});
  const [likedProducts, setLikedProducts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("likedProducts") || "{}"); } catch { return {}; }
  });
  const [queroProvar, setQueroProvar] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`queroProvar_${user?.uid}`) || "[]"); } catch { return []; }
  });
  const [clientePos, setClientePos] = useState(null);
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [layoutView, setLayoutView] = useState(() => localStorage.getItem("cardapioLayout") || "grid");

// Sincronizar favoritos do Firestore ao logar
useEffect(() => {
  if (!user?.uid) return;
  getDoc(doc(db, "users", user.uid)).then(snap => {
    if (snap.exists() && snap.data().favoritos) {
      const favFirestore = snap.data().favoritos;
      setFavoritos(prev => {
        const merged = { ...prev, ...favFirestore };
        localStorage.setItem("produtosFavoritos", JSON.stringify(merged));
        return merged;
      });
    }
  });
}, [user?.uid]);

const toggleFavorito = async (produto, e) => {
  e.stopPropagation();
  const jaFav = !!favoritos[produto.id];
  const novo = { ...favoritos };
  if (jaFav) delete novo[produto.id];
  else novo[produto.id] = { id: produto.id, nome: produto.nome, foto: produto.foto || null, preco: produto.preco || 0, favoritadoEm: new Date().toISOString() };
  setFavoritos(novo);
  localStorage.setItem("produtosFavoritos", JSON.stringify(novo));
  // Salvar no Firestore se logado
  if (user?.uid) {
    try {
      await updateDoc(doc(db, "users", user.uid), {
        [`favoritos.${produto.id}`]: jaFav ? deleteField() : { id: produto.id, nome: produto.nome, foto: produto.foto || null, preco: produto.preco || 0, favoritadoEm: new Date().toISOString() }
      });
    } catch {}
  }
  try {
    await setDoc(doc(db, `produtos/${produto.id}/stats`, "geral"), {
      favoritos: increment(jaFav ? -1 : 1)
    }, { merge: true });
    setStats(prev => ({
      ...prev,
      [produto.id]: { ...prev[produto.id], favoritos: Math.max(0, (prev[produto.id]?.favoritos || 0) + (jaFav ? -1 : 1)) }
    }));
  } catch {}
  }

  const toggleQueroProvar = (produto, e) => {
    e.stopPropagation();
    if (!user?.uid) { toast("Faça login para salvar desejos", "error"); return; }
    const chave = `queroProvar_${user.uid}`;
    const atual = JSON.parse(localStorage.getItem(chave) || "[]");
    const jaExiste = atual.some(d => d.produtoId === produto.id);
    const novo = jaExiste
      ? atual.filter(d => d.produtoId !== produto.id)
      : [{ id: Date.now(), produtoId: produto.id, nome: produto.nome, foto: produto.foto || null, preco: produto.preco || 0 }, ...atual].slice(0, 20);
    localStorage.setItem(chave, JSON.stringify(novo));
    setQueroProvar(novo);
    toast(jaExiste ? "Removido da lista de desejos" : "💭 Adicionado ao Quero Provar!");
  };

  const toggleLike = async (produto) => {
    const jaCurtiu = !!likedProducts[produto.id];
    const novo = { ...likedProducts };
    if (jaCurtiu) delete novo[produto.id];
    else novo[produto.id] = true;
    setLikedProducts(novo);
    localStorage.setItem("likedProducts", JSON.stringify(novo));
    try {
      await setDoc(doc(db, `produtos/${produto.id}/stats`, "geral"), {
        curtidas: increment(jaCurtiu ? -1 : 1)
      }, { merge: true });
      setStats(prev => ({
        ...prev,
        [produto.id]: { ...prev[produto.id], curtidas: Math.max(0, (prev[produto.id]?.curtidas || 0) + (jaCurtiu ? -1 : 1)) }
      }));
    } catch {}
  };

  const compartilhar = (produto, e) => {
    e.stopPropagation();
    const urlLoja = config.urlApp || "acaipurogosto.com.br";
    const txt = `🍓 *${produto.nome}*${produto.desc ? `\n${produto.desc}` : ""}\n💰 R$${(produto.preco ?? 0).toFixed(2).replace(".", ",")}\n\n🔗 https://${urlLoja}`;
    if (navigator.share) navigator.share({ title: produto.nome, text: txt });
    else window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  const handleRate = async (produto, estrelas) => {
    if (!user?.uid) {
      toast("Faça login para avaliar!", "error");
      return;
    }
    const ratingKey = `${produto.id}_${user.uid}`;
    const ratingData = {
      produtoId: produto.id,
      produtoNome: produto.nome,
      userId: user.uid,
      userNome: user.nome || user.email || "Anônimo",
      estrelas,
      criadoEm: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, "avaliacoes", ratingKey), ratingData);
      await setDoc(doc(db, `produtos/${produto.id}/stats`, "geral"), {
        totalAvaliacoes: increment(1),
        somaAvaliacoes: increment(estrelas)
      }, { merge: true });
      toast(`⭐ Você avaliou com ${estrelas} estrela(s)!`);
    } catch (err) {
      toast("Erro ao enviar avaliação", "error");
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "categorias"), snap => {
      setCategorias(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (produtos.length > 0) setLoadingProdutos(false);
    const timer = setTimeout(() => setLoadingProdutos(false), 3000);
    return () => clearTimeout(timer);
  }, [produtos]);

  // Abrir modal automaticamente se vier de "Ver avaliações" no Historico
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prodId = params.get("produto");
    if (prodId && produtos.length > 0 && !produtoModal) {
      const prod = produtos.find(p => p.id === prodId);
      if (prod) {
        setProdutoModal(prod);
        window.history.replaceState(null, "", "/cardapio");
      }
    }
  }, [produtos.length]);

  useEffect(() => {
    const fetchAvaliacoes = async () => {
      try {
        const snap = await getDocs(collection(db, "avaliacoes"));
        const medias = {};
        snap.docs.forEach(d => {
          const a = d.data();
          if (!medias[a.produtoId]) medias[a.produtoId] = { total: 0, count: 0 };
          medias[a.produtoId].total += a.estrelas;
          medias[a.produtoId].count += 1;
        });
        setMediasAvaliacoes(medias);
      } catch (e) {
        console.warn("Erro ao buscar avaliacoes:", e);
      }
    };
    fetchAvaliacoes();
  }, []);

  useEffect(() => {
    if (!produtos.length) return;
    const unsubs = produtos.map(p => {
      return onSnapshot(doc(db, `produtos/${p.id}/stats`, "geral"), snap => {
        if (snap.exists()) {
          setStats(prev => ({ ...prev, [p.id]: snap.data() }));
        }
      });
    });
    return () => unsubs.forEach(u => u());
  }, [produtos]);

  // Contar comentários por produto
  useEffect(() => {
    const unsubs = produtos.map(p => {
      return onSnapshot(collection(db, `produtos/${p.id}/comentarios`), snap => {
        setComentariosCount(prev => ({ ...prev, [p.id]: snap.size }));
      });
    });
    return () => unsubs.forEach(u => u());
  }, [produtos]);

  useEffect(() => {
    const onScroll = () => setUserScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleAdd = (produto, complementos = [], precoTotal = null) => {
    if (!isAberto) {
      toast("⏸️ Loja fechada no momento. Volte em breve!", "error");
      return;
    }
    if (produto.controlarEstoque === true && produto.estoque !== null && produto.estoque !== undefined && Number(produto.estoque) <= 0) {
      toast("😔 Produto esgotado!", "error");
      return;
    }
    addToCart(produto.id, 1, complementos, precoTotal);
    setAdicionados(p => ({ ...p, [produto.id]: true }));
    toast(`✅ ${produto.nome} adicionado!`);
    if (window.__triggerCartPulse) window.__triggerCartPulse();
    setProdutoModal(null);
  };

  const abas = [
    { id: "todos", nome: "Todos", emoji: "🫐" },
    ...categorias.filter(c => c.ativa !== false),
  ];

  const produtosFiltrados = produtos.filter(p => {
    if (p.ativo === false) return false;
    if (busca.trim()) {
      const termo = busca.toLowerCase();
      return (
        p.nome?.toLowerCase().includes(termo) ||
        p.desc?.toLowerCase().includes(termo) ||
        p.tag?.toLowerCase().includes(termo)
      );
    }
    if (categoriaAtiva !== "todos") return p.categoria === categoriaAtiva;
    return true;
  }).sort((a, b) => {
    if (ordenacao === "popular") {
      const mediaA = mediasAvaliacoes[a.id]?.count || 0;
      const mediaB = mediasAvaliacoes[b.id]?.count || 0;
      return mediaB - mediaA;
    }
    if (ordenacao === "preco_asc") return a.preco - b.preco;
    if (ordenacao === "preco_desc") return b.preco - a.preco;
    return 0;
  });

  const isAberto = config?.cardapioAtivo ?? true;

  return (
    <div style={{ paddingBottom: 130 }}>

      {/* ── BANNER TOUR NOVO LOJISTA ───────────────────────────── */}
      {isTour && !tourFechado && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", justifyContent: "flex-end", background: "rgba(5,2,15,.6)", backdropFilter: "blur(6px)" }}>
          <div style={{ background: "linear-gradient(160deg,#0f0520,#1a0a36,#2d1060)", borderRadius: "28px 28px 0 0", border: "1.5px solid rgba(124,58,237,.4)", padding: "28px 24px 36px", boxShadow: "0 -20px 60px rgba(124,58,237,.25)" }}>

            {/* Ícones animados */}
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 16 }}>
              {["🏪","✏️","📸","🛒","🚀"].map((em, i) => (
                <div key={i} style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(124,58,237,.2)", border: "1px solid rgba(124,58,237,.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem",
                  animation: `bounce-in .4s ${i * .08}s both`
                }}>{em}</div>
              ))}
            </div>

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#fff", fontFamily: "'Fraunces',serif", lineHeight: 1.2, marginBottom: 8 }}>
                Chegou a hora de você<br />
                <span style={{ background: "linear-gradient(135deg,#f5c518,#a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  fazer história! 🚀
                </span>
              </div>
              <div style={{ color: "rgba(255,255,255,.65)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                Essa é uma loja <strong style={{ color: "#f5c518" }}>modelo</strong>. Explore, se inspire<br />e monte a sua igualzinha — ou ainda melhor.
              </div>
            </div>

            {/* Dicas rápidas */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {[
                { icon: "🖼️", text: "Troque a foto de capa e a logo pela da sua loja" },
                { icon: "🏷️", text: "Defina a categoria certa — comida, moda, beleza, serviço..." },
                { icon: "🛍️", text: "Cadastre seus itens com foto, descrição e preço" },
                { icon: "⚙️", text: "Tudo isso em Admin — botão logo abaixo" },
              ].map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.05)", borderRadius: 12, padding: "10px 14px" }}>
                  <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>{d.icon}</span>
                  <span style={{ fontSize: "0.83rem", color: "rgba(255,255,255,.8)", lineHeight: 1.4 }}>{d.text}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => navigate(`/loja/${tourSlug}/admin`)}
                style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg,#f5c518,#e6a817)", border: "none", borderRadius: 14, fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: "1rem", color: "#0a0414", cursor: "pointer" }}>
                ⚙️ Ir para o Admin da minha loja →
              </button>
              <button onClick={() => setTourFechado(true)}
                style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 14, fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "rgba(255,255,255,.7)", cursor: "pointer" }}>
                Explorar a loja modelo primeiro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BANNER FLUTUANTE (após fechar o modal tour) ─────────── */}
      {isTour && tourFechado && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", zIndex: 9998, width: "calc(100% - 32px)", maxWidth: 420, pointerEvents: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(135deg,rgba(10,4,20,.97),rgba(20,8,40,.97))", backdropFilter: "blur(16px)", border: "1.5px solid rgba(245,197,24,.4)", borderRadius: 18, padding: "12px 14px", boxShadow: "0 8px 32px rgba(0,0,0,.6),0 0 24px rgba(245,197,24,.15)", pointerEvents: "all" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(245,197,24,.15)", border: "1px solid rgba(245,197,24,.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>📖</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: "0.82rem", color: "#fff", lineHeight: 1.3 }}>Guia completo disponível</div>
              <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.5)", marginTop: 2 }}>Categorias, produtos, delivery e mais</div>
            </div>
            <button onClick={() => navigate(`/instrucoes?slug=${tourSlug}`)}
              style={{ background: "linear-gradient(135deg,#f5c518,#e6a817)", border: "none", borderRadius: 10, padding: "8px 14px", fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: "0.75rem", color: "#0a0414", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
              Ver guia →
            </button>
          </div>
        </div>
      )}

      {/* BARRA DE BUSCA FIXA */}
      <div style={{ position: "sticky", top: 60, zIndex: 30, background: "var(--bg)", padding: "6px 16px", borderBottom: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: "0.9rem", color: "var(--text3)", pointerEvents: "none" }}>🔍</span>
          <input className="form-input" value={busca} onChange={e => { setBusca(e.target.value); if (e.target.value) setCategoriaAtiva("todos"); }} placeholder="Buscar produto..." style={{ paddingLeft: 36, borderRadius: 50, fontSize: "0.88rem", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }} />
          {busca && <button onClick={() => setBusca("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "1rem", padding: 0 }}>✕</button>}
        </div>
      </div>

      {/* CABEÇALHO DA LOJA */}
      <div style={{ background: "var(--loja-banner-bg, linear-gradient(135deg, #1a0a36, #0f0518))", padding: "0 0 8px", overflow: "hidden" }}>
        {config.imagemCapa && (
          <div style={{ position: "relative", height: 90, marginBottom: 8 }}>
            <img src={config.imagemCapa} alt="Capa" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(10,4,20,0.95) 100%)" }} />
          </div>
        )}
        <div style={{ padding: config.imagemCapa ? "0 16px" : "16px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
            <img src={config.logoUrl || LOGO_URL} alt="Logo" style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover", border: "2px solid color-mix(in srgb, var(--loja-cor-primaria, #f5c518) 40%, transparent)", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontFamily: "var(--loja-fonte, 'Fraunces', serif)", fontSize: "1.2rem", fontWeight: 700, color: "var(--loja-banner-texto, #ffffff)", display: "flex", alignItems: "center", gap: 6 }}>
                  {config.nomeLoja || "Açaí Puro Gosto"}
                  {(() => {
                    const totalEstrelas = Object.values(mediasAvaliacoes).reduce((acc, m) => acc + m.total, 0);
                    const totalCount = Object.values(mediasAvaliacoes).reduce((acc, m) => acc + m.count, 0);
                    if (totalCount === 0) return null;
                    const media = (totalEstrelas / totalCount).toFixed(1);
                    const fmtCount = totalCount >= 1000 ? `${(totalCount / 1000).toFixed(1).replace(".", ",")}k` : totalCount;
                    return (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(245,197,24,0.12)", border: "1px solid rgba(245,197,24,0.25)", borderRadius: 20, padding: "1px 8px", fontSize: "0.72rem", fontWeight: 700, color: "#f5c518" }}>
                        ★ {media} <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>({fmtCount})</span>
                      </span>
                    );
                  })()}
                </div>
                <button onClick={() => { const url = "https://acaipurogosto.com.br"; if (navigator.share) navigator.share({ title: "Açaí Puro Gosto", text: `🫐 Peça seu açaí! ${url}`, url }); else navigator.clipboard.writeText(url); }} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: isAberto ? "#22c55e" : "#ef4444", boxShadow: isAberto ? "0 0 6px #22c55e" : "none", flexShrink: 0 }} />
                <span style={{ fontSize: "0.75rem", color: isAberto ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                  {isAberto
                    ? config.horarioFechamento ? `Aberto até às ${config.horarioFechamento}` : "Aberto"
                    : config.horarioAbertura ? `Abre às ${config.horarioAbertura}` : "Fechado"
                  }
                </span>
                {config.verificada && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.35)", borderRadius: 20, padding: "1px 7px", fontSize: "0.65rem", fontWeight: 700, color: "#60a5fa" }}>✅ Verificada</span>
                )}
                {(() => {
                  const total = config.pedidosEntregues || 0;
                  if (total >= 3000) return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(245,197,24,0.1)", border: "1px solid rgba(245,197,24,0.35)", borderRadius: 20, padding: "1px 7px", fontSize: "0.65rem", fontWeight: 700, color: "#f5c518" }}>🥇 +3k</span>;
                  if (total >= 2000) return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(192,192,192,0.1)", border: "1px solid rgba(192,192,192,0.35)", borderRadius: 20, padding: "1px 7px", fontSize: "0.65rem", fontWeight: 700, color: "#c0c0c0" }}>🥈 +2k</span>;
                  if (total >= 1000) return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(205,127,50,0.1)", border: "1px solid rgba(205,127,50,0.35)", borderRadius: 20, padding: "1px 7px", fontSize: "0.65rem", fontWeight: 700, color: "#cd7f32" }}>🥉 +1k</span>;
                  return null;
                })()}
                {config.tempoEntrega && <span style={{ fontSize: "0.72rem", color: "var(--loja-banner-texto, rgba(255,255,255,0.6))", opacity: 0.7 }}>· 🕐 {config.tempoEntrega}</span>}
                {(config.pedidoMinimo > 0 || config.taxaEntrega) && (
                  <span style={{ fontSize: "0.68rem", color: "var(--loja-banner-texto, #f5c518)", fontWeight: 600 }}>
                    {config.pedidoMinimo > 0 && `· 🛒 mín R$ ${parseFloat(config.pedidoMinimo).toFixed(2).replace(".", ",")}`}
                    {config.taxaEntrega > 0 && ` · 🚚 R$ ${parseFloat(config.taxaEntrega).toFixed(2).replace(".", ",")}`}
                    {config.entregaGratisMin > 0 && ` (grátis ≥ R$ ${parseFloat(config.entregaGratisMin).toFixed(2).replace(".", ",")})`}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 16px" }}>
          {config.latitude && config.longitude && (
            <button onClick={() => setMostrarMapa(!mostrarMapa)} style={{ display: "flex", alignItems: "center", gap: 5, background: "color-mix(in srgb, var(--loja-banner-texto, #fff) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--loja-banner-texto, #fff) 30%, transparent)", borderRadius: 50, padding: "5px 12px", cursor: "pointer", fontSize: "0.72rem", color: "var(--loja-banner-texto, #fff)", fontFamily: "'Outfit', sans-serif" }}>
              🗺️ Area - entrega
            </button>
          )}
          <button onClick={() => navigate("/feed")} style={{ display: "flex", alignItems: "center", gap: 5, background: "color-mix(in srgb, var(--loja-banner-texto, #fff) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--loja-banner-texto, #fff) 30%, transparent)", borderRadius: 50, padding: "5px 12px", cursor: "pointer", fontSize: "0.72rem", color: "var(--loja-banner-texto, #fff)", fontFamily: "'Outfit', sans-serif" }}>
            📸 {toSlug(config.nomeLoja)}page
          </button>
          <button onClick={() => navigate(slugParam ? `/loja/${slugParam}/perfil` : "/perfil")} style={{ display: "flex", alignItems: "center", gap: 5, background: "color-mix(in srgb, var(--loja-banner-texto, #fff) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--loja-banner-texto, #fff) 30%, transparent)", borderRadius: 50, padding: "5px 12px", cursor: "pointer", fontSize: "0.72rem", color: "var(--loja-banner-texto, #fff)", fontFamily: "'Outfit', sans-serif" }}>Perfil/horarios</button>
        </div>
      </div>

      {/* MAPA DE ENTREGA */}
      {mostrarMapa && config.latitude && config.longitude && (
        <div style={{ padding: "0 16px 12px" }}>
          <DeliveryMap
            clientePos={clientePos}
            setClientePos={setClientePos}
            raioKm={config.raioEntregaKm || 8}
          />
        </div>
      )}

      {/* BANNER FECHADO */}
      {!isAberto && (
        <div style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.08))", border: "1px solid rgba(239,68,68,0.3)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.2rem" }}>🔴</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--red)" }}>Loja fechada no momento</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text2)", marginTop: 2 }}>{config.mensagemPausa || "Estamos fora do horário. Volte em breve!"}{config.horario && ` · Horário: ${config.horario}`}</div>
          </div>
        </div>
      )}

      {/* BANNER PROMOÇÃO */}
      {mostrarPromo && config.bannerPromocao && (
        <div style={{ background: "linear-gradient(135deg, var(--loja-cor-acento, #7c3aed), color-mix(in srgb, var(--loja-cor-acento, #7c3aed) 70%, #000))", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.1rem" }}>🎉</span>
          <span style={{ flex: 1, fontSize: "0.82rem", fontWeight: 600, color: "#fff" }}>{config.bannerPromocao}</span>
          <button onClick={() => setMostrarPromo(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: "1rem", padding: 0 }}>✕</button>
        </div>
      )}

      {/* WIDGET FIDELIDADE */}
      {user && pontos > 0 && (
        <div style={{ background: "linear-gradient(135deg, rgba(90,45,145,0.35), rgba(59,26,110,0.35))", borderBottom: "1px solid rgba(245,197,24,0.12)", padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.95rem" }}>⭐</span>
          <div style={{ flex: 1, fontSize: "0.75rem" }}>
            <span style={{ color: "var(--gold)", fontWeight: 700 }}>{pontos} pontos</span>
            <span style={{ color: "rgba(255,255,255,0.45)" }}> disponíveis para resgatar</span>
          </div>
          <button onClick={() => navigate("/pontos")} style={{ background: "rgba(245,197,24,0.12)", border: "1px solid rgba(245,197,24,0.25)", borderRadius: 20, padding: "4px 10px", cursor: "pointer", color: "var(--gold)", fontFamily: "'Outfit', sans-serif", fontSize: "0.7rem", fontWeight: 700 }}>Ver prêmios</button>
        </div>
      )}

      {/* ABAS DE CATEGORIAS */}
      {!busca && abas.length > 1 && (
        <div style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)", padding: "0 16px", position: "sticky", top: 108, zIndex: 20, display: "flex", alignItems: "center" }}>
          <div style={{ flex: 1, display: "flex", gap: 0, overflowX: "auto", scrollbarWidth: "none" }}>
            {abas.map(aba => (
              <button key={aba.id} onClick={() => setCategoriaAtiva(aba.id)} style={{ flexShrink: 0, padding: "12px 16px", background: "none", border: "none", borderBottom: `2px solid ${categoriaAtiva === aba.id ? "var(--gold)" : "transparent"}`, color: categoriaAtiva === aba.id ? "var(--gold)" : "var(--text2)", fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                {aba.emoji} {aba.nome}
              </button>
            ))}
          </div>
          {/* Toggle layout */}
          <div style={{ display: "flex", gap: 2, flexShrink: 0, marginLeft: 8 }}>
            <button
              onClick={() => { setLayoutView("grid"); localStorage.setItem("cardapioLayout", "grid"); }}
              style={{ width: 30, height: 30, background: layoutView === "grid" ? "rgba(245,197,24,0.12)" : "transparent", border: `1px solid ${layoutView === "grid" ? "rgba(245,197,24,0.4)" : "var(--border)"}`, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: layoutView === "grid" ? "var(--gold)" : "var(--text3)" }}
              title="Grade">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>
            </button>
            <button
              onClick={() => { setLayoutView("list"); localStorage.setItem("cardapioLayout", "list"); }}
              style={{ width: 30, height: 30, background: layoutView === "list" ? "rgba(245,197,24,0.12)" : "transparent", border: `1px solid ${layoutView === "list" ? "rgba(245,197,24,0.4)" : "var(--border)"}`, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: layoutView === "list" ? "var(--gold)" : "var(--text3)" }}
              title="Lista">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="3" rx="1"/><rect x="3" y="10.5" width="18" height="3" rx="1"/><rect x="3" y="17" width="18" height="3" rx="1"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* RESULTADO BUSCA */}
      {busca.trim() && (
        <div style={{ padding: "8px 16px 0", fontSize: "0.78rem", color: "var(--text3)" }}>
          {produtosFiltrados.length === 0 ? `Nenhum resultado para "${busca}"` : `${produtosFiltrados.length} resultado(s) para "${busca}"`}
        </div>
      )}

      {/* GRADE / LISTA DE PRODUTOS */}
      <div style={{ padding: "16px" }}>
        {loadingProdutos ? (
          <div style={{ display: "grid", gridTemplateColumns: layoutView === "grid" ? "1fr 1fr" : "1fr", gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text2)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📭</div>
            <p>Nenhum produto nesta categoria.</p>
          </div>
        ) : layoutView === "grid" ? (
          /* ── GRADE 2 COLUNAS ── */
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {produtosFiltrados.map(produto => {
              const esgotado = produto.controlarEstoque === true && produto.estoque !== null && produto.estoque !== undefined && Number(produto.estoque) <= 0;
              const ativoProvar = produto.id ? queroProvar.some(d => d.produtoId === produto.id) : false;
              return (
                <div key={produto.id} onClick={() => setProdutoModal(produto)} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", cursor: "pointer", position: "relative" }}>
                  <div style={{ position: "relative", paddingTop: "100%", background: "var(--bg3)" }}>
                    {produto.foto ? (
                      <img src={produto.foto} alt={produto.nome} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "3rem" }}>{produto.emoji || "🫐"}</div>
                    )}
                    {produto.tag && <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", borderRadius: 50, padding: "2px 8px", fontSize: "0.58rem", fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>{produto.tag}</div>}
                    {esgotado && (
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ background: "var(--red)", color: "#fff", borderRadius: 8, padding: "4px 12px", fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase" }}>Esgotado</div>
                      </div>
                    )}
                    {produto.controlarEstoque === true && Number(produto.estoque) > 0 && Number(produto.estoque) <= 3 && (
                      <div style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(245,158,11,0.9)", color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: "0.6rem", fontWeight: 700 }}>Últimas {produto.estoque}!</div>
                    )}
                  </div>
                  <div style={{ padding: "10px 10px 8px" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: 2, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{produto.nome}</div>
                    {produto.desc && <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginBottom: 6, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{produto.desc}</div>}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontFamily: "'Fraunces', serif", fontSize: "1.05rem", fontWeight: 900, color: "var(--gold)" }}>R$ {(produto.preco ?? 0).toFixed(2).replace(".", ",")}</span>
                        {mediasAvaliacoes[produto.id]?.count > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 1 }}>
                            <span style={{ color: "#f5c518", fontSize: "0.7rem" }}>★</span>
                            <span style={{ fontSize: "0.65rem", color: "var(--text3)" }}>{(mediasAvaliacoes[produto.id].total / mediasAvaliacoes[produto.id].count).toFixed(1)} ({mediasAvaliacoes[produto.id].count})</span>
                          </div>
                        )}
                      </div>
                      {!isCatalogo && (
                        <button onClick={e => { e.stopPropagation(); setProdutoModal(produto); }} style={{ width: 28, height: 28, background: !isAberto || esgotado ? "var(--bg3)" : "var(--loja-cor-primaria)", border: "none", borderRadius: "50%", color: !isAberto || esgotado ? "var(--text3)" : "var(--loja-btn-texto, #fff)", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {!isAberto ? "🔒" : esgotado ? "✕" : "+"}
                        </button>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                      <button onClick={e => { e.stopPropagation(); toggleLike(produto); }} style={{ flex: 1, padding: "6px 4px", background: likedProducts[produto.id] ? "rgba(239,68,68,0.08)" : "transparent", border: `1px solid ${likedProducts[produto.id] ? "rgba(239,68,68,0.3)" : "var(--border)"}`, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: likedProducts[produto.id] ? "#ef4444" : "var(--text3)" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill={likedProducts[produto.id] ? "#ef4444" : "none"} stroke={likedProducts[produto.id] ? "#ef4444" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      </button>
                      <button onClick={e => toggleFavorito(produto, e)} style={{ flex: 1, padding: "6px 4px", background: favoritos[produto.id] ? "rgba(245,197,24,0.08)" : "transparent", border: `1px solid ${favoritos[produto.id] ? "rgba(245,197,24,0.3)" : "var(--border)"}`, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: favoritos[produto.id] ? "#f5c518" : "var(--text3)" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill={favoritos[produto.id] ? "#f5c518" : "none"} stroke={favoritos[produto.id] ? "#f5c518" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                      </button>
                      <button onClick={e => { e.stopPropagation(); setComentarioModal(produto); }} style={{ flex: 1, padding: "6px 4px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)" }}>
                        <IconComment size={15} />
                      </button>
                      <button onClick={e => compartilhar(produto, e)} style={{ flex: 1, padding: "6px 4px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)" }}>
                        <IconShare size={14} />
                      </button>
                      {user && (
                        <button onClick={e => toggleQueroProvar(produto, e)} style={{ flex: 1, padding: "6px 4px", background: ativoProvar ? "rgba(138,92,246,0.08)" : "transparent", border: `1px solid ${ativoProvar ? "rgba(138,92,246,0.3)" : "var(--border)"}`, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: ativoProvar ? "var(--purple2)" : "var(--text3)" }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill={ativoProvar ? "var(--purple2)" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 3-1.8 5.4-4 6.6V17a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1.4C6.8 14.4 5 12 5 9a7 7 0 0 1 7-7z"/><line x1="9" y1="21" x2="15" y2="21"/><line x1="10" y1="17" x2="14" y2="17"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── LISTA 1 COLUNA (iFood style) ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {produtosFiltrados.map(produto => {
              const esgotado = produto.controlarEstoque === true && produto.estoque !== null && produto.estoque !== undefined && Number(produto.estoque) <= 0;
              const ativoProvar = produto.id ? queroProvar.some(d => d.produtoId === produto.id) : false;
              return (
                <div key={produto.id} onClick={() => setProdutoModal(produto)} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", cursor: "pointer", display: "flex", position: "relative" }}>
                  {/* Texto à esquerda */}
                  <div style={{ flex: 1, padding: "12px 12px 10px", display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 4 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", lineHeight: 1.3, flex: 1 }}>{produto.nome}</div>
                      {produto.tag && <span style={{ flexShrink: 0, background: "rgba(0,0,0,0.45)", borderRadius: 50, padding: "1px 7px", fontSize: "0.55rem", fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>{produto.tag}</span>}
                    </div>
                    {produto.desc && <div style={{ fontSize: "0.75rem", color: "var(--text3)", lineHeight: 1.4, marginBottom: 8, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{produto.desc}</div>}
                    <div style={{ marginTop: "auto" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div>
                          <span style={{ fontFamily: "'Fraunces', serif", fontSize: "1.05rem", fontWeight: 900, color: "var(--gold)" }}>R$ {(produto.preco ?? 0).toFixed(2).replace(".", ",")}</span>
                          {mediasAvaliacoes[produto.id]?.count > 0 && (
                            <span style={{ marginLeft: 6, fontSize: "0.65rem", color: "var(--text3)" }}>★ {(mediasAvaliacoes[produto.id].total / mediasAvaliacoes[produto.id].count).toFixed(1)}</span>
                          )}
                        </div>
                        {!isCatalogo && (
                          <button onClick={e => { e.stopPropagation(); setProdutoModal(produto); }} style={{ width: 32, height: 32, background: !isAberto || esgotado ? "var(--bg3)" : "var(--loja-cor-primaria)", border: "none", borderRadius: "50%", color: !isAberto || esgotado ? "var(--text3)" : "var(--loja-btn-texto, #fff)", fontSize: "1rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {!isAberto ? "🔒" : esgotado ? "✕" : "+"}
                          </button>
                        )}
                      </div>
                      {/* Ações */}
                      <div style={{ display: "flex", gap: 4, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                        <button onClick={e => { e.stopPropagation(); toggleLike(produto); }} style={{ flex: 1, padding: "5px 4px", background: likedProducts[produto.id] ? "rgba(239,68,68,0.08)" : "transparent", border: `1px solid ${likedProducts[produto.id] ? "rgba(239,68,68,0.3)" : "var(--border)"}`, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: likedProducts[produto.id] ? "#ef4444" : "var(--text3)" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={likedProducts[produto.id] ? "#ef4444" : "none"} stroke={likedProducts[produto.id] ? "#ef4444" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        </button>
                        <button onClick={e => toggleFavorito(produto, e)} style={{ flex: 1, padding: "5px 4px", background: favoritos[produto.id] ? "rgba(245,197,24,0.08)" : "transparent", border: `1px solid ${favoritos[produto.id] ? "rgba(245,197,24,0.3)" : "var(--border)"}`, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: favoritos[produto.id] ? "#f5c518" : "var(--text3)" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={favoritos[produto.id] ? "#f5c518" : "none"} stroke={favoritos[produto.id] ? "#f5c518" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                        </button>
                        <button onClick={e => { e.stopPropagation(); setComentarioModal(produto); }} style={{ flex: 1, padding: "5px 4px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)" }}>
                          <IconComment size={14} />
                        </button>
                        <button onClick={e => compartilhar(produto, e)} style={{ flex: 1, padding: "5px 4px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)" }}>
                          <IconShare size={13} />
                        </button>
                        {user && (
                          <button onClick={e => toggleQueroProvar(produto, e)} style={{ flex: 1, padding: "5px 4px", background: ativoProvar ? "rgba(138,92,246,0.08)" : "transparent", border: `1px solid ${ativoProvar ? "rgba(138,92,246,0.3)" : "var(--border)"}`, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: ativoProvar ? "var(--purple2)" : "var(--text3)" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill={ativoProvar ? "var(--purple2)" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 3-1.8 5.4-4 6.6V17a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1.4C6.8 14.4 5 12 5 9a7 7 0 0 1 7-7z"/><line x1="9" y1="21" x2="15" y2="21"/><line x1="10" y1="17" x2="14" y2="17"/></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Imagem à direita */}
                  <div style={{ width: 110, flexShrink: 0, position: "relative", background: "var(--bg3)" }}>
                    {produto.foto ? (
                      <img src={produto.foto} alt={produto.nome} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem" }}>{produto.emoji || "🫐"}</div>
                    )}
                    {esgotado && (
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ background: "var(--red)", color: "#fff", borderRadius: 6, padding: "3px 8px", fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase" }}>Esgotado</div>
                      </div>
                    )}
                    {produto.controlarEstoque === true && Number(produto.estoque) > 0 && Number(produto.estoque) <= 3 && (
                      <div style={{ position: "absolute", bottom: 4, left: 4, right: 4, background: "rgba(245,158,11,0.9)", color: "#fff", borderRadius: 4, padding: "2px 4px", fontSize: "0.55rem", fontWeight: 700, textAlign: "center" }}>Últimas {produto.estoque}!</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DO PRODUTO */}
      {produtoModal && (
        <ModalProduto
          produto={produtoModal}
          onClose={() => setProdutoModal(null)}
          onAdd={handleAdd}
          isAberto={isAberto}
          isCatalogo={isCatalogo}
          whatsapp={config?.whatsapp}
          stats={stats[produtoModal.id] || {}}
          isFav={!!favoritos[produtoModal.id]}
          onToggleFav={e => toggleFavorito(produtoModal, e)}
        />
      )}

      {/* DRAWER DE COMENTÁRIOS */}
      {comentarioModal && (
        <ComentariosProduto produto={comentarioModal} onClose={() => setComentarioModal(null)} />
      )}

      {/* ORDENAÇÃO FIXA */}
      <div style={{ position: "fixed", bottom: 50, left: 0, right: 0, zIndex: 40, background: "var(--loja-nav-bg, rgba(13,5,24,0.97))", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderTop: "1px solid var(--loja-nav-border, var(--border))", padding: "6px 16px", display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", transform: "translateZ(0)" }}>
        {getFiltrosOrdenados(config).map(filtro => {
          if (filtro.tipo === "nav") {
            return <button key={filtro.id} onClick={() => navigate(filtro.path)} style={{ flexShrink: 0, padding: "5px 12px", background: "color-mix(in srgb, var(--loja-cor-primaria) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--loja-cor-primaria) 30%, transparent)", borderRadius: 50, cursor: "pointer", color: "var(--loja-nav-texto, var(--text3))", fontFamily: "'Outfit', sans-serif", fontSize: "0.72rem", fontWeight: 600, transition: "all 0.3s" }}>{filtro.label}</button>;
          }
          const ativo = ordenacao === filtro.id;
          return <button key={filtro.id} onClick={() => setOrdenacao(filtro.id)} style={{ flexShrink: 0, padding: "5px 12px", background: ativo ? "color-mix(in srgb, var(--loja-cor-primaria) 15%, transparent)" : "transparent", border: `1px solid ${ativo ? "color-mix(in srgb, var(--loja-cor-primaria) 50%, transparent)" : "var(--loja-nav-border, var(--border))"}`, borderRadius: 50, cursor: "pointer", color: ativo ? "var(--loja-nav-ativo, var(--gold))" : "var(--loja-nav-texto, var(--text3))", fontFamily: "'Outfit', sans-serif", fontSize: "0.72rem", fontWeight: 600, transition: "all 0.3s" }}>{filtro.label}</button>;
        })}
      </div>

      {/* BOTÃO CARRINHO — só no modo delivery */}
      {!isCatalogo && cartCount() > 0 && (
        <div style={{ position: "fixed", bottom: 105, left: "50%", transform: "translateX(-50%)", zIndex: 50 }}>
          <button onClick={() => navigate("/carrinho")} style={{ background: "var(--loja-cor-primaria)", border: "none", borderRadius: 50, color: "var(--loja-btn-texto, #fff)", fontWeight: 700, fontSize: "0.88rem", padding: "11px 24px", cursor: "pointer", fontFamily: "'Outfit', sans-serif", boxShadow: "0 6px 20px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap" }}>
            🛒 Ver pedido ({cartCount()} {cartCount() === 1 ? "item" : "itens"})
          </button>
        </div>
      )}

      {/* BOTÃO CHAT (delivery) ou WHATSAPP (catálogo) */}
      <div style={{ position: "fixed", bottom: 108, right: 16, zIndex: 50 }}>
        {isCatalogo && config?.whatsapp ? (
          <a
            href={`https://wa.me/55${config.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: 52, height: 52,
              background: "#25d366",
              borderRadius: "50%", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "22px", boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
              textDecoration: "none",
            }}
            title="Falar no WhatsApp"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
          </a>
        ) : !isCatalogo && (
          <button
            onClick={() => {
              if (!user) { navigate("/login"); return; }
              const lojaSlug = slugParam || config?.slug || "";
              const lojaVirtualId = `loja_${lojaSlug}`;
              const chatId = [user.uid, lojaVirtualId].sort().join("__");
              navigate(`/chat/${chatId}`);
            }}
            style={{
              width: 52, height: 52,
              background: "var(--loja-cor-primaria)",
              border: "none", borderRadius: "50%", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "22px", boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
            }}
            title="Pedir pelo Chat"
          >
            💬
          </button>
        )}
      </div>
    </div>
  );
}
