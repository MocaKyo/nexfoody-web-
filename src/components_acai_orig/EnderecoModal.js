// src/components/EnderecoModal.js — Seletor de endereço com mapa
import React, { useState, useEffect, useRef, useCallback } from "react";

export default function EnderecoModal({ onConfirmar, onClose, enderecoInicial = {} }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [localizando, setLocalizando] = useState(false);
  const [coords, setCoords] = useState(null);
  const [enderecoDetectado, setEnderecoDetectado] = useState("");
  const [ruasProximas, setRuasProximas] = useState([]);
  const [modoEdicao, setModoEdicao] = useState(false);

  // Formulário
  const [rua, setRua] = useState(enderecoInicial.rua || "");
  const [numero, setNumero] = useState(enderecoInicial.numero || "");
  const [bairro, setBairro] = useState(enderecoInicial.bairro || "");
  const [complemento, setComplemento] = useState(enderecoInicial.complemento || "");
  const [referencia, setReferencia] = useState(enderecoInicial.referencia || "");
  const [cidade, setCidade] = useState(enderecoInicial.cidade || "");
  const [obsEndereco, setObsEndereco] = useState(enderecoInicial.obs || "");
  const [tipoSalvar, setTipoSalvar] = useState("casa");

  // Validação
  const [erros, setErros] = useState([]);
  const [validado, setValidado] = useState({ mapa: false, numero: false, revisado: false });

  // Carregar Leaflet
  useEffect(() => {
    if (window.L) { setMapLoaded(true); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Inicializar mapa
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mapInstanceRef.current) return;
    const defaultCoords = [-4.2439, -44.7846]; // Bacabal MA
    const map = window.L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView(defaultCoords, 15);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    // Pin fixo no centro
    const pin = document.createElement("div");
    pin.style.cssText = "position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);z-index:1000;pointer-events:none;font-size:2.5rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))";
    pin.innerHTML = "📍";
    mapRef.current.appendChild(pin);

    map.on("moveend", async () => {
      const center = map.getCenter();
      setCoords({ lat: center.lat, lng: center.lng });
      setValidado(p => ({ ...p, mapa: true }));
      await reverseGeocode(center.lat, center.lng);
    });

    mapInstanceRef.current = map;
    // Centralizar na localização se tiver
    if (enderecoInicial.rua) setModoEdicao(true);
    else centralizarLocalizacao(map);
  }, [mapLoaded]);

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt-BR`);
      const data = await res.json();
      const addr = data.address || {};
      const ruaDetectada = addr.road || addr.pedestrian || "";
      const numDetectado = addr.house_number || "";
      const bairroDetectado = addr.suburb || addr.neighbourhood || addr.quarter || "";
      const cidadeDetectada = addr.city || addr.town || addr.village || "";

      setEnderecoDetectado(`${ruaDetectada}${numDetectado ? `, ${numDetectado}` : ""}\n${bairroDetectado}${cidadeDetectada ? ` - ${cidadeDetectada}` : ""}`);

      // Auto-preencher campos se vazios
      if (ruaDetectada && !rua) setRua(ruaDetectada);
      if (numDetectado && !numero) setNumero(numDetectado);
      if (bairroDetectado && !bairro) setBairro(bairroDetectado);
      if (cidadeDetectada && !cidade) setCidade(cidadeDetectada);

      // Buscar ruas próximas
      const res2 = await fetch(`https://nominatim.openstreetmap.org/search?q=&format=json&accept-language=pt-BR&limit=5&viewbox=${lng-0.002},${lat+0.002},${lng+0.002},${lat-0.002}&bounded=1&type=street`);
      const ruas = await res2.json();
      const nomes = [...new Set(ruas.map(r => r.display_name?.split(",")[0]).filter(Boolean))].slice(0, 3);
      if (nomes.length > 1) setRuasProximas(nomes);
      else setRuasProximas([]);
    } catch {}
  };

  const centralizarLocalizacao = (map) => {
    setLocalizando(true);
    navigator.geolocation?.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      const m = map || mapInstanceRef.current;
      if (m) m.setView([latitude, longitude], 17);
      setLocalizando(false);
    }, () => setLocalizando(false), { enableHighAccuracy: true });
  };

  // Validação em tempo real
  useEffect(() => {
    setValidado(p => ({ ...p, numero: numero.trim().length > 0 }));
  }, [numero]);

  useEffect(() => {
    setValidado(p => ({ ...p, revisado: rua.trim().length > 0 && numero.trim().length > 0 }));
  }, [rua, numero]);

  const podeConfirmar = validado.revisado && numero.trim();

  const confirmar = () => {
    const novosErros = [];
    if (!rua.trim()) novosErros.push("Informe o nome da rua");
    if (!numero.trim()) novosErros.push("Informe o número do endereço");
    if (novosErros.length > 0) { setErros(novosErros); return; }
    onConfirmar({
      rua: `${rua}${numero ? `, ${numero}` : ""}`,
      bairro, complemento, referencia, cidade,
      obs: obsEndereco,
      tipoSalvar, coords,
      enderecoCompleto: `${rua}, ${numero}${bairro ? ` - ${bairro}` : ""}${cidade ? ` - ${cidade}` : ""}`,
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg)", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text2)", fontSize: "1.1rem", marginRight: 12 }}>←</button>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", flex: 1, textAlign: "center" }}>Confirmar endereço</div>
        <div style={{ width: 32 }} />
      </div>

      {/* Scroll content */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 140 }}>

        {/* MAPA */}
        <div style={{ position: "relative", height: 260 }}>
          <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
          {!mapLoaded && (
            <div style={{ position: "absolute", inset: 0, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text2)", fontSize: "0.85rem" }}>
              Carregando mapa...
            </div>
          )}
          {/* Botão centralizar */}
          <button
            onClick={() => centralizarLocalizacao()}
            disabled={localizando}
            style={{ position: "absolute", bottom: 12, right: 12, zIndex: 1000, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontFamily: "'Outfit',sans-serif", fontWeight: 600, boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
          >
            {localizando ? "⏳" : "🎯"} Minha localização
          </button>
        </div>

        <div style={{ padding: "16px 16px 0" }}>

          {/* Endereço detectado */}
          {enderecoDetectado && (
            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ fontSize: "0.72rem", color: "var(--green)", fontWeight: 700, marginBottom: 4 }}>📍 Endereço detectado:</div>
              <div style={{ fontSize: "0.85rem", lineHeight: 1.5 }}>{enderecoDetectado}</div>
              <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 4 }}>⚠️ Posição aproximada — confirme os campos abaixo</div>
            </div>
          )}

          {/* Alerta ruas próximas */}
          {ruasProximas.length > 1 && (
            <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#f59e0b", marginBottom: 6 }}>⚠️ Você está próximo a várias ruas:</div>
              {ruasProximas.map((r, i) => (
                <div key={i} onClick={() => setRua(r)} style={{ fontSize: "0.82rem", padding: "4px 0", cursor: "pointer", color: rua === r ? "var(--gold)" : "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: rua === r ? "var(--gold)" : "var(--text3)" }}>{rua === r ? "✓" : "•"}</span> {r}
                </div>
              ))}
              <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 4 }}>Toque para selecionar a rua correta</div>
            </div>
          )}

          {/* Formulário */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 4, display: "block" }}>Rua *</label>
                <input className="form-input" value={rua} onChange={e => setRua(e.target.value)} placeholder="Nome da rua" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 4, display: "block" }}>Número *</label>
                <input className="form-input" value={numero} onChange={e => setNumero(e.target.value)} placeholder="Nº" />
              </div>
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 4, display: "block" }}>Bairro</label>
              <input className="form-input" value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Bairro" />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 4, display: "block" }}>Complemento</label>
              <input className="form-input" value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Casa azul, portão preto, esquina com..." />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 4, display: "block" }}>Ponto de referência</label>
              <input className="form-input" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Próximo ao mercado X, em frente à escola..." />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 4, display: "block" }}>Cidade *</label>
              <input className="form-input" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex: Bacabal, São Luís..." />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 4, display: "block" }}>Observações do endereço</label>
              <textarea className="form-input" value={obsEndereco} onChange={e => setObsEndereco(e.target.value)} placeholder="Ex: Campainha com defeito, entrar pelo portão lateral, ligar ao chegar..." rows={2} style={{ resize: "none" }} />
            </div>
          </div>

          {/* Salvar como */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginBottom: 8, fontWeight: 600 }}>Salvar como:</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ id: "casa", icon: "🏠", label: "Casa" }, { id: "trabalho", icon: "💼", label: "Trabalho" }, { id: "outro", icon: "📍", label: "Outro" }].map(t => (
                <button key={t.id} onClick={() => setTipoSalvar(t.id)} style={{ flex: 1, padding: "8px", background: tipoSalvar === t.id ? "rgba(245,197,24,0.12)" : "var(--bg2)", border: `1px solid ${tipoSalvar === t.id ? "rgba(245,197,24,0.4)" : "var(--border)"}`, borderRadius: 10, cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontSize: "0.78rem", fontWeight: 600, color: tipoSalvar === t.id ? "var(--gold)" : "var(--text2)", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: "1.2rem" }}>{t.icon}</span>{t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Validação visual */}
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
            {[
              { ok: validado.mapa, label: "Localização ajustada no mapa" },
              { ok: validado.numero, label: "Número preenchido" },
              { ok: validado.revisado, label: "Endereço revisado" },
            ].map((v, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < 2 ? 6 : 0, fontSize: "0.78rem", color: v.ok ? "var(--green)" : "var(--text3)" }}>
                <span>{v.ok ? "✔" : "○"}</span> {v.label}
              </div>
            ))}
          </div>

          {/* Erros */}
          {erros.length > 0 && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
              {erros.map((e, i) => <div key={i} style={{ fontSize: "0.78rem", color: "var(--red)", marginBottom: i < erros.length - 1 ? 4 : 0 }}>⚠️ {e}</div>)}
            </div>
          )}
        </div>
      </div>

      {/* Botão confirmar fixo */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px 24px", background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
        <button
          onClick={confirmar}
          style={{
            width: "100%", padding: "15px",
            background: podeConfirmar ? "linear-gradient(135deg, var(--purple2), var(--purple))" : "var(--bg3)",
            border: "none", borderRadius: 14,
            color: podeConfirmar ? "#fff" : "var(--text3)",
            fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: "1rem",
            cursor: podeConfirmar ? "pointer" : "not-allowed",
            transition: "all 0.3s",
          }}
        >
          {podeConfirmar ? "✅ Confirmar endereço de entrega" : "Preencha rua e número para continuar"}
        </button>
      </div>
    </div>
  );
}
