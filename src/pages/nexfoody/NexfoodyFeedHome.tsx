// src/pages/nexfoody/NexfoodyFeedHome.tsx
// Feed TikTok: posts clientes · posts loja · cardápio em destaque · top compradores
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection, query, orderBy, limit, onSnapshot,
  updateDoc, doc, arrayUnion, arrayRemove, where, getDocs
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import type { LojaMeta } from "../../types/tenant";
import { avaliarRegrasFeed } from "../../lib/feedEngine";

// ─── TIPOS DE CARD ────────────────────────────────────────────
interface CustomerPost {
  _type: "customer";
  id: string;
  userNome?: string;
  userFoto?: string | null;
  foto?: string | null;
  video?: string | null;
  legenda?: string;
  produtoNome?: string;
  curtidas?: string[];
  lojaNome?: string;
  lojaSlug?: string;
  lojaCategoria?: string;
  lojaAvaliacao?: number;
  pontos?: number;
  bgGradient?: string;
  emoji?: string;
  _sortTs?: number;
}

interface StorePost {
  _type: "store";
  id: string;
  tipo: "promo" | "novidade" | "aviso";
  texto: string;
  foto?: string | null;
  lojaNome: string;
  lojaSlug: string;
  lojaEmoji: string;
  lojaColor: string;
  lojaGlow: string;
  _sortTs?: number;
}

interface MenuCard {
  _type: "menu";
  id: string;
  produtoId: string;
  nome: string;
  desc?: string;
  preco: number;
  foto?: string | null;
  emoji: string;
  bgGradient: string;
  lojaNome: string;
  lojaSlug: string;
  lojaEmoji: string;
  vendidosSemana?: number;
  _sortTs?: number;
}

interface TopBuyerCard {
  _type: "topbuyer";
  id: string;
  userNome: string;
  userFoto?: string | null;
  pedidosSemana: number;
  pontosSemana: number;
  totalGasto: number;
  ranking: number;
  badge: string;
  lojaMaisFrequente: string;
  lojaSlug: string;
  bgGradient: string;
  _sortTs?: number;
}

type FeedItem = CustomerPost | StorePost | MenuCard | TopBuyerCard;

// ─── CONFIG TIPO POST LOJA ────────────────────────────────────
const TIPO_CFG = {
  promo:    { emoji: "🔥", label: "Promoção", color: "#f5c518", bg: "linear-gradient(160deg,#1a0a0a,#7f1d1d,#431407)" },
  novidade: { emoji: "✨", label: "Novidade", color: "#22c55e", bg: "linear-gradient(160deg,#052e16,#16a34a,#065f46)" },
  aviso:    { emoji: "📢", label: "Aviso",    color: "#60a5fa", bg: "linear-gradient(160deg,#0c1a35,#1e40af,#1e3a5f)" },
};

// ─── MOCK: posts de clientes ──────────────────────────────────
const MOCK_CUSTOMERS: CustomerPost[] = [
  { _type:"customer", id:"mc1", userNome:"Julia Rodrigues", foto:null, legenda:"Melhor açaí da cidade! 🍓 Esse de morango com granola é perfeito.", produtoNome:"Açaí 500ml Premium", curtidas:Array(234).fill("x"), lojaNome:"Açaí Puro Gosto", lojaSlug:"acaipurogosto", lojaCategoria:"🍧", lojaAvaliacao:4.9, pontos:15, bgGradient:"linear-gradient(160deg,#1a0a36,#7c3aed,#4c1d95)", emoji:"🍓", _sortTs:Date.now()-2*60000 },
  { _type:"customer", id:"mc2", userNome:"Diego Vasconcelos", foto:null, legenda:"Lanche top demais, já é o terceiro da semana 😂🔥", produtoNome:"X-Burgão Especial", curtidas:Array(89).fill("x"), lojaNome:"Lanches Naturais", lojaSlug:"lanchesnaturais", lojaCategoria:"🥗", lojaAvaliacao:4.7, pontos:12, bgGradient:"linear-gradient(160deg,#052e16,#16a34a,#065f46)", emoji:"🥗", _sortTs:Date.now()-8*60000 },
  { _type:"customer", id:"mc3", userNome:"Letícia Menezes", foto:null, legenda:"Pizza chegou quentinha, olha esse queijo derretendo ✨🍕", produtoNome:"Pizza Quatro Queijos", curtidas:Array(176).fill("x"), lojaNome:"Pizza da Vila", lojaSlug:"pizzadavila", lojaCategoria:"🍕", lojaAvaliacao:4.8, pontos:20, bgGradient:"linear-gradient(160deg,#3b0000,#dc2626,#7f1d1d)", emoji:"🍕", _sortTs:Date.now()-18*60000 },
  { _type:"customer", id:"mc4", userNome:"Marcos Pereira", foto:null, legenda:"Já virei o #1 fã dessa loja 👑 diamantes chegando todo pedido!", produtoNome:"Combo Família 1L", curtidas:Array(412).fill("x"), lojaNome:"Açaí Puro Gosto", lojaSlug:"acaipurogosto", lojaCategoria:"🍧", lojaAvaliacao:4.9, pontos:30, bgGradient:"linear-gradient(160deg,#0c0a20,#a855f7,#6d28d9)", emoji:"👑", _sortTs:Date.now()-35*60000 },
  { _type:"customer", id:"mc5", userNome:"Fernanda Lima", foto:null, legenda:"Sorvete de copo aqui é outra coisa 🍦🤤 super recomendo!", produtoNome:"Sorvete de Copo 400g", curtidas:Array(67).fill("x"), lojaNome:"Sorvetes Gelado", lojaSlug:"sorvetes-gelado", lojaCategoria:"🍦", lojaAvaliacao:4.6, pontos:8, bgGradient:"linear-gradient(160deg,#172554,#3b82f6,#1e40af)", emoji:"🍦", _sortTs:Date.now()-55*60000 },
  { _type:"customer", id:"mc6", userNome:"Rafael Costa", foto:null, legenda:"Segunda vez hoje aqui kk impossível resistir 😋", produtoNome:"Açaí com Leite Condensado", curtidas:Array(143).fill("x"), lojaNome:"Açaí Puro Gosto", lojaSlug:"acaipurogosto", lojaCategoria:"🍧", lojaAvaliacao:4.9, pontos:15, bgGradient:"linear-gradient(160deg,#1a0a36,#6d28d9,#2e1065)", emoji:"😋", _sortTs:Date.now()-70*60000 },
];

// ─── MOCK: posts oficiais da loja ─────────────────────────────
const MOCK_STORE: StorePost[] = [
  { _type:"store", id:"ms1", tipo:"promo", texto:"🔥 COMBO DA SEMANA: Açaí 500ml + Granola + Leite Ninho por apenas R$18,90! Válido até domingo. Use o cupom COMBO10.", lojaNome:"Açaí Puro Gosto", lojaSlug:"acaipurogosto", lojaEmoji:"🍧", lojaColor:"#f5c518", lojaGlow:"rgba(245,197,24,0.3)", _sortTs:Date.now()-5*60000 },
  { _type:"store", id:"ms2", tipo:"novidade", texto:"✨ NOVIDADE: Açaí de Pitaya com Coco Queimado chegou! Venha experimentar essa combinação que virou febre.", lojaNome:"Açaí Puro Gosto", lojaSlug:"acaipurogosto", lojaEmoji:"🍧", lojaColor:"#22c55e", lojaGlow:"rgba(34,197,94,0.3)", _sortTs:Date.now()-25*60000 },
];

// ─── MOCK: cardápio em destaque ───────────────────────────────
const MOCK_MENU: MenuCard[] = [
  { _type:"menu", id:"mm1", produtoId:"p1", nome:"Açaí 500ml Premium", desc:"Açaí batido na hora com frutas da época, granola crocante e leite condensado", preco:15.90, foto:null, emoji:"🍓", bgGradient:"linear-gradient(160deg,#2e0a3a,#7c3aed 45%,#9333ea)", lojaNome:"Açaí Puro Gosto", lojaSlug:"acaipurogosto", lojaEmoji:"🍧", vendidosSemana:147, _sortTs:Date.now()-12*60000 },
  { _type:"menu", id:"mm2", produtoId:"p2", nome:"Combo Família 1 Litro", desc:"O mais pedido da semana! Açaí 1L com 3 complementos à sua escolha", preco:32.00, foto:null, emoji:"👨‍👩‍👧", bgGradient:"linear-gradient(160deg,#0a1628,#1e3a8a 45%,#3b82f6)", lojaNome:"Açaí Puro Gosto", lojaSlug:"acaipurogosto", lojaEmoji:"🍧", vendidosSemana:89, _sortTs:Date.now()-40*60000 },
  { _type:"menu", id:"mm3", produtoId:"p3", nome:"Açaí de Pitaya 400ml", desc:"Novidade da casa! Pitaya rosa com açaí batido, granola e coco queimado", preco:18.90, foto:null, emoji:"🐉", bgGradient:"linear-gradient(160deg,#2d0030,#9d174d 45%,#ec4899)", lojaNome:"Açaí Puro Gosto", lojaSlug:"acaipurogosto", lojaEmoji:"🍧", vendidosSemana:62, _sortTs:Date.now()-80*60000 },
];

// ─── MOCK: top compradores da semana ─────────────────────────
const MOCK_TOPBUYERS: TopBuyerCard[] = [
  { _type:"topbuyer", id:"tb1", userNome:"Marcos Pereira", userFoto:null, pedidosSemana:12, pontosSemana:840, totalGasto:198.50, ranking:1, badge:"👑", lojaMaisFrequente:"Açaí Puro Gosto", lojaSlug:"acaipurogosto", bgGradient:"linear-gradient(160deg,#0c0a20,#7c3aed 40%,#f5c518 100%)", _sortTs:Date.now()-15*60000 },
  { _type:"topbuyer", id:"tb2", userNome:"Julia Rodrigues", userFoto:null, pedidosSemana:8, pontosSemana:560, totalGasto:134.20, ranking:2, badge:"🥈", lojaMaisFrequente:"Açaí Puro Gosto", lojaSlug:"acaipurogosto", bgGradient:"linear-gradient(160deg,#0a0a20,#1e3a8a 40%,#7c3aed 100%)", _sortTs:Date.now()-45*60000 },
];

const MOCK_LOJAS: LojaMeta[] = [
  { tenantId:"acaipurogosto",   slug:"acaipurogosto",  nome:"Açaí Puro Gosto",  categoria:"Açaí",    avaliacao:4.9, ativo:true } as unknown as LojaMeta,
  { tenantId:"lanchesnaturais", slug:"lanchesnaturais", nome:"Lanches Naturais", categoria:"Lanches", avaliacao:4.7, ativo:true } as unknown as LojaMeta,
  { tenantId:"pizzadavila",     slug:"pizzadavila",     nome:"Pizza da Vila",    categoria:"Pizza",   avaliacao:4.8, ativo:true } as unknown as LojaMeta,
];

const CATEGORIAS = [
  { id:"todos",   icon:"✨", label:"Todos"    },
  { id:"açaí",    icon:"🍧", label:"Açaí"     },
  { id:"lanches", icon:"🥪", label:"Lanches"  },
  { id:"burger",  icon:"🍔", label:"Burger"   },
  { id:"pizza",   icon:"🍕", label:"Pizza"    },
  { id:"sorvete", icon:"🍦", label:"Sorvetes" },
  { id:"sushi",   icon:"🍣", label:"Sushi"    },
  { id:"bebidas", icon:"🥤", label:"Bebidas"  },
];

const CATS_COMIDA = ["açaí","pizza","hamburguer","burger","lanches","sorvetes","sorvete","sucos","doces","comida","lanche","restaurante","food","delivery"];
const isNaoComida = (categoria: string) => !CATS_COMIDA.some(c => categoria?.toLowerCase().includes(c));

// ─── HELPERS ─────────────────────────────────────────────────
function timeAgo(ts: number | null): string {
  if (!ts) return "agora";
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return "agora";
  if (d < 3600) return `${Math.floor(d/60)}min`;
  if (d < 86400) return `${Math.floor(d/3600)}h`;
  return `${Math.floor(d/86400)}d`;
}
function avatarBg(nome: string) {
  return ["#7c3aed","#2563eb","#16a34a","#dc2626","#d97706","#db2777"][(nome?.charCodeAt(0)||0) % 6];
}
function buildFeed(
  customers: CustomerPost[],
  storePosts: StorePost[],
  menuCards: MenuCard[],
  topBuyers: TopBuyerCard[]
): FeedItem[] {
  // Pool de conteúdo da plataforma — intercalado a cada 2 posts de clientes
  // Ordem de rotação: top_buyer → menu → store_post → menu → store_post → top_buyer → ...
  const injected: FeedItem[] = [];
  const maxLen = Math.max(storePosts.length, menuCards.length, topBuyers.length);
  for (let i = 0; i < maxLen * 3; i++) {
    if (i % 3 === 0 && topBuyers[Math.floor(i/3) % topBuyers.length]) injected.push(topBuyers[Math.floor(i/3) % topBuyers.length]);
    else if (i % 3 === 1 && menuCards[Math.floor(i/3) % menuCards.length]) injected.push(menuCards[Math.floor(i/3) % menuCards.length]);
    else if (i % 3 === 2 && storePosts[Math.floor(i/3) % storePosts.length]) injected.push(storePosts[Math.floor(i/3) % storePosts.length]);
  }
  const result: FeedItem[] = [];
  let si = 0;
  customers.forEach((c, i) => {
    result.push(c);
    if ((i + 1) % 2 === 0 && si < injected.length) result.push(injected[si++]);
  });
  while (si < injected.length) result.push(injected[si++]);
  return result;
}

// ─── CARD: POST DE CLIENTE ────────────────────────────────────
// ─── SIDEBAR INOVADORA (cardápio/loja) ───────────────────────
function NexSidebar({ lojaSlug, nome, legenda }: { lojaSlug?: string; nome?: string; legenda?: string }) {
  const navigate = useNavigate();
  const [fome, setFome] = useState(false);
  const [fomes, setFomes] = useState(Math.floor(40 + Math.random() * 200));
  const [querTentar, setQuerTentar] = useState(false);
  const [tentarCount, setTentarCount] = useState(Math.floor(10 + Math.random() * 80));
  const [showReacoes, setShowReacoes] = useState(false);
  const [reacaoRapida, setReacaoRapida] = useState<string | null>(null);

  const REACOES_RAPIDAS = [
    { emoji:"🤤", label:"Gostoso" }, { emoji:"🔥", label:"Perfeito" },
    { emoji:"💰", label:"Barato" },  { emoji:"🚀", label:"Rápido" },
    { emoji:"😍", label:"Amei" },    { emoji:"👑", label:"O melhor" },
  ];

  const fmt = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n);

  return (
    <>
      <AnimatePresence>
        {reacaoRapida && (
          <motion.div initial={{ opacity:0, scale:.5, y:0 }} animate={{ opacity:1, scale:1.4, y:-60 }} exit={{ opacity:0, scale:.8, y:-100 }}
            style={{ position:"absolute", right:28, bottom:256, fontSize:"2.5rem", zIndex:30, pointerEvents:"none" }}>
            {reacaoRapida}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ position:"absolute", right:10, bottom:200, display:"flex", flexDirection:"column", alignItems:"center", gap:6, zIndex:10 }}>
        {/* 🔥 Fome */}
        <motion.button whileTap={{ scale:1.35 }} onClick={() => { setFome(p => !p); setFomes(p => p + (fome ? -1 : 1)); }}
          style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <motion.div animate={fome ? { scale:[1,1.6,1], rotate:[0,15,-15,0] } : {}} transition={{ duration:.45 }}
            style={{ width:38, height:38, borderRadius:12, background:fome?"rgba(239,68,68,.25)":"rgba(255,255,255,.1)", backdropFilter:"blur(8px)", border:`1.5px solid ${fome?"rgba(239,68,68,.6)":"rgba(255,255,255,.2)"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.45rem", boxShadow:fome?"0 0 16px rgba(239,68,68,.4)":"none", transition:"all .25s" }}>
            🔥
          </motion.div>
          <span style={{ fontSize:"0.56rem", color:fome?"#fca5a5":"rgba(255,255,255,.8)", fontWeight:800, textShadow:"0 1px 4px rgba(0,0,0,.9)" }}>{fmt(fomes)}</span>
          <span style={{ fontSize:"0.48rem", color:"rgba(255,255,255,.45)", fontWeight:600, textShadow:"0 1px 4px rgba(0,0,0,.9)", marginTop:-2 }}>Fome</span>
        </motion.button>

        {/* 🛒 Pedir */}
        <motion.button whileTap={{ scale:1.2 }} onClick={() => lojaSlug && navigate(`/loja/${lojaSlug}`)}
          style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <div style={{ width:38, height:38, borderRadius:12, background:"rgba(245,197,24,.18)", backdropFilter:"blur(8px)", border:"1.5px solid rgba(245,197,24,.4)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 12px rgba(245,197,24,.15)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5c518" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          </div>
          <span style={{ fontSize:"0.56rem", color:"#f5c518", fontWeight:800, textShadow:"0 1px 4px rgba(0,0,0,.9)" }}>Pedir</span>
          <span style={{ fontSize:"0.48rem", color:"rgba(255,255,255,.45)", fontWeight:600, marginTop:-2 }}>agora</span>
        </motion.button>

        {/* 💬 Reagir */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, position:"relative" }}>
          <AnimatePresence>
            {showReacoes && (
              <motion.div initial={{ opacity:0, scale:.8, y:10 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:.8, y:10 }}
                style={{ position:"absolute", bottom:58, right:0, background:"rgba(8,4,18,.95)", backdropFilter:"blur(16px)", border:"1px solid rgba(255,255,255,.12)", borderRadius:18, padding:"10px 8px", display:"flex", flexDirection:"column", gap:6, zIndex:20 }}>
                {REACOES_RAPIDAS.map(r => (
                  <motion.button key={r.emoji} whileTap={{ scale:1.3 }} onClick={() => { setReacaoRapida(r.emoji); setShowReacoes(false); setTimeout(() => setReacaoRapida(null), 1800); }}
                    style={{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:8, padding:"4px 8px", borderRadius:10 }}
                    onMouseEnter={e => (e.currentTarget.style.background="rgba(255,255,255,.08)")}
                    onMouseLeave={e => (e.currentTarget.style.background="none")}>
                    <span style={{ fontSize:"1.2rem" }}>{r.emoji}</span>
                    <span style={{ fontSize:"0.65rem", color:"rgba(255,255,255,.7)", fontWeight:600, whiteSpace:"nowrap" }}>{r.label}</span>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button whileTap={{ scale:1.2 }} onClick={() => setShowReacoes(p => !p)}
            style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
            <div style={{ width:38, height:38, borderRadius:12, background:"rgba(255,255,255,.1)", backdropFilter:"blur(8px)", border:"1.5px solid rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <span style={{ fontSize:"0.56rem", color:"rgba(255,255,255,.8)", fontWeight:800, textShadow:"0 1px 4px rgba(0,0,0,.9)" }}>Reagir</span>
          </motion.button>
        </div>

        {/* 🎯 Quero tentar */}
        <motion.button whileTap={{ scale:1.3 }} onClick={() => { setQuerTentar(p => !p); setTentarCount(p => p + (querTentar ? -1 : 1)); }}
          style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <motion.div animate={querTentar ? { scale:[1,1.5,1] } : {}} transition={{ duration:.35 }}
            style={{ width:38, height:38, borderRadius:12, background:querTentar?"rgba(168,85,247,.25)":"rgba(255,255,255,.1)", backdropFilter:"blur(8px)", border:`1.5px solid ${querTentar?"rgba(168,85,247,.6)":"rgba(255,255,255,.2)"}`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:querTentar?"0 0 16px rgba(168,85,247,.4)":"none", transition:"all .25s" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={querTentar?"#a855f7":"none"} stroke={querTentar?"#a855f7":"rgba(255,255,255,.9)"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </motion.div>
          <span style={{ fontSize:"0.56rem", color:querTentar?"#c084fc":"rgba(255,255,255,.8)", fontWeight:800, textShadow:"0 1px 4px rgba(0,0,0,.9)" }}>{fmt(tentarCount)}</span>
          <span style={{ fontSize:"0.48rem", color:"rgba(255,255,255,.45)", fontWeight:600, marginTop:-2 }}>Quero</span>
        </motion.button>

        {/* 🤝 Chama */}
        <motion.button whileTap={{ scale:1.2 }}
          onClick={() => navigator.share?.({ title:"Olha isso no NexFoody!", text:`${legenda||nome||""}\n\nVem comigo 🍓`, url:window.location.href }).catch(()=>{})}
          style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <div style={{ width:38, height:38, borderRadius:12, background:"rgba(52,211,153,.15)", backdropFilter:"blur(8px)", border:"1.5px solid rgba(52,211,153,.35)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          </div>
          <span style={{ fontSize:"0.56rem", color:"#34d399", fontWeight:800, textShadow:"0 1px 4px rgba(0,0,0,.9)" }}>Chama</span>
        </motion.button>

        {/* 🔁 Repostar */}
        <motion.button whileTap={{ scale:1.2 }}
          style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <div style={{ width:38, height:38, borderRadius:12, background:"rgba(255,255,255,.08)", backdropFilter:"blur(8px)", border:"1.5px solid rgba(255,255,255,.15)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          </div>
          <span style={{ fontSize:"0.56rem", color:"rgba(255,255,255,.7)", fontWeight:800, textShadow:"0 1px 4px rgba(0,0,0,.9)" }}>Repostar</span>
        </motion.button>

        {/* 🛍️ + Lojas */}
        <Link to="/lojas" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, textDecoration:"none" }}>
          <div style={{ width:38, height:38, borderRadius:12, background:"rgba(99,102,241,.18)", backdropFilter:"blur(8px)", border:"1.5px solid rgba(99,102,241,.45)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1rem" }}>
            🛍️
          </div>
          <span style={{ fontSize:"0.56rem", color:"#a5b4fc", fontWeight:800, textShadow:"0 1px 4px rgba(0,0,0,.9)" }}>+ Lojas</span>
        </Link>

      </div>
    </>
  );
}

// ─── CARD: POST DE CLIENTE ────────────────────────────────────
function CustomerPostCard({ post, isCurrent, userId }: { post: CustomerPost; isCurrent: boolean; userId?: string }) {
  const [curtido, setCurtido] = useState(userId ? (post.curtidas?.includes(userId) ?? false) : false);
  const [curtidas, setCurtidas] = useState(post.curtidas?.length ?? 0);
  const [openComments, setOpenComments] = useState(false);
  const [salvo, setSalvo] = useState(() => {
    if (!userId) return false;
    const lista = JSON.parse(localStorage.getItem(`feedsFav_${userId}`) || "[]");
    return lista.some((f: any) => f.id === post.id);
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const playIconTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-play/pause quando card fica em foco
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isCurrent) {
      v.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
      setPlaying(false);
      setProgress(0);
    }
  }, [isCurrent]);

  const handleVideoTap = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
    if (playIconTimer.current) clearTimeout(playIconTimer.current);
    setShowPlayIcon(true);
    playIconTimer.current = setTimeout(() => setShowPlayIcon(false), 900);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const toggleCurtir = async () => {
    if (!userId) return;
    const novo = !curtido;
    setCurtido(novo); setCurtidas(p => p + (novo ? 1 : -1));
    try { await updateDoc(doc(db, "postagens", post.id), { curtidas: novo ? arrayUnion(userId) : arrayRemove(userId) }); } catch {}
  };

  const toggleSalvar = () => {
    if (!userId) return;
    const key = `feedsFav_${userId}`;
    const lista: any[] = JSON.parse(localStorage.getItem(key) || "[]");
    if (salvo) {
      localStorage.setItem(key, JSON.stringify(lista.filter((f: any) => f.id !== post.id)));
      setSalvo(false);
    } else {
      lista.push({ id: post.id, foto: post.foto, legenda: post.legenda, userNome: post.userNome, savedAt: Date.now() });
      localStorage.setItem(key, JSON.stringify(lista));
      setSalvo(true);
    }
  };

  const hasVideo = !!post.video;

  return (
    <div style={{ position:"relative", width:"100%", height:"100%", overflow:"hidden" }}>
      {/* ── MÍDIA: vídeo ou foto ou gradiente ── */}
      {hasVideo ? (
        <video
          ref={videoRef}
          src={post.video!}
          muted
          loop
          playsInline
          preload="metadata"
          onTimeUpdate={() => {
            const v = videoRef.current;
            if (v && v.duration) setProgress(v.currentTime / v.duration);
          }}
          onClick={handleVideoTap}
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", cursor:"pointer" }}
        />
      ) : post.foto ? (
        <img src={post.foto} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
      ) : (
        <div style={{ position:"absolute", inset:0, background: post.bgGradient || "#1a0a36" }} />
      )}

      {/* ── GRADIENTE ESCURO ── */}
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom,rgba(0,0,0,.08) 0%,transparent 25%,transparent 45%,rgba(0,0,0,.65) 75%,rgba(0,0,0,.92) 100%)", pointerEvents:"none" }} />

      {/* ── PLAY/PAUSE ICON FLASH ── */}
      <AnimatePresence>
        {showPlayIcon && (
          <motion.div initial={{ opacity:0, scale:.5 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:1.4 }}
            style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:72, height:72, borderRadius:"50%", background:"rgba(0,0,0,.55)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none", zIndex:15 }}>
            {playing
              ? <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
            }
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BARRA DE PROGRESSO (só vídeo) ── */}
      {hasVideo && (
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:3, background:"rgba(255,255,255,.15)", zIndex:25, pointerEvents:"none" }}>
          <div style={{ height:"100%", background:"#f5c518", width:`${progress*100}%`, transition:"width .1s linear", borderRadius:2 }} />
        </div>
      )}

      {/* ── BADGE VÍDEO + BOTÃO MUTE ── */}
      {hasVideo && (
        <motion.button whileTap={{ scale:1.2 }} onClick={toggleMute}
          style={{ position:"absolute", top:14, right:54, background:"rgba(0,0,0,.55)", backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,.2)", borderRadius:20, padding:"5px 10px", display:"flex", alignItems:"center", gap:5, cursor:"pointer", zIndex:12 }}>
          {muted
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
          }
          <span style={{ fontSize:"0.6rem", color:"white", fontWeight:700 }}>{muted ? "Som" : "Mudo"}</span>
        </motion.button>
      )}

      {/* ── BADGE VÍDEO (indicador) ── */}
      {hasVideo && (
        <div style={{ position:"absolute", top:14, left:14, display:"flex", alignItems:"center", gap:5, background:"rgba(0,0,0,.55)", backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,.2)", borderRadius:20, padding:"5px 10px", zIndex:12 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          <span style={{ fontSize:"0.6rem", color:"white", fontWeight:700 }}>Vídeo</span>
        </div>
      )}

      {/* Badges de pontos/loja local — só quando não tem vídeo (para não sobrepor) */}
      {!hasVideo && isCurrent && post.pontos && (
        <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} style={{ position:"absolute", top:14, left:14, display:"flex", alignItems:"center", gap:5, background:"rgba(245,197,24,.18)", backdropFilter:"blur(8px)", border:"1px solid rgba(245,197,24,.4)", borderRadius:20, padding:"4px 12px", fontSize:"0.72rem", fontWeight:700, color:"#f5c518", zIndex:10 }}>
          💎 +{post.pontos} pts ao pedir
        </motion.div>
      )}
      {!hasVideo && isCurrent && post.lojaCategoria && isNaoComida(post.lojaCategoria) && (
        <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} style={{ position:"absolute", top:14, left:14, display:"flex", alignItems:"center", gap:5, background:"rgba(99,102,241,.18)", backdropFilter:"blur(8px)", border:"1px solid rgba(99,102,241,.4)", borderRadius:20, padding:"4px 12px", fontSize:"0.72rem", fontWeight:700, color:"#a5b4fc", zIndex:10 }}>
          🛍️ Loja local
        </motion.div>
      )}
      <div style={{ position:"absolute", top:14, right:14, fontSize:"0.65rem", color:"rgba(255,255,255,.45)", fontWeight:600, zIndex:10 }}>{timeAgo(post._sortTs||null)}</div>

      {/* ── SIDEBAR SOCIAL (posts de clientes) ── */}
      <div style={{ position:"absolute", right:10, bottom:140, display:"flex", flexDirection:"column", alignItems:"center", gap:6, zIndex:10 }}>

        {/* ❤️ Curtir */}
        <motion.button whileTap={{ scale:1.3 }} onClick={toggleCurtir}
          style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <motion.div animate={curtido ? { scale:[1,1.5,1] } : {}} transition={{ duration:.3 }}
            style={{ width:38, height:38, borderRadius:12, background:curtido?"rgba(239,68,68,.25)":"rgba(255,255,255,.1)", backdropFilter:"blur(8px)", border:`1.5px solid ${curtido?"rgba(239,68,68,.6)":"rgba(255,255,255,.2)"}`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:curtido?"0 0 16px rgba(239,68,68,.4)":"none", transition:"all .25s" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={curtido?"#ef4444":"none"} stroke={curtido?"#ef4444":"rgba(255,255,255,.9)"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </motion.div>
          <span style={{ fontSize:"0.56rem", color:curtido?"#fca5a5":"rgba(255,255,255,.8)", fontWeight:800, textShadow:"0 1px 4px rgba(0,0,0,.9)" }}>
            {curtidas >= 1000 ? `${(curtidas/1000).toFixed(1)}k` : curtidas}
          </span>
        </motion.button>

        {/* 💬 Comentar */}
        <motion.button whileTap={{ scale:1.2 }} onClick={() => setOpenComments(true)}
          style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <div style={{ width:38, height:38, borderRadius:12, background:"rgba(255,255,255,.1)", backdropFilter:"blur(8px)", border:"1.5px solid rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <span style={{ fontSize:"0.56rem", color:"rgba(255,255,255,.8)", fontWeight:800, textShadow:"0 1px 4px rgba(0,0,0,.9)" }}>Coment.</span>
        </motion.button>

        {/* 🔁 Repostar */}
        <motion.button whileTap={{ scale:1.2 }}
          style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <div style={{ width:38, height:38, borderRadius:12, background:"rgba(255,255,255,.1)", backdropFilter:"blur(8px)", border:"1.5px solid rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          </div>
          <span style={{ fontSize:"0.56rem", color:"rgba(255,255,255,.8)", fontWeight:800, textShadow:"0 1px 4px rgba(0,0,0,.9)" }}>Repostar</span>
        </motion.button>

        {/* 🔖 Salvar */}
        <motion.button whileTap={{ scale:1.3 }} onClick={toggleSalvar}
          style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <motion.div animate={salvo ? { scale:[1,1.5,1] } : {}} transition={{ duration:.3 }}
            style={{ width:38, height:38, borderRadius:12, background:salvo?"rgba(245,197,24,.25)":"rgba(255,255,255,.1)", backdropFilter:"blur(8px)", border:`1.5px solid ${salvo?"rgba(245,197,24,.6)":"rgba(255,255,255,.2)"}`, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:salvo?"0 0 16px rgba(245,197,24,.4)":"none", transition:"all .25s" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={salvo?"#f5c518":"none"} stroke={salvo?"#f5c518":"rgba(255,255,255,.9)"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </motion.div>
          <span style={{ fontSize:"0.56rem", color:salvo?"#f5c518":"rgba(255,255,255,.8)", fontWeight:800, textShadow:"0 1px 4px rgba(0,0,0,.9)" }}>
            {salvo ? "Salvo" : "Salvar"}
          </span>
        </motion.button>

        {/* 📤 Enviar */}
        <motion.button whileTap={{ scale:1.2 }}
          onClick={() => navigator.share?.({ title:`${post.userNome} no NexFoody`, text:`${post.legenda||""}\n\nVeja no NexFoody 🍓`, url:window.location.href }).catch(()=>{})}
          style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <div style={{ width:38, height:38, borderRadius:12, background:"rgba(255,255,255,.08)", backdropFilter:"blur(8px)", border:"1.5px solid rgba(255,255,255,.15)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </div>
          <span style={{ fontSize:"0.56rem", color:"rgba(255,255,255,.7)", fontWeight:800, textShadow:"0 1px 4px rgba(0,0,0,.9)" }}>Enviar</span>
        </motion.button>

      </div>

      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 14px 22px", zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:12 }}>
          <div style={{ width:40, height:40, borderRadius:"50%", background:avatarBg(post.userNome||"A"), border:"2px solid rgba(255,255,255,.4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.1rem", fontWeight:800, color:"#fff", flexShrink:0 }}>
            {post.userFoto ? <img src={post.userFoto} alt="" style={{ width:"100%", height:"100%", borderRadius:"50%", objectFit:"cover" }} /> : post.userNome?.[0]||"A"}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:800, fontSize:"0.85rem", color:"#fff", textShadow:"0 1px 4px rgba(0,0,0,.8)" }}>@{post.userNome?.toLowerCase().replace(" ",".")||"anônimo"}</div>
            {post.produtoNome && <div style={{ fontSize:"0.7rem", color:"rgba(255,255,255,.6)", textShadow:"0 1px 4px rgba(0,0,0,.8)" }}>{post.produtoNome}</div>}
            {post.legenda && <div style={{ fontSize:"0.8rem", color:"rgba(255,255,255,.9)", textShadow:"0 1px 4px rgba(0,0,0,.8)", marginTop:3, lineHeight:1.4, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" as const, overflow:"hidden" as const }}>{post.legenda}</div>}
          </div>
        </div>
        {post.lojaSlug && (
          <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:.15 }} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(8,4,18,.85)", backdropFilter:"blur(16px)", border:"1px solid rgba(255,255,255,.14)", borderRadius:16, padding:"10px 14px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, minWidth:0 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:"rgba(124,58,237,.25)", border:"1px solid rgba(124,58,237,.4)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontWeight:800, fontSize:"0.82rem", color:"#fff", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{post.lojaNome}</div>
                <div style={{ fontSize:"0.65rem", color:"rgba(255,255,255,.5)" }}>⭐ {post.lojaAvaliacao?.toFixed(1)} · 15–30min</div>
              </div>
            </div>
            <Link to={`/loja/${post.lojaSlug}`} style={{ display:"flex", alignItems:"center", gap:5, background:"linear-gradient(135deg,#f5c518,#e6a817)", borderRadius:20, padding:"7px 14px", fontWeight:800, fontSize:"0.75rem", color:"#0a0414", textDecoration:"none", flexShrink:0, marginLeft:10 }}>Pedir →</Link>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {openComments && (
          <motion.div initial={{ y:"100%" }} animate={{ y:0 }} exit={{ y:"100%" }} transition={{ type:"spring", damping:30 }} onClick={e => e.stopPropagation()} style={{ position:"absolute", bottom:0, left:0, right:0, background:"rgba(8,4,18,.97)", backdropFilter:"blur(20px)", borderRadius:"20px 20px 0 0", border:"1px solid rgba(255,255,255,.1)", padding:"20px 16px", maxHeight:"60%", display:"flex", flexDirection:"column", zIndex:20 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontWeight:800, fontSize:"0.9rem", color:"#fff" }}>💬 Comentários</div>
              <button onClick={() => setOpenComments(false)} style={{ background:"none", border:"none", color:"rgba(255,255,255,.5)", fontSize:"1.2rem", cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:"auto", marginBottom:12 }}><div style={{ textAlign:"center", color:"rgba(255,255,255,.3)", fontSize:"0.8rem", padding:"20px 0" }}>Seja o primeiro a comentar!</div></div>
            <div style={{ display:"flex", gap:8 }}>
              <input placeholder="Adicionar comentário..." style={{ flex:1, background:"rgba(255,255,255,.08)", border:"1px solid rgba(255,255,255,.1)", borderRadius:20, padding:"10px 16px", color:"#fff", fontFamily:"'Outfit',sans-serif", fontSize:"0.85rem", outline:"none" }} />
              <button style={{ background:"linear-gradient(135deg,#f5c518,#e6a817)", border:"none", borderRadius:20, padding:"10px 16px", fontWeight:800, fontSize:"0.8rem", color:"#0a0414", cursor:"pointer" }}>Enviar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── CARD: POST OFICIAL DA LOJA ───────────────────────────────
function StorePostCard({ post, isCurrent }: { post: StorePost; isCurrent: boolean }) {
  const cfg = TIPO_CFG[post.tipo] || TIPO_CFG.aviso;
  return (
    <div style={{ position:"relative", width:"100%", height:"100%", overflow:"hidden" }}>
      {post.foto
        ? <><img src={post.foto} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} /><div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.5)" }} /></>
        : <div style={{ position:"absolute", inset:0, background:cfg.bg }}>
            <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-60%)", fontSize:"clamp(8rem,25vw,14rem)", opacity:.1, filter:"blur(3px)", userSelect:"none" }}>{cfg.emoji}</div>
            <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse 70% 60% at 50% 40%,${post.lojaGlow},transparent 70%)` }} />
          </div>
      }
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom,rgba(0,0,0,.12) 0%,transparent 20%,transparent 40%,rgba(0,0,0,.7) 75%,rgba(0,0,0,.95) 100%)", pointerEvents:"none" }} />
      <NexSidebar lojaSlug={post.lojaSlug} legenda={post.texto} />
      <div style={{ position:"absolute", top:14, left:14, right:14, display:"flex", alignItems:"center", gap:8, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(8,4,18,.7)", backdropFilter:"blur(10px)", border:`1px solid ${post.lojaColor}40`, borderRadius:20, padding:"5px 12px" }}>
          <span style={{ fontSize:"1rem" }}>{post.lojaEmoji}</span>
          <span style={{ fontSize:"0.72rem", fontWeight:800, color:post.lojaColor }}>{post.lojaNome}</span>
          <span style={{ fontSize:"0.6rem", color:"rgba(255,255,255,.4)", borderLeft:"1px solid rgba(255,255,255,.1)", paddingLeft:6 }}>Parceiro</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4, background:`${cfg.color}22`, border:`1px solid ${cfg.color}50`, borderRadius:20, padding:"5px 10px", marginLeft:"auto" }}>
          <span style={{ fontSize:"0.75rem" }}>{cfg.emoji}</span>
          <span style={{ fontSize:"0.68rem", fontWeight:700, color:cfg.color }}>{cfg.label}</span>
        </div>
      </div>
      <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:"80%", textAlign:"center", zIndex:5, pointerEvents:"none" }}>
        <motion.div initial={{ scale:.8, opacity:0 }} animate={isCurrent ? { scale:1, opacity:1 } : {}} transition={{ duration:.5 }} style={{ fontSize:"clamp(4rem,15vw,7rem)", marginBottom:8 }}>{cfg.emoji}</motion.div>
      </div>
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 14px 22px", zIndex:10 }}>
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.1 }} style={{ background:"rgba(8,4,18,.82)", backdropFilter:"blur(14px)", border:`1px solid ${post.lojaColor}25`, borderRadius:18, padding:"16px", marginBottom:12 }}>
          <div style={{ fontSize:"0.9rem", color:"rgba(255,255,255,.9)", lineHeight:1.55, fontWeight:500 }}>{post.texto}</div>
        </motion.div>
        <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:.2 }} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(8,4,18,.85)", backdropFilter:"blur(16px)", border:"1px solid rgba(255,255,255,.14)", borderRadius:16, padding:"10px 14px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:`${post.lojaColor}20`, border:`1px solid ${post.lojaColor}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.2rem", flexShrink:0 }}>{post.lojaEmoji}</div>
            <div><div style={{ fontWeight:800, fontSize:"0.82rem", color:"#fff" }}>{post.lojaNome}</div><div style={{ fontSize:"0.65rem", color:"rgba(255,255,255,.45)" }}>⭐ 4.9 · Aberta agora</div></div>
          </div>
          <Link to={`/loja/${post.lojaSlug}`} style={{ display:"flex", alignItems:"center", gap:5, background:`linear-gradient(135deg,${post.lojaColor},${post.lojaColor}bb)`, borderRadius:20, padding:"7px 16px", fontWeight:800, fontSize:"0.75rem", color:post.lojaColor==="#f5c518"?"#0a0414":"#fff", textDecoration:"none", flexShrink:0, marginLeft:10 }}>Ver cardápio →</Link>
        </motion.div>
      </div>
    </div>
  );
}

// ─── CARD: PRODUTO DO CARDÁPIO ────────────────────────────────
function MenuItemCard({ card, isCurrent }: { card: MenuCard; isCurrent: boolean }) {
  return (
    <div style={{ position:"relative", width:"100%", height:"100%", overflow:"hidden" }}>
      {card.foto
        ? <><img src={card.foto} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} /><div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.45)" }} /></>
        : <div style={{ position:"absolute", inset:0, background:card.bgGradient }}>
            <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 65% 55% at 50% 35%,rgba(255,255,255,.06),transparent 70%)" }} />
          </div>
      }
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom,rgba(0,0,0,.08) 0%,transparent 20%,transparent 40%,rgba(0,0,0,.6) 70%,rgba(0,0,0,.95) 100%)", pointerEvents:"none" }} />
      <NexSidebar lojaSlug={card.lojaSlug} nome={card.nome} legenda={card.desc} />

      {/* Badges topo */}
      <div style={{ position:"absolute", top:14, left:14, right:14, display:"flex", alignItems:"center", gap:8, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(8,4,18,.7)", backdropFilter:"blur(10px)", border:"1px solid rgba(245,197,24,.3)", borderRadius:20, padding:"5px 12px" }}>
          <span style={{ fontSize:"1rem" }}>{card.lojaEmoji}</span>
          <span style={{ fontSize:"0.72rem", fontWeight:800, color:"#f5c518" }}>{card.lojaNome}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(245,197,24,.15)", border:"1px solid rgba(245,197,24,.4)", borderRadius:20, padding:"5px 10px", marginLeft:"auto" }}>
          <span style={{ fontSize:"0.75rem" }}>🍽️</span>
          <span style={{ fontSize:"0.68rem", fontWeight:700, color:"#f5c518" }}>Cardápio</span>
        </div>
      </div>

      {/* Produto centralizado */}
      <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-55%)", textAlign:"center", zIndex:5, width:"85%", pointerEvents:"none" }}>
        <motion.div initial={{ opacity:0, y:16 }} animate={isCurrent ? { opacity:1, y:0 } : {}} transition={{ delay:.2, duration:.5 }}>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:"clamp(1.5rem,5vw,2.2rem)", fontWeight:900, color:"#fff", textShadow:"0 2px 12px rgba(0,0,0,.8)", lineHeight:1.1, marginBottom:10 }}>{card.nome}</div>
          {card.vendidosSemana && (
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(245,197,24,.15)", border:"1px solid rgba(245,197,24,.35)", borderRadius:20, padding:"4px 12px", fontSize:"0.72rem", fontWeight:700, color:"#f5c518" }}>
              🔥 {card.vendidosSemana} pedidos essa semana
            </div>
          )}
        </motion.div>
      </div>

      {/* Rodapé */}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 14px 12px", zIndex:10 }}>
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.1 }} style={{ background:"rgba(8,4,18,.82)", backdropFilter:"blur(14px)", border:"1px solid rgba(255,255,255,.1)", borderRadius:18, padding:"14px 16px", marginBottom:12 }}>
          {card.desc && <div style={{ fontSize:"0.82rem", color:"rgba(255,255,255,.7)", lineHeight:1.5, marginBottom:10 }}>{card.desc}</div>}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:"0.65rem", color:"rgba(255,255,255,.4)", textTransform:"uppercase", letterSpacing:"0.05em" }}>A partir de</div>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:"1.6rem", fontWeight:900, color:"#f5c518", lineHeight:1 }}>
                R$ {card.preco.toFixed(2).replace(".",",")}
              </div>
            </div>
            <Link to={`/loja/${card.lojaSlug}`} style={{ display:"flex", alignItems:"center", gap:6, background:"linear-gradient(135deg,#f5c518,#e6a817)", borderRadius:20, padding:"12px 20px", fontWeight:800, fontSize:"0.85rem", color:"#0a0414", textDecoration:"none" }}>
              🛒 Pedir agora
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── CARD: TOP COMPRADOR DA SEMANA ────────────────────────────
function TopBuyerCard({ card, isCurrent }: { card: TopBuyerCard; isCurrent: boolean }) {
  const rankColors: Record<number, string> = { 1:"#f5c518", 2:"#94a3b8", 3:"#cd7c2f" };
  const cor = rankColors[card.ranking] || "#a855f7";

  return (
    <div style={{ position:"relative", width:"100%", height:"100%", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, background:card.bgGradient }} />
      {/* Brilho radial */}
      <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse 80% 60% at 50% 40%,${cor}25,transparent 70%)` }} />
      {/* Partículas decorativas */}
      {isCurrent && Array.from({length:12}).map((_,i) => (
        <motion.div key={i} initial={{ opacity:0, scale:0 }} animate={{ opacity:[0,.8,0], scale:[0,1,0], y:[0,-80,0] }} transition={{ delay:i*0.15, duration:2, repeat:Infinity, repeatDelay:1 }} style={{ position:"absolute", left:`${10+i*7}%`, top:`${40+Math.sin(i)*20}%`, width:i%3===0?6:4, height:i%3===0?6:4, borderRadius:"50%", background:i%2===0?cor:"#a855f7" }} />
      ))}
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom,rgba(0,0,0,.05) 0%,transparent 30%,rgba(0,0,0,.6) 75%,rgba(0,0,0,.95) 100%)", pointerEvents:"none" }} />

      {/* Badge topo */}
      <div style={{ position:"absolute", top:14, left:14, right:14, display:"flex", alignItems:"center", justifyContent:"space-between", zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(8,4,18,.7)", backdropFilter:"blur(10px)", border:`1px solid ${cor}40`, borderRadius:20, padding:"5px 12px" }}>
          <span style={{ fontSize:"0.75rem" }}>🏆</span>
          <span style={{ fontSize:"0.72rem", fontWeight:800, color:cor }}>Fã da Semana</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5, background:`${cor}20`, border:`1px solid ${cor}50`, borderRadius:20, padding:"5px 12px" }}>
          <span style={{ fontSize:"1rem" }}>{card.badge}</span>
          <span style={{ fontSize:"0.72rem", fontWeight:800, color:cor }}>#{card.ranking}</span>
        </div>
      </div>

      {/* Avatar + nome centralizados */}
      <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-60%)", textAlign:"center", zIndex:5, pointerEvents:"none" }}>
        <motion.div initial={{ scale:.5, opacity:0 }} animate={isCurrent ? { scale:1, opacity:1 } : {}} transition={{ duration:.6, type:"spring" }} style={{ position:"relative", display:"inline-block", marginBottom:16 }}>
          <div style={{ width:100, height:100, borderRadius:"50%", background:avatarBg(card.userNome), border:`4px solid ${cor}`, boxShadow:`0 0 24px ${cor}80`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"2.8rem", fontWeight:900, color:"#fff" }}>
            {card.userFoto ? <img src={card.userFoto} alt="" style={{ width:"100%", height:"100%", borderRadius:"50%", objectFit:"cover" }} /> : card.userNome[0]}
          </div>
          <div style={{ position:"absolute", bottom:-6, right:-6, fontSize:"1.6rem" }}>{card.badge}</div>
        </motion.div>
        <motion.div initial={{ opacity:0, y:14 }} animate={isCurrent ? { opacity:1, y:0 } : {}} transition={{ delay:.25 }}>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:"clamp(1.3rem,4vw,1.8rem)", fontWeight:900, color:"#fff", textShadow:"0 2px 12px rgba(0,0,0,.8)", marginBottom:4 }}>{card.userNome}</div>
          <div style={{ fontSize:"0.78rem", color:"rgba(255,255,255,.6)", marginBottom:14 }}>Fã #{card.ranking} · {card.lojaMaisFrequente}</div>
          {/* Stats */}
          <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
            {[
              { icon:"📦", val:`${card.pedidosSemana}`, label:"pedidos" },
              { icon:"💎", val:card.pontosSemana.toLocaleString("pt-BR"), label:"pontos" },
              { icon:"💰", val:`R$${card.totalGasto.toFixed(0)}`, label:"gasto" },
            ].map((s,i) => (
              <motion.div key={i} initial={{ opacity:0, scale:.8 }} animate={isCurrent ? { opacity:1, scale:1 } : {}} transition={{ delay:.35+i*.1 }} style={{ background:"rgba(8,4,18,.5)", backdropFilter:"blur(8px)", border:`1px solid ${cor}30`, borderRadius:12, padding:"8px 12px", textAlign:"center", minWidth:60 }}>
                <div style={{ fontSize:"1rem", marginBottom:2 }}>{s.icon}</div>
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:"1rem", fontWeight:900, color:cor }}>{s.val}</div>
                <div style={{ fontSize:"0.6rem", color:"rgba(255,255,255,.4)", textTransform:"uppercase" }}>{s.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Rodapé: barra de progresso + CTA */}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 14px 22px", zIndex:10 }}>
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.15 }} style={{ background:"rgba(8,4,18,.85)", backdropFilter:"blur(14px)", border:`1px solid ${cor}25`, borderRadius:18, padding:"16px" }}>
          <div style={{ fontSize:"0.75rem", color:"rgba(255,255,255,.5)", marginBottom:8 }}>📊 Esta semana na NexFoody</div>
          {/* Barra de pontos */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
            <div style={{ flex:1, height:6, background:"rgba(255,255,255,.08)", borderRadius:3, overflow:"hidden" }}>
              <motion.div initial={{ width:0 }} animate={isCurrent ? { width:`${Math.min(100, (card.pontosSemana/1000)*100)}%` } : {}} transition={{ duration:1.2, delay:.5, ease:"easeOut" }} style={{ height:"100%", background:`linear-gradient(90deg,${cor},${cor}88)`, borderRadius:3 }} />
            </div>
            <span style={{ fontSize:"0.7rem", color:cor, fontWeight:700, whiteSpace:"nowrap" }}>{card.pontosSemana} / 1000 pts</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ fontSize:"0.75rem", color:"rgba(255,255,255,.45)", lineHeight:1.4 }}>
              Você também pode chegar<br />ao <span style={{ color:cor, fontWeight:700 }}>Top 3 da semana!</span>
            </div>
            <Link to="/ranking" style={{ display:"flex", alignItems:"center", gap:5, background:`linear-gradient(135deg,${cor},${cor}bb)`, borderRadius:20, padding:"10px 16px", fontWeight:800, fontSize:"0.75rem", color:card.ranking===1?"#0a0414":"#fff", textDecoration:"none", flexShrink:0, marginLeft:12 }}>
              Ver ranking →
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── STORE CARD (sidebar desktop) ────────────────────────────
function StoreCard({ loja }: { loja: LojaMeta }) {
  const em: Record<string,string> = { "Açaí":"🍧","Lanches":"🥗","Pizza":"🍕","Burguers":"🍔","Sorvetes":"🍦","Sushi":"🍣" };
  const l = loja as LojaMeta & { slug?:string; nome?:string; categoria?:string; avaliacao?:number; logoUrl?:string };
  return (
    <motion.div whileHover={{ scale:1.02, y:-2 }} style={{ background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)", borderRadius:16, padding:"14px", display:"flex", alignItems:"center", gap:12 }}>
      <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,rgba(124,58,237,.3),rgba(245,197,24,.1))", border:"1px solid rgba(124,58,237,.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.4rem", flexShrink:0 }}>
        {l.logoUrl ? <img src={l.logoUrl} alt="" style={{ width:"100%", height:"100%", borderRadius:12, objectFit:"cover" }} /> : (em[l.categoria||""]||"🏪")}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:800, fontSize:"0.85rem", color:"#fff", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{l.nome||l.tenantId}</div>
        <div style={{ fontSize:"0.68rem", color:"rgba(255,255,255,.4)", marginTop:2 }}>⭐ {l.avaliacao?.toFixed(1)||"4.8"} · 15–30 min</div>
      </div>
      <Link to={`/loja/${l.slug||l.tenantId}`} style={{ background:"linear-gradient(135deg,#7c3aed,#6d28d9)", borderRadius:10, padding:"8px 12px", fontWeight:800, fontSize:"0.72rem", color:"#fff", textDecoration:"none", flexShrink:0 }}>Ver →</Link>
    </motion.div>
  );
}

// ─── LABEL TIPO CARD ──────────────────────────────────────────
const CARD_LABEL: Record<FeedItem["_type"], { icon: string; text: string; color: string }> = {
  customer:  { icon:"👤", text:"Post de cliente",       color:"#f5c518" },
  store:     { icon:"🏪", text:"Post da loja",           color:"#22c55e" },
  menu:      { icon:"🍽️", text:"Destaque do cardápio",   color:"#a855f7" },
  topbuyer:  { icon:"🏆", text:"Fã da semana",           color:"#f5c518" },
};

// ═══════════════════════════════════════════════════════════════
export default function NexfoodyFeedHome() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [lojas, setLojas] = useState<LojaMeta[]>([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState("todos");
  const [postAtual, setPostAtual] = useState(0);
  const [chatNaoLido, setChatNaoLido] = useState(0);
  const [sheetCategoria, setSheetCategoria] = useState<string | null>(null);
  const [bannerMapa, setBannerMapa] = useState(() => sessionStorage.getItem("banner_mapa_visto") !== "1");
  const [cidadeDetectada, setCidadeDetectada] = useState<string | null>(null);
  const postRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragStartY = useRef(0);
  const dragDelta = useRef(0);

  // Detecta cidade via geolocalização + OpenStreetMap (gratuito, sem API key)
  useEffect(() => {
    const cached = sessionStorage.getItem("nexfoody_cidade");
    if (cached) { setCidadeDetectada(cached); return; }
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&accept-language=pt-BR`,
          { headers: { "Accept-Language": "pt-BR" } }
        );
        const data = await res.json();
        const cidade = data.address?.city || data.address?.town || data.address?.municipality || data.address?.village || null;
        const estado = data.address?.state_code || data.address?.state || null;
        const label = cidade && estado ? `${cidade} - ${estado}` : cidade || null;
        if (label) { setCidadeDetectada(label); sessionStorage.setItem("nexfoody_cidade", label); }
      } catch {}
    }, () => {});
  }, []);

  // Contagem de mensagens não-lidas
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "chats"), where("participantes", "array-contains", user.uid));
    return onSnapshot(q, snap => {
      const total = snap.docs.reduce((acc, d) => acc + (d.data().naoLido?.[user.uid] || 0), 0);
      setChatNaoLido(total);
    });
  }, [user?.uid]);

  // Carregar posts de clientes + posts da loja + produtos
  useEffect(() => {
    const q = query(collection(db, "postagens"), orderBy("createdAt","desc"), limit(15));
    const unsub = onSnapshot(q, async snap => {
      const customers: CustomerPost[] = snap.docs.map(d => ({
        _type:"customer" as const, id:d.id, ...d.data(),
        _sortTs: d.data().createdAt?.toDate?.()?.getTime?.() ?? Date.now(),
      }));

      // Rodar o engine de regras para acaipurogosto
      avaliarRegrasFeed("acaipurogosto", {
        nome: "Açaí Puro Gosto", slug: "acaipurogosto", emoji: "🍧", color: "#f5c518"
      }).then(autoItems => {
        if (autoItems.length > 0) {
          // Converte AutoFeedItems para CustomerPost (foto de cliente novo)
          const autoAsCustomers: CustomerPost[] = autoItems
            .filter(i => i.ruleKey === "novoClienteFoto")
            .map(i => ({
              _type: "customer" as const,
              id: i.id,
              userNome: i.userNome,
              userFoto: i.userFoto,
              foto: i.foto,
              legenda: i.legenda,
              produtoNome: (i.extra?.produtoNome as string) || undefined,
              curtidas: [],
              lojaNome: i.lojaNome,
              lojaSlug: i.lojaSlug,
              lojaCategoria: i.lojaEmoji,
              lojaAvaliacao: 4.9,
              pontos: i.pontos,
              bgGradient: "linear-gradient(160deg,#1a0a36,#7c3aed,#4c1d95)",
              emoji: "📸",
              _sortTs: i._sortTs,
            }));
          if (autoAsCustomers.length > 0) {
            setFeedItems(prev => {
              const sem = prev.filter(p => !p.id.startsWith("auto_ncf_"));
              return [...autoAsCustomers, ...sem];
            });
          }
        }
      }).catch(() => {});

      // Buscar posts oficiais da loja
      let storePosts: StorePost[] = [];
      try {
        const sp = await getDocs(query(collection(db,"tenants/acaipurogosto/posts"), orderBy("createdAt","desc"), limit(5)));
        if (!sp.empty) storePosts = sp.docs.map(d => {
          const data = d.data();
          const cor = data.tipo==="promo"?"#f5c518":data.tipo==="novidade"?"#22c55e":"#60a5fa";
          const glow = data.tipo==="promo"?"rgba(245,197,24,.3)":data.tipo==="novidade"?"rgba(34,197,94,.3)":"rgba(96,165,250,.3)";
          return { _type:"store" as const, id:d.id, tipo:data.tipo||"aviso", texto:data.texto||"", foto:data.foto||null, lojaNome:"Açaí Puro Gosto", lojaSlug:"acaipurogosto", lojaEmoji:"🍧", lojaColor:cor, lojaGlow:glow, _sortTs:data.createdAt?.toDate?.()?.getTime?.()??Date.now() };
        });
      } catch {}

      // Buscar produtos em destaque
      let menuCards: MenuCard[] = [];
      try {
        const mp = await getDocs(query(collection(db,"tenants/acaipurogosto/produtos"), where("ativo","==",true), limit(6)));
        if (!mp.empty) menuCards = mp.docs.slice(0,3).map((d,i) => {
          const p = d.data();
          const bgs = ["linear-gradient(160deg,#2e0a3a,#7c3aed 45%,#9333ea)","linear-gradient(160deg,#0a1628,#1e3a8a 45%,#3b82f6)","linear-gradient(160deg,#2d0030,#9d174d 45%,#ec4899)"];
          const emojis = ["🍓","🫐","🥭","🍇","🍒","🌴"];
          return { _type:"menu" as const, id:d.id, produtoId:d.id, nome:p.nome||"Produto", desc:p.desc||p.descricao||"", preco:Number(p.preco)||0, foto:p.foto||null, emoji:p.emoji||emojis[i%emojis.length], bgGradient:bgs[i%bgs.length], lojaNome:"Açaí Puro Gosto", lojaSlug:"acaipurogosto", lojaEmoji:"🍧", vendidosSemana:Math.floor(40+Math.random()*120), _sortTs:Date.now()-i*20*60000 };
        });
      } catch {}

      setFeedItems(buildFeed(customers, storePosts, menuCards, []));
    });
    return unsub;
  }, []);

  // Carregar lojas reais
  useEffect(() => {
    getDocs(query(collection(db,"lojas"), where("ativo","==",true))).then(snap => {
      const r = snap.docs.map(d => ({ tenantId:d.id, ...d.data() } as LojaMeta));
      if (r.length > 0) setLojas(r);
    });
  }, []);

  // IntersectionObserver para snap scroll
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { const i = postRefs.current.findIndex(r => r===e.target); if (i!==-1) setPostAtual(i); } }),
      { threshold:.6 }
    );
    postRefs.current.forEach(r => r && obs.observe(r));
    return () => obs.disconnect();
  }, [feedItems]);

  // Lojas filtradas para o sheet
  const CAT_KEYWORDS: Record<string, string[]> = {
    "todos":   [],
    "açaí":    ["açaí","acai"],
    "lanches": ["lanch","saudável","saudavel","natural","salada"],
    "burger":  ["burger","hamburguer","hambúrguer","lanche"],
    "pizza":   ["pizza","pizzaria"],
    "sorvete": ["sorvete","gelato","gelad","sorvet"],
  };
  const lojasSheet = sheetCategoria
    ? (CAT_KEYWORDS[sheetCategoria]?.length
        ? lojas.filter(l => {
            const cat = (l.categoria || "").toLowerCase();
            const nome = (l.nome || "").toLowerCase();
            return CAT_KEYWORDS[sheetCategoria].some(k => cat.includes(k) || nome.includes(k));
          })
        // "todos" no sheet = apenas lojas de comida
        : lojas.filter(l => !isNaoComida(l.categoria || ""))
      ).sort((a, b) => ((b as any).avaliacao || 0) - ((a as any).avaliacao || 0))
    : [];

  const catInfo = CATEGORIAS.find(c => c.id === sheetCategoria);

  // Drag-to-dismiss handlers
  const onDragStart = (clientY: number) => { dragStartY.current = clientY; };
  const onDragMove = (clientY: number) => {
    dragDelta.current = Math.max(0, clientY - dragStartY.current);
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${dragDelta.current}px)`;
  };
  const onDragEnd = () => {
    if (dragDelta.current > 120) { setSheetCategoria(null); }
    else if (sheetRef.current) { sheetRef.current.style.transform = "translateY(0)"; }
    dragDelta.current = 0;
  };

  // Helper: retorna a categoria do item para checar se é comida
  const itemCategoria = (item: FeedItem): string => {
    if (item._type === "customer") return item.lojaCategoria || "";
    if (item._type === "store")    return item.lojaNome || "";
    if (item._type === "menu")     return item.lojaNome || "";
    return item.lojaMaisFrequente || "";
  };

  const itensFiltrados = feedItems.filter(item => {
    const cat = itemCategoria(item);

    // "Todos" = somente comida (não-comida fica na página /lojas)
    if (categoriaAtiva === "todos") return !isNaoComida(cat);

    // Filtro de subcategoria de comida
    const t = item._type === "customer" ? `${item.lojaNome} ${item.legenda} ${item.produtoNome} ${item.lojaCategoria}` :
              item._type === "store"    ? `${item.lojaNome} ${item.texto}` :
              item._type === "menu"     ? `${item.lojaNome} ${item.nome}` :
              `${item.lojaMaisFrequente}`;
    return t.toLowerCase().includes(categoriaAtiva.toLowerCase()) && !isNaoComida(cat);
  });

  const labelAtual = itensFiltrados[postAtual] ? CARD_LABEL[itensFiltrados[postAtual]._type] : null;

  return (
    <div style={{ background:"#080412", height:"100dvh", display:"flex", flexDirection:"column", fontFamily:"'Outfit',sans-serif", overflow:"hidden", color:"#fff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Fraunces:wght@700;900&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { display:none; }
        .cat-pill { overflow-x:auto; scrollbar-width:none; }
        .cat-pill::-webkit-scrollbar { display:none; }
        @media (min-width:768px) {
          .layout-main { display:grid !important; grid-template-columns:1fr 340px !important; }
          .store-panel { display:flex !important; }
          .bottom-nav  { display:none !important; }
        }
      `}</style>

      {/* HEADER */}
      <div style={{ flexShrink:0, height:56, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", background:"rgba(8,4,18,.95)", backdropFilter:"blur(12px)", borderBottom:"1px solid rgba(255,255,255,.07)", zIndex:100 }}>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:"1.25rem", fontWeight:900, color:"#f5c518" }}>🍓 NexFoody</div>
        <button onClick={() => navigate("/mapa")} style={{ display:"flex", alignItems:"center", gap:5, background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.1)", borderRadius:20, padding:"6px 12px", color:"#fff", cursor:"pointer", fontSize:"0.78rem", fontWeight:600 }}>
          📍 {cidadeDetectada || "Localizar..."} <span style={{ color:"rgba(255,255,255,.4)", fontSize:"0.7rem" }}>▼</span>
        </button>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {/* Botão minha loja / criar loja */}
          {userData?.lojistaOf
            ? <Link to={`/loja/${userData.lojistaOf}`} style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(245,197,24,.12)", border:"1px solid rgba(245,197,24,.4)", borderRadius:20, padding:"6px 12px", textDecoration:"none" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f5c518" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                <span style={{ fontSize:"0.72rem", fontWeight:800, color:"#f5c518" }}>Minha loja</span>
              </Link>
            : <Link to="/lojista/cadastro" style={{ display:"flex", alignItems:"center", gap:5, background:"rgba(245,197,24,.1)", border:"1px solid rgba(245,197,24,.3)", borderRadius:20, padding:"5px 10px", textDecoration:"none" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f5c518" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span style={{ fontSize:"0.68rem", fontWeight:800, color:"#f5c518", whiteSpace:"nowrap" }}>Criar loja grátis</span>
              </Link>
          }
          <button style={{ background:"none", border:"none", cursor:"pointer", position:"relative", color:"#fff", fontSize:"1.2rem" }}>
            🔔<span style={{ position:"absolute", top:-2, right:-2, width:8, height:8, borderRadius:"50%", background:"#ef4444" }} />
          </button>
          {user
            ? <button onClick={() => navigate("/meu-perfil")} style={{ width:32, height:32, borderRadius:"50%", background:avatarBg(userData?.nome||"U"), border:"2px solid rgba(245,197,24,.5)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontWeight:800, fontSize:"0.9rem", color:"#fff" }}>{userData?.nome?.[0]||"U"}</button>
            : <Link to="/nexfoody/welcome" style={{ background:"linear-gradient(135deg,#f5c518,#e6a817)", borderRadius:20, padding:"6px 14px", fontWeight:800, fontSize:"0.75rem", color:"#0a0414", textDecoration:"none" }}>Entrar</Link>
          }
        </div>
      </div>

      {/* CATEGORIAS */}
      <div className="cat-pill" style={{ flexShrink:0, padding:"10px 16px", display:"flex", gap:8, background:"rgba(8,4,18,.9)", borderBottom:"1px solid rgba(255,255,255,.05)" }}>
        {CATEGORIAS.map(cat => (
          <button key={cat.id} onClick={() => setSheetCategoria(cat.id)} style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 14px", borderRadius:20, border:`1px solid ${sheetCategoria===cat.id?"rgba(245,197,24,.6)":"rgba(255,255,255,.1)"}`, background:sheetCategoria===cat.id?"rgba(245,197,24,.15)":"rgba(255,255,255,.04)", color:sheetCategoria===cat.id?"#f5c518":"rgba(255,255,255,.5)", cursor:"pointer", fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:"0.78rem", whiteSpace:"nowrap", transition:"all .2s", flexShrink:0 }}>
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* LAYOUT */}
      <div className="layout-main" style={{ flex:1, display:"flex", minHeight:0, overflow:"hidden" }}>

        {/* FEED */}
        <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
          {itensFiltrados.length === 0
            ? <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, color:"rgba(255,255,255,.3)" }}><div style={{ fontSize:"3rem" }}>📭</div><div>Nenhum post nessa categoria</div></div>
            : <div style={{ height:"100%", overflowY:"scroll", scrollSnapType:"y mandatory", scrollbarWidth:"none" }}>
                {itensFiltrados.map((item, idx) => (
                  <div key={item.id} ref={el => { postRefs.current[idx] = el; }} style={{ height:"calc(100% - 54px)", scrollSnapAlign:"start", position:"relative", flexShrink:0 }}>
                    {item._type === "customer"  && <CustomerPostCard  post={item} isCurrent={postAtual===idx} userId={user?.uid} />}
                    {item._type === "store"     && <StorePostCard     post={item} isCurrent={postAtual===idx} />}
                    {item._type === "menu"      && <MenuItemCard      card={item} isCurrent={postAtual===idx} />}
                    {item._type === "topbuyer"  && <TopBuyerCard      card={item} isCurrent={postAtual===idx} />}
                  </div>
                ))}
              </div>
          }

          {/* Indicador lateral */}
          <div style={{ position:"absolute", right:6, top:"50%", transform:"translateY(-50%)", display:"flex", flexDirection:"column", gap:4, zIndex:10, pointerEvents:"none" }}>
            {itensFiltrados.map((item, i) => {
              const cor = CARD_LABEL[item._type]?.color || "#fff";
              return <div key={i} style={{ width:3, height:i===postAtual?20:5, borderRadius:2, background:i===postAtual?cor:"rgba(255,255,255,.2)", transition:"all .3s" }} />;
            })}
          </div>

          {/* Tag tipo atual */}
          <AnimatePresence mode="wait">
            {labelAtual && (
              <motion.div key={postAtual} initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:10 }} style={{ position:"absolute", bottom:78, left:14, display:"flex", alignItems:"center", gap:5, background:"rgba(8,4,18,.7)", backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,.1)", borderRadius:12, padding:"5px 10px", fontSize:"0.65rem", fontWeight:700, color:"rgba(255,255,255,.5)", zIndex:5, pointerEvents:"none" }}>
                <span style={{ color:labelAtual.color }}>{labelAtual.icon}</span> {labelAtual.text}
              </motion.div>
            )}
          </AnimatePresence>

          {/* CARD MAPA — canto inferior esquerdo, estilo TikTok */}
          <AnimatePresence>
            {bannerMapa && (
              <motion.div
                initial={{ x:-120, opacity:0 }}
                animate={{ x:0, opacity:1 }}
                exit={{ x:-120, opacity:0 }}
                transition={{ type:"spring", damping:22, stiffness:220, delay:1.2 }}
                style={{ position:"absolute", left:12, bottom:78, zIndex:20, width:158 }}
              >
                <div style={{ background:"linear-gradient(145deg,rgba(15,7,32,.97),rgba(35,12,70,.97))", backdropFilter:"blur(20px)", border:"1px solid rgba(245,197,24,.28)", borderRadius:18, padding:"12px 12px 10px", boxShadow:"0 8px 32px rgba(0,0,0,.6), 0 0 0 1px rgba(245,197,24,.06)", position:"relative" }}>

                  {/* Fechar */}
                  <button onClick={() => { setBannerMapa(false); sessionStorage.setItem("banner_mapa_visto","1"); }}
                    style={{ position:"absolute", top:7, right:7, background:"rgba(255,255,255,.1)", border:"none", borderRadius:"50%", width:20, height:20, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"rgba(255,255,255,.5)", fontSize:"0.65rem", lineHeight:1 }}>✕</button>

                  {/* Ícone */}
                  <div style={{ width:40, height:40, borderRadius:12, background:"linear-gradient(135deg,#22c55e,#16a34a)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.3rem", marginBottom:8, boxShadow:"0 4px 14px rgba(34,197,94,.35)" }}>💰</div>

                  {/* Texto */}
                  <div style={{ fontWeight:900, fontSize:"0.78rem", color:"#fff", lineHeight:1.3, marginBottom:5 }}>
                    Ganhe dinheiro de verdade!
                  </div>
                  <div style={{ fontSize:"0.62rem", color:"rgba(255,255,255,.45)", lineHeight:1.6, marginBottom:8 }}>
                    Convide lojas pelo mapa e receba até <span style={{ color:"#22c55e", fontWeight:800 }}>R$ 70</span> por loja via PIX 🤑
                  </div>

                  {/* Mini tabela de ganhos */}
                  <div style={{ background:"rgba(34,197,94,.08)", border:"1px solid rgba(34,197,94,.15)", borderRadius:8, padding:"6px 8px", marginBottom:10 }}>
                    {[["Cadastro","R$ 10"],["1º pedido","R$ 10"],["Recorrente","+ R$ 50"]].map(([label, val]) => (
                      <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"2px 0" }}>
                        <span style={{ fontSize:"0.58rem", color:"rgba(255,255,255,.4)" }}>{label}</span>
                        <span style={{ fontSize:"0.65rem", fontWeight:800, color:"#22c55e" }}>{val}</span>
                      </div>
                    ))}
                  </div>

                  {/* Botão mapa */}
                  <button onClick={() => navigate("/mapa")}
                    style={{ width:"100%", background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", borderRadius:10, padding:"8px 0", fontWeight:800, fontSize:"0.68rem", color:"#fff", cursor:"pointer", boxShadow:"0 4px 12px rgba(34,197,94,.3)" }}>
                    Encontrar lojas no mapa
                  </button>

                  {/* Minha Carteira */}
                  <button onClick={() => navigate("/carteira")}
                    style={{ width:"100%", marginTop:6, display:"flex", alignItems:"center", gap:8, background:"rgba(34,197,94,.1)", border:"1px solid rgba(34,197,94,.25)", borderRadius:10, padding:"8px 10px", cursor:"pointer", textAlign:"left" }}>
                    <span style={{ fontSize:"1.1rem" }}>👛</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:"0.68rem", fontWeight:800, color:"#22c55e" }}>Minha Carteira</div>
                      <div style={{ fontSize:"0.56rem", color:"rgba(255,255,255,.35)", marginTop:1 }}>Saldo PIX acumulado</div>
                    </div>
                    <span style={{ fontSize:"0.7rem", color:"rgba(34,197,94,.6)" }}>→</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* PAINEL LOJAS (desktop) */}
        <div className="store-panel" style={{ display:"none", width:340, flexDirection:"column", borderLeft:"1px solid rgba(255,255,255,.07)", background:"#0a0518", overflow:"hidden" }}>
          <div style={{ padding:"16px 16px 10px", borderBottom:"1px solid rgba(255,255,255,.07)" }}>
            <div style={{ fontWeight:800, fontSize:"0.88rem", color:"#fff", marginBottom:10 }}>
              🏪 {cidadeDetectada ? `Todas as lojas de ${cidadeDetectada.split(" -")[0]}` : "Lojas na sua cidade"}
            </div>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:10 }}>
            {lojas.map(l => <StoreCard key={l.tenantId} loja={l} />)}
            <motion.div whileHover={{ scale:1.01 }} style={{ marginTop:8, background:"linear-gradient(135deg,rgba(34,197,94,.1),rgba(124,58,237,.08))", border:"1px solid rgba(34,197,94,.2)", borderRadius:16, padding:"14px", textAlign:"center" }}>
              <div style={{ fontSize:"1.3rem", marginBottom:6 }}>🏪</div>
              <div style={{ fontWeight:800, fontSize:"0.82rem", color:"#22c55e", marginBottom:4 }}>Sua loja aqui?</div>
              <div style={{ fontSize:"0.7rem", color:"rgba(255,255,255,.4)", marginBottom:10 }}>Cadastre grátis e apareça no feed</div>
              <Link to="/lojista/cadastro" style={{ display:"inline-block", background:"rgba(34,197,94,.2)", border:"1px solid rgba(34,197,94,.3)", borderRadius:12, padding:"6px 14px", fontSize:"0.75rem", fontWeight:700, color:"#22c55e", textDecoration:"none" }}>Cadastrar →</Link>
            </motion.div>
          </div>
          <div style={{ borderTop:"1px solid rgba(255,255,255,.07)", padding:"12px 14px" }}>
            <div style={{ fontSize:"0.68rem", textTransform:"uppercase", letterSpacing:"0.1em", color:"rgba(255,255,255,.3)", marginBottom:10 }}>🏆 Top fãs da semana</div>
            {MOCK_TOPBUYERS.map((f,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <span style={{ fontSize:"0.9rem" }}>{f.badge}</span>
                <div style={{ flex:1, fontSize:"0.75rem", color:"rgba(255,255,255,.6)", fontWeight:600 }}>{f.userNome}</div>
                <div style={{ fontSize:"0.72rem", color:"#f5c518", fontWeight:800 }}>{f.pontosSemana.toLocaleString("pt-BR")} pts</div>
              </div>
            ))}
            <Link to="/ranking" style={{ fontSize:"0.72rem", color:"#a855f7", textDecoration:"none", fontWeight:600 }}>Ver ranking completo →</Link>
          </div>
        </div>
      </div>

      {/* BOTTOM NAV */}
      <div className="bottom-nav" style={{ flexShrink:0, height:54, background:"rgba(8,4,18,.97)", backdropFilter:"blur(16px)", borderTop:"1px solid rgba(255,255,255,.07)", display:"flex", zIndex:100 }}>

        {/* Início */}
        <Link to="/app" style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, textDecoration:"none", color:"#f5c518", fontSize:"0.55rem", fontWeight:700, position:"relative" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          Início
          <span style={{ position:"absolute", bottom:3, width:4, height:4, borderRadius:"50%", background:"#f5c518" }} />
        </Link>

        {/* Mapa */}
        <Link to="/mapa" style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, textDecoration:"none", color:"rgba(255,255,255,.35)", fontSize:"0.55rem", fontWeight:700 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
          Mapa
        </Link>

        {/* Ranking */}
        <Link to="/ranking" style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, textDecoration:"none", color:"rgba(255,255,255,.35)", fontSize:"0.55rem", fontWeight:700 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          Ranking
        </Link>

        {/* Perfil */}
        <Link to={user?"/meu-perfil":"/nexfoody/welcome"} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, textDecoration:"none", color:"rgba(255,255,255,.35)", fontSize:"0.55rem", fontWeight:700 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Perfil
        </Link>

        {/* Chat com badge */}
        <Link to="/chat" style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, textDecoration:"none", color:"rgba(255,255,255,.35)", fontSize:"0.55rem", fontWeight:700, position:"relative" }}>
          <span style={{ position:"relative", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {chatNaoLido > 0 && (
              <span style={{ position:"absolute", top:-4, right:-6, minWidth:15, height:15, borderRadius:8, background:"#ef4444", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.5rem", fontWeight:800, color:"#fff", padding:"0 3px" }}>
                {chatNaoLido > 9 ? "9+" : chatNaoLido}
              </span>
            )}
          </span>
          Chat
        </Link>

      </div>

      {/* ── BOTTOM SHEET: LOJAS POR CATEGORIA ────────────────── */}
      {sheetCategoria !== null && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setSheetCategoria(null)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", backdropFilter:"blur(3px)", zIndex:200, animation:"sheetFadeIn .25s ease" }}
          />
          {/* Sheet */}
          <div
            ref={sheetRef}
            style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:201, background:"#0f0720", borderRadius:"24px 24px 0 0", border:"1px solid rgba(255,255,255,.1)", borderBottom:"none", maxHeight:"72vh", display:"flex", flexDirection:"column", animation:"slideUpSheet .32s cubic-bezier(.22,.68,0,1.2)", transition:"transform .2s ease" }}
            onTouchStart={e => onDragStart(e.touches[0].clientY)}
            onTouchMove={e => onDragMove(e.touches[0].clientY)}
            onTouchEnd={onDragEnd}
          >
            {/* Handle de arraste */}
            <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px", cursor:"grab" }}>
              <div style={{ width:36, height:4, borderRadius:2, background:"rgba(255,255,255,.2)" }} />
            </div>

            {/* Título */}
            <div style={{ padding:"8px 20px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, borderBottom:"1px solid rgba(255,255,255,.06)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:44, height:44, borderRadius:14, background:"rgba(245,197,24,.12)", border:"1px solid rgba(245,197,24,.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.5rem" }}>
                  {catInfo?.icon}
                </div>
                <div>
                  <div style={{ fontFamily:"'Fraunces',serif", fontWeight:900, fontSize:"1.15rem", color:"#fff" }}>{catInfo?.label}</div>
                  <div style={{ fontSize:"0.65rem", color:"rgba(255,255,255,.35)", marginTop:1 }}>
                    {lojasSheet.length > 0
                      ? `${lojasSheet.length} loja${lojasSheet.length > 1 ? "s" : ""} disponível${lojasSheet.length > 1 ? "s" : ""}`
                      : "Nenhuma loja no momento"}
                  </div>
                </div>
              </div>
              <button onClick={() => setSheetCategoria(null)} style={{ width:32, height:32, borderRadius:"50%", background:"rgba(255,255,255,.08)", border:"1px solid rgba(255,255,255,.1)", color:"rgba(255,255,255,.5)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.9rem" }}>✕</button>
            </div>

            {/* Lista */}
            <div style={{ overflowY:"auto", padding:"12px 16px 40px", flex:1 }}>
              {lojasSheet.length === 0 ? (
                <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,.3)" }}>
                  <div style={{ fontSize:"2.5rem", marginBottom:10 }}>🏪</div>
                  <div style={{ fontSize:"0.85rem", fontWeight:600 }}>Nenhuma loja nessa categoria</div>
                  <div style={{ fontSize:"0.72rem", marginTop:6 }}>Tente outra categoria ou volte mais tarde</div>
                </div>
              ) : lojasSheet.map((loja, i) => (
                <div key={(loja as any).tenantId || i} style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 14px", background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", borderRadius:18, marginBottom:10, animation:`sheetCardUp .3s ease ${i * 0.07}s both` }}>
                  {/* Logo */}
                  <div style={{ width:56, height:56, borderRadius:16, background:"linear-gradient(135deg,#1a0a36,#2d1b69)", overflow:"hidden", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.7rem", border:"1.5px solid rgba(245,197,24,.2)", boxShadow:"0 4px 16px rgba(0,0,0,.3)" }}>
                    {(loja as any).logo
                      ? <img src={(loja as any).logo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      : ((loja as any).emoji || "🏪")}
                  </div>
                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:800, fontSize:"0.92rem", color:"#fff", marginBottom:5 }}>{loja.nome}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                      <span style={{ fontSize:"0.56rem", color:"rgba(255,255,255,.45)", background:"rgba(255,255,255,.07)", borderRadius:8, padding:"2px 7px", fontWeight:600 }}>{loja.categoria}</span>
                      <span style={{ fontSize:"0.63rem", color:"#f5c518", fontWeight:800 }}>⭐ {(loja as any).avaliacao?.toFixed(1) || "4.8"}</span>
                      <span style={{ display:"flex", alignItems:"center", gap:3, fontSize:"0.56rem", color:"#34d399", fontWeight:700 }}>
                        <span style={{ width:5, height:5, borderRadius:"50%", background:"#34d399", display:"inline-block" }} />
                        Aberta
                      </span>
                    </div>
                    <div style={{ fontSize:"0.6rem", color:"rgba(255,255,255,.25)", marginTop:4 }}>🛵 15–35 min</div>
                  </div>
                  {/* CTA */}
                  <Link
                    to={`/loja/${(loja as any).slug || (loja as any).tenantId}`}
                    onClick={() => setSheetCategoria(null)}
                    style={{ background:"linear-gradient(135deg,#f5c518,#e6a817)", borderRadius:12, padding:"9px 14px", fontWeight:800, fontSize:"0.75rem", color:"#0a0414", textDecoration:"none", flexShrink:0, boxShadow:"0 4px 14px rgba(245,197,24,.3)" }}
                  >
                    Ver →
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <style>{`
            @keyframes slideUpSheet   { from{transform:translateY(100%)} to{transform:translateY(0)} }
            @keyframes sheetFadeIn    { from{opacity:0} to{opacity:1} }
            @keyframes sheetCardUp    { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
          `}</style>
        </>
      )}
    </div>
  );
}
