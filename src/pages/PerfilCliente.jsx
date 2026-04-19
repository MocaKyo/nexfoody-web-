// src/pages/PerfilCliente.js
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, getDocs, updateDoc, onSnapshot, collection, query, where, orderBy, limit, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";
import { getBadges } from "../components/RankingFas";
import CaixasDuplas from "../components/CaixasDuplas";

const IMGBB_KEY = "4b8379f3bfc7eb113e0820730166a9f8";

function extractYoutubeId(url) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&?\s/]+)/);
  return m ? m[1] : null;
}

// Ícone coração favorito
const IconHeart = ({ filled, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "#f5c518" : "none"} stroke={filled ? "#f5c518" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

export default function PerfilCliente() {
  const { userId } = useParams();
  const { user, userData, logout, isLojista } = useAuth();
  const { config } = useStore();
  const navigate = useNavigate();
  const isMeu = !userId || userId === user?.uid;
  const targetId = isMeu ? user?.uid : userId;

  const [perfil, setPerfil] = useState(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [uploadando, setUploadando] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const [rankingPos, setRankingPos] = useState(null);
  const [aba, setAba] = useState("feed");
  const [favoritos, setFavoritos] = useState([]);
  const [produtosData, setProdutosData] = useState({});
  const [amizadeStatus, setAmizadeStatus] = useState(null); // null | "pendente_enviada" | "pendente_recebida" | "aceito"
  const [amizadeId, setAmizadeId] = useState(null);
  const [cropModal, setCropModal] = useState(null);
  const [capaY, setCapaY] = useState(0);
  const [draggingCrop, setDraggingCrop] = useState(false);
  const [cropStartY, setCropStartY] = useState(0);
  const [queroProvar, setQueroProvar] = useState([]);
  const [novoDesejo, setNovoDesejo] = useState("");
  const [buscaDesejo, setBuscaDesejo] = useState("");
  const [sugestoesProdutos, setSugestoesProdutos] = useState([]);
  const [buscandoProdutos, setBuscandoProdutos] = useState(false);
  const [lojasFav, setLojasFav] = useState([]);
  const [buscaLoja, setBuscaLoja] = useState("");
  const [sugestoesLojas, setSugestoesLojas] = useState([]);
  const [buscandoLojas, setBuscandoLojas] = useState(false);
  const [feedsFav, setFeedsFav] = useState([]);
  const [chatNaoLido, setChatNaoLido] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [minhaLoja, setMinhaLoja] = useState(null); // loja do lojista logado
  const [aceitosAgora, setAceitosAgora] = useState(new Set());

  // Stories
  const [stories, setStories] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [storyViewer, setStoryViewer] = useState(null);
  const [highlightModal, setHighlightModal] = useState(null);
  const [storyCamera, setStoryCamera] = useState(false);
  const [storyPreview, setStoryPreview] = useState(null);
  const [storyTipo, setStoryTipo] = useState("imagem");
  const [storyFile, setStoryFile] = useState(null);
  const [uploadingStory, setUploadingStory] = useState(false);
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyInputMode, setStoryInputMode] = useState("arquivo"); // "arquivo" | "youtube"
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [ytSearch, setYtSearch] = useState("");

  useEffect(() => {
    if (!targetId) return;
    const unsub = onSnapshot(doc(db, "users", targetId), snap => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setPerfil(data);
        if (data.capaY !== undefined) setCapaY(data.capaY);
        setForm({
          nome: data.nome || data.displayName || "",
          bio: data.bio || "",
          cidade: data.cidade || "",
          perfilOculto: data.perfilOculto || false,
        });
      }
    });
    return unsub;
  }, [targetId]);

  // Buscar posição no ranking
  useEffect(() => {
    if (!targetId) return;
    const unsub = onSnapshot(
      query(collection(db, "users"), orderBy("pontos", "desc"), limit(100)),
      snap => {
        const lista = snap.docs.map((d, i) => ({ id: d.id, posicao: i + 1 }));
        const pos = lista.find(u => u.id === targetId);
        setRankingPos(pos?.posicao || null);
      }
    );
    return unsub;
  }, [targetId]);

  // Buscar pedidos
  useEffect(() => {
    if (!targetId) return;
    const unsub = onSnapshot(
      query(collection(db, "pedidos"), where("userId", "==", targetId), orderBy("criadoEm", "desc"), limit(50)),
      snap => setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [targetId]);

  // Solicitações de amizade recebidas (em tempo real)
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "amizades"),
      where("para", "==", user.uid),
      where("status", "==", "pendente")
    );
    return onSnapshot(q, async snap => {
      const lista = await Promise.all(snap.docs.map(async d => {
        const data = { id: d.id, ...d.data() };
        try {
          const uSnap = await getDoc(doc(db, "users", data.de));
          if (uSnap.exists()) {
            const u = uSnap.data();
            data.remetenteNome = u.nome || "Usuário";
            data.remetenteFoto = u.photoURL || null;
          }
        } catch {}
        return data;
      }));
      setSolicitacoes(lista);
    });
  }, [user?.uid]);

  // Badge de chat não-lido
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "chats"), where("participantes", "array-contains", user.uid));
    const unsub = onSnapshot(q, snap => {
      const total = snap.docs.reduce((acc, d) => acc + (d.data().naoLido?.[user.uid] || 0), 0);
      setChatNaoLido(total);
    });
    return unsub;
  }, [user?.uid]);

  // Carregar favoritos e lista de desejos do localStorage
  useEffect(() => {
    if (!isMeu) return;
    try {
      const fav = JSON.parse(localStorage.getItem("produtosFavoritos") || "{}");
      setFavoritos(Object.values(fav));
      const desejos = JSON.parse(localStorage.getItem(`queroProvar_${targetId}`) || "[]");
      setQueroProvar(desejos);
      const lf = JSON.parse(localStorage.getItem(`lojasFav_${targetId}`) || "[]");
      setLojasFav(lf);
      const ff = JSON.parse(localStorage.getItem(`feedsFav_${targetId}`) || "[]");
      setFeedsFav(ff);
    } catch {}
  }, [isMeu, targetId]);

  // Buscar loja do lojista logado (para exibir no drawer)
  useEffect(() => {
    if (!isLojista || !userData?.lojistaOf) return;
    getDocs(query(collection(db, "lojas"), where("tenantId", "==", userData.lojistaOf)))
      .then(snap => {
        if (!snap.empty) setMinhaLoja({ id: snap.docs[0].id, ...snap.docs[0].data() });
      })
      .catch(() => {});
  }, [isLojista, userData?.lojistaOf]);

  // Buscar dados dos produtos favoritos no Firestore
  useEffect(() => {
    if (favoritos.length === 0) return;
    const ids = favoritos.filter(f => f.id).map(f => f.id);
    const unsubs = ids.map(id =>
      onSnapshot(doc(db, "produtos", id), snap => {
        if (snap.exists()) {
          setProdutosData(prev => ({ ...prev, [id]: { id: snap.id, ...snap.data() } }));
        }
      })
    );
    return () => unsubs.forEach(u => u());
  }, [favoritos.length]);

  // Status de amizade com o perfil visitado
  useEffect(() => {
    if (isMeu || !user?.uid || !targetId) return;
    const q = query(
      collection(db, "amizades"),
      where("participantes", "array-contains", user.uid)
    );
    const unsub = onSnapshot(q, snap => {
      const doc = snap.docs.find(d => {
        const data = d.data();
        return data.participantes?.includes(targetId);
      });
      if (!doc) { setAmizadeStatus(null); setAmizadeId(null); return; }
      const data = doc.data();
      setAmizadeId(doc.id);
      if (data.status === "aceito") setAmizadeStatus("aceito");
      else if (data.de === user.uid) setAmizadeStatus("pendente_enviada");
      else setAmizadeStatus("pendente_recebida");
    });
    return unsub;
  }, [isMeu, user?.uid, targetId]);

  // Stories do cliente (todos — quem não é cliente não vê stories alheios)
  useEffect(() => {
    if (!targetId) return;
    // Debug: busca todos os stories do autor
    const unsub = onSnapshot(
      query(collection(db, "stories"), where("autorId", "==", targetId), orderBy("criadoEm", "desc")),
      snap => {
        console.log("📖 Stories query result:", targetId, "count:", snap.docs.length, snap.docs.map(d => d.data()));
        setStories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
    return unsub;
  }, [targetId]);

  // Highlights do cliente
  useEffect(() => {
    if (!targetId) return;
    const unsub = onSnapshot(
      query(collection(db, "highlights"), where("autorId", "==", targetId), orderBy("criadoEm", "asc")),
      snap => setHighlights(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [targetId]);

  // Assists a story (marca quem viu)
  const markStorySeen = async (storyId, viewerId) => {
    if (!viewerId) return;
    try {
      await updateDoc(doc(db, "stories", storyId), {
        visualizacoes: viewerId,
      }, { merge: true });
    } catch {}
  };

  // Criar highlight
  const criarHighlight = async (storyId) => {
    const story = stories.find(s => s.id === storyId);
    if (!story || !user?.uid) return;
    await addDoc(collection(db, "highlights"), {
      autorId: user.uid,
      capa: story.midia,
      tipo: story.tipo,
      stories: [storyId],
      titulo: "Novo",
      criadoEm: serverTimestamp(),
    });
  };

  const removeFavorito = (produtoId) => {
    const fav = JSON.parse(localStorage.getItem("produtosFavoritos") || "{}");
    delete fav[produtoId];
    localStorage.setItem("produtosFavoritos", JSON.stringify(fav));
    setFavoritos(prev => prev.filter(f => f.id !== produtoId));
  };

  const uploadFoto = async (file) => {
    if (!file || file.size > 5 * 1024 * 1024) return;
    setUploadando(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        await updateDoc(doc(db, "users", user.uid), { photoURL: data.data.url });
      }
    } catch (e) { console.error(e); }
    finally { setUploadando(false); }
  };

  const salvar = async () => {
    if (!user?.uid) return;
    setSalvando(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        nome: form.nome.trim(),
        bio: form.bio.trim(),
        cidade: form.cidade.trim(),
        perfilOculto: form.perfilOculto,
      });
      setEditando(false);
    } catch (e) { console.error(e); }
    finally { setSalvando(false); }
  };

  // ── Ações de amizade ─────────────────────────────────────────
  const enviarSolicitacao = async () => {
    if (!user?.uid || !targetId) return;
    await addDoc(collection(db, "amizades"), {
      de: user.uid,
      deNome: user.displayName || user.email?.split("@")[0] || "Alguém",
      para: targetId,
      participantes: [user.uid, targetId],
      status: "pendente",
      criadoEm: serverTimestamp(),
    });
  };

  const aceitarAmizade = async () => {
    if (!amizadeId) return;
    await updateDoc(doc(db, "amizades", amizadeId), { status: "aceito" });
  };

  const removerAmizade = async () => {
    if (!amizadeId || !window.confirm("Remover amigo?")) return;
    await deleteDoc(doc(db, "amizades", amizadeId));
  };

  // ── Helpers de DNA e Stats ──────────────────────────────────
  const adicionarDesejo = (item) => {
    const entrada = typeof item === "string"
      ? { id: Date.now(), nome: item.trim() }
      : { id: Date.now(), produtoId: item.id, nome: item.nome, foto: item.foto || null, preco: item.preco || 0 };
    if (!entrada.nome) return;
    const jaExiste = queroProvar.some(d => d.produtoId && d.produtoId === entrada.produtoId);
    if (jaExiste) return;
    const novo = [entrada, ...queroProvar].slice(0, 20);
    setQueroProvar(novo);
    localStorage.setItem(`queroProvar_${targetId}`, JSON.stringify(novo));
    setNovoDesejo("");
    setBuscaDesejo("");
    setSugestoesProdutos([]);
  };

  const removerDesejo = (id) => {
    const novo = queroProvar.filter(d => d.id !== id);
    setQueroProvar(novo);
    localStorage.setItem(`queroProvar_${targetId}`, JSON.stringify(novo));
  };

  const adicionarLoja = (loja) => {
    if (lojasFav.some(l => l.slug === loja.slug)) return;
    const novo = [{ slug: loja.slug, nome: loja.nome, logo: loja.logo || null, categoria: loja.categoria || "" }, ...lojasFav].slice(0, 20);
    setLojasFav(novo);
    localStorage.setItem(`lojasFav_${targetId}`, JSON.stringify(novo));
    setBuscaLoja("");
    setSugestoesLojas([]);
  };

  const removerLoja = (slug) => {
    const novo = lojasFav.filter(l => l.slug !== slug);
    setLojasFav(novo);
    localStorage.setItem(`lojasFav_${targetId}`, JSON.stringify(novo));
  };

  const removerFeedFav = (id) => {
    const novo = feedsFav.filter(f => f.id !== id);
    setFeedsFav(novo);
    localStorage.setItem(`feedsFav_${targetId}`, JSON.stringify(novo));
  };

  const buscarLojas = async (termo) => {
    setBuscaLoja(termo);
    if (termo.length < 2) { setSugestoesLojas([]); return; }
    setBuscandoLojas(true);
    try {
      const snap = await getDocs(query(collection(db, "lojas"),
        where("nome", ">=", termo),
        where("nome", "<=", termo + "\uf8ff"),
        orderBy("nome"), limit(6)
      ));
      setSugestoesLojas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {}
    finally { setBuscandoLojas(false); }
  };

  const buscarProdutos = async (termo) => {
    setBuscaDesejo(termo);
    if (termo.length < 2) { setSugestoesProdutos([]); return; }
    setBuscandoProdutos(true);
    try {
      const snap = await getDocs(query(collection(db, "produtos"),
        where("nome", ">=", termo),
        where("nome", "<=", termo + "\uf8ff"),
        orderBy("nome"), limit(6)
      ));
      setSugestoesProdutos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {}
    finally { setBuscandoProdutos(false); }
  };

  if (!perfil) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, border: "3px solid var(--border2)", borderTopColor: "var(--gold)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
    </div>
  );

  if (perfil.perfilOculto && !isMeu) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }}>
      <div style={{ fontSize: "3rem" }}>🔒</div>
      <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>Perfil privado</div>
      <div style={{ fontSize: "0.82rem", color: "var(--text3)", textAlign: "center" }}>Este cliente optou por manter seu perfil oculto</div>
      <button onClick={() => navigate(-1)} style={{ marginTop: 12, padding: "10px 24px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 20, color: "var(--text2)", fontFamily: "'Outfit', sans-serif", cursor: "pointer" }}>← Voltar</button>
    </div>
  );

  const badges = getBadges(rankingPos || 999, Math.floor(perfil.pontos || 0));
  const nome = perfil.nome || perfil.displayName || "Cliente";

  // ── Stats computados dos pedidos ────────────────────────────
  const totalGasto = pedidos.reduce((s, p) => s + (p.total || 0), 0);
  const ticketMedio = pedidos.length > 0 ? totalGasto / pedidos.length : 0;
  const todosItens = pedidos.flatMap(p => p.items || []);
  const contagemItens = todosItens.reduce((acc, item) => {
    if (!item?.nome) return acc;
    acc[item.nome] = (acc[item.nome] || 0) + (item.qty || 1);
    return acc;
  }, {});
  const itemMaisPedido = Object.entries(contagemItens).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const totalItensUnicos = Object.keys(contagemItens).length;

  // DNA de Sabor — mapeamento de palavras-chave → perfil
  const FLAVOR_MAP = [
    { tags: ["morango", "strawberry", "fruta", "limão", "maracujá", "manga", "açaí"],  label: "Frutado",    emoji: "🍓" },
    { tags: ["chocolate", "choco", "nutella", "cacau"],                                 label: "Chocolate",  emoji: "🍫" },
    { tags: ["granola", "crocante", "castanha", "amendoim", "paçoca"],                  label: "Crocante",   emoji: "🌾" },
    { tags: ["leite", "condensado", "ninho", "cream", "creamy", "creme"],               label: "Cremoso",    emoji: "🥛" },
    { tags: ["mel", "doce", "brigadeiro", "caramelo"],                                  label: "Adocicado",  emoji: "🍯" },
    { tags: ["proteína", "whey", "fit", "light", "zero"],                               label: "Fitness",    emoji: "💪" },
  ];
  const nomeItensLower = Object.keys(contagemItens).join(" ").toLowerCase();
  const dna = FLAVOR_MAP.filter(f => f.tags.some(t => nomeItensLower.includes(t)));

  // Badges de jornada
  const jornadaBadges = [];
  if (pedidos.length >= 1)  jornadaBadges.push({ emoji: "🌱", label: "Primeiro Pedido" });
  if (pedidos.length >= 5)  jornadaBadges.push({ emoji: "🔥", label: "Fã Regular" });
  if (pedidos.length >= 10) jornadaBadges.push({ emoji: "💜", label: "Devoto do Açaí" });
  if (pedidos.length >= 25) jornadaBadges.push({ emoji: "👑", label: "Lendário" });
  if (totalItensUnicos >= 5) jornadaBadges.push({ emoji: "🧭", label: "Explorador" });
  if (totalGasto >= 100)    jornadaBadges.push({ emoji: "💰", label: "Top Investidor" });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Outfit', sans-serif", paddingBottom: 80 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(15,5,24,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)", padding: "0 16px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: "1.1rem", padding: 0 }}>←</button>
        <div style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: "0.95rem" }}>{isMeu ? "Meu Perfil" : nome}</div>
        {isMeu && !editando && (
          <button onClick={() => setEditando(true)} style={{ background: "none", border: "none", color: "var(--purple2)", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, fontFamily: "'Outfit', sans-serif" }}>✏️ Editar</button>
        )}
        {isMeu && editando && (
          <button onClick={() => setEditando(false)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "0.82rem", fontFamily: "'Outfit', sans-serif" }}>Cancelar</button>
        )}
        {isMeu && (
          <button onClick={() => setShowMenu(true)} style={{ position: "relative", background: "none", border: "none", color: "var(--text2)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
            {solicitacoes.length > 0 && (
              <span style={{ position: "absolute", top: 0, right: 0, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "1.5px solid var(--bg)" }} />
            )}
          </button>
        )}
        {!isMeu && user && (() => {
          if (amizadeStatus === "aceito") return (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={removerAmizade} style={{ background: "rgba(138,92,246,0.12)", border: "1px solid rgba(138,92,246,0.3)", borderRadius: 20, padding: "5px 12px", color: "var(--purple2)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer" }}>👥 Amigos</button>
              <button onClick={() => { import("./ChatPage").then(({ abrirOuCriarChat }) => abrirOuCriarChat({ minhaUid: user.uid, meuNome: user.displayName || user.email?.split("@")[0] || "Você", minhaFoto: user.photoURL || null, outroUid: targetId, outroNome: perfil?.nome || "Usuário", outroFoto: perfil?.photoURL || null, navigate })); }} style={{ background: "linear-gradient(135deg, #25d366, #128c7e)", border: "none", borderRadius: 20, padding: "5px 12px", color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Mensagem
              </button>
            </div>
          );
          if (amizadeStatus === "pendente_enviada") return (
            <button disabled style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 20, padding: "5px 12px", color: "var(--text3)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.72rem", cursor: "default" }}>⏳ Enviada</button>
          );
          if (amizadeStatus === "pendente_recebida") return (
            <button onClick={aceitarAmizade} style={{ background: "linear-gradient(135deg, var(--gold), #e6b800)", border: "none", borderRadius: 20, padding: "5px 12px", color: "var(--bg)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer" }}>✅ Aceitar</button>
          );
          return (
            <button onClick={enviarSolicitacao} style={{ background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: 20, padding: "5px 12px", color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer" }}>👤 Adicionar</button>
          );
        })()}
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* Capa */}
        <div style={{ height: 120, background: "linear-gradient(135deg, #2d1055, #1a0a36, #0f0518)", position: "relative", overflow: "hidden" }}>
          {perfil.fotoCapa && (
            <img src={perfil.fotoCapa} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: `center ${capaY}%` }} />
          )}
          <div style={{ position: "absolute", inset: 0, background: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%238a5cf6' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
          {isMeu && (
            <label style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 20, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: "0.7rem", color: "#fff" }}>
              {uploadando ? "⏳" : "🖼️ Alterar capa"}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
                const file = e.target.files[0];
                if (!file) return;
                setUploadando(true);
                const url = URL.createObjectURL(file);
                setCropModal({ tempUrl: url, file });
                setUploadando(false);
              }} />
            </label>
          )}
        </div>

        {/* Avatar + info */}
        <div style={{ padding: "0 16px", marginTop: -40 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 }}>
            {/* Avatar */}
            <div style={{ position: "relative" }}>
              <div style={{ width: 80, height: 80, borderRadius: "50%", border: "3px solid var(--bg)", overflow: "hidden", background: "linear-gradient(135deg, var(--purple), var(--gold2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>
                {perfil.photoURL
                  ? <img src={perfil.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : nome[0]?.toUpperCase()
                }
              </div>
              {isMeu && (
                <label style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: "50%", background: "var(--purple)", border: "2px solid var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.7rem" }}>
                  {uploadando ? "⏳" : "📷"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => uploadFoto(e.target.files[0])} />
                </label>
              )}
            </div>
            {/* Ranking badge */}
            {rankingPos && rankingPos <= 10 && (
              <div style={{ background: "linear-gradient(135deg, rgba(245,197,24,0.15), rgba(138,92,246,0.1))", border: "1px solid rgba(245,197,24,0.3)", borderRadius: 20, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "1rem" }}>{rankingPos === 1 ? "👑" : rankingPos <= 3 ? "🏆" : "⭐"}</span>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gold)" }}>#{rankingPos} Ranking</span>
              </div>
            )}
          </div>

          {/* Nome e info */}
          {editando ? (
            <div style={{ animation: "fadeUp 0.2s ease" }}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: "0.72rem", color: "var(--text3)", fontWeight: 600, display: "block", marginBottom: 4 }}>Nome</label>
                <input className="form-input" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Seu nome" />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: "0.72rem", color: "var(--text3)", fontWeight: 600, display: "block", marginBottom: 4 }}>Bio</label>
                <textarea className="form-input" rows={2} value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} placeholder="Fã do melhor açaí da cidade 🍓" style={{ resize: "none" }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: "0.72rem", color: "var(--text3)", fontWeight: 600, display: "block", marginBottom: 4 }}>Cidade</label>
                <input className="form-input" value={form.cidade} onChange={e => setForm(p => ({ ...p, cidade: e.target.value }))} placeholder="Ex: Bacabal - MA" />
              </div>
              {/* Toggle perfil oculto */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>🔒 Perfil oculto</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 2 }}>Some do ranking e buscas públicas</div>
                </div>
                <div className={`toggle-switch ${form.perfilOculto ? "on" : ""}`} onClick={() => setForm(p => ({ ...p, perfilOculto: !p.perfilOculto }))} style={{ cursor: "pointer" }} />
              </div>
              <button onClick={salvar} disabled={salvando} style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: 12, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", boxShadow: "0 4px 16px rgba(90,45,145,0.4)" }}>
                {salvando ? "Salvando..." : "💾 Salvar perfil"}
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.3rem", fontWeight: 700, marginBottom: 2 }}>{nome}</div>
              {perfil.bio && <div style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: 6, lineHeight: 1.5 }}>{perfil.bio}</div>}
              {perfil.cidade && <div style={{ fontSize: "0.78rem", color: "var(--text3)", marginBottom: 10 }}>📍 {perfil.cidade}</div>}
              {/* Badges ranking + jornada */}
              {(badges.length > 0 || jornadaBadges.length > 0) && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {badges.map(b => (
                    <div key={b.id} style={{ background: "rgba(138,92,246,0.12)", border: "1px solid rgba(138,92,246,0.25)", borderRadius: 20, padding: "4px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: "0.85rem" }}>{b.emoji}</span>
                      <span style={{ fontSize: "0.68rem", color: "var(--purple2)", fontWeight: 700 }}>{b.label}</span>
                    </div>
                  ))}
                  {jornadaBadges.map(b => (
                    <div key={b.label} style={{ background: "rgba(245,197,24,0.08)", border: "1px solid rgba(245,197,24,0.2)", borderRadius: 20, padding: "4px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: "0.85rem" }}>{b.emoji}</span>
                      <span style={{ fontSize: "0.68rem", color: "var(--gold)", fontWeight: 700 }}>{b.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* DNA de Sabor compacto */}
              {dna.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.6rem", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>🧬 DNA</span>
                  {dna.map(f => (
                    <span key={f.label} style={{ fontSize: "0.68rem", background: "rgba(138,92,246,0.1)", border: "1px solid rgba(138,92,246,0.2)", borderRadius: 20, padding: "2px 8px", color: "var(--purple2)", fontWeight: 600 }}>
                      {f.emoji} {f.label}
                    </span>
                  ))}
                </div>
              )}
              {/* Stats */}
              <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", fontWeight: 900, color: "var(--gold)" }}>{Math.floor(perfil.pontos || 0).toLocaleString()}</div>
                  <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginTop: 2 }}>pontos</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", fontWeight: 900, color: "var(--purple2)" }}>{Math.floor(perfil.rankingPts || 0).toLocaleString()}</div>
                  <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginTop: 2 }}>pts ranking</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", fontWeight: 900, color: "var(--green)" }}>{pedidos.length}</div>
                  <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginTop: 2 }}>pedidos</div>
                </div>
                {rankingPos && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", fontWeight: 900, color: rankingPos <= 3 ? "var(--gold)" : "var(--text2)" }}>#{rankingPos}</div>
                    <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginTop: 2 }}>ranking</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Stories + Highlights horizontal */}
        {!editando && (
          <div style={{ padding: "12px 14px 0", overflowX: "auto", scrollbarWidth: "none" }}>
            <div style={{ display: "flex", gap: 10, paddingBottom: 2 }}>
              {/* Criar story — só meu perfil */}
              {isMeu && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <div
                    onClick={() => setStoryCamera(true)}
                    style={{ width: 62, height: 62, borderRadius: "50%", background: "var(--bg2)", border: "2px dashed var(--purple2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "1.8rem" }}
                  >+</div>
                  <span style={{ fontSize: "0.58rem", color: "var(--text3)" }}>Novo</span>
                </div>
              )}
              {/* Stories do cliente */}
              {stories.map(story => (
                <div key={story.id} onClick={() => { setStoryViewer(story); markStorySeen(story.id, user?.uid); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0, cursor: "pointer" }}>
                  <div style={{ width: 66, height: 66, borderRadius: "50%", padding: 2, background: story.midia ? "conic-gradient(var(--purple2), var(--gold), var(--purple2))" : "var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: "var(--bg)" }}>
                      {story.tipo === "youtube"
                        ? <img src={`https://img.youtube.com/vi/${story.midia}/mqdefault.jpg`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : story.midia && story.tipo === "video"
                          ? <video src={story.midia} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : story.midia
                            ? <img src={story.midia} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <span style={{ fontSize: "1.4rem" }}>📷</span>
                      }
                    </div>
                  </div>
                  <span style={{ fontSize: "0.58rem", color: "var(--text3)", maxWidth: 66, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>você</span>
                </div>
              ))}
              {/* Highlights */}
              {highlights.map(h => (
                <div key={h.id} onClick={() => setHighlightModal(h)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0, cursor: "pointer" }}>
                  <div style={{ width: 66, height: 66, borderRadius: "50%", padding: 2, background: "linear-gradient(135deg, var(--gold), var(--purple))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: "var(--bg)" }}>
                      {h.capa ? <img src={h.capa} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "1.4rem" }}>✨</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: "0.58rem", color: "var(--text3)", maxWidth: 66, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.titulo}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        {!editando && (
          <>
            <div style={{ display: "flex", borderBottom: "1px solid var(--border)", margin: "0 0 16px", overflowX: "auto", scrollbarWidth: "none" }}>
              {[
                { id: "feed", label: "Posts", icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                )},
                { id: "stats", label: "Stats", icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                )},
                { id: "pedidos", label: "Pedidos", icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
                  </svg>
                )},
                { id: "favoritos", label: "Favoritos", icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                  </svg>
                )},
                { id: "desejos", label: "Quero Provar", icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                  </svg>
                )},
                { id: "lojas", label: "Lojas Fav.", icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                )},
                { id: "feedsFav", label: "Feeds Salvos", icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>
                )},
              ].map(t => (
                <button key={t.id} onClick={() => setAba(t.id)} style={{ flexShrink: 0, padding: "10px 10px 8px", background: "none", border: "none", borderBottom: `2px solid ${aba === t.id ? "var(--gold)" : "transparent"}`, color: aba === t.id ? "var(--gold)" : "var(--text3)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.7rem", cursor: "pointer", whiteSpace: "nowrap", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Conteúdo das tabs */}
            <div style={{ padding: "0 14px" }}>
              {aba === "feed" && (
                <div style={{ margin: "0 -14px" }}>
                  <CaixasDuplas filtroUserId={targetId} />
                </div>
              )}

              {aba === "stats" && (
                <div style={{ animation: "fadeUp 0.25s ease" }}>
                  {pedidos.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text3)" }}>
                      <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>📊</div>
                      <div style={{ fontSize: "0.85rem" }}>Faça seu primeiro pedido para ver as estatísticas</div>
                    </div>
                  ) : (
                    <>
                      {/* Wrapped cards */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                        <div style={{ background: "linear-gradient(135deg, rgba(138,92,246,0.15), rgba(90,45,145,0.08))", border: "1px solid rgba(138,92,246,0.25)", borderRadius: 14, padding: "14px 12px" }}>
                          <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Total investido</div>
                          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.4rem", fontWeight: 900, color: "var(--gold)" }}>R$ {totalGasto.toFixed(2).replace(".", ",")}</div>
                        </div>
                        <div style={{ background: "linear-gradient(135deg, rgba(245,197,24,0.1), rgba(138,92,246,0.05))", border: "1px solid rgba(245,197,24,0.2)", borderRadius: 14, padding: "14px 12px" }}>
                          <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Ticket médio</div>
                          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.4rem", fontWeight: 900, color: "var(--purple2)" }}>R$ {ticketMedio.toFixed(2).replace(".", ",")}</div>
                        </div>
                        <div style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(138,92,246,0.05))", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 14, padding: "14px 12px" }}>
                          <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Total de pedidos</div>
                          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.4rem", fontWeight: 900, color: "var(--green)" }}>{pedidos.length}</div>
                        </div>
                        <div style={{ background: "linear-gradient(135deg, rgba(245,197,24,0.08), rgba(245,197,24,0.03))", border: "1px solid rgba(245,197,24,0.15)", borderRadius: 14, padding: "14px 12px" }}>
                          <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Sabores provados</div>
                          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.4rem", fontWeight: 900, color: "var(--gold)" }}>{totalItensUnicos}</div>
                        </div>
                      </div>

                      {/* Item mais pedido */}
                      {itemMaisPedido && (
                        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
                          <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>🏆 Seu pedido favorito</div>
                          <div style={{ fontWeight: 700, fontSize: "1rem" }}>{itemMaisPedido}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 3 }}>pedido {contagemItens[itemMaisPedido]}x</div>
                        </div>
                      )}

                      {/* DNA de Sabor */}
                      {dna.length > 0 && (
                        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
                          <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>🧬 Seu DNA de Sabor</div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {dna.map(f => (
                              <div key={f.label} style={{ background: "rgba(138,92,246,0.1)", border: "1px solid rgba(138,92,246,0.25)", borderRadius: 20, padding: "5px 12px", display: "flex", alignItems: "center", gap: 5 }}>
                                <span style={{ fontSize: "1rem" }}>{f.emoji}</span>
                                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--purple2)" }}>{f.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Badges de jornada */}
                      {jornadaBadges.length > 0 && (
                        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px" }}>
                          <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>🎖️ Conquistas</div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {jornadaBadges.map(b => (
                              <div key={b.label} style={{ background: "rgba(245,197,24,0.08)", border: "1px solid rgba(245,197,24,0.2)", borderRadius: 20, padding: "5px 12px", display: "flex", alignItems: "center", gap: 5 }}>
                                <span style={{ fontSize: "1rem" }}>{b.emoji}</span>
                                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--gold)" }}>{b.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {aba === "pedidos" && (
                pedidos.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text3)" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🛒</div>
                    <div style={{ fontSize: "0.85rem" }}>Nenhum pedido ainda</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {pedidos.map(p => (
                      <div key={p.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Pedido #{p.numeroPedido || p.id.slice(-4)}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--gold)", fontWeight: 700 }}>R$ {(p.total || 0).toFixed(2).replace(".", ",")}</div>
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>
                          {p.criadoEm?.toDate ? p.criadoEm.toDate().toLocaleDateString("pt-BR") : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
              {aba === "favoritos" && (
                !isMeu ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text3)" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🔖</div>
                    <div style={{ fontSize: "0.85rem" }}>Favoritos são visíveis apenas no próprio perfil</div>
                  </div>
                ) : favoritos.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text3)" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🔖</div>
                    <div style={{ fontSize: "0.85rem" }}>Nenhum favorito ainda</div>
                    <button onClick={() => navigate("/")} style={{ marginTop: 12, padding: "8px 16px", background: "var(--purple)", border: "none", borderRadius: 20, color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>Explorar produtos</button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {favoritos.map(fav => {
                      const prod = produtosData[fav.id];
                      const foto = prod?.foto || fav.foto;
                      const nome = prod?.nome || fav.nome || "Produto";
                      const preco = prod?.preco || fav.preco || 0;
                      return (
                        <div key={fav.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", position: "relative" }}>
                          <div onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
                            <div style={{ position: "relative", paddingTop: "100%", background: "var(--bg3)" }}>
                              {foto ? (
                                <img src={foto} alt={nome} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                              ) : (
                                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>🫐</div>
                              )}
                              {prod?.tag && (
                                <div style={{ position: "absolute", top: 4, left: 4, background: "rgba(0,0,0,0.6)", borderRadius: 50, padding: "2px 6px", fontSize: "0.58rem", fontWeight: 700, color: "#fff" }}>{prod.tag}</div>
                              )}
                            </div>
                            <div style={{ padding: "8px" }}>
                              <div style={{ fontWeight: 600, fontSize: "0.78rem", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{nome}</div>
                              <div style={{ fontFamily: "'Fraunces', serif", color: "var(--gold)", fontWeight: 700, fontSize: "0.88rem", marginTop: 2 }}>R$ {preco.toFixed(2).replace(".", ",")}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFavorito(fav.id)}
                            style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <IconHeart filled size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
              {aba === "desejos" && (
                <div style={{ animation: "fadeUp 0.25s ease" }}>
                  {!isMeu ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text3)" }}>
                      <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>💭</div>
                      <div style={{ fontSize: "0.85rem" }}>Lista visível apenas no próprio perfil</div>
                    </div>
                  ) : (
                    <>
                      {/* Busca de produtos */}
                      <div style={{ position: "relative", marginBottom: 16 }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            value={buscaDesejo}
                            onChange={e => buscarProdutos(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && buscaDesejo.trim() && sugestoesProdutos.length === 0 && adicionarDesejo(buscaDesejo)}
                            placeholder="🔍 Buscar produto ou digitar desejo..."
                            style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem", outline: "none" }}
                          />
                          {buscaDesejo.trim() && sugestoesProdutos.length === 0 && !buscandoProdutos && (
                            <button
                              onClick={() => adicionarDesejo(buscaDesejo)}
                              style={{ padding: "10px 14px", background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: 12, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}
                            >+ Add</button>
                          )}
                        </div>
                        {/* Sugestões dropdown */}
                        {sugestoesProdutos.length > 0 && (
                          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, marginTop: 4, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                            {sugestoesProdutos.map(p => (
                              <div key={p.id} onClick={() => adicionarDesejo(p)}
                                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)", transition: "background 0.15s" }}
                                onMouseEnter={e => e.currentTarget.style.background = "var(--bg3)"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                              >
                                {p.foto
                                  ? <img src={p.foto} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                                  : <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>🫐</div>
                                }
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{p.nome}</div>
                                  <div style={{ fontSize: "0.72rem", color: "var(--gold)" }}>R$ {(p.preco || 0).toFixed(2).replace(".", ",")}</div>
                                </div>
                                <span style={{ fontSize: "0.7rem", color: "var(--purple2)", fontWeight: 700 }}>+ Add</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Dica */}
                      {queroProvar.length === 0 && (
                        <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text3)" }}>
                          <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>💭</div>
                          <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 6, color: "var(--text)" }}>Sua lista de desejos está vazia</div>
                          <div style={{ fontSize: "0.75rem", lineHeight: 1.7 }}>
                            Busque um produto acima ou adicione<br/>um combo que quer experimentar.<br/>
                            <span style={{ color: "var(--purple2)" }}>Dica: no cardápio, toque em 💭 para salvar direto!</span>
                          </div>
                        </div>
                      )}

                      {/* Lista de desejos */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {queroProvar.map(d => (
                          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                            {/* Foto do produto ou ícone */}
                            {d.foto
                              ? <img src={d.foto} alt="" style={{ width: 56, height: 56, objectFit: "cover", flexShrink: 0 }} />
                              : <div style={{ width: 56, height: 56, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", flexShrink: 0 }}>💭</div>
                            }
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nome}</div>
                              {d.preco > 0 && <div style={{ fontSize: "0.72rem", color: "var(--gold)", marginTop: 2 }}>R$ {d.preco.toFixed(2).replace(".", ",")}</div>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 10 }}>
                              {d.produtoId && (
                                <button
                                  onClick={() => navigate(`/?produto=${d.produtoId}`)}
                                  style={{ padding: "5px 10px", background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: 20, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.68rem", cursor: "pointer" }}
                                >Pedir</button>
                              )}
                              <button
                                onClick={() => removerDesejo(d.id)}
                                style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "1.1rem", padding: 0, lineHeight: 1 }}
                              >✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              {aba === "feedsFav" && (
                <div style={{ animation: "fadeUp 0.25s ease" }}>
                  {!isMeu ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text3)" }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}>
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                      </svg>
                      <div style={{ fontSize: "0.85rem" }}>Visível apenas no próprio perfil</div>
                    </div>
                  ) : feedsFav.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text3)" }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--border2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                      </svg>
                      <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>Nenhum feed salvo ainda</div>
                      <div style={{ fontSize: "0.75rem", lineHeight: 1.7 }}>Toque no ícone de bookmark nos posts<br />para salvar aqui</div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {feedsFav.map(f => (
                        <div key={f.id} style={{ display: "flex", gap: 10, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                          {/* Thumbnail */}
                          <div style={{ width: 72, height: 72, flexShrink: 0, background: "var(--bg3)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {f.midia ? (
                              f.tipo === "youtube"
                                ? <img src={`https://img.youtube.com/vi/${f.midia}/mqdefault.jpg`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : f.tipo === "video"
                                  ? <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem" }}>▶</div>
                                  : <img src={f.midia} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--border2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                            )}
                          </div>
                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0, padding: "8px 0 8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--surface)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem" }}>
                                {f.autorFoto ? <img src={f.autorFoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : f.autorNome?.[0]?.toUpperCase()}
                              </div>
                              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.autorNome || "Usuário"}</span>
                            </div>
                            {f.texto && (
                              <div style={{ fontSize: "0.75rem", color: "var(--text2)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                                {f.texto}
                              </div>
                            )}
                            {!f.texto && !f.midia && (
                              <div style={{ fontSize: "0.72rem", color: "var(--text3)", fontStyle: "italic" }}>Post sem texto</div>
                            )}
                          </div>
                          {/* Ações */}
                          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 10px 0 4px", gap: 6 }}>
                            <button
                              onClick={() => navigate(`/perfil/${f.autorId}`)}
                              style={{ padding: "4px 8px", background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: 20, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.62rem", cursor: "pointer", whiteSpace: "nowrap" }}
                            >Ver perfil</button>
                            <button
                              onClick={() => removerFeedFav(f.id)}
                              style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "1rem", padding: 0, lineHeight: 1, textAlign: "center" }}
                            >✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {aba === "lojas" && (
                <div style={{ animation: "fadeUp 0.25s ease" }}>
                  {!isMeu ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text3)" }}>
                      <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🏪</div>
                      <div style={{ fontSize: "0.85rem" }}>Visível apenas no próprio perfil</div>
                    </div>
                  ) : (
                    <>
                      {/* Busca de lojas */}
                      <div style={{ position: "relative", marginBottom: 16 }}>
                        <input
                          value={buscaLoja}
                          onChange={e => buscarLojas(e.target.value)}
                          placeholder="🔍 Buscar loja pelo nome..."
                          style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem", outline: "none" }}
                        />
                        {sugestoesLojas.length > 0 && (
                          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, marginTop: 4, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                            {sugestoesLojas.map(l => (
                              <div key={l.id} onClick={() => adicionarLoja(l)}
                                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)", transition: "background 0.15s" }}
                                onMouseEnter={e => e.currentTarget.style.background = "var(--bg3)"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                              >
                                {l.logo
                                  ? <img src={l.logo} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                                  : <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", flexShrink: 0 }}>{l.categoria || "🏪"}</div>
                                }
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{l.nome}</div>
                                  {l.categoria && <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>{l.categoria}</div>}
                                </div>
                                <span style={{ fontSize: "0.7rem", color: "var(--purple2)", fontWeight: 700 }}>+ Add</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {lojasFav.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text3)" }}>
                          <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🏪</div>
                          <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 6, color: "var(--text)" }}>Nenhuma loja favorita ainda</div>
                          <div style={{ fontSize: "0.75rem", lineHeight: 1.7 }}>Busque pelo nome e adicione suas lojas preferidas</div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {lojasFav.map(l => (
                            <div key={l.slug} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                              {l.logo
                                ? <img src={l.logo} alt="" style={{ width: 56, height: 56, objectFit: "cover", flexShrink: 0 }} />
                                : <div style={{ width: 56, height: 56, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", flexShrink: 0 }}>{l.categoria || "🏪"}</div>
                              }
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nome}</div>
                                {l.categoria && <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 2 }}>{l.categoria}</div>}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 10 }}>
                                <button
                                  onClick={() => navigate(`/loja/${l.slug}`)}
                                  style={{ padding: "5px 10px", background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: 20, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.68rem", cursor: "pointer" }}
                                >Visitar</button>
                                <button
                                  onClick={() => removerLoja(l.slug)}
                                  style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "1.1rem", padding: 0, lineHeight: 1 }}
                                >✕</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Botões de ação — só no meu perfil */}
        {isMeu && !editando && (
          <div style={{ padding: "16px 14px 0", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => navigate("/pontos")} style={{ flex: 1, padding: "11px", background: "rgba(245,197,24,0.1)", border: "1px solid rgba(245,197,24,0.3)", borderRadius: 10, color: "var(--gold)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>
                🏆 Meus Pontos
              </button>
              <button onClick={() => navigate("/ranking")} style={{ flex: 1, padding: "11px", background: "rgba(138,92,246,0.1)", border: "1px solid rgba(138,92,246,0.3)", borderRadius: 10, color: "var(--purple2)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>
                📊 Ver Ranking
              </button>
            </div>
            <button onClick={() => navigate("/carteira")} style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg, rgba(245,197,24,.15), rgba(34,197,94,.1))", border: "1px solid rgba(245,197,24,.3)", borderRadius: 10, color: "#f5c518", fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "0.88rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              💰 Minha Carteira · Ganhe convidando lojas
            </button>

            {/* Painel Admin — só para role: admin */}
            {perfil.role === "admin" && (
              <div style={{ marginTop: 4, background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.18)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(239,68,68,.6)", fontWeight: 700, marginBottom: 10 }}>⚙️ Painel Admin</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { icon: "💸", label: "Saques PIX",         desc: "Aprovar e processar saques", to: "/admin/saques" },
                    { icon: "🗺️", label: "Mapa de Lojas",      desc: "Ver lojas no mapa",          to: "/mapa" },
                    { icon: "📊", label: "Ranking",             desc: "Ranking de fãs",             to: "/ranking" },
                    { icon: "🏪", label: "Dashboard Lojista",   desc: "Gerenciar loja",             to: "/lojista/dashboard" },
                  ].map(item => (
                    <button key={item.to} onClick={() => navigate(item.to)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, cursor: "pointer", textAlign: "left" }}>
                      <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{item.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff", fontFamily: "'Outfit', sans-serif" }}>{item.label}</div>
                        <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.35)", fontFamily: "'Outfit', sans-serif" }}>{item.desc}</div>
                      </div>
                      <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,.2)" }}>›</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Menu lateral (drawer) ────────────── */}
        {showMenu && (
          <>
            <div onClick={() => setShowMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)" }} />
            <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "86%", maxWidth: 340, zIndex: 201, background: "var(--bg)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", animation: "slideInRight 0.25s ease" }}>
              <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

              {/* ── Perfil do usuário no topo ── */}
              <div style={{ padding: "20px 16px 16px", background: "linear-gradient(160deg, rgba(124,58,237,0.12), rgba(245,197,24,0.05))", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "2px solid rgba(138,92,246,0.4)", background: "linear-gradient(135deg,var(--purple2),#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1.2rem", color: "#fff" }}>
                    {user?.photoURL
                      ? <img src={user.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : (user?.displayName?.[0] || user?.email?.[0] || "?").toUpperCase()
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user?.displayName || perfil?.nome || "Meu perfil"}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                      📧 {user?.email || "—"}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 1 }}>
                      🆔 {user?.uid?.slice(0, 12)}…
                    </div>
                  </div>
                  <button onClick={() => setShowMenu(false)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "1.2rem", padding: 4, lineHeight: 1, flexShrink: 0 }}>✕</button>
                </div>

                {/* Stats rápidos */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                  {[
                    { label: "Pontos", value: perfil?.totalPontos ?? "—", color: "#f5c518" },
                    { label: "Ranking", value: rankingPos ? `#${rankingPos}` : "—", color: "#a78bfa" },
                    { label: "Pedidos", value: pedidos?.length ?? "—", color: "#34d399" },
                  ].map(s => (
                    <div key={s.label} style={{ background: "var(--bg2)", borderRadius: 10, padding: "8px 6px", textAlign: "center", border: "1px solid var(--border)" }}>
                      <div style={{ fontWeight: 800, fontSize: "0.95rem", color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: "0.6rem", color: "var(--text3)", marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Corpo do drawer ── */}
              <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>

                {/* Minha loja — primeiro item, só para lojistas */}
                {(isLojista || !isLojista) && (
                  isLojista && minhaLoja ? (
                    <button
                      onClick={() => { setShowMenu(false); navigate(`/loja/${minhaLoja.id}/admin`); }}
                      style={{ width: "100%", padding: "14px 16px", background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(245,197,24,0.06))", border: "none", borderBottom: "2px solid rgba(124,58,237,0.2)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: 12, overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,var(--purple2),#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", border: "2px solid rgba(138,92,246,0.4)" }}>
                        {minhaLoja.logo
                          ? <img src={minhaLoja.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : "🏪"
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--purple2)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Minha loja</div>
                        <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{minhaLoja.nome || "Painel admin"}</div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 1 }}>Toque para ir ao painel →</div>
                      </div>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--purple2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  ) : !isLojista ? (
                    <div style={{ margin: "10px 12px 4px", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(245,197,24,0.25)", background: "linear-gradient(135deg, rgba(245,197,24,0.07) 0%, rgba(124,58,237,0.1) 100%)" }}>
                      {/* Headline */}
                      <div style={{ padding: "14px 16px 10px" }}>
                        <div style={{ fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gold)", marginBottom: 6 }}>
                          🚀 Para lojistas
                        </div>
                        <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text)", lineHeight: 1.3, marginBottom: 6 }}>
                          Abra sua loja e comece a vender hoje
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text3)", lineHeight: 1.6 }}>
                          Gerencie pedidos, fidelize clientes com pontos e deixe a IA atender 24h por você.
                        </div>
                      </div>

                      {/* Benefícios */}
                      <div style={{ display: "flex", gap: 0, borderTop: "1px solid rgba(245,197,24,0.15)", borderBottom: "1px solid rgba(245,197,24,0.15)" }}>
                        {[
                          { icon: "🤖", label: "Robô 24h" },
                          { icon: "📊", label: "Relatórios" },
                          { icon: "🎯", label: "Fidelização" },
                        ].map((b, i) => (
                          <div key={i} style={{ flex: 1, padding: "8px 4px", textAlign: "center", borderRight: i < 2 ? "1px solid rgba(245,197,24,0.15)" : "none" }}>
                            <div style={{ fontSize: "1rem" }}>{b.icon}</div>
                            <div style={{ fontSize: "0.58rem", color: "var(--text3)", fontWeight: 600, marginTop: 2 }}>{b.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* CTA */}
                      <div style={{ padding: "12px 14px" }}>
                        <button
                          onClick={() => { setShowMenu(false); navigate("/lojista/cadastro"); }}
                          style={{ width: "100%", padding: "11px", background: "linear-gradient(135deg, #f5c518, #e6a817)", border: "none", borderRadius: 10, color: "#0a0414", fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: "0.88rem", cursor: "pointer", letterSpacing: "0.01em" }}
                        >
                          Criar minha loja grátis →
                        </button>
                        <div style={{ textAlign: "center", marginTop: 8, fontSize: "0.65rem", color: "var(--text3)" }}>
                          Já tem conta? <span onClick={() => { setShowMenu(false); navigate("/lojista/login"); }} style={{ color: "var(--purple2)", fontWeight: 700, cursor: "pointer" }}>Entrar como lojista</span>
                        </div>
                      </div>
                    </div>
                  ) : null
                )}

                {/* Navegação rápida */}
                <div style={{ padding: "10px 16px 4px", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text3)" }}>Navegação</div>
                {[
                  { icon: "👤", label: "Meu perfil",      acao: () => { setShowMenu(false); navigate("/meu-perfil"); } },
                  { icon: "💬", label: "Mensagens",        badge: chatNaoLido > 0 ? chatNaoLido : null, acao: () => { setShowMenu(false); navigate("/chat"); } },
                  { icon: "🗺️", label: "Mapa de lojas",   acao: () => { setShowMenu(false); navigate("/mapa"); } },
                  { icon: "❤️", label: "Favoritos",        acao: () => { setShowMenu(false); navigate("/favoritos"); } },
                  { icon: "🎟️", label: "Meus cupons",     acao: () => { setShowMenu(false); navigate("/cupons"); } },
                  { icon: "💰", label: "Carteira NexFoody",acao: () => { setShowMenu(false); navigate("/carteira"); } },
                  { icon: "🏆", label: "Ranking",          acao: () => { setShowMenu(false); navigate("/ranking"); } },
                  { icon: "🏅", label: "Prêmios",          acao: () => { setShowMenu(false); navigate("/premios"); } },
                ].map(item => (
                  <button key={item.label} onClick={item.acao} style={{ width: "100%", padding: "11px 16px", background: "none", border: "none", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontFamily: "'Outfit',sans-serif", textAlign: "left" }}>
                    <span style={{ fontSize: "1.1rem", width: 24, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ flex: 1, fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>{item.label}</span>
                    {item.badge && <span style={{ background: "#ef4444", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: "0.62rem", fontWeight: 700 }}>{item.badge}</span>}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                ))}

                {/* Minhas Lojas */}
                <div style={{ padding: "12px 16px 4px", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text3)" }}>
                  Minhas Lojas
                  <span style={{ marginLeft: 6, color: "var(--text3)", fontWeight: 400, textTransform: "none", fontSize: "0.65rem" }}>({lojasFav.length})</span>
                </div>
                {lojasFav.length === 0 ? (
                  <div style={{ padding: "10px 16px 14px", fontSize: "0.78rem", color: "var(--text3)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span>🏪</span> Você ainda não segue nenhuma loja
                  </div>
                ) : (
                  lojasFav.slice(0, 5).map(loja => (
                    <button key={loja.slug} onClick={() => { setShowMenu(false); navigate(`/loja/${loja.slug}`); }} style={{ width: "100%", padding: "9px 16px", background: "none", border: "none", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,var(--purple2),#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>
                        {loja.logo ? <img src={loja.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🏪"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loja.nome}</div>
                        {loja.categoria && <div style={{ fontSize: "0.62rem", color: "var(--text3)" }}>🏷️ {loja.categoria}</div>}
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  ))
                )}
                {lojasFav.length > 5 && (
                  <button onClick={() => { setShowMenu(false); navigate("/favoritos"); }} style={{ width: "100%", padding: "9px 16px", background: "none", border: "none", borderBottom: "1px solid var(--border)", fontSize: "0.78rem", color: "var(--purple2)", fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit',sans-serif", textAlign: "left" }}>
                    Ver todas as {lojasFav.length} lojas →
                  </button>
                )}

                {/* Solicitações de amizade */}
                <div style={{ padding: "12px 16px 4px", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text3)" }}>
                  Solicitações de amizade
                  {solicitacoes.length > 0 && <span style={{ marginLeft: 8, background: "#ef4444", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: "0.6rem" }}>{solicitacoes.length}</span>}
                </div>
                {solicitacoes.length === 0 ? (
                  <div style={{ padding: "10px 16px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "1rem" }}>👥</span>
                    <div style={{ fontSize: "0.78rem", color: "var(--text3)" }}>Nenhuma solicitação pendente</div>
                  </div>
                ) : (
                  <div>
                    {solicitacoes.map(s => (
                      <div key={s.id} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                        <div onClick={() => { setShowMenu(false); navigate(`/perfil/${s.de}`); }} style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,var(--purple2),#6d28d9)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95rem", fontWeight: 800, color: "#fff", cursor: "pointer" }}>
                          {s.remetenteFoto ? <img src={s.remetenteFoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : s.remetenteNome?.[0]?.toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div onClick={() => { setShowMenu(false); navigate(`/perfil/${s.de}`); }} style={{ fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.remetenteNome || "Usuário"}</div>
                          <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>quer ser seu amigo</div>
                        </div>
                        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                          {aceitosAgora.has(s.id) ? (
                            <button onClick={() => { setShowMenu(false); import("./ChatPage").then(({ abrirOuCriarChat }) => abrirOuCriarChat({ minhaUid: user.uid, meuNome: user.displayName || user.email?.split("@")[0] || "Você", minhaFoto: user.photoURL || null, outroUid: s.de, outroNome: s.remetenteNome || "Amigo", outroFoto: s.remetenteFoto || null, navigate })); }}
                              style={{ padding: "4px 10px", background: "linear-gradient(135deg,#25d366,#128c7e)", border: "none", borderRadius: 16, color: "#fff", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.65rem", cursor: "pointer" }}>
                              💬 Chat
                            </button>
                          ) : (
                            <>
                              <button onClick={async () => { await updateDoc(doc(db, "amizades", s.id), { status: "aceito" }); setAceitosAgora(prev => new Set([...prev, s.id])); }}
                                style={{ padding: "4px 10px", background: "linear-gradient(135deg,var(--purple2),#6d28d9)", border: "none", borderRadius: 16, color: "#fff", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.65rem", cursor: "pointer" }}>✓</button>
                              <button onClick={async () => { await deleteDoc(doc(db, "amizades", s.id)); }}
                                style={{ padding: "4px 8px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 16, color: "var(--text3)", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.65rem", cursor: "pointer" }}>✕</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Configurações */}
                <div style={{ padding: "12px 16px 4px", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text3)" }}>Configurações</div>
                <button onClick={() => { setShowMenu(false); navigate("/como-funciona"); }} style={{ width: "100%", padding: "11px 16px", background: "none", border: "none", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>
                  <span style={{ fontSize: "1.1rem", width: 24, textAlign: "center" }}>❓</span>
                  <span style={{ flex: 1, fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>Como funciona</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>


              </div>

              {/* ── Footer: trocar conta + sair ── */}
              <div style={{ padding: "12px 16px 20px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={async () => { setShowMenu(false); try { await logout(); } catch {} navigate("/nexfoody/login"); }}
                  style={{ width: "100%", padding: "11px", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 12, color: "var(--purple2)", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  🔄 Trocar de conta
                </button>
                <button
                  onClick={async () => { setShowMenu(false); try { await logout(); } catch {} navigate("/nexfoody/login"); }}
                  style={{ width: "100%", padding: "11px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, color: "#ef4444", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  🚪 Sair da conta
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Bottom Navigation ────────────────── */}
        <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 62, background: "var(--bg2)", borderTop: "1px solid var(--border)", display: "flex", zIndex: 100, backdropFilter: "blur(14px)" }}>
          {[
            {
              label: "Início", to: "/app",
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
            },
            {
              label: "Explorar", to: "/feed",
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
            },
            {
              label: "Chat", to: "/chat", badge: chatNaoLido,
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
            },
            {
              label: "Ranking", to: "/ranking",
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 20 18 10"/><polyline points="12 20 12 4"/><polyline points="6 20 6 14"/></svg>,
            },
            {
              label: "Perfil", to: null, active: true,
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
            },
          ].map((item, i) => (
            <button key={i}
              onClick={() => item.to && navigate(item.to)}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: "none", border: "none", cursor: item.to ? "pointer" : "default", color: item.active ? "var(--gold)" : "var(--text3)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.55rem", position: "relative", transition: "color 0.15s" }}
              onMouseEnter={e => { if (!item.active) e.currentTarget.style.color = "var(--text2)"; }}
              onMouseLeave={e => { if (!item.active) e.currentTarget.style.color = "var(--text3)"; }}
            >
              <span style={{ position: "relative", display: "inline-flex" }}>
                {item.icon}
                {item.badge > 0 && (
                  <span style={{ position: "absolute", top: -4, right: -5, minWidth: 15, height: 15, borderRadius: 8, background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5rem", fontWeight: 800, color: "#fff", padding: "0 3px" }}>
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </span>
              {item.label}
              {item.active && <span style={{ position: "absolute", bottom: 5, width: 4, height: 4, borderRadius: "50%", background: "var(--gold)" }} />}
            </button>
          ))}
        </nav>

        {/* Modal de corte de capa */}
        {cropModal && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", marginBottom: 12 }}>Posicione a foto</div>
            <div style={{ position: "relative", width: "100%", maxWidth: 400, height: 120, overflow: "hidden", borderRadius: 8, border: "2px solid rgba(255,255,255,0.3)" }}>
              <img
                src={cropModal.tempUrl}
                alt=""
                draggable={false}
                style={{ position: "absolute", inset: 0, width: "100%", height: "130%", objectFit: "cover", objectPosition: `center ${capaY}%`, cursor: draggingCrop ? "grabbing" : "grab" }}
                onMouseDown={e => { setDraggingCrop(true); setCropStartY(e.clientY - capaY); }}
                onMouseMove={e => { if (draggingCrop) setCapaY(Math.max(0, Math.min(100, e.clientY - cropStartY))); }}
                onMouseUp={() => setDraggingCrop(false)}
                onMouseLeave={() => setDraggingCrop(false)}
                onTouchStart={e => { setDraggingCrop(true); setCropStartY(e.touches[0].clientY - capaY); }}
                onTouchMove={e => { if (draggingCrop) setCapaY(Math.max(0, Math.min(100, e.touches[0].clientY - cropStartY))); }}
                onTouchEnd={() => setDraggingCrop(false)}
              />
            </div>
            <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.6)", marginTop: 8, marginBottom: 16 }}>Arraste para ajustar</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { URL.revokeObjectURL(cropModal.tempUrl); setCropModal(null); setCapaY(0); }}
                style={{ padding: "10px 20px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 600, cursor: "pointer" }}
              >Cancelar</button>
              <button
                onClick={async () => {
                  setUploadando(true);
                  try {
                    const fd = new FormData();
                    fd.append("image", cropModal.file);
                    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: fd });
                    const data = await res.json();
                    if (data.success) {
                      await updateDoc(doc(db, "users", user.uid), { fotoCapa: data.data.url, capaY });
                    }
                    URL.revokeObjectURL(cropModal.tempUrl);
                    setCropModal(null);
                  } catch (e) { console.error(e); }
                  finally { setUploadando(false); }
                }}
                disabled={uploadando}
                style={{ padding: "10px 20px", background: "var(--purple2)", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, cursor: uploadando ? "not-allowed" : "pointer", opacity: uploadando ? 0.6 : 1 }}
              >{uploadando ? "⏳" : "💾 Salvar"}</button>
            </div>
          </div>
        )}

        {/* Story Viewer */}
        {storyViewer && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#000" }}>
            {/* Mídia — ocupa tudo */}
            {storyViewer.tipo === "youtube"
              ? <iframe
                  src={`https://www.youtube.com/embed/${storyViewer.midia}?autoplay=1&playsinline=1`}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                />
              : storyViewer.tipo === "video"
                ? <video src={storyViewer.midia} controls playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} onTimeUpdate={e => { if (e.target.currentTime > 60) { e.target.pause(); e.target.currentTime = 0; } }} />
                : <img src={storyViewer.midia} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
            }

            {/* Header — overlay fixo no topo */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, display: "flex", alignItems: "center", padding: "10px 14px", gap: 10, background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)", pointerEvents: "none" }}>
              <span style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 600 }}>você</span>
              <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.6)", marginLeft: "auto" }}>
                {storyViewer.criadoEm?.toDate ? storyViewer.criadoEm.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
              </span>
            </div>

            {/* Botão fechar — canto superior esquerdo, sempre clicável */}
            <button
              onClick={() => setStoryViewer(null)}
              style={{ position: "absolute", top: 10, left: 14, zIndex: 20, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%", width: 34, height: 34, color: "#fff", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}
            >✕</button>

            {/* Ações — overlay fixo na base, sempre acima do iframe */}
            {isMeu && (
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20, padding: "20px 14px 24px", display: "flex", gap: 10, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)" }}>
                <button
                  onClick={async () => { await criarHighlight(storyViewer.id); setStoryViewer(null); }}
                  style={{ flex: 1, padding: "12px 8px", background: "rgba(245,197,24,0.2)", border: "1px solid rgba(245,197,24,0.5)", borderRadius: 12, color: "var(--gold)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", backdropFilter: "blur(8px)" }}
                >⭐ Highlight</button>
                <button
                  onClick={async () => { if (!confirm("Apagar este story?")) return; await deleteDoc(doc(db, "stories", storyViewer.id)); setStoryViewer(null); }}
                  style={{ flex: 1, padding: "12px 8px", background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.5)", borderRadius: 12, color: "#ff6b6b", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", backdropFilter: "blur(8px)" }}
                >🗑 Apagar story</button>
              </div>
            )}
          </div>
        )}

        {/* Highlight Viewer */}
        {highlightModal && (
          <HighlightViewer
            highlight={highlightModal}
            stories={stories}
            isMeu={isMeu}
            user={user}
            onClose={() => setHighlightModal(null)}
            onDelete={async (highlightId) => {
              await deleteDoc(doc(db, "highlights", highlightId));
              setHighlightModal(null);
            }}
            onUpdateTitle={async (highlightId, novoTitulo) => {
              await updateDoc(doc(db, "highlights", highlightId), { titulo: novoTitulo });
            }}
          />
        )}

        {/* Story Camera */}
        {storyCamera && (() => {
          const ytId = extractYoutubeId(youtubeUrl);
          const fileOnChange = e => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.type.startsWith("video/")) {
              setStoryTipo("video"); setStoryFile(file); setStoryPreview(URL.createObjectURL(file));
            } else {
              setStoryTipo("imagem"); setStoryFile(file); setStoryPreview(URL.createObjectURL(file));
            }
          };
          const postarArquivo = async () => {
            setUploadingStory(true);
            try {
              let url = "";
              if (storyTipo === "video") {
                url = await new Promise(resolve => {
                  const task = uploadBytesResumable(storageRef(storage, `stories/${Date.now()}.mp4`), storyFile);
                  task.on("state_changed", s => setStoryProgress(Math.round(s.bytesTransferred / s.totalBytes * 100)), () => resolve(""), async () => resolve(await getDownloadURL(task.snapshot.ref)));
                });
              } else {
                const blob = await (await fetch(storyPreview)).blob();
                const fd = new FormData(); fd.append("image", blob);
                const r = await (await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: fd })).json();
                url = r.success ? r.data.url : "";
              }
              if (url) {
                await addDoc(collection(db, "stories"), { autorId: user.uid, midia: url, tipo: storyTipo, visualizacoes: [], criadoEm: serverTimestamp() });
                setStoryCamera(false); setStoryPreview(null);
              }
            } catch (e) { console.error(e); alert("Erro: " + (e?.message || e?.code)); }
            finally { setUploadingStory(false); }
          };

          return (
            <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "linear-gradient(160deg, #0f0518 0%, #1a0836 50%, #0a0220 100%)", display: "flex", flexDirection: "column", overflowY: "auto" }}>

              {/* Glow de fundo */}
              <div style={{ position: "fixed", top: "-20%", left: "50%", transform: "translateX(-50%)", width: "80vw", height: "60vh", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(138,92,246,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />

              {/* Header */}
              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 0" }}>
                <div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: "#fff", fontSize: "1.3rem", lineHeight: 1 }}>Nova história</div>
                  <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", marginTop: 3, letterSpacing: "0.04em" }}>Compartilhe um momento</div>
                </div>
                <button
                  onClick={() => { setStoryCamera(false); setStoryPreview(null); setYoutubeUrl(""); setYtSearch(""); setStoryInputMode("arquivo"); }}
                  style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                >✕</button>
              </div>

              {/* Abas */}
              <div style={{ flexShrink: 0, display: "flex", gap: 8, margin: "20px 20px 0" }}>
                {[
                  { id: "arquivo", icon: "📸", label: "Galeria" },
                  { id: "youtube", icon: "▶️", label: "YouTube" },
                ].map(tab => (
                  <button key={tab.id} onClick={() => { setStoryInputMode(tab.id); setStoryPreview(null); setYoutubeUrl(""); setYtSearch(""); }}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 0",
                      background: storyInputMode === tab.id ? "linear-gradient(135deg, #7c3aed, #a855f7)" : "rgba(255,255,255,0.05)",
                      border: storyInputMode === tab.id ? "1px solid rgba(168,85,247,0.5)" : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 14, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.88rem",
                      cursor: "pointer", transition: "all 0.22s",
                      boxShadow: storyInputMode === tab.id ? "0 4px 20px rgba(124,58,237,0.4)" : "none",
                    }}
                  >
                    <span style={{ fontSize: "1rem" }}>{tab.icon}</span>{tab.label}
                  </button>
                ))}
              </div>

              {/* Conteúdo */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 20px 32px", gap: 16 }}>

                {storyInputMode === "arquivo" ? (
                  /* ── Aba Galeria ── */
                  storyPreview ? (
                    /* Com mídia selecionada */
                    <>
                      <div style={{ width: "100%", maxWidth: 320, aspectRatio: "9/16", borderRadius: 20, overflow: "hidden", position: "relative", border: "2px solid rgba(168,85,247,0.4)", boxShadow: "0 0 40px rgba(124,58,237,0.3)" }}>
                        {storyTipo === "video"
                          ? <video src={storyPreview} controls playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} onTimeUpdate={e => { if (e.target.currentTime > 60) { e.target.pause(); e.target.currentTime = 0; } }} />
                          : <img src={storyPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        }
                        <label style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 20, padding: "5px 12px", fontSize: "0.72rem", fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                          Trocar
                          <input type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={fileOnChange} />
                        </label>
                      </div>
                      <button onClick={postarArquivo} disabled={uploadingStory}
                        style={{ width: "100%", maxWidth: 320, padding: "15px", background: uploadingStory ? "rgba(124,58,237,0.4)" : "linear-gradient(135deg, #7c3aed, #a855f7)", border: "none", borderRadius: 16, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1rem", cursor: uploadingStory ? "not-allowed" : "pointer", boxShadow: "0 6px 24px rgba(124,58,237,0.45)", letterSpacing: "0.02em" }}
                      >
                        {uploadingStory ? (
                          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                            <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                            Enviando {storyProgress}%
                          </span>
                        ) : "✦ Publicar história"}
                      </button>
                    </>
                  ) : (
                    /* Zona de upload — SEM arquivo */
                    <label style={{ width: "100%", maxWidth: 320, cursor: "pointer", display: "block" }}>
                      <input type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={fileOnChange} />
                      <div style={{ aspectRatio: "9/16", borderRadius: 24, background: "linear-gradient(160deg, rgba(124,58,237,0.12), rgba(245,197,24,0.06))", border: "2px dashed rgba(138,92,246,0.45)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, transition: "border-color 0.2s, background 0.2s" }}>
                        {/* Ícone SVG da câmera */}
                        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #7c3aed, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 32px rgba(124,58,237,0.5)" }}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                          </svg>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: "1.15rem", color: "#fff", marginBottom: 6 }}>Escolher da galeria</div>
                          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>Foto ou vídeo até 60 segundos</div>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          {["🖼️ Foto", "🎬 Vídeo"].map(t => (
                            <div key={t} style={{ padding: "5px 14px", borderRadius: 20, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", fontSize: "0.72rem", color: "rgba(255,255,255,0.5)", fontFamily: "'Outfit', sans-serif" }}>{t}</div>
                          ))}
                        </div>
                      </div>
                    </label>
                  )
                ) : (
                  /* ── Aba YouTube ── */
                  <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 20 }}>

                    {/* Card busca */}
                    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "18px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: "#ff0000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem" }}>▶</div>
                        <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#fff" }}>Buscar no YouTube</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input value={ytSearch} onChange={e => setYtSearch(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && ytSearch.trim()) window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(ytSearch)}`, "_blank"); }}
                          placeholder="Ex: açaí short, burger challenge…"
                          style={{ flex: 1, padding: "11px 14px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem", outline: "none" }}
                        />
                        <button onClick={() => ytSearch.trim() && window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(ytSearch)}`, "_blank")}
                          disabled={!ytSearch.trim()}
                          style={{ padding: "11px 18px", background: ytSearch.trim() ? "#ff0000" : "rgba(255,255,255,0.06)", border: "none", borderRadius: 12, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.85rem", cursor: ytSearch.trim() ? "pointer" : "default", opacity: ytSearch.trim() ? 1 : 0.4 }}
                        >Buscar</button>
                      </div>
                      <div style={{ marginTop: 8, fontSize: "0.68rem", color: "rgba(255,255,255,0.28)", lineHeight: 1.5 }}>
                        Abre o YouTube em nova aba → copie o link do Shorts → cole abaixo
                      </div>
                    </div>

                    {/* Card colar URL */}
                    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "18px 16px" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#fff", marginBottom: 12 }}>🔗 Colar link do vídeo</div>
                      <input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
                        placeholder="https://youtube.com/shorts/…"
                        style={{ width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.07)", border: `1.5px solid ${ytId ? "#a855f7" : "rgba(255,255,255,0.12)"}`, borderRadius: 12, color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
                      />
                      {youtubeUrl && !ytId && <div style={{ fontSize: "0.7rem", color: "#f87171", marginTop: 6 }}>Link inválido — verifique a URL</div>}
                      {ytId && <div style={{ fontSize: "0.7rem", color: "#86efac", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}><span>✓</span> Vídeo identificado</div>}
                    </div>

                    {/* Preview thumbnail YouTube */}
                    {ytId && (
                      <div style={{ borderRadius: 16, overflow: "hidden", position: "relative", border: "1px solid rgba(168,85,247,0.3)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                        <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" style={{ width: "100%", display: "block" }} />
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#ff0000", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(255,0,0,0.5)", fontSize: "1.5rem" }}>▶</div>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={async () => {
                        if (!ytId) return;
                        setUploadingStory(true);
                        try {
                          await addDoc(collection(db, "stories"), { autorId: user.uid, midia: ytId, tipo: "youtube", visualizacoes: [], criadoEm: serverTimestamp() });
                          setStoryCamera(false); setYoutubeUrl(""); setYtSearch(""); setStoryInputMode("arquivo");
                        } catch (e) { console.error(e); alert("Erro: " + (e?.message || e?.code)); }
                        finally { setUploadingStory(false); }
                      }}
                      disabled={!ytId || uploadingStory}
                      style={{ padding: "15px", background: ytId ? "linear-gradient(135deg, #dc2626, #ff0000)" : "rgba(255,255,255,0.06)", border: ytId ? "none" : "1px solid rgba(255,255,255,0.08)", borderRadius: 16, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1rem", cursor: ytId && !uploadingStory ? "pointer" : "not-allowed", opacity: !ytId || uploadingStory ? 0.45 : 1, transition: "all 0.2s", letterSpacing: "0.02em", boxShadow: ytId ? "0 6px 24px rgba(220,38,38,0.4)" : "none" }}
                    >
                      {uploadingStory ? "Publicando…" : "▶ Publicar YouTube Short"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}

// ─── HighlightViewer ───
function HighlightViewer({ highlight, stories, isMeu, user, onClose, onDelete, onUpdateTitle }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(highlight.titulo);

  // só stories que estão neste highlight
  const highlightStories = stories.filter(s => highlight.stories.includes(s.id));
  const total = highlightStories.length;
  const current = highlightStories[currentIdx];

  // progresso por story
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!current) return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          // avança para próxima
          if (currentIdx < total - 1) {
            setCurrentIdx(i => i + 1);
          } else {
            onClose();
          }
          return 100;
        }
        return p + 2; // ~5s por story
      });
    }, 100);
    return () => clearInterval(interval);
  }, [current, currentIdx, total]);

  if (!current) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#fff", fontSize: "1rem", marginBottom: 16 }}>Nenhuma story neste highlight</div>
        <button onClick={onClose} style={{ padding: "10px 20px", background: "var(--purple2)", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer" }}>Fechar</button>
      </div>
    );
  }

  const goNext = () => { if (currentIdx < total - 1) setCurrentIdx(i => i + 1); else onClose(); };
  const goPrev = () => { if (currentIdx > 0) setCurrentIdx(i => i - 1); };

  const salvarTitulo = async () => {
    if (titleInput.trim()) {
      await onUpdateTitle(highlight.id, titleInput.trim());
    }
    setEditingTitle(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#000", display: "flex", flexDirection: "column" }}>
      {/* Barra de progresso por story */}
      <div style={{ display: "flex", gap: 4, padding: "8px 12px" }}>
        {highlightStories.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 2, background: "rgba(255,255,255,0.3)", borderRadius: 2 }}>
            <div style={{ width: `${i < currentIdx ? 100 : i === currentIdx ? progress : 0}%`, height: "100%", background: "#fff", borderRadius: 2, transition: "width 0.1s linear" }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "8px 14px", gap: 10 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "1rem" }}>✕</button>
        <div style={{ flex: 1 }}>
          {editingTitle ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                value={titleInput}
                onChange={e => setTitleInput(e.target.value)}
                onBlur={salvarTitulo}
                onKeyDown={e => { if (e.key === "Enter") salvarTitulo(); }}
                autoFocus
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 6, color: "#fff", padding: "4px 8px", fontSize: "0.82rem", fontFamily: "'Outfit', sans-serif", width: 100 }}
              />
            </div>
          ) : (
            <span
              onClick={isMeu ? () => setEditingTitle(true) : undefined}
              style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 600, cursor: isMeu ? "pointer" : "default" }}
            >{highlight.titulo} {isMeu && "✏️"}</span>
          )}
        </div>
        <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)" }}>{currentIdx + 1}/{total}</span>
      </div>

      {/* Mídia — toque para navegar */}
      <div
        style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
        onTouchStart={e => { goNext(); }}
        onClick={goNext}
      >
        {/* Tap zones */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "30%", cursor: "pointer" }} onClick={goPrev} />

        {current.tipo === "youtube"
          ? <iframe
              src={`https://www.youtube.com/embed/${current.midia}?autoplay=1&playsinline=1`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{ width: "100%", aspectRatio: "9/16", border: "none", maxHeight: "80vh" }}
            />
          : current.tipo === "video"
            ? <video src={current.midia} controls playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            : <img src={current.midia} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        }
      </div>

      {/* Ações */}
      {isMeu && (
        <div style={{ padding: "10px 14px", display: "flex", gap: 10 }}>
          <button
            onClick={() => { if (confirm("Apagar este highlight?")) onDelete(highlight.id); }}
            style={{ flex: 1, padding: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "var(--red)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer" }}
          >🗑 Apagar highlight</button>
        </div>
      )}
    </div>
  );
}
