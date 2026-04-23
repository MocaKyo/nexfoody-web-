// src/components/ModalProduto.js
import React, { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, getDocs, doc, setDoc, increment } from "firebase/firestore";
import { db } from "../lib/firebase";
import { AvaliacaoProduto } from "./Avaliacoes";
import { useStore } from "../contexts/StoreContext";
import { useTenant } from "../contexts/TenantContext";

export default function ModalProduto({ produto, onClose, onAdd, isAberto, complementosIniciais = [], stats = {}, isFav = false, onToggleFav, isCatalogo = false, whatsapp = "", onAddWithComplementos }) {
  const { cartExtras, removeFromExtras } = useStore();
  const { tenantId } = useTenant();
  const prodPath = tenantId ? `tenants/${tenantId}/produtos/${produto.id}` : `produtos/${produto.id}`;
  const itemNoCarrinho = cartExtras?.find(i => i.produtoId === produto?.id || i.id === produto?.id);
  const complementosExistentes = complementosIniciais?.length > 0
    ? complementosIniciais
    : itemNoCarrinho?.complementos || [];

  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selecoes, setSelecoes] = useState({});
  const [passoAtual, setPassoAtual] = useState(0);
  const [precoTotal, setPrecoTotal] = useState(produto?.preco || 0);
  const [lastTap, setLastTap] = useState(0);
  const [fotoAtual, setFotoAtual] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(stats.likes || 0);
  const carrosselRefs = useRef({});
  const barraRefs = useRef({});
  const touchStartX = useRef(0);

  // Carrossel apenas com fotos do produto (até 4)
  const todasFotos = [produto.foto, ...(produto.fotos || [])].filter(Boolean).slice(0, 4);

  // Inicializar likes do localStorage
  useEffect(() => {
    const likedKey = `liked_${produto.id}`;
    setLiked(!!localStorage.getItem(likedKey));
    setLikeCount(stats.likes || 0);
  }, [produto.id, stats.likes]);

  const toggleLike = async (e) => {
    e.stopPropagation();
    const likedKey = `liked_${produto.id}`;
    const jaLiked = !!localStorage.getItem(likedKey);
    if (jaLiked) {
      localStorage.removeItem(likedKey);
      setLiked(false);
      setLikeCount(c => Math.max(0, c - 1));
    } else {
      localStorage.setItem(likedKey, "1");
      setLiked(true);
      setLikeCount(c => c + 1);
    }
    try {
      await setDoc(doc(db, `${prodPath}/stats`, "geral"), {
        likes: increment(jaLiked ? -1 : 1)
      }, { merge: true });
    } catch {}
  };

  useEffect(() => {
    if (!produto?.id) return;
    const carregar = async () => {
      try {
        const gruposSnap = await getDocs(query(collection(db, `${prodPath}/grupos_complementos`), orderBy("ordem", "asc")));
        const gs = await Promise.all(gruposSnap.docs.map(async gDoc => {
          const itensSnap = await getDocs(query(collection(db, `${prodPath}/grupos_complementos/${gDoc.id}/itens`), orderBy("ordem", "asc")));
          return { id: gDoc.id, ...gDoc.data(), itens: itensSnap.docs.map(d => ({ id: d.id, ...d.data() })) };
        }));
        setGrupos(gs);
        const init = {};
        gs.forEach(g => { init[g.id] = []; });
        if (complementosIniciais?.length > 0) {
          gs.forEach(g => {
            const itensDeste = complementosIniciais.filter(c => g.itens?.some(i => i.id === c.id || i.nome === c.nome));
            if (itensDeste.length > 0) {
              init[g.id] = itensDeste.map(c => g.itens?.find(i => i.id === c.id || i.nome === c.nome) || c);
            }
          });
        }
        setSelecoes(init);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    carregar();
  }, [produto?.id]);

  useEffect(() => {
    if (!grupos.length) return;
    setSelecoes(() => {
      const novo = {};
      grupos.forEach(g => { novo[g.id] = []; });
      if (complementosExistentes?.length > 0) {
        grupos.forEach(g => {
          const match = complementosExistentes.filter(c => g.itens?.some(i => i.id === c.id || i.nome === c.nome));
          if (match.length > 0) novo[g.id] = match.map(c => g.itens?.find(i => i.id === c.id || i.nome === c.nome) || c);
        });
      }
      return novo;
    });
  }, [grupos]);

  useEffect(() => {
    let extra = 0;
    Object.values(selecoes).flat().forEach(item => { extra += item.preco || 0; });
    setPrecoTotal(produto.preco + extra);
  }, [selecoes, produto.preco]);

  const selecionarItem = (grupo, item) => {
    const maxNum = parseInt(grupo.max) || 1;
    setSelecoes(prev => {
      const atual = prev[grupo.id] || [];
      const jaSelected = atual.find(i => i.id === item.id);
      if (jaSelected) return { ...prev, [grupo.id]: atual.filter(i => i.id !== item.id) };
      if (maxNum === 1) return { ...prev, [grupo.id]: [item] };
      if (atual.length >= maxNum) return prev;
      return { ...prev, [grupo.id]: [...atual, item] };
    });
  };

  const validarObrigatorios = () => grupos.every(g => {
    if (!g.obrigatorio) return true;
    return (selecoes[g.id] || []).length >= g.min;
  });

  const handleDoubleTap = (e) => {
    const agora = Date.now();
    if (agora - lastTap < 300) toggleLike(e);
    setLastTap(agora);
  };

  const handleAdd = () => {
    if (!validarObrigatorios()) return;
    const complementosSelecionados = Object.entries(selecoes).flatMap(([grupoId, itens]) => {
      const grupo = grupos.find(g => g.id === grupoId);
      return itens.map(i => ({ ...i, grupoNome: grupo?.nome }));
    });
    if (itemNoCarrinho) removeFromExtras(itemNoCarrinho.itemId);
    onAdd(produto, complementosSelecionados, precoTotal);
    if (onAddWithComplementos) onAddWithComplementos(produto, complementosSelecionados);
  };

  const compartilhar = (e) => {
    e.stopPropagation();
    const txt = `🍓 *${produto.nome}*${produto.desc ? `\n${produto.desc}` : ""}\n💰 R$${produto.preco.toFixed(2).replace(".", ",")}\n\n🔗 https://acaipurogosto.com.br`;
    if (navigator.share) navigator.share({ title: produto.nome, text: txt });
    else window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  const obrigatoriosPendentes = grupos.filter(g => g.obrigatorio && (selecoes[g.id]?.length || 0) < g.min);
  const podeAdicionar = validarObrigatorios() && isAberto;

  // Estilo padrão dos botões laterais
  const btnLateral = (extra = {}) => ({
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 10,
    width: 36,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    padding: "6px 0",
    ...extra,
  });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 520, margin: "0 auto",
        background: "var(--bg)", borderRadius: "20px 20px 0 0",
        maxHeight: "92vh", overflowY: "auto", paddingBottom: 120,
      }}>
        {/* CARROSSEL DE FOTOS */}
        <div style={{ position: "relative" }}>
          <div
            style={{ overflow: "hidden", borderRadius: "20px 20px 0 0" }}
            onClick={handleDoubleTap}
            onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={e => {
              const diff = touchStartX.current - e.changedTouches[0].clientX;
              if (Math.abs(diff) > 50) {
                if (diff > 0 && fotoAtual < todasFotos.length - 1) setFotoAtual(f => f + 1);
                else if (diff < 0 && fotoAtual > 0) setFotoAtual(f => f - 1);
              }
            }}
          >
            <div style={{ display: "flex", transition: "transform 0.35s ease", transform: `translateX(-${fotoAtual * 100}%)` }}>
              {todasFotos.length > 0 ? todasFotos.map((foto, fi) => (
                <img key={fi} src={foto} alt={produto.nome} style={{ width: "100%", height: 260, objectFit: "cover", flexShrink: 0 }} />
              )) : (
                <div style={{ width: "100%", height: 200, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "5rem", flexShrink: 0, borderRadius: "20px 20px 0 0" }}>{produto.emoji || "🫐"}</div>
              )}
            </div>
          </div>

          {/* Overlay gradiente */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 35%, rgba(10,4,20,0.75) 70%, rgba(10,4,20,0.95) 100%)", borderRadius: "20px 20px 0 0", pointerEvents: "none" }} />

          {/* Botão fechar — mesmo estilo das setas < > */}
          <button onClick={onClose} style={{ position: "absolute", top: 10, left: 10, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", zIndex: 20, padding: 0 }}>
            <span style={{ lineHeight: 1 }}>&lt;</span>
          </button>

          {/* Coluna direita: ❤️ like | 🔖 favorito | 🔗 compartilhar */}
          <div style={{ position: "absolute", top: 10, right: 8, display: "flex", flexDirection: "column", gap: 5, alignItems: "center", zIndex: 20 }}>

            {/* ❤️ Like com contador */}
            <button onClick={toggleLike} style={btnLateral({ border: `1.5px solid ${liked ? "rgba(239,68,68,0.7)" : "rgba(255,255,255,0.25)"}`, transition: "all 0.2s", transform: liked ? "scale(1.05)" : "scale(1)" })}>
              <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>{liked ? "❤️" : "🤍"}</span>
              {likeCount > 0 && <span style={{ fontSize: "0.58rem", color: liked ? "#fca5a5" : "rgba(255,255,255,0.75)", fontWeight: 700, lineHeight: 1 }}>{likeCount}</span>}
            </button>

            {/* 🔖 Favorito estilo Instagram */}
            <button onClick={e => { e.stopPropagation(); onToggleFav && onToggleFav(e); }} style={btnLateral({ border: `1.5px solid ${isFav ? "rgba(245,197,24,0.7)" : "rgba(255,255,255,0.25)"}`, transition: "all 0.2s" })}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={isFav ? "#f5c518" : "none"} stroke={isFav ? "#f5c518" : "rgba(255,255,255,0.85)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              {stats.favoritos > 0 && <span style={{ fontSize: "0.58rem", color: isFav ? "#f5c518" : "rgba(255,255,255,0.75)", fontWeight: 700, lineHeight: 1 }}>{stats.favoritos}</span>}
            </button>

            {/* 🔥 Pedidos semana */}
            {stats.pedidosSemana > 0 ? (
              <div style={btnLateral({ border: "1.5px solid rgba(255,149,0,0.4)" })}>
                <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>🔥</span>
                <span style={{ fontSize: "0.55rem", color: "#ff9500", fontWeight: 700, lineHeight: 1 }}>{stats.pedidosSemana}/sem</span>
              </div>
            ) : (
              <div style={btnLateral({ border: "1.5px solid rgba(96,165,250,0.35)" })}>
                <span style={{ fontSize: "0.95rem", lineHeight: 1 }}>✨</span>
                <span style={{ fontSize: "0.52rem", color: "#60a5fa", fontWeight: 700, lineHeight: 1 }}>Novo</span>
              </div>
            )}

            {/* 🔗 Compartilhar */}
            <button onClick={compartilhar} style={btnLateral()}>
              <span style={{ fontSize: "1.15rem", lineHeight: 1 }}>🔗</span>
            </button>
          </div>

          {/* Setas < > carrossel — alinhadas com o título */}
          {todasFotos.length > 1 && (
            <div style={{ position: "absolute", bottom: 14, right: 8, display: "flex", gap: 5, zIndex: 10 }}>
              <button onClick={e => { e.stopPropagation(); setFotoAtual(f => Math.max(0, f - 1)); }} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", padding: 0, opacity: fotoAtual === 0 ? 0.35 : 1, transition: "opacity 0.2s" }}>
                <span style={{ lineHeight: 1 }}>&lt;</span>
              </button>
              <button onClick={e => { e.stopPropagation(); setFotoAtual(f => Math.min(todasFotos.length - 1, f + 1)); }} style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", padding: 0, opacity: fotoAtual === todasFotos.length - 1 ? 0.35 : 1, transition: "opacity 0.2s" }}>
                <span style={{ lineHeight: 1 }}>&gt;</span>
              </button>
            </div>
          )}

          {/* Nome e preço — baixo para dar destaque à foto */}
          <div style={{ position: "absolute", bottom: 10, left: 14, right: 80 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", fontWeight: 700, color: "#fff" }}>{produto.nome}</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 900, color: "#f5c518", marginTop: 2 }}>R$ {precoTotal.toFixed(2).replace(".", ",")}</div>
          </div>
        </div>

        {produto.desc && <p style={{ fontSize: "0.85rem", color: "var(--text2)", padding: "8px 16px 0", lineHeight: 1.6 }}>{produto.desc}</p>}

        {/* Esgotado */}
        {produto.controlarEstoque === true && produto.estoque !== null && Number(produto.estoque) <= 0 && (
          <div style={{ margin: "8px 16px 0", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "8px 14px", fontSize: "0.82rem", color: "var(--red)", fontWeight: 600, textAlign: "center" }}>
            😔 Produto esgotado no momento
          </div>
        )}

        {/* Grupos de complementos */}
        {loading ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text2)" }}>Carregando opções...</div>
        ) : grupos.length > 0 ? (
          <div style={{ padding: "12px 0" }}>
            {/* STEPPER */}
            <div style={{ padding: "12px 16px 4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 10 }}>
                {grupos.map((g, i) => {
                  const sel = selecoes[g.id]?.length || 0;
                  const completo = g.obrigatorio ? sel >= g.min : sel > 0;
                  const ativo = passoAtual === i;
                  return (
                    <React.Fragment key={g.id}>
                      <div onClick={() => setPassoAtual(i)} style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", gap: 4, flexShrink: 0 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: completo ? "linear-gradient(135deg, #22c55e, #15803d)" : ativo ? "linear-gradient(135deg, var(--gold), #e6a817)" : "var(--bg3)", border: `2px solid ${completo ? "#22c55e" : ativo ? "var(--gold)" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: completo ? "0.85rem" : "0.72rem", fontWeight: 900, color: completo || ativo ? "#fff" : "var(--text3)", boxShadow: ativo ? "0 0 12px rgba(245,197,24,0.5)" : completo ? "0 0 8px rgba(34,197,94,0.4)" : "none", transition: "all 0.3s" }}>{completo ? "✓" : i + 1}</div>
                        <div style={{ fontSize: "0.6rem", color: completo ? "var(--green)" : ativo ? "var(--gold)" : "var(--text3)", fontWeight: 600, maxWidth: 60, textAlign: "center", lineHeight: 1.2 }}>{g.nome}</div>
                      </div>
                      {i < grupos.length - 1 && (
                        <div style={{ flex: 1, height: 3, margin: "0 4px", marginBottom: 16, background: completo ? "linear-gradient(90deg, #22c55e, #15803d)" : "rgba(255,255,255,0.1)", borderRadius: 2, transition: "background 0.4s" }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {grupos.map((grupo, gi) => {
              const sel = selecoes[grupo.id] || [];
              const maxNum = parseInt(grupo.max) || 1;
              const atingiuMax = sel.length >= maxNum;
              const bloqueado = gi > 0 && grupos[gi - 1].obrigatorio && (selecoes[grupos[gi - 1].id]?.length || 0) < grupos[gi - 1].min;
              return (
                <div key={grupo.id} style={{ marginBottom: 20, opacity: bloqueado ? 0.4 : 1, transition: "opacity 0.3s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>{grupo.nome}</div>
                      <div style={{ fontSize: "0.72rem", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ background: grupo.obrigatorio ? "rgba(245,197,24,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${grupo.obrigatorio ? "rgba(245,197,24,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 20, padding: "2px 8px", color: grupo.obrigatorio ? "var(--gold)" : "var(--text3)", fontWeight: 700 }}>{grupo.obrigatorio ? "✨ Obrigatório" : "⬜ Opcional"}</span>
                        <span style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 20, padding: "2px 8px", color: "#60a5fa", fontWeight: 700 }}>Máx. {maxNum}</span>
                      </div>
                    </div>
                    {/* Barra de limite — APENAS nos complementos, nunca na imagem */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                      <div style={{ display: "flex", gap: 3 }}>
                        {Array.from({ length: Math.min(maxNum, 8) }).map((_, i) => (
                          <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: i < sel.length ? "linear-gradient(135deg, var(--gold), #e6a817)" : "var(--bg3)", border: `1px solid ${i < sel.length ? "var(--gold)" : "var(--border)"}`, transition: "all 0.2s", boxShadow: i < sel.length ? "0 0 6px rgba(245,197,24,0.5)" : "none" }} />
                        ))}
                      </div>
                      <div style={{ fontSize: "0.6rem", color: atingiuMax ? "var(--gold)" : "var(--text3)", fontWeight: 700 }}>{sel.length}/{maxNum}</div>
                    </div>
                  </div>

                  <div ref={el => carrosselRefs.current[grupo.id] = el} onScroll={e => { const c = e.target; const b = barraRefs.current[grupo.id]; if (b) { const r = c.scrollLeft / (c.scrollWidth - c.clientWidth); b.scrollLeft = r * (b.scrollWidth - b.clientWidth); } }} style={{ overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                    <div style={{ display: "flex", gap: 10, padding: "0 16px", width: "max-content" }}>
                      {grupo.itens?.map(item => {
                        const selecionado = sel.find(i => i.id === item.id);
                        const bloqueadoMax = atingiuMax && !selecionado;
                        return (
                          <div key={item.id} onClick={() => { if (bloqueado) return; if (bloqueadoMax) { window.dispatchEvent(new CustomEvent("toast", { detail: { msg: `Máximo de ${maxNum} ${maxNum === 1 ? "item" : "itens"}!`, type: "error" } })); return; } selecionarItem(grupo, item); if (gi < grupos.length - 1 && maxNum === 1) setPassoAtual(gi + 1); }} style={{ width: 110, flexShrink: 0, cursor: bloqueado ? "not-allowed" : "pointer", background: selecionado ? "rgba(245,197,24,0.12)" : "var(--bg2)", border: `2px solid ${selecionado ? "var(--gold)" : "var(--border)"}`, borderRadius: 14, overflow: "hidden", transition: "all 0.2s", transform: selecionado ? "scale(1.03)" : "scale(1)" }}>
                            <div style={{ height: 80, background: "var(--bg3)", position: "relative" }}>
                              {item.foto ? <img src={item.foto} alt={item.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>🫐</div>}
                              <div style={{ position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: parseInt(grupo.max) > 1 ? 4 : "50%", background: selecionado ? "var(--gold)" : "rgba(0,0,0,0.5)", border: `2px solid ${selecionado ? "var(--gold)" : "rgba(255,255,255,0.4)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", color: "var(--bg)", fontWeight: 900, transition: "all 0.2s" }}>{selecionado ? "✓" : ""}</div>
                            </div>
                            <div style={{ padding: "6px 8px 8px" }}>
                              <div style={{ fontSize: "0.75rem", fontWeight: 600, lineHeight: 1.2, color: selecionado ? "var(--gold)" : "var(--text)" }}>{item.nome}</div>
                              {item.preco > 0 && <div style={{ fontSize: "0.65rem", color: "var(--gold)", marginTop: 2 }}>+R$ {item.preco.toFixed(2).replace(".", ",")}</div>}
                              {item.preco === 0 && <div style={{ fontSize: "0.65rem", color: "var(--text3)", marginTop: 2 }}>Incluso</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {grupo.itens?.length > 2 && (
                      <div style={{ padding: "6px 16px 0" }}>
                        <style>{`.barra-compl-scroll::-webkit-scrollbar{display:none}.barra-compl-scroll{-ms-overflow-style:none;scrollbar-width:none}`}</style>
                        <div ref={el => barraRefs.current[grupo.id] = el} className="barra-compl-scroll" onScroll={e => { const b = e.target; const c = carrosselRefs.current[grupo.id]; if (c) { const r = b.scrollLeft / Math.max(1, b.scrollWidth - b.clientWidth); c.scrollLeft = r * (c.scrollWidth - c.clientWidth); } }} style={{ display: "flex", gap: 4, overflowX: "scroll", cursor: "grab", paddingBottom: 2, marginBottom: 2, touchAction: "pan-x" }}>
                          {grupo.itens.map((item, ii) => {
                            const isSel = (selecoes[grupo.id] || []).find(s => s.id === item.id);
                            return <div key={ii} onClick={() => { const c = carrosselRefs.current[grupo.id]; if (c) { const el = c.children[ii]; if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }); } }} style={{ height: 6, minWidth: 40, flex: 1, maxWidth: 60, background: isSel ? "linear-gradient(90deg, var(--gold), #e6a817)" : "rgba(255,255,255,0.15)", borderRadius: 3, transition: "all 0.3s", flexShrink: 0, boxShadow: isSel ? "0 0 8px rgba(245,197,24,0.4)" : "none", cursor: "pointer" }} />;
                          })}
                        </div>
                        <div style={{ textAlign: "center", fontSize: "0.62rem", color: "var(--text3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><span>←</span> Arraste para ver mais <span>→</span></div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <div style={{ padding: "0 16px 16px" }}>
          <AvaliacaoProduto produtoId={produto.id} produtoNome={produto.nome} />
        </div>

        {/* Botão adicionar (delivery) ou WhatsApp (catálogo) */}
        <div style={{ position: "fixed", bottom: 60, left: 0, right: 0, maxWidth: 520, margin: "0 auto", padding: "10px 16px", background: "var(--bg)", borderTop: "1px solid var(--border)", zIndex: 10 }}>
          {isCatalogo ? (
            whatsapp ? (
              <a
                href={`https://wa.me/55${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Tenho interesse no produto: ${produto.nome} (R$ ${(produto.preco ?? 0).toFixed(2).replace(".", ",")})`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ width: "100%", padding: "14px", background: "#25d366", border: "none", borderRadius: 14, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, textDecoration: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.25)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                Tenho interesse · R$ {precoTotal.toFixed(2).replace(".", ",")}
              </a>
            ) : (
              <div style={{ textAlign: "center", padding: "12px", fontSize: "0.8rem", color: "var(--text3)" }}>
                Entre em contato com a loja para fazer seu pedido.
              </div>
            )
          ) : (
            <>
              {obrigatoriosPendentes.length > 0 && (
                <div style={{ fontSize: "0.72rem", color: "var(--gold)", textAlign: "center", marginBottom: 6 }}>⚠️ Selecione: {obrigatoriosPendentes.map(g => g.nome).join(", ")}</div>
              )}
              <button onClick={handleAdd} disabled={!podeAdicionar} style={{ width: "100%", padding: "14px", background: podeAdicionar ? "var(--loja-cor-primaria)" : "var(--bg3)", border: "none", borderRadius: 14, color: podeAdicionar ? "var(--loja-btn-texto, #fff)" : "var(--text3)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "1rem", cursor: podeAdicionar ? "pointer" : "not-allowed", transition: "all 0.3s", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: podeAdicionar ? "0 4px 20px rgba(0,0,0,0.25)" : "none" }}>
                <span>{!podeAdicionar ? "Selecione as opções obrigatórias" : itemNoCarrinho ? "✅ Atualizar pedido" : "✅ Adicionar ao pedido"}</span>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem" }}>R$ {precoTotal.toFixed(2).replace(".", ",")}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
