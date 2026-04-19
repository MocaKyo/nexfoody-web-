// src/components/FeedRulesPanel.tsx
// Painel que o lojista usa para controlar seu espaço no feed central da NexFoody
import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

// ─── TIPOS ───────────────────────────────────────────────────
export interface FeedRulesConfig {
  autoMode: boolean;
  slotsPerDia: number;
  rules: {
    novoClienteFoto: boolean;
    topFanSemana: boolean;
    produtoDestaque: boolean;
    cupomAtivo: boolean;
    marcoCliente: boolean;
    horarioPico: boolean;
  };
  updatedAt?: unknown;
}

const DEFAULT_RULES: FeedRulesConfig = {
  autoMode: true,
  slotsPerDia: 5,
  rules: {
    novoClienteFoto: true,
    topFanSemana: true,
    produtoDestaque: true,
    cupomAtivo: false,
    marcoCliente: true,
    horarioPico: false,
  },
};

const RULE_META = [
  { key: "novoClienteFoto" as const, icon: "📸", label: "Cliente novo com foto",   desc: "Quando um cliente novo posta a primeira foto do pedido → aparece no feed", color: "#a855f7", badge: "UGC" },
  { key: "topFanSemana"    as const, icon: "👑", label: "Top fã da semana",         desc: "Destaca o cliente que mais comprou na semana no feed da cidade",            color: "#f5c518", badge: "Fidelidade" },
  { key: "produtoDestaque" as const, icon: "🔥", label: "Produto mais pedido",      desc: "O produto com mais pedidos da semana aparece como card no feed",            color: "#f97316", badge: "Cardápio" },
  { key: "cupomAtivo"      as const, icon: "🎟️", label: "Cupom ativo",              desc: "Quando um cupom está ativo, gera um card de promoção no feed",              color: "#06b6d4", badge: "Promoção" },
  { key: "marcoCliente"    as const, icon: "🏆", label: "Marco do cliente",         desc: "5°, 10°, 50° pedido do cliente → celebração aparece no feed",               color: "#22c55e", badge: "Engajamento" },
  { key: "horarioPico"     as const, icon: "⚡", label: "Boost horário de pico",    desc: "Seus cards aparecem com mais frequência entre 18h–21h",                     color: "#eab308", badge: "Alcance" },
];

// ─── TOGGLE ──────────────────────────────────────────────────
function Toggle({ value, onChange, color = "#22c55e" }: { value: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        position: "relative", width: 44, height: 24, borderRadius: 12,
        background: value ? color : "var(--bg3)",
        border: `1px solid ${value ? color : "var(--border)"}`,
        cursor: "pointer", transition: "all 0.25s", flexShrink: 0,
        boxShadow: value ? `0 0 10px ${color}60` : "none",
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: value ? 22 : 2,
        width: 18, height: 18, borderRadius: "50%",
        background: value ? "#fff" : "var(--text3)",
        transition: "left 0.25s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
      }} />
    </button>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────
export default function FeedRulesPanel({ tenantId }: { tenantId: string }) {
  const [config, setConfig] = useState<FeedRulesConfig>(DEFAULT_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    getDoc(doc(db, `tenants/${tenantId}/config/feed_rules`)).then(snap => {
      if (snap.exists()) setConfig(snap.data() as FeedRulesConfig);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [tenantId]);

  const updateRule = (key: keyof FeedRulesConfig["rules"], value: boolean) => {
    setConfig(prev => ({ ...prev, rules: { ...prev.rules, [key]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, `tenants/${tenantId}/config/feed_rules`), { ...config, updatedAt: serverTimestamp() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const activeRulesCount = Object.values(config.rules).filter(Boolean).length;
  const estimatedReach = config.autoMode ? config.slotsPerDia * 340 : 0;

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ width: 28, height: 28, border: "3px solid rgba(245,197,24,0.3)", borderTop: "3px solid #f5c518", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text)" }}>

      {/* ── MODO AUTO / MANUAL ────────────────────────────── */}
      <div style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 20, padding: "20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text)", marginBottom: 3 }}>
              📡 Modo do feed
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text3)" }}>
              {config.autoMode
                ? "O sistema identifica e publica automaticamente"
                : "Você publica manualmente no feed da cidade"}
            </div>
          </div>
          {/* Seletor modo */}
          <div style={{ display: "flex", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            {[
              { label: "⚡ Auto", value: true },
              { label: "✋ Manual", value: false },
            ].map(opt => (
              <button key={String(opt.value)} onClick={() => setConfig(p => ({ ...p, autoMode: opt.value }))}
                style={{ padding: "8px 16px", background: config.autoMode === opt.value ? "rgba(124,58,237,0.35)" : "transparent", border: "none", color: config.autoMode === opt.value ? "var(--text)" : "var(--text3)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", transition: "all 0.2s" }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Slots por dia */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text2)" }}>
              Slots por dia no feed da cidade
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.4rem", fontWeight: 900, color: "var(--gold)" }}>
              {config.slotsPerDia}
            </div>
          </div>
          <input
            type="range" min={1} max={20} value={config.slotsPerDia}
            onChange={e => setConfig(p => ({ ...p, slotsPerDia: Number(e.target.value) }))}
            disabled={!config.autoMode}
            style={{ width: "100%", accentColor: "var(--loja-cor-primaria, #f5c518)", cursor: config.autoMode ? "pointer" : "not-allowed", opacity: config.autoMode ? 1 : 0.4 }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text3)", marginTop: 4 }}>
            <span>1 slot/dia</span>
            <span style={{ color: "var(--gold)", fontWeight: 700 }}>~{estimatedReach.toLocaleString("pt-BR")} impressões/dia</span>
            <span>20 slots/dia</span>
          </div>
        </div>
      </div>

      {/* ── REGRAS ────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", fontWeight: 700 }}>
            Regras automáticas
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 20, padding: "3px 10px", fontSize: "0.68rem", fontWeight: 700, color: "#a855f7" }}>
            {activeRulesCount} ativas
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {RULE_META.map(rule => {
            const isOn = config.rules[rule.key];
            return (
              <div key={rule.key} style={{ background: isOn ? `${rule.color}10` : "var(--bg3)", border: `1px solid ${isOn ? rule.color + "30" : "var(--border)"}`, borderRadius: 16, padding: "14px 16px", transition: "all 0.25s", opacity: config.autoMode ? 1 : 0.5 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  {/* Ícone */}
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: isOn ? `${rule.color}20` : "var(--bg2)", border: `1px solid ${isOn ? rule.color + "40" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0, transition: "all 0.25s" }}>
                    {rule.icon}
                  </div>
                  {/* Texto */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: "0.85rem", color: isOn ? "var(--text)" : "var(--text3)" }}>{rule.label}</span>
                      <span style={{ fontSize: "0.58rem", fontWeight: 700, background: isOn ? `${rule.color}25` : "var(--bg2)", color: isOn ? rule.color : "var(--text3)", border: `1px solid ${isOn ? rule.color + "40" : "var(--border)"}`, borderRadius: 4, padding: "1px 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {rule.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text3)", lineHeight: 1.4 }}>{rule.desc}</div>

                    {/* Linha de lógica visual */}
                    {isOn && config.autoMode && (
                      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: "0.65rem" }}>
                        <span style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px", color: "var(--text3)" }}>{rule.icon} condição</span>
                        <span style={{ color: "var(--text3)" }}>→</span>
                        <span style={{ background: `${rule.color}18`, border: `1px solid ${rule.color}35`, borderRadius: 6, padding: "3px 8px", color: rule.color, fontWeight: 700 }}>true</span>
                        <span style={{ color: "var(--text3)" }}>→</span>
                        <span style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, padding: "3px 8px", color: "#22c55e", fontWeight: 700 }}>entra no feed 🚀</span>
                      </div>
                    )}
                  </div>
                  {/* Toggle */}
                  <Toggle value={isOn} onChange={v => updateRule(rule.key, v)} color={rule.color} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── LÓGICA EM EXECUÇÃO ───────────────────────────── */}
      {config.autoMode && (
        <div style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
          <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 14, fontWeight: 700 }}>
            O que acontece quando as regras disparam
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {config.rules.novoClienteFoto && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: 1 }}>📸</span>
                <div style={{ fontSize: "0.74rem", color: "var(--text2)", lineHeight: 1.5 }}>
                  <strong style={{ color: "#a855f7" }}>Cliente novo posta foto</strong> → card no feed: <em style={{ color: "var(--text3)" }}>"João acabou de descobrir esta loja"</em>
                </div>
              </div>
            )}
            {config.rules.topFanSemana && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: 1 }}>👑</span>
                <div style={{ fontSize: "0.74rem", color: "var(--text2)", lineHeight: 1.5 }}>
                  <strong style={{ color: "#f5c518" }}>Todo início de semana</strong> → card de fidelidade: <em style={{ color: "var(--text3)" }}>"Maria é a maior fã desta semana"</em>
                </div>
              </div>
            )}
            {config.rules.produtoDestaque && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: 1 }}>🔥</span>
                <div style={{ fontSize: "0.74rem", color: "var(--text2)", lineHeight: 1.5 }}>
                  <strong style={{ color: "#f97316" }}>Produto com 50+ pedidos na semana</strong> → vira destaque no feed da cidade
                </div>
              </div>
            )}
            {config.rules.cupomAtivo && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: 1 }}>🎟️</span>
                <div style={{ fontSize: "0.74rem", color: "var(--text2)", lineHeight: 1.5 }}>
                  <strong style={{ color: "#06b6d4" }}>Enquanto o cupom estiver ativo</strong> → card de promoção aparece automaticamente no feed
                </div>
              </div>
            )}
            {config.rules.marcoCliente && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: 1 }}>🏆</span>
                <div style={{ fontSize: "0.74rem", color: "var(--text2)", lineHeight: 1.5 }}>
                  <strong style={{ color: "#22c55e" }}>A cada 5°, 10°, 50° pedido</strong> → card de celebração no feed para aquele cliente
                </div>
              </div>
            )}
            {config.rules.horarioPico && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: 1 }}>⚡</span>
                <div style={{ fontSize: "0.74rem", color: "var(--text2)", lineHeight: 1.5 }}>
                  <strong style={{ color: "#eab308" }}>Das 18h às 21h</strong> → seus cards aparecem com o dobro de frequência no feed
                </div>
              </div>
            )}
            {activeRulesCount === 0 && (
              <div style={{ fontSize: "0.74rem", color: "var(--text3)" }}>Nenhuma regra ativa. Ative ao menos uma acima.</div>
            )}
          </div>
        </div>
      )}

      {/* ── SALVAR ────────────────────────────────────────── */}
      <button onClick={handleSave} disabled={saving}
        style={{ width: "100%", padding: "14px", background: saved ? "rgba(34,197,94,0.2)" : "linear-gradient(135deg, #7c3aed, #6d28d9)", border: saved ? "1px solid rgba(34,197,94,0.4)" : "none", borderRadius: 16, color: saved ? "#22c55e" : "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "0.95rem", cursor: saving ? "not-allowed" : "pointer", transition: "all 0.3s", opacity: saving ? 0.7 : 1 }}>
        {saving ? "Salvando..." : saved ? "✅ Regras salvas!" : "💾 Salvar regras do feed"}
      </button>
    </div>
  );
}
