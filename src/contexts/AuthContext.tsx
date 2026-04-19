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
} from "firebase/auth";
import { doc, onSnapshot, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { UserData } from "../types/tenant";

interface AuthContextValue {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  isAdmin: boolean;
  isLojista: boolean;
  register: (nome: string, email: string, telefone: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userData: null,
  loading: true,
  isAdmin: false,
  isLojista: false,
  register: async () => {},
  login: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
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

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = async () => {
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
  };

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  const isAdmin = userData?.role === "admin";
  const isLojista = userData?.role === "lojista";

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,
        isAdmin,
        isLojista,
        register,
        login,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}