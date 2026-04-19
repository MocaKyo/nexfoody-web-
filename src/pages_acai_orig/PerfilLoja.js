// src/pages/PerfilLoja.js
import React, { useState, useEffect, useRef } from "react";
import { useStore } from "../contexts/StoreContext";
import { useAuth } from "../contexts/AuthContext";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { useToast } from "../components/Toast";
import StoreLocationPicker from "../components/StoreLocationPicker";

const LOGO_URL = "https://i.ibb.co/Z1R8Y83G/Whats-App-Image-2026-03-20-at-20-32-27.jpg";

export default function PerfilLoja() {
  const { config, salvarConfig } = useStore();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({});
  const [uploadingFor, setUploadingFor] = useState(null);
  const [draggingCapa, setDraggingCapa] = useState(false);
  const [capaStartY, setCapaStartY] = useState(0);
  const [capaY, setCapaY] = useState(50);
  const initCapaYDone = useRef(false);
  const inputCapaRef = useRef(null);
  const inputLogoRef = useRef(null);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleFileUpload = async (field, file) => {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast("Formato não suportado. Use JPG, PNG ou WebP.", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast("Imagem muito grande. Máx 5MB.", "error");
      return;
    }
    setUploadingFor(field);
    try {
      const ext = file.name.split(".").pop();
      const path = `lojas/${config.uid || "local"}/${field}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setForm(p => ({ ...p, [field]: url }));
      toast("✅ Imagem enviada com sucesso!");
      if (field === "imagemCapa") setCapaY(50);
    } catch {
      toast("Erro ao enviar imagem.", "error");
    } finally {
      setUploadingFor(null);
    }
  };

  useEffect(() => {
    setForm({ ...config });
    if (!initCapaYDone.current) {
      try { setCapaY(parseFloat(config.capaY || 50)); } catch { setCapaY(50); }
      initCapaYDone.current = true;
    }
  }, [config]);

  // Sincroniza posição Y da capa de volta ao form ao arrastar
  useEffect(() => {
    const timer = setTimeout(() => {
      setForm(p => ({ ...p, capaY: capaY.toString() }));
    }, 100);
    return () => clearTimeout(timer);
  }, [capaY]);

  const salvar = async () => {
    try {
      await salvarConfig(form);
      toast("✅ Perfil atualizado!");
      setEditando(false);
    } catch { toast("Erro ao salvar.", "error"); }
  };

  const mapUrl = config.endereco
    ? `https://maps.google.com/maps?q=${encodeURIComponent(config.endereco)}&output=embed`
    : null;

  const PAGAMENTOS = [
    { id: "pix",           icon: "📱", label: "PIX" },
    { id: "dinheiro",      icon: "💵", label: "Dinheiro" },
    { id: "debito",        icon: "💳", label: "Débito" },
    { id: "credito",       icon: "💳", label: "Crédito" },
    { id: "cartao_online", icon: "💻", label: "Cartão Online" },
    { id: "metade_metade", icon: "🔀", label: "Metade cartão + metade dinheiro" },
  ];

  const pagamentosAtivos = config.formasPagamento || ["pix", "dinheiro"];

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Imagem de capa */}
      <div style={{
        position: "relative", height: 180,
        background: "linear-gradient(135deg, #1a0a36, #2d1055)",
        overflow: "hidden",
      }}
        onMouseMove={e => { if (draggingCapa) { const delta = e.clientY - capaStartY; setCapaY(prev => Math.max(0, Math.min(100, prev + delta * 0.5))); setCapaStartY(e.clientY); } }}
        onMouseUp={() => setDraggingCapa(false)}
        onMouseLeave={() => setDraggingCapa(false)}
        onTouchMove={e => { if (draggingCapa) { const delta = e.touches[0].clientY - capaStartY; setCapaY(prev => Math.max(0, Math.min(100, prev + delta * 0.5))); setCapaStartY(e.touches[0].clientY); } }}
        onTouchEnd={() => setDraggingCapa(false)}
      >
        {config.imagemCapa ? (
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", cursor: draggingCapa ? "grabbing" : "grab" }}
            onMouseDown={e => { e.preventDefault(); setDraggingCapa(true); setCapaStartY(e.clientY); }}
            onTouchStart={e => { e.preventDefault(); setDraggingCapa(true); setCapaStartY(e.touches[0].clientY); }}
          >
            <img src={config.imagemCapa} alt="Capa" draggable={false}
              style={{ width: "100%", height: "130%", objectFit: "cover", objectPosition: `center ${capaY}%`, position: "absolute", top: 0, left: 0, touchAction: "none", userSelect: "none", pointerEvents: "none" }}
            />
          </div>
        ) : (
          <div style={{
            width: "100%", height: "100%",
            background: "linear-gradient(135deg, #1a0a36, #5a2d91)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: "4rem", opacity: 0.3 }}>🫐</span>
          </div>
        )}
        {/* Overlay gradiente */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, transparent 40%, rgba(10,4,20,0.9) 100%)",
        }} />
        {/* Botão editar (admin) */}
        {isAdmin && (
          <button onClick={() => setEditando(true)} style={{
            position: "absolute", top: 12, right: 12,
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 20, padding: "6px 12px",
            color: "#fff", cursor: "pointer",
            fontFamily: "'Outfit', sans-serif", fontSize: "0.75rem", fontWeight: 600,
          }}>
            ✏️ Editar perfil
          </button>
        )}
        {config.imagemCapa && (
          <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.45)", borderRadius: 20, padding: "3px 10px", fontSize: "0.62rem", color: "rgba(255,255,255,0.7)", pointerEvents: "none", fontFamily: "'Outfit', sans-serif" }}>
            ⇅ arraste para posicionar
          </div>
        )}
      </div>

      {/* Logo e nome */}
      <div style={{ padding: "0 16px", marginTop: -40, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginBottom: 16 }}>
          <img src={config.logoUrl || LOGO_URL} alt="Logo" style={{
            width: 80, height: 80, borderRadius: 18, objectFit: "cover",
            border: "3px solid var(--bg)", boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }} />
          <div style={{ paddingBottom: 4 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.3rem", fontWeight: 700, color: "var(--gold)" }}>
              {config.nomeLoja || "Açaí Puro Gosto"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: config.cardapioAtivo ? "#22c55e" : "#ef4444",
                boxShadow: config.cardapioAtivo ? "0 0 6px #22c55e" : "none",
              }} />
              <span style={{ fontSize: "0.78rem", color: config.cardapioAtivo ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                {config.cardapioAtivo ? "Aberto agora" : "Fechado"}
              </span>
            </div>
          </div>
        </div>

        {/* Botão compartilhar */}
        <button
          onClick={() => {
            const url = "https://acaipurogosto.com.br";
            const texto = `🫐 Conheça o cardápio do Açaí Puro Gosto! Peça agora: ${url}`;
            if (navigator.share) {
              navigator.share({ title: "Açaí Puro Gosto", text: texto, url });
            } else {
              navigator.clipboard.writeText(url);
              alert("Link copiado!");
            }
          }}
          style={{
            width: "100%", padding: "12px",
            background: "linear-gradient(135deg, var(--purple2), var(--purple))",
            border: "none", borderRadius: "var(--radius)", cursor: "pointer",
            color: "#fff", fontFamily: "'Outfit', sans-serif",
            fontWeight: 700, fontSize: "0.92rem",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            marginBottom: 14,
            boxShadow: "0 4px 16px rgba(90,45,145,0.4)",
          }}
        >
          📤 Compartilhar cardápio
        </button>

        {/* Quem somos */}
        {config.quemSomos && (
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: 8 }}>ℹ️ Quem somos</div>
            <p style={{ fontSize: "0.85rem", color: "var(--text2)", lineHeight: 1.7 }}>{config.quemSomos}</p>
          </div>
        )}

        {/* Horários */}
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: 10 }}>🕐 Horário de funcionamento</div>
          {config.horariosDetalhados ? (
            <div style={{ fontSize: "0.85rem", color: "var(--text2)", whiteSpace: "pre-line", lineHeight: 1.8 }}>
              {config.horariosDetalhados}
            </div>
          ) : (
            <div style={{ fontSize: "0.85rem", color: "var(--text2)" }}>
              {config.horario || "Consulte nosso horário"}
            </div>
          )}
        </div>

        {/* Endereço e Mapa */}
        {config.endereco && (
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: 10 }}>📍 Localização</div>
            <div style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: 12 }}>{config.endereco}</div>
            {/* Mapa embed */}
            <div style={{ borderRadius: 10, overflow: "hidden", height: 200, background: "var(--bg3)" }}>
              <iframe
                src={mapUrl}
                width="100%" height="200"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                title="Localização"
              />
            </div>
            <a href={`https://maps.google.com/?q=${encodeURIComponent(config.endereco)}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                marginTop: 10, padding: "10px",
                background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)",
                borderRadius: 10, textDecoration: "none",
                color: "#25d366", fontWeight: 600, fontSize: "0.85rem",
              }}>
              🗺️ Abrir no Google Maps
            </a>
          </div>
        )}

        {/* Formas de pagamento */}
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: 12 }}>💳 Formas de pagamento</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {PAGAMENTOS.map(p => (
              <div key={p.id} style={{
                background: pagamentosAtivos.includes(p.id) ? "rgba(34,197,94,0.1)" : "var(--bg3)",
                border: `1px solid ${pagamentosAtivos.includes(p.id) ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                borderRadius: 10, padding: "8px 14px",
                display: "flex", alignItems: "center", gap: 6,
                opacity: pagamentosAtivos.includes(p.id) ? 1 : 0.4,
              }}>
                <span>{p.icon}</span>
                <span style={{ fontSize: "0.82rem", fontWeight: 600, color: pagamentosAtivos.includes(p.id) ? "var(--green)" : "var(--text3)" }}>
                  {p.label}
                </span>
              </div>
            ))}
          </div>
        </div>



        {/* Pedido mínimo */}
        {config.pedidoMinimo > 0 && (
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: 8 }}>🛒 Pedido mínimo</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.5rem", fontWeight: 900, color: "var(--gold)" }}>
              R$ {parseFloat(config.pedidoMinimo).toFixed(2).replace(".", ",")}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text2)", marginTop: 4 }}>
              Valor mínimo para realizar um pedido
            </div>
          </div>
        )}

        {/* Info extra */}
        {config.infoExtra && (
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: 8 }}>📋 Informações adicionais</div>
            <p style={{ fontSize: "0.85rem", color: "var(--text2)", lineHeight: 1.7, whiteSpace: "pre-line" }}>{config.infoExtra}</p>
          </div>
        )}
      </div>

      {/* Modal de edição (admin) */}
      {editando && isAdmin && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "flex-end",
        }}>
          <div style={{
            width: "100%", maxHeight: "90vh", overflowY: "auto",
            background: "var(--bg2)", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem" }}>✏️ Editar perfil</div>
              <button onClick={() => setEditando(false)} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: "1.3rem" }}>✕</button>
            </div>

            <div className="form-group">
              <label className="form-label">🖼️ Imagem de capa</label>
              <input ref={inputCapaRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => handleFileUpload("imagemCapa", e.target.files[0])} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => inputCapaRef.current?.click()} style={{ padding: "8px 14px", background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)", borderRadius: 10, cursor: "pointer", color: "var(--purple2)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 6 }}>
                  📤 {uploadingFor === "imagemCapa" ? "Enviando..." : "Escolher arquivo"}
                </button>
                <input className="form-input" style={{ flex: 1, minWidth: 120 }} value={form.imagemCapa || ""} onChange={set("imagemCapa")} placeholder="Ou cole URL da imagem..." />
              </div>
              {form.imagemCapa && (
                <img src={form.imagemCapa} alt="Capa preview" style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 8, marginTop: 8 }} />
              )}
              <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 4 }}>Foto da fachada ou produto — proporção 16:9 recomendada · máx 5MB</div>
            </div>

            <div className="form-group">
              <label className="form-label">🖼️ Logo</label>
              <input ref={inputLogoRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => handleFileUpload("logoUrl", e.target.files[0])} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={() => inputLogoRef.current?.click()} style={{ padding: "8px 14px", background: "rgba(245,197,24,0.1)", border: "1px solid rgba(245,197,24,0.25)", borderRadius: 10, cursor: "pointer", color: "var(--gold)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 6 }}>
                  📤 {uploadingFor === "logoUrl" ? "Enviando..." : "Escolher arquivo"}
                </button>
                <input className="form-input" style={{ flex: 1, minWidth: 120 }} value={form.logoUrl || ""} onChange={set("logoUrl")} placeholder="Ou cole URL da logo..." />
              </div>
              {form.logoUrl && (
                <img src={form.logoUrl} alt="Logo preview" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 10, marginTop: 8 }} />
              )}
            </div>

            <div className="form-group">
              <label className="form-label">ℹ️ Quem somos</label>
              <textarea className="form-input" rows={4} value={form.quemSomos || ""} onChange={set("quemSomos")} placeholder="Conte a história da sua loja..." />
            </div>

            <div className="form-group">
              <label className="form-label">🕐 Horários detalhados</label>
              <textarea className="form-input" rows={4} value={form.horariosDetalhados || ""} onChange={set("horariosDetalhados")}
                placeholder={"Segunda a Sexta: 8h às 21h\nSábado: 8h às 22h\nDomingo: 10h às 20h"} />
            </div>

            <div className="form-group">
              <label className="form-label">🛒 Pedido mínimo (R$)</label>
              <input className="form-input" type="number" step="0.01" value={form.pedidoMinimo || ""} onChange={set("pedidoMinimo")} placeholder="Ex: 15.00 (deixe vazio para sem mínimo)" />
            </div>

            <div className="form-group">
              <label className="form-label">💳 Formas de pagamento aceitas</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {PAGAMENTOS.map(p => {
                  const ativo = (form.formasPagamento || ["pix","dinheiro"]).includes(p.id);
                  return (
                    <button key={p.id} onClick={() => {
                      const atual = form.formasPagamento || ["pix","dinheiro"];
                      setForm(prev => ({
                        ...prev,
                        formasPagamento: ativo ? atual.filter(x => x !== p.id) : [...atual, p.id]
                      }));
                    }} style={{
                      padding: "8px 14px", border: `1px solid ${ativo ? "rgba(34,197,94,0.5)" : "var(--border)"}`,
                      borderRadius: 10, cursor: "pointer",
                      background: ativo ? "rgba(34,197,94,0.1)" : "var(--bg3)",
                      color: ativo ? "var(--green)" : "var(--text2)",
                      fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.82rem",
                    }}>
                      {p.icon} {p.label} {ativo ? "✓" : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">📍 Endereço de retirada</label>
              <textarea className="form-input" rows={2} value={form.endereco || ""} onChange={set("endereco")} placeholder="Rua, número, bairro, cidade..." />
            </div>

            <div className="form-group">
              <label className="form-label">🗺️ Localização no mapa (área de entrega)</label>
              <StoreLocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onChange={(lat, lng) => setForm(p => ({ ...p, latitude: lat?.toString() || "", longitude: lng?.toString() || "" }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">📋 Informações adicionais</label>
              <textarea className="form-input" rows={3} value={form.infoExtra || ""} onChange={set("infoExtra")}
                placeholder="Ex: Aceitamos encomendas, entregamos em toda a cidade..." />
            </div>

            <button className="btn btn-gold btn-full" onClick={salvar}>💾 Salvar perfil</button>
          </div>
        </div>
      )}
    </div>
  );
}
