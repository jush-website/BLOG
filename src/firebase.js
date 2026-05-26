import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDYqVaI_nQg6q2y6cABw3CPigbvEEP8vIg",
  authDomain: "blog-89c5f.firebaseapp.com",
  projectId: "blog-89c5f",
  storageBucket: "blog-89c5f.firebasestorage.app",
  messagingSenderId: "952292114530",
  appId: "1:952292114530:web:9a03992b4806836080d13b",
  measurementId: "G-RLQX5SBMZZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
