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
Object.defineProperty(exports, "__esModule", { value: true });
exports.onNovoPedido = exports.alertarInatividade = exports.resumoMensal = void 0;
// NexFoody Cloud Functions
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-functions/v2/firestore");
const firebase_functions_1 = require("firebase-functions");
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
// 3. NOVO PEDIDO — trigger em tempo real
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
//# sourceMappingURL=index.js.map