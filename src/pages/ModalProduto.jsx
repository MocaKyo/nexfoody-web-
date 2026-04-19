// src/components/ModalProduto.js — Modal com carrossel de complementos
import React, { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { AvaliacaoProduto } from "./Avaliacoes";
import { useStore } from "../contexts/StoreContext";

export default function ModalProduto({ produto, onClose, onAdd, isAberto, complementosIniciais = [], stats = {}, isFav = false, onToggleFav }) {
  const { cartExtras, removeFromExtras } = useStore();
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
  const carrosselRefs = useRef({});
  const barraRefs = useRef({});
  const touchStartX = useRef(0);

  // Carrossel apenas com fotos do produto (até 4)
  const todasFotos = [
    produto.foto,
    ...(produto.fotos || []),
  ].filter(Boolean).slice(0, 4);

  useEffect(() => {
    if (!produto?.id) return;
    const carregar = async () => {
      try {
        const gruposSnap = await getDocs(query(collection(db, `produtos/${produto.id}/grupos_complementos`), orderBy("ordem", "asc")));
        const gs = await Promise.all(gruposSnap.docs.map(async gDoc => {
          const itensSnap = await getDocs(query(collection(db, `produtos/${produto.id}/grupos_complementos/${gDoc.id}/itens`), orderBy("ordem", "asc")));
          return { id: gDoc.id, ...gDoc.data(), itens: itensSnap.docs.map(d => ({ id: d.id, ...d.data() })) };
        }));
        setGrupos(gs);
        const init = {};
        gs.forEach(g => { init[g.id] = []; });
        if (complementosIniciais?.length > 0) {
          gs.forEach(g => {
            const itensDeste = complementosIniciais.filter(c =>
              g.itens?.some(i => i.id === c.id || i.nome === c.nome)
            );
            if (itensDeste.length > 0) {
              init[g.id] = itensDeste.map(c => {
                const itemReal = g.itens?.find(i => i.id === c.id || i.nome === c.nome);
                return itemReal || c;
              });
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
          const match = complementosExistentes.filter(c =>
            g.itens?.some(i => i.id === c.id || i.nome === c.nome)
          );
          if (match.length > 0) {
            novo[g.id] = match.map(c =>
              g.itens?.find(i => i.id === c.id || i.nome === c.nome) || c
            );
          }
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
    if (agora - lastTap < 300) onToggleFav && onToggleFav(e);
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
  };

  const compartilhar = (e) => {
    e.stopPropagation();
    const urlLoja = "acaipurogosto.com.br";
    const txt = `🍓 *${produto.nome}*${produto.desc ? `\n${produto.desc}` : ""}\n💰 R$${produto.preco.toFixed(2).replace(".", ",")}\n\n🔗 https://${urlLoja}`;
    if (navigator.share) navigator.share({ title: produto.nome, text: txt });
    else window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  const obrigatoriosPendentes = grupos.filter(g => g.obrigatorio && (selecoes[g.id]?.length || 0) < g.min);
  const podeAdicionar = validarObrigatorios() && isAberto;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 520, margin: "0 auto",
        background: "var(--bg)", borderRadius: "20px 20px 0 0",
        maxHeight: "92vh", overflowY: "auto",
        /* Fix 2: paddingBottom maior para botão não cobrir avaliações */
        paddingBottom: 120,
      }}>
        {/* CARROSSEL DE FOTOS — até 4 imagens */}
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
                <img key={fi} src={foto} alt={produto.nome} style={{ width: "100%", height: 240, objectFit: "cover", flexShrink: 0 }} />
              )) : (
                <div style={{ width: "100%", height: 200, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "5rem", flexShrink: 0, borderRadius: "20px 20px 0 0" }}>{produto.emoji || "🫐"}</div>
              )}
            </div>
          </div>

          {/* Overlay gradiente mais forte para legibilidade */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 35%, rgba(10,4,20,0.75) 70%, rgba(10,4,20,0.95) 100%)", borderRadius: "20px 20px 0 0", pointerEvents: "none" }} />

          {/* Botão fechar */}
          <button onClick={onClose} style={{ position: "absolute", top: 12, left: 12, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", zIndex: 20, padding: 0 }}>
            <span style={{ display: "block", transform: "translate(-1px, 0px)", lineHeight: 1 }}>←</span>
          </button>

          {/* Coluna direita: stats + compartilhar — tamanho padronizado */}
          <div style={{ position: "absolute", top: 12, right: 12, display: "flex", flexDirection: "column", gap: 6, alignItems: "center", zIndex: 20 }}>

            {/* ❤️ Favoritos — oculta contador se zero */}
            <button
              onClick={e => { e.stopPropagation(); onToggleFav && onToggleFav(e); }}
              style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", border: `1.5px solid ${isFav ? "rgba(239,68,68,0.7)" : "rgba(255,255,255,0.25)"}`, borderRadius: 12, padding: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, width: 44, height: stats.favoritos > 0 ? 50 : 44, transition: "all 0.2s", transform: isFav ? "scale(1.05)" : "scale(1)" }}
            >
              <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>{isFav ? "❤️" : "🤍"}</span>
              {stats.favoritos > 0 && <span style={{ fontSize: "0.58rem", color: isFav ? "#fca5a5" : "rgba(255,255,255,0.75)", fontWeight: 700, lineHeight: 1 }}>{stats.favoritos}</span>}
            </button>

            {/* 🔥 Pedidos semana — oculta se zero, mostra "Novo" */}
            {stats.pedidosSemana > 0 ? (
              <div style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", border: "1.5px solid rgba(255,149,0,0.4)", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, width: 44, height: 50 }}>
                <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>🔥</span>
                <span style={{ fontSize: "0.55rem", color: "#ff9500", fontWeight: 700, lineHeight: 1 }}>{stats.pedidosSemana}/sem</span>
              </div>
            ) : (
              <div style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", border: "1.5px solid rgba(96,165,250,0.4)", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, width: 44, height: 50 }}>
                <span style={{ fontSize: "0.95rem", lineHeight: 1 }}>✨</span>
                <span style={{ fontSize: "0.52rem", color: "#60a5fa", fontWeight: 700, lineHeight: 1 }}>Novo</span>
              </div>
            )}

            {/* 🔗 Compartilhar — mesmo tamanho, borda destacada */}
            <button
              onClick={compartilhar}
              style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", border: "1.5px solid rgba(255,255,255,0.35)", borderRadius: 12, padding: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 44, height: 44 }}
            >
              <span style={{ fontSize: "1.15rem", lineHeight: 1 }}>🔗</span>
            </button>
          </div>

          {/* Dots — maior contraste */}
          {todasFotos.length > 1 && (
            <div style={{ position: "absolute", bottom: 48, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6, zIndex: 10 }}>
              {todasFotos.map((_, fi) => (
                <div
                  key={fi}
                  onClick={e => { e.stopPropagation(); setFotoAtual(fi); }}
                  style={{ width: fi === fotoAtual ? 24 : 8, height: 8, borderRadius: 4, background: fi === fotoAtual ? "var(--gold)" : "rgba(255,255,255,0.6)", cursor: "pointer", transition: "all 0.3s", boxShadow: fi === fotoAtual ? "0 0 6px rgba(245,197,24,0.6)" : "none" }}
                />
              ))}
            </div>
          )}

          {/* Botão ↔ carrossel */}
          {todasFotos.length > 1 && (
            <div style={{ position: "absolute", top: 12, right: 12, display: "flex", flexDirection: "column", gap: 6, alignItems: "center", zIndex: 20, marginTop: 180 }}>
              <button
                onClick={e => { e.stopPropagation(); setFotoAtual(f => (f + 1) % todasFotos.length); }}
                style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", border: "2px solid rgba(255,255,255,0.4)", borderRadius: "50%", width: 44, height: 44, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", fontWeight: 900, boxShadow: "0 2px 8px rgba(0,0,0,0.4)", padding: 0 }}
              >
                <span style={{ display: "block", lineHeight: 1, transform: "translateY(0px)" }}>↔</span>
              </button>
              <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.8)", textAlign: "center", fontWeight: 700 }}>{fotoAtual + 1}/{todasFotos.length}</div>
            </div>
          )}

          {/* Nome e preço */}
          <div style={{ position: "absolute", bottom: 12, left: 16, right: 16 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.3rem", fontWeight: 700, color: "#fff" }}>{produto.nome}</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", fontWeight: 900, color: "#f5c518", marginTop: 2 }}>R$ {precoTotal.toFixed(2).replace(".", ",")}</div>
          </div>
        </div>

        {/* Dica double tap */}
        <div style={{ textAlign: "center", fontSize: "0.65rem", color: "var(--text3)", padding: "6px 0 2px" }}>
          Toque duas vezes na foto para {isFav ? "desfavoritar ❤️" : "favoritar 🤍"}
        </div>

        {produto.desc && <p style={{ fontSize: "0.85rem", color: "var(--text2)", padding: "8px 16px 0", lineHeight: 1.6 }}>{produto.desc}</p>}

        {/* Fix 4: mostrar esgotado só se controlarEstoque estiver ativo */}
        {produto.controlarEstoque && produto.estoque <= 0 && (
          <div style={{ margin: "8px 16px 0", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "8px 14px", fontSize: "0.82rem", color: "var(--red)", fontWeight: 600, textAlign: "center" }}>
            😔 Produto esgotado no momento
          </div>
        )}

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

            {/* Grupos */}
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
                        <span style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 20, padding: "2px 8px", color: "#60a5fa", fontWeight: 700 }}>Máx. {grupo.max}</span>
                      </div>
                    </div>
                    {/* Fix 2: barra de limite sempre visível */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <div style={{ display: "flex", gap: 3 }}>
                        {Array.from({ length: Math.min(parseInt(grupo.max) || 1, 8) }).map((_, i) => (
                          <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: i < sel.length ? "linear-gradient(135deg, var(--gold), #e6a817)" : "var(--bg3)", border: `1px solid ${i < sel.length ? "var(--gold)" : "var(--border)"}`, transition: "all 0.2s", boxShadow: i < sel.length ? "0 0 6px rgba(245,197,24,0.5)" : "none" }} />
                        ))}
                      </div>
                      <div style={{ fontSize: "0.6rem", color: atingiuMax ? "var(--gold)" : "var(--text3)", fontWeight: 600 }}>
                        {sel.length}/{grupo.max}
                      </div>
                    </div>
                  </div>

                  <div ref={el => carrosselRefs.current[grupo.id] = el} onScroll={e => { const carrossel = e.target; const barra = barraRefs.current[grupo.id]; if (barra) { const ratio = carrossel.scrollLeft / (carrossel.scrollWidth - carrossel.clientWidth); barra.scrollLeft = ratio * (barra.scrollWidth - barra.clientWidth); } }} style={{ overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                    <div style={{ display: "flex", gap: 10, padding: "0 16px", width: "max-content" }}>
                      {grupo.itens?.map(item => {
                        const selecionado = sel.find(i => i.id === item.id);
                        const bloqueadoMax = atingiuMax && !selecionado;
                        return (
                          <div key={item.id} onClick={() => { if (bloqueado) return; if (bloqueadoMax) { const evt = new CustomEvent("toast", { detail: { msg: `Máximo de ${maxNum} ${maxNum === 1 ? "item" : "itens"}!`, type: "error" } }); window.dispatchEvent(evt); return; } selecionarItem(grupo, item); if (gi < grupos.length - 1 && parseInt(grupo.max) === 1) setPassoAtual(gi + 1); }} style={{ width: 110, flexShrink: 0, cursor: bloqueado ? "not-allowed" : "pointer", background: selecionado ? "rgba(245,197,24,0.12)" : "var(--bg2)", border: `2px solid ${selecionado ? "var(--gold)" : "var(--border)"}`, borderRadius: 14, overflow: "hidden", transition: "all 0.2s", transform: selecionado ? "scale(1.03)" : "scale(1)" }}>
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
                        <div ref={el => barraRefs.current[grupo.id] = el} className="barra-compl-scroll" onScroll={e => { const barra = e.target; const carrossel = carrosselRefs.current[grupo.id]; if (carrossel) { const ratio = barra.scrollLeft / Math.max(1, barra.scrollWidth - barra.clientWidth); carrossel.scrollLeft = ratio * (carrossel.scrollWidth - carrossel.clientWidth); } }} style={{ display: "flex", gap: 4, overflowX: "scroll", cursor: "grab", paddingBottom: 2, marginBottom: 2, touchAction: "pan-x" }}>
                          {grupo.itens.map((item, ii) => {
                            const isSel = (selecoes[grupo.id] || []).find(s => s.id === item.id);
                            return <div key={ii} onClick={() => { const carrossel = carrosselRefs.current[grupo.id]; if (carrossel) { const itemEl = carrossel.children[ii]; if (itemEl) itemEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }); } }} style={{ height: 6, minWidth: 40, flex: 1, maxWidth: 60, background: isSel ? "linear-gradient(90deg, var(--gold), #e6a817)" : "rgba(255,255,255,0.15)", borderRadius: 3, transition: "all 0.3s", flexShrink: 0, boxShadow: isSel ? "0 0 8px rgba(245,197,24,0.4)" : "none", cursor: "pointer" }} />;
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

        {/* Avaliações com espaço adequado */}
        <div style={{ padding: "0 16px 16px" }}>
          <AvaliacaoProduto produtoId={produto.id} produtoNome={produto.nome} />
        </div>

        {/* Botão adicionar fixo */}
        <div style={{ position: "fixed", bottom: 60, left: 0, right: 0, maxWidth: 520, margin: "0 auto", padding: "10px 16px", background: "var(--bg)", borderTop: "1px solid var(--border)", zIndex: 10 }}>
          {obrigatoriosPendentes.length > 0 && (
            <div style={{ fontSize: "0.72rem", color: "var(--gold)", textAlign: "center", marginBottom: 6 }}>⚠️ Selecione: {obrigatoriosPendentes.map(g => g.nome).join(", ")}</div>
          )}
          <button onClick={handleAdd} disabled={!podeAdicionar} style={{ width: "100%", padding: "14px", background: podeAdicionar ? "linear-gradient(135deg, var(--purple2), var(--purple))" : "var(--bg3)", border: "none", borderRadius: 14, color: podeAdicionar ? "#fff" : "var(--text3)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "1rem", cursor: podeAdicionar ? "pointer" : "not-allowed", transition: "all 0.3s", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: podeAdicionar ? "0 4px 20px rgba(90,45,145,0.5)" : "none" }}>
            <span>{!podeAdicionar ? "Selecione as opções obrigatórias" : itemNoCarrinho ? "✅ Atualizar pedido" : "✅ Adicionar ao pedido"}</span>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem" }}>R$ {precoTotal.toFixed(2).replace(".", ",")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
