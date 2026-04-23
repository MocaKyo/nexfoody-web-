// src/contexts/StoreContext.js
import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import {
  collection, doc, onSnapshot, setDoc, deleteDoc,
  addDoc, updateDoc, increment, serverTimestamp, getDoc,
  query, orderBy, arrayUnion,
} from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { addFanPoints } from "../lib/pontos";

const StoreContext = createContext();
export const useStore = () => useContext(StoreContext);

// Verifica se está dentro do horário de funcionamento
function dentroDoHorario(abertura, fechamento) {
  if (!abertura || !fechamento) return true;
  const agora = new Date();
  const [hA, mA] = abertura.split(":").map(Number);
  const [hF, mF] = fechamento.split(":").map(Number);
  const minAgora = agora.getHours() * 60 + agora.getMinutes();
  const minAbertura = hA * 60 + mA;
  const minFechamento = hF * 60 + mF;
  return minAgora >= minAbertura && minAgora < minFechamento;
}

export function StoreProvider({ children }) {
  const { user, userData, isAdmin } = useAuth();
  const [produtos, setProdutos] = useState([]);
  const [recompensas, setRecompensas] = useState([]);
  const [config, setConfig] = useState({
    cardapioAtivo: true,
    pausaManual: false,
    horarioAutomatico: false,
    horarioAbertura: "08:00",
    horarioFechamento: "21:00",
    whatsapp: "5599984623356",
    pixKey: "86357425249",
    nomeRecebedorPix: "Moises Nazareno",
    cidadePix: "Bacabal",
    pontosPorReal: 0.1,
    endereco: "",
    horario: "08h às 21h — Todos os dias",
    mensagemPausa: "Estamos fora do horário de atendimento. Voltamos em breve!",
    instagram: "@acaipurogosto",
    nomeLoja: "Açaí Puro Gosto",
    suporteAtivo: true,
    tempoMin: 30,
    tempoMax: 45,
    tema: localStorage.getItem("temaApp") || "dark",
  });
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem("cart");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [configReal, setConfigReal] = useState(null); // config do Firestore

  // Verificar horário automaticamente a cada minuto
  const configRealRef = useRef(null);
  useEffect(() => { configRealRef.current = configReal; }, [configReal]);

  useEffect(() => {
    const verificarHorario = () => {
      const cfg = configRealRef.current;
      if (!cfg) return;
      if (!cfg.horarioAutomatico) return;

      const aberto = dentroDoHorario(
        cfg.horarioAbertura || "08:00",
        cfg.horarioFechamento || "21:00"
      );

      // Só atualiza se mudou
      if (aberto !== cfg.cardapioAtivo) {
        console.log(`⏰ Horário automático: cardápio ${aberto ? "ABRINDO" : "FECHANDO"}`);
        updateDoc(doc(db, "config", "loja"), { cardapioAtivo: aberto });
      }
    };

    // Verifica imediatamente e depois a cada 30 segundos
    verificarHorario();
    const intervalo = setInterval(verificarHorario, 30000);
    return () => clearInterval(intervalo);
  }, []); // roda só uma vez — usa ref para pegar config atualizado

  // Carregar config
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "loja"), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setConfigReal(data);
        // cardapioAtivo = aberto no horário E não pausado manualmente
        const ativoReal = data.cardapioAtivo && !data.pausaManual;
        setConfig({ ...config, ...data, cardapioAtivo: ativoReal });
      }
    });
    return unsub;
  }, []);

  // Carregar produtos
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "produtos"), orderBy("nome")),
      snap => setProdutos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  // Carregar recompensas
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "recompensas"), orderBy("pontos")),
      snap => setRecompensas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  // Carrinho
  const carrinhoTimerRef = useRef(null);
  const [cartExtras, setCartExtras] = useState(() => {
    try {
      const saved = localStorage.getItem("cartExtras");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  }); // [{itemId, produtoId, complementos, precoTotal}]

  const salvarCarrinhoFirestore = async (novoCart, userId, extras) => {
    if (!userId) return;
    const items = novoCart.map(item => ({ ...item }));
    if (items.length === 0) {
      try { await setDoc(doc(db, "carrinhos_abandonados", userId), { status: "cancelado", updatedAt: serverTimestamp() }, { merge: true }); } catch {}
      return;
    }
    try {
      await setDoc(doc(db, "carrinhos_abandonados", userId), {
        userId, items,
        total: items.reduce((s, i) => s + (i.precoTotal || i.preco) * i.qty, 0),
        status: "pendente", pushEnviado: false,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }, { merge: false });
    } catch (e) { console.warn("Erro ao salvar carrinho:", e); }
  };

  // addToCart com suporte a complementos
  const addToCart = (produtoId, qty = 1, complementos = [], precoTotal = null) => {
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return;

    if (complementos && complementos.length > 0) {
      // Produto com complementos — adiciona como item separado
      const novoItem = {
        itemId: `${produtoId}_${Date.now()}`,
        produtoId,
        nome: produto.nome,
        foto: produto.foto,
        emoji: produto.emoji,
        preco: produto.preco,
        precoTotal: precoTotal || produto.preco,
        complementos,
        qty: 1,
      };
      setCartExtras(prev => {
        const novos = [...prev, novoItem];
        if (carrinhoTimerRef.current) clearTimeout(carrinhoTimerRef.current);
        carrinhoTimerRef.current = setTimeout(() => {
          if (user?.uid) salvarCarrinhoFirestore(novos, user.uid, novos);
        }, 2000);
        return novos;
      });
    } else {
      // Produto simples — usa cart original
      setCart(prev => {
        const atual = prev[produtoId] || 0;
        const novo = Math.max(0, atual + qty);
        let novoCart;
        if (novo === 0) { const { [produtoId]: _, ...rest } = prev; novoCart = rest; }
        else { novoCart = { ...prev, [produtoId]: novo }; }
        if (carrinhoTimerRef.current) clearTimeout(carrinhoTimerRef.current);
        carrinhoTimerRef.current = setTimeout(() => {
          if (user?.uid) {
            const simples = produtos.filter(p => novoCart[p.id]).map(p => ({ ...p, qty: novoCart[p.id], precoTotal: p.preco }));
            salvarCarrinhoFirestore([...simples, ...cartExtras], user.uid);
          }
        }, 2000);
        return novoCart;
      });
    }
  };

  const removeFromExtras = (itemId) => {
    setCartExtras(prev => prev.filter(i => i.itemId !== itemId));
  };

  const updateExtraQty = (itemId, delta) => {
    setCartExtras(prev => prev.map(i => {
      if (i.itemId !== itemId) return i;
      const novaQty = (i.qty || 1) + delta;
      if (novaQty <= 0) return null;
      return { ...i, qty: novaQty };
    }).filter(Boolean));
  };

  const cartItems = () => {
    const simples = produtos.filter(p => cart[p.id]).map(p => ({ ...p, qty: cart[p.id], precoTotal: p.preco }));
    return [...simples, ...cartExtras];
  };

  const cartTotal = () => cartItems().reduce((s, i) => s + (i.precoTotal || i.preco) * i.qty, 0);
  const cartCount = () => Object.values(cart).reduce((s, v) => s + v, 0) + cartExtras.length;
  // Persistir carrinho no localStorage
  useEffect(() => {
    try { localStorage.setItem("cart", JSON.stringify(cart)); } catch {}
  }, [cart]);
  useEffect(() => {
    try { localStorage.setItem("cartExtras", JSON.stringify(cartExtras)); } catch {}
  }, [cartExtras]);

  const clearCart = () => {
    setCart({});
    setCartExtras([]);
    localStorage.removeItem("cart");
    localStorage.removeItem("cartExtras");
  };

  // Restaurar carrinho completo a partir de um pedido anterior (reorder)
  const restoreCartFromPedido = (snapshotCarrinho) => {
    if (!snapshotCarrinho || snapshotCarrinho.length === 0) return false;
    const novosExtras = [];
    const novoCart = {};
    snapshotCarrinho.forEach(item => {
      if (item.complementos && item.complementos.length > 0) {
        novosExtras.push({
          itemId: item.itemId || `${item.produtoId}_${Date.now()}_${Math.random()}`,
          produtoId: item.produtoId || item.id,
          nome: item.nome,
          foto: item.foto,
          emoji: item.emoji,
          preco: item.preco,
          precoTotal: item.precoTotal || item.preco,
          complementos: item.complementos,
          obs: item.obs || "",
          qty: item.qty || 1,
        });
      } else {
        const pid = item.produtoId || item.id;
        novoCart[pid] = (novoCart[pid] || 0) + (item.qty || 1);
      }
    });
    setCart(novoCart);
    setCartExtras(novosExtras);
    try { localStorage.setItem("cart", JSON.stringify(novoCart)); } catch {}
    try { localStorage.setItem("cartExtras", JSON.stringify(novosExtras)); } catch {}
    return true;
  };

  // Admin — salvar produto
  const salvarProduto = async (dados, id = null) => {
    if (id) await updateDoc(doc(db, "produtos", id), dados);
    else await addDoc(collection(db, "produtos"), { ...dados, createdAt: serverTimestamp() });
  };

  const deletarProduto = async (id) => deleteDoc(doc(db, "produtos", id));

  // Admin — salvar recompensa
  const salvarRecompensa = async (dados, id = null) => {
    if (id) await updateDoc(doc(db, "recompensas", id), dados);
    else await addDoc(collection(db, "recompensas"), { ...dados, createdAt: serverTimestamp() });
  };

  const deletarRecompensa = async (id) => deleteDoc(doc(db, "recompensas", id));

  const toggleTema = () => {
    const novo = config.tema === "dark" ? "light" : "dark";
    localStorage.setItem("temaApp", novo);
    setConfig(prev => ({ ...prev, tema: novo }));
  };

  // Admin — salvar config
  const salvarConfig = async (dados) => {
    await setDoc(doc(db, "config", "loja"), dados, { merge: true });
  };

  // Finalizar pedido
  const finalizarPedido = async ({ nome, telefone, obs, pagamento, usarPontos = 0, usarCashback = 0, tipoEntrega = "retirada", endereco = "", cupom = null, descontoCupom = 0 }) => {
    const items = cartItems();
    const total = Math.max(0, cartTotal() - usarPontos - descontoCupom);
    const modo = config.modoFidelidade || "pontos";
    const pontosGanhos = (modo === "pontos" || modo === "ambos")
      ? Math.floor(total * (config.pontosPorReal || 1))
      : 0;
    const cashbackGerado = (modo === "cashback" || modo === "ambos")
      ? Math.min(
          total * (config.cashbackPercent || 5) / 100,
          config.cashbackMaxPedido || 9999
        )
      : 0;

    let msg = `🫐 *PEDIDO - ${config.nomeLoja || "Açaí Puro Gosto"}*\n\n`;
    msg += `👤 ${nome}\n`;
    if (telefone) msg += `📱 ${telefone}\n`;
    msg += `\n📋 *ITENS:*\n`;
    items.forEach(i => {
      msg += `• ${i.qty}x ${i.nome} = R$ ${(i.preco * i.qty).toFixed(2).replace(".", ",")}\n`;
    });
    msg += `\n💰 *TOTAL BRUTO: R$ ${cartTotal().toFixed(2).replace(".", ",")}*`;
    if (usarPontos > 0) msg += `\n🏆 Desconto pontos: − R$ ${usarPontos.toFixed(2).replace(".", ",")}`;
    if (descontoCupom > 0) msg += `\n🏷️ Cupom ${cupom}: − R$ ${descontoCupom.toFixed(2).replace(".", ",")}`;
    if (descontoCupom > 0 || usarPontos > 0) msg += `\n💰 *TOTAL FINAL: R$ ${total.toFixed(2).replace(".", ",")}*`;
    msg += `\n💳 Pagamento: ${pagamento.toUpperCase()}`;
    msg += `\n📦 ${tipoEntrega === "entrega" ? "🛵 Delivery" : "🏠 Retirada no local"}`;
    if (tipoEntrega === "entrega" && endereco) msg += `\n📍 ${endereco}`;
    if (obs) msg += `\n\n📝 Obs: ${obs}`;
    msg += `\n\n🏆 Pontos ganhos: +${pontosGanhos} pts`;

    // Decrementar estoque dos produtos
    for (const item of items) {
      const produto = produtos.find(p => p.id === item.id);
      if (produto?.controlarEstoque && produto.estoque > 0) {
        await updateDoc(doc(db, "produtos", item.id), {
          estoque: Math.max(0, produto.estoque - item.qty),
        });
      }
    }

    // Verificar mesa atual
    const mesaAtual = localStorage.getItem("mesaAtual");

    // Salvar pedido no Firestore
    const numPedido = parseInt(localStorage.getItem("ultimoPedido") || "1000") + 1;
    localStorage.setItem("ultimoPedido", String(numPedido));

    await addDoc(collection(db, "pedidos"), {
      userId: user?.uid || null,
      nomeCliente: nome,
      telefone: telefone || user?.phoneNumber || "",
      mesa: mesaAtual || null,
      items,
      numeroPedido: numPedido,
      snapshotCarrinho: items.map(i => ({
        produtoId: i.produtoId || i.id,
        nome: i.nome,
        foto: i.foto,
        emoji: i.emoji,
        qty: i.qty,
        preco: i.preco,
        precoTotal: i.precoTotal,
        complementos: i.complementos || [],
        obs: i.obs || "",
      })),
      total,
      pagamento,
      tipoEntrega,
      endereco,
      obs,
      cupom,
      descontoCupom,
      pontosUsados: usarPontos,
      pontosGanhos,
      status: "pendente",
      createdAt: serverTimestamp(),
    });

    // Atualizar pontos do usuário
    if (user?.uid) {
      const updateData = {};
      if (pontosGanhos > 0 || usarPontos > 0) {
        updateData.pontos = increment(pontosGanhos - (usarPontos || 0));
      }
      if (cashbackGerado > 0) {
        updateData.cashback = increment(cashbackGerado);
      }
      // Descontar cashback usado
      if (usarCashback > 0) {
        updateData.cashback = increment(-usarCashback);
      }
      if (Object.keys(updateData).length > 0) {
        await updateDoc(doc(db, "users", user.uid), updateData);
      }
    }

      // Pontos de ranking: +10 por pedido + 1pt por R$1
     const ptsPorPedido = parseInt(config.rankingPtsPedido) || 10;
     const ptsPorReal = parseInt(config.rankingPtsPorReal) || 1;
     const rankingPedido = ptsPorPedido + Math.floor(total * ptsPorReal);
     await updateDoc(doc(db, "users", user.uid), {
     pontos: increment(rankingPedido),
     rankingPts: increment(rankingPedido),
     });

    // Abrir WhatsApp se não for PIX
    if (pagamento !== "pix") {
      const url = `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(msg)}`;
      const link = document.createElement("a");
      link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer";
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }

    // Limpar carrinho abandonado após pedido finalizado
    if (user?.uid) {
      try {
        await setDoc(doc(db, "carrinhos_abandonados", user.uid), {
          status: "finalizado", updatedAt: serverTimestamp()
        }, { merge: true });
      } catch {}
    }
    clearCart();
    return { pontosGanhos, cashbackGerado, numeroPedido: numPedido };
  };

  return (
    <StoreContext.Provider value={{
      produtos, recompensas, config, toggleTema,
      salvarProduto, deletarProduto,
      salvarRecompensa, deletarRecompensa,
      salvarConfig,
      addToCart, cartItems, cartTotal, cartCount, clearCart, removeFromExtras, updateExtraQty, cartExtras, restoreCartFromPedido,
      finalizarPedido,
      pontos: userData?.pontos || 0,
      isAdmin,
    }}>
      {children}
    </StoreContext.Provider>
  );
}
