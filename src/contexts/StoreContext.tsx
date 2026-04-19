import { createContext, useContext, useEffect, useState } from "react";
import { useTenant } from "./TenantContext";
import { useAuth } from "./AuthContext";
import {
  collection, onSnapshot, query, orderBy,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  increment, setDoc, getDocs, where
} from "firebase/firestore";
import { db } from "../lib/firebase";
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
 控制?: boolean;
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
  cartTotal: () => number;
  cartCount: () => number;
  addToCart: (produtoId: string, qty?: number) => void;
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
}

const StoreContext = createContext<StoreContextValue>({
  produtos: [],
  recompensas: [],
  config: emptyConfig(),
  cartItems: {},
  cartExtras: [],
  cartTotal: () => 0,
  cartCount: () => 0,
  addToCart: () => {},
  removeFromCart: () => {},
  clearCart: () => {},
  updateExtraQty: () => {},
  removeFromExtras: () => {},
  restoreCartFromPedido: () => {},
  isAdmin: false,
  salvarProduto: async () => {},
  deletarProduto: async () => {},
  salvarConfig: async () => {},
  tenantId: null,
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
  const [isAdmin, setIsAdmin] = useState(false);

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

  const removeFromCart = (produtoId: string) => {
    setCartItems(prev => {
      const next = { ...prev };
      delete next[produtoId];
      persistCart(next);
      return next;
    });
  };

  const clearCart = () => {
    setCartItems({});
    setCartExtras([]);
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
      return sum + (Number(p.preco) * qty);
    }, 0);
  };

  const cartCount = () => {
    return Object.values(cartItems).reduce((s, q) => s + q, 0);
  };

  return (
    <StoreContext.Provider
      value={{
        produtos,
        recompensas,
        config,
        cartItems,
        cartExtras,
        cartTotal,
        cartCount,
        addToCart,
        removeFromCart,
        clearCart,
        updateExtraQty,
        removeFromExtras,
        restoreCartFromPedido,
        isAdmin,
        salvarProduto,
        deletarProduto,
        salvarConfig,
        tenantId,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
