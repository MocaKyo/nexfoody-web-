// src/lib/feedEngine.ts
// Engine que avalia as regras do lojista e decide o que entra no feed da cidade
import {
  collection, query, where, orderBy, limit,
  getDocs, doc, getDoc, Timestamp
} from "firebase/firestore";
import { db } from "./firebase";
import type { FeedRulesConfig } from "../components/FeedRulesPanel";

export interface AutoFeedItem {
  _type: "auto_feed";
  id: string;
  ruleKey: keyof FeedRulesConfig["rules"];
  // dados do post/produto/cliente que ativou a regra
  foto?: string | null;
  legenda?: string;
  userNome?: string;
  userFoto?: string | null;
  lojaNome: string;
  lojaSlug: string;
  lojaEmoji: string;
  lojaColor: string;
  // metadados da regra
  ruleLabel: string;
  ruleIcon: string;
  pontos?: number;
  extra?: Record<string, unknown>;
  _sortTs: number;
}

const RULE_LABELS: Record<keyof FeedRulesConfig["rules"], { label: string; icon: string; color: string }> = {
  novoClienteFoto: { label: "Novo fã com foto",      icon: "📸", color: "#a855f7" },
  topFanSemana:    { label: "Top fã da semana",       icon: "👑", color: "#f5c518" },
  produtoDestaque: { label: "Destaque do cardápio",   icon: "🔥", color: "#f97316" },
  cupomAtivo:      { label: "Promoção ativa",         icon: "🎟️", color: "#06b6d4" },
  marcoCliente:    { label: "Marco do cliente",       icon: "🏆", color: "#22c55e" },
  horarioPico:     { label: "Boost horário de pico",  icon: "⚡", color: "#eab308" },
};

// Verifica se o usuário é cliente novo desta loja (primeiro pedido nos últimos 30 dias)
async function isClienteNovo(tenantId: string, userId: string): Promise<boolean> {
  try {
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    const snap = await getDocs(query(
      collection(db, `tenants/${tenantId}/pedidos`),
      where("userId", "==", userId),
      orderBy("createdAt", "asc"),
      limit(2)
    ));

    if (snap.empty) return false;

    // É cliente novo se tem apenas 1 pedido OU o primeiro pedido foi nos últimos 30 dias
    const primeiroPedido = snap.docs[0].data();
    const dataFirst = primeiroPedido.createdAt?.toDate?.() ?? new Date(0);
    return snap.size === 1 || dataFirst >= trintaDiasAtras;
  } catch {
    return false;
  }
}

// Verifica se este é o primeiro post com foto do usuário
async function isPrimeiroPostComFoto(userId: string): Promise<boolean> {
  try {
    const snap = await getDocs(query(
      collection(db, "postagens"),
      where("userId", "==", userId),
      where("foto", "!=", null),
      limit(2)
    ));
    return snap.size <= 1; // apenas este post
  } catch {
    return true; // em caso de erro, assume que é novo
  }
}

// ─── REGRA: novoClienteFoto ───────────────────────────────────
// Cliente novo postou foto → entra no feed
async function avaliarNovoClienteFoto(
  tenantId: string,
  lojaInfo: { nome: string; slug: string; emoji: string; color: string }
): Promise<AutoFeedItem[]> {
  const itens: AutoFeedItem[] = [];
  try {
    // Busca posts recentes (últimas 24h) com foto
    const ontemTs = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const snap = await getDocs(query(
      collection(db, "postagens"),
      where("createdAt", ">=", ontemTs),
      orderBy("createdAt", "desc"),
      limit(20)
    ));

    for (const d of snap.docs) {
      const data = d.data();
      if (!data.foto || !data.userId) continue;

      const [novo, primeiroPost] = await Promise.all([
        isClienteNovo(tenantId, data.userId),
        isPrimeiroPostComFoto(data.userId),
      ]);

      // true AND true → entra no feed
      if (novo && primeiroPost) {
        itens.push({
          _type: "auto_feed",
          id: `auto_ncf_${d.id}`,
          ruleKey: "novoClienteFoto",
          foto: data.foto,
          legenda: data.legenda || "",
          userNome: data.userNome || "Cliente novo",
          userFoto: data.userFoto || null,
          lojaNome: lojaInfo.nome,
          lojaSlug: lojaInfo.slug,
          lojaEmoji: lojaInfo.emoji,
          lojaColor: lojaInfo.color,
          ruleLabel: RULE_LABELS.novoClienteFoto.label,
          ruleIcon: RULE_LABELS.novoClienteFoto.icon,
          pontos: 15,
          extra: { produtoNome: data.produtoNome },
          _sortTs: data.createdAt?.toDate?.()?.getTime?.() ?? Date.now(),
        });
        if (itens.length >= 3) break; // máximo 3 deste tipo por ciclo
      }
    }
  } catch (e) {
    console.warn("[feedEngine] novoClienteFoto:", e);
  }
  return itens;
}

// ─── REGRA: produtoDestaque ───────────────────────────────────
async function avaliarProdutoDestaque(
  tenantId: string,
  lojaInfo: { nome: string; slug: string; emoji: string; color: string }
): Promise<AutoFeedItem[]> {
  try {
    // Pega produtos ativos — em produção, usaria contagem de pedidos da semana
    const snap = await getDocs(query(
      collection(db, `tenants/${tenantId}/produtos`),
      where("ativo", "==", true),
      limit(10)
    ));
    if (snap.empty) return [];

    // Pega o primeiro produto como destaque (em prod: ordena por pedidosSemana)
    const produto = snap.docs[0].data();
    const emojis = ["🍓", "🫐", "🥭", "🍇", "🍒"];
    const bgs = [
      "linear-gradient(160deg,#2e0a3a,#7c3aed 45%,#9333ea)",
      "linear-gradient(160deg,#0a1628,#1e3a8a 45%,#3b82f6)",
    ];

    return [{
      _type: "auto_feed",
      id: `auto_pd_${snap.docs[0].id}`,
      ruleKey: "produtoDestaque",
      foto: produto.foto || null,
      legenda: produto.desc || produto.descricao || `R$ ${Number(produto.preco).toFixed(2).replace(".", ",")}`,
      userNome: produto.nome || "Produto",
      lojaNome: lojaInfo.nome,
      lojaSlug: lojaInfo.slug,
      lojaEmoji: lojaInfo.emoji,
      lojaColor: "#f97316",
      ruleLabel: RULE_LABELS.produtoDestaque.label,
      ruleIcon: RULE_LABELS.produtoDestaque.icon,
      extra: {
        preco: produto.preco,
        emoji: produto.emoji || emojis[0],
        bgGradient: bgs[0],
        vendidosSemana: 89,
      },
      _sortTs: Date.now() - 10 * 60000,
    }];
  } catch {
    return [];
  }
}

// ─── ENGINE PRINCIPAL ─────────────────────────────────────────
export async function avaliarRegrasFeed(
  tenantId: string,
  lojaInfo: { nome: string; slug: string; emoji: string; color: string }
): Promise<AutoFeedItem[]> {
  // 1. Carregar configuração de regras do lojista
  let config: FeedRulesConfig | null = null;
  try {
    const snap = await getDoc(doc(db, `tenants/${tenantId}/config/feed_rules`));
    if (snap.exists()) config = snap.data() as FeedRulesConfig;
  } catch {}

  // Se não tem config ou está em modo manual, não injeta nada automaticamente
  if (!config || !config.autoMode) return [];

  const resultados: AutoFeedItem[] = [];

  // 2. Avaliar cada regra ativa
  const avaliacoes: Promise<AutoFeedItem[]>[] = [];

  if (config.rules.novoClienteFoto) {
    avaliacoes.push(avaliarNovoClienteFoto(tenantId, lojaInfo));
  }
  if (config.rules.produtoDestaque) {
    avaliacoes.push(avaliarProdutoDestaque(tenantId, lojaInfo));
  }

  const todos = await Promise.all(avaliacoes);
  todos.forEach(arr => resultados.push(...arr));

  // 3. Respeitar limite de slots por dia
  const limite = config.slotsPerDia ?? 5;
  return resultados.slice(0, limite);
}
