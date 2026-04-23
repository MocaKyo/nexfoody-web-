// src/lib/pontos.ts
// Helper centralizado para gerenciar pontos de ranking por loja
import { updateDoc, doc, increment, setDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Adiciona pontos de ranking para um usuário em uma loja específica.
 * Atualiza:
 *  - users/{uid}.rankingPts (global)
 *  - tenants/{slug}/fans/{uid}.pts (por loja)
 *  - users/{uid}.pts (pontos de fidelidade, se aplicável)
 */
export async function addFanPoints(
  uid: string,
  slug: string,
  pontos: number,
  opts?: { pontosFidelidade?: number }
) {
  try {
    const promises: Promise<unknown>[] = [];

    // 1. Incrementa pts global do ranking
    promises.push(updateDoc(doc(db, "users", uid), {
      rankingPts: increment(pontos),
    }));

    // 2. Incrementa pts do fã na loja (se slug fornecido)
    if (slug) {
      promises.push(
        setDoc(doc(db, `tenants/${slug}/fans/${uid}`), {
          uid,
          pts: increment(pontos),
          updatedAt: Date.now(),
        }, { merge: true })
      );
    }

    // 3. Incrementa pontos de fidelidade (se fornecido)
    if (opts?.pontosFidelidade && opts.pontosFidelidade > 0) {
      promises.push(updateDoc(doc(db, "users", uid), {
        pontos: increment(opts.pontosFidelidade),
      }));
    }

    await Promise.all(promises);
  } catch (e) {
    console.warn("addFanPoints error:", e);
  }
}

/**
 * Subtrai pontos (quando cliente usa pontos para desconto)
 */
export async function subtractFanPoints(uid: string, pontos: number, slug?: string) {
  try {
    const promises: Promise<unknown>[] = [];

    // 1. Decrementa pts global do ranking
    promises.push(updateDoc(doc(db, "users", uid), {
      rankingPts: increment(-pontos),
      pontos: increment(-pontos),
    }));

    // 2. Decrementa pts do fã na loja (se slug fornecido)
    if (slug) {
      promises.push(
        setDoc(doc(db, `tenants/${slug}/fans/${uid}`), {
          uid,
          pts: increment(-pontos),
          updatedAt: Date.now(),
        }, { merge: true })
      );
    }

    await Promise.all(promises);
  } catch (e) {
    console.warn("subtractFanPoints error:", e);
  }
}

/**
 * Retorna os pontos do fã em uma loja específica
 */
export async function getFanPoints(uid: string, slug: string): Promise<number> {
  try {
    const snap = await getDoc(doc(db, `tenants/${slug}/fans/${uid}`));
    return snap.data()?.pts || 0;
  } catch {
    return 0;
  }
}
