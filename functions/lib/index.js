"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gerenteLoja = exports.treinarRobo = exports.mpWebhook = exports.chatBotIA = exports.onBroadcastCriado = exports.chatBot = exports.alertaEstoqueBaixo = exports.onPedidoStatusMudou = exports.onNovoPedido = exports.cancelarPixExpirado = exports.alertarInatividade = exports.resumoMensal = void 0;
// NexFoody Cloud Functions
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const mercadopago_1 = require("mercadopago");
const firebase_functions_1 = require("firebase-functions");
const params_1 = require("firebase-functions/params");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const anthropicKey = (0, params_1.defineSecret)("ANTHROPIC_API_KEY");
// ─────────────────────────────────────────────────────────────
// GERADOR PIX COPIA E COLA (padrão EMV/BACEN)
// ─────────────────────────────────────────────────────────────
function crc16ccitt(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
            crc &= 0xFFFF;
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
}
function gerarPixCopiaCola(chave, nome, cidade, valor, txid) {
    const f = (id, v) => `${id}${String(v.length).padStart(2, "0")}${v}`;
    // Merchant Account Information
    const mai = f("00", "BR.GOV.BCB.PIX") + f("01", chave.trim());
    // Additional Data Field (txid — apenas alfanumérico, máx 25)
    const ref = txid.replace(/[^a-zA-Z0-9]/g, "").substring(0, 25) || "NEXFOODY";
    const adf = f("05", ref);
    const payload = f("00", "01") + // Payload Format Indicator
        f("01", "12") + // Static QR
        f("26", mai) + // Merchant Account Info
        f("52", "0000") + // MCC
        f("53", "986") + // BRL
        f("54", valor.toFixed(2)) + // Valor
        f("58", "BR") + // País
        f("59", nome.substring(0, 25).trim()) + // Nome recebedor
        f("60", cidade.substring(0, 15).trim()) + // Cidade
        f("62", adf) + // Additional Data
        "6304"; // CRC placeholder
    return payload + crc16ccitt(payload);
}
// ─────────────────────────────────────────────────────────────
// HELPERS DO BOT — compartilhados por chatBot e status updates
// ─────────────────────────────────────────────────────────────
function labelStatus(status) {
    const map = {
        aguardando_confirmacao: "aguardando confirmação ⏳",
        pendente: "pendente ⏳",
        confirmado: "confirmado ✅",
        preparo: "em preparo 🫐",
        pronto: "pronto 🎉",
        entrega: "saiu para entrega 🛵",
        entregue: "entregue ✅",
        cancelado: "cancelado ❌",
    };
    return map[status] || "em processamento";
}
function fmtPagamento(p) {
    return { pix: "PIX", dinheiro: "Dinheiro", cartao: "Cartão na entrega", cartao_online: "Cartão Online", chat: "a combinar" }[p] || p;
}
function respostaStatus(status, pedido, entregador) {
    var _a, _b, _c;
    switch (status) {
        case "aguardando_confirmacao":
            return "⏳ Seu pedido está aguardando confirmação da nossa equipe. Confirmamos em instantes!";
        case "pendente":
            return "⏳ Recebemos seu pedido! Estamos verificando os detalhes e confirmaremos logo.";
        case "confirmado":
            return "✅ Pedido confirmado! Já estamos começando o preparo com todo carinho. 🫐";
        case "preparo": {
            const itens = (_a = pedido === null || pedido === void 0 ? void 0 : pedido.items) === null || _a === void 0 ? void 0 : _a.map((i) => `${i.qty}x ${i.nome}`).join(", ");
            return `🫐 Seu pedido está em preparo${itens ? ` (${itens})` : ""}! Nossa equipe está trabalhando com carinho. Já já fica pronto!`;
        }
        case "pronto":
            return "🎉 Prontinho! Seu pedido ficou pronto e já estamos separando para o entregador buscar!";
        case "entrega":
            if (((_b = entregador === null || entregador === void 0 ? void 0 : entregador.localizacao) === null || _b === void 0 ? void 0 : _b.lat) && ((_c = entregador === null || entregador === void 0 ? void 0 : entregador.localizacao) === null || _c === void 0 ? void 0 : _c.lng)) {
                const { lat, lng } = entregador.localizacao;
                return `🛵 Seu pedido saiu para entrega! O entregador está a caminho.\n📍 Acompanhe em tempo real:\nhttps://maps.google.com?q=${lat},${lng}`;
            }
            return "🛵 Seu pedido saiu para entrega! O entregador está a caminho. Fique atento à porta! 😊";
        case "entregue":
            return "✅ Seu pedido foi entregue! Espero que tenha gostado muito. Avalie nossa loja para nos ajudar a melhorar! ⭐";
        case "cancelado":
            return "❌ Seu pedido foi cancelado. Desculpe o transtorno. Pode fazer um novo pedido quando quiser!";
        default:
            return "Seu pedido está sendo processado. Qualquer dúvida estou aqui! 😊";
    }
}
function respostaTempo(status, pedido) {
    var _a, _b;
    const criado = ((_b = (_a = pedido === null || pedido === void 0 ? void 0 : pedido.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date();
    const min = Math.floor((Date.now() - criado.getTime()) / 60000);
    switch (status) {
        case "aguardando_confirmacao":
        case "pendente": return "⏱ Estamos analisando seu pedido! Logo confirmaremos e iniciaremos o preparo.";
        case "confirmado": return "⏱ Pedido confirmado há pouco! O preparo leva em torno de 15-30 minutos.";
        case "preparo": return `⏱ Em preparo há ${min} min. Estimativa: mais 15-25 minutos para entrega!`;
        case "pronto": return "🎉 Já está pronto! O entregador buscará agora. Chegará em ~10-20 minutos.";
        case "entrega": return "🛵 Entregador a caminho! Estimativa: 10-20 minutos dependendo da distância.";
        default: return "⏱ Estamos trabalhando! Em breve teremos mais informações.";
    }
}
// Retorna os IDs dos N produtos mais vendidos de uma loja, com contagem real de pedidos
async function buscarMaisVendidos(tenantId, prodSnap, limite = 8) {
    try {
        // Busca pedidos dos últimos 90 dias para ter dados relevantes
        const noventa = new Date();
        noventa.setDate(noventa.getDate() - 90);
        const pedidosSnap = await db.collection("pedidos")
            .where("tenantId", "==", tenantId)
            .where("status", "!=", "cancelado")
            .orderBy("status")
            .orderBy("createdAt", "desc")
            .limit(200)
            .get()
            .catch(() => null);
        const contagem = {};
        if (pedidosSnap && !pedidosSnap.empty) {
            pedidosSnap.docs.forEach(doc => {
                const pedido = doc.data();
                const items = pedido.items || [];
                items.forEach(item => {
                    if (item.id) {
                        contagem[item.id] = (contagem[item.id] || 0) + (item.qty || 1);
                    }
                });
            });
        }
        // Produtos ativos do cardápio
        const produtosAtivos = prodSnap.docs
            .filter(d => d.data().ativo !== false)
            .map(d => d.id);
        if (produtosAtivos.length === 0)
            return [];
        // Se não há histórico de vendas, retorna destaques ou os primeiros produtos
        if (Object.keys(contagem).length === 0) {
            const destaques = prodSnap.docs
                .filter(d => d.data().ativo !== false && d.data().destaque)
                .map(d => d.id);
            const resto = prodSnap.docs
                .filter(d => d.data().ativo !== false && !d.data().destaque)
                .sort((a, b) => (a.data().ordem || 999) - (b.data().ordem || 999))
                .map(d => d.id);
            return [...destaques, ...resto].slice(0, limite);
        }
        // Ordena produtos ativos por quantidade vendida (desc), depois destaques, depois ordem
        return produtosAtivos
            .sort((a, b) => {
            var _a, _b;
            const vendaB = contagem[b] || 0;
            const vendaA = contagem[a] || 0;
            if (vendaB !== vendaA)
                return vendaB - vendaA;
            const dadosA = ((_a = prodSnap.docs.find(d => d.id === a)) === null || _a === void 0 ? void 0 : _a.data()) || {};
            const dadosB = ((_b = prodSnap.docs.find(d => d.id === b)) === null || _b === void 0 ? void 0 : _b.data()) || {};
            if (dadosA.destaque && !dadosB.destaque)
                return -1;
            if (!dadosA.destaque && dadosB.destaque)
                return 1;
            return (dadosA.ordem || 999) - (dadosB.ordem || 999);
        })
            .slice(0, limite);
    }
    catch (e) {
        firebase_functions_1.logger.warn("buscarMaisVendidos error:", e);
        return [];
    }
}
async function buscarCardapioBot(tenantId, nomeLoja) {
    try {
        const path = tenantId ? `tenants/${tenantId}/produtos` : "produtos";
        const snap = await db.collection(path).get();
        if (snap.empty) {
            return `📋 O cardápio da *${nomeLoja}* está sendo atualizado. Em breve disponível aqui!`;
        }
        // Filtra ativos e agrupa por categoria
        const categorias = {};
        snap.docs.forEach(d => {
            const p = d.data();
            if (p.ativo === false)
                return;
            const cat = p.categoria || "Cardápio";
            if (!categorias[cat])
                categorias[cat] = [];
            categorias[cat].push({ nome: p.nome || "Item", preco: Number(p.preco) || 0 });
        });
        const totalItens = Object.values(categorias).reduce((s, arr) => s + arr.length, 0);
        if (totalItens === 0) {
            return `📋 Nosso cardápio está sendo preparado. Aguarde novidades!`;
        }
        let msg = `📋 *Cardápio — ${nomeLoja}*\n`;
        Object.entries(categorias).forEach(([cat, items]) => {
            msg += `\n*${cat}*\n`;
            items.slice(0, 8).forEach(item => {
                msg += `• ${item.nome} — R$ ${item.preco.toFixed(2).replace(".", ",")}\n`;
            });
        });
        msg += `\n🛒 Para pedir, toque no botão do carrinho no cardápio da loja!`;
        return msg;
    }
    catch (_a) {
        return "📋 Não consegui carregar o cardápio agora. Tente em instantes!";
    }
}
function gerarRespostaBot(mensagem, pedido, entregador, loja) {
    var _a, _b, _c;
    const lower = mensagem.toLowerCase().trim();
    const nomeLoja = loja.nome || "nossa loja";
    const status = (pedido === null || pedido === void 0 ? void 0 : pedido.status) || "";
    // Saudação
    if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|hi|salve)\b/.test(lower)) {
        if (pedido && status) {
            return `Olá! 😊 Aqui é o assistente virtual da ${nomeLoja}. Seu pedido está *${labelStatus(status)}*. Como posso ajudar?`;
        }
        return `Olá! 😊 Bem-vindo(a) à ${nomeLoja}! Como posso te ajudar hoje?`;
    }
    // Status / onde está
    if (/cadê|onde|status|andamento|como (está|esta|tá|ta)|meu pedido|pedido/.test(lower)) {
        return respostaStatus(status, pedido, entregador);
    }
    // Tempo / demora
    if (/tempo|quanto (falta|demora|tempo)|quando (chega|vai|vem|fica)|prazo|estimad/.test(lower)) {
        return respostaTempo(status, pedido);
    }
    // Entregador / localização
    if (/entregador|motoboy|saiu|a caminho|onde.*entregador|localiz/.test(lower)) {
        if (status !== "entrega") {
            if (status === "preparo")
                return "🫐 Ainda em preparo! Quando ficar pronto, o entregador busca imediatamente.";
            if (status === "pronto")
                return "🎉 Pronto! O entregador já está indo buscar agora.";
            return "O entregador será acionado assim que seu pedido ficar pronto! ⏳";
        }
        if ((_a = entregador === null || entregador === void 0 ? void 0 : entregador.localizacao) === null || _a === void 0 ? void 0 : _a.lat) {
            const { lat, lng } = entregador.localizacao;
            return `🛵 Entregador em rota!\n📍 Localização em tempo real:\nhttps://maps.google.com?q=${lat},${lng}`;
        }
        return "🛵 O entregador saiu com seu pedido e está a caminho! Fique de olho na porta. 😊";
    }
    // Pagamento / valor
    if (/pagar|pagamento|pix|dinheiro|cartão|cartao|troco|valor|total/.test(lower)) {
        if (pedido === null || pedido === void 0 ? void 0 : pedido.total) {
            const valorFmt = `R$ ${Number(pedido.total).toFixed(2).replace(".", ",")}`;
            if (pedido.pagamento === "pix" && loja.pixKey) {
                const nomePix = loja.nomeRecebedorPix || loja.nome || "Loja";
                return (`💳 *Pagamento via PIX*\n\n` +
                    `🔑 Chave: \`${loja.pixKey}\`\n` +
                    `👤 Nome: ${nomePix}\n` +
                    `💰 Valor: *${valorFmt}*\n\n` +
                    `Após pagar, nos mande o comprovante! 📸`);
            }
            const pag = fmtPagamento(pedido.pagamento || "");
            const pago = pedido.pagamento === "pix" ? "✅ PIX — aguardando comprovante." : `Pague na entrega: ${pag}.`;
            return `💳 Total do seu pedido: *${valorFmt}*\n${pago}`;
        }
        return "Para dúvidas sobre pagamento, nossa equipe pode ajudar! 😊";
    }
    // Itens do pedido
    if (/o que (pedi|tem|peço)|itens|item|pedí|comprei|conteúdo|lista do pedido/.test(lower)) {
        const items = (pedido === null || pedido === void 0 ? void 0 : pedido.items) || ((_b = pedido === null || pedido === void 0 ? void 0 : pedido.pedidoInfo) === null || _b === void 0 ? void 0 : _b.itens);
        if ((items === null || items === void 0 ? void 0 : items.length) > 0) {
            const lista = items.map((i) => `• ${i.qty}x ${i.nome}`).join("\n");
            const total = (pedido === null || pedido === void 0 ? void 0 : pedido.total) || ((_c = pedido === null || pedido === void 0 ? void 0 : pedido.pedidoInfo) === null || _c === void 0 ? void 0 : _c.total) || 0;
            return `📦 Seu pedido contém:\n${lista}\n\n💰 Total: R$${Number(total).toFixed(2).replace(".", ",")}`;
        }
        return "Para ver detalhes do seu pedido, acesse o histórico no app! 📱";
    }
    // Cancelamento
    if (/cancelar|cancela|desistir|não quero|nao quero/.test(lower)) {
        return "Para cancelar, nossa equipe precisa ser acionada. Vamos resolver da melhor forma para você! ⚠️ Aguarde nosso contato.";
    }
    // Endereço de entrega
    if (/endereço|endereco|rua|bairro|entrega.*onde|onde.*entrega/.test(lower)) {
        if (pedido === null || pedido === void 0 ? void 0 : pedido.endereco)
            return `📍 Endereço de entrega registrado:\n${pedido.endereco}`;
        return "Seu endereço de entrega foi registrado no pedido! Se houver erro, nos avise. 📍";
    }
    // Reclamação / problema
    if (/errad|errou|faltou|faltando|incompleto|problema|ruim|errado/.test(lower)) {
        return "Puxa, lamento muito pelo inconveniente! 😟 Vou acionar nossa equipe imediatamente para resolver. Alguém entrará em contato!";
    }
    // Agradecimento
    if (/obrigad|valeu|thanks|grat|👍|😊/.test(lower)) {
        return "Fico feliz em ajudar! 😊 É sempre um prazer atender você. Qualquer dúvida, estou aqui!";
    }
    // Elogio
    if (/gostei|delicioso|ótimo|excelente|amei|perfeito|maravilhoso|muito bom/.test(lower)) {
        return `Que alegria ouvir isso! 🥰 Obrigado pelo carinho com a ${nomeLoja}. Volte sempre!`;
    }
    // Ajuda explícita
    if (/ajuda|help|dúvida|duvida|não entendi|nao entendi/.test(lower)) {
        return `Olá! Sou o assistente virtual da ${nomeLoja} 🤖\n\nConsigo te ajudar com:\n• 📋 *Cardápio* — só digitar "cardápio"\n• 📦 *Status do pedido* — "cadê meu pedido?"\n• 🛵 *Entregador* — "onde está o entregador?"\n• ⏱ *Tempo* — "quanto tempo falta?"\n• 💳 *Pagamento* — "como pagar?"\n• 📋 *Itens* — "o que eu pedi?"\n\nQual é sua dúvida?`;
    }
    // Default — escala para atendente/supervisor
    return `Hmm, essa eu não sei responder! 😅\n\nVou chamar meu supervisor que sabe tudo — ele responde em instantes! 👨‍💼✨\n\nEnquanto isso, posso te ajudar com:\n• 📋 "cardápio"\n• 📦 "cadê meu pedido?"\n• ⏱ "quanto tempo falta?"`;
}
admin.initializeApp();
const db = admin.firestore();
// ─────────────────────────────────────────────────────────────
// 1. RESUMO MENSAL — todo dia 1º às 01h (horário de Brasília)
//    Calcula pedidos + faturamento do mês anterior por loja
//    Salva em: lojas/{slug}/resumos/{YYYY-MM}
// ─────────────────────────────────────────────────────────────
exports.resumoMensal = (0, scheduler_1.onSchedule)({ schedule: "0 1 1 * *", timeZone: "America/Sao_Paulo" }, async () => {
    const agora = new Date();
    const anoMes = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    const inicioMes = admin.firestore.Timestamp.fromDate(anoMes);
    const fimMes = admin.firestore.Timestamp.fromDate(new Date(agora.getFullYear(), agora.getMonth(), 1));
    const mesLabel = `${anoMes.getFullYear()}-${String(anoMes.getMonth() + 1).padStart(2, "0")}`;
    firebase_functions_1.logger.info(`Gerando resumo de ${mesLabel}`);
    // Busca todos os pedidos do mês anterior
    const pedidosSnap = await db.collection("pedidos")
        .where("createdAt", ">=", inicioMes)
        .where("createdAt", "<", fimMes)
        .get();
    // Agrupa por tenantId
    const porLoja = {};
    pedidosSnap.docs.forEach(d => {
        const p = d.data();
        const slug = p.tenantId;
        if (!slug)
            return;
        if (!porLoja[slug])
            porLoja[slug] = { total: 0, pedidos: 0, cancelados: 0, ticketTotal: 0 };
        if (p.status === "cancelado") {
            porLoja[slug].cancelados++;
        }
        else {
            porLoja[slug].pedidos++;
            porLoja[slug].total += Number(p.total) || 0;
            porLoja[slug].ticketTotal += Number(p.total) || 0;
        }
    });
    // Busca todas as lojas ativas
    const lojasSnap = await db.collection("lojas").where("ativo", "!=", false).get();
    const batch = db.batch();
    lojasSnap.docs.forEach(lojaDoc => {
        const slug = lojaDoc.data().tenantId || lojaDoc.id;
        const stats = porLoja[slug] || { total: 0, pedidos: 0, cancelados: 0, ticketTotal: 0 };
        const ticketMedio = stats.pedidos > 0 ? stats.ticketTotal / stats.pedidos : 0;
        const resumoRef = db
            .collection("lojas").doc(lojaDoc.id)
            .collection("resumos").doc(mesLabel);
        batch.set(resumoRef, {
            mes: mesLabel,
            pedidos: stats.pedidos,
            cancelados: stats.cancelados,
            faturamento: stats.total,
            ticketMedio: Math.round(ticketMedio * 100) / 100,
            geradoEm: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Também salva no documento da loja para acesso rápido
        batch.update(lojaDoc.ref, {
            [`resumos.${mesLabel}`]: {
                pedidos: stats.pedidos,
                faturamento: stats.total,
                ticketMedio: Math.round(ticketMedio * 100) / 100,
            },
        });
    });
    await batch.commit();
    firebase_functions_1.logger.info(`Resumo de ${mesLabel} gerado para ${lojasSnap.size} lojas`);
});
// ─────────────────────────────────────────────────────────────
// 2. ALERTA DE INATIVIDADE — todo dia às 09h
//    Detecta lojas sem pedido há mais de X dias
//    Salva alerta em: alertas (collection global) + lojas/{slug}/alertas
// ─────────────────────────────────────────────────────────────
exports.alertarInatividade = (0, scheduler_1.onSchedule)({ schedule: "0 9 * * *", timeZone: "America/Sao_Paulo" }, async () => {
    var _a;
    const agora = new Date();
    const limite3dias = new Date(agora.getTime() - 3 * 24 * 60 * 60 * 1000);
    const limite7dias = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const limite15dias = new Date(agora.getTime() - 15 * 24 * 60 * 60 * 1000);
    // Busca lojas ativas
    const lojasSnap = await db.collection("lojas").where("ativo", "!=", false).get();
    const batch = db.batch();
    let alertasGerados = 0;
    for (const lojaDoc of lojasSnap.docs) {
        const slug = lojaDoc.data().tenantId || lojaDoc.id;
        // Último pedido desta loja
        const ultimoPedidoSnap = await db.collection("pedidos")
            .where("tenantId", "==", slug)
            .orderBy("createdAt", "desc")
            .limit(1)
            .get();
        if (ultimoPedidoSnap.empty)
            continue;
        const ultimoPedido = ultimoPedidoSnap.docs[0].data();
        const ultimaData = ((_a = ultimoPedido.createdAt) === null || _a === void 0 ? void 0 : _a.toDate()) || new Date(0);
        let nivel = null;
        let diasSemVenda = 0;
        if (ultimaData < limite15dias) {
            nivel = "critico";
            diasSemVenda = Math.floor((agora.getTime() - ultimaData.getTime()) / (24 * 60 * 60 * 1000));
        }
        else if (ultimaData < limite7dias) {
            nivel = "atencao";
            diasSemVenda = Math.floor((agora.getTime() - ultimaData.getTime()) / (24 * 60 * 60 * 1000));
        }
        else if (ultimaData < limite3dias) {
            nivel = "aviso";
            diasSemVenda = Math.floor((agora.getTime() - ultimaData.getTime()) / (24 * 60 * 60 * 1000));
        }
        if (!nivel)
            continue;
        // Grava alerta na subcollection da loja
        const alertaRef = db
            .collection("lojas").doc(lojaDoc.id)
            .collection("alertas").doc();
        batch.set(alertaRef, {
            tipo: "inatividade",
            nivel,
            diasSemVenda,
            ultimoPedidoEm: ultimoPedido.createdAt,
            lojaNome: lojaDoc.data().nome || slug,
            lojaSlug: slug,
            criadoEm: admin.firestore.FieldValue.serverTimestamp(),
            resolvido: false,
        });
        // Grava também na collection global de alertas (para o admin ver tudo junto)
        const alertaGlobalRef = db.collection("alertas").doc(`${slug}_inatividade`);
        batch.set(alertaGlobalRef, {
            tipo: "inatividade",
            nivel,
            diasSemVenda,
            ultimoPedidoEm: ultimoPedido.createdAt,
            lojaNome: lojaDoc.data().nome || slug,
            lojaSlug: slug,
            atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
            resolvido: false,
        });
        alertasGerados++;
    }
    await batch.commit();
    firebase_functions_1.logger.info(`${alertasGerados} alertas de inatividade gerados`);
});
// ─────────────────────────────────────────────────────────────
// 3. CANCELAR PIX EXPIRADO — roda a cada 5 minutos
//    Cancela pedidos PIX automático que não entraram em preparo no prazo
// ─────────────────────────────────────────────────────────────
exports.cancelarPixExpirado = (0, scheduler_1.onSchedule)({ schedule: "*/5 * * * *", timeZone: "America/Sao_Paulo" }, async () => {
    var _a, _b, _c;
    const agora = new Date();
    // Busca pedidos PIX automático confirmados mas ainda não em preparo
    const expiradosSnap = await db.collection("pedidos")
        .where("pixAutoConfirmado", "==", true)
        .where("status", "==", "confirmado")
        .get();
    if (expiradosSnap.empty)
        return;
    const batch = db.batch();
    let cancelados = 0;
    for (const docSnap of expiradosSnap.docs) {
        const pedido = docSnap.data();
        const expira = ((_b = (_a = pedido.pixExpiraEm) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || null;
        if (!expira || agora < expira)
            continue; // ainda no prazo
        // Cancela o pedido
        batch.update(docSnap.ref, {
            status: "cancelado",
            canceladoMotivo: "pix_nao_pago",
            canceladoEm: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Notifica o cliente no chat
        if (pedido.chatId) {
            const lojaId = pedido.lojaId || "";
            const lojaParticipante = `loja_${lojaId}`;
            // Busca nome da loja para mensagem
            let nomeLoja = "Loja";
            try {
                const lojaSnap = await db.doc(`lojas/${lojaId}`).get();
                if (lojaSnap.exists)
                    nomeLoja = ((_c = lojaSnap.data()) === null || _c === void 0 ? void 0 : _c.nome) || nomeLoja;
            }
            catch (_d) { }
            const msgRef = db.collection("chats").doc(pedido.chatId).collection("mensagens").doc();
            batch.set(msgRef, {
                autorId: lojaParticipante,
                autorNome: `🤖 Rebeca | ${nomeLoja}`,
                tipo: "texto",
                texto: `❌ *Pedido cancelado automaticamente.*\n\n` +
                    `Não identificamos o pagamento PIX no prazo de 30 minutos. ⏰\n\n` +
                    `Se você já pagou, entre em contato com a loja. ` +
                    `Caso queira fazer um novo pedido, é só me chamar! 😊`,
                criadoEm: admin.firestore.FieldValue.serverTimestamp(),
                lida: false, replyTo: null, reacoes: {}, isBot: true,
            });
            // Incrementa naoLido do cliente
            const chatRef = db.doc(`chats/${pedido.chatId}`);
            batch.update(chatRef, {
                "pedidoInfo.status": "cancelado",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                [`naoLido.${pedido.userId}`]: admin.firestore.FieldValue.increment(1),
            });
        }
        cancelados++;
    }
    if (cancelados > 0) {
        await batch.commit();
        firebase_functions_1.logger.info(`cancelarPixExpirado: ${cancelados} pedido(s) cancelado(s) por falta de pagamento`);
    }
});
// ─────────────────────────────────────────────────────────────
// 4. NOVO PEDIDO — trigger em tempo real
//    Quando um pedido é criado, atualiza contador do dia na loja
// ─────────────────────────────────────────────────────────────
exports.onNovoPedido = (0, firestore_1.onDocumentCreated)("pedidos/{pedidoId}", async (event) => {
    var _a;
    const pedido = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!pedido || pedido.status === "cancelado")
        return;
    const slug = pedido.tenantId;
    if (!slug)
        return;
    const hoje = new Date();
    const diaLabel = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    // Atualiza contador diário na loja
    await db.collection("lojas").doc(slug).set({
        contadores: {
            [diaLabel]: {
                pedidos: admin.firestore.FieldValue.increment(1),
                faturamento: admin.firestore.FieldValue.increment(Number(pedido.total) || 0),
            },
            ultimoPedidoEm: admin.firestore.FieldValue.serverTimestamp(),
        },
    }, { merge: true });
    firebase_functions_1.logger.info(`Contador atualizado para loja ${slug} em ${diaLabel}`);
});
// ─────────────────────────────────────────────────────────────
// 4b. MUDANÇA DE STATUS DO PEDIDO — avisa o cliente no chat automaticamente
//     Trigger: qualquer update em pedidos/{pedidoId}
//     Condição: campo "status" mudou e há chatId vinculado
// ─────────────────────────────────────────────────────────────
exports.onPedidoStatusMudou = (0, firestore_1.onDocumentUpdated)("pedidos/{pedidoId}", async (event) => {
    var _a, _b, _c, _d;
    const antes = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const depois = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!antes || !depois)
        return;
    // Só age quando o status realmente mudou
    if (antes.status === depois.status)
        return;
    const chatId = depois.chatId;
    if (!chatId)
        return;
    const novoStatus = depois.status;
    const lojaId = (depois.lojaId || depois.tenantId);
    const lojaVirtualId = `loja_${lojaId}`;
    // Busca nome da loja
    let nomeLoja = "Loja";
    let nomeBot = "Rebeca";
    try {
        const lojaSnap = await db.doc(`lojas/${lojaId}`).get();
        if (lojaSnap.exists)
            nomeLoja = ((_c = lojaSnap.data()) === null || _c === void 0 ? void 0 : _c.nome) || nomeLoja;
    }
    catch (_e) { }
    // Monta mensagem proativa baseada no novo status
    const nomeCliente = (depois.nomeCliente || "").split(" ")[0];
    const saudacao = nomeCliente ? `${nomeCliente}, ` : "";
    const itensFormatados = (depois.items || [])
        .map((i) => `${i.qty}x ${i.nome}`)
        .join(", ");
    const tempoEst = depois.tempoEntrega || "35–45 min";
    const totalFmt = depois.total ? `R$ ${Number(depois.total).toFixed(2).replace(".", ",")}` : "";
    let texto = "";
    switch (novoStatus) {
        case "confirmado": {
            const linhaItens = itensFormatados ? `\n🥣 ${itensFormatados}` : "";
            const linhaTotal = totalFmt ? `\n💰 Total: ${totalFmt}` : "";
            const linhaTemp = `\n⏱️ Previsão: ${tempoEst}`;
            texto =
                `Perfeito 🙌 já recebi seu pedido${nomeCliente ? `, ${nomeCliente}` : ""}!` +
                    `${linhaItens}${linhaTotal}${linhaTemp}\n\n` +
                    `Já estamos preparando aqui 💜`;
            break;
        }
        case "preparo": {
            const itensMsg = itensFormatados ? `\n🥣 ${itensFormatados}` : "";
            texto =
                `🫐 Sua loja está preparando seu pedido agora!${itensMsg}\n\n` +
                    `Falta pouco — assim que ficar pronto, te aviso aqui 😊`;
            break;
        }
        case "pronto":
            texto =
                `🎉 Prontinho${nomeCliente ? `, ${nomeCliente}` : ""}!\n\n` +
                    `Seu pedido acabou de ficar pronto e já estamos chamando o entregador. ` +
                    `Chegará aí em breve! 🛵`;
            break;
        case "entrega": {
            const entregadorId = depois.entregadorId;
            let locMsg = "";
            if (entregadorId) {
                try {
                    const entSnap = await db.doc(`entregadores/${entregadorId}`).get();
                    const loc = (_d = entSnap.data()) === null || _d === void 0 ? void 0 : _d.localizacao;
                    if ((loc === null || loc === void 0 ? void 0 : loc.lat) && (loc === null || loc === void 0 ? void 0 : loc.lng)) {
                        locMsg = `\n📍 Localização em tempo real: https://maps.google.com?q=${loc.lat},${loc.lng}`;
                    }
                }
                catch (_f) { }
            }
            texto =
                `Seu pedido acabou de sair pra entrega 🚴‍♂️💨\n` +
                    `Deve chegar aí em uns 10–15 min!\n` +
                    `Fica de olho na porta 😉${locMsg}\n\n` +
                    `Qualquer coisa me chama aqui 💜`;
            break;
        }
        case "entregue":
            texto =
                `Chegou tudo certinho aí${nomeCliente ? `, ${nomeCliente}` : ""}? 🥣💜\n\n` +
                    `Esperamos que você tenha amado! Se precisar de algo — ` +
                    `reclamação, reembolso ou só quiser repetir o pedido — ` +
                    `é só me chamar 😉`;
            break;
        case "atraso": {
            const motivoAtraso = depois.motivoAtraso;
            texto =
                `Te avisando com transparência 🙏\n\n` +
                    (motivoAtraso ? `${motivoAtraso}\n\n` : `Tivemos um pequeno atraso aqui na saída.\n\n`) +
                    `Seu pedido já está a caminho e deve chegar em até 15 min. ` +
                    `Acompanho daqui pra você — desculpa a espera 💜`;
            break;
        }
        case "cancelado": {
            const motivo = depois.canceladoMotivo;
            const motivoTxt = motivo === "pix_nao_pago"
                ? "Não identificamos o pagamento PIX no prazo. 😔"
                : motivo ? motivo : "";
            texto =
                `❌ *Pedido cancelado.*\n\n` +
                    (motivoTxt ? `${motivoTxt}\n\n` : "") +
                    `${saudacao}se precisar de ajuda ou quiser refazer o pedido, ` +
                    `é só me chamar aqui — estou à disposição! 😊`;
            break;
        }
        default:
            return; // status sem mensagem definida
    }
    if (!texto)
        return;
    const batch = db.batch();
    // Mensagem no chat
    const msgRef = db.collection("chats").doc(chatId).collection("mensagens").doc();
    batch.set(msgRef, {
        autorId: lojaVirtualId,
        autorNome: `🤖 ${nomeBot} | ${nomeLoja}`,
        tipo: "texto",
        texto,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        lida: false,
        replyTo: null,
        reacoes: {},
        isBot: true,
    });
    // Atualiza pedidoInfo.status no chat e incrementa naoLido do cliente
    const clienteUid = depois.userId;
    const chatUpdates = {
        "pedidoInfo.status": novoStatus,
        ultimaMensagem: {
            texto: texto.slice(0, 80),
            criadoEm: admin.firestore.FieldValue.serverTimestamp(),
            autorId: lojaVirtualId,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (clienteUid)
        chatUpdates[`naoLido.${clienteUid}`] = admin.firestore.FieldValue.increment(1);
    batch.update(db.doc(`chats/${chatId}`), chatUpdates);
    await batch.commit();
    firebase_functions_1.logger.info(`onPedidoStatusMudou: status ${antes.status} → ${novoStatus} — mensagem enviada no chat ${chatId}`);
});
// ─────────────────────────────────────────────────────────────
// 4. ALERTA DE ESTOQUE BAIXO — dispara quando produto é atualizado
//    Condição: controlarEstoque=true e estoque cruzou limiar de 5 ou 0
//    Salva em: lojas/{tenantId}/alertasEstoque/{produtoId}
// ─────────────────────────────────────────────────────────────
exports.alertaEstoqueBaixo = (0, firestore_1.onDocumentUpdated)("tenants/{tenantId}/produtos/{produtoId}", async (event) => {
    var _a, _b;
    const antes = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const depois = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!antes || !depois)
        return;
    // Só produtos com controle ativo
    if (!depois.controlarEstoque)
        return;
    const estoqueAntes = Number(antes.estoque) || 0;
    const estoqueDepois = Number(depois.estoque) || 0;
    // Só dispara quando o estoque diminuiu
    if (estoqueDepois >= estoqueAntes)
        return;
    const LIMITE = 5;
    const esgotado = estoqueDepois <= 0 && estoqueAntes > 0;
    const baixo = estoqueDepois <= LIMITE && estoqueDepois > 0 && estoqueAntes > LIMITE;
    if (!esgotado && !baixo)
        return;
    const tenantId = event.params.tenantId;
    const produtoId = event.params.produtoId;
    const tipo = esgotado ? "esgotado" : "baixo";
    await db.doc(`lojas/${tenantId}/alertasEstoque/${produtoId}`).set({
        tipo,
        nomeProduto: depois.nome || "Produto",
        estoque: estoqueDepois,
        limite: LIMITE,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        lido: false,
    });
    firebase_functions_1.logger.info(`Alerta estoque ${tipo}: "${depois.nome}" (${estoqueDepois} restantes)`);
});
// ─────────────────────────────────────────────────────────────
// 5. CHAT BOT — responde automaticamente 24/7
//    Trigger: nova mensagem em qualquer chat
//    Condição: loja com botAtivo = true e mensagem do cliente
//    Responde com contexto completo do pedido + entregador
// ─────────────────────────────────────────────────────────────
exports.chatBot = (0, firestore_1.onDocumentCreated)("chats/{chatId}/mensagens/{msgId}", async (event) => {
    var _a, _b, _c, _d;
    const msgData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    console.log("chatBot INVOKED msgData=", JSON.stringify(msgData));
    if (!msgData)
        return;
    if (msgData.isBot || String(msgData.autorId).startsWith("loja_")) {
        console.log(`chatBot: ignorando bot/loja autorId=${msgData.autorId}`);
        return;
    }
    if (!((_b = msgData.texto) === null || _b === void 0 ? void 0 : _b.trim())) {
        console.log("chatBot: sem texto");
        return;
    }
    const chatId = event.params.chatId;
    console.log(`chatBot: processando chatId=${chatId} texto="${msgData.texto}"`);
    const chatSnap = await db.doc(`chats/${chatId}`).get();
    if (!chatSnap.exists) {
        console.log(`chatBot: chat não encontrado ${chatId}`);
        return;
    }
    const chatData = chatSnap.data();
    console.log(`chatBot: participantes=${JSON.stringify(chatData.participantes)}`);
    const lojaParticipante = (_c = chatData.participantes) === null || _c === void 0 ? void 0 : _c.find((p) => p.startsWith("loja_"));
    if (!lojaParticipante) {
        console.log(`chatBot: sem participante loja_ em ${JSON.stringify(chatData.participantes)}`);
        return;
    }
    const lojaId = lojaParticipante.replace("loja_", "");
    console.log(`chatBot: lojaId="${lojaId}"`);
    let lojaData = null;
    const lojaDirectSnap = await db.doc(`lojas/${lojaId}`).get();
    if (lojaDirectSnap.exists) {
        lojaData = lojaDirectSnap.data();
        console.log(`chatBot: loja por docID botAtivo=${lojaData.botAtivo} botIA=${lojaData.botIA}`);
    }
    else {
        const lojaQuery = await db.collection("lojas").where("tenantId", "==", lojaId).limit(1).get();
        if (!lojaQuery.empty) {
            lojaData = lojaQuery.docs[0].data();
            console.log(`chatBot: loja por query botAtivo=${lojaData.botAtivo} botIA=${lojaData.botIA}`);
        }
        else {
            console.log(`chatBot: loja NÃO encontrada para lojaId="${lojaId}"`);
        }
    }
    if (!(lojaData === null || lojaData === void 0 ? void 0 : lojaData.botAtivo)) {
        console.log("chatBot: botAtivo false, saindo");
        return;
    }
    if (lojaData === null || lojaData === void 0 ? void 0 : lojaData.botIA) {
        console.log("chatBot: botIA ativo, delegando");
        return;
    }
    // Carrega pedido vinculado ao chat (se existir)
    let pedidoData = null;
    let entregadorData = null;
    if (chatData.pedidoId) {
        // Tenta root pedidos primeiro, depois tenant
        const rootSnap = await db.doc(`pedidos/${chatData.pedidoId}`).get();
        if (rootSnap.exists) {
            pedidoData = rootSnap.data();
        }
        else {
            const tenantId = lojaData.tenantId || lojaId;
            const tenantSnap = await db.doc(`tenants/${tenantId}/pedidos/${chatData.pedidoId}`).get();
            if (tenantSnap.exists)
                pedidoData = tenantSnap.data();
        }
        // Carrega entregador se pedido em rota
        if ((pedidoData === null || pedidoData === void 0 ? void 0 : pedidoData.status) === "entrega" && (pedidoData === null || pedidoData === void 0 ? void 0 : pedidoData.entregadorId)) {
            const entSnap = await db.doc(`entregadores/${pedidoData.entregadorId}`).get();
            if (entSnap.exists)
                entregadorData = entSnap.data();
        }
    }
    // Gera resposta contextual
    const lowerMsg = msgData.texto.toLowerCase().trim();
    let resposta;
    if (/card[áa]pio|menu|o que tem|o que voc[êe]s|tem pr[áa]|op[çc][õo]es|o que serve|o que vende/.test(lowerMsg)) {
        // Resposta especial: busca produtos reais no Firestore
        const tenantId = lojaData.tenantId || lojaId;
        resposta = await buscarCardapioBot(tenantId, lojaData.nome || "");
    }
    else {
        resposta = gerarRespostaBot(msgData.texto, pedidoData, entregadorData, lojaData);
    }
    if (!resposta)
        return;
    const userId = (_d = chatData.participantes) === null || _d === void 0 ? void 0 : _d.find((p) => !p.startsWith("loja_"));
    // Salva resposta do bot
    await db.collection("chats").doc(chatId).collection("mensagens").add({
        autorId: lojaParticipante,
        autorNome: `🤖 Rebeca | ${lojaData.nome || "Assistente"}`,
        tipo: "texto",
        texto: resposta,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        lida: false,
        replyTo: null,
        reacoes: {},
        isBot: true,
    });
    // Atualiza metadata do chat
    const updates = {
        ultimaMensagem: {
            texto: resposta,
            criadoEm: admin.firestore.FieldValue.serverTimestamp(),
            autorId: lojaParticipante,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        [`naoLido.${lojaParticipante}`]: 0,
    };
    if (userId)
        updates[`naoLido.${userId}`] = admin.firestore.FieldValue.increment(1);
    await db.doc(`chats/${chatId}`).update(updates);
    firebase_functions_1.logger.info(`ChatBot respondeu em ${chatId} para loja ${lojaId}`);
});
function buildPromptIA(loja, cardapio, conversa, clientePerfil, baseConhecimento, cuponsAtivos, recompensasList, lojaId, pedidoAtual) {
    var _a, _b;
    const nomeLoja = loja.nome || "nossa loja";
    // Ordena: destaques primeiro, depois por ordem, depois alfabético
    const cardapioOrdenado = [...cardapio].sort((a, b) => {
        if (a.destaque && !b.destaque)
            return -1;
        if (!a.destaque && b.destaque)
            return 1;
        if (a.ordem != null && b.ordem != null)
            return a.ordem - b.ordem;
        return 0;
    });
    const cats = {};
    cardapioOrdenado.forEach(p => {
        const cat = p.categoria || "Cardápio";
        if (!cats[cat])
            cats[cat] = [];
        cats[cat].push(p);
    });
    let menuText = "";
    Object.entries(cats).forEach(([cat, items]) => {
        menuText += `\n${cat}:\n`;
        items.forEach(i => {
            const badge = i.destaque ? " ⭐DESTAQUE" : "";
            menuText += `  - ${i.nome} (id:${i.id}) — R$${i.preco.toFixed(2).replace(".", ",")}${badge}\n`;
        });
    });
    const carrinhoText = conversa.carrinho.length > 0
        ? conversa.carrinho
            .map(i => `  - ${i.qty}x ${i.nome} = R$${(i.preco * i.qty).toFixed(2).replace(".", ",")}`)
            .join("\n")
            + `\n  TOTAL: R$${conversa.carrinho.reduce((s, i) => s + i.preco * i.qty, 0).toFixed(2).replace(".", ",")}`
        : "  (vazio)";
    const infoText = [
        conversa.nome ? `Nome: ${conversa.nome}` : null,
        conversa.tipoEntrega ? `Tipo entrega: ${conversa.tipoEntrega}` : null,
        conversa.endereco ? `Endereço: ${conversa.endereco}` : null,
        conversa.pagamento ? `Pagamento: ${conversa.pagamento}` : null,
    ].filter(Boolean).join("\n") || "  (nenhuma ainda)";
    const pixInfo = loja.pixKey
        ? `\nPAGAMENTO PIX DISPONÍVEL: Chave PIX da loja: ${loja.pixKey} (Nome: ${loja.nomeRecebedorPix || nomeLoja})`
        : "";
    // ── Informações completas da loja ─────────────────────────
    const pagsAceitos = Array.isArray(loja.formasPagamento) && loja.formasPagamento.length > 0
        ? loja.formasPagamento.map((p) => ({ pix: "PIX", dinheiro: "Dinheiro", cartao: "Cartão na entrega", cartao_online: "Cartão Online" }[p] || p)).join(", ")
        : "PIX, Dinheiro";
    // Endereço completo da loja
    const enderecoLoja = [
        loja.enderecoRetirada || loja.endereco,
        loja.bairro,
        [loja.cidade, loja.estado].filter(Boolean).join(" - "),
        loja.cep ? `CEP ${loja.cep}` : null,
    ].filter(Boolean).join(", ");
    // Links das páginas da loja (para o bot incluir nas respostas)
    const lojaSlugBuildPrompt = loja.slug || lojaId || "";
    const dominioBuildPrompt = loja.dominio || "https://nexfoody.com.br";
    const linkCardapio = lojaSlugBuildPrompt ? `${dominioBuildPrompt}/loja/${lojaSlugBuildPrompt}` : "";
    const linkPerfil = lojaSlugBuildPrompt ? `${dominioBuildPrompt}/loja/${lojaSlugBuildPrompt}/perfil` : "";
    const linkFeed = lojaSlugBuildPrompt ? `${dominioBuildPrompt}/loja/${lojaSlugBuildPrompt}/feed` : "";
    const infoLoja = [
        loja.cardapioAtivo === false || loja.pausaManual ? `⚠️ LOJA FECHADA AGORA${loja.mensagemPausa ? `: ${loja.mensagemPausa}` : ""}` : "✅ Loja aberta",
        loja.horario ? `🕐 Horário: ${loja.horario}` : null,
        loja.horariosDetalhados ? `🕐 Horários:\n${loja.horariosDetalhados}` : null,
        enderecoLoja ? `📍 Endereço da loja: ${enderecoLoja}` : null,
        loja.taxaEntrega != null ? `🛵 Taxa de entrega: ${Number(loja.taxaEntrega) === 0 ? "Grátis" : `R$${Number(loja.taxaEntrega).toFixed(2).replace(".", ",")} `}` : null,
        loja.tempoEntrega ? `⏱️ Tempo de entrega: ${loja.tempoEntrega}` : null,
        `💳 Formas de pagamento aceitas: ${pagsAceitos}`,
        loja.infoExtra ? `ℹ️ Info extra: ${loja.infoExtra}` : null,
        loja.instagram ? `📸 Instagram: ${loja.instagram}` : null,
        loja.whatsapp ? `📱 WhatsApp: ${loja.whatsapp}` : null,
        loja.modoFidelidade === "pontos" || loja.modoFidelidade === "ambos"
            ? `⭐ Programa de fidelidade: acumula pontos a cada compra` : null,
        loja.modoFidelidade === "cashback" || loja.modoFidelidade === "ambos"
            ? `💰 Cashback: cliente recebe cashback a cada compra` : null,
        cuponsAtivos && cuponsAtivos.length > 0
            ? `\n🎟️ CUPONS ATIVOS:\n${cuponsAtivos.join("\n")}` : null,
        recompensasList && recompensasList.length > 0
            ? `\n🎁 RECOMPENSAS (troca por pontos):\n${recompensasList.join("\n")}` : null,
    ].filter(Boolean).join("\n");
    // Dados do perfil do cliente
    const fmtPts = (v) => v !== undefined && v !== null ? v.toLocaleString("pt-BR") : null;
    const fmtR2 = (v) => v !== undefined && v !== null ? `R$ ${v.toFixed(2).replace(".", ",")}` : null;
    const perfilCliente = clientePerfil ? [
        clientePerfil.nome ? `Nome: ${clientePerfil.nome}` : null,
        clientePerfil.telefone ? `Telefone: ${clientePerfil.telefone}` : null,
        clientePerfil.email ? `Email: ${clientePerfil.email}` : null,
        // Endereço completo
        clientePerfil.endereco ? `Endereço completo cadastrado: ${clientePerfil.endereco}` : null,
        clientePerfil.complemento && !((_a = clientePerfil.endereco) === null || _a === void 0 ? void 0 : _a.includes(clientePerfil.complemento))
            ? `Complemento: ${clientePerfil.complemento}` : null,
        clientePerfil.referencia ? `Ponto de referência: ${clientePerfil.referencia}` : null,
        // Fidelidade
        clientePerfil.pontos !== undefined
            ? `⭐ Pontos de fidelidade: ${fmtPts(clientePerfil.pontos)} pontos` : null,
        clientePerfil.cashback ? `💰 Cashback acumulado: ${fmtR2(clientePerfil.cashback)}` : null,
        clientePerfil.saldoCarteira ? `👛 Saldo na carteira NexFoody: ${fmtR2(clientePerfil.saldoCarteira)} disponível${clientePerfil.saldoPendente ? ` + ${fmtR2(clientePerfil.saldoPendente)} pendente` : ""}` : null,
        // Histórico nesta loja
        clientePerfil.totalPedidos ? `Total de pedidos nesta loja: ${clientePerfil.totalPedidos}` : null,
        clientePerfil.clienteVip ? `⭐ CLIENTE VIP — fidelíssimo, já fez ${clientePerfil.totalPedidos} pedidos aqui!` : null,
        clientePerfil.pagamentoFavorito ? `Forma de pagamento favorita: ${clientePerfil.pagamentoFavorito} (sugira esta)` : null,
        clientePerfil.itensFavoritos ? `Itens mais pedidos: ${clientePerfil.itensFavoritos}` : null,
        clientePerfil.tipoEntregaFavorito ? `Preferência de entrega: ${clientePerfil.tipoEntregaFavorito}` : null,
        clientePerfil.ultimosPedidos ? `Últimos pedidos nesta loja:\n${clientePerfil.ultimosPedidos}` : null,
    ].filter(Boolean).join("\n") : "";
    const baseSection = baseConhecimento
        ? `\nCONHECIMENTO DA LOJA (treinamento):\n${baseConhecimento}\n`
        : "";
    // Seção do pedido ativo — injetada no prompt para a IA saber o status real
    const pedidoAtualSection = pedidoAtual ? (() => {
        var _a;
        const itensTxt = ((_a = pedidoAtual.itens) === null || _a === void 0 ? void 0 : _a.length) ? pedidoAtual.itens.join(", ") : "";
        const tempoTxt = pedidoAtual.tempoDecorrido != null
            ? ` (há ${pedidoAtual.tempoDecorrido} min)`
            : "";
        const lines = [
            `Status: ${labelStatus(pedidoAtual.status)}${tempoTxt}`,
            pedidoAtual.numeroPedido ? `Número: #${pedidoAtual.numeroPedido}` : null,
            pedidoAtual.total ? `Total: R$${pedidoAtual.total.toFixed(2).replace(".", ",")}` : null,
            itensTxt ? `Itens: ${itensTxt}` : null,
            pedidoAtual.endereco ? `Entrega em: ${pedidoAtual.endereco}` : null,
            pedidoAtual.pagamento ? `Pagamento: ${fmtPagamento(pedidoAtual.pagamento)}` : null,
        ].filter(Boolean).join("\n");
        return `\nPEDIDO ATIVO DO CLIENTE (dados reais do sistema — use sempre que perguntar sobre o pedido):\n${lines}\n`;
    })() : "";
    const infoLojaSection = infoLoja ? `\nINFORMAÇÕES DA LOJA:\n${infoLoja}\n` : "";
    // Links das páginas — incluídos no prompt para o bot referenciar
    const linksSection = linkCardapio ? `\nLINKS DA LOJA (use nas respostas quando relevante):
🛍️ Cardápio completo: ${linkCardapio}
👤 Perfil da loja: ${linkPerfil}
📱 Feed / Novidades: ${linkFeed}\n` : "";
    const nomeCliente = conversa.nome || (clientePerfil === null || clientePerfil === void 0 ? void 0 : clientePerfil.nome) || "";
    const saudacaoCliente = nomeCliente ? `, ${nomeCliente.split(" ")[0]}` : "";
    return `Você é a Rebeca, assistente virtual da loja "${nomeLoja}" na NexFoody. Você é HUMANA, calorosa e simpática — fale como uma atendente real no WhatsApp, não como um robô.

REGRAS DE HUMANIZAÇÃO:
- Use o nome do cliente sempre que possível: "${nomeCliente ? `o cliente se chama ${nomeCliente.split(" ")[0]}` : "pergunte o nome no início"}"
- Saudação personalizada: "Olá${saudacaoCliente}! 😊" — nunca "Como posso ajudar?" sem nome
- Varie suas respostas, não repita as mesmas frases
- Use linguagem descontraída, como um amigo atendendo
- Quando confirmar pedido: "Anotei tudo${saudacaoCliente}! Deixa eu confirmar com você..."

CARDÁPIO:${menuText || "\n  (cardápio indisponível agora)"}
${infoLojaSection}${linksSection}${baseSection}
PERFIL DO CLIENTE:
${perfilCliente || "  (cliente novo, sem cadastro)"}

CARRINHO ATUAL:
${carrinhoText}

INFORMAÇÕES COLETADAS:
${infoText}
${pedidoAtualSection}${pixInfo}

INSTRUÇÕES:

TOM E HUMANIZAÇÃO (seguir sempre):
- Fale como uma atendente real no WhatsApp — calorosa, natural, sem parecer robô
- Varie as respostas, nunca repita as mesmas frases na mesma conversa
- Use o nome do cliente sempre que possível
- Mensagens curtas e diretas — sem parágrafos longos
- Emojis com moderação: reforçam, não poluem

PRIMEIRA MENSAGEM DA CONVERSA:
- Se o cliente tiver histórico de pedidos nesta loja, mencione o último pedido de forma natural:
  "Oi${saudacaoCliente}! 😄 Quer repetir ${((_b = clientePerfil === null || clientePerfil === void 0 ? void 0 : clientePerfil.itensFavoritos) === null || _b === void 0 ? void 0 : _b.split(",")[0]) || "aquele pedido"} de novo? Posso montar rapidinho 👀"
- Se for cliente novo: "Oi${saudacaoCliente}! 😊 Seja bem-vindo(a) à ${nomeLoja}! O que vai ser hoje?"

CARDÁPIO E PRODUTOS:
- Quando o cliente pedir para ver o cardápio, opções ou sugestões, use mostrar_produtos. Prefira cards visuais a listar em texto.
  • Cardápio geral: 6–8 produtos, priorize ⭐DESTAQUE
  • Categoria específica ("tem açaí?"): todos os produtos da categoria (até 8)
- Quando o cliente mencionar um produto específico, use add_item diretamente — não pergunte se quer adicionar, apenas adicione e confirme
- Para dúvidas sobre ingredientes/opções: responda com o conhecimento do cardápio, depois ofereça uma sugestão

ALTERAÇÕES NO PEDIDO:
- Se o cliente pedir para trocar, substituir ou ajustar ("tira a granola, bota paçoca"):
  1. Use remove_item para retirar o item antigo
  2. Use add_item para adicionar o novo
  3. Confirme em uma frase: "Pronto! Tirei a granola e coloquei paçoca 👍 Mais alguma coisa ou fechamos assim?"
- NUNCA diga "não é possível alterar" — sempre tente resolver

CONFIRMAÇÃO DO PEDIDO:
- Quando tiver todos os dados, confirme antes de chamar confirm_order
- Após confirm_order bem-sucedido:
  • Liste os itens, total e previsão de entrega de forma visual
  • Dinheiro/cartão: "Pedido anotado! 🙌" + resumo + "Já estamos preparando 💜"
  • PIX: diga que o QR code e copia-cola foram enviados acima. NÃO diga "QR não disponível"

PERFIL DO CLIENTE — use ativamente:
- Endereço cadastrado: confirme sem pedir de novo — "Entrego no [endereço], certo?"
- Pagamento favorito: sugira — "Vai pagar no [pagamento] de sempre?"
- Itens favoritos: sugira ao final — "Que tal de novo um [item]? 😋"
- Pontos: mencione proativamente — "Você tem X pontos! Quer usar em alguma recompensa?"
- Cliente VIP: seja extra caloroso — "Que bom te ver de novo! 🥰"
- NÃO peça informações que já estão no perfil

PEDIDO EM ANDAMENTO:
- Se o cliente perguntar sobre o status do pedido, use os dados da seção PEDIDO ATIVO acima
- Seja específico: "Seu pedido está em preparo há 12 min — previsão de mais 15 min 😊"
- NUNCA diga "não tenho acesso ao status" — você tem acesso aos dados acima

LINKS — inclua apenas quando diretamente útil:
- Localização/endereço → link do Perfil
- Horário → link do Perfil
- Cardápio → link do Cardápio completo
- Feed/promoções → link do Feed
- Formato: linha em branco, depois "👉 [texto]: [link]"

- Responda SEMPRE em português brasileiro
- Não invente produtos fora do cardápio`;
}
function buildToolsIA() {
    return [
        {
            name: "add_item",
            description: "Adiciona ou incrementa um item no carrinho do cliente",
            input_schema: {
                type: "object",
                properties: {
                    id: { type: "string", description: "ID do produto conforme cardápio" },
                    nome: { type: "string", description: "Nome do produto" },
                    preco: { type: "number", description: "Preço unitário" },
                    qty: { type: "number", description: "Quantidade a adicionar" },
                },
                required: ["id", "nome", "preco", "qty"],
            },
        },
        {
            name: "remove_item",
            description: "Remove ou diminui quantidade de um item do carrinho",
            input_schema: {
                type: "object",
                properties: {
                    id: { type: "string", description: "ID do produto" },
                    qty: { type: "number", description: "Quantidade a remover; omita ou use 0 para remover tudo" },
                },
                required: ["id"],
            },
        },
        {
            name: "update_info",
            description: "Salva uma informação do pedido: nome, endereço, pagamento ou tipo de entrega",
            input_schema: {
                type: "object",
                properties: {
                    campo: { type: "string", enum: ["nome", "endereco", "pagamento", "tipoEntrega"] },
                    valor: { type: "string" },
                },
                required: ["campo", "valor"],
            },
        },
        {
            name: "confirm_order",
            description: "Cria o pedido definitivo no sistema com todos os itens e informações coletadas",
            input_schema: {
                type: "object",
                properties: {
                    observacoes: { type: "string", description: "Observações opcionais do cliente" },
                },
            },
        },
        {
            name: "mostrar_produtos",
            description: "Exibe cards visuais de produtos no chat (com foto, preço e botão Adicionar). Use quando o cliente pedir para ver o cardápio, quiser ver opções ou quando quiser sugerir produtos específicos.",
            input_schema: {
                type: "object",
                properties: {
                    ids: { type: "array", items: { type: "string" }, description: "IDs dos produtos a mostrar (máximo 6)" },
                    titulo: { type: "string", description: "Título curto acima dos cards, ex: 'Nossos açaís 🫐' ou 'Sugestões para você'" },
                },
                required: ["ids"],
            },
        },
    ];
}
async function processToolIA(toolName, toolInput, conversa, chatId, lojaId, lojaData, clienteUid) {
    var _a;
    switch (toolName) {
        case "add_item": {
            const { id, nome, preco, qty } = toolInput;
            const existing = conversa.carrinho.find(i => i.id === id);
            if (existing) {
                existing.qty += qty;
            }
            else {
                conversa.carrinho.push({ id, nome, preco, qty });
            }
            return `${qty}x "${nome}" adicionado. Carrinho: ${conversa.carrinho.map(i => `${i.qty}x ${i.nome}`).join(", ")}.`;
        }
        case "remove_item": {
            const { id, qty } = toolInput;
            if (!qty || qty === 0) {
                conversa.carrinho = conversa.carrinho.filter(i => i.id !== id);
            }
            else {
                const item = conversa.carrinho.find(i => i.id === id);
                if (item) {
                    item.qty -= qty;
                    if (item.qty <= 0)
                        conversa.carrinho = conversa.carrinho.filter(i => i.id !== id);
                }
            }
            return `Item removido. Carrinho: ${conversa.carrinho.length > 0 ? conversa.carrinho.map(i => `${i.qty}x ${i.nome}`).join(", ") : "vazio"}.`;
        }
        case "mostrar_produtos": {
            const { ids, titulo } = toolInput;
            if (!ids || ids.length === 0)
                return "Nenhum produto informado.";
            // Busca dados completos dos produtos no Firestore
            const tenantId = lojaData.tenantId || lojaId;
            const prodSnap = await db.collection(`tenants/${tenantId}/produtos`).get();
            const todosProd = prodSnap.docs.map(d => (Object.assign({ id: d.id }, d.data())));
            const produtos = ids
                .slice(0, 8)
                .map(id => todosProd.find(p => p.id === id))
                .filter(Boolean)
                .filter(p => p.ativo !== false)
                .map(p => ({
                id: p.id,
                nome: p.nome,
                preco: p.preco,
                foto: p.foto || null,
                emoji: p.emoji || "🍽️",
                desc: p.desc || null,
            }));
            if (produtos.length === 0)
                return "Produtos não encontrados no cardápio.";
            const lojaSlug = lojaData.slug || lojaId;
            const lojaParticipante = `loja_${lojaId}`;
            await db.collection("chats").doc(chatId).collection("mensagens").add({
                autorId: lojaParticipante,
                autorNome: `🤖 Rebeca | ${lojaData.nome || "Assistente"}`,
                tipo: "produtos",
                texto: titulo || "Confira nossas opções:",
                produtos,
                lojaSlug,
                criadoEm: admin.firestore.FieldValue.serverTimestamp(),
                lida: false, replyTo: null, reacoes: {}, isBot: true,
            });
            return `Cards enviados: ${produtos.map(p => p.nome).join(", ")}. Aguardando cliente escolher.`;
        }
        case "update_info": {
            const { campo, valor } = toolInput;
            if (campo === "nome")
                conversa.nome = valor;
            else if (campo === "endereco")
                conversa.endereco = valor;
            else if (campo === "pagamento")
                conversa.pagamento = valor;
            else if (campo === "tipoEntrega")
                conversa.tipoEntrega = valor;
            return `${campo} salvo: "${valor}".`;
        }
        case "confirm_order": {
            if (conversa.carrinho.length === 0) {
                return "Erro: carrinho vazio. Adicione itens antes de confirmar.";
            }
            const total = conversa.carrinho.reduce((s, i) => s + i.preco * i.qty, 0);
            const tenantId = lojaData.tenantId || lojaId;
            const isPix = conversa.pagamento === "pix";
            // PIX manual: aguarda comprovante → fica como "aguardando_pagamento" (visível no painel do lojista)
            // PIX automático (Mercado Pago): direto em "confirmado"
            // Outros pagamentos: "confirmado"
            const pixAutoConfirmar = !!(lojaData.pixAutoConfirmar);
            const statusInicial = isPix && !pixAutoConfirmar ? "aguardando_pagamento" : "confirmado";
            // Busca fotos dos produtos no cardápio para enriquecer os items
            const produtosSnap = await db.collection("lojas").doc(lojaId).collection("produtos").get();
            const produtosMap = {};
            produtosSnap.forEach(d => { produtosMap[d.id] = d.data().foto || ""; });
            // Gera numeroPedido sequencial por loja (transação atômica)
            const contadorRef = db.collection("lojas").doc(lojaId).collection("_contadores").doc("pedidos");
            let numeroPedido = 1001;
            await db.runTransaction(async (tx) => {
                var _a;
                const snap = await tx.get(contadorRef);
                numeroPedido = (snap.exists ? (((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.ultimo) || 1000) : 1000) + 1;
                tx.set(contadorRef, { ultimo: numeroPedido }, { merge: true });
            });
            const pedidoRef = await db.collection("pedidos").add(Object.assign({ tenantId,
                lojaId, lojaNome: lojaData.nome || lojaId, uid: clienteUid, userId: clienteUid, nomeCliente: conversa.nome || "Cliente Chat", items: conversa.carrinho.map(i => ({ id: i.id, nome: i.nome, preco: i.preco, qty: i.qty, foto: produtosMap[i.id] || "" })), total,
                numeroPedido, status: statusInicial, canal: "chat_ia", chatId, tipoEntrega: conversa.tipoEntrega || "entrega", endereco: conversa.endereco || "", pagamento: conversa.pagamento || "dinheiro", observacoes: toolInput.observacoes || "", createdAt: admin.firestore.FieldValue.serverTimestamp() }, (isPix && pixAutoConfirmar ? {
                pixAutoConfirmado: true,
                pixExpiraEm: new Date(Date.now() + (Number(lojaData.pixPrazoMinutos) || 30) * 60 * 1000),
            } : {})));
            const lojaParticipanteConfirm = `loja_${lojaId}`;
            await db.doc(`chats/${chatId}`).update({
                pedidoId: pedidoRef.id,
                pedidoInfo: {
                    total,
                    itens: conversa.carrinho.map(i => `${i.qty}x ${i.nome}`),
                    status: statusInicial,
                },
                // Garante que o lojista veja o chat como não lido (badge acende no painel)
                [`naoLido.${lojaParticipanteConfirm}`]: admin.firestore.FieldValue.increment(1),
            });
            // PIX: envia card com QR code e copia e cola
            if (isPix && lojaData.pixKey) {
                const nomePix = lojaData.nomeRecebedorPix || lojaData.nome || "Loja";
                const cidadePix = lojaData.cidadePix || "Brasil";
                const refPedido = `PED-${pedidoRef.id.slice(-6).toUpperCase()}`;
                const valorFmt = `R$ ${total.toFixed(2).replace(".", ",")}`;
                // Se tem token MP e é PIX auto, gera PIX dinâmico via Mercado Pago
                let pixCopiaCola = "";
                let mpPaymentId = null;
                if (pixAutoConfirmar && lojaData.mpAccessToken) {
                    try {
                        const mp = new mercadopago_1.MercadoPagoConfig({ accessToken: lojaData.mpAccessToken });
                        const payment = new mercadopago_1.Payment(mp);
                        const mpResp = await payment.create({
                            body: {
                                transaction_amount: total,
                                description: `${refPedido} - ${lojaData.nome || "Pedido"}`,
                                payment_method_id: "pix",
                                payer: {
                                    email: conversa.email || `cliente_${clienteUid}@nexfoody.com`,
                                    first_name: (conversa.nome || "Cliente").split(" ")[0],
                                },
                            },
                        });
                        const txInfo = (_a = mpResp.point_of_interaction) === null || _a === void 0 ? void 0 : _a.transaction_data;
                        pixCopiaCola = (txInfo === null || txInfo === void 0 ? void 0 : txInfo.qr_code) || "";
                        mpPaymentId = String(mpResp.id || "");
                        // Salva mpPaymentId no pedido para o webhook encontrar
                        await db.doc(`pedidos/${pedidoRef.id}`).update({ mpPaymentId });
                        firebase_functions_1.logger.info(`PIX MP criado: ${mpPaymentId} para pedido ${pedidoRef.id}`);
                    }
                    catch (mpErr) {
                        firebase_functions_1.logger.warn("Erro MP PIX, usando PIX estático:", mpErr);
                        pixCopiaCola = gerarPixCopiaCola(lojaData.pixKey, nomePix, cidadePix, total, refPedido);
                    }
                }
                else {
                    // PIX estático (chave manual)
                    pixCopiaCola = gerarPixCopiaCola(lojaData.pixKey, nomePix, cidadePix, total, refPedido);
                }
                const lojaParticipante = `loja_${lojaId}`;
                await db.collection("chats").doc(chatId).collection("mensagens").add({
                    autorId: lojaParticipante,
                    autorNome: `🤖 Rebeca | ${lojaData.nome || "Assistente"}`,
                    tipo: "pix",
                    texto: `💳 Pague ${valorFmt} via PIX`,
                    pixCopiaCola,
                    pixChave: lojaData.pixKey,
                    pixNome: nomePix,
                    pixCidade: cidadePix,
                    pixValor: total,
                    pixRef: refPedido,
                    pixAutoConfirmar: pixAutoConfirmar,
                    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
                    lida: false, replyTo: null, reacoes: {}, isBot: true,
                });
                // Salva referência no pedido
                await db.doc(`pedidos/${pedidoRef.id}`).update({ refPedido });
                if (pixAutoConfirmar) {
                    // Modo automático: pedido já está confirmado, cliente só precisa pagar
                    firebase_functions_1.logger.info(`PIX automático — pedido ${pedidoRef.id} confirmado direto no chat ${chatId}`);
                }
                else {
                    // Modo manual: aguarda comprovante
                    conversa.aguardandoComprovante = true;
                    conversa.pedidoId = pedidoRef.id;
                    firebase_functions_1.logger.info(`PIX pendente — aguardando comprovante no chat ${chatId}`);
                }
            }
            const itensTxt = conversa.carrinho.map(i => `${i.qty}x ${i.nome}`).join(", ");
            const tempoEstimado = lojaData.tempoEntrega || "35–45 min";
            conversa.carrinho = [];
            if (isPix) {
                return pixAutoConfirmar
                    ? `Pedido #${numeroPedido} confirmado e dados PIX enviados. Itens: ${itensTxt}. Total: R$${total.toFixed(2).replace(".", ",")}. Previsão: ${tempoEstimado}. Confirme ao cliente e aguarde o pagamento.`
                    : `Pedido #${numeroPedido} registrado (aguardando comprovante PIX). Itens: ${itensTxt}. Total: R$${total.toFixed(2).replace(".", ",")}. Instrua o cliente a enviar foto do comprovante.`;
            }
            return `Pedido #${numeroPedido} confirmado! Itens: ${itensTxt}. Total: R$${total.toFixed(2).replace(".", ",")}. Previsão de entrega: ${tempoEstimado}. Agora confirme ao cliente de forma calorosa com todos esses detalhes.`;
        }
        default:
            return "Ferramenta desconhecida.";
    }
}
// ─────────────────────────────────────────────────────────────
// 6. BROADCAST — quando loja cria broadcast, envia para todos os chats
// ─────────────────────────────────────────────────────────────
exports.onBroadcastCriado = (0, firestore_1.onDocumentCreated)("lojas/{lojaId}/broadcasts/{broadcastId}", async (event) => {
    var _a, _b;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data)
        return;
    const lojaId = event.params.lojaId;
    const lojaVirtualId = `loja_${lojaId}`;
    const mensagem = data.mensagem;
    const lojaNome = data.lojaNome || "Loja";
    // Busca todos os chats desta loja
    const chatsSnap = await db.collection("chats")
        .where("participantes", "array-contains", lojaVirtualId)
        .get();
    if (chatsSnap.empty) {
        firebase_functions_1.logger.info(`Broadcast: nenhum chat para loja ${lojaId}`);
        return;
    }
    let enviados = 0;
    const batch = db.batch();
    for (const chatDoc of chatsSnap.docs) {
        const chatData = chatDoc.data();
        const clienteUid = (_b = chatData.participantes) === null || _b === void 0 ? void 0 : _b.find((p) => !p.startsWith("loja_"));
        if (!clienteUid)
            continue;
        // Adiciona mensagem no chat
        const msgRef = db.collection("chats").doc(chatDoc.id).collection("mensagens").doc();
        batch.set(msgRef, {
            autorId: lojaVirtualId,
            autorNome: `🏪 ${lojaNome}`,
            tipo: "texto",
            texto: mensagem,
            criadoEm: admin.firestore.FieldValue.serverTimestamp(),
            lida: false,
            replyTo: null,
            reacoes: {},
            isBot: true,
            isBroadcast: true,
        });
        // Atualiza metadados do chat
        batch.update(chatDoc.ref, {
            ultimaMensagem: {
                texto: mensagem.slice(0, 80),
                criadoEm: admin.firestore.FieldValue.serverTimestamp(),
                autorId: lojaVirtualId,
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            [`naoLido.${clienteUid}`]: admin.firestore.FieldValue.increment(1),
            [`naoLido.${lojaVirtualId}`]: 0,
        });
        enviados++;
    }
    await batch.commit();
    // Atualiza contador no broadcast
    await db.doc(`lojas/${lojaId}/broadcasts/${event.params.broadcastId}`).update({
        enviados,
    });
    firebase_functions_1.logger.info(`Broadcast enviado para ${enviados} chats da loja ${lojaId}`);
});
exports.chatBotIA = (0, firestore_1.onDocumentCreated)({ document: "chats/{chatId}/mensagens/{msgId}", secrets: [anthropicKey] }, async (event) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    const msgData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!msgData)
        return;
    // Ignora mensagens do bot/loja
    if (msgData.isBot || String(msgData.autorId).startsWith("loja_"))
        return;
    // Permite imagens (comprovante PIX) mesmo sem texto
    const isImagem = msgData.tipo === "imagem" && msgData.midia;
    if (!((_b = msgData.texto) === null || _b === void 0 ? void 0 : _b.trim()) && !isImagem)
        return;
    const chatId = event.params.chatId;
    const chatSnap = await db.doc(`chats/${chatId}`).get();
    if (!chatSnap.exists)
        return;
    const chatData = chatSnap.data();
    const lojaParticipanteFind = (_c = chatData.participantes) === null || _c === void 0 ? void 0 : _c.find((p) => p.startsWith("loja_"));
    if (!lojaParticipanteFind)
        return;
    const lojaId = lojaParticipanteFind.replace("loja_", "");
    let lojaDataIA = null;
    const lojaDirectIA = await db.doc(`lojas/${lojaId}`).get();
    if (lojaDirectIA.exists) {
        lojaDataIA = lojaDirectIA.data();
    }
    else {
        const lojaQueryIA = await db.collection("lojas").where("tenantId", "==", lojaId).limit(1).get();
        if (!lojaQueryIA.empty)
            lojaDataIA = lojaQueryIA.docs[0].data();
    }
    if (!(lojaDataIA === null || lojaDataIA === void 0 ? void 0 : lojaDataIA.botIA))
        return;
    // Mescla config do tenant (onde pixKey, nomeRecebedorPix etc. são salvos)
    const tenantIdForConfig = lojaDataIA.tenantId || lojaId;
    try {
        const configSnap = await db.doc(`tenants/${tenantIdForConfig}/config/loja`).get();
        if (configSnap.exists) {
            lojaDataIA = Object.assign(Object.assign({}, configSnap.data()), lojaDataIA);
            // pixKey e nomeRecebedorPix vêm do config
            if (!lojaDataIA.pixKey && ((_d = configSnap.data()) === null || _d === void 0 ? void 0 : _d.pixKey)) {
                lojaDataIA.pixKey = configSnap.data().pixKey;
            }
            if (!lojaDataIA.nomeRecebedorPix && ((_e = configSnap.data()) === null || _e === void 0 ? void 0 : _e.nomeRecebedorPix)) {
                lojaDataIA.nomeRecebedorPix = configSnap.data().nomeRecebedorPix;
            }
        }
    }
    catch (e) {
        firebase_functions_1.logger.warn("Erro ao buscar config do tenant:", e);
    }
    const lojaData = lojaDataIA;
    const clienteUid = ((_f = chatData.participantes) === null || _f === void 0 ? void 0 : _f.find((p) => !p.startsWith("loja_"))) || "";
    const lojaParticipante = `loja_${lojaId}`;
    // Verifica se o cliente está autenticado (UID real no Firebase Auth)
    let clienteAutenticado = false;
    if (clienteUid) {
        try {
            await admin.auth().getUser(clienteUid);
            clienteAutenticado = true;
        }
        catch (_r) {
            clienteAutenticado = false;
        }
    }
    // Se não autenticado, bloqueia com mensagem de cadastro
    if (!clienteAutenticado) {
        await db.collection("chats").doc(chatId).collection("mensagens").add({
            autorId: `loja_${lojaId}`,
            autorNome: `🤖 Rebeca | ${lojaDataIA.nome || "Assistente"}`,
            tipo: "texto",
            texto: `Olá! 😊 Para fazer pedidos pelo chat é necessário ter uma conta cadastrada.\n\n👉 *Crie sua conta gratuitamente* e aproveite:\n• Seus pedidos salvos e rastreáveis\n• Endereço salvo (não precisa digitar toda vez!)\n• Histórico completo de pedidos\n• Promoções exclusivas\n\nFaça login ou cadastre-se no app e volte aqui! 🫐`,
            criadoEm: admin.firestore.FieldValue.serverTimestamp(),
            lida: false, replyTo: null, reacoes: {}, isBot: true,
        });
        return;
    }
    // Busca perfil do cliente para pré-preencher dados e analisar hábitos
    let clientePerfil = {};
    if (clienteUid) {
        try {
            // Lê perfil completo do cliente e carteira em paralelo
            const [userSnap, carteiraSnap] = await Promise.all([
                db.collection("users").doc(clienteUid).get(),
                db.collection("carteiras").doc(clienteUid).get(),
            ]);
            if (userSnap.exists) {
                const u = userSnap.data();
                // Monta endereço completo em ordem: rua + número + complemento, bairro, cidade - estado, CEP
                const enderecoPartes = [
                    [u.rua, u.numero].filter(Boolean).join(", "),
                    u.complemento || "",
                    u.bairro || "",
                    [u.cidade, u.estado].filter(Boolean).join(" - "),
                    u.cep ? `CEP ${u.cep}` : "",
                ].filter(Boolean);
                const enderecoCompleto = enderecoPartes.length >= 2
                    ? enderecoPartes.join(", ")
                    : u.endereco || u.cidade || "";
                // Carteira / saldo NexFoody
                const carteira = carteiraSnap.exists ? carteiraSnap.data() : null;
                clientePerfil = {
                    nome: u.nome || u.displayName || "",
                    rua: u.rua || "",
                    bairro: u.bairro || "",
                    cidade: u.cidade || "",
                    estado: u.estado || "",
                    cep: u.cep || "",
                    complemento: u.complemento || "",
                    referencia: u.referencia || "",
                    telefone: u.telefone || u.celular || "",
                    email: u.email || "",
                    endereco: enderecoCompleto,
                    pontos: (_g = u.pontos) !== null && _g !== void 0 ? _g : 0,
                    cashback: (_h = u.cashback) !== null && _h !== void 0 ? _h : 0,
                    rankingPts: (_j = u.rankingPts) !== null && _j !== void 0 ? _j : 0,
                    saldoCarteira: carteira ? ((_k = carteira.saldoDisponivel) !== null && _k !== void 0 ? _k : 0) : 0,
                    saldoPendente: carteira ? ((_l = carteira.saldoPendente) !== null && _l !== void 0 ? _l : 0) : 0,
                };
            }
            // Analisa histórico de pedidos nesta loja (últimos 20, sem orderBy para evitar índice)
            const ultSnap = await db.collection("pedidos")
                .where("userId", "==", clienteUid)
                .where("lojaId", "==", lojaId)
                .limit(20)
                .get();
            if (!ultSnap.empty) {
                // Ordena em memória por createdAt desc
                const pedidosHist = ultSnap.docs
                    .map(d => d.data())
                    .sort((a, b) => { var _a, _b, _c, _d; return (((_b = (_a = b.createdAt) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) || 0) - (((_d = (_c = a.createdAt) === null || _c === void 0 ? void 0 : _c.toMillis) === null || _d === void 0 ? void 0 : _d.call(_c)) || 0); });
                // Últimos 3 para exibir no resumo
                clientePerfil.ultimosPedidos = pedidosHist.slice(0, 3).map(p => {
                    const itens = (p.items || []).map((i) => `${i.qty}x ${i.nome}`).join(", ");
                    return `• ${itens} — R$${(p.total || 0).toFixed(2).replace(".", ",")} (${p.pagamento || "?"})`;
                }).join("\n");
                clientePerfil.totalPedidos = pedidosHist.length;
                clientePerfil.clienteVip = pedidosHist.length >= 5;
                // Pagamento mais usado
                const contPag = {};
                pedidosHist.forEach(p => { if (p.pagamento)
                    contPag[p.pagamento] = (contPag[p.pagamento] || 0) + 1; });
                const [pagFav] = Object.entries(contPag).sort((a, b) => b[1] - a[1]);
                if (pagFav)
                    clientePerfil.pagamentoFavorito = pagFav[0];
                // Itens mais pedidos
                const contItens = {};
                pedidosHist.forEach(p => {
                    (p.items || []).forEach((i) => {
                        contItens[i.nome] = (contItens[i.nome] || 0) + (i.qty || 1);
                    });
                });
                const topItens = Object.entries(contItens).sort((a, b) => b[1] - a[1]).slice(0, 3);
                if (topItens.length)
                    clientePerfil.itensFavoritos = topItens.map(([n, q]) => `${n} (${q}x)`).join(", ");
                // Tipo de entrega favorito
                const contEntrega = {};
                pedidosHist.forEach(p => { if (p.tipoEntrega)
                    contEntrega[p.tipoEntrega] = (contEntrega[p.tipoEntrega] || 0) + 1; });
                const [entFav] = Object.entries(contEntrega).sort((a, b) => b[1] - a[1]);
                if (entFav)
                    clientePerfil.tipoEntregaFavorito = entFav[0];
            }
        }
        catch (e) {
            firebase_functions_1.logger.warn("Erro ao buscar perfil do cliente:", e);
        }
    }
    // Carrega pedido ativo vinculado ao chat (para injetar status real no prompt)
    let pedidoAtualIA;
    const pedidoIdAtivo = chatData.pedidoId;
    if (pedidoIdAtivo) {
        try {
            const pedSnap = await db.doc(`pedidos/${pedidoIdAtivo}`).get();
            if (pedSnap.exists) {
                const ped = pedSnap.data();
                const criado = ((_o = (_m = ped.createdAt) === null || _m === void 0 ? void 0 : _m.toDate) === null || _o === void 0 ? void 0 : _o.call(_m)) || new Date();
                const tempoMin = Math.floor((Date.now() - criado.getTime()) / 60000);
                pedidoAtualIA = {
                    status: ped.status || "pendente",
                    numeroPedido: ped.numeroPedido,
                    total: Number(ped.total) || undefined,
                    itens: (ped.items || []).map((i) => `${i.qty}x ${i.nome}`),
                    endereco: ped.endereco || ped.tipoEntrega === "retirada" ? "Retirada na loja" : ped.endereco,
                    pagamento: ped.pagamento,
                    criadoEm: criado,
                    tempoDecorrido: tempoMin,
                };
            }
        }
        catch (e) {
            firebase_functions_1.logger.warn("Erro ao buscar pedido ativo:", e);
        }
    }
    // Carrega ou inicializa estado da conversa
    const raw = chatData.botConversa;
    const conversa = {
        carrinho: (raw === null || raw === void 0 ? void 0 : raw.carrinho) || [],
        // Pré-preenche com dados do perfil se ainda não foram coletados
        nome: (raw === null || raw === void 0 ? void 0 : raw.nome) || clientePerfil.nome,
        tipoEntrega: raw === null || raw === void 0 ? void 0 : raw.tipoEntrega,
        endereco: (raw === null || raw === void 0 ? void 0 : raw.endereco) || clientePerfil.endereco,
        pagamento: raw === null || raw === void 0 ? void 0 : raw.pagamento,
        historico: (raw === null || raw === void 0 ? void 0 : raw.historico) || [],
        aguardandoComprovante: (raw === null || raw === void 0 ? void 0 : raw.aguardandoComprovante) || false,
        pedidoId: raw === null || raw === void 0 ? void 0 : raw.pedidoId,
        conviteSeguidorEnviado: (raw === null || raw === void 0 ? void 0 : raw.conviteSeguidorEnviado) || false,
    };
    // ── Comprovante PIX recebido ──────────────────────────────
    if (isImagem && conversa.aguardandoComprovante && conversa.pedidoId) {
        const comprovanteUrl = msgData.midia;
        // Verifica duplicidade: mesma URL de imagem já usada em pedido anterior
        const duplicadoSnap = await db.collection("pedidos")
            .where("uid", "==", clienteUid)
            .where("comprovantePix", "==", comprovanteUrl)
            .limit(1)
            .get();
        if (!duplicadoSnap.empty) {
            // Comprovante já usado — rejeita
            const rejeitadaMsg = `⚠️ *Comprovante já utilizado!*\n\n` +
                `Essa imagem já foi enviada em um pedido anterior e não pode ser reutilizada.\n\n` +
                `Por favor, realize um *novo pagamento PIX* e envie o comprovante novo. 📸`;
            await db.collection("chats").doc(chatId).collection("mensagens").add({
                autorId: lojaParticipante,
                autorNome: `🤖 Rebeca | ${lojaData.nome || "Assistente"}`,
                tipo: "texto",
                texto: rejeitadaMsg,
                criadoEm: admin.firestore.FieldValue.serverTimestamp(),
                lida: false,
                replyTo: null,
                reacoes: {},
                isBot: true,
            });
            firebase_functions_1.logger.warn(`Comprovante duplicado rejeitado no chat ${chatId} — uid: ${clienteUid}`);
            return;
        }
        // Confirma o pedido
        await db.doc(`pedidos/${conversa.pedidoId}`).update({
            status: "confirmado",
            comprovantePix: comprovanteUrl,
            pagamentoConfirmadoEm: admin.firestore.FieldValue.serverTimestamp(),
        });
        await db.doc(`chats/${chatId}`).update({
            "pedidoInfo.status": "confirmado",
        });
        conversa.aguardandoComprovante = false;
        const confirmacaoMsg = `✅ *Pagamento confirmado!* Obrigado, ${((_p = conversa.nome) === null || _p === void 0 ? void 0 : _p.split(" ")[0]) || ""}! 🎉\n\n` +
            `Seu pedido já entrou em preparo! 🫐\n` +
            `Assim que estiver pronto, você receberá uma atualização aqui.`;
        await db.collection("chats").doc(chatId).collection("mensagens").add({
            autorId: lojaParticipante,
            autorNome: `🤖 Rebeca | ${lojaData.nome || "Assistente"}`,
            tipo: "texto",
            texto: confirmacaoMsg,
            criadoEm: admin.firestore.FieldValue.serverTimestamp(),
            lida: false,
            replyTo: null,
            reacoes: {},
            isBot: true,
        });
        // Persiste estado atualizado e sai
        await db.doc(`chats/${chatId}`).update({
            "botConversa.aguardandoComprovante": false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        firebase_functions_1.logger.info(`Comprovante PIX recebido e pedido ${conversa.pedidoId} confirmado no chat ${chatId}`);
        return;
    }
    // Se está aguardando comprovante mas chegou texto (não imagem), lembra o cliente
    if (conversa.aguardandoComprovante && !isImagem) {
        const lembrete = `⏳ Ainda aguardo o *comprovante do PIX* para confirmar seu pedido!\n\n` +
            `Por favor, tire uma foto ou screenshot do comprovante e envie aqui. 📸`;
        await db.collection("chats").doc(chatId).collection("mensagens").add({
            autorId: lojaParticipante,
            autorNome: `🤖 Rebeca | ${lojaData.nome || "Assistente"}`,
            tipo: "texto",
            texto: lembrete,
            criadoEm: admin.firestore.FieldValue.serverTimestamp(),
            lida: false,
            replyTo: null,
            reacoes: {},
            isBot: true,
        });
        await db.doc(`chats/${chatId}`).update({
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            [`naoLido.${clienteUid}`]: admin.firestore.FieldValue.increment(1),
        });
        firebase_functions_1.logger.info(`chatBotIA: lembrete de comprovante enviado no chat ${chatId}`);
        return;
    }
    // Adiciona mensagem do cliente ao histórico
    conversa.historico.push({ role: "user", content: msgData.texto });
    if (conversa.historico.length > 20)
        conversa.historico = conversa.historico.slice(-20);
    // Busca cardápio
    const tenantId = lojaData.tenantId || lojaId;
    // Busca tudo em paralelo: produtos, cupons, recompensas, base de conhecimento
    const [prodSnap, cuponsSnap, recompensasSnap, baseSnap] = await Promise.all([
        db.collection(`tenants/${tenantId}/produtos`).get(),
        db.collection(`tenants/${tenantId}/cupons`).get(),
        db.collection(`tenants/${tenantId}/recompensas`).get(),
        db.collection("lojas").doc(lojaId).collection("_config").doc("baseConhecimento").get().catch(() => null),
    ]);
    const cardapio = [];
    prodSnap.docs.forEach(d => {
        var _a;
        const p = d.data();
        if (p.ativo === false)
            return;
        cardapio.push({ id: d.id, nome: p.nome || "", preco: Number(p.preco) || 0, categoria: p.categoria || "Cardápio", destaque: !!p.destaque, ordem: (_a = p.ordem) !== null && _a !== void 0 ? _a : undefined });
    });
    // ── Interceptor cardápio: envia os 8 mais vendidos sem passar pela IA ──
    const lowerMsgIA = (msgData.texto || "").toLowerCase().trim();
    const lojaSlugIA = lojaData.slug || lojaId;
    if (/card[áa]pio|menu|o que tem|o que voc[êe]s|op[çc][õo]es|o que serve|o que vende/.test(lowerMsgIA)) {
        const maisVendidosIds = await buscarMaisVendidos(tenantId, prodSnap, 8);
        if (maisVendidosIds.length > 0) {
            const produtosCard = maisVendidosIds
                .map(id => prodSnap.docs.find(d => d.id === id))
                .filter(Boolean)
                .map(d => {
                const p = d.data();
                return { id: d.id, nome: p.nome || "", preco: Number(p.preco) || 0, foto: p.foto || null, emoji: p.emoji || "🍽️", desc: p.desc || null };
            });
            const nomeCliente = conversa.nome || (clientePerfil === null || clientePerfil === void 0 ? void 0 : clientePerfil.nome) || "";
            const saudacao = nomeCliente ? `, ${nomeCliente.split(" ")[0]}` : "";
            const temVendas = produtosCard.some((_, idx) => idx >= 0); // always true, just for clarity
            await Promise.all([
                // Card visual com produtos
                db.collection("chats").doc(chatId).collection("mensagens").add({
                    autorId: lojaParticipante,
                    autorNome: `🤖 Rebeca | ${lojaData.nome || "Assistente"}`,
                    tipo: "produtos",
                    texto: "🔥 Nossos mais pedidos:",
                    produtos: produtosCard,
                    lojaSlug: lojaSlugIA,
                    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
                    lida: false, replyTo: null, reacoes: {}, isBot: true,
                }),
                // Mensagem de texto complementar
                db.collection("chats").doc(chatId).collection("mensagens").add({
                    autorId: lojaParticipante,
                    autorNome: `🤖 Rebeca | ${lojaData.nome || "Assistente"}`,
                    tipo: "texto",
                    texto: `Aqui estão nossos ${temVendas ? "mais pedidos" : "destaques"}${saudacao}! 😋\n\nArraste para ver todos. Quer adicionar algum? Só falar o nome ou tocar em *+ Adicionar*! 🛒`,
                    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
                    lida: false, replyTo: null, reacoes: {}, isBot: true,
                }),
            ]);
            await db.doc(`chats/${chatId}`).update({
                ultimaMensagem: { texto: "🔥 Nossos mais pedidos:", criadoEm: admin.firestore.FieldValue.serverTimestamp(), autorId: lojaParticipante },
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                [`naoLido.${clienteUid}`]: admin.firestore.FieldValue.increment(1),
            });
            // Adiciona ao histórico para a IA ter contexto se o cliente perguntar depois
            conversa.historico.push({ role: "user", content: msgData.texto });
            conversa.historico.push({ role: "assistant", content: `Mostrei os ${produtosCard.length} produtos mais vendidos como cards visuais.` });
            if (conversa.historico.length > 20)
                conversa.historico = conversa.historico.slice(-20);
            await db.doc(`chats/${chatId}`).update({
                botConversa: conversa,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return; // Não passa pela IA
        }
    }
    // Cupons ativos
    const now = new Date();
    const cuponsAtivos = cuponsSnap.docs
        .map(d => d.data())
        .filter(c => { var _a, _b; return c.ativo !== false && (!c.validade || ((_b = (_a = c.validade).toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) >= now); })
        .map(c => {
        const desc = c.tipo === "percentual" ? `${c.desconto}% OFF`
            : c.tipo === "fixo" ? `R$${Number(c.desconto).toFixed(2).replace(".", ",")} OFF`
                : c.tipo === "frete" ? "Frete grátis" : "";
        const minimo = c.valorMinimo ? ` (pedido mín. R$${Number(c.valorMinimo).toFixed(2).replace(".", ",")})` : "";
        return `• Código *${c.codigo}* — ${desc}${minimo}`;
    });
    // Recompensas de fidelidade
    const recompensasList = recompensasSnap.docs
        .map(d => d.data())
        .filter(r => r.ativo !== false)
        .sort((a, b) => (a.pontos || 0) - (b.pontos || 0))
        .map(r => `• ${r.nome} — ${r.pontos} pontos`);
    // Base de conhecimento treinada
    let baseConhecimento;
    if (baseSnap && baseSnap.exists && ((_q = baseSnap.data()) === null || _q === void 0 ? void 0 : _q.conteudo)) {
        baseConhecimento = baseSnap.data().conteudo;
    }
    const tools = buildToolsIA();
    const client = new sdk_1.default({ apiKey: anthropicKey.value() });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages = conversa.historico.map(m => ({ role: m.role, content: m.content }));
    let finalResponse = "";
    let modeloUsado = "haiku";
    const maxIterations = 5;
    // ── Detecta sinais de confusão na resposta ──────────────────
    const detectaConfusao = (texto) => /não entendi|não compreendi|pode repetir|desculpe|não tenho certeza|não sei ao certo|me perdi|não consegui|tente novamente/i.test(texto);
    // ── Salva mensagens originais para o caso de escalada ───────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mensagensOrigem = conversa.historico.map(m => ({ role: m.role, content: m.content }));
    // ── Executa loop de atendimento com um modelo específico ────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const executarLoop = async (modelo, msgs) => {
        let resposta = "";
        for (let i = 0; i < maxIterations; i++) {
            const systemPrompt = buildPromptIA(lojaData, cardapio, conversa, clientePerfil, baseConhecimento, cuponsAtivos, recompensasList, lojaId, pedidoAtualIA);
            const response = await client.messages.create({
                model: modelo,
                max_tokens: modelo.includes("sonnet") ? 2048 : 1024,
                system: systemPrompt,
                tools,
                messages: msgs,
            });
            if (response.stop_reason === "end_turn") {
                const textBlock = response.content.find(b => b.type === "text");
                if (textBlock && textBlock.type === "text")
                    resposta = textBlock.text;
                break;
            }
            if (response.stop_reason === "tool_use") {
                msgs.push({ role: "assistant", content: response.content });
                const toolResults = [];
                for (const block of response.content) {
                    if (block.type !== "tool_use")
                        continue;
                    const result = await processToolIA(block.name, block.input, conversa, chatId, lojaId, lojaData, clienteUid);
                    toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
                }
                msgs.push({ role: "user", content: toolResults });
            }
        }
        return resposta;
    };
    // Mostra indicador de digitação enquanto IA processa
    await db.doc(`chats/${chatId}`).update({
        [`digitando.${lojaParticipante}`]: true,
    }).catch(() => { });
    try {
        // ── 1ª tentativa: Haiku (rápido e barato) ──────────────────
        finalResponse = await executarLoop("claude-haiku-4-5-20251001", messages);
        // ── Escala para Sonnet se Haiku não deu conta ───────────────
        // Condições: sem resposta, sinais de confusão ou conversa longa sem fechar pedido
        const conversaLonga = conversa.historico.length > 12 && !conversa.pedidoId;
        const precisaEscalar = !finalResponse || detectaConfusao(finalResponse) || conversaLonga;
        if (precisaEscalar) {
            firebase_functions_1.logger.info(`chatBotIA: escalando para Sonnet no chat ${chatId} (confusão=${detectaConfusao(finalResponse)}, longa=${conversaLonga}, semResposta=${!finalResponse})`);
            modeloUsado = "sonnet";
            // Reinicia com as mensagens originais para dar contexto limpo ao Sonnet
            const msgsSonnet = [...mensagensOrigem];
            finalResponse = await executarLoop("claude-sonnet-4-6", msgsSonnet);
        }
    }
    catch (err) {
        // Falha na API da Anthropic — cai no robô básico como plano B
        firebase_functions_1.logger.warn("chatBotIA: erro na API Anthropic, usando fallback básico", err);
        finalResponse = gerarRespostaBot(msgData.texto, null, null, lojaData);
    }
    finally {
        // Remove indicador de digitação sempre que terminar (sucesso ou erro)
        await db.doc(`chats/${chatId}`).update({
            [`digitando.${lojaParticipante}`]: false,
        }).catch(() => { });
    }
    if (!finalResponse)
        finalResponse = "Ops, algo deu errado. Tente novamente! 😊";
    // Persiste resposta no histórico
    conversa.historico.push({ role: "assistant", content: finalResponse });
    if (conversa.historico.length > 20)
        conversa.historico = conversa.historico.slice(-20);
    // Salva mensagem do bot
    await db.collection("chats").doc(chatId).collection("mensagens").add({
        autorId: lojaParticipante,
        autorNome: `🤖 Rebeca | ${lojaData.nome || "Assistente"}`,
        tipo: "texto",
        texto: finalResponse,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        lida: false,
        replyTo: null,
        reacoes: {},
        isBot: true,
    });
    // ── Convite para seguir o perfil da loja (envia 1x por conversa) ─────────
    if (clienteUid && !conversa.conviteSeguidorEnviado) {
        try {
            const seguidorDoc = await db.collection("seguidoresLoja").doc(clienteUid).get();
            const jaSeguindo = seguidorDoc.exists;
            if (!jaSeguindo) {
                const lojaSlug = lojaData.slug || lojaId;
                const dominio = lojaData.dominio || "https://nexfoody.com.br";
                // Link para o feed da loja — perfil estilo Instagram onde o cliente pode seguir
                const linkPerfil = `${dominio}/loja/${lojaSlug}/feed`;
                const nomeDisplay = lojaData.nome || "nossa loja";
                const conviteTexto = `👋 Você já segue o perfil da *${nomeDisplay}*?\n\n` +
                    `🎁 Promoções exclusivas, cupons de desconto e novidades você encontra por lá!\n\n` +
                    `👉 ${linkPerfil}`;
                await db.collection("chats").doc(chatId).collection("mensagens").add({
                    autorId: lojaParticipante,
                    autorNome: `🤖 Rebeca | ${nomeDisplay}`,
                    tipo: "texto",
                    texto: conviteTexto,
                    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
                    lida: false,
                    replyTo: null,
                    reacoes: {},
                    isBot: true,
                });
                conversa.conviteSeguidorEnviado = true;
                firebase_functions_1.logger.info(`Convite de seguidor enviado no chat ${chatId}`);
            }
            else {
                conversa.conviteSeguidorEnviado = true; // já segue — não enviar de novo
            }
        }
        catch (e) {
            firebase_functions_1.logger.warn("Erro ao verificar seguidor da loja:", e);
        }
    }
    // Persiste estado da conversa + metadata do chat
    const updates = {
        botConversa: {
            carrinho: conversa.carrinho,
            nome: conversa.nome || null,
            tipoEntrega: conversa.tipoEntrega || null,
            endereco: conversa.endereco || null,
            pagamento: conversa.pagamento || null,
            historico: conversa.historico,
            aguardandoComprovante: conversa.aguardandoComprovante || false,
            pedidoId: conversa.pedidoId || null,
            conviteSeguidorEnviado: conversa.conviteSeguidorEnviado || false,
            ultimoModelo: modeloUsado,
        },
        ultimaMensagem: {
            texto: finalResponse,
            criadoEm: admin.firestore.FieldValue.serverTimestamp(),
            autorId: lojaParticipante,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        [`naoLido.${lojaParticipante}`]: 0,
    };
    if (clienteUid)
        updates[`naoLido.${clienteUid}`] = admin.firestore.FieldValue.increment(1);
    await db.doc(`chats/${chatId}`).update(updates);
    firebase_functions_1.logger.info(`ChatBotIA respondeu em ${chatId} para loja ${lojaId}`);
});
// ─────────────────────────────────────────────────────────────
// WEBHOOK MERCADO PAGO — detecta pagamento PIX e libera pedido
// URL: https://us-east1-acaipedidos-f53cc.cloudfunctions.net/mpWebhook
// ─────────────────────────────────────────────────────────────
exports.mpWebhook = (0, https_1.onRequest)({ region: "us-east1" }, async (req, res) => {
    var _a, _b;
    // MP envia POST com { action, data: { id } }
    const { action, data } = req.body || {};
    if (action !== "payment.updated" && action !== "payment.created") {
        res.sendStatus(200);
        return;
    }
    const mpPaymentId = String((data === null || data === void 0 ? void 0 : data.id) || "");
    if (!mpPaymentId) {
        res.sendStatus(200);
        return;
    }
    try {
        // Busca o pedido pelo mpPaymentId
        const pedidosSnap = await db.collection("pedidos")
            .where("mpPaymentId", "==", mpPaymentId)
            .limit(1)
            .get();
        if (pedidosSnap.empty) {
            res.sendStatus(200);
            return;
        }
        const pedidoDoc = pedidosSnap.docs[0];
        const pedido = pedidoDoc.data();
        // Só age em pedidos PIX automático ainda em confirmado
        if (!pedido.pixAutoConfirmado || pedido.status !== "confirmado") {
            res.sendStatus(200);
            return;
        }
        // Consulta o MP para confirmar o status do pagamento
        const lojaSnap = await db.doc(`lojas/${pedido.lojaId}`).get();
        const mpToken = (_a = lojaSnap.data()) === null || _a === void 0 ? void 0 : _a.mpAccessToken;
        if (!mpToken) {
            res.sendStatus(200);
            return;
        }
        const mp = new mercadopago_1.MercadoPagoConfig({ accessToken: mpToken });
        const paymentClient = new mercadopago_1.Payment(mp);
        const mpPagamento = await paymentClient.get({ id: mpPaymentId });
        if (mpPagamento.status !== "approved") {
            res.sendStatus(200);
            return;
        }
        // Pagamento confirmado — move para preparo
        await pedidoDoc.ref.update({
            status: "preparo",
            pagamentoConfirmadoEm: admin.firestore.FieldValue.serverTimestamp(),
            comprovantePix: `mp_auto_${mpPaymentId}`,
        });
        // Notifica cliente no chat
        if (pedido.chatId) {
            const lojaId = pedido.lojaId || "";
            const nomeLoja = ((_b = lojaSnap.data()) === null || _b === void 0 ? void 0 : _b.nome) || "Loja";
            const nomeCliente = (pedido.nomeCliente || "").split(" ")[0];
            await db.collection("chats").doc(pedido.chatId).collection("mensagens").add({
                autorId: `loja_${lojaId}`,
                autorNome: `🤖 Rebeca | ${nomeLoja}`,
                tipo: "texto",
                texto: `✅ *Pagamento PIX confirmado!*${nomeCliente ? ` Obrigado, ${nomeCliente}!` : ""} 🎉\n\n` +
                    `Seu pedido entrou em preparo agora. 🫐\n` +
                    `Assim que ficar pronto, você receberá uma atualização aqui!`,
                criadoEm: admin.firestore.FieldValue.serverTimestamp(),
                lida: false, replyTo: null, reacoes: {}, isBot: true,
            });
            await db.doc(`chats/${pedido.chatId}`).update({
                "pedidoInfo.status": "preparo",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                [`naoLido.${pedido.userId}`]: admin.firestore.FieldValue.increment(1),
            });
            firebase_functions_1.logger.info(`MP Webhook: pedido ${pedidoDoc.id} movido para preparo — pagamento ${mpPaymentId}`);
        }
    }
    catch (e) {
        firebase_functions_1.logger.error("Erro no webhook MP:", e);
    }
    res.sendStatus(200);
});
// ─────────────────────────────────────────────────────────────
// TREINAR ROBÔ — callable: compila base de conhecimento da loja
// ─────────────────────────────────────────────────────────────
exports.treinarRobo = (0, https_1.onCall)({ secrets: ["ANTHROPIC_API_KEY"], region: "us-east1" }, async (request) => {
    var _a;
    const lojaId = (_a = request.data) === null || _a === void 0 ? void 0 : _a.lojaId;
    if (!lojaId)
        throw new https_1.HttpsError("invalid-argument", "lojaId obrigatório");
    const db = admin.firestore();
    // Marca como treinando
    await db.collection("lojas").doc(lojaId).collection("_config").doc("baseConhecimento").set({
        status: "treinando",
        iniciadoEm: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    try {
        // 1. Dados da loja
        const lojaSnap = await db.collection("lojas").doc(lojaId).get();
        const loja = lojaSnap.data() || {};
        // 2. Cardápio completo com descrições
        const tenantId = loja.tenantId || lojaId;
        const prodSnap = await db.collection(`tenants/${tenantId}/produtos`).get();
        const produtos = [];
        prodSnap.docs.forEach(d => {
            const p = d.data();
            if (p.ativo === false)
                return;
            let linha = `• ${p.nome} (R$${Number(p.preco || 0).toFixed(2).replace(".", ",")})`;
            if (p.descricao)
                linha += ` — ${p.descricao}`;
            if (p.categoria)
                linha += ` [${p.categoria}]`;
            produtos.push(linha);
        });
        // 3. Clientes mais frequentes (top 20 por qtd de pedidos, sem orderBy para evitar índice)
        const pedidosSnap = await db.collection("pedidos")
            .where("lojaId", "==", lojaId)
            .limit(200)
            .get();
        const clienteMap = {};
        pedidosSnap.docs.forEach(d => {
            const p = d.data();
            const uid = p.userId || p.uid || "";
            if (!uid)
                return;
            if (!clienteMap[uid])
                clienteMap[uid] = { nome: p.nomeCliente || "", pedidos: 0, endereco: p.endereco || "" };
            clienteMap[uid].pedidos++;
            if (p.endereco)
                clienteMap[uid].endereco = p.endereco;
        });
        const topClientes = Object.values(clienteMap)
            .sort((a, b) => b.pedidos - a.pedidos)
            .slice(0, 20)
            .map(c => `• ${c.nome} — ${c.pedidos} pedido(s), endereço: ${c.endereco || "não informado"}`);
        // 4. Monta texto para a IA resumir
        const textoParaResumir = `
LOJA: ${loja.nome || lojaId}
Endereço: ${loja.endereco || "não informado"}
Horário: ${loja.horario || "não informado"}
Taxa de entrega: ${loja.taxaEntrega ? `R$${Number(loja.taxaEntrega).toFixed(2)}` : "grátis"}
Tempo médio: ${loja.tempoEntrega || "não informado"}
PIX: ${loja.pixKey || "não configurado"}

CARDÁPIO COMPLETO:
${produtos.join("\n") || "vazio"}

CLIENTES FREQUENTES:
${topClientes.join("\n") || "nenhum ainda"}
      `.trim();
        // 5. IA resume e estrutura o conhecimento
        const client = new sdk_1.default({ apiKey: anthropicKey.value() });
        const aiResp = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2000,
            messages: [{
                    role: "user",
                    content: `Você vai criar uma base de conhecimento compacta para um robô de atendimento de delivery.
Com base nos dados abaixo, gere um texto objetivo que o robô possa usar para:
1. Conhecer todos os produtos e suas descrições
2. Saber informações operacionais da loja (horário, entrega, taxa, tempo)
3. Ter contexto geral sobre o perfil dos clientes frequentes

Seja objetivo e direto. Use até 1500 palavras. Responda em português.

DADOS:
${textoParaResumir}`,
                }],
        });
        const textBlock = aiResp.content.find(b => b.type === "text");
        const conteudo = textBlock && textBlock.type === "text" ? textBlock.text : textoParaResumir;
        // 6. Salva base de conhecimento
        await db.collection("lojas").doc(lojaId).collection("_config").doc("baseConhecimento").set({
            conteudo,
            status: "pronto",
            concluidoEm: admin.firestore.FieldValue.serverTimestamp(),
            totalProdutos: produtos.length,
            totalClientes: topClientes.length,
        });
        firebase_functions_1.logger.info(`Treinamento concluído para loja ${lojaId}`);
        return { sucesso: true, totalProdutos: produtos.length, totalClientes: topClientes.length };
    }
    catch (e) {
        await db.collection("lojas").doc(lojaId).collection("_config").doc("baseConhecimento").set({
            status: "erro",
            erro: String(e),
        }, { merge: true });
        throw new https_1.HttpsError("internal", "Erro no treinamento: " + String(e));
    }
});
// ─────────────────────────────────────────────────────────────
// GERENTE DE LOJA — callable: IA que conhece todos os dados do dia
// ─────────────────────────────────────────────────────────────
exports.gerenteLoja = (0, https_1.onCall)({ secrets: ["ANTHROPIC_API_KEY"], region: "us-east1" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Login necessário.");
    const { tenantId, lojaId, mensagem, historico = [] } = request.data;
    // Detecta pedido de PDF / relatório
    const querPdf = /\bpdf\b|relat[oó]rio|exportar|baixar|imprimir|gerar.*documento/i.test(mensagem);
    if (!tenantId || !lojaId || !(mensagem === null || mensagem === void 0 ? void 0 : mensagem.trim())) {
        throw new https_1.HttpsError("invalid-argument", "Dados insuficientes.");
    }
    const client = new sdk_1.default({ apiKey: anthropicKey.value() });
    // ── Dados da loja ──────────────────────────────────────────
    const [lojaSnap, configSnap] = await Promise.all([
        db.doc(`lojas/${lojaId}`).get(),
        db.doc(`tenants/${tenantId}/config/loja`).get(),
    ]);
    const lojaData = Object.assign(Object.assign({}, lojaSnap.data()), configSnap.data());
    const nomeLoja = lojaData.nome || "Loja";
    // ── Pedidos (todos da loja, filtra por data em memória) ────
    const pedidosSnap = await db.collection("pedidos")
        .where("tenantId", "==", tenantId)
        .get();
    const agora = new Date();
    const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0);
    const inicioOntem = new Date(inicioDia);
    inicioOntem.setDate(inicioDia.getDate() - 1);
    const inicio7Dias = new Date(inicioDia);
    inicio7Dias.setDate(inicioDia.getDate() - 7);
    const inicio14Dias = new Date(inicioDia);
    inicio14Dias.setDate(inicioDia.getDate() - 14);
    const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0);
    const todosPedidos = pedidosSnap.docs.map(d => (Object.assign({ id: d.id }, d.data())));
    const getDate = (p) => { var _a; return ((_a = p.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) ? p.createdAt.toDate() : new Date(p.createdAt); };
    const pedidosHoje = todosPedidos.filter(p => getDate(p) >= inicioDia);
    const pedidosOntem = todosPedidos.filter(p => { const t = getDate(p); return t >= inicioOntem && t < inicioDia; });
    const pedidos7Dias = todosPedidos.filter(p => getDate(p) >= inicio7Dias);
    const pedidos14Dias = todosPedidos.filter(p => { const t = getDate(p); return t >= inicio14Dias && t < inicio7Dias; });
    const pedidosMesAtual = todosPedidos.filter(p => getDate(p) >= inicioMesAtual);
    // Comparativo diário: últimos 7 dias vs semana anterior
    const naoCancel = (arr) => arr.filter(p => p.status !== "cancelado");
    const concluidos = (arr) => arr.filter(p => ["entregue", "pronto", "preparo", "confirmado"].includes(p.status));
    // Comparativo diário: últimos 7 dias vs semana anterior
    const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const comparativoDias = [];
    for (let i = 6; i >= 0; i--) {
        const diaInicio = new Date(inicioDia);
        diaInicio.setDate(inicioDia.getDate() - i);
        const diaFim = new Date(diaInicio);
        diaFim.setDate(diaInicio.getDate() + 1);
        const diaAntInicio = new Date(diaInicio);
        diaAntInicio.setDate(diaInicio.getDate() - 7);
        const diaAntFim = new Date(diaFim);
        diaAntFim.setDate(diaFim.getDate() - 7);
        const atual = todosPedidos.filter(p => { const t = getDate(p); return t >= diaInicio && t < diaFim; });
        const anterior = todosPedidos.filter(p => { const t = getDate(p); return t >= diaAntInicio && t < diaAntFim; });
        comparativoDias.push({
            label: diaInicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
            diaSemana: diasSemana[diaInicio.getDay()],
            fatAtual: concluidos(atual).reduce((s, p) => s + (p.total || 0), 0),
            fatAnterior: concluidos(anterior).reduce((s, p) => s + (p.total || 0), 0),
            pedAtual: atual.length,
            pedAnterior: anterior.length,
        });
    }
    const fat7dAtual = comparativoDias.reduce((s, d) => s + d.fatAtual, 0);
    const fat7dAnterior = concluidos(pedidos14Dias).reduce((s, p) => s + (p.total || 0), 0);
    const varSemana = fat7dAnterior > 0
        ? ((fat7dAtual - fat7dAnterior) / fat7dAnterior * 100).toFixed(0)
        : null;
    const fatHoje = concluidos(pedidosHoje).reduce((s, p) => s + (p.total || 0), 0);
    const fatOntem = concluidos(pedidosOntem).reduce((s, p) => s + (p.total || 0), 0);
    const fat7d = concluidos(pedidos7Dias).reduce((s, p) => s + (p.total || 0), 0);
    const fatMes = concluidos(pedidosMesAtual).reduce((s, p) => s + (p.total || 0), 0);
    const pedidosMesCount = pedidosMesAtual.length;
    const nomeMesAtual = agora.toLocaleDateString("pt-BR", { month: "long" });
    const mediaDiaria7d = fat7d / 7;
    const ticketMedio = concluidos(pedidosHoje).length > 0 ? fatHoje / concluidos(pedidosHoje).length : 0;
    const varOntem = fatOntem > 0 ? ((fatHoje - fatOntem) / fatOntem * 100).toFixed(0) : null;
    // Horário de pico
    const pedPorHora = {};
    pedidosHoje.forEach(p => {
        var _a;
        const h = (((_a = p.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) ? p.createdAt.toDate() : new Date(p.createdAt)).getHours();
        pedPorHora[h] = (pedPorHora[h] || 0) + 1;
    });
    const picoPair = Object.entries(pedPorHora).sort(([, a], [, b]) => b - a)[0];
    const horaPico = picoPair ? `${picoPair[0]}h (${picoPair[1]} pedidos)` : "—";
    // Produtos mais vendidos hoje
    const vendasProd = {};
    pedidosHoje.forEach(p => {
        (p.items || []).forEach((item) => {
            if (!vendasProd[item.nome])
                vendasProd[item.nome] = { nome: item.nome, qty: 0, total: 0 };
            vendasProd[item.nome].qty += item.qty || 1;
            vendasProd[item.nome].total += (item.preco || 0) * (item.qty || 1);
        });
    });
    const topProd = Object.values(vendasProd).sort((a, b) => b.qty - a.qty).slice(0, 5);
    // Pagamentos
    const pagamentos = {};
    naoCancel(pedidosHoje).forEach(p => {
        const pag = p.pagamento || "outros";
        pagamentos[pag] = (pagamentos[pag] || 0) + (p.total || 0);
    });
    // Clientes únicos hoje
    const clientesHoje = new Set(pedidosHoje.map(p => p.userId || p.uid).filter(Boolean));
    // ── Avaliações não respondidas ─────────────────────────────
    const avalSnap = await db.collection("avaliacoes")
        .where("tenantId", "==", tenantId)
        .where("lida", "==", false)
        .get();
    const avalPrivSnap = await db.collection(`tenants/${tenantId}/avaliacoesPrivadas`)
        .get();
    const avalPrivNaoRespondidas = avalPrivSnap.docs.filter(d => !d.data().respondida);
    // ── Livro Caixa (vendas balcão + retiradas) ───────────────
    const balcaoSnap = await db.collection(`tenants/${tenantId}/vendas-balcao`)
        .where("createdAt", ">=", inicioDia)
        .get();
    const balcaoHoje = balcaoSnap.docs.map(d => (Object.assign({ id: d.id }, d.data())));
    const vendasBalcao = balcaoHoje.filter((l) => l.tipo !== "retirada");
    const retiradas = balcaoHoje.filter((l) => l.tipo === "retirada");
    const entradasBalcao = vendasBalcao.reduce((s, l) => s + (l.total || 0), 0);
    const saidasBalcao = retiradas.reduce((s, l) => s + (l.total || 0), 0);
    const saldoBalcao = entradasBalcao - saidasBalcao;
    // Pagamentos balcão
    const pagBalcao = {};
    vendasBalcao.forEach((l) => {
        const pag = l.pagamento || "outros";
        pagBalcao[pag] = (pagBalcao[pag] || 0) + (l.total || 0);
    });
    // Produtos mais vendidos no balcão
    const prodBalcao = {};
    vendasBalcao.forEach((l) => {
        (l.produtos || []).forEach((item) => {
            if (!prodBalcao[item.nome])
                prodBalcao[item.nome] = { nome: item.nome, qty: 0, total: 0 };
            prodBalcao[item.nome].qty += item.qty || 1;
            prodBalcao[item.nome].total += (item.preco || 0) * (item.qty || 1);
        });
    });
    const topProdBalcao = Object.values(prodBalcao).sort((a, b) => b.qty - a.qty).slice(0, 5);
    // ── Estoque baixo ──────────────────────────────────────────
    const produtosSnap = await db.collection(`tenants/${tenantId}/produtos`).get();
    const estoqueBaixo = produtosSnap.docs
        .map(d => ({ nome: d.data().nome, estoque: d.data().estoque, controlar: d.data().controlarEstoque }))
        .filter(p => p.controlar && p.estoque !== null && p.estoque !== undefined && p.estoque <= 5);
    // ── Clientes VIP inativos ──────────────────────────────────
    const clienteFreqSnap = await db.collection("users")
        .where("lojasFavoritas", "array-contains", lojaId)
        .limit(200)
        .get();
    const vipsInativos = [];
    const limite21dias = new Date();
    limite21dias.setDate(limite21dias.getDate() - 21);
    clienteFreqSnap.docs.forEach(d => {
        var _a;
        const data = d.data();
        const ultimoPedido = ((_a = data.ultimoPedido) === null || _a === void 0 ? void 0 : _a.toDate) ? data.ultimoPedido.toDate() : null;
        if (ultimoPedido && ultimoPedido < limite21dias && (data.totalPedidos || 0) >= 5) {
            vipsInativos.push(data.nome || data.displayName || "Cliente VIP");
        }
    });
    // ── Monta contexto para a IA ──────────────────────────────
    const fmtR = (v) => `R$${v.toFixed(2).replace(".", ",")}`;
    const dataHoje = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    const horaAtual = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const contexto = [
        `📅 ${dataHoje} — ${horaAtual}`,
        "",
        "═══ VENDAS DE HOJE ═══",
        `Total de pedidos: ${pedidosHoje.length} (${concluidos(pedidosHoje).length} concluídos, ${pedidosHoje.filter(p => p.status === "cancelado").length} cancelados)`,
        `Clientes atendidos: ${clientesHoje.size}`,
        `Faturamento: ${fmtR(fatHoje)}`,
        varOntem !== null ? `Comparado a ontem (${fmtR(fatOntem)}): ${Number(varOntem) >= 0 ? "📈 +" : "📉 "}${varOntem}%` : "",
        `Média diária (7 dias): ${fmtR(mediaDiaria7d)}`,
        `Ticket médio: ${fmtR(ticketMedio)}`,
        `Horário de pico: ${horaPico}`,
        "",
        "═══ FORMAS DE PAGAMENTO ═══",
        Object.entries(pagamentos).length > 0
            ? Object.entries(pagamentos).map(([k, v]) => `${k}: ${fmtR(v)}`).join("\n")
            : "Nenhum pedido concluído ainda",
        "",
        "═══ PRODUTOS MAIS VENDIDOS HOJE ═══",
        topProd.length > 0
            ? topProd.map((p, i) => `${i + 1}. ${p.nome} — ${p.qty}x — ${fmtR(p.total)}`).join("\n")
            : "Nenhum produto vendido ainda hoje",
        "",
        "═══ ESTOQUE ═══",
        estoqueBaixo.length > 0
            ? estoqueBaixo.map(p => `⚠️ ${p.nome}: ${p.estoque <= 0 ? "ESGOTADO" : p.estoque + " restantes"}`).join("\n")
            : "✅ Estoque OK — nenhum produto crítico",
        "",
        "═══ AVALIAÇÕES ═══",
        `Avaliações públicas não respondidas: ${avalSnap.size}`,
        `Avaliações privadas não respondidas: ${avalPrivNaoRespondidas.length}`,
        "",
        "═══ CLIENTES VIP INATIVOS ═══",
        vipsInativos.length > 0
            ? `${vipsInativos.length} clientes VIP sem pedir há mais de 21 dias: ${vipsInativos.slice(0, 5).join(", ")}${vipsInativos.length > 5 ? " e mais..." : ""}`
            : "✅ Nenhum cliente VIP inativo no momento",
        "",
        "═══ LIVRO CAIXA — BALCÃO HOJE ═══",
        `Vendas no balcão: ${vendasBalcao.length} venda${vendasBalcao.length !== 1 ? "s" : ""} — ${fmtR(entradasBalcao)}`,
        retiradas.length > 0
            ? `Retiradas de caixa: ${retiradas.length} — ${fmtR(saidasBalcao)} (${retiradas.map((r) => r.descricao || "sem descrição").join(", ")})`
            : "Retiradas: nenhuma",
        `Saldo líquido do caixa: ${fmtR(saldoBalcao)}`,
        Object.entries(pagBalcao).length > 0
            ? "Pagamentos balcão: " + Object.entries(pagBalcao).map(([k, v]) => `${k}: ${fmtR(v)}`).join(" | ")
            : "",
        topProdBalcao.length > 0
            ? "Mais vendidos no balcão: " + topProdBalcao.map((p, i) => `${i + 1}. ${p.nome} (${p.qty}x)`).join(", ")
            : "",
        `Faturamento total combinado hoje (delivery + balcão): ${fmtR(fatHoje + entradasBalcao)}`,
        "",
        "═══ FATURAMENTO MENSAL ═══",
        `Mês: ${nomeMesAtual} de ${agora.getFullYear()}`,
        `Total de pedidos no mês: ${pedidosMesCount}`,
        `Faturamento acumulado no mês: ${fmtR(fatMes)}`,
        "",
        "═══ COMPARATIVO SEMANAL ═══",
        `Faturamento últimos 7 dias: ${fmtR(fat7dAtual)}`,
        varSemana !== null
            ? `Comparado à semana anterior (${fmtR(fat7dAnterior)}): ${Number(varSemana) >= 0 ? "📈 +" : "📉 "}${varSemana}%`
            : "",
        comparativoDias.map(d => `${d.diaSemana} ${d.label}: ${fmtR(d.fatAtual)} (${d.pedAtual} ped.) | semana passada: ${fmtR(d.fatAnterior)} (${d.pedAnterior} ped.)`).join("\n"),
    ].filter(l => l !== undefined).join("\n");
    const instrucaoPdf = querPdf ? `
INSTRUÇÃO ESPECIAL — O LOJISTA PEDIU UM RELATÓRIO EM PDF:
Gere um resumo executivo completo e bem estruturado com TODOS os dados disponíveis. Use este formato:

RESUMO DO DIA — [data]
━━━━━━━━━━━━━━━━━━━━━━━━

📊 VENDAS
• Total de pedidos: X
• Concluídos: X | Cancelados: X
• Clientes atendidos: X
• Faturamento: R$ X
• Ticket médio: R$ X
• Horário de pico: Xh
• Comparativo ontem: ±X%
• Média 7 dias: R$ X

💳 FORMAS DE PAGAMENTO
• [cada forma e valor]

🏆 PRODUTOS MAIS VENDIDOS
1. [produto] — Xun — R$ X
...

🏪 LIVRO CAIXA — BALCÃO
• Vendas: X (R$ X)
• Retiradas: X (R$ X) — [motivos]
• Saldo líquido: R$ X
• Pagamentos: [formas]
• Mais vendidos: [produtos]

💰 FATURAMENTO COMBINADO
• Delivery: R$ X
• Balcão: R$ X
• Total do dia: R$ X

⚠️ ESTOQUE
• [alertas ou "Tudo OK"]

⭐ AVALIAÇÕES PENDENTES
• Públicas: X | Privadas: X

🎯 CLIENTES VIP INATIVOS
• [nomes ou "Nenhum"]

💡 ANÁLISE E RECOMENDAÇÕES
• [2-3 observações estratégicas baseadas nos dados]

Use exatamente esse formato para que o PDF fique bem formatado.` : "";
    const systemPrompt = `Você é o Gerente IA da loja "${nomeLoja}" na NexFoody — um assistente de gestão inteligente e experiente.

DADOS EM TEMPO REAL:
${contexto}

SEU PERFIL:
- Responda como um gerente sênior que conhece o negócio a fundo
- Seja direto e use os dados reais acima para fundamentar respostas
- Faça alertas proativos quando detectar problemas (estoque, queda de vendas, avaliações)
- Use linguagem amigável e profissional — como um sócio de confiança
- Formate com emojis e marcadores quando ajudar na leitura
- Se o lojista perguntar algo não coberto pelos dados, seja honesto
- Português brasileiro — nunca inglês${instrucaoPdf}`;
    const messages = [
        ...historico.slice(-20),
        { role: "user", content: mensagem },
    ];
    const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages,
    });
    const resposta = response.content[0].type === "text" ? response.content[0].text : "";
    // Dados estruturados para gráficos no PDF
    const graficos = querPdf ? {
        kpis: {
            faturamento: fatHoje,
            fatOntem: fatOntem,
            pedidos: pedidosHoje.length,
            concluidos: concluidos(pedidosHoje).length,
            cancelados: pedidosHoje.filter(p => p.status === "cancelado").length,
            ticketMedio: ticketMedio,
            clientes: clientesHoje.size,
            mediaDiaria7d,
            varOntem: varOntem !== null ? Number(varOntem) : null,
            horaPico,
            fatMes,
            pedidosMesCount,
            nomeMesAtual,
        },
        vendaPorHora: Object.entries(pedPorHora)
            .map(([h, q]) => ({ hora: Number(h), qtd: q }))
            .sort((a, b) => a.hora - b.hora),
        pagamentos: Object.entries(pagamentos)
            .map(([nome, valor]) => ({ nome, valor: valor }))
            .sort((a, b) => b.valor - a.valor),
        topProdutos: topProd,
        estoqueBaixo,
        avaliacoesPublicas: avalSnap.size,
        avaliacoesPrivadas: avalPrivNaoRespondidas.length,
        vipsInativos: vipsInativos.length,
        comparativoSemanal: {
            dias: comparativoDias,
            fat7dAtual,
            fat7dAnterior,
            varSemana: varSemana !== null ? Number(varSemana) : null,
        },
    } : null;
    return {
        resposta,
        gerarPdf: querPdf,
        dadosPdf: querPdf ? {
            nomeLoja,
            dataHoje,
            horaAtual,
            conteudo: resposta,
            graficos,
        } : null,
    };
});
//# sourceMappingURL=index.js.map