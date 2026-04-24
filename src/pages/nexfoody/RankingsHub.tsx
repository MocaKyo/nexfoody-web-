// src/pages/nexfoody/RankingsHub.tsx
// Rankings Central — 3 colunas: ranking da loja | meu ranking | ranking da cidade
import React, { useState, useEffect, useRef, JSX } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, getDocs, getDoc, doc, orderBy, onSnapshot, limit, updateDoc, arrayUnion, arrayRemove, increment } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import CountdownWidget from "../../components/CountdownWidget";
import PrizesCard from "../../components/PrizesCard";

interface Fan {
  uid: string;
  nome: string;
  foto?: string | null;
  pts: number;
  pos: number;
  isMe: boolean;
}

interface StoreRanking {
  tenantId: string;
  nome: string;
  slug: string;
  logo?: string | null;
  totalFanPts: number;
  seguidores: number;
  topFans: { nome: string; foto?: string | null; pts: number; pos: number }[];
}

interface MyGlobalRank {
  pos: number;
  uid: string;
  nome: string;
  foto?: string | null;
  pts: number;
}

// ---------- Sub-components ----------

function ColumnHeader({ emoji, label, accent }: { emoji: string; label: string; accent: string }) {
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "rgba(8,4,18,.97)", backdropFilter: "blur(16px)",
      borderBottom: `2px solid ${accent}30`,
      padding: "0 12px", height: 48,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ fontSize: "1.1rem" }}>{emoji}</span>
      <span style={{ fontFamily: "'Fraunces', serif", fontSize: "0.95rem", fontWeight: 900, color: accent, letterSpacing: 1 }}>{label}</span>
    </div>
  );
}

function LoginPrompt({ onLogin }: { onLogin: () => void }) {
  return (
    <div style={{ padding: "32px 16px", textAlign: "center" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔐</div>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1rem", fontWeight: 900, marginBottom: 8, color: "#fff" }}>Faça login</div>
      <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,.4)", marginBottom: 16 }}>Entre para ver seu ranking</div>
      <button onClick={onLogin} style={{ padding: "10px 20px", background: "linear-gradient(135deg, #7c3aed, #a855f7)", border: "none", borderRadius: 12, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>Entrar</button>
    </div>
  );
}

function LoadingSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ height: 52, borderRadius: 12, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 100}ms` }} />
      ))}
    </div>
  );
}

function FanRow({ fan }: { fan: Fan }) {
  const isMe = fan.isMe;
  const isTop3 = fan.pos <= 3;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: isMe ? "rgba(124,58,237,.08)" : "transparent", borderBottom: "1px solid rgba(255,255,255,.04)", animation: `cardEnter 0.35s ease-out both`, animationDelay: `${fan.pos * 50}ms` }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: "0.78rem", color: fan.pos === 1 ? "#f5c518" : fan.pos === 2 ? "#9ca3af" : fan.pos === 3 ? "#cd7f32" : "rgba(255,255,255,.25)", minWidth: 26, textAlign: "center" }}>
        {fan.pos <= 3 ? ["👑", "🥈", "🥉"][fan.pos - 1] : `#${fan.pos}`}
      </div>
      <div style={{ position: "relative", width: 30, height: 30, flexShrink: 0 }}>
        {isTop3 && (
          <div style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", fontSize: "0.65rem", zIndex: 2, lineHeight: 1 }}>{["👑", "🥈", "🥉"][fan.pos - 1]}</div>
        )}
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.08)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", border: isTop3 ? `2px solid ${fan.pos === 1 ? "#f5c518" : fan.pos === 2 ? "#9ca3af" : "#cd7f32"}` : "2px solid transparent" }}>
          {fan.foto ? <img src={fan.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (fan.nome?.[0] || "?")}
        </div>
      </div>
      <div style={{ flex: 1, fontSize: "0.8rem", fontWeight: isMe ? 800 : 600, color: isMe ? "#a855f7" : "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {isMe ? "Você 🎉" : fan.nome}
      </div>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: "0.82rem", fontWeight: 900, color: isMe ? "#a855f7" : "#f5c518" }}>
        {fan.pts.toLocaleString()} pts
      </div>
    </div>
  );
}

function Top3Podium({ fans }: { fans: Fan[] }) {
  if (fans.length === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, padding: "12px 12px 8px" }}>
      {fans[1] && (
        <div style={{ flex: 1, background: "rgba(156,163,175,.07)", border: "1px solid rgba(156,163,175,.18)", borderRadius: "12px 12px 0 0", padding: "10px 8px 14px", textAlign: "center" }}>
          <div style={{ fontSize: "1.4rem", marginBottom: 4 }}>🥈</div>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(156,163,175,.12)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 4px" }}>
            {fans[1].foto ? <img src={fans[1].foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (fans[1].nome?.[0] || "?")}
          </div>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fans[1].nome}</div>
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,.4)", marginTop: 2 }}>{fans[1].pts.toLocaleString()}</div>
        </div>
      )}
      {fans[0] && (
        <div style={{ flex: 1.3, background: "rgba(245,197,24,.1)", border: "1px solid rgba(245,197,24,.28)", borderRadius: "14px 14px 0 0", padding: "12px 8px 16px", textAlign: "center", animation: "medalPulse 2s ease-in-out infinite" }}>
          <div style={{ fontSize: "1.7rem", marginBottom: 4 }}>👑</div>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(245,197,24,.15)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px", border: "2px solid rgba(245,197,24,.4)" }}>
            {fans[0].foto ? <img src={fans[0].foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (fans[0].nome?.[0] || "?")}
          </div>
          <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#f5c518", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fans[0].nome}</div>
          <div style={{ fontSize: "0.68rem", color: "#f5c518", fontWeight: 700, marginTop: 2 }}>{fans[0].pts.toLocaleString()} pts</div>
        </div>
      )}
      {fans[2] && (
        <div style={{ flex: 1, background: "rgba(205,127,50,.07)", border: "1px solid rgba(205,127,50,.18)", borderRadius: "12px 12px 0 0", padding: "10px 8px 14px", textAlign: "center" }}>
          <div style={{ fontSize: "1.4rem", marginBottom: 4 }}>🥉</div>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(205,127,50,.12)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 4px" }}>
            {fans[2].foto ? <img src={fans[2].foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (fans[2].nome?.[0] || "?")}
          </div>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#cd7f32", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fans[2].nome}</div>
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,.4)", marginTop: 2 }}>{fans[2].pts.toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}

// ---------- Main Component ----------

export default function RankingsHub() {
  const navigate = useNavigate();
  const { user, userData } = useAuth();
  const [activeTab, setActiveTab] = useState<"loja" | "eu" | "cidade">("eu");

  // Left column state
  const [followedStores, setFollowedStores] = useState<Record<string, { nome: string; logo?: string | null }>>({});
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [storeFans, setStoreFans] = useState<Fan[]>([]);
  const [storeFansLoading, setStoreFansLoading] = useState(false);

  // Center column state — now derived from storeFans (user's rank in selected store)
  const [myNeighbours, setMyNeighbours] = useState<{ above: Fan | null; below: Fan | null }>({ above: null, below: null });
  const prevMyPosRef = useRef<number | null>(null);
  const prevFansRef = useRef<Fan[]>([]);
  const [rankShift, setRankShift] = useState<"up" | "down" | null>(null);
  const [nearBelow, setNearBelow] = useState<{ nome: string; pts: number; gap: number } | null>(null);
  const [passerInfo, setPasserInfo] = useState<{ nome: string; pts: number } | null>(null);

  // Right column state
  const [cityRankings, setCityRankings] = useState<StoreRanking[]>([]);
  const [cityLoading, setCityLoading] = useState(true);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<"week" | "month" | "all">("all");

  // Missões diárias state
  const [missoes, setMissoes] = useState<{ id: string; tipo: string; desc: string; meta: number; recompensa: number; progresso: number; completado: boolean; icon: string }[]>([]);
  const [missoesLoading, setMissoesLoading] = useState(false);
  const missoesRef = useRef<string[]>([]); // já reclamou recompensa hoje
  const [shareToast, setShareToast] = useState(false);
  // Pull-to-refresh state
  const [pulling, setPulling] = useState(false);
  const [pullDist, setPullDist] = useState(0);
  const pullStartY = useRef(0);
  const touchRef = useRef<HTMLDivElement | null>(null);

  // Modo demo — competidores fake (só visual, não persiste em Firestore)
  const [demoMode, setDemoMode] = useState(false);

  const DEMO_FANS: Fan[] = [
    { uid: "fake1", nome: "Maria Silva", foto: "https://i.pravatar.cc/100?img=5", pts: 3200, pos: 1, isMe: false },
    { uid: "fake2", nome: "João Santos", foto: null, pts: 2850, pos: 2, isMe: false },
    { uid: "fake3", nome: "Ana Costa", foto: "https://i.pravatar.cc/100?img=9", pts: 2410, pos: 3, isMe: false },
    { uid: "fake4", nome: "Pedro Oliveira", foto: "https://i.pravatar.cc/100?img=3", pts: 1890, pos: 4, isMe: false },
    { uid: "fake5", nome: "Julia Mendes", foto: "https://i.pravatar.cc/100?img=16", pts: 1540, pos: 5, isMe: false },
    { uid: "fake6", nome: "Carlos Rocha", foto: null, pts: 1200, pos: 6, isMe: false },
    { uid: "fake7", nome: "Fernanda Lima", foto: "https://i.pravatar.cc/100?img=20", pts: 980, pos: 7, isMe: false },
    { uid: "fake8", nome: "Lucas Alves", foto: "https://i.pravatar.cc/100?img=11", pts: 720, pos: 8, isMe: false },
  ];

  // Missões diárias
  useEffect(() => {
    if (!user?.uid) return;
    setMissoesLoading(true);

    const MISSOES_DEFAULT = [
      { id: "seguir_loja", tipo: "seguir", desc: "Siga uma loja", meta: 1, recompensa: 50, icon: "🏪" },
      { id: "fazer_pedido", tipo: "pedido", desc: "Faça um pedido", meta: 1, recompensa: 100, icon: "🛒" },
      { id: "comentar", tipo: "comentar", desc: "Comente em um produto", meta: 1, recompensa: 30, icon: "💬" },
    ];

    // Progresso real — lido do rankingPtsIncrement no user doc
    getDoc(doc(db, "users", user.uid)).then(u => {
      const ud = u.data();
      const hoje = new Date().toDateString();
      const jaReclamou = (ud?.missoesReclamadas?.[hoje] as string[]) || [];

      const built = MISSOES_DEFAULT.map(m => {
        let progresso = 0;
        if (m.tipo === "seguir") progresso = (userData?.following?.length || 0) > 0 ? 1 : 0;
        else if (m.tipo === "pedido") progresso = ud?.totalPedidos || 0;
        else if (m.tipo === "comentar") progresso = ud?.totalComentarios || 0;
        return { ...m, progresso, completado: progresso >= m.meta };
      });
      setMissoes(built);
      missoesRef.current = jaReclamou;
      setMissoesLoading(false);
    }).catch(() => setMissoesLoading(false));
  }, [user?.uid, userData?.following]);

  const reclamarRecompensa = async (missao: typeof missoes[0]) => {
    if (!user?.uid || missao.completado || missoesRef.current.includes(missao.id)) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        rankingPts: increment(missao.recompensa),
        [`missoesReclamadas.${new Date().toDateString()}`]: arrayUnion(missao.id),
      });
      missoesRef.current = [...missoesRef.current, missao.id];
      setMissoes(prev => prev.map(m => m.id === missao.id ? { ...m, completado: true } : m));
    } catch {}
  };

  const isFollowing = selectedSlug ? (userData?.following || []).includes(selectedSlug) : false;

  const handleFollowToggle = async () => {
    if (!user?.uid || !selectedSlug) return;
    setFollowingLoading(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        following: isFollowing ? arrayRemove(selectedSlug) : arrayUnion(selectedSlug),
      });
    } catch {}
    setFollowingLoading(false);
  };

  // Load followed stores for selector
  useEffect(() => {
    if (!userData?.following?.length) return;
    const slugs = userData.following.slice(0, 30);
    getDocs(query(collection(db, "lojas"))).then(snap => {
      const map: Record<string, { nome: string; logo?: string | null }> = {};
      snap.docs.forEach(d => {
        if (slugs.includes(d.id)) {
          map[d.id] = { nome: d.data().nome || d.id, logo: d.data().logoUrl || d.data().logo };
        }
      });
      setFollowedStores(map);
      if (slugs.length > 0 && !selectedSlug) setSelectedSlug(slugs[0]);
    });
  }, [userData?.following]);

  // Load per-store fans when slug changes — real-time via onSnapshot
  useEffect(() => {
    setStoreFansLoading(true);

    if (demoMode) {
      // Demo mode: inject user into fake list
      const myIdx = user ? Math.floor(Math.random() * 5) + 2 : -1;
      const withMe: Fan[] = DEMO_FANS.map((f, i) => ({
        ...f,
        pos: i < myIdx ? i + 1 : i + 2,
        isMe: i === myIdx,
      }));
      if (user && myIdx < withMe.length) {
        withMe.splice(myIdx, 0, {
          uid: user.uid, nome: userData?.nome || "Você", foto: userData?.photoURL || null,
          pts: 1750 + Math.floor(Math.random() * 300), pos: myIdx + 1, isMe: true,
        });
      }
      const resorted = withMe.sort((a, b) => b.pts - a.pts).map((f, i) => ({ ...f, pos: i + 1 }));
      setStoreFans(resorted);
      setStoreFansLoading(false);
      return;
    }

    if (!selectedSlug) { setStoreFansLoading(false); return; }

    const q = query(collection(db, `tenants/${selectedSlug}/fans`), orderBy("pts", "desc"), limit(20));
    const unsub = onSnapshot(q, snap => {
      const fanDocs = snap.docs;
      const fansComUser: Fan[] = fanDocs.map((d, i) => {
        const data = d.data();
        return {
          uid: d.id,
          nome: data.nome || data.displayName || "Cliente",
          foto: data.foto || data.photoURL || null,
          pts: data.pts || 0,
          pos: i + 1,
          isMe: d.id === user?.uid,
        };
      });

      const myIdx = fansComUser.findIndex(f => f.isMe);
      const myFan = fansComUser[myIdx];
      const newPos = myFan ? myFan.pos : null;

      // Detect if someone passed the user (rank shift down = someone moved above)
      if (prevMyPosRef.current !== null && newPos !== null && newPos > prevMyPosRef.current) {
        // Find who just passed — look in prevFans for someone now above the user but was below before
        const prevFans = prevFansRef.current;
        const prevMyIdx = prevFans.findIndex(f => f.isMe);
        if (prevMyIdx >= 0) {
          const prevMyPts = prevFans[prevMyIdx].pts;
          // Anyone with pts > user's prev pts and lower pos now is the passer
          const passer = fansComUser.find(f => !f.isMe && f.pos < newPos && f.pts >= prevMyPts);
          if (passer) {
            setPasserInfo({ nome: passer.nome, pts: passer.pts });
            setTimeout(() => setPasserInfo(null), 5000);
          }
        }
        setRankShift("down");
        setTimeout(() => setRankShift(null), 1200);
      } else if (prevMyPosRef.current !== null && newPos !== null && newPos < prevMyPosRef.current) {
        setRankShift("up");
        setTimeout(() => setRankShift(null), 1200);
      }
      if (newPos !== null) prevMyPosRef.current = newPos;
      prevFansRef.current = fansComUser;

      // Badge "quase perdendo posição" — alguém abaixo está a >=80% dos seus pts
      if (myFan) {
        const belowFan = fansComUser[myIdx + 1];
        if (belowFan && myFan.pts > 0 && belowFan.pts >= myFan.pts * 0.8) {
          setNearBelow({ nome: belowFan.nome, pts: belowFan.pts, gap: Math.abs(belowFan.pts - myFan.pts) });
        } else {
          setNearBelow(null);
        }
      } else {
        setNearBelow(null);
      }

      setStoreFans(fansComUser);
      if (myIdx >= 0) {
        setMyNeighbours({
          above: myIdx > 0 ? { ...fansComUser[myIdx - 1] } : null,
          below: myIdx < fansComUser.length - 1 ? { ...fansComUser[myIdx + 1] } : null,
        });
      } else {
        setMyNeighbours({ above: null, below: null });
      }
      setStoreFansLoading(false);
    });
    return unsub;
  }, [selectedSlug, user, demoMode]);

  // Load city rankings (top 10 stores by fan points sum)
  useEffect(() => {
    setCityLoading(true);
    getDocs(query(collection(db, "lojas"), orderBy("nome"))).then(async snap => {
      const lojas = snap.docs.map(d => ({ tenantId: d.id, nome: d.data().nome || d.id, slug: d.id, logo: d.data().logoUrl || d.data().logo } as { tenantId: string; nome: string; slug: string; logo?: string | null }));

      const withPts = await Promise.all(lojas.map(async loja => {
        const fansSnap = await getDocs(query(collection(db, `tenants/${loja.tenantId}/fans`), orderBy("pts", "desc"), limit(3)));
        const total = fansSnap.docs.reduce((acc, d) => acc + (d.data().pts || 0), 0);
        const topFans = await Promise.all(fansSnap.docs.slice(0, 3).map(async (d, i) => {
          const u = await getDoc(doc(db, "users", d.id));
          const ud = u.exists() ? u.data() : null;
          return { nome: ud?.nome || ud?.displayName || "Cliente", foto: ud?.photoURL || null, pts: d.data().pts || 0, pos: i + 1 };
        }));
        return { ...loja, totalFanPts: total, seguidores: fansSnap.size, topFans } as StoreRanking;
      }));

      withPts.sort((a, b) => b.totalFanPts - a.totalFanPts);
      setCityRankings(withPts.slice(0, 10));
      setCityLoading(false);
    }).catch(() => setCityLoading(false));
  }, []);

  const MedalColor = (pos: number) => pos === 1 ? "#f5c518" : pos === 2 ? "#9ca3af" : pos === 3 ? "#cd7f32" : "rgba(255,255,255,.2)";
  const MedalEmoji = (pos: number) => pos === 1 ? "👑" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `#${pos}`;

  const leftColStyle = { flex: 1, minWidth: 0, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 20, overflow: "hidden", display: "flex" as const, flexDirection: "column" as const };
  const centerColStyle = rankShift
    ? { flex: 1, minWidth: 0, background: "rgba(124,58,237,.05)", border: "2px solid rgba(168,85,247,.6)", borderRadius: 20, overflow: "hidden", display: "flex" as const, flexDirection: "column" as const, animation: "rankShift 1.2s ease-out", boxShadow: "0 0 30px rgba(168,85,247,.25)" }
    : { flex: 1, minWidth: 0, background: "rgba(255,255,255,.03)", border: "1px solid rgba(124,58,237,.25)", borderRadius: 20, overflow: "hidden", display: "flex" as const, flexDirection: "column" as const, boxShadow: "0 0 30px rgba(124,58,237,.08)" };

  return (
    <div
      style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Outfit', sans-serif", color: "#fff", touchAction: "pan-y" }}
      onTouchStart={e => { pullStartY.current = e.touches[0].clientY; }}
      onTouchMove={e => {
        const dy = e.touches[0].clientY - pullStartY.current;
        if (dy > 0 && window.scrollY === 0) setPullDist(Math.min(dy, 120));
      }}
      onTouchEnd={() => {
        if (pullDist > 80) { setPulling(true); setPullDist(0); setTimeout(() => setPulling(false), 1200); }
        else setPullDist(0);
      }}
    >
      <style>{`
        @keyframes medalPulse { 0%,100%{transform:scale(1);filter:drop-shadow(0 0 6px rgba(245,197,24,.5))} 50%{transform:scale(1.15);filter:drop-shadow(0 0 16px rgba(245,197,24,.9))} }
        @keyframes podiumNear { 0%,100%{box-shadow:0 0 12px rgba(245,197,24,.3);border-color:rgba(245,197,24,.35)} 50%{box-shadow:0 0 24px rgba(245,197,24,.6);border-color:rgba(245,197,24,.7)} }
        @keyframes goldShimmer { 0%,100%{text-shadow:0 0 8px rgba(245,197,24,.6),0 0 20px rgba(245,197,24,.3)} 50%{text-shadow:0 0 20px rgba(245,197,24,.9),0 0 50px rgba(245,197,24,.5)} }
        @keyframes cardEnter { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes defendPulse { 0%,100%{box-shadow:0 0 10px rgba(239,68,68,.3)} 50%{box-shadow:0 0 20px rgba(239,68,68,.6)} }
        @keyframes rankShift { 0%{box-shadow:0 0 0 0 rgba(168,85,247,.7)} 40%{box-shadow:0 0 0 10px rgba(168,85,247,.3)} 70%,100%{box-shadow:0 0 0 0 rgba(168,85,247,0)} }
        @keyframes neonMe { 0%,100%{box-shadow:0 0 8px rgba(138,92,246,.5),0 0 20px rgba(138,92,246,.2)} 50%{box-shadow:0 0 20px rgba(138,92,246,.8),0 0 40px rgba(138,92,246,.4)} }
        @keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
        @keyframes toastSlide { 0%{transform:translateY(-80px);opacity:0} 10%{transform:translateY(0);opacity:1} 80%{transform:translateY(0);opacity:1} 100%{transform:translateY(-80px);opacity:0} }
        @keyframes sharePop { 0%{transform:scale(1)} 50%{transform:scale(1.15)} 100%{transform:scale(1)} }
        .hub-cols { display:flex;gap:16px;width:100%;padding:0 0 80px }
        .hub-col { flex:1;min-width:0;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:20;overflow:hidden;display:flex;flex-direction:column }
        @media(max-width:767px){ .hub-cols{flex-direction:column;padding:0 0 80px} }
      `}</style>

      {/* Pull-to-refresh indicator */}
      {(pulling || pullDist > 0) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "12px 0", background: "rgba(124,58,237,.15)", borderBottom: "1px solid rgba(124,58,237,.3)", transition: "height 0.1s" }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(124,58,237,.4)", borderTopColor: "#a855f7", animation: pulling ? "spin 0.8s linear infinite" : "none", fontSize: "0.65rem" }} />
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#a855f7" }}>
            {pulling ? "Atualizando..." : "↓ Puxe para atualizar"}
          </span>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(8,4,18,.97)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(245,197,24,.15)", padding: "0 16px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", cursor: "pointer", fontSize: "1.1rem", padding: 0 }}>←</button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", fontWeight: 900, color: "#f5c518", animation: "goldShimmer 3s ease-in-out infinite" }}>🏆 Rankings Central</div>
        </div>
        {user && storeFans.find(f => f.isMe) && (
          <div style={{ fontSize: "0.7rem", color: "#a855f7", fontWeight: 700 }}>#{storeFans.find(f => f.isMe)!.pos} · {storeFans.find(f => f.isMe)!.pts.toLocaleString()} pts</div>
        )}
        <button
          onClick={() => setDemoMode(d => !d)}
          style={{ background: demoMode ? "rgba(245,197,24,.2)" : "rgba(255,255,255,.06)", border: `1px solid ${demoMode ? "rgba(245,197,24,.5)" : "rgba(255,255,255,.15)"}`, borderRadius: 10, padding: "4px 10px", color: demoMode ? "#f5c518" : "rgba(255,255,255,.4)", fontSize: "0.65rem", fontWeight: 700, cursor: "pointer" }}
        >
          🎮 Demo
        </button>
        <button
          onClick={() => {
            const myFan = storeFans.find(f => f.isMe);
            const store = followedStores[selectedSlug || ""];
            const text = myFan
              ? `🏆 Estou no ranking da ${store?.nome || "loja"} no Nexfoody!\n📍 Posição #${myFan.pos} com ${myFan.pts.toLocaleString()} pontos\n\n🔗 nexfoody.com/rankings`
              : `🏆 Confira o ranking dos fãs no Nexfoody!\n🔗 nexfoody.com/rankings`;
            if (navigator.share) {
              navigator.share({ title: "Nexfoody Rankings", text });
            } else {
              navigator.clipboard.writeText(text);
              setShareToast(true);
              setTimeout(() => setShareToast(false), 2000);
            }
          }}
          style={{ background: "rgba(245,197,24,.1)", border: "1px solid rgba(245,197,24,.3)", borderRadius: 10, padding: "4px 10px", color: "#f5c518", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
        >
          📤
        </button>
      </div>

      {/* Mobile tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,.07)", padding: "0 8px" }}>
        {(["loja", "eu", "cidade"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: "10px 0", background: "none", border: "none", borderBottom: activeTab === tab ? "2px solid #f5c518" : "2px solid transparent", color: activeTab === tab ? "#f5c518" : "rgba(255,255,255,.35)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer", transition: "all 0.2s" }}>
            {tab === "loja" ? "🏆 Loja" : tab === "eu" ? "⭐ Eu" : "🌟 Cidade"}
          </button>
        ))}
      </div>

      {/* Toast — "X te ultrapassou!" */}
      {passerInfo && (
        <div style={{ position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 999, animation: "toastSlide 5s ease-in-out forwards", pointerEvents: "none" }}>
          <div style={{ background: "linear-gradient(135deg, rgba(239,68,68,.95), rgba(168,85,247,.95))", border: "1px solid rgba(255,255,255,.2)", borderRadius: 16, padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>
            <span style={{ fontSize: "1.3rem" }}>⚠️</span>
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: "rgba(255,255,255,.7)", marginBottom: 2 }}>Você foi ultrapassado!</div>
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#fff" }}><span style={{ color: "#f5c518" }}>{passerInfo.nome}</span> subiu de posição</div>
            </div>
          </div>
        </div>
      )}

      {/* Toast — link copiado */}
      {shareToast && (
        <div style={{ position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)", zIndex: 999, animation: "toastSlide 2s ease-in-out forwards", pointerEvents: "none" }}>
          <div style={{ background: "rgba(34,197,94,.95)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 12, padding: "10px 18px", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 20px rgba(0,0,0,.4)" }}>
            <span style={{ fontSize: "1rem" }}>📋</span>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff" }}>Link copiado!</span>
          </div>
        </div>
      )}

      {/* 3-column layout */}
      <div className="hub-cols">
        {/* LEFT COLUMN */}
        <div className="hub-col" style={{ display: activeTab === "loja" ? "flex" : "none" }}>
          <ColumnHeader emoji="🏆" label="Ranking da Loja" accent="#f5c518" />
          {!user ? (
            <LoginPrompt onLogin={() => navigate("/login")} />
          ) : !selectedSlug || Object.keys(followedStores).length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>🏪</div>
              <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,.4)", lineHeight: 1.5 }}>Siga lojas para ver o ranking de fãs delas aqui</div>
              <button onClick={() => navigate("/loja")} style={{ marginTop: 12, padding: "8px 16px", background: "rgba(245,197,24,.1)", border: "1px solid rgba(245,197,24,.3)", borderRadius: 10, color: "#f5c518", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>Descobrir lojas →</button>
            </div>
          ) : (
            <div>
              <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <select value={selectedSlug || ""} onChange={e => setSelectedSlug(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>
                  {Object.entries(followedStores).map(([slug, s]) => (<option key={slug} value={slug}>{s.nome}</option>))}
                </select>
              </div>
              <div style={{ padding: "8px 12px 0" }}>
                <CountdownWidget slug={selectedSlug || ""} compact />
                <PrizesCard slug={selectedSlug || ""} compact />
              </div>
              {storeFansLoading ? <LoadingSkeleton count={5} /> : storeFans.length === 0 ? (
                <div style={{ padding: "32px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🏆</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1rem", fontWeight: 900, color: "#fff", marginBottom: 6 }}>Nenhum fã ainda</div>
                  <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,.4)", marginBottom: 16 }}>Seja o primeiro a seguir esta loja e entre no ranking!</div>
                  <button
                    onClick={() => {
                      if (!user) { navigate("/nexfoody/login"); return; }
                      handleFollowToggle();
                    }}
                    disabled={followingLoading}
                    style={{
                      padding: "10px 24px",
                      background: !user ? "linear-gradient(135deg, #7c3aed, #a855f7)" : isFollowing ? "rgba(124,58,237,.15)" : "linear-gradient(135deg, #7c3aed, #a855f7)",
                      border: isFollowing ? "1px solid rgba(124,58,237,.4)" : "none",
                      borderRadius: 12,
                      color: "#fff",
                      fontFamily: "'Outfit', sans-serif",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      cursor: followingLoading ? "not-allowed" : "pointer",
                      opacity: followingLoading ? 0.6 : 1,
                    }}
                  >
                    {!user ? "Entrar para seguir" : isFollowing ? "✓ Seguindo" : "🏆 Seguir loja!"}
                  </button>
                </div>
              ) : (
                <div>
                  <Top3Podium fans={storeFans.slice(0, 3)} />
                  {storeFans.slice(3).map(fan => <FanRow key={fan.uid} fan={fan} />)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* CENTER COLUMN */}
        <div className="hub-col" style={centerColStyle}>
          <ColumnHeader emoji="⭐" label="Meu Ranking" accent="#a855f7" />
          {!user ? (
            <LoginPrompt onLogin={() => navigate("/login")} />
          ) : storeFansLoading ? (
            <LoadingSkeleton count={4} />
          ) : !storeFans.find(f => f.isMe) ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "rgba(255,255,255,.25)", fontSize: "0.82rem" }}>Você ainda não é fã desta loja. Faça pedidos para pontuar!</div>
          ) : (
            <div>
              {((): JSX.Element => {
                const myFan = storeFans.find(f => f.isMe)!;
                const storeTop = storeFans.slice(0, 3);
                const myPos = myFan.pos;
                return (
                  <>
              <div style={{ margin: "12px", padding: "16px", background: "rgba(124,58,237,.1)", border: "1px solid rgba(124,58,237,.4)", borderRadius: 16, animation: "neonMe 3s ease-in-out infinite", textAlign: "center" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, color: "rgba(168,85,247,.7)", marginBottom: 8 }}>Sua posição</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: "2.2rem", fontWeight: 900, color: "#a855f7", lineHeight: 1 }}>#{myFan.pos}</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 900, color: "#f5c518", marginTop: 4 }}>{myFan.pts.toLocaleString()} pts</div>
                {myFan.foto ? (
                  <div style={{ width: 52, height: 52, borderRadius: "50%", overflow: "hidden", margin: "10px auto 0", border: "2px solid rgba(124,58,237,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img src={myFan.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(124,58,237,.2)", margin: "10px auto 0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>
                    {myFan.nome?.[0] || "?"}
                  </div>
                )}
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff", marginTop: 6 }}>Você 🎉</div>
              </div>

              {/* Mini card do líder */}
              {storeTop[0] && storeTop[0].uid !== user?.uid && (
                <div style={{ margin: "0 12px 8px", display: "flex", alignItems: "center", gap: 10, background: "rgba(245,197,24,.06)", border: "1px solid rgba(245,197,24,.2)", borderRadius: 14, padding: "10px 12px", animation: "goldShimmer 3s ease-in-out infinite" }}>
                  <div style={{ fontSize: "1.4rem" }}>👑</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, color: "rgba(245,197,24,.6)", marginBottom: 2 }}>Líder Atual</div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#f5c518", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{storeTop[0].nome}</div>
                  </div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "0.88rem", fontWeight: 900, color: "#f5c518" }}>{storeTop[0].pts.toLocaleString()} pts</div>
                </div>
              )}

              {/* Countdown + Prêmios da loja selecionada */}
              <div style={{ margin: "0 12px 8px" }}>
                <CountdownWidget slug={selectedSlug || ""} compact />
                <PrizesCard slug={selectedSlug || ""} compact />
              </div>

              {/* Badge "Defenda sua posição" — alguém abaixo está perto */}
              {nearBelow && myPos > 1 && (
                <div style={{ margin: "0 12px 10px", padding: "10px 14px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.35)", borderRadius: 14, textAlign: "center", animation: "defendPulse 1.5s ease-in-out infinite" }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, color: "rgba(239,68,68,.7)", marginBottom: 4 }}>⚠️ Defenda sua posição</div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff" }}>
                    <span style={{ color: "#ef4444", fontWeight: 900 }}>{nearBelow.nome}</span> está perto de te ultrapassar!
                  </div>
                </div>
              )}

              {/* Badge "Próximo ao Pódio" — posições 4-6 */}
              {myPos >= 4 && myPos <= 6 && storeTop[2] && (
                (() => {
                  const faltam = Math.max(0, storeTop[2].pts - myFan.pts + 1);
                  return (
                    <div style={{ margin: "0 12px 10px", padding: "10px 14px", background: "linear-gradient(135deg, rgba(245,197,24,.12), rgba(205,127,50,.08))", border: "1px solid rgba(245,197,24,.35)", borderRadius: 14, textAlign: "center", animation: "podiumNear 2s ease-in-out infinite" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, color: "rgba(245,197,24,.7)", marginBottom: 4 }}>🔥 Próximo ao Pódio</div>
                      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff" }}>
                        Faltam <span style={{ color: "#f5c518", fontWeight: 900 }}>{faltam.toLocaleString()} pts</span> para o Top 3
                      </div>
                      <div style={{ height: 5, background: "rgba(255,255,255,.08)", borderRadius: 3, overflow: "hidden", margin: "8px 0 6px" }}>
                        <div style={{ height: "100%", width: `${Math.min(95, Math.round((myFan.pts / Math.max(storeTop[2].pts, 1)) * 100))}%`, background: "linear-gradient(90deg, #a855f7, #f5c518)", borderRadius: 3, boxShadow: "0 0 6px rgba(245,197,24,.4)" }} />
                      </div>
                    </div>
                  );
                })()
              )}

              {/* Barra de progresso — posições 7+ (liderança) */}
              {myPos > 6 && storeTop[0] && (() => {
                const top1Pts = storeTop[0].pts;
                const faltam = Math.max(0, top1Pts - myFan.pts + 1);
                const pct = Math.min(99, Math.round((myFan.pts / Math.max(top1Pts, 1)) * 100));
                return (
                  <div style={{ margin: "0 12px 10px", background: "rgba(245,197,24,.06)", border: "1px solid rgba(245,197,24,.2)", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#a855f7" }}>🎯 Sua missão</div>
                      <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.4)" }}>{pct}% do líder</div>
                    </div>
                    <div style={{ height: 7, background: "rgba(255,255,255,.08)", borderRadius: 4, overflow: "hidden", marginBottom: 7 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #a855f7, #f5c518)", borderRadius: 4, transition: "width 1s ease", boxShadow: "0 0 8px rgba(245,197,24,.35)" }} />
                    </div>
                    <div style={{ fontSize: "0.73rem", color: "rgba(255,255,255,.6)", fontWeight: 600 }}>
                      Faltam <span style={{ color: "#f5c518", fontWeight: 900 }}>{faltam.toLocaleString()} pts</span> para assumir a liderança 🏆
                    </div>
                  </div>
                );
              })()}

              <div style={{ padding: "0 12px 8px" }}>
                {myNeighbours.above && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "rgba(255,255,255,.03)", borderRadius: 10, marginBottom: 6, opacity: 0.7 }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: "0.78rem", color: "rgba(255,255,255,.3)", minWidth: 26 }}>#{myNeighbours.above.pos}</div>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,.06)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem" }}>
                      {myNeighbours.above.foto ? <img src={myNeighbours.above.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (myNeighbours.above.nome?.[0] || "?")}
                    </div>
                    <div style={{ flex: 1, fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{myNeighbours.above.nome}</div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#f5c518" }}>{myNeighbours.above.pts.toLocaleString()}</div>
                  </div>
                )}
                {myNeighbours.below && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "rgba(255,255,255,.03)", borderRadius: 10, opacity: 0.7 }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: "0.78rem", color: "rgba(255,255,255,.3)", minWidth: 26 }}>#{myNeighbours.below.pos}</div>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,.06)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem" }}>
                      {myNeighbours.below.foto ? <img src={myNeighbours.below.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (myNeighbours.below.nome?.[0] || "?")}
                    </div>
                    <div style={{ flex: 1, fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{myNeighbours.below.nome}</div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#f5c518" }}>{myNeighbours.below.pts.toLocaleString()}</div>
                  </div>
                )}
              </div>
              <div style={{ padding: "4px 12px 0", borderTop: "1px solid rgba(255,255,255,.05)" }}>
                <div style={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, color: "rgba(255,255,255,.2)", margin: "8px 0 6px", textAlign: "center" }}>Top 10 da Loja</div>
                {storeFans.slice(0, 10).map((u, i) => (
                  <div key={u.uid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", background: u.isMe ? "rgba(124,58,237,.07)" : "transparent", borderRadius: 8, marginBottom: 2 }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: "0.72rem", color: MedalColor(i + 1), minWidth: 22 }}>{MedalEmoji(i + 1)}</div>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(255,255,255,.06)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem" }}>
                      {u.foto ? <img src={u.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (u.nome?.[0] || "?")}
                    </div>
                    <div style={{ flex: 1, fontSize: "0.75rem", fontWeight: u.isMe ? 800 : 500, color: u.isMe ? "#a855f7" : "rgba(255,255,255,.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.isMe ? "Você" : u.nome}
                    </div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: "0.75rem", fontWeight: 900, color: u.isMe ? "#a855f7" : "#f5c518" }}>{u.pts.toLocaleString()}</div>
                  </div>
                ))}
              </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="hub-col" style={{ display: activeTab === "cidade" ? "flex" : "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderBottom: "2px solid rgba(245,197,24,.3)", height: 48 }}>
            <span style={{ fontSize: "1.1rem" }}>🌟</span>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: "0.95rem", fontWeight: 900, color: "#f5c518", letterSpacing: 1 }}>Ranking da Cidade</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              {(["week", "month", "all"] as const).map(p => (
                <button key={p} onClick={() => setPeriodFilter(p)} style={{ padding: "3px 8px", background: periodFilter === p ? "rgba(245,197,24,.15)" : "transparent", border: `1px solid ${periodFilter === p ? "rgba(245,197,24,.5)" : "rgba(255,255,255,.1)"}`, borderRadius: 8, color: periodFilter === p ? "#f5c518" : "rgba(255,255,255,.3)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.65rem", cursor: "pointer", transition: "all 0.2s" }}>
                  {p === "week" ? "7d" : p === "month" ? "30d" : "Todos"}
                </button>
              ))}
            </div>
          </div>

          {/* Missões Diárias — dentro da aba cidade */}
          {!missoesLoading && missoes.length > 0 && (
            <div style={{ margin: "12px", padding: "14px", background: "rgba(34,197,94,.06)", border: "1px solid rgba(34,197,94,.25)", borderRadius: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: "1rem" }}>📋</span>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: "0.85rem", fontWeight: 900, color: "#22c55e", letterSpacing: 1 }}>Missões Diárias</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {missoes.map(m => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", background: m.completado ? "rgba(34,197,94,.08)" : "rgba(255,255,255,.03)", border: m.completado ? "1px solid rgba(34,197,94,.3)" : "1px solid rgba(255,255,255,.06)", borderRadius: 12 }}>
                    <span style={{ fontSize: "1.1rem" }}>{m.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: m.completado ? "#22c55e" : "#fff", marginBottom: 4 }}>{m.desc}</div>
                      <div style={{ height: 4, background: "rgba(255,255,255,.08)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, Math.round((m.progresso / m.meta) * 100))}%`, background: m.completado ? "#22c55e" : "linear-gradient(90deg, #22c55e, #a855f7)", borderRadius: 2, transition: "width 0.5s ease" }} />
                      </div>
                      <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,.35)", marginTop: 2 }}>{m.progresso}/{m.meta}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "#f5c518" }}>+{m.recompensa}</div>
                      {m.completado ? (
                        <div style={{ fontSize: "0.65rem", color: "#22c55e", fontWeight: 700 }}>✓ Feito</div>
                      ) : (
                        <button
                          onClick={() => reclamarRecompensa(m)}
                          style={{ padding: "4px 10px", background: "linear-gradient(135deg, #22c55e, #16a34a)", border: "none", borderRadius: 8, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.68rem", cursor: "pointer" }}
                        >
                          Pegar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cityLoading ? <LoadingSkeleton count={6} /> : cityRankings.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "rgba(255,255,255,.25)", fontSize: "0.82rem" }}>Nenhuma loja ainda. Seja o primeiro a abrir uma!</div>
          ) : (
            <div>
              {cityRankings.map((loja, idx) => {
                const pos = idx + 1;
                return (
                  <div key={loja.tenantId} onClick={() => navigate(`/rankings/${loja.slug}`)} style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,.05)", cursor: "pointer", animation: `cardEnter 0.4s ease-out both`, animationDelay: `${idx * 60}ms` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: "0.9rem", color: MedalColor(pos), minWidth: 28, textAlign: "center" }}>{MedalEmoji(pos)}</div>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(245,197,24,.1)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {loja.logo ? <img src={loja.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "1.1rem" }}>{loja.nome?.[0] || "🏪"}</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loja.nome}</div>
                        <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.35)", marginTop: 1 }}>{loja.seguidores} fãs · {loja.totalFanPts.toLocaleString()} pts</div>
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "#a855f7", fontWeight: 700 }}>🏆 Ver</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
