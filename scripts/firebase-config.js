import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCF6aXsXazsfXLC0mIsEY2UjFrkmNmuywA",
  authDomain: "folthy-93477.firebaseapp.com",
  projectId: "folthy-93477",
  storageBucket: "folthy-93477.firebasestorage.app",
  messagingSenderId: "533890266353",
  appId: "1:533890266353:web:c43da86a7b2c0c28346550",
  measurementId: "G-P7T82GT0CW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider, signInWithPopup, onAuthStateChanged, signOut, doc, setDoc, getDoc, onSnapshot };
