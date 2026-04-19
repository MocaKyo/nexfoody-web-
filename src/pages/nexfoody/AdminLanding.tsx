import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../lib/firebase";

// ─── TYPES ────────────────────────────────────────────────────
interface DorCard { icon: string; title: string; desc: string; }
interface TikTokCard { imageUrl: string; emoji: string; name: string; store: string; price: string; tag: string; }
interface InovacaoCard { icon: string; titulo: string; desc: string; badge: string; cor: string; }

interface LandingData {
  hero: { headline: string; subtitle: string; badge: string; };
  stats: { lojas: number; clientes: number; pedidos: number; premios: number; };
  dor: DorCard[];
  crescimento: { titulo: string; desc: string; stat1Label: string; stat1Val: string; stat2Label: string; stat2Val: string; };
  chatIA: { titulo: string; desc: string; };
  gerenteIA: { titulo: string; desc: string; };
  social: { titulo: string; desc: string; };
  tikTok: TikTokCard[];
  inovacoes: InovacaoCard[];
}

const DEFAULT: LandingData = {
  hero: {
    headline: "A primeira rede social de delivery do Brasil.",
    subtitle: "Com a NexFoody suas vendas podem disparar.",
    badge: "LIVE — Plataforma ao vivo",
  },
  stats: { lojas: 127, clientes: 8432, pedidos: 24850, premios: 48 },
  dor: [
    { icon: "😤", title: "iFood leva até 27%", desc: "De cada R$100 que você vende, R$27 ficam pra eles. Todo mês, todo pedido." },
    { icon: "📵", title: "Dados não são seus", desc: "Os clientes são deles. Você não tem contato, não tem histórico, não tem controle." },
    { icon: "😩", title: "WhatsApp te consome", desc: "Fica olhando a tela esperando pedido, conferindo comprovante, respondendo a mesma pergunta mil vezes." },
    { icon: "😰", title: "Cliente não volta", desc: "Sem fidelização, sem relacionamento. Cada venda é como se fosse a primeira." },
  ],
  crescimento: {
    titulo: "Suas vendas podem disparar todo mês.",
    desc: "Lojas na NexFoody vendem mais porque os clientes voltam — não por obrigação, mas porque querem subir no ranking e resgatar prêmios.",
    stat1Label: "em 6 meses", stat1Val: "+340%",
    stat2Label: "clientes que voltam", stat2Val: "87%",
  },
  chatIA: {
    titulo: "O fim do atendimento estressante no WhatsApp.",
    desc: "Nosso robô humanizado sabe tudo da sua loja e de todos os produtos. Você não precisa ficar olhando a tela nem conferir comprovante.",
  },
  gerenteIA: {
    titulo: "Gerente IA — sabe tudo da sua loja.",
    desc: "Quantos pedidos foram feitos, quanto entrou, quanto foi no Pix, dinheiro ou cartão. Relatório em PDF com gráficos e comparativos.",
  },
  social: {
    titulo: "Seus clientes vendem por você — todo dia.",
    desc: "Enquanto outros apps vendem por você, a NexFoody faz seus clientes venderem por você — compartilhando, comentando e competindo.",
  },
  tikTok: [
    { imageUrl: "", emoji: "🍧", name: "Açaí Especial", store: "Puro Gosto", price: "R$22", tag: "🔥 Trend" },
    { imageUrl: "", emoji: "🍔", name: "Burguer Duplo", store: "Burguer Mais", price: "R$35", tag: "⭐ Top" },
    { imageUrl: "", emoji: "🍕", name: "Pizza 8 fatias", store: "Pizza da Vila", price: "R$48", tag: "🎉 Promo" },
    { imageUrl: "", emoji: "🥗", name: "Bowl Saudável", store: "Lanches Naturais", price: "R$28", tag: "✨ Novo" },
  ],
  inovacoes: [
    { icon: "📸", titulo: "Rede Social tipo Instagram", desc: "Cada loja tem seu próprio feed e stories.", badge: "Exclusivo NexFoody", cor: "#e1306c" },
    { icon: "🤖", titulo: "Gerente IA 24/7", desc: "Robô inteligente que recebe pedidos pelo chat, responde dúvidas e sugere pratos.", badge: "Powered by IA", cor: "#818cf8" },
    { icon: "💬", titulo: "Chat tipo WhatsApp", desc: "Pedidos direto pelo chat integrado. Sem terceiros, sem comissão.", badge: "Integrado", cor: "#25d366" },
    { icon: "🏆", titulo: "Gamificação & Ranking", desc: "Clientes ganham diamantes a cada compra e competem no ranking da cidade.", badge: "Viral", cor: "#f5c518" },
    { icon: "🎟️", titulo: "Cupons & Promoções", desc: "Crie e dispare ofertas em segundos. Fidelidade automática.", badge: "Incluso", cor: "#fb923c" },
    { icon: "📊", titulo: "Analytics em Tempo Real", desc: "Produtos mais vistos, horário de pico, taxa de conversão.", badge: "Dashboard", cor: "#22c55e" },
  ],
};

// ─── STYLES ───────────────────────────────────────────────────
const S = {
  page: { background: "#080412", minHeight: "100vh", color: "#fff", fontFamily: "'Outfit', sans-serif", padding: "0 0 80px" } as React.CSSProperties,
  header: { background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
  card: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "24px" } as React.CSSProperties,
  label: { fontSize: "0.72rem", color: "rgba(255,255,255,0.45)", marginBottom: 6, display: "block", textTransform: "uppercase" as const, letterSpacing: "0.08em" },
  input: { width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: "0.9rem", outline: "none", boxSizing: "border-box" as const },
  textarea: { width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: "0.9rem", outline: "none", resize: "vertical" as const, minHeight: 80, boxSizing: "border-box" as const },
  tab: (active: boolean): React.CSSProperties => ({ padding: "10px 20px", borderRadius: 10, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", border: "none", background: active ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.04)", color: active ? "#a855f7" : "rgba(255,255,255,0.5)", borderBottom: active ? "2px solid #a855f7" : "2px solid transparent" }),
  btnSave: { background: "linear-gradient(135deg,#f5c518,#e6a817)", color: "#000", border: "none", borderRadius: 12, padding: "12px 28px", fontWeight: 800, fontSize: "0.9rem", cursor: "pointer" } as React.CSSProperties,
  btnSecondary: { background: "rgba(255,255,255,0.07)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 16px", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer" } as React.CSSProperties,
};

// ─── IMAGE UPLOAD ─────────────────────────────────────────────
function ImageUpload({ value, onChange, path, label }: { value: string; onChange: (url: string) => void; path: string; label: string }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file) return;
    setUploading(true);
    const sRef = storageRef(storage, `landing/${path}/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(sRef, file);
    task.on("state_changed",
      snap => setProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
      () => setUploading(false),
      () => { getDownloadURL(task.snapshot.ref).then(url => { onChange(url); setUploading(false); setProgress(0); }); }
    );
  };

  return (
    <div>
      <label style={S.label}>{label}</label>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {value ? (
          <div style={{ position: "relative", width: 80, height: 80, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
            <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <button onClick={() => onChange("")} style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: "0.6rem", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        ) : (
          <div onClick={() => inputRef.current?.click()} style={{ width: 80, height: 80, borderRadius: 12, border: "2px dashed rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontSize: "1.5rem", color: "rgba(255,255,255,0.2)" }}>
            {uploading ? `${progress}%` : "📷"}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <button style={S.btnSecondary} onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? `Enviando... ${progress}%` : value ? "Trocar imagem" : "Selecionar imagem"}
          </button>
          {value && <div style={{ marginTop: 6, fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", wordBreak: "break-all" as const }}>{value.slice(0, 60)}...</div>}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────
export default function AdminLanding() {
  const [data, setData] = useState<LandingData>(DEFAULT);
  const [activeTab, setActiveTab] = useState("hero");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, "plataforma", "landingPage")).then(snap => {
      if (snap.exists()) setData({ ...DEFAULT, ...snap.data() as LandingData });
      setLoading(false);
    });
  }, []);

  const update = (path: string[], value: unknown) => {
    setData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      let cur = next;
      for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
      cur[path[path.length - 1]] = value;
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    await setDoc(doc(db, "plataforma", "landingPage"), data, { merge: true });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const TABS = [
    { id: "hero", label: "🏠 Hero" },
    { id: "stats", label: "📊 Números" },
    { id: "dor", label: "😤 Dores" },
    { id: "crescimento", label: "📈 Crescimento" },
    { id: "chatia", label: "🤖 Chat IA" },
    { id: "gerenteia", label: "🧠 Gerente IA" },
    { id: "social", label: "📸 Social" },
    { id: "tiktok", label: "🎬 TikTok Cards" },
    { id: "inovacoes", label: "⚡ Inovações" },
  ];

  if (loading) return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: 12 }}>⏳</div>
        <div style={{ color: "rgba(255,255,255,0.4)" }}>Carregando configurações...</div>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>🍓 Editor da Landing Page</div>
          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Edite textos e imagens sem tocar em código</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {saved && <div style={{ color: "#22c55e", fontSize: "0.82rem", fontWeight: 700 }}>✓ Salvo!</div>}
          <a href="/" target="_blank" style={{ ...S.btnSecondary, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
            👁 Ver landing
          </a>
          <button style={S.btnSave} onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "💾 Salvar tudo"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 32 }}>
          {TABS.map(t => (
            <button key={t.id} style={S.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {/* ── HERO ── */}
        {activeTab === "hero" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={S.card}>
              <h3 style={{ fontWeight: 800, marginBottom: 20, color: "#f5c518" }}>Hero — Primeira seção da página</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={S.label}>Título principal (headline)</label>
                  <input style={S.input} value={data.hero.headline} onChange={e => update(["hero","headline"], e.target.value)} />
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.25)", marginTop: 4 }}>A linha "A primeira rede social de delivery do Brasil."</div>
                </div>
                <div>
                  <label style={S.label}>Subtítulo</label>
                  <textarea style={S.textarea} value={data.hero.subtitle} onChange={e => update(["hero","subtitle"], e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Texto do badge LIVE</label>
                  <input style={S.input} value={data.hero.badge} onChange={e => update(["hero","badge"], e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STATS ── */}
        {activeTab === "stats" && (
          <div style={S.card}>
            <h3 style={{ fontWeight: 800, marginBottom: 20, color: "#f5c518" }}>Barra de Números</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { key: "lojas", label: "Lojas cadastradas" },
                { key: "clientes", label: "Clientes ativos" },
                { key: "pedidos", label: "Pedidos realizados" },
                { key: "premios", label: "Prêmios entregues" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label style={S.label}>{label}</label>
                  <input style={S.input} type="number" value={data.stats[key as keyof typeof data.stats]} onChange={e => update(["stats", key], Number(e.target.value))} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DOR ── */}
        {activeTab === "dor" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ ...S.card, paddingBottom: 12 }}>
              <h3 style={{ fontWeight: 800, marginBottom: 4, color: "#f5c518" }}>Seção "Dores" — 4 cards de problema</h3>
              <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>Mostre os problemas que o lojista tem hoje</div>
            </div>
            {data.dor.map((card, i) => (
              <div key={i} style={S.card}>
                <div style={{ fontWeight: 700, marginBottom: 16, color: "rgba(255,255,255,0.7)" }}>Card {i + 1}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={S.label}>Emoji / Ícone</label>
                    <input style={{ ...S.input, fontSize: "1.4rem", width: 80 }} value={card.icon} onChange={e => { const d = [...data.dor]; d[i] = { ...d[i], icon: e.target.value }; update(["dor"], d); }} />
                  </div>
                  <div>
                    <label style={S.label}>Título</label>
                    <input style={S.input} value={card.title} onChange={e => { const d = [...data.dor]; d[i] = { ...d[i], title: e.target.value }; update(["dor"], d); }} />
                  </div>
                  <div>
                    <label style={S.label}>Descrição</label>
                    <textarea style={S.textarea} value={card.desc} onChange={e => { const d = [...data.dor]; d[i] = { ...d[i], desc: e.target.value }; update(["dor"], d); }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CRESCIMENTO ── */}
        {activeTab === "crescimento" && (
          <div style={S.card}>
            <h3 style={{ fontWeight: 800, marginBottom: 20, color: "#f5c518" }}>Seção Crescimento + Gráfico</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={S.label}>Título</label>
                <input style={S.input} value={data.crescimento.titulo} onChange={e => update(["crescimento","titulo"], e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Descrição</label>
                <textarea style={S.textarea} value={data.crescimento.desc} onChange={e => update(["crescimento","desc"], e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={S.label}>Stat 1 — Valor</label>
                  <input style={S.input} value={data.crescimento.stat1Val} onChange={e => update(["crescimento","stat1Val"], e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Stat 1 — Label</label>
                  <input style={S.input} value={data.crescimento.stat1Label} onChange={e => update(["crescimento","stat1Label"], e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Stat 2 — Valor</label>
                  <input style={S.input} value={data.crescimento.stat2Val} onChange={e => update(["crescimento","stat2Val"], e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Stat 2 — Label</label>
                  <input style={S.input} value={data.crescimento.stat2Label} onChange={e => update(["crescimento","stat2Label"], e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CHAT IA ── */}
        {activeTab === "chatia" && (
          <div style={S.card}>
            <h3 style={{ fontWeight: 800, marginBottom: 20, color: "#f5c518" }}>Seção Chat IA (Sugestão 1)</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={S.label}>Título</label>
                <input style={S.input} value={data.chatIA.titulo} onChange={e => update(["chatIA","titulo"], e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Descrição</label>
                <textarea style={S.textarea} value={data.chatIA.desc} onChange={e => update(["chatIA","desc"], e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* ── GERENTE IA ── */}
        {activeTab === "gerenteia" && (
          <div style={S.card}>
            <h3 style={{ fontWeight: 800, marginBottom: 20, color: "#f5c518" }}>Seção Gerente IA (Sugestão 2)</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={S.label}>Título</label>
                <input style={S.input} value={data.gerenteIA.titulo} onChange={e => update(["gerenteIA","titulo"], e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Descrição</label>
                <textarea style={S.textarea} value={data.gerenteIA.desc} onChange={e => update(["gerenteIA","desc"], e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* ── SOCIAL ── */}
        {activeTab === "social" && (
          <div style={S.card}>
            <h3 style={{ fontWeight: 800, marginBottom: 20, color: "#f5c518" }}>Seção Rede Social + Gamificação</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={S.label}>Título</label>
                <input style={S.input} value={data.social.titulo} onChange={e => update(["social","titulo"], e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Descrição</label>
                <textarea style={S.textarea} value={data.social.desc} onChange={e => update(["social","desc"], e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* ── TIKTOK ── */}
        {activeTab === "tiktok" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ ...S.card, paddingBottom: 12 }}>
              <h3 style={{ fontWeight: 800, marginBottom: 4, color: "#f5c518" }}>Cards estilo TikTok — 4 produtos em destaque</h3>
              <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>
                Suba uma foto real do produto — se não tiver foto, o emoji será usado
              </div>
            </div>
            {data.tikTok.map((card, i) => (
              <div key={i} style={S.card}>
                <div style={{ fontWeight: 700, marginBottom: 16, color: "rgba(255,255,255,0.7)" }}>Card {i + 1}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <ImageUpload
                      value={card.imageUrl}
                      path={`tiktok/${i}`}
                      label="Foto do produto (aparece no card)"
                      onChange={url => { const t = [...data.tikTok]; t[i] = { ...t[i], imageUrl: url }; update(["tikTok"], t); }}
                    />
                  </div>
                  <div>
                    <label style={S.label}>Emoji (backup sem foto)</label>
                    <input style={{ ...S.input, fontSize: "1.4rem", width: 80 }} value={card.emoji} onChange={e => { const t = [...data.tikTok]; t[i] = { ...t[i], emoji: e.target.value }; update(["tikTok"], t); }} />
                  </div>
                  <div>
                    <label style={S.label}>Tag (ex: 🔥 Trend)</label>
                    <input style={S.input} value={card.tag} onChange={e => { const t = [...data.tikTok]; t[i] = { ...t[i], tag: e.target.value }; update(["tikTok"], t); }} />
                  </div>
                  <div>
                    <label style={S.label}>Nome do produto</label>
                    <input style={S.input} value={card.name} onChange={e => { const t = [...data.tikTok]; t[i] = { ...t[i], name: e.target.value }; update(["tikTok"], t); }} />
                  </div>
                  <div>
                    <label style={S.label}>Nome da loja</label>
                    <input style={S.input} value={card.store} onChange={e => { const t = [...data.tikTok]; t[i] = { ...t[i], store: e.target.value }; update(["tikTok"], t); }} />
                  </div>
                  <div>
                    <label style={S.label}>Preço (ex: R$22)</label>
                    <input style={S.input} value={card.price} onChange={e => { const t = [...data.tikTok]; t[i] = { ...t[i], price: e.target.value }; update(["tikTok"], t); }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── INOVAÇÕES ── */}
        {activeTab === "inovacoes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ ...S.card, paddingBottom: 12 }}>
              <h3 style={{ fontWeight: 800, marginBottom: 4, color: "#f5c518" }}>Cards de Inovação — 6 diferenciais</h3>
            </div>
            {data.inovacoes.map((card, i) => (
              <div key={i} style={S.card}>
                <div style={{ fontWeight: 700, marginBottom: 16, color: "rgba(255,255,255,0.7)" }}>Inovação {i + 1}</div>
                <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={S.label}>Emoji</label>
                    <input style={{ ...S.input, fontSize: "1.4rem", textAlign: "center" }} value={card.icon} onChange={e => { const n = [...data.inovacoes]; n[i] = { ...n[i], icon: e.target.value }; update(["inovacoes"], n); }} />
                  </div>
                  <div>
                    <label style={S.label}>Título</label>
                    <input style={S.input} value={card.titulo} onChange={e => { const n = [...data.inovacoes]; n[i] = { ...n[i], titulo: e.target.value }; update(["inovacoes"], n); }} />
                  </div>
                  <div>
                    <label style={S.label}>Badge</label>
                    <input style={S.input} value={card.badge} onChange={e => { const n = [...data.inovacoes]; n[i] = { ...n[i], badge: e.target.value }; update(["inovacoes"], n); }} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={S.label}>Descrição</label>
                    <textarea style={S.textarea} value={card.desc} onChange={e => { const n = [...data.inovacoes]; n[i] = { ...n[i], desc: e.target.value }; update(["inovacoes"], n); }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Save bottom */}
        <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end", gap: 12, alignItems: "center" }}>
          {saved && <div style={{ color: "#22c55e", fontSize: "0.82rem", fontWeight: 700 }}>✓ Alterações salvas!</div>}
          <button style={S.btnSave} onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "💾 Salvar tudo"}
          </button>
        </div>
      </div>
    </div>
  );
}
