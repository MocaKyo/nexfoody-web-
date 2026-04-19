// Componente de avaliações — usado no modal do Cardapio.js
import React, { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot, setDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";

function Estrelas({ valor, onChange, tamanho = "1.4rem", readonly = false }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <span
          key={i}
          onClick={() => !readonly && onChange && onChange(i)}
          onMouseEnter={() => !readonly && setHover(i)}
          onMouseLeave={() => !readonly && setHover(0)}
          style={{
            fontSize: tamanho, cursor: readonly ? "default" : "pointer",
            color: i <= (hover || valor) ? "#f5c518" : "rgba(255,255,255,0.15)",
            transition: "color 0.15s",
            userSelect: "none",
          }}
        >★</span>
      ))}
    </div>
  );
}

export function AvaliacaoProduto({ produtoId, produtoNome }) {
  const { user, userData } = useAuth();
  const { config } = useStore();
  const modo = config.modoAvaliacoes || "completo";
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [minhaAvaliacao, setMinhaAvaliacao] = useState(null);
  const [estrelas, setEstrelas] = useState(0);
  const [comentario, setComentario] = useState("");
  const [jaComprou, setJaComprou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Verificar se já comprou
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "pedidos"),
      where("userId", "==", user.uid),
      where("status", "in", ["entregue", "pronto", "entrega", "confirmado", "preparo"])
    );
    const unsub = onSnapshot(q, snap => {
      const comprou = snap.docs.some(d => {
        const items = d.data().items || [];
        return items.some(i => i.id === produtoId);
      });
      setJaComprou(comprou);
    });
    return unsub;
  }, [user, produtoId]);

  // Carregar avaliações
  useEffect(() => {
    const q = query(
      collection(db, "avaliacoes"),
      where("produtoId", "==", produtoId),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      const todas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAvaliacoes(todas);
      if (user) {
        const minha = todas.find(a => a.userId === user.uid);
        if (minha) {
          setMinhaAvaliacao(minha);
          setEstrelas(minha.estrelas);
          setComentario(minha.comentario || "");
        }
      }
      setLoading(false);
    });
    return unsub;
  }, [produtoId, user]);

  const salvarAvaliacao = async () => {
    if (!estrelas) return;
    setSalvando(true);
    try {
      const id = `${user.uid}_${produtoId}`;
      await setDoc(doc(db, "avaliacoes", id), {
        userId: user.uid,
        nomeCliente: userData?.nome || "Cliente",
        produtoId,
        produtoNome,
        estrelas,
        comentario: comentario.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setMostrarForm(false);
    } catch (e) { console.error(e); }
    finally { setSalvando(false); }
  };

  const media = avaliacoes.length > 0
    ? avaliacoes.reduce((s, a) => s + a.estrelas, 0) / avaliacoes.length
    : 0;

  // Modo desativado — não mostra nada
  if (modo === "desativado") return null;

  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 14 }}>
      {/* Resumo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "2rem", fontWeight: 900, color: "#f5c518", lineHeight: 1 }}>
            {media > 0 ? media.toFixed(1) : "—"}
          </div>
          <Estrelas valor={Math.round(media)} tamanho="0.9rem" readonly />
          <div style={{ fontSize: "0.65rem", color: "var(--text3)", marginTop: 2 }}>
            {avaliacoes.length} {avaliacoes.length === 1 ? "avaliação" : "avaliações"}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {[5,4,3,2,1].map(n => {
            const count = avaliacoes.filter(a => a.estrelas === n).length;
            const pct = avaliacoes.length > 0 ? (count / avaliacoes.length) * 100 : 0;
            return (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: "0.62rem", color: "var(--text3)", width: 8 }}>{n}</span>
                <span style={{ fontSize: "0.65rem", color: "#f5c518" }}>★</span>
                <div style={{ flex: 1, height: 5, background: "var(--bg3)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "#f5c518", borderRadius: 3, transition: "width 0.5s" }} />
                </div>
                <span style={{ fontSize: "0.62rem", color: "var(--text3)", width: 16 }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Botão avaliar */}
      {user && jaComprou && (
        <div style={{ marginBottom: 14 }}>
          {!mostrarForm ? (
            <button onClick={() => setMostrarForm(true)} style={{
              width: "100%", padding: "10px",
              background: "transparent", border: "1px solid rgba(245,197,24,0.25)",
              borderRadius: 10, cursor: "pointer",
              color: "#f5c518", fontFamily: "'Outfit', sans-serif",
              fontWeight: 600, fontSize: "0.85rem",
            }}>
              {minhaAvaliacao ? "✏️ Editar minha avaliação" : "⭐ Avaliar este produto"}
            </button>
          ) : (
            <div style={{ background: "transparent", border: "1px solid rgba(245,197,24,0.2)", borderRadius: 12, padding: 14 }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 10 }}>Sua avaliação</div>
              <Estrelas valor={estrelas} onChange={setEstrelas} tamanho="1.8rem" />
              {modo === "completo" && (
                <textarea
                  value={comentario}
                  onChange={e => setComentario(e.target.value)}
                  placeholder="Conte sua experiência... (opcional)"
                  style={{
                    width: "100%", marginTop: 10, padding: "8px 12px",
                    background: "var(--bg3)", border: "1px solid var(--border)",
                    borderRadius: 8, color: "var(--text)", fontFamily: "'Outfit', sans-serif",
                    fontSize: "0.85rem", resize: "none",
                  }}
                  rows={3}
                />
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={salvarAvaliacao} disabled={!estrelas || salvando} style={{
                  flex: 1, padding: "9px",
                  background: estrelas ? "linear-gradient(135deg, #f5c518, #e6a817)" : "var(--bg3)",
                  border: "none", borderRadius: 8, cursor: estrelas ? "pointer" : "not-allowed",
                  color: estrelas ? "#1a1a1a" : "var(--text3)",
                  fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.85rem",
                }}>
                  {salvando ? "Salvando..." : "Publicar avaliação"}
                </button>
                <button onClick={() => setMostrarForm(false)} style={{
                  padding: "9px 14px", background: "var(--bg3)", border: "none",
                  borderRadius: 8, cursor: "pointer", color: "var(--text3)",
                  fontFamily: "'Outfit', sans-serif",
                }}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {user && !jaComprou && avaliacoes.length === 0 && (
        <div style={{ fontSize: "0.78rem", color: "var(--text3)", textAlign: "center", padding: "8px 0", marginBottom: 10 }}>
          Compre este produto para deixar sua avaliação
        </div>
      )}

      {/* Lista de avaliações — só no modo completo */}
      {modo === "completo" && avaliacoes.length > 0 && (
        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Avaliações dos clientes
          </div>
          {avaliacoes.slice(0, 5).map(a => (
            <div key={a.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--purple2), var(--purple))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.75rem", fontWeight: 700, color: "#fff", flexShrink: 0,
                  }}>
                    {(a.nomeCliente || "C")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>
                      {a.userId === user?.uid ? "Você" : a.nomeCliente}
                    </div>
                    <Estrelas valor={a.estrelas} tamanho="0.75rem" readonly />
                  </div>
                </div>
                <div style={{ fontSize: "0.65rem", color: "var(--text3)" }}>
                  {a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString("pt-BR") : ""}
                </div>
              </div>
              {a.comentario && (
                <p style={{ fontSize: "0.82rem", color: "var(--text2)", lineHeight: 1.5, marginLeft: 36 }}>
                  {a.comentario}
                </p>
              )}
            </div>
          ))}
          {avaliacoes.length > 5 && (
            <div style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text3)" }}>
              +{avaliacoes.length - 5} avaliações
            </div>
          )}
        </div>
      )}
      {/* Modo só estrelas — avisa que comentários estão ocultos */}
      {modo === "soEstrelas" && avaliacoes.length > 0 && (
        <div style={{ textAlign: "center", fontSize: "0.72rem", color: "var(--text3)", padding: "8px 0" }}>
          {avaliacoes.length} {avaliacoes.length === 1 ? "avaliação" : "avaliações"}
        </div>
      )}
    </div>
  );
}

export { Estrelas };
