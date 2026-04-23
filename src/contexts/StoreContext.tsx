import { createContext, useContext, useEffect, useState } from "react";
import { useTenant } from "./TenantContext";
import { useAuth } from "./AuthContext";
import {
  collection, onSnapshot, query, orderBy,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  increment, setDoc, getDocs, where
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { addFanPoints } from "../lib/pontos";
import type { TenantConfig } from "../types/tenant";

interface Produto {
  id: string;
  nome: string;
  desc?: string;
  preco: number;
  foto?: string;
  emoji?: string;
  categoria?: string;
  ativo?: boolean;
  Controlado?: boolean;
  estoque?: number;
  comentariosCount?: number;
  [key: string]: unknown;
}

function emptyConfig(): TenantConfig {
  return {
    tenantId: "",
    ativo: true,
    cardapioAtivo: true,
    nomeLoja: "",
    logoUrl: "",
    mensagemPausa: "",
    bannerPromocao: "",
    filtros: {},
    filtrosOrdem: [],
  } as unknown as TenantConfig;
}

interface StoreContextValue {
  produtos: Produto[];
  recompensas: unknown[];
  config: TenantConfig;
  cartItems: Record<string, number>;
  cartExtras: unknown[];
  cartComplementos: Record<string, Array<{ nome: string; preco: number }>>;
  cartTotal: () => number;
  cartCount: () => number;
  addToCart: (produtoId: string, qty?: number) => void;
  setCartComplementos: (produtoId: string, complementos: Array<{ nome: string; preco: number }>) => void;
  updateCartComplementos: (produtoId: string, complementos: Array<{ nome: string; preco: number }>) => void;
  removeFromCart: (produtoId: string) => void;
  clearCart: () => void;
  updateExtraQty: (extraId: string, delta: number) => void;
  removeFromExtras: (extraId: string) => void;
  restoreCartFromPedido: (items: unknown[], extras: unknown[]) => void;
  isAdmin: boolean;
  salvarProduto: (dados: Partial<Produto>, id?: string | null) => Promise<void>;
  deletarProduto: (id: string) => Promise<void>;
  salvarConfig: (dados: Partial<TenantConfig>) => Promise<void>;
  tenantId: string | null;
  confirmOrder: (pedidoId: string, total: number) => Promise<void>;
  pontos: number;
  finalizarPedido: (dados: {
    nome: string;
    telefone: string;
    obs?: string;
    pagamento: string;
    usarPontos?: number;
    usarCashback?: number;
    tipoEntrega?: string;
    endereco?: string;
    cupom?: string;
    descontoCupom?: number;
  }) => Promise<unknown>;
}

const StoreContext = createContext<StoreContextValue>({
  produtos: [],
  recompensas: [],
  config: emptyConfig(),
  cartItems: {},
  cartExtras: [],
  cartComplementos: {},
  cartTotal: () => 0,
  cartCount: () => 0,
  addToCart: () => {},
  removeFromCart: () => {},
  clearCart: () => {},
  updateExtraQty: () => {},
  removeFromExtras: () => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setCartComplementos: (_produtoId: string, _complementos: Array<{ nome: string; preco: number }>) => {},
  updateCartComplementos: () => {},
  restoreCartFromPedido: () => {},
  isAdmin: false,
  salvarProduto: async () => {},
  deletarProduto: async () => {},
  salvarConfig: async () => {},
  tenantId: null,
  confirmOrder: async () => {},
  pontos: 0,
  finalizarPedido: async () => ({}),
});

export const useStore = () => useContext(StoreContext);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { tenantId, tenantConfig } = useTenant();
  const { userData } = useAuth();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [recompensas, setRecompensas] = useState<unknown[]>([]);
  const [config, setConfig] = useState<TenantConfig>(emptyConfig());
  const [cartItems, setCartItems] = useState<Record<string, number>>({});
  const [cartExtras, setCartExtras] = useState<unknown[]>([]);
  const [cartComplementos, setCartComplementos] = useState<Record<string, Array<{ nome: string; preco: number }>>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [pontos, setPontos] = useState(0);

  // Load produtos from tenant-scoped path
  useEffect(() => {
    if (!tenantId) return;

    const q = query(collection(db, `tenants/${tenantId}/produtos`), orderBy("nome"));
    const unsub = onSnapshot(q, snap => {
      setProdutos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Produto)));
    });
    return unsub;
  }, [tenantId]);

  // Load recompensas from tenant-scoped path
  useEffect(() => {
    if (!tenantId) return;

    const q = query(collection(db, `tenants/${tenantId}/recompensas`), orderBy("pontos"));
    const unsub = onSnapshot(q, snap => {
      setRecompensas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [tenantId]);

  // Set config from tenant context
  useEffect(() => {
    if (tenantConfig) {
      setConfig(tenantConfig);
    } else {
      setConfig(emptyConfig());
    }
  }, [tenantConfig]);

  // Check admin
  useEffect(() => {
    setIsAdmin(userData?.role === "admin" || userData?.role === "lojista");
  }, [userData]);

  // Load user pontos
  useEffect(() => {
    if (!userData?.uid) return;
    const unsub = onSnapshot(doc(db, "users", userData.uid), snap => {
      if (snap.exists()) setPontos(snap.data().pontos || 0);
    });
    return unsub;
  }, [userData?.uid]);

  // Load cart from localStorage
  useEffect(() => {
    if (!tenantId) return;
    try {
      const saved = localStorage.getItem(`cart_${tenantId}`);
      if (saved) setCartItems(JSON.parse(saved));
    } catch {}
  }, [tenantId]);

  const persistCart = (items: Record<string, number>) => {
    if (!tenantId) return;
    localStorage.setItem(`cart_${tenantId}`, JSON.stringify(items));
  };

  const addToCart = (produtoId: string, qty = 1) => {
    setCartItems(prev => {
      const next = { ...prev, [produtoId]: (prev[produtoId] || 0) + qty };
      persistCart(next);
      return next;
    });
  };

  const updateCartComplementos = (produtoId: string, complementos: Array<{ nome: string; preco: number }>) => {
    setCartComplementos(prev => ({ ...prev, [produtoId]: complementos }));
  };

  const removeFromCart = (produtoId: string) => {
    setCartItems(prev => {
      const next = { ...prev };
      delete next[produtoId];
      persistCart(next);
      return next;
    });
    setCartComplementos(prev => {
      const next = { ...prev };
      delete next[produtoId];
      return next;
    });
  };

  const clearCart = () => {
    setCartItems({});
    setCartExtras([]);
    setCartComplementos({});
    if (tenantId) localStorage.removeItem(`cart_${tenantId}`);
  };

  const updateExtraQty = (extraId: string, delta: number) => {
    setCartExtras(prev => (prev as Record<string, unknown>[]).map(e => {
      if (e.id === extraId) {
        return { ...e, qty: Math.max(0, (e.qty as number || 0) + delta) };
      }
      return e;
    }));
  };

  const removeFromExtras = (extraId: string) => {
    setCartExtras(prev => prev.filter(e => (e as { id?: string }).id !== extraId));
  };

  const restoreCartFromPedido = (items: unknown[], extras: unknown[]) => {
    const itemMap: Record<string, number> = {};
    items.forEach((item: unknown) => {
      const i = item as { produtoId?: string; qty?: number };
      if (i.produtoId) itemMap[i.produtoId] = (itemMap[i.produtoId] || 0) + (i.qty || 1);
    });
    setCartItems(itemMap);
    setCartExtras(extras as []);
  };

  const salvarProduto = async (dados: Partial<Produto>, id?: string | null) => {
    if (!tenantId) return;
    const colPath = `tenants/${tenantId}/produtos`;
    if (id) {
      await updateDoc(doc(db, colPath, id), dados as Record<string, unknown>);
    } else {
      const novoId = `prod_${Date.now()}`;
      await setDoc(doc(db, colPath, novoId), { ...dados, criadoEm: serverTimestamp() });
    }
  };

  const deletarProduto = async (id: string) => {
    if (!tenantId) return;
    await deleteDoc(doc(db, `tenants/${tenantId}/produtos`, id));
  };

  const salvarConfig = async (dados: Partial<TenantConfig>) => {
    if (!tenantId) return;
    await updateDoc(doc(db, `tenants/${tenantId}/config`, "loja"), dados as Record<string, unknown>);
  };

  const cartTotal = () => {
    return produtos.reduce((sum, p) => {
      const qty = cartItems[p.id] || 0;
      if (!qty) return sum;
      const complementos = cartComplementos?.[p.id] || [];
      const precoComplementos = complementos.reduce((s, c) => s + (c.preco || 0), 0);
      return sum + ((Number(p.preco) + precoComplementos) * qty);
    }, 0);
  };

  const cartCount = () => {
    return Object.values(cartItems).reduce((s, q) => s + q, 0);
  };

  const finalizarPedido = async (dados: {
    nome: string;
    telefone: string;
    obs?: string;
    pagamento: string;
    usarPontos?: number;
    usarCashback?: number;
    tipoEntrega?: string;
    endereco?: string;
    cupom?: string;
    descontoCupom?: number;
  }) => {
    const items = produtos.filter(p => cartItems[p.id]).map(p => {
      const complementos = cartComplementos?.[p.id] || [];
      const precoComplementos = complementos.reduce((s, c) => s + (c.preco || 0), 0);
      return {
        id: p.id,
        produtoId: p.id,
        nome: p.nome,
        foto: p.foto,
        emoji: p.emoji,
        qty: cartItems[p.id],
        preco: Number(p.preco),
        precoTotal: (Number(p.preco) + precoComplementos) * cartItems[p.id],
        complementos,
      };
    });
    const total = Math.max(0, cartTotal() - (dados.usarPontos || 0) - (dados.descontoCupom || 0));
    const modo = config.modoFidelidade || "pontos";
    const pontosGanhos = (modo === "pontos" || modo === "ambos")
      ? Math.floor(total * (Number(config.pontosPorReal) || 1)) : 0;
    const cashbackGerado = (modo === "cashback" || modo === "ambos")
      ? Math.min(total * (Number(config.cashbackPercent) || 5) / 100, config.cashbackMaxPedido || 9999)
      : 0;

    const numPedido = parseInt(localStorage.getItem("ultimoPedido") || "1000") + 1;
    localStorage.setItem("ultimoPedido", String(numPedido));

    const pedidoData: Record<string, unknown> = {
      userId: userData?.uid || null,
      nomeCliente: dados.nome,
      telefone: dados.telefone || "",
      items,
      numeroPedido: numPedido,
      total,
      pagamento: dados.pagamento,
      tipoEntrega: dados.tipoEntrega || "retirada",
      endereco: dados.endereco || "",
      obs: dados.obs || "",
      status: "pendente",
      tenantId,
      createdAt: serverTimestamp(),
    };

    // Salva em tenants/{tenantId}/pedidos
    if (tenantId) {
      await addDoc(collection(db, `tenants/${tenantId}/pedidos`), pedidoData);
    }

    // Salva no global pedidos (para o KDS encontrar)
    const globalPedidoId = await addDoc(collection(db, "pedidos"), pedidoData);

    // ── Decrementa estoque dos produtos vendidos ──
    if (tenantId) {
      await Promise.all(
        items.map(async (item) => {
          const prod = produtos.find(p => p.id === item.produtoId);
          if (prod && prod.controlarEstoque && prod.estoque != null) {
            await updateDoc(doc(db, `tenants/${tenantId}/produtos`, item.produtoId), {
              estoque: increment(-item.qty),
            }).catch(() => {});
          }
        })
      );
    }

    // Pontos do usuário
    if (userData?.uid) {
      const updateData: Record<string, unknown> = {};
      if (pontosGanhos > 0 || (dados.usarPontos || 0) > 0) {
        updateData.pontos = increment(pontosGanhos - (dados.usarPontos || 0));
      }
      if (cashbackGerado > 0) {
        updateData.cashback = increment(cashbackGerado);
      }
      if ((dados.usarCashback || 0) > 0) {
        updateData.cashback = increment(-(dados.usarCashback || 0));
      }
      if (Object.keys(updateData).length > 0) {
        await updateDoc(doc(db, "users", userData.uid), updateData as Record<string, unknown>);
      }
      // Ranking points
      const ptsPorPedido = Number(config.rankingPtsPedido) || 10;
      const ptsPorReal = Number(config.rankingPtsPorReal) || 1;
      const rankingPedido = ptsPorPedido + Math.floor(total * ptsPorReal);
      await updateDoc(doc(db, "users", userData.uid), {
        pontos: increment(rankingPedido),
        rankingPts: increment(rankingPedido),
      } as Record<string, unknown>);
    }

    clearCart();
    return { pontosGanhos, cashbackGerado, numeroPedido: numPedido };
  };

  /**
   * Confirma um pedido — aplica pontos de ranking para o cliente.
   * Chamado quando o pedido sai do status "pendente" → "confirmado".
   */
  const confirmOrder = async (pedidoId: string, total: number) => {
    if (!userData?.uid || !tenantId) return;
    const ptsPorPedido = Number(config.rankingPtsPedido) || 10;
    const ptsPorReal = Number(config.rankingPtsPorReal) || 1;
    const rankingPts = ptsPorPedido + Math.floor(total * ptsPorReal);
    await addFanPoints(userData.uid, tenantId, rankingPts, {
      pontosFidelidade: Math.floor(total * (config.pontosPorReal || 0)),
    });
  };

  return (
    <StoreContext.Provider
      value={{
        produtos,
        recompensas,
        config,
        cartItems,
        cartExtras,
        cartComplementos,
        cartTotal,
        cartCount,
        addToCart,
        removeFromCart,
        clearCart,
        setCartComplementos: setCartComplementos as unknown as (produtoId: string, complementos: Array<{ nome: string; preco: number }>) => void,
        updateCartComplementos: updateCartComplementos as unknown as (produtoId: string, complementos: Array<{ nome: string; preco: number }>) => void,
        updateExtraQty,
        removeFromExtras,
        restoreCartFromPedido,
        isAdmin,
        salvarProduto,
        deletarProduto,
        salvarConfig,
        tenantId,
        confirmOrder,
        pontos,
        finalizarPedido,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
