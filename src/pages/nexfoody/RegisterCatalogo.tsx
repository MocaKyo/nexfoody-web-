import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { doc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { db, auth } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";

const CATEGORIAS = [
  { value: "açaí",       label: "Açaí",       icon: "🍧" },
  { value: "sorvetes",   label: "Sorvetes",   icon: "🍦" },
  { value: "hamburguer", label: "Hambúrguer", icon: "🍔" },
  { value: "pizza",      label: "Pizza",      icon: "🍕" },
  { value: "lanches",    label: "Lanches",    icon: "🥪" },
  { value: "sucos",      label: "Sucos",      icon: "🥤" },
  { value: "doces",      label: "Doces",      icon: "🍰" },
  { value: "restaurante", label: "Restaurante", icon: "🍽️" },
  { value: "outro",      label: "Outro",       icon: "🛍️" },
];

const slide = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -40 },
  transition: { duration: 0.3 },
};

export default function RegisterCatalogo() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [etapa, setEtapa] = useState(0);

  // Loja
  const [nomeLoja,  setNomeLoja]  = useState("");
  const [slug,      setSlug]      = useState("");
  const [categoria, setCategoria] = useState("açaí");
  const [categoriaLivre, setCategoriaLivre] = useState("");

  // Conta
  const [nome,     setNome]     = useState("");
  const [email,    setEmail]    = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidade,   setCidade]   = useState("");
  const [senha,    setSenha]    = useState("");

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const generateSlug = (v: string) =>
    v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleNomeLoja = (v: string) => { setNomeLoja(v); setSlug(generateSlug(v)); };

  const catalogUrl = `${window.location.origin}/loja/${slug}`;
  const qrUrl      = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(catalogUrl)}&bgcolor=0d0820&color=f5c518&margin=10`;

  const handleSubmit = async () => {
    if (!nome || !email || !nomeLoja || !slug) return;
    setLoading(true); setError("");
    try {
      let uid: string;
      if (user) {
        uid = user.uid;
        if (nome) await updateProfile(user, { displayName: nome });
        await updateDoc(doc(db, "users", uid), {
          nome, telefone, role: "lojista", lojistaOf: slug,
          inviteCode: `NEX${uid.substring(0, 6).toUpperCase()}`,
        });
      } else {
        if (!senha) { setError("Senha obrigatória"); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, senha);
        uid = cred.user.uid;
        await updateProfile(cred.user, { displayName: nome });
        await setDoc(doc(db, "users", uid), {
          nome, email, telefone, pontos: 0, rankingPts: 0, cashback: 0,
          role: "lojista", following: [], favoritos: [],
          lojistaOf: slug,
          inviteCode: `NEX${uid.substring(0, 6).toUpperCase()}`,
          createdAt: serverTimestamp(),
        });
      }

      const catFinal = categoria === "outro" && categoriaLivre ? categoriaLivre : categoria;

      await setDoc(doc(db, "lojas", slug), {
        tenantId: slug, nome: nomeLoja, slug, logo: "", capa: "",
        categoria: catFinal, desc: "", ativo: true,
        plano: "catalogo",
        ownerId: uid, cidade: cidade || "", estado: "",
        createdAt: serverTimestamp(),
      }, { merge: true });

      await setDoc(doc(db, `tenants/${slug}/config/loja`), {
        tenantId: slug, nomeLoja, logoUrl: "", imagemCapa: "",
        plano: "catalogo",
        whatsapp: telefone, pixKey: "", nomeRecebedorPix: "",
        cardapioAtivo: true, pedidosAtivos: false, suporteAtivo: false,
        ativo: true, pausaManual: false, tema: "dark",
        mensagemPausa: "Catálogo temporariamente indisponível",
        horario: "", horarioAutomatico: false,
        horarioAbertura: "09:00", horarioFechamento: "22:00",
        pontosPorReal: 0, endereco: cidade || "",
        chamadaCupom: [], rankingPtsComentario: 0, rankingPtsPedido: 0, rankingPtsPorReal: 0,
      }, { merge: true });

      setEtapa(3);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao criar catálogo";
      if (msg.includes("email-already-in-use")) setError("Email já cadastrado. Tente fazer login.");
      else if (msg.includes("weak-password")) setError("Senha deve ter pelo menos 6 caracteres");
      else setError(msg);
    } finally { setLoading(false); }
  };

  const catAtual = CATEGORIAS.find(c => c.value === categoria);

  // ── ESTILOS ────────────────────────────────────────────────
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

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(160deg,#0a0414 0%,#0d1a0d 50%,#0a0414 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px", fontFamily: "'Outfit',sans-serif", position: "relative", overflow: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Fraunces:wght@700;900&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      {/* Brilhos */}
      <div style={{ position: "fixed", top: -100, left: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(22,163,74,.18),transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(245,197,24,.08),transparent 70%)", pointerEvents: "none" }} />

      {/* Barra de progresso */}
      {etapa >= 1 && etapa <= 2 && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50 }}>
          <div style={{ height: 3, background: "rgba(255,255,255,.08)" }}>
            <motion.div animate={{ width: `${(etapa / 2) * 100}%` }} transition={{ duration: 0.4 }}
              style={{ height: "100%", background: "linear-gradient(90deg,#16a34a,#f5c518)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 20px" }}>
            <button onClick={() => setEtapa(e => e - 1)}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 4 }}>
              ← Voltar
            </button>
            <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.3)", fontWeight: 700 }}>
              {etapa} de 2
            </span>
          </div>
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 420, position: "relative" }}>
        <AnimatePresence mode="wait">

          {/* ── ETAPA 0: WELCOME ─────────────────────────────── */}
          {etapa === 0 && (
            <motion.div key="welcome" {...slide}>
              {/* Mockup do catálogo */}
              <div style={{ position: "relative", marginBottom: 32, display: "flex", justifyContent: "center" }}>
                <div style={{ width: 200, height: 340, borderRadius: 28, background: "linear-gradient(160deg,#0b1a0d,#0d0820)", border: "1.5px solid rgba(22,163,74,.4)", overflow: "hidden", position: "relative", boxShadow: "0 0 60px rgba(22,163,74,.25)" }}>
                  {/* Header da loja */}
                  <div style={{ background: "rgba(22,163,74,.2)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#16a34a,#f5c518)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>
                      {catAtual?.icon || "🛍️"}
                    </div>
                    <div>
                      <div style={{ fontSize: "0.62rem", fontWeight: 800, color: "#fff" }}>{nomeLoja || "Sua Loja"}</div>
                      <div style={{ fontSize: "0.5rem", color: "#4ade80" }}>● Cardápio online</div>
                    </div>
                  </div>
                  {/* Produto cards */}
                  {[
                    { icon: "🍧", name: "Açaí 500ml", price: "R$22" },
                    { icon: "🥤", name: "Suco Natural", price: "R$12" },
                    { icon: "🍰", name: "Bolo do Dia", price: "R$8" },
                  ].map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(22,163,74,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>{p.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#fff" }}>{p.name}</div>
                        <div style={{ fontSize: "0.55rem", color: "#f5c518", fontWeight: 900 }}>{p.price}</div>
                      </div>
                    </div>
                  ))}
                  {/* QR / link bottom */}
                  <div style={{ position: "absolute", bottom: 10, left: 12, right: 12, background: "rgba(22,163,74,.12)", border: "1px solid rgba(22,163,74,.3)", borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 20, height: 20, background: "rgba(245,197,24,.2)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.5rem" }}>QR</div>
                    <div style={{ fontSize: "0.52rem", color: "rgba(255,255,255,.6)" }}>nexfoody.com/loja/<span style={{ color: "#4ade80" }}>sua-loja</span></div>
                  </div>
                </div>

                {/* Badge flutuante */}
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2.5 }}
                  style={{ position: "absolute", top: 16, right: 12, background: "rgba(34,197,94,.2)", border: "1px solid rgba(34,197,94,.4)", borderRadius: 20, padding: "6px 12px", fontSize: "0.68rem", fontWeight: 800, color: "#22c55e", whiteSpace: "nowrap" }}>
                  🔗 Link para compartilhar
                </motion.div>
                <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 3, delay: 0.5 }}
                  style={{ position: "absolute", bottom: 36, left: 2, background: "rgba(245,197,24,.2)", border: "1px solid rgba(245,197,24,.4)", borderRadius: 20, padding: "6px 12px", fontSize: "0.68rem", fontWeight: 800, color: "#f5c518", whiteSpace: "nowrap" }}>
                  📲 QR Code grátis
                </motion.div>
              </div>

              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <div style={{ display: "inline-block", background: "rgba(22,163,74,.12)", border: "1px solid rgba(22,163,74,.3)", borderRadius: 20, padding: "5px 14px", fontSize: "0.72rem", fontWeight: 800, color: "#4ade80", marginBottom: 16 }}>
                  🛍️ Plano Catálogo · Grátis para sempre
                </div>
                <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: "clamp(1.8rem,7vw,2.6rem)", fontWeight: 900, lineHeight: 1.1, marginBottom: 12, color: "#fff" }}>
                  Seu cardápio digital,<br />
                  <span style={{ background: "linear-gradient(135deg,#4ade80,#f5c518)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    grátis para sempre.
                  </span>
                </h1>
                <p style={{ color: "rgba(255,255,255,.5)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: 8 }}>
                  Monte seu cardápio com fotos e preços. Gere um link e QR Code para compartilhar no WhatsApp e Instagram. Sem taxa, sem mensalidade.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                {[
                  "✅ Link próprio da sua loja",
                  "✅ QR Code para impressão",
                  "✅ Cardápio com fotos e preços",
                  "✅ Compartilha em 1 toque no WhatsApp",
                ].map((item, i) => (
                  <div key={i} style={{ fontSize: "0.82rem", color: "rgba(255,255,255,.6)" }}>{item}</div>
                ))}
              </div>

              <motion.button whileTap={{ scale: 0.98 }} onClick={() => setEtapa(1)} style={btnGold}>
                Criar meu catálogo grátis →
              </motion.button>
              <p style={{ textAlign: "center", marginTop: 14, fontSize: "0.75rem", color: "rgba(255,255,255,.3)" }}>
                Sem cartão · 2 minutos para criar
              </p>
              <p style={{ textAlign: "center", marginTop: 8, fontSize: "0.78rem", color: "rgba(255,255,255,.35)" }}>
                Quer delivery e IA também?{" "}
                <Link to="/lojista/cadastro" style={{ color: "#a78bfa", textDecoration: "none", fontWeight: 700 }}>Ver planos completos</Link>
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
                <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#4ade80", fontWeight: 700, marginBottom: 8 }}>Etapa 1 de 2</div>
                <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: "clamp(1.6rem,5vw,2.2rem)", fontWeight: 900, lineHeight: 1.1, color: "#fff", marginBottom: 8 }}>
                  Como se chama<br />
                  <span style={{ background: "linear-gradient(135deg,#4ade80,#f5c518)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    seu negócio?
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
                      🔗 nexfoody.com/loja/<span style={{ color: "#4ade80", fontWeight: 700 }}>{slug}</span>
                    </motion.div>
                  )}
                </div>

                {/* Categoria */}
                <div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.4)", marginBottom: 10, paddingLeft: 2 }}>Qual o tipo do seu negócio?</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                    {CATEGORIAS.map(cat => (
                      <motion.button whileTap={{ scale: 0.95 }} key={cat.value} type="button"
                        onClick={() => setCategoria(cat.value)}
                        style={{ background: categoria === cat.value ? "rgba(22,163,74,.25)" : "rgba(255,255,255,.04)", border: `1.5px solid ${categoria === cat.value ? "rgba(22,163,74,.6)" : "rgba(255,255,255,.08)"}`, borderRadius: 14, padding: "12px 6px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "1.4rem" }}>{cat.icon}</span>
                        <span style={{ fontSize: "0.6rem", fontWeight: 700, color: categoria === cat.value ? "#4ade80" : "rgba(255,255,255,.45)" }}>{cat.label}</span>
                      </motion.button>
                    ))}
                  </div>
                  <AnimatePresence>
                    {categoria === "outro" && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden", marginTop: 8 }}>
                        <input style={inputStyle} placeholder="Ex: Adesivos, Pet Shop, Brechó..." value={categoriaLivre}
                          onChange={e => setCategoriaLivre(e.target.value)} autoFocus />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {error && <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 12, padding: "10px 14px", color: "#fca5a5", fontSize: "0.82rem" }}>{error}</div>}

                <motion.button whileTap={{ scale: 0.98 }}
                  onClick={() => { if (!nomeLoja) { setError("Digite o nome do negócio"); return; } setError(""); setEtapa(2); }}
                  style={btnGold}>
                  Continuar →
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── ETAPA 2: CONTA ───────────────────────────────── */}
          {etapa === 2 && (
            <motion.div key="conta" {...slide} style={{ paddingTop: 60 }}>
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#4ade80", fontWeight: 700, marginBottom: 8 }}>Último passo</div>
                <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: "clamp(1.6rem,5vw,2.2rem)", fontWeight: 900, lineHeight: 1.1, color: "#fff", marginBottom: 8 }}>
                  Crie sua conta e o catálogo<br />
                  <span style={{ background: "linear-gradient(135deg,#4ade80,#f5c518)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    vai ao ar agora.
                  </span>
                </h2>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input style={inputStyle} placeholder="Seu nome completo" value={nome} onChange={e => setNome(e.target.value)} autoFocus />
                <input style={inputStyle} type="email" placeholder="Seu melhor email" value={email} onChange={e => setEmail(e.target.value)} />
                <input style={inputStyle} type="tel" placeholder="WhatsApp (opcional)" value={telefone} onChange={e => setTelefone(e.target.value)} />
                <input style={inputStyle} placeholder="Cidade (opcional)" value={cidade} onChange={e => setCidade(e.target.value)} />
                {!user && <input style={inputStyle} type="password" placeholder="Senha (mín. 6 caracteres)" value={senha} onChange={e => setSenha(e.target.value)} />}

                {error && <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 12, padding: "10px 14px", color: "#fca5a5", fontSize: "0.82rem" }}>{error}</div>}

                <motion.button whileTap={{ scale: 0.98 }} onClick={handleSubmit} disabled={loading}
                  style={{ ...btnGold, opacity: loading ? 0.7 : 1 }}>
                  {loading ? "Criando seu catálogo..." : "Criar catálogo grátis →"}
                </motion.button>

                <p style={{ textAlign: "center", fontSize: "0.7rem", color: "rgba(255,255,255,.25)", lineHeight: 1.5 }}>
                  Ao criar sua conta você concorda com nossos termos de uso.
                </p>
              </div>
            </motion.div>
          )}

          {/* ── ETAPA 3: SUCESSO 🎉 ──────────────────────────── */}
          {etapa === 3 && (
            <motion.div key="sucesso" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: "center" }}>
              {/* Confetes */}
              <div style={{ position: "relative", marginBottom: 8 }}>
                {["🎉","🛍️","✅","✨","🔗","💛"].map((em, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 0, x: 0 }}
                    animate={{ opacity: [0, 1, 0], y: -80, x: (i - 2.5) * 40 }}
                    transition={{ duration: 1.5, delay: i * 0.1, ease: "easeOut" }}
                    style={{ position: "absolute", top: 0, left: "50%", fontSize: "1.5rem", pointerEvents: "none" }}>
                    {em}
                  </motion.div>
                ))}
              </div>

              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: 2, duration: 0.4 }}
                style={{ fontSize: "4rem", marginBottom: 8, display: "block" }}>🎊</motion.div>

              <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: "clamp(1.6rem,6vw,2.4rem)", fontWeight: 900, lineHeight: 1.1, color: "#fff", marginBottom: 8 }}>
                Catálogo no ar!
              </h2>
              <p style={{ color: "rgba(255,255,255,.5)", fontSize: "0.9rem", marginBottom: 28 }}>
                <strong style={{ color: "#4ade80" }}>{nomeLoja}</strong> já tem um cardápio digital pronto.
              </p>

              {/* Link da loja */}
              <div style={{ background: "rgba(22,163,74,.1)", border: "1px solid rgba(22,163,74,.3)", borderRadius: 18, padding: "16px 20px", marginBottom: 20, textAlign: "left" }}>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Seu link exclusivo</div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#4ade80", wordBreak: "break-all" }}>
                  {catalogUrl}
                </div>
                <button
                  onClick={() => navigator.clipboard?.writeText(catalogUrl)}
                  style={{ marginTop: 8, background: "rgba(22,163,74,.2)", border: "1px solid rgba(22,163,74,.4)", borderRadius: 8, padding: "5px 12px", fontSize: "0.72rem", fontWeight: 700, color: "#4ade80", cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>
                  📋 Copiar link
                </button>
              </div>

              {/* QR Code */}
              <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 18, padding: "20px", marginBottom: 20 }}>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.4)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>QR Code — coloque no balcão</div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <img src={qrUrl} alt="QR Code do catálogo" width={160} height={160} style={{ borderRadius: 12 }} />
                </div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.3)", marginTop: 10 }}>
                  Clientes escaneiam e veem seu cardápio
                </div>
              </div>

              {/* Compartilhar no WhatsApp */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Olá! Acesse o cardápio de ${nomeLoja} aqui: ${catalogUrl}`)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#25d366", borderRadius: 16, padding: "14px", fontWeight: 800, fontSize: "0.9rem", color: "#fff", textDecoration: "none", marginBottom: 12 }}>
                <span style={{ fontSize: "1.2rem" }}>📤</span> Compartilhar no WhatsApp
              </a>

              {/* Adicionar produtos */}
              <motion.button whileTap={{ scale: 0.98 }}
                onClick={() => navigate("/lojista/dashboard")}
                style={btnGold}>
                Adicionar meus produtos →
              </motion.button>

              {/* Upgrade hint */}
              <div style={{ marginTop: 20, background: "rgba(124,58,237,.1)", border: "1px solid rgba(124,58,237,.25)", borderRadius: 16, padding: "14px 16px" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#a78bfa", marginBottom: 4 }}>
                  🚀 Quer receber pedidos pelo delivery?
                </div>
                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.4)", lineHeight: 1.5 }}>
                  Ative o plano completo a qualquer momento no painel e comece a vender online — R$1 por pedido, teto R$150/mês.
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
