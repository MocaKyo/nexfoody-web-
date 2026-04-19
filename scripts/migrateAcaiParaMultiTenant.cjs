/**
 * Script de migração: Açaí Puro Gosto → estrutura multi-tenant Nexfoody
 *
 * Run via: node scripts/migrateAcaiParaMultiTenant.js
 * (needs Firebase Admin SDK - run from functions/ dir or with service account)
 *
 * OU via Firebase CLI:
 *   cd functions && npm run shell
 *   const script = require('../scripts/migrateAcaiParaMultiTenant.js')
 *   script.migrate().then(() => process.exit())
 */

const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: "acaipedidos-f53cc",
  storageBucket: "acaipedidos-f53cc.firebasestorage.app"
});

const db = admin.firestore();
const TENANT_ID = "acaipurogosto";
const TENANT_SLUG = "acaipurogosto";

async function migrate() {
  console.log("🚀 Starting migration for tenant:", TENANT_ID);
  console.time("migration");

  try {
    // 1. Create/update lojas/{tenantId} document
    console.log("📋 Creating lojas document...");
    await db.doc(`lojas/${TENANT_SLUG}`).set({
      tenantId: TENANT_ID,
      nome: "Açaí Puro Gosto",
      slug: TENANT_SLUG,
      logo: "https://i.ibb.co/Z1R8Y83G/Whats-App-Image-2026-03-20-at-20-32-27.jpg",
      capa: "",
      categoria: "açaí",
      desc: "O melhor açaí de Bacabal 🍓",
      ativo: true,
      ownerId: "ADMIN_UID", // update after creating admin
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // 2. Migrate config/loja → tenants/{tenantId}/config/loja
    console.log("⚙️ Migrating config...");
    const configSnap = await db.doc("config/loja").get();
    if (configSnap.exists) {
      await db.doc(`tenants/${TENANT_ID}/config/loja`).set({
        ...configSnap.data(),
        tenantId: TENANT_ID,
        ativo: true,
      }, { merge: true });
      console.log("✅ config migrated");
    } else {
      console.warn("⚠️ config/loja not found, creating default...");
      await db.doc(`tenants/${TENANT_ID}/config/loja`).set({
        tenantId: TENANT_ID,
        nomeLoja: "Açaí Puro Gosto",
        logoUrl: "https://i.ibb.co/Z1R8Y83G/Whats-App-Image-2026-03-20-at-20-32-27.jpg",
        imagemCapa: "",
        horario: "09:00 - 22:00",
        whatsapp: "",
        pixKey: "",
        nomeRecebedorPix: "",
        cidadePix: "",
        pontosPorReal: 1,
        endereco: "",
        mensagemPausa: "Loja fechada neste momento",
        instagram: "",
        cardapioAtivo: true,
        pausaManual: false,
        horarioAutomatico: false,
        horarioAbertura: "09:00",
        horarioFechamento: "22:00",
        suporteAtivo: true,
        tempoMin: 30,
        tempoMax: 60,
        tema: "dark",
        ativo: true,
        chamadaCupom: ["🎉 5% de desconto!", "🔥 Cupom só hoje!", "⚡ Só hoje! Aproveita"],
        rankingPtsComentario: 15,
        rankingPtsPedido: 10,
        rankingPtsPorReal: 1,
      }, { merge: true });
    }

    // 3. Migrate produtos → tenants/{tenantId}/produtos
    console.log("🍓 Migrating produtos...");
    const produtosSnap = await db.collection("produtos").get();
    console.log(`   Found ${produtosSnap.size} produtos`);
    let migratedProdutos = 0;

    for (const prodDoc of produtosSnap.docs) {
      const prodData = prodDoc.data();

      // Copy main produto
      await db.doc(`tenants/${TENANT_ID}/produtos/${prodDoc.id}`).set({
        ...prodData,
        comentariosCount: prodData.comentariosCount || 0,
      }, { merge: true });
      migratedProdutos++;

      // Copy subcollections if they exist
      const subcollections = ["comentarios", "curtidas", "reacoes", "grupos_complementos", "stats"];
      for (const subcol of subcollections) {
        const subSnap = await db.collection(`produtos/${prodDoc.id}/${subcol}`).get();
        if (!subSnap.empty) {
          const batch = db.batch();
          subSnap.docs.forEach(subDoc => {
            const ref = db.doc(`tenants/${TENANT_ID}/produtos/${prodDoc.id}/${subcol}/${subDoc.id}`);
            batch.set(ref, subDoc.data());
          });
          await batch.commit();
        }
      }
    }
    console.log(`✅ ${migratedProdutos} produtos migrated (with subcollections)`);

    // 4. Migrate recompensas
    console.log("🎁 Migrating recompensas...");
    const recompSnap = await db.collection("recompensas").get();
    for (const doc of recompSnap.docs) {
      await db.doc(`tenants/${TENANT_ID}/recompensas/${doc.id}`).set(doc.data(), { merge: true });
    }
    console.log(`   ${recompSnap.size} recompensas migrated`);

    // 5. Migrate cupons
    console.log("🎟️ Migrating cupons...");
    const cuponsSnap = await db.collection("cupons").get();
    for (const doc of cuponsSnap.docs) {
      await db.doc(`tenants/${TENANT_ID}/cupons/${doc.id}`).set(doc.data(), { merge: true });
    }
    console.log(`   ${cuponsSnap.size} cupons migrated`);

    // 6. Migrate users that have role admin to mark ownerId
    console.log("👑 Setting store owner...");
    const adminSnap = await db.collection("users").where("role", "==", "admin").limit(1).get();
    if (!adminSnap.empty) {
      const adminUid = adminSnap.docs[0].id;
      await db.doc(`lojas/${TENANT_SLUG}`).update({ ownerId: adminUid });
      console.log(`   Owner UID set: ${adminUid}`);
    }

    console.log("");
    console.log("🎉 Migration complete!");
    console.log("");
    console.log("📌 Next steps:");
    console.log("   1. Update firestore.rules with multi-tenant rules");
    console.log("   2. Deploy updated Cloud Functions");
    console.log("   3. Test /loja/acai-puro-gosto in browser");
    console.log("   4. Update slug in RegisterLojista to match: " + TENANT_SLUG);

    console.timeEnd("migration");
  } catch (e) {
    console.error("❌ Migration failed:", e);
    console.timeEnd("migration");
    throw e;
  }
}

module.exports = { migrate };

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}