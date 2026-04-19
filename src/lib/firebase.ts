import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCRQa_hjAoSKa5RIDKJMqVdicYQtnILfFI",
  authDomain: "acaipedidos-f53cc.firebaseapp.com",
  projectId: "acaipedidos-f53cc",
  storageBucket: "acaipedidos-f53cc.firebasestorage.app",
  messagingSenderId: "1032177722630",
  appId: "1:1032177722630:web:81c13975993b8ee5482a87",
  measurementId: "G-CB89B72PNH"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-east1");
export default app;