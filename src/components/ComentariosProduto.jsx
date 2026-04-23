// src/components/ComentariosProduto.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { collection, addDoc, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, increment, getDoc, setDoc, getDocs, where, limit } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, functions, storage } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";
import { getBadges } from "./RankingFas";

export default function ComentariosProduto({ produto, onClose, children }) {
  const { user } = useAuth();
  const { config, isAdmin, addToCart } = useStore();
  const navigate = useNavigate();
  const { slug: slugParam } = useParams();
  const [comentarios, setComentarios] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [swipeId, setSwipeId] = useState(null);
  const [respondendoId, setRespondendoId] = useState(null);
  const [textoResposta, setTextoResposta] = useState("");
  const [denunciados, setDenunciados] = useState({});
  const [menuAbertoId, setMenuAbertoId] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [editandoTexto, setEditandoTexto] = useState("");
  const [userRating, setUserRating] = useState(null);
  const [mediaAvaliacao, setMediaAvaliacao] = useState({ total: 0, count: 0 });
  const [filtroEstrelas, setFiltroEstrelas] = useState(null); // null = todas
  const [uteis, setUteis] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`uteis_${produto.id}`) || "{}"); } catch { return {}; }
  });
  const listaRef = useRef(null);
  const touchStartX = useRef(0);
  const [reacoes, setReacoes] = useState({}); // { commentId: { emoji: [uids] } }
  const [userReacoes, setUserReacoes] = useState({}); // { commentId: emoji }
  const userReacoesRef = useRef({});
  const [sortBy, setSortBy] = useState("relevante");
  const [topUsers, setTopUsers] = useState([]);
  const [reiData, setReiData] = useState(null);
  const [temNovo, setTemNovo] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [novosIds, setNovosIds] = useState([]);
  const [comprado, setComprado] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(null);
  const [curtidas, setCurtidas] = useState({}); // { commentId: count }
  const [userCurtidas, setUserCurtidas] = useState({});
  const [enviadosPontos, setEnviadosPontos] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`enviados_${produto.id}_${user?.uid}`) || "[]"); } catch { return []; }
  });
  const [respondendoUserId, setRespondendoUserId] = useState(null);
  const [textoRespostaUser, setTextoRespostaUser] = useState("");
  const [replyPickerOpen, setReplyPickerOpen] = useState(null);
  const [repliesExpanded, setRepliesExpanded] = useState({});
  const longPressTimer = useRef(null);
  const lastCountRef = useRef(0);
  const [flyAnim, setFlyAnim] = useState(null); // { fotoSrc, x, y, scale, opacity, progress }
  const [cupomFraseIdx, setCupomFraseIdx] = useState(0);
  const [temCupons, setTemCupons] = useState(true);
  const [flashId, setFlashId] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [subindoFoto, setSubindoFoto] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, "cupons"), where("ativo", "==", true), limit(1));
    getDocs(q).then(snap => setTemCupons(!snap.empty));
  }, []);

  const FRASES_CUPOM = [
    "🎉 5% de desconto!",
    "🔥 Cupom só hoje!",
    "🔥 10% OFF agora",
    "⚡ Só hoje! Aproveita",
    "🎯 Economize neste pedido",
    "🔓 Desbloqueie seu desconto",
    "💸 Desconto liberado pra você",
    "⏳ Últimas horas de desconto",
    "🎁 Cupom grátis!",
    "⭐ Pegue seu Cupom!",
  ];

  const frasesDoCupom = Array.isArray(config.chamadaCupom)
    ? config.chamadaCupom
    : config.chamadaCupom
      ? [config.chamadaCupom]
      : FRASES_CUPOM;

  // cycling: mostra uma frase por vez, alternando entre todas
  const fraseAtual = Array.isArray(config.chamadaCupom)
    ? frasesDoCupom[cupomFraseIdx % frasesDoCupom.length]
    : (config.chamadaCupom || "Cupom");

  const EMOJIS = ["😋", "😍", "❤️", "😂", "😮", "😢", "👏", "🔥"];
  const PONTOS_ROCKS = [
    { emoji: "🚀", pontos: 1, label: "1 pt" },
    { emoji: "🚀", pontos: 2, label: "2 pts" },
    { emoji: "🚀", pontos: 3, label: "3 pts" },
  ];

  // Fly to cart animation
  const handleAddFly = useCallback((e) => {
    if (!produto) return;
    const btnRect = e.currentTarget.getBoundingClientRect();
    const startX = btnRect.left + btnRect.width / 2 - 20;
    const startY = btnRect.top - 20;
    const endX = window.innerWidth - 60;
    const endY = window.innerHeight - 100;
    setFlyAnim({ fotoSrc: produto.foto, x: startX, y: startY, progress: 0 });
    addToCart(produto.id, 1);
    const startTime = performance.now();
    const duration = 600;
    const animate = (now) => {
      const p = Math.min((now - startTime) / duration, 1);
      const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      const x = startX + (endX - startX) * ease;
      const y = startY + (endY - startY) * ease;
      const scale = 1 - 0.8 * ease;
      const opacity = 1 - ease;
      setFlyAnim(prev => prev ? { ...prev, x, y, scale, opacity, progress: p } : null);
      if (p < 1) requestAnimationFrame(animate);
      else setFlyAnim(null);
    };
    requestAnimationFrame(animate);
  }, [produto, addToCart]);

  // Cycling frases do cupom (mostra uma por vez, incluindo a pinnada)
  useEffect(() => {
    if (!Array.isArray(config.chamadaCupom)) return;
    if (frasesDoCupom.length < 2) return;
    setCupomFraseIdx(0);
    const interval = setInterval(() => setCupomFraseIdx(i => (i + 1) % frasesDoCupom.length), 2500);
    return () => clearInterval(interval);
  }, [config.chamadaCupom]);

  const comentariosAtivos = config.comentariosAtivos !== false;

  const mediaCount = mediaAvaliacao.count > 0 ? (mediaAvaliacao.total / mediaAvaliacao.count).toFixed(1) : "0.0";
  const totalCount = mediaAvaliacao.count;
  const fmtCount = totalCount >= 1000 ? `${(totalCount / 1000).toFixed(1).replace(".", ",")}k` : totalCount;

  // repliesPorPai calculado antes para poder usar no score
  const _repliesPorPai = {};
  comentarios.filter(c => c.respostaAId).forEach(r => {
    if (!_repliesPorPai[r.respostaAId]) _repliesPorPai[r.respostaAId] = [];
    _repliesPorPai[r.respostaAId].push(r);
  });

  // Score de relevância: curtidas + replies + recência
  const scoreRelevancia = (c) => {
    const curtidasCount = curtidas[c.id] || 0;
    const repliesCount = (_repliesPorPai[c.id] || []).length;
    const idadeH = (Date.now() - new Date(c.criadoEm).getTime()) / 3600000;
    const freshness = Math.max(0, 48 - idadeH); // mais recente = mais peso
    return curtidasCount * 3 + repliesCount * 2 + freshness * 0.5;
  };

  const comentariosFiltrados = [...comentarios].sort((a, b) => {
    if (sortBy === "relevante") return scoreRelevancia(b) - scoreRelevancia(a);
    return new Date(b.criadoEm) - new Date(a.criadoEm); // mais recentes primeiro
  });

  const comentariosRaiz = comentariosFiltrados.filter(c => !c.respostaAId);
  const repliesPorPai = _repliesPorPai;

  // Rei do ranking sempre no topo
  const rei = topUsers.find(u => u.posicao === 1);
  const tituloRei = rei?.displayName?.toLowerCase().endsWith("a") ? "Rainha" : "Rei";
  const comentarioRei = comentariosRaiz.find(c => c.autorId === rei?.id);
  // Forçar rei no topo se existir,-remover do meio e colocar na primeira posição
  let comentariosSemRei = comentariosRaiz.filter(c => c.id !== comentarioRei?.id);
  const listaFinal = comentarioRei ? [comentarioRei, ...comentariosSemRei] : comentariosSemRei;

  const reactToComment = async (comentarioId, emoji) => {
    if (!user?.uid) return;
    const existing = userReacoesRef.current[comentarioId];
    const reacoesRef = collection(db, `produtos/${produto.id}/reacoes`);
    if (existing === emoji) {
      const q = query(reacoesRef, where("comentarioId", "==", comentarioId), where("userId", "==", user.uid));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    } else {
      if (existing) {
        const q = query(reacoesRef, where("comentarioId", "==", comentarioId), where("userId", "==", user.uid));
        const snap = await getDocs(q);
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      }
      await addDoc(reacoesRef, {
        comentarioId, emoji, userId: user.uid,
        userNome: user.displayName || user.email?.split("@")[0] || "Cliente",
        criadoEm: serverTimestamp(),
      });
    }
  };

  const handleCurtir = async (comentarioId) => {
    if (!user?.uid) { alert("Faça login para curtir!"); return; }
    const jaCurtiu = !!userCurtidas[comentarioId];
    const curtidasRef = collection(db, `produtos/${produto.id}/curtidas`);
    const q = query(curtidasRef, where("comentarioId", "==", comentarioId), where("userId", "==", user.uid));
    try {
      if (jaCurtiu) {
        setUserCurtidas(prev => { const n = {...prev}; delete n[comentarioId]; return n; });
        const snap = await getDocs(q);
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      } else {
        setUserCurtidas(prev => ({ ...prev, [comentarioId]: true }));
        await addDoc(curtidasRef, {
          comentarioId, userId: user.uid,
          userNome: user.displayName || user.email?.split("@")[0] || "Cliente",
          criadoEm: serverTimestamp(),
        });
      }
    } catch (e) { console.error("Erro curtir:", e); }
  };

  const compartilharFoto = async (comentario) => {
    if (!comentario.foto) return;
    try {
      const fotoParam = btoa(comentario.foto);
      const fotoUrl = `${window.location.origin}/foto/${fotoParam}`;
      const texto = `Olha esse açaí! 🍓🔝`;
      if (navigator.share) {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          // Mobile: tenta share com imagem
          try {
            const resp = await fetch(comentario.foto);
            const blob = await resp.blob();
            const file = new File([blob], "acai.jpg", { type: blob.type });
            await navigator.share({ title: config.nomeLoja || "Loja", text: texto, files: [file] });
          } catch {
            await navigator.share({ title: config.nomeLoja || "Loja", url: fotoUrl });
          }
        } else {
          // Desktop: abre WhatsApp com link limpo
          window.open(`https://wa.me/?text=${encodeURIComponent(texto + " " + fotoUrl)}`, "_blank");
        }
      } else {
        window.open(fotoUrl, "_blank");
      }
    } catch (e) { console.error("Erro compartilhar:", e); }
  };

  const compartilharTexto = async (comentario) => {
    try {
      const texto = comentario.texto || `Olha esse açaí! 🍓🔝`;
      if (navigator.share) {
        await navigator.share({ title: config.nomeLoja || "Loja", text: texto });
      } else {
        await navigator.clipboard.writeText(texto);
        alert("Texto copiado!");
      }
    } catch (e) { if (e.name !== "AbortError") console.error("Erro compartilhar texto:", e); }
  };

  const LIMITE_ENVIO_DIA = 10;
  const LIMITE_RECEBIDO_DIA = 30;

  const enviarPontos = async (comentarioId, autorId, pontos) => {
    if (!user?.uid || !autorId) return;
    // Não pode dar ponto pra si mesmo
    if (user.uid === autorId) {
      alert("Você não pode dar pontos para si mesmo! 😅");
      return;
    }
    // Registro permanente no Firestore (anti-fraude)
    const registroId = `${user.uid}_${comentarioId}`;
    const jaEnviouSnap = await getDoc(doc(db, "enviadosPontos", registroId));
    if (jaEnviouSnap.exists()) return;
    // Limite de envio por dia
    const HOJE = new Date().toISOString().split("T")[0];
    const enviosDiaRef = doc(db, "enviosPontosDia", `${user.uid}_${HOJE}`);
    const enviosSnap = await getDoc(enviosDiaRef);
    const totalEnviado = enviosSnap.data()?.total || 0;
    if (totalEnviado >= LIMITE_ENVIO_DIA) {
      alert(`Você já enviou ${LIMITE_ENVIO_DIA} pontos hoje. Limite diário atingido!`);
      return;
    }
    // Limite de recebimento por dia (evita spam em quem recebe muito)
    const recibosDiaRef = doc(db, "recibosPontosDia", `${autorId}_${HOJE}`);
    const recibosSnap = await getDoc(recibosDiaRef);
    const totalRecebido = recibosSnap.data()?.total || 0;
    if (totalRecebido >= LIMITE_RECEBIDO_DIA) {
      alert("Este cliente já recebeu muitos pontos hoje. Tente amanhã!");
      return;
    }
    try {
      // Usa Cloud Function para atualizar rankingPts (绕过 regras de segurança)
      // Chama Cloud Function via fetch (onRequest)
      const response = await fetch(`https://us-east1-acaipedidos-f53cc.cloudfunctions.net/enviarPontosRanking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autorId, pontos: Number(pontos), comentarioId, produtoId: produto.id }),
      });
      if (!response.ok) throw new Error("Erro na function");
      // Registra envio permanente (anti-fraude)
      await setDoc(doc(db, "enviadosPontos", registroId), {
        de: user.uid,
        para: autorId,
        comentarioId,
        pontos: Number(pontos),
        data: serverTimestamp(),
      });
      // Conta envios do dia
      await setDoc(enviosDiaRef, { total: increment(Number(pontos)) }, { merge: true });
      // Conta recibos do dia
      await setDoc(recibosDiaRef, { total: increment(Number(pontos)) }, { merge: true });
      // Feedback local
      const novo = [...enviadosPontos, comentarioId];
      setEnviadosPontos(novo);
      localStorage.setItem(`enviados_${produto.id}_${user.uid}`, JSON.stringify(novo));
      setFlashId(comentarioId);
      setTimeout(() => setFlashId(null), 800);
    } catch (e) { console.warn("Erro enviar pontos:", e); alert("Erro ao enviar pontos. Tente novamente."); }
  };

  const responderUsuario = async (comentarioId) => {
    if (!textoRespostaUser.trim() || !user) return;
    try {
      await addDoc(collection(db, `produtos/${produto.id}/comentarios`), {
        texto: textoRespostaUser.trim(),
        autorId: user.uid,
        autorNome: user.displayName || user.email?.split("@")[0] || "Cliente",
        autorFoto: user.photoURL || null,
        criadoEm: serverTimestamp(),
        denuncias: 0,
        respostaAId: comentarioId,
      });
      setRespondendoUserId(null);
      setTextoRespostaUser("");
      setReplyPickerOpen(null);
    } catch (e) { console.error(e); }
  };

  const insertReplyEmoji = (emoji) => {
    setTextoRespostaUser(prev => prev + emoji);
    setReplyPickerOpen(null);
  };

  const handleTouchStart = (commentId, e) => {
    longPressTimer.current = setTimeout(() => { setPickerOpen(commentId); }, 500);
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const isMountedRef = useRef(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, `produtos/${produto.id}/comentarios`), orderBy("criadoEm", "asc")),
      snap => {
        const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const filtered = todos.filter(c => (c.denuncias || 0) < 3);
        const anteriorLen = comentarios.length;
        setComentarios(filtered);
        if (filtered.length > anteriorLen) {
          const novos = filtered.slice(anteriorLen).map(c => c.id);
          setNovosIds(prev => [...new Set([...prev, ...novos])]);
          setTimeout(() => setNovosIds(prev => prev.filter(id => !novos.includes(id))), 2000);
        }
        // Só auto-scrolla se: NÃO é primeira carga E ordenação recente E já estava no fim E vieram评论 novos
        if (!isMountedRef.current) {
          isMountedRef.current = true;
          // Na primeira carga, scrolla pro topo
          setTimeout(() => listaRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 100);
        } else if (filtered.length > anteriorLen && sortBy === "recente" && isAtBottom) {
          setTimeout(() => listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: "smooth" }), 100);
        } else if (filtered.length > anteriorLen && sortBy === "recente" && !isAtBottom) {
          setTemNovo(true);
        }
      }
    );
    // Carregar denúncias do usuário atual
    const saved = JSON.parse(localStorage.getItem(`denuncias_${produto.id}`) || "{}");
    setDenunciados(saved);
    return unsub;
  }, [produto.id]);

  // Buscar reações em tempo real
  useEffect(() => {
    if (!produto?.id) return;
    const unsub = onSnapshot(query(collection(db, `produtos/${produto.id}/reacoes`)), snap => {
      const reacoesMap = {};
      const myReacoes = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const cid = data.comentarioId;
        const emoji = data.emoji;
        const uid = data.userId;
        if (!reacoesMap[cid]) reacoesMap[cid] = {};
        if (!reacoesMap[cid][emoji]) reacoesMap[cid][emoji] = [];
        reacoesMap[cid][emoji].push(uid);
        if (uid === user?.uid) myReacoes[cid] = emoji;
      });
      setReacoes(reacoesMap);
      setUserReacoes(myReacoes);
      userReacoesRef.current = myReacoes;
    });
    return unsub;
  }, [produto.id, user?.uid]);

  // Buscar curtidas de cada comentário
  useEffect(() => {
    const unsub = onSnapshot(collection(db, `produtos/${produto.id}/curtidas`), snap => {
      const counts = {};
      const myLikes = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const cid = data.comentarioId;
        counts[cid] = (counts[cid] || 0) + 1;
        if (data.userId === user?.uid) myLikes[cid] = true;
      });
      setCurtidas(counts);
      setUserCurtidas(myLikes);
    });
    return unsub;
  }, [produto.id, user?.uid]);

  // Buscar top 10 do ranking para badges
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "users"), orderBy("rankingPts", "desc"), limit(10)), snap => {
      const lista = snap.docs.map((d, i) => ({ id: d.id, posicao: i + 1, pontos: d.data().pontos || 0, rankingPts: d.data().rankingPts || 0, ...d.data() }));
      setTopUsers(lista);
      if (lista.length > 0) setReiData(lista[0]);
    });
    return unsub;
  }, []);

  // Carregar avaliação do usuário e média do produto
  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, "avaliacoes", `${produto.id}_${user.uid}`)).then(snap => {
      if (snap.exists()) setUserRating(snap.data().estrelas);
    });
    const fetchMedias = async () => {
      try {
        const snap = await getDocs(collection(db, "avaliacoes"));
        const filtered = snap.docs.filter(d => d.data().produtoId === produto.id);
        let total = 0, count = 0;
        filtered.forEach(d => { total += d.data().estrelas; count++; });
        setMediaAvaliacao({ total, count });
      } catch (e) {
        console.warn("Erro ao buscar avaliacoes:", e);
      }
    };
    fetchMedias();
  }, [produto.id, user?.uid]);

  const handleRate = async (estrelas) => {
    if (!user?.uid) {
      alert("Faça login para avaliar!");
      return;
    }
    const ratingKey = `${produto.id}_${user.uid}`;
    const ratingData = {
      produtoId: produto.id,
      produtoNome: produto.nome,
      userId: user.uid,
      userNome: user.displayName || user.email?.split("@")[0] || "Cliente",
      estrelas,
      criadoEm: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, "avaliacoes", ratingKey), ratingData);
      setUserRating(estrelas);
      // Atualiza count imediatamente pra feedback visual
      setMediaAvaliacao(prev => ({ total: prev.total + estrelas, count: prev.count + 1 }));
    } catch (e) { console.error(e); }
  };

    const enviar = async () => {
    if ((!texto.trim() && !fotoPreview) || enviando) return;
    setEnviando(true);
    try {
      let fotoUrl = null;
      if (fotoPreview) {
        setSubindoFoto(true);
        const file = fotoPreview;
        const storageRef = ref(storage, `comentarios/${user.uid}_${Date.now()}.jpg`);
        await uploadBytes(storageRef, file);
        fotoUrl = await getDownloadURL(storageRef);
        setSubindoFoto(false);
        setFotoPreview(null);
      }
      const comentarioData = {
        texto: texto.trim() || (fotoUrl ? "📷" : ""),
        autorId: user.uid,
        autorNome: user.displayName || user.email?.split("@")[0] || "Cliente",
        autorFoto: user.photoURL || null,
        criadoEm: serverTimestamp(),
        denuncias: 0,
      };
      if (fotoUrl) comentarioData.foto = fotoUrl;
      await addDoc(collection(db, `produtos/${produto.id}/comentarios`), comentarioData);
      try {
        const incrementCounter = httpsCallable(functions, "incrementarContadorProduto");
        await incrementCounter({ produtoId: produto.id, incremento: 1 });
      } catch (e) {
        await updateDoc(doc(db, "produtos", produto.id), { comentariosCount: increment(1) });
      }
      try {
        const pts = parseInt(config.rankingPtsComentario) || 15;
        await updateDoc(doc(db, "users", user.uid), { pontos: increment(pts) });
      } catch {}
      setTexto(""); setPickerOpen(null);
    } catch (e) { console.error("Erro ao commenter:", e); }
    finally { setEnviando(false); setSubindoFoto(false); }
  };

  const deletar = async (comentario) => {
    if (comentario.autorId !== user?.uid) return;
    try {
      await deleteDoc(doc(db, `produtos/${produto.id}/comentarios`, comentario.id));
      // Decrementa contador de comentários no produto via Cloud Function
      try {
        const incrementCounter = httpsCallable(functions, "incrementarContadorProduto");
        await incrementCounter({ produtoId: produto.id, incremento: -1 });
      } catch (e) {
        console.warn("Cloud Function não disponível, usando direto:", e);
        await updateDoc(doc(db, "produtos", produto.id), { comentariosCount: increment(-1) });
      }
      setSwipeId(null);
    } catch (e) { console.error(e); }
  };

  const salvarEdicao = async (comentario) => {
    if (!editandoTexto.trim()) return;
    try {
      await updateDoc(doc(db, `produtos/${produto.id}/comentarios`, comentario.id), {
        texto: editandoTexto.trim()
      });
      setEditandoId(null);
      setEditandoTexto("");
    } catch (e) { console.error(e); }
  };

  const iniciarEdicao = (comentario) => {
    setEditandoId(comentario.id);
    setEditandoTexto(comentario.texto);
    setMenuAbertoId(null);
  };

  const denunciar = async (comentario) => {
    if (denunciados[comentario.id]) return;
    try {
      await updateDoc(doc(db, `produtos/${produto.id}/comentarios`, comentario.id), {
        denuncias: increment(1)
      });
      const novo = { ...denunciados, [comentario.id]: true };
      setDenunciados(novo);
      localStorage.setItem(`denuncias_${produto.id}`, JSON.stringify(novo));
    } catch (e) { console.error(e); }
  };

  const responderLojista = async (comentarioId) => {
    if (!textoResposta.trim()) return;
    try {
      await updateDoc(doc(db, `produtos/${produto.id}/comentarios`, comentarioId), {
        respostaLojista: textoResposta.trim(),
        respostaEm: serverTimestamp(),
      });
      setRespondendoId(null);
      setTextoResposta("");
    } catch (e) { console.error(e); }
  };

  const tempoRelativo = (ts) => {
    if (!ts?.toDate) return "";
    const diff = Math.floor((Date.now() - ts.toDate()) / 1000);
    if (diff < 60) return "agora";
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  return (
    <div onClick={() => { setSwipeId(null); setRespondendoId(null); onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 520, margin: "0 auto",
        background: "var(--bg)", borderRadius: "20px 20px 0 0",
        maxHeight: "80vh", display: "flex", flexDirection: "column",
        animation: "slideUpDrawer 0.3s ease",
      }}>
        <style>{`
  @keyframes slideUpDrawer { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes pulseCTA { 0%,100%{box-shadow:0 0 0 0 rgba(245,197,24,0.7)} 50%{box-shadow:0 0 0 6px rgba(245,197,24,0)} }
  @keyframes slideInComment { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
  @keyframes pulseAdd { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes ptsFlash {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.5); text-shadow: 0 0 12px currentColor; }
    100% { transform: scale(1); text-shadow: none; }
  }
  @keyframes lightningBorder {
    0%   { box-shadow: 1px 0 4px 0px rgba(245,197,24,0.5), inset 0 0 0 1px rgba(245,197,24,0.3); }
    25%  { box-shadow: 0 -1px 4px 0px rgba(245,197,24,0.5), inset 0 0 0 1px rgba(245,197,24,0.3); }
    50%  { box-shadow: -1px 0 4px 0px rgba(245,197,24,0.5), inset 0 0 0 1px rgba(245,197,24,0.3); }
    75%  { box-shadow: 0 1px 4px 0px rgba(245,197,24,0.5), inset 0 0 0 1px rgba(245,197,24,0.3); }
    100% { box-shadow: 1px 0 4px 0px rgba(245,197,24,0.5), inset 0 0 0 1px rgba(245,197,24,0.3); }
  }
`}</style>

        {/* Children (carrossel de emojis) */}
        {children && children}

        {/* Mini card do produto */}
        {produto && (
          <div style={{ display: "flex", gap: 10, padding: "6px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg2)", flexShrink: 0, alignItems: "center" }}>
            {produto.foto && (
              <img src={produto.foto} alt={produto.nome} onClick={() => { onClose(); navigate(`/?produto=${produto.id}`); }} style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", border: "1px solid var(--border)", flexShrink: 0, cursor: "pointer" }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{produto.nome}</div>
              {(produto.desc || produto.descricao) && <div style={{ fontSize: "0.68rem", color: "var(--text2)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{produto.desc || produto.descricao}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--gold)" }}>★ {mediaCount}</span>
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => handleRate(s)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem", padding: 0, lineHeight: 1, color: s <= userRating ? "#f5c518" : "rgba(255,255,255,0.2)" }}>★</button>
                ))}
                <span style={{ fontSize: "0.7rem", color: "var(--text3)" }}>{fmtCount}</span>
                {produto.preco && <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--green)", marginLeft: "auto" }}>R$ {Number(produto.preco).toFixed(2).replace(".", ",")}</span>}
                <button onClick={onClose} style={{ background: "var(--bg3)", border: "none", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", color: "var(--text2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", flexShrink: 0, marginLeft: 2 }}>×</button>
              </div>
              {!comentariosAtivos && <div style={{ fontSize: "0.62rem", color: "var(--red)", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 20, padding: "1px 6px", marginTop: 3, display: "inline-block" }}>Comentários desativados</div>}
            </div>
          </div>
        )}

        {/* CTA Compra + Top 3 + Cupons */}
        <div style={{ padding: "6px 16px 4px", display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          {/* Botões */}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={handleAddFly} style={{ flex: 1, padding: "7px 4px", background: "#ff6b35", border: "none", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, boxShadow: "0 4px 12px rgba(255,107,53,0.45)" }}>
              <span style={{ fontSize: "0.8rem" }}>🛒</span>
              <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#fff" }}>Add ao Carrinho</span>
            </button>
            <button onClick={() => { onClose(); navigate("/ranking"); }} style={{ flex: 1, padding: "7px 4px", background: "rgba(15,5,24,0.85)", border: "none", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, animation: "lightningBorder 1.5s linear infinite", border: "1px solid rgba(245,197,24,0.4)" }}>
              <span style={{ fontSize: "0.8rem" }}>🏆</span>
              <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#f5c518" }}>Ver Ranking</span>
            </button>
          </div>
          {/* Chat + Cupom */}
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => {
                if (!user) { onClose(); navigate("/login"); return; }
                const lojaSlug = slugParam || config?.slug || "";
                const lojaVirtualId = `loja_${lojaSlug}`;
                const chatId = [user.uid, lojaVirtualId].sort().join("__");
                onClose();
                navigate(`/chat/${chatId}`);
              }}
              style={{ flex: 1, padding: "7px 4px", background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.35)", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
            >
              <span style={{ fontSize: "0.8rem" }}>💬</span>
              <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#25D366" }}>Pedir pelo Chat</span>
            </button>
            {temCupons && (
              <button
                onClick={() => { onClose(); navigate("/cupons"); }}
                style={{ flex: 1, padding: "7px 4px", background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, boxShadow: "0 4px 12px rgba(22,163,74,0.35)" }}
              >
                <span key={fraseAtual} style={{ fontSize: "0.65rem", fontWeight: 700, color: "#fff", textAlign: "center", animation: "fadeIn 0.3s ease" }}>{fraseAtual}</span>
              </button>
            )}
          </div>

        </div>

        {/* Lista */}
        <div ref={listaRef} onScroll={() => {
          const el = listaRef.current;
          if (!el) return;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
          setIsAtBottom(atBottom);
        }} onClick={() => { setSwipeId(null); setRespondendoId(null); setMenuAbertoId(null); setPickerOpen(null); }} style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>

          {/* Rei (1º lugar) com comentário — fixo no topo */}
          {comentarioRei && (
            <div style={{ background: "linear-gradient(135deg, rgba(245,197,24,0.08), rgba(245,197,24,0.03))", border: "1px solid rgba(245,197,24,0.25)", borderRadius: 14, padding: "10px 12px", marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: "0.9rem" }}>👑</span>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--gold)" }}>{tituloRei} do Ranking</span>
                {(() => { const info = topUsers.find(u => u.id === comentarioRei?.autorId); return info ? <span style={{ fontSize: "0.6rem", color: "rgba(245,197,24,0.7)", fontWeight: 700 }}>· {Math.floor(info.pontos).toLocaleString()} pts + {Math.floor(info.rankingPts || 0).toLocaleString()} ranking</span> : null; })()}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div onClick={() => navigate(`/perfil/${comentarioRei.autorId}`)} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", border: "2px solid var(--gold)", boxShadow: "0 0 8px rgba(245,197,24,0.4)", cursor: "pointer", flexShrink: 0 }}>
                  {comentarioRei.autorFoto ? <img src={comentarioRei.autorFoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : comentarioRei.autorNome?.[0]?.toUpperCase() || "?"}
                </div>
                <div style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "4px 14px 14px 14px", padding: "6px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--purple2)" }}>{comentarioRei.autorNome}</span>
                    <span style={{ fontSize: "0.62rem", color: "var(--text3)" }}>{tempoRelativo(comentarioRei.criadoEm)}</span>
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.4 }}>{comentarioRei.texto}</div>
                </div>
              </div>
            </div>
          )}

          {listaFinal.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text3)" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>💬</div>
              <div style={{ fontSize: "0.82rem" }}>Nenhum comentário ainda</div>
            </div>
          ) : listaFinal.map(c => {
            const isMeu = c.autorId === user?.uid;
            const swipeAtivo = swipeId === c.id;
            const jaDenunciou = !!denunciados[c.id];
            return (
              <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {/* Comentário com swipe */}
                <div style={{ position: "relative", overflow: "hidden", borderRadius: 14 }}>
                  {/* Fundo deletar */}
                  {isMeu && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 12 }}>
                      <button onClick={() => deletar(c)} style={{ background: "var(--red)", border: "none", borderRadius: 8, padding: "6px 12px", color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }}>🗑️ Deletar</button>
                    </div>
                  )}
                  <div
                    style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--bg)", transform: swipeAtivo && isMeu ? "translateX(-80px)" : "translateX(0)", transition: "transform 0.25s ease" }}
                    onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
                    onTouchEnd={e => {
                      const diff = touchStartX.current - e.changedTouches[0].clientX;
                      if (diff > 60 && isMeu) setSwipeId(c.id);
                      else if (diff < -30) setSwipeId(null);
                    }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", border: `2px solid ${topUsers.find(u => u.id === c.autorId) ? "var(--gold)" : "var(--border)"}`, boxShadow: topUsers.find(u => u.id === c.autorId) ? "0 0 6px rgba(245,197,24,0.4)" : "none" }}>
                      {c.autorFoto ? <img src={c.autorFoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : c.autorNome?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "4px 14px 14px 14px", padding: "8px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span onClick={() => navigate(`/perfil/${c.autorId}`)} style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--purple2)", cursor: "pointer" }}>{c.autorNome}</span>
                        {(() => {
                          const info = topUsers.find(u => u.id === c.autorId);
                          if (!info) return null;
                          const badges = getBadges(info.posicao, info.rankingPts);
                          return (
                            <span title={`${badges[0]?.label || ""} · ${info.posicao}º`} style={{ fontSize: "0.65rem", animation: flashId === c.id ? "ptsFlash 0.6s ease" : "none" }}>{badges[0]?.emoji}</span>
                          );
                        })()}
                        {(() => {
                          const info = topUsers.find(u => u.id === c.autorId);
                          return info ? <span style={{ fontSize: "0.48rem", color: "var(--gold)", fontWeight: 700, animation: flashId === c.id ? "ptsFlash 0.6s ease" : "none" }}>{Math.floor(info.rankingPts)}</span> : null;
                        })()}
                        {!isMeu && (
                          <button onClick={() => navigate(`/perfil/${c.autorId}`)} style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.35)", borderRadius: 20, cursor: "pointer", fontSize: "0.62rem", color: "var(--green)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, padding: "2px 8px" }}>Seguir</button>
                        )}
                        {isMeu && <span style={{ fontSize: "0.58rem", color: "var(--text3)" }}>você</span>}
                        <span style={{ fontSize: "0.62rem", color: "var(--text3)" }}>{tempoRelativo(c.criadoEm)}</span>
                        {/* Denunciar — só para outros */}
                        {!isMeu && user && (
                          <button
                            onClick={() => denunciar(c)}
                            title="Denunciar comentário"
                            style={{ background: "none", border: "none", cursor: jaDenunciou ? "default" : "pointer", fontSize: "0.75rem", opacity: jaDenunciou ? 0.4 : 0.6, padding: 0, marginLeft: 4 }}
                          >🚩</button>
                        )}
                        {/* Menu 3 pontinhos — só para o autor do comentário */}
                        {isMeu && (
                          <div style={{ position: "relative", marginLeft: "auto" }}>
                            <button
                              onClick={e => { e.stopPropagation(); setMenuAbertoId(menuAbertoId === c.id ? null : c.id); }}
                              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", color: "var(--text3)", padding: "2px 4px", lineHeight: 1 }}
                            >⋮</button>
                            {menuAbertoId === c.id && (
                              <div onClick={e => e.stopPropagation()} style={{ position: "absolute", right: 0, top: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "6px 0", zIndex: 10, minWidth: 120, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                                <button onClick={() => iniciarEdicao(c)} style={{ width: "100%", padding: "6px 10px", background: "none", border: "none", cursor: "pointer", fontSize: "0.78rem", color: "var(--text)", textAlign: "left", display: "flex", alignItems: "center", gap: 6, fontFamily: "'Outfit', sans-serif" }}>✏️ Editar</button>
                                <button onClick={() => { deletar(c); setMenuAbertoId(null); }} style={{ width: "100%", padding: "6px 10px", background: "none", border: "none", cursor: "pointer", fontSize: "0.78rem", color: "var(--red)", textAlign: "left", display: "flex", alignItems: "center", gap: 6, fontFamily: "'Outfit', sans-serif" }}>🗑️ Excluir</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Campo de edição */}
                      {editandoId === c.id ? (
                        <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                          <input
                            value={editandoTexto}
                            onChange={e => setEditandoTexto(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && salvarEdicao(c)}
                            autoFocus
                            style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--purple2)", borderRadius: 12, padding: "6px 10px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", outline: "none" }}
                          />
                          <button onClick={() => salvarEdicao(c)} style={{ background: "var(--green)", border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem" }}>✓</button>
                          <button onClick={() => { setEditandoId(null); setEditandoTexto(""); }} style={{ background: "var(--bg3)", border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>×</button>
                        </div>
                      ) : (
                        <div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.5 }}>{c.texto}</div>
                        {c.foto && (
                          <img src={c.foto} alt="" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8, marginTop: 6, border: "1px solid var(--border)" }} onClick={() => window.open(c.foto, "_blank")} />
                        )}
                        </div>
                      )}

                      {/* Reações emoji + curtida + long press picker */}
                      <div
                        onTouchStart={e => handleTouchStart(c.id, e)}
                        onTouchEnd={handleTouchEnd}
                        onMouseDown={e => handleTouchStart(c.id, e)}
                        onMouseUp={handleTouchEnd}
                        style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, flexWrap: "wrap" }}
                      >
                        {/* Emojis */}
                        {EMOJIS.map(emoji => {
                          const count = reacoes[c.id]?.[emoji]?.length || 0;
                          const jaDeu = userReacoes[c.id] === emoji;
                          if (count === 0 && !jaDeu) return null;
                          return (
                            <button
                              key={emoji}
                              onClick={e => { e.stopPropagation(); reactToComment(c.id, emoji); }}
                              style={{ background: jaDeu ? "rgba(245,197,24,0.15)" : "none", border: `1px solid ${jaDeu ? "#f5c518" : "var(--border)"}`, borderRadius: 20, cursor: "pointer", display: "flex", alignItems: "center", gap: 2, fontSize: "0.72rem", color: "var(--text)", padding: "2px 7px", transition: "all 0.15s" }}
                            >
                              {emoji} {count > 0 && <span style={{ fontSize: "0.62rem", fontWeight: 700, color: jaDeu ? "#f5c518" : "var(--text3)" }}>{count}</span>}
                            </button>
                          );
                        })}
                        <button
                          onClick={e => { e.stopPropagation(); setPickerOpen(pickerOpen === c.id ? null : c.id); }}
                          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 20, cursor: "pointer", display: "flex", alignItems: "center", fontSize: "0.65rem", color: "var(--text3)", padding: "2px 6px" }}
                        >🚀 {c.rocketsCount > 0 ? c.rocketsCount : ""}</button>
                        {/* Curtir ❤️ — Instagram style, vazado, à direita */}
                        <button
                          onClick={e => { e.stopPropagation(); handleCurtir(c.id); }}
                          style={{ background: "none", border: "none", borderRadius: 20, cursor: "pointer", display: "flex", alignItems: "center", gap: 3, padding: "2px 6px", transition: "all 0.15s" }}
                        >
                          <span style={{ fontSize: "1.1rem", color: userCurtidas[c.id] ? "#ef4444" : "rgba(255,255,255,0.3)" }}>{userCurtidas[c.id] ? "❤️" : "♡"}</span>
                          {curtidas[c.id] > 0 && <span style={{ fontSize: "0.65rem", fontWeight: 700, color: userCurtidas[c.id] ? "#ef4444" : "rgba(255,255,255,0.45)" }}>{curtidas[c.id]}</span>}
                        </button>
                        {c.foto ? (
                          <button
                            onClick={e => { e.stopPropagation(); compartilharFoto(c); }}
                            title="Compartilhar foto"
                            style={{ background: "none", border: "none", borderRadius: 20, cursor: "pointer", display: "flex", alignItems: "center", gap: 3, padding: "2px 6px", transition: "all 0.15s" }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9 22 2Z"/></svg>
                          </button>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); compartilharTexto(c); }}
                            title="Compartilhar"
                            style={{ background: "none", border: "none", borderRadius: 20, cursor: "pointer", display: "flex", alignItems: "center", gap: 3, padding: "2px 6px", transition: "all 0.15s" }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9 22 2Z"/></svg>
                          </button>
                        )}
                      </div>
                      {pickerOpen === c.id && (
                        <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 6 }}>
                          {PONTOS_ROCKS.map((r, i) => {
                            const jaEnviou = enviadosPontos.includes(c.id);
                            const cores = ["#f5c518", "#34d399", "#a78bfa"];
                            return (
                              <button
                                key={i}
                                onClick={e => { e.stopPropagation(); setPickerOpen(null); enviarPontos(c.id, c.autorId, r.pontos); }}
                                disabled={jaEnviou}
                                style={{ background: jaEnviou ? "rgba(255,255,255,0.04)" : `${cores[i]}22`, border: `1px solid ${cores[i]}66`, borderRadius: 10, cursor: jaEnviou ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 2, padding: "4px 8px", opacity: jaEnviou ? 0.45 : 1 }}
                              >
                                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: cores[i] }}>+{r.pontos} pts</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {/* Botão responder — lojista E usuários */}
                      {!isMeu && user && (
                        <button
                          onClick={e => { e.stopPropagation(); setRespondendoUserId(c.id); setTextoRespostaUser(""); }}
                          style={{ marginTop: 6, background: "none", border: "none", cursor: "pointer", fontSize: "0.7rem", color: "var(--purple2)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, padding: 0 }}
                        >↩ Responder</button>
                      )}
                      {isAdmin && !c.respostaLojista && (
                        <button
                          onClick={e => { e.stopPropagation(); setRespondendoId(c.id); setTextoResposta(""); }}
                          style={{ marginTop: 6, background: "rgba(138,92,246,0.1)", border: "1px solid rgba(138,92,246,0.3)", borderRadius: 20, cursor: "pointer", fontSize: "0.68rem", color: "var(--purple2)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, padding: "2px 8px" }}
                        >🏪 Responder</button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Campo de resposta do lojista */}
                {isAdmin && respondendoId === c.id && (
                  <div onClick={e => e.stopPropagation()} style={{ marginLeft: 44, display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      value={textoResposta}
                      onChange={e => setTextoResposta(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && responderLojista(c.id)}
                      placeholder="Resposta da loja..."
                      autoFocus
                      style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--purple2)", borderRadius: 20, padding: "7px 14px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", outline: "none" }}
                    />
                    <button onClick={() => responderLojista(c.id)} style={{ background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                    <button onClick={() => setRespondendoId(null)} style={{ background: "var(--bg3)", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "var(--text2)", fontSize: "0.9rem" }}>×</button>
                  </div>
                )}

                {/* Campo de resposta de usuário */}
                {respondendoUserId === c.id && (
                  <div onClick={e => e.stopPropagation()} style={{ marginLeft: 44, position: "relative" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        value={textoRespostaUser}
                        onChange={e => setTextoRespostaUser(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && responderUsuario(c.id)}
                        placeholder={`Respondendo a ${c.autorNome}...`}
                        autoFocus
                        style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--purple2)", borderRadius: 20, padding: "7px 14px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", outline: "none" }}
                      />
                      <button
                        onClick={e => { e.stopPropagation(); setReplyPickerOpen(replyPickerOpen === c.id ? null : c.id); }}
                        style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg2)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}
                      >😋</button>
                      <button onClick={() => responderUsuario(c.id)} style={{ background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      </button>
                      <button onClick={() => setRespondendoUserId(null)} style={{ background: "var(--bg3)", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "var(--text2)", fontSize: "0.9rem", flexShrink: 0 }}>×</button>
                    </div>
                    {replyPickerOpen === c.id && (
                      <div style={{ position: "absolute", bottom: "100%", left: 0, marginBottom: 6, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "6px 8px", display: "flex", gap: 2, flexWrap: "wrap", maxWidth: 200, boxShadow: "0 4px 16px rgba(0,0,0,0.3)", zIndex: 99 }}>
                        {EMOJIS.map(emoji => (
                          <button key={emoji} onPointerDown={e => { e.stopPropagation(); insertReplyEmoji(emoji); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", padding: "2px 3px", borderRadius: 6 }}>{emoji}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Resposta do lojista */}
                {c.respostaLojista && (
                  <div style={{ marginLeft: 44, background: "rgba(138,92,246,0.08)", border: "1px solid rgba(138,92,246,0.2)", borderRadius: "4px 14px 14px 14px", padding: "8px 12px" }}>
                    <div style={{ fontSize: "0.68rem", color: "var(--purple2)", fontWeight: 700, marginBottom: 4 }}>🏪 Resposta da loja · {tempoRelativo(c.respostaEm)}</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text2)", lineHeight: 1.5 }}>{c.respostaLojista}</div>
                    {isAdmin && (
                      <button onClick={() => { setRespondendoId(c.id); setTextoResposta(c.respostaLojista); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.68rem", color: "var(--text3)", padding: 0, marginTop: 4 }}>✏️ Editar resposta</button>
                    )}
                  </div>
                )}

                {/* Replies (threads) */}
                {repliesPorPai[c.id]?.length > 0 && (
                  <div style={{ marginLeft: 36, marginTop: 6 }}>
                    {repliesPorPai[c.id].slice(0, repliesExpanded[c.id] ? undefined : 2).map(reply => (
                      <div key={reply.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 4 }}>
                        <div onClick={() => navigate(`/perfil/${reply.autorId}`)} style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--surface)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", border: "1px solid var(--border)", cursor: "pointer", flexShrink: 0 }}>
                          {reply.autorFoto ? <img src={reply.autorFoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : reply.autorNome?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "4px 14px 14px 14px", padding: "6px 10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2, flexWrap: "wrap" }}>
                            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--purple2)" }}>{reply.autorNome}</span>
                            <span style={{ fontSize: "0.6rem", color: "var(--text3)" }}>{tempoRelativo(reply.criadoEm)}</span>
                          </div>
                          <div style={{ fontSize: "0.82rem", color: "var(--text)", lineHeight: 1.4 }}>{reply.texto}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 5, flexWrap: "wrap" }}>
                            {EMOJIS.map(emoji => {
                              const count = reacoes[reply.id]?.[emoji]?.length || 0;
                              const jaDeu = userReacoes[reply.id] === emoji;
                              if (count === 0 && !jaDeu) return null;
                              return (
                                <button
                                  key={emoji}
                                  onClick={e => { e.stopPropagation(); reactToComment(reply.id, emoji); }}
                                  style={{ background: jaDeu ? "rgba(245,197,24,0.15)" : "none", border: `1px solid ${jaDeu ? "#f5c518" : "var(--border)"}`, borderRadius: 20, cursor: "pointer", display: "flex", alignItems: "center", gap: 2, fontSize: "0.68rem", color: "var(--text)", padding: "1px 6px", transition: "all 0.15s" }}
                                >
                                  {emoji} {count > 0 && <span style={{ fontSize: "0.6rem", fontWeight: 700, color: jaDeu ? "#f5c518" : "var(--text3)" }}>{count}</span>}
                                </button>
                              );
                            })}
                            {/* Curtir reply */}
                            <button
                              onClick={e => { e.stopPropagation(); handleCurtir(reply.id); }}
                              style={{ background: "none", border: "none", borderRadius: 20, cursor: "pointer", display: "flex", alignItems: "center", gap: 2, padding: "1px 5px" }}
                            >
                              <span style={{ fontSize: "0.95rem", color: userCurtidas[reply.id] ? "#ef4444" : "rgba(255,255,255,0.3)" }}>{userCurtidas[reply.id] ? "❤️" : "♡"}</span>
                              {curtidas[reply.id] > 0 && <span style={{ fontSize: "0.6rem", fontWeight: 700, color: userCurtidas[reply.id] ? "#ef4444" : "rgba(255,255,255,0.45)" }}>{curtidas[reply.id]}</span>}
                            </button>
                            {/* Compartilhar reply */}
                            <button
                              onClick={e => { e.stopPropagation(); compartilharTexto(reply); }}
                              style={{ background: "none", border: "none", borderRadius: 20, cursor: "pointer", display: "flex", alignItems: "center", padding: "1px 5px" }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9 22 2Z"/></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {repliesPorPai[c.id].length > 2 && (
                      <button
                        onClick={() => setRepliesExpanded(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.72rem", color: "var(--purple2)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, padding: "2px 0" }}
                      >
                        {repliesExpanded[c.id] ? "↑ Ver menos" : `Ver todas as ${repliesPorPai[c.id].length} respostas`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Campo de comentário */}
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", flexShrink: 0, paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}>
          {!comentariosAtivos && !isAdmin ? (
            <div style={{ textAlign: "center", padding: "8px 0", fontSize: "0.82rem", color: "var(--text3)" }}>
              💬 Comentários desativados pelo lojista
            </div>
          ) : user ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Preview da foto — aparece acima da linha de input */}
              {fotoPreview && (
                <div style={{ position: "relative", display: "inline-block", maxWidth: 200 }}>
                  <img src={URL.createObjectURL(fotoPreview)} alt="Preview" style={{ width: "100%", maxHeight: 120, borderRadius: 12, objectFit: "cover", border: "1px solid var(--border)" }} />
                  <button onClick={() => setFotoPreview(null)} style={{ position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: "50%", background: "var(--red)", border: "none", color: "#fff", fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  {subindoFoto && <span style={{ position: "absolute", bottom: 4, left: 4, fontSize: "0.7rem", background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 8, padding: "2px 6px" }}>⬆️ Enviando...</span>}
                </div>
              )}
              {/* Linha de input */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", position: "relative" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", border: "1px solid var(--border)" }}>
                  {user?.photoURL ? <img src={user.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : user?.displayName?.[0]?.toUpperCase() || "?"}
                </div>
                <input
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && enviar()}
                  placeholder={comentariosAtivos ? "Escreva um comentário..." : "Comentários desativados..."}
                  disabled={!comentariosAtivos}
                  style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 20, padding: "8px 14px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem", outline: "none", opacity: comentariosAtivos ? 1 : 0.5 }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Anexar foto"
                  style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg2)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.1rem" }}
                >📷</button>
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={e => {
                  const file = e.target.files[0];
                  if (file) setFotoPreview(file);
                  e.target.value = "";
                }} />
                <button
                  onClick={() => setPickerOpen(pickerOpen === "__textarea__" ? null : "__textarea__")}
                  style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg2)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.1rem" }}
                >😋</button>
                <button
                  onClick={enviar}
                  disabled={(!texto.trim() && !fotoPreview) || enviando || !comentariosAtivos}
                  style={{ width: 36, height: 36, borderRadius: "50%", background: (texto.trim() || fotoPreview) && comentariosAtivos ? "linear-gradient(135deg, var(--purple2), var(--purple))" : "var(--bg3)", border: "none", cursor: (texto.trim() || fotoPreview) && comentariosAtivos ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
                {pickerOpen === "__textarea__" && (
                  <div style={{ position: "absolute", bottom: "100%", right: 16, marginBottom: 8, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: "8px 10px", display: "flex", gap: 2, flexWrap: "wrap", maxWidth: 220, boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 999 }}>
                    {EMOJIS.map(emoji => (
                      <button key={emoji} onClick={() => { setTexto(t => t + emoji); setPickerOpen(null); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.4rem", padding: "3px 4px", borderRadius: 8 }}>{emoji}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => { onClose(); navigate("/login"); }}
              style={{ width: "100%", padding: "10px", background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: 20, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.88rem", cursor: "pointer" }}
            >
              🔑 Entre para comentar
            </button>
          )}
        </div>

        {/* Fly to cart animation */}
        {flyAnim && flyAnim.fotoSrc && (
          <img
            src={flyAnim.fotoSrc}
            alt=""
            style={{
              position: "fixed",
              zIndex: 9999,
              width: 40,
              height: 40,
              borderRadius: 8,
              objectFit: "cover",
              left: flyAnim.x,
              top: flyAnim.y,
              transform: `scale(${flyAnim.scale || 1})`,
              opacity: flyAnim.opacity !== undefined ? flyAnim.opacity : 1,
              transition: "none",
              pointerEvents: "none",
              boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            }}
          />
        )}
      </div>
    </div>
  );
}
