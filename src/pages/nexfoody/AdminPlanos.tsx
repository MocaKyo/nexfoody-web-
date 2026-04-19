// src/pages/nexfoody/AdminPlanos.tsx
// Modelo: grátis até N pedidos, depois R$X/pedido, mínimo R$Y, máximo R$Z
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  doc, getDoc, setDoc, collection, getDocs, query, where
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { motion, AnimatePresence } from "framer-motion";

interface BillingConfig {
  pedidosGratis: number;   // quantos pedidos grátis por mês
  precoPorPedido: number;  // R$/pedido após tier grátis
  minimoMensal: number;    // cobrança mínima após sair do tier grátis
  maximoMensal: number;    // teto mensal
}

interface ConsumoLoja {
  slug: string;
  nome: string;
  pedidosMes: number;
  valorDevido: number;
  status: "gratis" | "minimo" | "proporcional" | "teto";
}

const DEFAULT_CONFIG: BillingConfig = {
  pedidosGratis: 20,
  precoPorPedido: 1,
  minimoMensal: 29,
  maximoMensal: 300,
};

function calcularValor(pedidos: number, cfg: BillingConfig): { valor: number; status: ConsumoLoja["status"] } {
  if (pedidos <= cfg.pedidosGratis) return { valor: 0, status: "gratis" };
  const bruto = (pedidos - cfg.pedidosGratis) * cfg.precoPorPedido;
  if (bruto >= cfg.maximoMensal) return { valor: cfg.maximoMensal, status: "teto" };
  if (bruto < cfg.minimoMensal) return { valor: cfg.minimoMensal, status: "minimo" };
  return { valor: bruto, status: "proporcional" };
}

const STATUS_LABEL: Record<ConsumoLoja["status"], { label: string; cor: string }> = {
  gratis:       { label: "Grátis",       cor: "#22c55e" },
  minimo:       { label: "Mín. R$29",    cor: "#60a5fa" },
  proporcional: { label: "R$1/pedido",   cor: "#a78bfa" },
  teto:         { label: "Teto R$300",   cor: "#f5c518" },
};

export default function AdminPlanos() {
  const navigate = useNavigate();
  const [cfg, setCfg] = useState<BillingConfig>(DEFAULT_CONFIG);
  const [editCfg, setEditCfg] = useState<BillingConfig>(DEFAULT_CONFIG);
  const [salvando, setSalvando] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [consumo, setConsumo] = useState<ConsumoLoja[]>([]);
  const [carregandoConsumo, setCarregandoConsumo] = useState(false);
  const [editando, setEditando] = useState(false);

  const toast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(""), 3500); };

  // Carrega config do Firestore
  useEffect(() => {
    getDoc(doc(db, "plataforma", "billing")).then(snap => {
      if (snap.exists()) {
        const d = snap.data() as BillingConfig;
        setCfg(d);
        setEditCfg(d);
      }
    });
  }, []);

  // Carrega consumo das lojas no mês atual
  useEffect(() => {
    const carregar = async () => {
      setCarregandoConsumo(true);
      try {
        const agora = new Date();
        const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();

        // Busca todas as lojas
        const lojasSnap = await getDocs(collection(db, "lojas"));
        const lojas = lojasSnap.docs.map(d => ({ slug: d.id, nome: d.data().nome || d.id }));

        // Para cada loja conta pedidos do mês
        const lista: ConsumoLoja[] = [];
        for (const loja of lojas) {
          const pedSnap = await getDocs(query(
            collection(db, "pedidos"),
            where("tenantId", "==", loja.slug),
            where("criadoEm", ">=", inicioMes),
          ));
          const pedidos = pedSnap.size;
          const { valor, status } = calcularValor(pedidos, cfg);
          lista.push({ slug: loja.slug, nome: loja.nome, pedidosMes: pedidos, valorDevido: valor, status });
        }

        lista.sort((a, b) => b.valorDevido - a.valorDevido || b.pedidosMes - a.pedidosMes);
        setConsumo(lista);
      } catch (e) {
        console.error(e);
      } finally {
        setCarregandoConsumo(false);
      }
    };
    carregar();
  }, [cfg]);

  const salvarConfig = async () => {
    setSalvando(true);
    try {
      await setDoc(doc(db, "plataforma", "billing"), editCfg);
      setCfg(editCfg);
      setEditando(false);
      toast("✅ Configuração salva!");
    } catch { toast("Erro ao salvar."); }
    finally { setSalvando(false); }
  };

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const totalReceita = consumo.reduce((acc, l) => acc + l.valorDevido, 0);
  const totalPedidos = consumo.reduce((acc, l) => acc + l.pedidosMes, 0);
  const lojasAtivas = consumo.filter(l => l.pedidosMes > 0).length;

  const mes = new Date().toLocaleString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: "#080412", fontFamily: "'Outfit',sans-serif", paddingBottom: 48 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg,#1a0a36,#0f0720)", padding: "48px 20px 24px", position: "relative" }}>
        <button onClick={() => navigate(-1)} style={{ position: "absolute", top: 16, left: 16, background: "rgba(255,255,255,.08)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Plataforma NexFoody</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.5rem", color: "#fff" }}>💰 Modelo de Cobrança</div>
          <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.35)", marginTop: 4 }}>Plataforma completa para todos • sem limites de recursos</div>
        </div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* CARD MODELO VISUAL */}
        <div style={{ background: "linear-gradient(135deg, rgba(138,92,246,.12), rgba(59,130,246,.08))", border: "1px solid rgba(138,92,246,.3)", borderRadius: 18, padding: "18px 16px" }}>
          <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "#a78bfa", marginBottom: 14 }}>📐 Como funciona</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { range: `0 – ${cfg.pedidosGratis} pedidos`, valor: "Grátis", desc: "Experiência completa sem cobrar nada", cor: "#22c55e", icon: "🎁" },
              { range: `${cfg.pedidosGratis + 1}+ pedidos`, valor: fmt(cfg.precoPorPedido) + "/pedido", desc: `Mínimo ${fmt(cfg.minimoMensal)} • Teto ${fmt(cfg.maximoMensal)}/mês`, cor: "#a78bfa", icon: "📦" },
              { range: "Vendas ilimitadas", valor: `máx. ${fmt(cfg.maximoMensal)}/mês`, desc: "A loja nunca paga mais que isso, seja qual for o volume", cor: "#f5c518", icon: "🏆" },
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.04)", borderRadius: 12, padding: "10px 12px" }}>
                <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>{row.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,.6)" }}>{row.range}</div>
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.3)", marginTop: 2 }}>{row.desc}</div>
                </div>
                <div style={{ fontWeight: 800, fontSize: "0.88rem", color: row.cor, flexShrink: 0 }}>{row.valor}</div>
              </div>
            ))}
          </div>

          {/* Exemplos */}
          <div style={{ marginTop: 14, background: "rgba(0,0,0,.2)", borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.4)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Exemplos práticos</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                { qtd: 15,  label: "loja iniciante" },
                { qtd: 50,  label: "loja pequena" },
                { qtd: 150, label: "loja média" },
                { qtd: 400, label: "loja grande" },
              ].map(ex => {
                const { valor, status } = calcularValor(ex.qtd, cfg);
                return (
                  <div key={ex.qtd} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.45)" }}>{ex.qtd} pedidos ({ex.label})</span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: STATUS_LABEL[status].cor }}>
                      {valor === 0 ? "Grátis" : fmt(valor)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CONFIGURAÇÃO */}
        <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#fff" }}>⚙️ Parâmetros</div>
            <button onClick={() => { setEditando(e => !e); setEditCfg(cfg); }}
              style={{ padding: "5px 12px", background: editando ? "rgba(239,68,68,.12)" : "rgba(96,165,250,.12)", border: `1px solid ${editando ? "rgba(239,68,68,.3)" : "rgba(96,165,250,.3)"}`, borderRadius: 20, fontSize: "0.7rem", fontWeight: 700, color: editando ? "#ef4444" : "#60a5fa", cursor: "pointer" }}>
              {editando ? "Cancelar" : "✏️ Editar"}
            </button>
          </div>
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { key: "pedidosGratis",  label: "Pedidos grátis/mês",       prefix: "",    suffix: " pedidos" },
              { key: "precoPorPedido", label: "Preço por pedido (R$)",     prefix: "R$ ", suffix: "" },
              { key: "minimoMensal",   label: "Mínimo mensal (R$)",        prefix: "R$ ", suffix: "" },
              { key: "maximoMensal",   label: "Teto mensal (R$)",          prefix: "R$ ", suffix: "" },
            ].map(field => (
              <div key={field.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,.5)" }}>{field.label}</span>
                {editando ? (
                  <input
                    type="number"
                    value={(editCfg as any)[field.key]}
                    onChange={e => setEditCfg(prev => ({ ...prev, [field.key]: Number(e.target.value) }))}
                    style={{ width: 90, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 8, padding: "5px 8px", color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.82rem", outline: "none", textAlign: "right" }}
                  />
                ) : (
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff" }}>
                    {field.prefix}{(cfg as any)[field.key]}{field.suffix}
                  </span>
                )}
              </div>
            ))}
            {editando && (
              <button onClick={salvarConfig} disabled={salvando}
                style={{ marginTop: 4, padding: "11px", background: "linear-gradient(135deg,#a78bfa,#7c3aed)", border: "none", borderRadius: 12, color: "#fff", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", opacity: salvando ? 0.6 : 1 }}>
                {salvando ? "Salvando..." : "💾 Salvar configuração"}
              </button>
            )}
          </div>
        </div>

        {/* CONSUMO DO MÊS */}
        <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#fff" }}>📊 Consumo — {mes}</div>
            <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
              {[
                { label: "Receita estimada", val: fmt(totalReceita), cor: "#22c55e" },
                { label: "Total pedidos",    val: String(totalPedidos), cor: "#a78bfa" },
                { label: "Lojas ativas",     val: String(lojasAtivas), cor: "#60a5fa" },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, background: "rgba(255,255,255,.04)", borderRadius: 10, padding: "8px", textAlign: "center" }}>
                  <div style={{ fontWeight: 800, fontSize: "0.9rem", color: s.cor }}>{s.val}</div>
                  <div style={{ fontSize: "0.52rem", color: "rgba(255,255,255,.25)", textTransform: "uppercase", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {carregandoConsumo ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
              <div style={{ width: 28, height: 28, border: "3px solid rgba(167,139,250,.3)", borderTop: "3px solid #a78bfa", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            </div>
          ) : consumo.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,.25)", fontSize: "0.82rem" }}>Nenhuma loja com pedidos este mês</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {consumo.map((loja, i) => {
                const st = STATUS_LABEL[loja.status];
                const pct = Math.min(100, (loja.pedidosMes / Math.max(cfg.pedidosGratis + (cfg.maximoMensal / cfg.precoPorPedido), 1)) * 100);
                return (
                  <div key={loja.slug} style={{ padding: "12px 16px", borderBottom: i < consumo.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff" }}>{loja.nome}</div>
                        <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,.3)" }}>/{loja.slug} · {loja.pedidosMes} pedidos</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.88rem", fontWeight: 800, color: loja.valorDevido > 0 ? "#22c55e" : "rgba(255,255,255,.3)" }}>
                          {loja.valorDevido === 0 ? "Grátis" : fmt(loja.valorDevido)}
                        </div>
                        <div style={{ fontSize: "0.6rem", fontWeight: 700, color: st.cor, marginTop: 1 }}>{st.label}</div>
                      </div>
                    </div>
                    {/* Barra de progresso */}
                    <div style={{ height: 4, background: "rgba(255,255,255,.06)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: loja.status === "teto" ? "#f5c518" : loja.status === "gratis" ? "#22c55e" : "#a78bfa", borderRadius: 2, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* TOAST */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "rgba(15,7,32,.96)", border: "1px solid rgba(167,139,250,.3)", borderRadius: 14, padding: "12px 20px", fontSize: "0.82rem", fontWeight: 700, color: "#fff", zIndex: 200, whiteSpace: "nowrap" }}>
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
