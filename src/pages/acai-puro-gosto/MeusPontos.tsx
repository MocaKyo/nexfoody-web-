import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useStore } from "../../contexts/StoreContext";
import { useTenant } from "../../contexts/TenantContext";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { Recompensa, Pedido } from "../../types/tenant";

export default function MeusPontos() {
  const { user, userData } = useAuth();
  const { recompensas } = useStore();
  const { tenantId } = useTenant();
  const [historico, setHistorico] = useState<Pedido[]>([]);
  const [resgatando, setResgatando] = useState<string | null>(null);

  const pontos = userData?.pontos || 0;
  const rankingPts = userData?.rankingPts || 0;

  useEffect(() => {
    if (!user?.uid || !tenantId) return;
    const q = query(
      collection(db, `tenants/${tenantId}/pedidos`),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      const filtered = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Pedido))
        .filter(p => (p.pontosGanhos ?? 0) > 0)
        .slice(0, 10);
      setHistorico(filtered);
    });
    return unsub;
  }, [user?.uid, tenantId]);

  const handleResgatar = async (recompensa: Recompensa) => {
    if (!user || !userData) { alert("Faça login para resgatar."); return; }
    if (pontos < recompensa.pontos) {
      alert("Pontos insuficientes."); return;
    }
    setResgatando(recompensa.id);
    try {
      await addDoc(collection(db, "resgates"), {
        userId: user.uid,
        nomeCliente: userData.nome,
        recompensaId: recompensa.id,
        recompensaNome: recompensa.nome,
        pontosUsados: recompensa.pontos,
        status: "pendente",
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "users", user.uid), {
        pontos: increment(-recompensa.pontos),
      });
      alert(`🎁 ${recompensa.nome} resgatado!`);
    } catch {
      alert("Erro ao resgatar.");
    } finally { setResgatando(null); }
  };

  const typedRecompensas = recompensas as Recompensa[];
  const proximaRecompensa = typedRecompensas.filter(r => r.pontos > pontos).sort((a, b) => a.pontos - b.pontos)[0];
  const progressoPct = proximaRecompensa ? Math.min(100, (pontos / proximaRecompensa.pontos) * 100) : 100;
  const disponiveis = typedRecompensas.filter(r => r.pontos <= pontos);
  const typedHistorico = historico as (Pedido & { pontosGanhos?: number })[];

  return (
    <div className="page">
      <h1 className="display-title" style={{ fontSize: "1.4rem", marginBottom: 16 }}>
        Meus <span style={{ color: "var(--gold)" }}>Pontos</span>
      </h1>

      {/* Saldo */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <div style={{
          flex: 1,
          background: "linear-gradient(135deg, var(--gold-dim), var(--bg2))",
          border: "1px solid rgba(245,197,24,0.2)",
          borderRadius: "var(--radius)",
          padding: "16px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--gold)", fontFamily: "'Fraunces', serif" }}>
            {pontos.toLocaleString()}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 2 }}>pontos</div>
        </div>
        <div style={{
          flex: 1,
          background: "linear-gradient(135deg, rgba(138,92,246,0.08), var(--bg2))",
          border: "1px solid rgba(138,92,246,0.2)",
          borderRadius: "var(--radius)",
          padding: "16px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--purple2)", fontFamily: "'Fraunces', serif" }}>
            {rankingPts.toLocaleString()}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 2 }}>ranking pts</div>
        </div>
      </div>

      {/* Progresso para próxima recompensa */}
      {proximaRecompensa && (
        <div style={{
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "16px",
          marginBottom: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text2)" }}>Próxima recompensa</span>
            <span style={{ fontSize: "0.75rem", color: "var(--gold)", fontWeight: 700 }}>
              {proximaRecompensa.nome}
            </span>
          </div>
          <div style={{ height: 8, background: "var(--bg3)", borderRadius: 4, overflow: "hidden", marginBottom: 4 }}>
            <div style={{ height: "100%", width: `${progressoPct}%`, background: "linear-gradient(90deg, var(--gold), var(--gold2))", borderRadius: 4, transition: "width 0.5s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text3)" }}>
            <span>{pontos.toLocaleString()} pts</span>
            <span>{proximaRecompensa.pontos.toLocaleString()} pts</span>
          </div>
        </div>
      )}

      {/* Recompensas disponíveis */}
      <div className="section-label">Recompensas Disponíveis</div>
      {disponiveis.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text3)", fontSize: "0.85rem" }}>
          Continue pedindo para acumular pontos!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {disponiveis.map(r => (
            <div key={r.id} style={{
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              <div style={{ fontSize: "1.5rem" }}>{r.emoji || "🎁"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text)" }}>{r.nome}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>{r.pontos} pts</div>
              </div>
              <button
                onClick={() => handleResgatar(r)}
                disabled={resgatando === r.id}
                className="btn btn-gold btn-sm"
              >
                {resgatando === r.id ? "..." : "Resgatar"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Histórico */}
      {typedHistorico.length > 0 && (
        <>
          <div className="section-label">Histórico</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {typedHistorico.map(p => (
              <div key={p.id} style={{
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text2)" }}>Pedido {p.id.slice(0, 6)}</span>
                <span style={{ fontSize: "0.78rem", color: "var(--green)", fontWeight: 700 }}>+{p.pontosGanhos} pts</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
