import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc,
  collection, addDoc, getDocs, query, orderBy, limit,
  increment
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

/** FIREBASE CONFIG (tuo) */
const firebaseConfig = {
  apiKey: "AIzaSyBVP1WmqOEjC5HmuywzrYNRFQy0oA1dUiU",
  authDomain: "gestionale-azienda-287f6.firebaseapp.com",
  projectId: "gestionale-azienda-287f6",
  storageBucket: "gestionale-azienda-287f6.firebasestorage.app",
  messagingSenderId: "321211138123",
  appId: "1:321211138123:web:a28a55385a9ce81b874dce",
  measurementId: "G-FG6Y25BZQP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* =========================
 *  MENU + PREZZI (Burger Shot)
 * ========================= */
const MENU_ITEMS = {
  "BM_1x1":   { name: "Burger Menu 1x1", price: 800 },
  "BM_2x2":   { name: "Burger Menu 2x2", price: 1400 },
  "BM_3x3":   { name: "Burger Menu 3x3", price: 1700 },
  "BM_4x4":   { name: "Burger Menu 4x4", price: 2100 },
  "BM_5x5":   { name: "Burger Menu 5x5", price: 2700 },
  "BM_10x10": { name: "Burger Menu 10x10", price: 5100 },
  "BM_20x20": { name: "Burger Menu 20x20", price: 10500 },
  "BM_50x50": { name: "Burger Menu 50x50", price: 25500 },
  "BM_100x100": { name: "Burger Menu 100x100", price: 42500 },
  "BM_200x200": { name: "Burger Menu 200x200", price: 80500 },
  "BM_500x500": { name: "Burger Menu 500x500", price: 200500 },

  "AC_HAMBURGER":   { name: "Hamburger", price: 210 },
  "AC_BURGER_MAXI": { name: "Burger Maxi", price: 410 },
  "AC_BURGER_DOPP": { name: "Burger Dopp", price: 210 },
  "AC_BURGER_GLO":  { name: "Burger Glo", price: 310 },
  "AC_BURGER_SEMP": { name: "Burger Semp", price: 310 },
  "AC_WRAP":        { name: "Wrap", price: 260 },
  "AC_PATATINE":    { name: "Patatine", price: 210 },
  "AC_PATATINE_MC": { name: "Patatine MC", price: 310 },
  "AC_PATATINE_G":  { name: "Patatine G", price: 310 },
  "AC_GELATO":      { name: "Gelato", price: 260 },
  "AC_METEORITE":   { name: "Meteorite", price: 260 },
  "AC_JUMBO":       { name: "Jumbo", price: 410 },
  "AC_NOODLE":      { name: "Noodle", price: 160 },
  "AC_HOTDOG":      { name: "Hotdog", price: 210 },
  "AC_CIAMABELLA":  { name: "Ciambella", price: 160 },
  "AC_MELA":        { name: "Mela", price: 160 },
  "AC_BANANA":      { name: "Banana", price: 160 },
  "AC_ALCOLICO":    { name: "Tutti gli alcolici", price: 2000 },

  "GV_GRATTA":      { name: "Gratta e Vinci", price: 1750, needsQty: true }
};

function percentByRole(roleRaw) {
  const r = (roleRaw || "").toLowerCase().trim();
  if (r === "tirocinante") return 25;
  if (r === "dipendente esperto") return 33;
  return 28; // dipendente default
}

/* --------- DISCORD SESSION --------- */
function getAccessTokenFromHash() {
  const h = window.location.hash || "";
  if (!h.startsWith("#")) return null;
  const params = new URLSearchParams(h.slice(1));
  return params.get("access_token");
}

async function fetchDiscordUser(token) {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Discord API error");
  return await res.json();
}

function saveSession(u) {
  localStorage.setItem("discord_id", u.id);
  localStorage.setItem("discord_name", u.username);
  localStorage.setItem("discord_avatar", u.avatar || "");
}

function getSession() {
  const id = localStorage.getItem("discord_id");
  const username = localStorage.getItem("discord_name");
  const avatar = localStorage.getItem("discord_avatar");
  if (!id || !username) return null;
  return { id, username, avatar };
}

function logout() {
  localStorage.removeItem("discord_id");
  localStorage.removeItem("discord_name");
  localStorage.removeItem("discord_avatar");
  localStorage.removeItem("shift_start_ms");
  localStorage.removeItem("in_service");
  window.location.href = "./index.html";
}

function requireAuthOrRedirect() {
  const page = location.pathname.split("/").pop();
  if (page === "index.html" || page === "") return;
  if (!getSession()) window.location.href = "./index.html";
}

function setAvatarUI(session) {
  const el = document.getElementById("avatar");
  if (!el) return;
  if (session.avatar) {
    const url = `https://cdn.discordapp.com/avatars/${session.id}/${session.avatar}.png?size=128`;
    el.style.backgroundImage = `url('${url}')`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
  }
}

function setIn
