import { useEffect, useState } from "react";
import { useTenant } from "../../contexts/TenantContext";
import { useStore } from "../../contexts/StoreContext";
import { db } from "../../lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export default function PerfilLoja() {
  const { tenantConfig, tenantId } = useTenant();
  const { config } = useStore();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const store = (tenantConfig || config) as any;

  const [pedidosTotal, setPedidosTotal] = useState<number | null>(null);
  const [mediaAvaliacao, setMediaAvaliacao] = useState<{ media: number; total: number } | null>(null);
  const [bairrosAberto, setBairrosAberto] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    // Total de pedidos entregues
    getDocs(query(collection(db, "pedidos"), where("tenantId", "==", tenantId), where("status", "==", "entregue")))
      .then(snap => setPedidosTotal(snap.size))
      .catch(() => {});
    // Média de avaliações
    getDocs(collection(db, "avaliacoes"))
      .then(snap => {
        const avs = snap.docs.map(d => d.data()).filter(d => {
          // filtra avaliações dos produtos desta loja (via produtoId não tem join direto, usa todos por ora)
          return typeof d.estrelas === "number";
        });
        if (avs.length === 0) return;
        const soma = avs.reduce((acc, d) => acc + d.estrelas, 0);
        setMediaAvaliacao({ media: soma / avs.length, total: avs.length });
      })
      .catch(() => {});
  }, [tenantId]);

  const bairros: string[] = store?.bairrosNaoAtendidos || [];

  const fmtMoeda = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  const estrelas = (n: number) => {
    const cheias = Math.round(n);
    return "★".repeat(cheias) + "☆".repeat(5 - cheias);
  };

  const getBadgePedidos = (total: number | null) => {
    if (total === null) return null;
    if (total >= 3000) return { emoji: "🥇", label: "+3k", cor: "#f5c518", bg: "rgba(245,197,24,0.12)", border: "rgba(245,197,24,0.4)" };
    if (total >= 2000) return { emoji: "🥈", label: "+2k", cor: "#c0c0c0", bg: "rgba(192,192,192,0.12)", border: "rgba(192,192,192,0.4)" };
    if (total >= 1000) return { emoji: "🥉", label: "+1k", cor: "#cd7f32", bg: "rgba(205,127,50,0.12)", border: "rgba(205,127,50,0.4)" };
    return null;
  };

  const badgePedidos = getBadgePedidos(pedidosTotal);
  const verificada = store?.verificada === true;

  if (!store) return (
    <div style={{ textAlign: "center", padding: "64px 0", color: "var(--text3)" }}>
      <div style={{ fontSize: "2rem", marginBottom: 8 }}>🏪</div>
      <div>Carregando perfil...</div>
    </div>
  );

  return (
    <div className="page" style={{ paddingBottom: 80 }}>

      {/* ── CAPA + LOGO ── */}
      <div style={{ position: "relative", marginBottom: 48 }}>
        {store.imagemCapa ? (
          <img src={store.imagemCapa} alt="Capa" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: "var(--radius) var(--radius) 0 0", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: 160, background: "linear-gradient(135deg, var(--purple), var(--purple2))", borderRadius: "var(--radius) var(--radius) 0 0" }} />
        )}
        <div style={{ position: "absolute", bottom: -40, left: 16, width: 72, height: 72, borderRadius: 16, border: "3px solid var(--bg)", overflow: "hidden", background: "var(--bg2)", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
          {store.logoUrl
            ? <img src={store.logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>🍓</div>
          }
        </div>
      </div>

      {/* ── NOME + DESCRIÇÃO ── */}
      <div style={{ padding: "0 16px", marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: "1.3rem", color: "var(--text)", fontFamily: "'Fraunces', serif" }}>{store.nomeLoja}</div>
        {store.descricao && <div style={{ fontSize: "0.82rem", color: "var(--text2)", marginTop: 4, lineHeight: 1.5 }}>{store.descricao}</div>}

        {/* Badges + Status */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" }}>
          {/* Status aberto/fechado */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: store.cardapioAtivo ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${store.cardapioAtivo ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`, borderRadius: 20, padding: "4px 12px" }}>
            <span style={{ fontSize: "0.7rem" }}>{store.cardapioAtivo ? "🟢" : "🔴"}</span>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: store.cardapioAtivo ? "var(--green)" : "var(--red)" }}>
              {store.cardapioAtivo
                ? store.horarioFechamento ? `Aberto até às ${store.horarioFechamento}` : "Aberto agora"
                : store.horarioAbertura ? `Abre às ${store.horarioAbertura}` : "Fechado"
              }
            </span>
          </div>

          {/* Badge de pedidos */}
          {badgePedidos && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: badgePedidos.bg, border: `1px solid ${badgePedidos.border}`, borderRadius: 20, padding: "4px 10px" }}>
              <span style={{ fontSize: "0.8rem" }}>{badgePedidos.emoji}</span>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: badgePedidos.cor }}>{badgePedidos.label} pedidos</span>
            </div>
          )}

          {/* Badge verificada */}
          {verificada && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.4)", borderRadius: 20, padding: "4px 10px" }}>
              <span style={{ fontSize: "0.8rem" }}>✅</span>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#60a5fa" }}>Verificada</span>
            </div>
          )}
        </div>
      </div>

      {/* ── PROVA SOCIAL ── */}
      {(pedidosTotal !== null || mediaAvaliacao) && (
        <div style={{ display: "flex", gap: 10, padding: "0 16px", marginBottom: 16 }}>
          {pedidosTotal !== null && pedidosTotal > 0 && (
            <div style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--purple2)" }}>{pedidosTotal >= 1000 ? `${(pedidosTotal / 1000).toFixed(1)}k` : `+${pedidosTotal}`}</div>
              <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 2 }}>pedidos entregues</div>
            </div>
          )}
          {mediaAvaliacao && mediaAvaliacao.total > 0 && (
            <div style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--gold)" }}>{mediaAvaliacao.media.toFixed(1)}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--gold)" }}>{estrelas(mediaAvaliacao.media)}</div>
              <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 2 }}>{mediaAvaliacao.total} avaliações</div>
            </div>
          )}
        </div>
      )}

      {/* ── OPERACIONAL ── */}
      <div style={{ margin: "0 16px 16px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: "0.8rem", color: "var(--text2)" }}>📋 Informações</div>

        {[
          store.horario && { icon: "🕐", label: "Horário", value: store.horario },
          (store.tempoEntrega || (store.tempoMin && store.tempoMax)) && { icon: "⏱️", label: "Tempo de entrega", value: store.tempoEntrega || `${store.tempoMin}–${store.tempoMax} min` },
          store.taxaEntrega != null && store.taxaEntrega !== "" && { icon: "🚚", label: "Taxa de entrega", value: Number(store.taxaEntrega) === 0 ? "Grátis" : fmtMoeda(Number(store.taxaEntrega)) },
          store.pedidoMinimo && { icon: "🛒", label: "Pedido mínimo", value: fmtMoeda(Number(store.pedidoMinimo)) },
          store.endereco && { icon: "📍", label: "Retirada", value: store.endereco },
        ].filter(Boolean).map((row: any, i, arr) => (
          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text3)" }}>{row.icon} {row.label}</span>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)", maxWidth: "60%", textAlign: "right" }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* ── BAIRROS SEM ENTREGA ── */}
      {bairros.length > 0 && (
        <div style={{ margin: "0 16px 16px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 14, overflow: "hidden" }}>
          <button
            onClick={() => setBairrosAberto(v => !v)}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "none", border: "none", cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}
          >
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--red)" }}>🚫 Bairros sem entrega</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text3)" }}>{bairrosAberto ? "▲" : "▼"} {bairros.length} bairro{bairros.length > 1 ? "s" : ""}</span>
          </button>
          {bairrosAberto && (
            <div style={{ padding: "0 14px 12px", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {bairros.map(b => (
                <span key={b} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 20, padding: "3px 10px", fontSize: "0.75rem", color: "var(--red)" }}>{b}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CONTATO ── */}
      <div style={{ margin: "0 16px 16px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: "0.8rem", color: "var(--text2)" }}>📲 Contato</div>
        {store.instagram && (
          <a href={`https://instagram.com/${String(store.instagram).replace("@", "")}`} target="_blank" rel="noreferrer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", textDecoration: "none" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text3)" }}>📸 Instagram</span>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#e1306c" }}>@{String(store.instagram).replace("@", "")}</span>
          </a>
        )}
      </div>

      {/* ── FIDELIDADE ── */}
      {(store.pontosPorReal || store.cashbackPercent) && (
        <div style={{ margin: "0 16px 16px", background: "linear-gradient(135deg, rgba(245,197,24,0.06), rgba(138,92,246,0.06))", border: "1px solid rgba(245,197,24,0.2)", borderRadius: 14, padding: "14px" }}>
          <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--gold)", marginBottom: 10 }}>⭐ Programa de Fidelidade</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {store.pontosPorReal && (
              <div style={{ fontSize: "0.78rem", color: "var(--text2)" }}>
                🎯 Ganhe <strong style={{ color: "var(--gold)" }}>{store.pontosPorReal} ponto{Number(store.pontosPorReal) !== 1 ? "s" : ""}</strong> a cada R$1 gasto
                {store.valorPonto && <> · cada ponto vale <strong style={{ color: "var(--gold)" }}>R${Number(store.valorPonto).toFixed(2).replace(".", ",")}</strong></>}
              </div>
            )}
            {store.cashbackPercent && (
              <div style={{ fontSize: "0.78rem", color: "var(--text2)" }}>
                💰 <strong style={{ color: "var(--green)" }}>{store.cashbackPercent}% de cashback</strong> em cada pedido
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
