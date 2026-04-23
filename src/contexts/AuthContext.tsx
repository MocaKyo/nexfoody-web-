import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  onAuthStateChanged,
  updateProfile,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  fetchSignInMethodsForEmail,
  updateCurrentUser,
  signOut,
} from "firebase/auth";
import { doc, onSnapshot, setDoc, serverTimestamp, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { UserData } from "../types/tenant";

interface AuthContextValue {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  isAdmin: boolean;
  isLojista: boolean;
  isFuncionario: boolean;
  register: (nome: string, email: string, telefone: string, password: string) => Promise<void>;
  login: (email: string, password: string, redirectTo?: string) => Promise<void>;
  loginWithGoogle: (redirectTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  criarFuncionario: (nome: string, email: string, telefone: string, tenantId: string, papel: string, ownerUid: string, senha: string, endereco?: string, contatosEmergencia?: Array<{ nome: string; telefone: string; tipo: string }>) => Promise<{ jaExistia: boolean; uid?: string }>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userData: null,
  loading: true,
  isAdmin: false,
  isLojista: false,
  isFuncionario: false,
  register: async () => {},
  login: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
  criarFuncionario: async () => ({ jaExistia: false }),
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let snapUnsub: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // Limpa listener anterior do Firestore ao trocar de conta
      if (snapUnsub) { snapUnsub(); snapUnsub = null; }

      setUser(firebaseUser);

      if (firebaseUser) {
        snapUnsub = onSnapshot(
          doc(db, "users", firebaseUser.uid),
          (snap) => {
            setUserData(snap.exists() ? ({ uid: snap.id, ...snap.data() } as UserData) : null);
            setLoading(false); // só marca pronto após receber dados do Firestore
          }
        );
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (snapUnsub) snapUnsub();
    };
  }, []);

  const register = async (nome: string, email: string, telefone: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: nome });
    await setDoc(doc(db, "users", cred.user.uid), {
      nome,
      email,
      telefone,
      pontos: 0,
      rankingPts: 0,
      cashback: 0,
      role: "cliente",
      following: [],
      favoritos: [],
      createdAt: serverTimestamp(),
    });
  };

  const login = async (email: string, password: string, redirectTo?: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    if (redirectTo) {
      window.location.href = redirectTo;
    }
  };

  const loginWithGoogle = async (redirectTo?: string) => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);

    // Check if user doc already exists
    const userSnap = await getDoc(doc(db, "users", cred.user.uid));
    if (!userSnap.exists()) {
      // First login with Google — create minimal user doc
      await setDoc(doc(db, "users", cred.user.uid), {
        nome: cred.user.displayName || "Usuário Google",
        email: cred.user.email || "",
        telefone: "",
        photoURL: cred.user.photoURL || null,
        pontos: 0,
        rankingPts: 0,
        cashback: 0,
        role: "cliente",
        following: [],
        favoritos: [],
        createdAt: serverTimestamp(),
      });
    }
    if (redirectTo) {
      window.location.href = redirectTo;
    }
  };

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  const criarFuncionario = async (nome: string, email: string, telefone: string, tenantId: string, papel: string, ownerUid: string, senha: string, endereco?: string, contatosEmergencia?: Array<{ nome: string; telefone: string; tipo: string }>) => {
    const internalEmail = `func_${Date.now()}@nexfoody.internal`;
    const originalUser = auth.currentUser;
    console.log("[criarFuncionario] ini", { nome, telefone, tenantId, papel, originalUser: originalUser?.uid });
    try {
      const cred = await createUserWithEmailAndPassword(auth, internalEmail, "00" + senha);
      console.log("[criarFuncionario] auth created", cred.user.uid);
      await updateProfile(cred.user, { displayName: nome });
      await setDoc(doc(db, "users", cred.user.uid), {
        nome,
        email,
        telefone,
        emailFirebase: internalEmail,
        pinHash: senha,
        pontos: 0,
        rankingPts: 0,
        cashback: 0,
        role: "funcionario",
        following: [],
        favoritos: [],
        tenantId,
        papel,
        criadoPor: ownerUid,
        createdAt: serverTimestamp(),
      });
      console.log("[criarFuncionario] firestore saved");
      await signOut(auth);
      console.log("[criarFuncionario] signed out func");
      if (originalUser) {
        await updateCurrentUser(auth, originalUser);
        console.log("[criarFuncionario] restored lojista", originalUser.uid);
      }
      return { jaExistia: false, uid: cred.user.uid };
    } catch (err: unknown) {
      console.error("[criarFuncionario] ERROR", err);
      if (originalUser) await updateCurrentUser(auth, originalUser).catch(() => {});
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("email-already-in-use") || errMsg.includes("INVALID_EMAIL")) {
        const existingQ = query(collection(db, "users"), where("email", "==", email));
        const existingSnap = await getDocs(existingQ);
        if (!existingSnap.empty) {
          await updateDoc(doc(db, "users", existingSnap.docs[0].id), {
            tenantId,
            papel,
            criadoPor: ownerUid,
            role: "funcionario",
            telefone: telefone || existingSnap.docs[0].data().telefone,
            pinHash: senha,
          });
          return { jaExistia: true, uid: existingSnap.docs[0].id };
        }
      }
      throw err;
    }
  };

  const isAdmin = userData?.role === "admin";
  const isLojista = userData?.role === "lojista";
  const isFuncionario = userData?.role === "funcionario";

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,
        isAdmin,
        isLojista,
        isFuncionario,
        register,
        login,
        loginWithGoogle,
        logout,
        criarFuncionario,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}