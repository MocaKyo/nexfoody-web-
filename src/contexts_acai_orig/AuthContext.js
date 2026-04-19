// src/contexts/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // onSnapshot mantém userData sempre atualizado em tempo real
        const snapUnsub = onSnapshot(doc(db, "users", firebaseUser.uid), snap => {
          if (snap.exists()) setUserData(snap.data());
          else setUserData(null);
        });
        setLoading(false);
        return snapUnsub;
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const register = async (nome, email, password, telefone) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: nome });
    const data = {
      nome,
      email,
      telefone: telefone || "",
      pontos: 0,
      role: "cliente",
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, "users", cred.user.uid), data);
    setUserData(data);
    return cred;
  };

  const login = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    if (snap.exists()) setUserData(snap.data());
    return cred;
  };

  const logout = () => signOut(auth);

  const isAdmin = userData?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, userData, loading, register, login, logout, isAdmin, setUserData }}>
      {children}
    </AuthContext.Provider>
  );
}
