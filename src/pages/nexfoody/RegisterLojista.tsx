import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { doc, setDoc, serverTimestamp, updateDoc, collection, query, where, getDocs, increment } from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { db, auth } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import PlaceSearch from "../../components/PlaceSearch";

const CATEGORIAS = [
  { value: "açaí",       label: "Açaí",       icon: "🍧", food: true  },
  { value: "sorvetes",   label: "Sorvetes",   icon: "🍦", food: true  },
  { value: "hamburguer", label: "Hambúrguer", icon: "🍔", food: true  },
  { value: "pizza",      label: "Pizza",      icon: "🍕", food: true  },
  { value: "lanches",    label: "Lanches",    icon: "🥪", food: true  },
  { value: "sucos",      label: "Sucos",      icon: "🥤", food: true  },
  { value: "doces",      label: "Doces",      icon: "🍰", food: true  },
  { value: "outro",      label: "Outro negócio", icon: "🛍️", food: false },
];

const slide = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -40 },
  transition: { duration: 0.3 },
};

export default function RegisterLojista() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref")?.toUpperCase() || "";

  // Etapa atual: 0=welcome, 1=loja, 2=localização, 3=conta, 4=sucesso
  const [etapa, setEtapa] = useState(0);

  // Campos
  const [nome,      setNome]      = useState("");
  const [email,     setEmail]     = useState("");
  const [telefone,  setTelefone]  = useState("");
  const [senha,     setSenha]     = useState("");
  const [nomeLoja,  setNomeLoja]  = useState("");
  const [slug,      setSlug]      = useState("");
  const [categoria, setCategoria] = useState("açaí");
  const [categoriaLivre, setCategoriaLivre] = useState("");
  const [placeId,   setPlaceId]   = useState("");
  const [cidade,    setCidade]    = useState("");
  const [estado,    setEstado]    = useState("SP");
  const [lat,       setLat]       = useState<number | null>(null);
  const [lng,       setLng]       = useState<number | null>(null);
  const [raioKm,    setRaioKm]    = useState(10);

  const [detectandoLoc, setDetectandoLoc] = useState(false);
  const [locDetectada,  setLocDetectada]  = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");

  const generateSlug = (v: string) =>
    v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleNomeLoja = (v: string) => { setNomeLoja(v); setSlug(generateSlug(v)); };

  const detectarLocalizacao = () => {
    if (!navigator.geolocation) { setError("Geolocalização não suportada"); return; }
    setDetectandoLoc(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&accept-language=pt-BR`);
        const data = await res.json();
        const c = data.address?.city || data.address?.town || data.address?.municipality || data.address?.village || "";
        const e = data.address?.state_code || "";
        if (c) setCidade(c);
        if (e && e.length === 2) setEstado(e.toUpperCase());
        setLat(coords.latitude); setLng(coords.longitude); setLocDetectada(true);
      } catch { setError("Não foi possível identificar sua cidade."); }
      finally { setDetectandoLoc(false); }
    }, () => { setError("Permissão negada. Preencha manualmente."); setDetectandoLoc(false); });
  };

  const handleSubmit = async () => {
    if (!nome || !email || !nomeLoja || !slug) return;
    if (!cidade.trim()) { setError("Informe a cidade da loja"); return; }
    setLoading(true); setError("");
    try {
      let uid: string;
      if (user) {
        uid = user.uid;
        if (nome) await updateProfile(user, { displayName: nome });
        await updateDoc(doc(db, "users", uid), { nome, telefone, role: "lojista", lojistaOf: slug, inviteCode: `NEX${uid.substring(0,6).toUpperCase()}` });
      } else {
        if (!senha) { setError("Senha obrigatória"); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, senha);
        uid = cred.user.uid;
        await updateProfile(cred.user, { displayName: nome });
        await setDoc(doc(db, "users", uid), { nome, email, telefone, pontos: 0, rankingPts: 0, cashback: 0, role: "lojista", following: [], favoritos: [], lojistaOf: slug, inviteCode: `NEX${uid.substring(0,6).toUpperCase()}`, createdAt: serverTimestamp() });
      }

      await setDoc(doc(db, "lojas", slug), {
        tenantId: slug, nome: nomeLoja, slug, logo: "", capa: "", categoria: categoria === "outro" && categoriaLivre ? categoriaLivre : categoria, desc: "", ativo: true,
        ownerId: uid, refBy: refCode || null, cidade, estado,
        ...(placeId ? { placeId } : {}),
        ...(lat && lng ? { lat, lng, raioKm } : {}),
        createdAt: serverTimestamp(),
      }, { merge: true });

      if (refCode?.startsWith("NEX")) {
        try {
          const refSnap = await getDocs(query(collection(db, "users"), where("inviteCode", "==", refCode)));
          if (!refSnap.empty) {
            const eid = refSnap.docs[0].id;
            await updateDoc(doc(db, "users", eid), { rankingPts: increment(500), pontos: increment(500) });
            await setDoc(doc(db, "carteiras", eid), { saldoDisponivel: increment(10), saldoPendente: increment(10), totalGanho: increment(10) }, { merge: true });
            if (placeId) {
              await setDoc(doc(db, "convites", `${eid}_${placeId}`), { status: "cadastrado", lojaSlug: slug, creditoCadastro: 10, cadastradoAt: serverTimestamp() }, { merge: true });
              await setDoc(doc(db, "carteiras", eid), { lojasAtivas: increment(1) }, { merge: true });
            }
          }
        } catch {}
      }

      await setDoc(doc(db, `tenants/${slug}/config/loja`), {
        tenantId: slug, nomeLoja, logoUrl: "", imagemCapa: "", horario: "", whatsapp: telefone,
        pixKey: "", nomeRecebedorPix: "", cidadePix: "", pontosPorReal: 1, endereco: "",
        mensagemPausa: "Loja temporariamente fechada", instagram: "", cardapioAtivo: true,
        pausaManual: false, horarioAutomatico: false, horarioAbertura: "09:00", horarioFechamento: "22:00",
        suporteAtivo: true, tempoMin: 30, tempoMax: 60, tema: "dark", ativo: true,
        chamadaCupom: ["🎉 5% de desconto!"], rankingPtsComentario: 15, rankingPtsPedido: 10, rankingPtsPorReal: 1,
      }, { merge: true });

      setEtapa(4);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao criar conta";
      if (msg.includes("email-already-in-use")) setError("Email já cadastrado. Tente fazer login.");
      else if (msg.includes("weak-password")) setError("Senha deve ter pelo menos 6 caracteres");
      else setError(msg);
    } finally { setLoading(false); }
  };

  const catAtual = CATEGORIAS.find(c => c.value === categoria);

  // ── ESTILOS COMPARTILHADOS ────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 14, padding: "14px 16px", color: "#fff", fontFamily: "'Outfit',sans-serif",
    fontSize: "0.95rem", outline: "none", boxSizing: "border-box",
  };
  const btnGold: React.CSSProperties = {
    width: "100%", background: "linear-gradient(135deg,#f5c518,#e6a817)", border: "none",
    borderRadius: 20, padding: "16px", fontWeight: 900, fontSize: "1rem", color: "#0a0414",
    cursor: "pointer", fontFamily: "'Outfit',sans-serif",
  };
  const btnOutline: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 20, padding: "14px", fontWeight: 700, fontSize: "0.9rem", color: "rgba(255,255,255,.6)",
    cursor: "pointer", fontFamily: "'Outfit',sans-serif",
  };

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(160deg,#0a0414 0%,#1a0a36 50%,#0a0414 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px", fontFamily: "'Outfit',sans-serif", position: "relative", overflow: "hidden" }}>

      {/* Brilhos de fundo */}
      <div style={{ position: "fixed", top: -100, left: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(124,58,237,.2),transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(245,197,24,.1),transparent 70%)", pointerEvents: "none" }} />

      {/* Barra de progresso (etapas 1-3) */}
      {etapa >= 1 && etapa <= 3 && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50 }}>
          <div style={{ height: 3, background: "rgba(255,255,255,.08)" }}>
            <motion.div animate={{ width: `${(etapa / 3) * 100}%` }} transition={{ duration: 0.4 }}
              style={{ height: "100%", background: "linear-gradient(90deg,#7c3aed,#f5c518)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 20px" }}>
            <button onClick={() => setEtapa(e => e - 1)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 4 }}>
              ← Voltar
            </button>
            <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.3)", fontWeight: 700 }}>
              {etapa} de 3
            </span>
          </div>
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 420, position: "relative" }}>
        <AnimatePresence mode="wait">

          {/* ── ETAPA 0: WELCOME ─────────────────────────────── */}
          {etapa === 0 && (
            <motion.div key="welcome" {...slide}>
              {/* Mini mockup do app */}
              <div style={{ position: "relative", marginBottom: 32, display: "flex", justifyContent: "center" }}>
                <div style={{ width: 200, height: 340, borderRadius: 28, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", overflow: "hidden", position: "relative", boxShadow: "0 0 60px rgba(124,58,237,.3)" }}>
                  {/* Simula feed TikTok */}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg,#1a0a36,#7c3aed)" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#f5c518,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 800, color: "#fff" }}>
                        {nomeLoja ? nomeLoja[0].toUpperCase() : "L"}
                      </div>
                      <div>
                        <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "#fff" }}>{nomeLoja || "Sua Loja"}</div>
                        <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,.5)" }}>Parceiro NexFoody</div>
                      </div>
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.8)", marginBottom: 10, lineHeight: 1.4 }}>
                      {catAtual?.icon} {categoria === "outro" ? "Seu produto" : catAtual?.label} fresquinho esperando seus clientes! 😍
                    </div>
                    <div style={{ background: "rgba(245,197,24,.15)", border: "1px solid rgba(245,197,24,.3)", borderRadius: 10, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.6rem", color: "#fff", fontWeight: 700 }}>{nomeLoja || "Sua Loja"}</span>
                      <span style={{ fontSize: "0.6rem", background: "#f5c518", color: "#0a0414", borderRadius: 8, padding: "3px 8px", fontWeight: 800 }}>Pedir →</span>
                    </div>
                  </div>
                  {/* Sidebar social */}
                  <div style={{ position: "absolute", right: 10, bottom: 100, display: "flex", flexDirection: "column", gap: 8 }}>
                    {["❤️","💬","🔖"].map((ic, i) => (
                      <div key={i} style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem" }}>{ic}</div>
                    ))}
                  </div>
                  {/* Top bar */}
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 40, background: "linear-gradient(to bottom,rgba(0,0,0,.5),transparent)", display: "flex", alignItems: "center", padding: "0 12px" }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 900, color: "#f5c518" }}>🍓 NexFoody</div>
                  </div>
                </div>

                {/* Badges flutuantes */}
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2.5 }}
                  style={{ position: "absolute", top: 20, right: 20, background: "rgba(34,197,94,.2)", border: "1px solid rgba(34,197,94,.4)", borderRadius: 20, padding: "6px 12px", fontSize: "0.7rem", fontWeight: 800, color: "#22c55e", whiteSpace: "nowrap" }}>
                  🤖 IA atendendo
                </motion.div>
                <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 3, delay: 0.5 }}
                  style={{ position: "absolute", bottom: 40, left: 10, background: "rgba(245,197,24,.2)", border: "1px solid rgba(245,197,24,.4)", borderRadius: 20, padding: "6px 12px", fontSize: "0.7rem", fontWeight: 800, color: "#f5c518", whiteSpace: "nowrap" }}>
                  🛒 +1 pedido
                </motion.div>
              </div>

              {/* Texto de impacto */}
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: "clamp(2rem,7vw,2.8rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: 12, color: "#fff" }}>
                  Sua loja.<br />
                  <span style={{ background: "linear-gradient(135deg,#f5c518,#a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    Seu app. Seus clientes.
                  </span>
                </h1>
                <p style={{ color: "rgba(255,255,255,.5)", fontSize: "0.95rem", lineHeight: 1.6 }}>
                  Em minutos você tem cardápio digital, pedidos online, IA que atende 24h e rede social da sua loja — tudo junto.
                </p>
              </div>

              {refCode && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(245,197,24,.08)", border: "1px solid rgba(245,197,24,.2)", borderRadius: 14, padding: "12px 16px", marginBottom: 16 }}>
                  <span style={{ fontSize: "1.4rem" }}>🎁</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "0.82rem", color: "#f5c518" }}>Você foi indicado!</div>
                    <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.45)" }}>Código <strong style={{ color: "#f5c518" }}>{refCode}</strong> aplicado automaticamente.</div>
                  </div>
                </div>
              )}

              <motion.button whileTap={{ scale: 0.98 }} onClick={() => setEtapa(1)} style={btnGold}>
                Quero isso →
              </motion.button>
              <p style={{ textAlign: "center", marginTop: 14, fontSize: "0.75rem", color: "rgba(255,255,255,.3)" }}>
                Grátis até 20 pedidos/mês · Sem cartão de crédito
              </p>
              <p style={{ textAlign: "center", marginTop: 8, fontSize: "0.78rem", color: "rgba(255,255,255,.35)" }}>
                Só quer um cardápio para compartilhar?{" "}
                <Link to="/lojista/catalogo" style={{ color: "#4ade80", textDecoration: "none", fontWeight: 700 }}>Criar catálogo grátis</Link>
              </p>
              <p style={{ textAlign: "center", marginTop: 6, fontSize: "0.78rem", color: "rgba(255,255,255,.35)" }}>
                Já tem conta? <Link to="/lojista/login" style={{ color: "#a78bfa", textDecoration: "none", fontWeight: 700 }}>Entrar</Link>
              </p>
            </motion.div>
          )}

          {/* ── ETAPA 1: A LOJA ──────────────────────────────── */}
          {etapa === 1 && (
            <motion.div key="loja" {...slide} style={{ paddingTop: 60 }}>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#a78bfa", fontWeight: 700, marginBottom: 8 }}>Etapa 1</div>
                <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: "clamp(1.6rem,5vw,2.2rem)", fontWeight: 900, lineHeight: 1.1, color: "#fff", marginBottom: 8 }}>
                  Como se chama<br />
                  <span style={{ background: "linear-gradient(135deg,#f5c518,#a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    sua loja?
                  </span>
                </h2>
                <p style={{ color: "rgba(255,255,255,.4)", fontSize: "0.85rem" }}>Você pode mudar isso depois.</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <input style={inputStyle} placeholder="Ex: Açaí da Dona Maria" value={nomeLoja}
                    onChange={e => handleNomeLoja(e.target.value)} autoFocus />
                  {slug && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                      style={{ marginTop: 6, fontSize: "0.72rem", color: "rgba(255,255,255,.4)", paddingLeft: 4 }}>
                      🔗 nexfoody.com/loja/<span style={{ color: "#a78bfa", fontWeight: 700 }}>{slug}</span>
                    </motion.div>
                  )}
                </div>

                {/* Categoria em grid */}
                <div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.4)", marginBottom: 10, paddingLeft: 2 }}>Qual o tipo da sua loja?</div>
                  {/* Comidas em destaque */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 8 }}>
                    {CATEGORIAS.filter(c => c.food).map(cat => (
                      <motion.button whileTap={{ scale: 0.95 }} key={cat.value} type="button"
                        onClick={() => setCategoria(cat.value)}
                        style={{ background: categoria === cat.value ? "rgba(124,58,237,.3)" : "rgba(255,255,255,.04)", border: `1.5px solid ${categoria === cat.value ? "rgba(124,58,237,.7)" : "rgba(255,255,255,.08)"}`, borderRadius: 14, padding: "12px 6px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "1.4rem" }}>{cat.icon}</span>
                        <span style={{ fontSize: "0.62rem", fontWeight: 700, color: categoria === cat.value ? "#a78bfa" : "rgba(255,255,255,.45)" }}>{cat.label}</span>
                      </motion.button>
                    ))}
                  </div>
                  {/* Outro negócio — separado visualmente */}
                  <motion.button whileTap={{ scale: 0.98 }} type="button"
                    onClick={() => setCategoria("outro")}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: categoria === "outro" ? "rgba(99,102,241,.2)" : "rgba(255,255,255,.03)", border: `1.5px solid ${categoria === "outro" ? "rgba(99,102,241,.6)" : "rgba(255,255,255,.08)"}`, borderRadius: 14, padding: "12px 16px", cursor: "pointer" }}>
                    <span style={{ fontSize: "1.4rem" }}>🛍️</span>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: categoria === "outro" ? "#a5b4fc" : "rgba(255,255,255,.5)" }}>Outro tipo de negócio</div>
                      <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.3)" }}>Moda, adesivos, pet shop, farmácia...</div>
                    </div>
                  </motion.button>
                  {/* Campo livre quando "outro" selecionado */}
                  <AnimatePresence>
                    {categoria === "outro" && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden", marginTop: 8 }}>
                        <input style={inputStyle} placeholder="Ex: Adesivos K-Pop, Brechó, Pet Shop..." value={categoriaLivre}
                          onChange={e => setCategoriaLivre(e.target.value)} autoFocus />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {error && <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 12, padding: "10px 14px", color: "#fca5a5", fontSize: "0.82rem" }}>{error}</div>}

                <motion.button whileTap={{ scale: 0.98 }} onClick={() => { if (!nomeLoja) { setError("Digite o nome da loja"); return; } setError(""); setEtapa(2); }} style={btnGold}>
                  Continuar →
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── ETAPA 2: LOCALIZAÇÃO ─────────────────────────── */}
          {etapa === 2 && (
            <motion.div key="loc" {...slide} style={{ paddingTop: 60 }}>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#a78bfa", fontWeight: 700, marginBottom: 8 }}>Etapa 2</div>
                <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: "clamp(1.6rem,5vw,2.2rem)", fontWeight: 900, lineHeight: 1.1, color: "#fff", marginBottom: 8 }}>
                  Onde fica<br />
                  <span style={{ background: "linear-gradient(135deg,#f5c518,#a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {nomeLoja || "sua loja"}?
                  </span>
                </h2>
                <p style={{ color: "rgba(255,255,255,.4)", fontSize: "0.85rem" }}>Clientes próximos vão te encontrar no feed.</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Detectar automático */}
                <motion.button whileTap={{ scale: 0.98 }} type="button" onClick={detectarLocalizacao} disabled={detectandoLoc}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: locDetectada ? "rgba(34,197,94,.12)" : "rgba(124,58,237,.12)", border: `1.5px solid ${locDetectada ? "rgba(34,197,94,.4)" : "rgba(124,58,237,.4)"}`, borderRadius: 16, padding: "16px", cursor: "pointer", color: locDetectada ? "#22c55e" : "#a78bfa", fontWeight: 800, fontSize: "0.9rem", fontFamily: "'Outfit',sans-serif" }}>
                  <span style={{ fontSize: "1.2rem" }}>{detectandoLoc ? "⏳" : locDetectada ? "✓" : "🎯"}</span>
                  {detectandoLoc ? "Detectando sua cidade..." : locDetectada ? `${cidade} - ${estado} detectado!` : "Detectar minha localização"}
                </motion.button>

                {/* Manual */}
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={{ ...inputStyle, flex: 1 }} placeholder="Cidade" value={cidade} onChange={e => setCidade(e.target.value)} />
                  <select style={{ ...inputStyle, width: 76, flexShrink: 0, cursor: "pointer" }} value={estado} onChange={e => setEstado(e.target.value)}>
                    {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>

                {/* Raio de entrega */}
                <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "rgba(255,255,255,.7)" }}>🛵 Raio de entrega</span>
                    <span style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, color: "#f5c518", fontSize: "1.2rem" }}>{raioKm} km</span>
                  </div>
                  <input type="range" min={1} max={50} step={1} value={raioKm}
                    onChange={e => setRaioKm(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#f5c518", cursor: "pointer" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", color: "rgba(255,255,255,.25)", marginTop: 6 }}>
                    <span>1 km</span><span>25 km</span><span>50 km</span>
                  </div>
                  <div style={{ marginTop: 10, textAlign: "center", fontSize: "0.75rem", color: "rgba(255,255,255,.35)" }}>
                    Você entrega em até <strong style={{ color: "#f5c518" }}>{raioKm} km</strong> da sua loja
                  </div>
                </div>

                {/* Google Maps (opcional) */}
                <div style={{ background: "rgba(245,197,24,.04)", border: "1px solid rgba(245,197,24,.15)", borderRadius: 14, padding: "12px 14px" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(245,197,24,.7)", marginBottom: 8 }}>
                    📍 Vincular ao Google Maps <span style={{ color: "rgba(255,255,255,.25)", fontWeight: 400 }}>(opcional)</span>
                  </div>
                  <PlaceSearch placeholder="Busque sua loja no Google Maps..." onSelect={(id) => setPlaceId(id)} />
                  {placeId && <div style={{ marginTop: 6, fontSize: "0.7rem", color: "#22c55e" }}>✓ Loja vinculada ao mapa</div>}
                </div>

                {error && <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 12, padding: "10px 14px", color: "#fca5a5", fontSize: "0.82rem" }}>{error}</div>}

                <motion.button whileTap={{ scale: 0.98 }} onClick={() => { if (!cidade) { setError("Informe a cidade"); return; } setError(""); setEtapa(3); }} style={btnGold}>
                  Continuar →
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── ETAPA 3: CONTA ───────────────────────────────── */}
          {etapa === 3 && (
            <motion.div key="conta" {...slide} style={{ paddingTop: 60 }}>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#a78bfa", fontWeight: 700, marginBottom: 8 }}>Último passo</div>
                <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: "clamp(1.6rem,5vw,2.2rem)", fontWeight: 900, lineHeight: 1.1, color: "#fff", marginBottom: 8 }}>
                  Crie sua conta<br />
                  <span style={{ background: "linear-gradient(135deg,#f5c518,#a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    e sua loja vai ao ar.
                  </span>
                </h2>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input style={inputStyle} placeholder="Seu nome completo" value={nome} onChange={e => setNome(e.target.value)} autoFocus />
                <input style={inputStyle} type="email" placeholder="Seu melhor email" value={email} onChange={e => setEmail(e.target.value)} />
                <input style={inputStyle} type="tel" placeholder="WhatsApp (opcional)" value={telefone} onChange={e => setTelefone(e.target.value)} />
                {!user && <input style={inputStyle} type="password" placeholder="Senha (mín. 6 caracteres)" value={senha} onChange={e => setSenha(e.target.value)} />}

                {error && <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 12, padding: "10px 14px", color: "#fca5a5", fontSize: "0.82rem" }}>{error}</div>}

                <motion.button whileTap={{ scale: 0.98 }} onClick={handleSubmit} disabled={loading}
                  style={{ ...btnGold, opacity: loading ? 0.7 : 1 }}>
                  {loading ? "Criando sua loja..." : "Criar minha loja →"}
                </motion.button>

                <p style={{ textAlign: "center", fontSize: "0.7rem", color: "rgba(255,255,255,.25)", lineHeight: 1.5 }}>
                  Ao criar sua conta você concorda com nossos termos de uso.
                </p>
              </div>
            </motion.div>
          )}

          {/* ── ETAPA 4: SUCESSO 🎉 ──────────────────────────── */}
          {etapa === 4 && (
            <motion.div key="sucesso" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: "center" }}>
              {/* Confete animado */}
              <div style={{ position: "relative", marginBottom: 24 }}>
                {["🎉","⭐","🍓","✨","🎊","💛"].map((em, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 0, x: 0 }}
                    animate={{ opacity: [0, 1, 0], y: -80 - i * 20, x: (i % 2 === 0 ? 1 : -1) * (20 + i * 15) }}
                    transition={{ delay: i * 0.15, duration: 1.2 }}
                    style={{ position: "absolute", top: 60, left: "50%", fontSize: "1.4rem", pointerEvents: "none" }}>
                    {em}
                  </motion.div>
                ))}
                <motion.div animate={{ scale: [1, 1.1, 1], rotate: [0, -5, 5, 0] }} transition={{ repeat: 2, duration: 0.5 }}
                  style={{ fontSize: "5rem", display: "block" }}>
                  🏪
                </motion.div>
              </div>

              <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: "clamp(1.8rem,6vw,2.6rem)", fontWeight: 900, color: "#fff", marginBottom: 8, lineHeight: 1.1 }}>
                Sua loja está<br />
                <span style={{ background: "linear-gradient(135deg,#22c55e,#f5c518)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  no ar! 🎉
                </span>
              </h2>
              <p style={{ color: "rgba(255,255,255,.5)", marginBottom: 10, fontSize: "0.95rem" }}>
                <strong style={{ color: "#f5c518" }}>{nomeLoja}</strong> já tem seu link:
              </p>
              <div style={{ background: "rgba(124,58,237,.15)", border: "1px solid rgba(124,58,237,.3)", borderRadius: 12, padding: "10px 16px", marginBottom: 28, fontSize: "0.85rem", color: "#a78bfa", fontWeight: 700 }}>
                nexfoody.com/loja/{slug}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <motion.button whileTap={{ scale: 0.98 }} onClick={() => navigate("/lojista/dashboard", { replace: true })} style={btnGold}>
                  Ir para o admin da minha loja →
                </motion.button>
                <motion.button whileTap={{ scale: 0.98 }} onClick={() => window.open(`/loja/${slug}`, "_blank")} style={btnOutline}>
                  Ver modelo da loja
                </motion.button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
