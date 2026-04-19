// src/pages/nexfoody/NexfoodyMapa.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { GoogleMap, useJsApiLoader, OverlayView } from "@react-google-maps/api";
import { useNavigate, Link } from "react-router-dom";
import { collection, getDocs, query, where, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

// ─── CHAVE GOOGLE MAPS ────────────────────────────────────────
// Substitua pela sua chave do Google Cloud Console
const GOOGLE_MAPS_KEY = "AIzaSyBVn3ymwKWoh7KJ9QIo7L6cysLBTR63hmE";
const _KEY = GOOGLE_MAPS_KEY as string;
const KEY_VALIDA = _KEY !== "SUA_CHAVE_AQUI" && _KEY.length > 10;

const LIBRARIES: ("places")[] = ["places"];

// Normaliza texto: remove acentos para comparação
const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// ─── Tipos ───────────────────────────────────────────────────
interface LojaPin {
  id: string;
  lat: number;
  lng: number;
  nome: string;
  foto?: string;
  avaliacao?: number;
  telefone?: string;
  endereco?: string;
  aberta?: boolean;
  noNexfoody: boolean;
  nexfoodySlug?: string;
  nexfoodyLogo?: string;
  placeId?: string;
}

// ─── Estilo dark roxo do mapa ─────────────────────────────────
const MAP_STYLE = [
  { elementType:"geometry",         stylers:[{ color:"#0f0720" }] },
  { elementType:"labels.text.fill", stylers:[{ color:"#746989" }] },
  { elementType:"labels.text.stroke",stylers:[{ color:"#0f0720" }] },
  { featureType:"administrative",   elementType:"geometry", stylers:[{ color:"#1a0a36" }] },
  { featureType:"poi",              elementType:"geometry", stylers:[{ color:"#1a0a36" }] },
  { featureType:"poi",              elementType:"labels.text.fill", stylers:[{ color:"#4a3060" }] },
  { featureType:"poi.park",         elementType:"geometry", stylers:[{ color:"#140b28" }] },
  { featureType:"road",             elementType:"geometry", stylers:[{ color:"#2a1a4a" }] },
  { featureType:"road",             elementType:"geometry.stroke", stylers:[{ color:"#1a0a36" }] },
  { featureType:"road",             elementType:"labels.text.fill", stylers:[{ color:"#5a4070" }] },
  { featureType:"road.highway",     elementType:"geometry", stylers:[{ color:"#3a1a6a" }] },
  { featureType:"road.highway",     elementType:"geometry.stroke", stylers:[{ color:"#2a0a50" }] },
  { featureType:"transit",          elementType:"geometry", stylers:[{ color:"#1a0a36" }] },
  { featureType:"water",            elementType:"geometry", stylers:[{ color:"#070314" }] },
  { featureType:"water",            elementType:"labels.text.fill", stylers:[{ color:"#3a1a6a" }] },
];

// ─── Pin customizado ──────────────────────────────────────────
function PinNexfoody({ ativo }: { ativo: boolean }) {
  return (
    <div style={{ position: "relative", cursor: "pointer" }}>
      <div style={{
        width: 38, height: 38, borderRadius: "50% 50% 50% 0",
        transform: "rotate(-45deg)",
        background: "linear-gradient(135deg, #f5c518, #e6a817)",
        border: "2px solid #fff",
        boxShadow: ativo
          ? "0 0 0 4px rgba(245,197,24,.4), 0 4px 16px rgba(245,197,24,.6)"
          : "0 4px 12px rgba(245,197,24,.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all .2s",
      }}>
        <span style={{ transform: "rotate(45deg)", fontSize: "1.1rem" }}>🍓</span>
      </div>
    </div>
  );
}

function PinFora({ ativo }: { ativo: boolean }) {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: "50% 50% 50% 0",
      transform: "rotate(-45deg)",
      background: ativo ? "#6d28d9" : "#374151",
      border: "2px solid rgba(255,255,255,.4)",
      boxShadow: ativo
        ? "0 0 0 4px rgba(109,40,217,.35), 0 4px 12px rgba(0,0,0,.5)"
        : "0 2px 8px rgba(0,0,0,.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "all .2s",
    }}>
      <span style={{ transform: "rotate(45deg)", fontSize: "0.8rem" }}>🏪</span>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────
export default function NexfoodyMapa() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const mapRef = useRef<google.maps.Map | null>(null);
  const serviceRef = useRef<google.maps.places.PlacesService | null>(null);

  const [pos, setPos] = useState({ lat: -4.3553, lng: -44.7866 }); // Bacabal-MA
  const [busca, setBusca] = useState("");
  const [lojas, setLojas] = useState<LojaPin[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [selecionada, setSelecionada] = useState<LojaPin | null>(null);
  const [conviteCopiado, setConviteCopiado] = useState(false);
  const [bannerVisivel, setBannerVisivel] = useState(
    () => localStorage.getItem("mapa_banner_fechado") !== "1"
  );

  const codigoConvite = user ? `NEX${user.uid.substring(0, 6).toUpperCase()}` : "NEXGUEST";
  const linkConvite = `https://nexfoody.com/lojista/cadastro?ref=${codigoConvite}`;

  const msgWhatsApp = (nomeLoja: string) =>
    `Oi, *${nomeLoja}*! 🍓\n\n` +
    `Tava passando aqui perto e queria muito pedir pelo app... mas ainda não te encontrei no *NexFoody* 😅\n\n` +
    `Quer dar uma olhada? 👇\n` +
    `📱 *Feed estilo TikTok* — onde seus produtos e promoções vão aparecer:\n` +
    `https://nexfoody.com/app\n\n` +
    `🏆 *Ranking de Fãs* — seus clientes mais fiéis disputam o topo:\n` +
    `https://nexfoody.com/ranking\n\n` +
    `O *NexFoody* é mais que um app de delivery — é a primeira *rede social de consumo* do Brasil, estilo Instagram e TikTok. ` +
    `Seus produtos viralizam, seus clientes fidelizam e sua loja cresce muito! 🚀\n\n` +
    `✅ *Cadastro 100% gratuito* — comece agora:\n` +
    `https://nexfoody.com/lojista/cadastro\n\n` +
    `❓ *Dúvidas e regras* — tudo explicado aqui:\n` +
    `https://nexfoody.com/como-funciona\n\n` +
    `Usa o código *${codigoConvite}* no cadastro e você ganha *1 mês grátis* — é meu presente pra vocês 🎁`;

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: KEY_VALIDA ? GOOGLE_MAPS_KEY : "",
    libraries: LIBRARIES,
  });

  // Geolocalização
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      p => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {}
    );
  }, []);

  // Inicializa PlacesService após mapa carregar
  const onMapLoad = useCallback((map: google.maps.Map) => {
    try {
      mapRef.current = map;
      serviceRef.current = new google.maps.places.PlacesService(map);
    } catch (e) { console.warn("PlacesService init:", e); }
  }, []);

  // Busca no Google Places + cruza com NexFoody
  const pesquisar = useCallback(async (termo: string) => {
    if (!termo.trim() || !serviceRef.current) return;
    setCarregando(true);
    setSelecionada(null);

    // Buscar lojas NexFoody para cruzar
    let nexLojas: { slug: string; logo: string | null; placeId: string | null }[] = [];
    try {
      const snap = await getDocs(query(collection(db, "lojas"), where("ativo", "==", true)));
      nexLojas = snap.docs.map(d => ({
        slug: d.data().slug || d.id,
        logo: d.data().logo || null,
        placeId: d.data().placeId || null,
      }));
    } catch (e) { console.error("Erro ao buscar lojas NexFoody:", e); }

    const request: google.maps.places.TextSearchRequest = {
      query: `${termo} em ${pos.lat},${pos.lng}`,
      location: new google.maps.LatLng(pos.lat, pos.lng),
      radius: 5000,
      type: "food",
    };

    serviceRef.current.textSearch(request, (results, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
        setCarregando(false);
        return;
      }

      const pins: LojaPin[] = results.slice(0, 40).map(p => {
        const googlePlaceId = p.place_id || "";
        // Somente placeId garante match correto — sem fallback por nome
        const match = googlePlaceId
          ? nexLojas.find(n => n.placeId === googlePlaceId)
          : undefined;
        return {
          id: p.place_id || String(Math.random()),
          lat: p.geometry?.location?.lat() || 0,
          lng: p.geometry?.location?.lng() || 0,
          nome: p.name || "Estabelecimento",
          foto: p.photos?.[0]?.getUrl({ maxWidth: 400 }) || undefined,
          avaliacao: p.rating,
          endereco: p.formatted_address,
          aberta: p.opening_hours?.isOpen?.(),
          telefone: undefined,
          placeId: p.place_id,
          noNexfoody: !!match,
          nexfoodySlug: match?.slug,
          nexfoodyLogo: match?.logo || undefined,
        };
      });

      // NexFoody no topo
      pins.sort((a, b) => (b.noNexfoody ? 1 : 0) - (a.noNexfoody ? 1 : 0));
      setLojas(pins);
      setCarregando(false);

      // Centraliza no primeiro resultado
      if (pins[0]) {
        mapRef.current?.panTo({ lat: pins[0].lat, lng: pins[0].lng });
        mapRef.current?.setZoom(14);
      }
    });
  }, [pos]);

  // Busca detalhes do telefone ao selecionar
  const selecionarLoja = useCallback((loja: LojaPin) => {
    setSelecionada(loja);
    if (!loja.telefone && loja.placeId && serviceRef.current) {
      serviceRef.current.getDetails(
        { placeId: loja.placeId, fields: ["formatted_phone_number"] },
        (result, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && result?.formatted_phone_number) {
            setSelecionada(prev => prev ? { ...prev, telefone: result.formatted_phone_number } : prev);
          }
        }
      );
    }
  }, []);

  // Salva convite no Firestore (id único por embaixador + placeId evita duplicatas)
  const registrarConvite = async (loja: LojaPin) => {
    if (!user || !loja.placeId) return;
    const conviteId = `${user.uid}_${loja.placeId}`;
    try {
      await setDoc(doc(db, "convites", conviteId), {
        embaixadorId: user.uid,
        embaixadorNome: user.displayName || userData?.nome || "Usuário",
        lojaPlaceId: loja.placeId,
        nomeLoja: loja.nome,
        status: "enviado",
        creditoCadastro: 0,
        creditoPrimeiroPedido: 0,
        recorrenteAcumulado: 0,
        createdAt: serverTimestamp(),
        lojaSlug: null,
      }, { merge: true }); // merge: true preserva status se já existir
    } catch (e) {
      console.warn("Erro ao registrar convite:", e);
    }
  };

  const convidar = (loja: LojaPin) => {
    registrarConvite(loja);
    const tel = loja.telefone?.replace(/\D/g, "");
    const msg = encodeURIComponent(msgWhatsApp(loja.nome));
    if (tel) {
      window.open(`https://wa.me/55${tel}?text=${msg}`, "_blank");
    } else {
      navigator.clipboard.writeText(msgWhatsApp(loja.nome));
      setConviteCopiado(true);
      setTimeout(() => setConviteCopiado(false), 3000);
    }
  };

  const compartilhar = async (loja: LojaPin) => {
    registrarConvite(loja);
    const texto = msgWhatsApp(loja.nome);
    if (navigator.share) {
      try {
        await navigator.share({ title: `Convite NexFoody — ${loja.nome}`, text: texto });
      } catch {
        // usuário cancelou ou erro — sem ação
      }
    } else {
      navigator.clipboard.writeText(texto);
      setConviteCopiado(true);
      setTimeout(() => setConviteCopiado(false), 3000);
    }
  };

  const nexfoodyCount = lojas.filter(l => l.noNexfoody).length;
  const foraCount = lojas.filter(l => !l.noNexfoody).length;

  const NAV_H = 54;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#07030f", fontFamily: "'Outfit', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* ── HEADER ──────────────────────────────────────────── */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 1000, padding: "12px 14px 0", pointerEvents: "none" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(7,3,15,.93)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 18, padding: "10px 14px", boxShadow: "0 4px 24px rgba(0,0,0,.6)", pointerEvents: "all" }}>
          <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", cursor: "pointer", fontSize: "1.1rem", padding: 0, lineHeight: 1, flexShrink: 0 }}>←</button>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#f5c518,#e6a817)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95rem", flexShrink: 0 }}>🍓</div>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            onKeyDown={e => e.key === "Enter" && pesquisar(busca)}
            placeholder='Ex: "pizza em Bacabal" ou "açaí em São Luís"'
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem", fontWeight: 500 }}
          />
          {carregando
            ? <div style={{ width: 20, height: 20, border: "2px solid rgba(245,197,24,.3)", borderTop: "2px solid #f5c518", borderRadius: "50%", animation: "spin 1s linear infinite", flexShrink: 0 }} />
            : <button onClick={() => pesquisar(busca)} style={{ background: "linear-gradient(135deg,#f5c518,#e6a817)", border: "none", borderRadius: 10, padding: "6px 14px", fontWeight: 800, fontSize: "0.78rem", color: "#0a0414", cursor: "pointer", flexShrink: 0 }}>Buscar</button>
          }
        </div>

        {/* Stats */}
        {lojas.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: 8, animation: "fadeIn .3s ease", pointerEvents: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(245,197,24,.15)", border: "1px solid rgba(245,197,24,.3)", borderRadius: 20, padding: "4px 10px" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f5c518", display: "inline-block" }} />
              <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "#f5c518" }}>{nexfoodyCount} no NexFoody</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(107,114,128,.15)", border: "1px solid rgba(107,114,128,.3)", borderRadius: 20, padding: "4px 10px" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#6b7280", display: "inline-block" }} />
              <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "#9ca3af" }}>{foraCount} sem cadastro</span>
            </div>
          </div>
        )}
      </div>

      {/* ── MAPA ────────────────────────────────────────────── */}
      {!KEY_VALIDA ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", paddingBottom: NAV_H, textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>🗺️</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.2rem", color: "#fff", marginBottom: 10 }}>Chave do Google Maps não configurada</div>
          <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,.45)", lineHeight: 1.75, marginBottom: 20 }}>
            Para usar o mapa, adicione sua chave da API do Google Maps<br />no arquivo <span style={{ color: "#f5c518", fontFamily: "monospace" }}>NexfoodyMapa.tsx</span> linha 12.
          </div>
          <div style={{ background: "rgba(245,197,24,.08)", border: "1px solid rgba(245,197,24,.2)", borderRadius: 14, padding: "14px 18px", textAlign: "left", maxWidth: 320 }}>
            <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Como obter a chave</div>
            <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,.7)", lineHeight: 1.8 }}>
              1. Acesse <span style={{ color: "#f5c518" }}>console.cloud.google.com</span><br />
              2. Ative <strong>Maps JavaScript API</strong> e <strong>Places API</strong><br />
              3. Crie uma chave em "Credentials"<br />
              4. Cole em <span style={{ color: "#f5c518", fontFamily: "monospace" }}>GOOGLE_MAPS_KEY</span>
            </div>
          </div>
        </div>
      ) : isLoaded ? (
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: `calc(100vh - ${NAV_H}px)` }}
          center={pos}
          zoom={14}
          options={{ styles: MAP_STYLE, disableDefaultUI: true, clickableIcons: false, gestureHandling: "greedy" }}
          onLoad={onMapLoad}
          onClick={() => setSelecionada(null)}
        >
          {/* Pin: posição do usuário */}
          <OverlayView position={pos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
            <div style={{ transform: "translate(-50%,-50%)" }}>
              <div style={{ width: 16, height: 16, background: "#7c3aed", border: "3px solid #fff", borderRadius: "50%", boxShadow: "0 0 12px rgba(124,58,237,.9), 0 0 0 6px rgba(124,58,237,.2)" }} />
            </div>
          </OverlayView>

          {/* Pins das lojas */}
          {lojas.map(loja => (
            <OverlayView
              key={loja.id}
              position={{ lat: loja.lat, lng: loja.lng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div
                style={{ transform: "translate(-50%,-100%)", cursor: "pointer" }}
                onClick={e => { e.stopPropagation(); selecionarLoja(loja); }}
              >
                {loja.noNexfoody
                  ? <PinNexfoody ativo={selecionada?.id === loja.id} />
                  : <PinFora     ativo={selecionada?.id === loja.id} />
                }
              </div>
            </OverlayView>
          ))}
        </GoogleMap>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: NAV_H }}>
          <div style={{ width: 36, height: 36, border: "3px solid rgba(245,197,24,.3)", borderTop: "3px solid #f5c518", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        </div>
      )}

      {/* ── LEGENDA COMPACTA (só quando ainda não buscou) ─────── */}
      {KEY_VALIDA && isLoaded && lojas.length === 0 && !carregando && (
        <div style={{ position: "absolute", top: 74, left: 14, right: 14, zIndex: 500, display: "flex", gap: 6, animation: "fadeIn .4s ease", pointerEvents: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(245,197,24,.12)", border: "1px solid rgba(245,197,24,.25)", borderRadius: 20, padding: "5px 11px" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", background: "#f5c518", flexShrink: 0 }} />
            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#f5c518" }}>No NexFoody</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(107,114,128,.12)", border: "1px solid rgba(107,114,128,.25)", borderRadius: 20, padding: "5px 11px" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", background: "#6b7280", flexShrink: 0 }} />
            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#9ca3af" }}>Convidar · +500pts</span>
          </div>
        </div>
      )}

      {/* ── BOTTOM SHEET ────────────────────────────────────── */}
      <AnimatePresence>
        {selecionada && (
          <motion.div
            key={selecionada.id}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            style={{ position: "absolute", bottom: NAV_H, left: 0, right: 0, zIndex: 1000, background: "#0f0720", borderRadius: "24px 24px 0 0", border: "1px solid rgba(255,255,255,.1)", borderBottom: "none", maxHeight: `calc(85vh - ${NAV_H}px)`, overflowY: "auto" }}
          >
            {/* Handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,.2)" }} />
            </div>

            {/* Foto de capa */}
            {selecionada.foto && (
              <div style={{ height: 140, overflow: "hidden", margin: "10px 16px 0", borderRadius: 16, position: "relative" }}>
                <img src={selecionada.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(15,7,32,.9) 100%)" }} />
                {/* Badge */}
                <div style={{ position: "absolute", top: 10, left: 10 }}>
                  {selecionada.noNexfoody
                    ? <span style={{ background: "rgba(245,197,24,.9)", borderRadius: 20, padding: "3px 10px", fontSize: "0.65rem", fontWeight: 800, color: "#0a0414" }}>🍓 No NexFoody</span>
                    : <span style={{ background: "rgba(55,65,81,.85)", borderRadius: 20, padding: "3px 10px", fontSize: "0.65rem", fontWeight: 700, color: "#9ca3af" }}>Não cadastrado</span>
                  }
                </div>
                {/* Aberta/fechada */}
                {selecionada.aberta !== undefined && (
                  <div style={{ position: "absolute", top: 10, right: 10, display: "flex", alignItems: "center", gap: 4, background: selecionada.aberta ? "rgba(34,197,94,.85)" : "rgba(239,68,68,.85)", borderRadius: 20, padding: "3px 10px" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
                    <span style={{ fontSize: "0.62rem", fontWeight: 800, color: "#fff" }}>{selecionada.aberta ? "Aberta" : "Fechada"}</span>
                  </div>
                )}
              </div>
            )}

            <div style={{ padding: "14px 18px 24px" }}>
              {/* Info */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.2rem", color: "#fff", marginBottom: 6 }}>{selecionada.nome}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {selecionada.avaliacao && (
                    <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: "0.78rem", fontWeight: 700, color: "#f5c518" }}>
                      ⭐ {selecionada.avaliacao.toFixed(1)}
                      <span style={{ color: "rgba(255,255,255,.3)", fontSize: "0.65rem", fontWeight: 400 }}>Google</span>
                    </span>
                  )}
                  {selecionada.telefone && (
                    <span style={{ fontSize: "0.72rem", color: "#25d366", fontWeight: 700 }}>📱 {selecionada.telefone}</span>
                  )}
                </div>
                {selecionada.endereco && (
                  <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.3)", marginTop: 5 }}>📍 {selecionada.endereco}</div>
                )}
              </div>

              {/* CTA */}
              {selecionada.noNexfoody ? (
                <button
                  onClick={() => navigate(`/loja/${selecionada.nexfoodySlug}`)}
                  style={{ width: "100%", padding: "15px", background: "linear-gradient(135deg,#f5c518,#e6a817)", border: "none", borderRadius: 16, fontWeight: 800, fontSize: "1rem", color: "#0a0414", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 6px 24px rgba(245,197,24,.4)" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                  Ver cardápio e pedir agora
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ background: "rgba(124,58,237,.1)", border: "1px solid rgba(124,58,237,.2)", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10 }}>
                    <span style={{ fontSize: "1.3rem" }}>💡</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#c084fc", marginBottom: 3 }}>Essa loja ainda não está aqui!</div>
                      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.45)", lineHeight: 1.6 }}>
                        Convide pelo WhatsApp. Se ela entrar com seu código, você ganha <strong style={{ color: "#f5c518" }}>500 pontos</strong> 🏆
                      </div>
                    </div>
                  </div>

                  {user && (
                    <div style={{ background: "rgba(245,197,24,.07)", border: "1px solid rgba(245,197,24,.18)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Seu código</div>
                        <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.1rem", color: "#f5c518" }}>{codigoConvite}</div>
                      </div>
                      <button onClick={() => { navigator.clipboard.writeText(codigoConvite); setConviteCopiado(true); setTimeout(() => setConviteCopiado(false), 2000); }}
                        style={{ background: "rgba(245,197,24,.15)", border: "1px solid rgba(245,197,24,.3)", borderRadius: 10, padding: "6px 12px", fontSize: "0.7rem", fontWeight: 700, color: "#f5c518", cursor: "pointer" }}>
                        {conviteCopiado ? "✓ Copiado!" : "Copiar"}
                      </button>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => convidar(selecionada)}
                      style={{ flex: 1, padding: "14px 10px", background: "linear-gradient(135deg,#25d366,#128c7e)", border: "none", borderRadius: 16, fontWeight: 800, fontSize: "0.88rem", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 6px 20px rgba(37,211,102,.3)" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      WhatsApp
                    </button>
                    <button onClick={() => compartilhar(selecionada)}
                      style={{ flex: 1, padding: "14px 10px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 16, fontWeight: 800, fontSize: "0.88rem", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                      Compartilhar
                    </button>
                  </div>

                  {user && (
                    <div style={{ textAlign: "center", fontSize: "0.68rem", color: "rgba(255,255,255,.25)", lineHeight: 1.7 }}>
                      Quando entrar com seu código você ganha <span style={{ color: "#f5c518", fontWeight: 800 }}>+500 pontos</span> automaticamente 🎁
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast copiado */}
      <AnimatePresence>
        {conviteCopiado && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: "absolute", bottom: NAV_H + 16, left: "50%", transform: "translateX(-50%)", background: "rgba(34,197,94,.9)", borderRadius: 12, padding: "10px 20px", fontSize: "0.82rem", fontWeight: 700, color: "#fff", zIndex: 2000, whiteSpace: "nowrap" }}>
            ✓ Mensagem copiada! Cole no WhatsApp
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BANNER FLUTUANTE CONVITE ────────────────────────── */}
      <AnimatePresence>
        {bannerVisivel && !selecionada && (
          <motion.div
            initial={{ scale: 0.88, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.88, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 260, delay: 0.6 }}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: NAV_H, margin: "auto", width: "min(88vw, 340px)", height: "fit-content", zIndex: 600,
              background: "linear-gradient(135deg, rgba(15,7,32,.98) 0%, rgba(30,10,60,.98) 100%)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(34,197,94,.3)",
              borderRadius: 24,
              padding: "22px 20px 18px",
              boxShadow: "0 20px 60px rgba(0,0,0,.7), 0 0 0 1px rgba(34,197,94,.08)",
            }}
          >
            {/* Botão fechar */}
            <button
              onClick={() => { setBannerVisivel(false); localStorage.setItem("mapa_banner_fechado", "1"); }}
              style={{ position: "absolute", top: 10, right: 12, background: "rgba(255,255,255,.08)", border: "none", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,.5)", fontSize: "0.85rem", lineHeight: 1 }}
            >✕</button>

            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              {/* Ícone */}
              <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg,#22c55e,#16a34a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0, boxShadow: "0 4px 16px rgba(34,197,94,.35)" }}>
                💰
              </div>

              <div style={{ flex: 1, minWidth: 0, paddingRight: 20 }}>
                <div style={{ fontWeight: 900, fontSize: "0.9rem", color: "#fff", marginBottom: 3 }}>
                  Ganhe dinheiro de verdade!
                </div>
                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.5)", lineHeight: 1.75 }}>
                  <span style={{ color: "#fff", fontWeight: 700 }}>1.</span> Busque restaurantes da sua cidade no campo acima.<br />
                  <span style={{ color: "#fff", fontWeight: 700 }}>2.</span> Toque num pin <span style={{ color: "#9ca3af", fontWeight: 700 }}>cinza</span> — eles ainda não estão aqui.<br />
                  <span style={{ color: "#fff", fontWeight: 700 }}>3.</span> Convide pelo WhatsApp e receba até{" "}
                  <span style={{ color: "#22c55e", fontWeight: 800 }}>R$ 70 por loja via PIX</span> quando entrarem! 🤑
                </div>
              </div>
            </div>

            {/* Mini tabela de ganhos */}
            <div style={{ background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.15)", borderRadius: 10, padding: "8px 10px", margin: "12px 0 0" }}>
              {[["Cadastro", "R$ 10"], ["1º pedido", "R$ 10"], ["Recorrente", "+ R$ 50"]].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0" }}>
                  <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,.4)" }}>{label}</span>
                  <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#22c55e" }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Minha Carteira */}
            <button
              onClick={() => navigate("/carteira")}
              style={{ width: "100%", marginTop: 12, display: "flex", alignItems: "center", gap: 10, background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.25)", borderRadius: 12, padding: "10px 14px", cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ fontSize: "1.3rem" }}>👛</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#22c55e" }}>Minha Carteira</div>
                <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,.35)", marginTop: 1 }}>Saldo PIX acumulado</div>
              </div>
              <span style={{ fontSize: "0.75rem", color: "rgba(34,197,94,.6)" }}>→</span>
            </button>

            {/* Busca embutida */}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && busca.trim()) { setBannerVisivel(false); localStorage.setItem("mapa_banner_fechado", "1"); pesquisar(busca); } }}
                placeholder='Ex: "pizza em Bacabal"'
                style={{ flex: 1, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, padding: "9px 12px", color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.78rem", outline: "none" }}
              />
              <button
                onClick={() => { if (busca.trim()) { setBannerVisivel(false); localStorage.setItem("mapa_banner_fechado", "1"); pesquisar(busca); } }}
                style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", border: "none", borderRadius: 10, padding: "9px 14px", fontWeight: 800, fontSize: "0.78rem", color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}
              >Buscar</button>
            </div>

            {/* Barra de progresso animada */}
            <div style={{ marginTop: 12, height: 3, borderRadius: 2, background: "rgba(255,255,255,.07)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: "100%", background: "linear-gradient(90deg, #22c55e, #16a34a)", borderRadius: 2, animation: "shimmerBar 2s linear infinite", backgroundSize: "200% 100%" }} />
            </div>

            <style>{`
              @keyframes shimmerBar {
                0%   { background-position: 200% center }
                100% { background-position: -200% center }
              }
            `}</style>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BOTTOM NAV ──────────────────────────────────────── */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: NAV_H, background: "rgba(8,4,18,.97)", backdropFilter: "blur(16px)", borderTop: "1px solid rgba(255,255,255,.07)", display: "flex", zIndex: 1100 }}>

        {/* Início */}
        <Link to="/app" style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, textDecoration:"none", color:"rgba(255,255,255,.35)", fontSize:"0.55rem", fontWeight:700 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          Início
        </Link>

        {/* Mapa — ativo */}
        <Link to="/mapa" style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, textDecoration:"none", color:"#f5c518", fontSize:"0.55rem", fontWeight:700, position:"relative" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
          Mapa
          <span style={{ position:"absolute", bottom:3, width:4, height:4, borderRadius:"50%", background:"#f5c518" }} />
        </Link>

        {/* Ranking */}
        <Link to="/ranking" style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, textDecoration:"none", color:"rgba(255,255,255,.35)", fontSize:"0.55rem", fontWeight:700 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          Ranking
        </Link>

        {/* Perfil */}
        <Link to={user ? "/meu-perfil" : "/nexfoody/welcome"} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, textDecoration:"none", color:"rgba(255,255,255,.35)", fontSize:"0.55rem", fontWeight:700 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Perfil
        </Link>

        {/* Chat */}
        <Link to="/chat" style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, textDecoration:"none", color:"rgba(255,255,255,.35)", fontSize:"0.55rem", fontWeight:700 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Chat
        </Link>

      </div>
    </div>
  );
}
