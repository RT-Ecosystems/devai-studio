// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc, setDoc, getDoc, updateDoc, collection, addDoc, getDocs, orderBy, query, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Firebase Config ──
const firebaseConfig = {
  apiKey: "AIzaSyDa_HS5OEDklgP3naQ9KI7j43gv71aIq4g",
  authDomain: "devai-studio-1545d.firebaseapp.com",
  projectId: "devai-studio-1545d",
  storageBucket: "devai-studio-1545d.firebasestorage.app",
  messagingSenderId: "66229703752",
  appId: "1:66229703752:web:161715c1b05854c663747d"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ── Save user to Firestore ──
export async function saveUser(puterUser) {
  if (!puterUser?.uuid) return;
  try {
    const userRef = doc(db, "users", puterUser.uuid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: puterUser.uuid,
        name: puterUser.username || "User",
        email: puterUser.email || "",
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        settings: {
          theme: "dark",
          model: "claude-3-5-sonnet"
        }
      });
    } else {
      await updateDoc(userRef, {
        lastSeen: new Date().toISOString()
      });
    }
  } catch (e) {
    console.warn("Firebase saveUser error:", e);
  }
}

// ── Save tokens (encrypted with btoa — basic obfuscation) ──
export async function saveTokens(uid, tokens) {
  if (!uid) return;
  try {
    const encrypted = {};
    for (const [k, v] of Object.entries(tokens)) {
      encrypted[k] = v ? btoa(unescape(encodeURIComponent(v))) : "";
    }
    await setDoc(doc(db, "users", uid, "private", "tokens"), encrypted, { merge: true });
  } catch (e) {
    console.warn("Firebase saveTokens error:", e);
  }
}

// ── Load tokens ──
export async function loadTokens(uid) {
  if (!uid) return {};
  try {
    const snap = await getDoc(doc(db, "users", uid, "private", "tokens"));
    if (!snap.exists()) return {};
    const data = snap.data();
    const decrypted = {};
    for (const [k, v] of Object.entries(data)) {
      try { decrypted[k] = v ? decodeURIComponent(escape(atob(v))) : ""; }
      catch { decrypted[k] = v; }
    }
    return decrypted;
  } catch (e) {
    console.warn("Firebase loadTokens error:", e);
    return {};
  }
}

// ── Save settings ──
export async function saveSettings(uid, settings) {
  if (!uid) return;
  try {
    await setDoc(doc(db, "users", uid, "settings", "preferences"), settings, { merge: true });
  } catch (e) {
    console.warn("Firebase saveSettings error:", e);
  }
}

// ── Load settings ──
export async function loadSettings(uid) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, "users", uid, "settings", "preferences"));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("Firebase loadSettings error:", e);
    return null;
  }
}

// ── Save chat history ──
export async function saveChatHistory(uid, chatId, messages) {
  if (!uid || !chatId) return;
  try {
    await setDoc(doc(db, "users", uid, "chats", chatId), {
      messages,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn("Firebase saveChatHistory error:", e);
  }
}

// ── Load chat list ──
export async function loadChatList(uid) {
  if (!uid) return [];
  try {
    const q = query(
      collection(db, "users", uid, "chats"),
      orderBy("updatedAt", "desc"),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("Firebase loadChatList error:", e);
    return [];
  }
}

// ── Save project files ──
export async function saveProjectFiles(uid, projectId, files) {
  if (!uid) return;
  try {
    await setDoc(doc(db, "users", uid, "projects", projectId), {
      files,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn("Firebase saveProjectFiles error:", e);
  }
}

// ── Load project files ──
export async function loadProjectFiles(uid, projectId) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, "users", uid, "projects", projectId));
    return snap.exists() ? snap.data().files : null;
  } catch (e) {
    console.warn("Firebase loadProjectFiles error:", e);
    return null;
  }
}

export { db };
    
