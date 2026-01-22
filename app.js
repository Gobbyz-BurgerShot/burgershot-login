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

function setInServicePill(active) {
  const t = document.getElementById("inServiceText");
  if (!t) return;
  t.textContent = active ? "Sì" : "No";
  t.style.color = active ? "#00ff88" : "#e10600";
}

/* --------- HELPERS --------- */
function msToHMS(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function hoursToHHMM(hours) {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, "0")} Ore`;
}

/* --------- FIRESTORE MODEL ---------
utenti/{id}
  nome, ruolo, pagaOraria
  totalHours, totalSales, totalPersonalEarnings
  inService, inServiceStartMs
  subcollections: turni, fatture
presence/{id} -> {nome, active, startMs, updatedAt}
----------------------------------- */

async function ensureUserDoc(session) {
  const ref = doc(db, "utenti", session.id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      nome: session.username,
      ruolo: "dipendente",
      pagaOraria: 20,
      totalHours: 0,
      totalSales: 0,
      totalPersonalEarnings: 0,
      inService: false,
      inServiceStartMs: null,
      createdAt: Date.now()
    });
  } else {
    const data = snap.data();
    if (data?.nome !== session.username) await updateDoc(ref, { nome: session.username });
  }

  return (await getDoc(ref)).data();
}

async function setPresence(session, active, startMs = null) {
  await setDoc(doc(db, "presence", session.id), {
    nome: session.username,
    active,
    startMs: startMs || null,
    updatedAt: Date.now()
  }, { merge: true });
}

/* --------- INIT --------- */
(async function main() {
  const token = getAccessTokenFromHash();
  if (token) {
    try {
      const u = await fetchDiscordUser(token);
      saveSession(u);
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch {
      alert("Login Discord fallito. Controlla Redirect URI e riprova.");
      window.location.href = "./index.html";
      return;
    }
  }

  requireAuthOrRedirect();
  const session = getSession();
  if (!session) return;

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  setAvatarUI(session);

  const me = await ensureUserDoc(session);

  const activeLocal = localStorage.getItem("in_service") === "1";
  setInServicePill(me?.inService ?? activeLocal);

  const page = location.pathname.split("/").pop();
  if (page === "timbri.html") await initTimbri(session);
  if (page === "fatture.html") await initFatture(session);
  if (page === "home.html" || page === "") await initHome(session);
})();

/* --------- HOME --------- */
async function initHome(session) {
  await renderMyTotal(session);
  await renderLeaderboard();
  await renderPresence();
}

async function renderMyTotal(session) {
  const ref = doc(db, "utenti", session.id);
  const snap = await getDoc(ref);
  const total = Number(snap.data()?.totalHours || 0);
  const el = document.getElementById("myTotal");
  if (el) el.textContent = hoursToHHMM(total);
}

async function renderLeaderboard() {
  const body = document.getElementById("leaderboardBody");
  if (!body) return;

  const snap = await getDocs(query(collection(db, "utenti"), orderBy("totalHours", "desc"), limit(20)));
  if (snap.empty) {
    body.innerHTML = `<tr><td class="muted">Nessun dato</td><td></td></tr>`;
    return;
  }

  body.innerHTML = "";
  snap.forEach(d => {
    const x = d.data();
    body.insertAdjacentHTML("beforeend",
      `<tr><td>${x.nome || "Sconosciuto"}</td><td>${hoursToHHMM(Number(x.totalHours||0))}</td></tr>`
    );
  });
}

async function renderPresence() {
  const body = document.getElementById("presenceBody");
  if (!body) return;

  const snap = await getDocs(collection(db, "presence"));
  if (snap.empty) {
    body.innerHTML = `<tr><td class="muted">Nessuno</td><td></td></tr>`;
    return;
  }

  const list = [];
  snap.forEach(d => list.push({ id:d.id, ...d.data() }));
  list.sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0));

  body.innerHTML = "";
  for (const p of list.slice(0, 30)) {
    const stato = p.active
      ? `<span style="color:#00ff88;font-weight:950;">IN SERVIZIO</span>`
      : `<span style="color:#e10600;font-weight:950;">OFF</span>`;
    body.insertAdjacentHTML("beforeend",
      `<tr><td>${p.nome || p.id}</td><td>${stato}</td></tr>`
    );
  }
}

/* --------- TIMBRI --------- */
async function initTimbri(session) {
  const startBtn = document.getElementById("btnStart");
  const stopBtn = document.getElementById("btnStop");
  const timerText = document.getElementById("timerText");

  let runningStart = Number(localStorage.getItem("shift_start_ms") || "0");
  runningStart = runningStart > 0 ? runningStart : null;

  function tick() {
    if (!timerText) return;
    if (!runningStart) timerText.textContent = "00:00:00";
    else timerText.textContent = msToHMS(Date.now() - runningStart);
  }
  setInterval(tick, 1000);
  tick();

  setInServicePill(!!runningStart);

  if (startBtn) startBtn.addEventListener("click", async () => {
    if (runningStart) return alert("Sei già in servizio.");
    runningStart = Date.now();
    localStorage.setItem("shift_start_ms", String(runningStart));
    localStorage.setItem("in_service", "1");
    setInServicePill(true);

    await updateDoc(doc(db, "utenti", session.id), { inService: true, inServiceStartMs: runningStart });
    await setPresence(session, true, runningStart);
  });

  if (stopBtn) stopBtn.addEventListener("click", async () => {
    if (!runningStart) return alert("Non sei in servizio.");
    const endMs = Date.now();
    const hours = (endMs - runningStart) / 3600000;

    await addDoc(collection(db, "utenti", session.id, "turni"), {
      startMs: runningStart,
      endMs,
      ore: hours,
      createdAt: Date.now()
    });

    await updateDoc(doc(db, "utenti", session.id), {
      totalHours: increment(hours),
      inService: false,
      inServiceStartMs: null
    });

    runningStart = null;
    localStorage.removeItem("shift_start_ms");
    localStorage.setItem("in_service", "0");
    setInServicePill(false);
    await setPresence(session, false, null);

    alert(`Timbro salvato: ${hoursToHHMM(hours)}`);
    await renderMyShifts(session);
  });

  await renderMyShifts(session);
}

async function renderMyShifts(session) {
  const body = document.getElementById("myShiftsBody");
  if (!body) return;

  const snap = await getDocs(query(
    collection(db, "utenti", session.id, "turni"),
    orderBy("startMs", "desc"),
    limit(15)
  ));

  if (snap.empty) {
    body.innerHTML = `<tr><td class="muted">Nessun timbro</td><td></td><td></td><td></td></tr>`;
    return;
  }

  body.innerHTML = "";
  snap.forEach(d => {
    const x = d.data();
    const start = new Date(x.startMs);
    const end = new Date(x.endMs);
    const date = start.toLocaleDateString("it-IT");
    const st = start.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"});
    const en = end.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"});
    body.insertAdjacentHTML("beforeend",
      `<tr><td>${date}</td><td>${hoursToHHMM(Number(x.ore||0))}</td><td>${st}</td><td>${en}</td></tr>`
    );
  });
}

/* --------- FATTURE (anonime + menu + percentuali) --------- */
async function initFatture(session) {
  const sel = document.getElementById("fProdotto");
  const qtyWrap = document.getElementById("qtyWrap");
  const qtyInput = document.getElementById("fQty");
  const ruoloEl = document.getElementById("fRuolo");
  const percEl = document.getElementById("fPerc");
  const btn = document.getElementById("btnAddFattura");
  const hint = document.getElementById("fatturaHint");

  const meSnap = await getDoc(doc(db, "utenti", session.id));
  const me = meSnap.data() || {};
  const ruolo = me.ruolo || "dipendente";
  const perc = percentByRole(ruolo);

  if (ruoloEl) ruoloEl.value = ruolo;
  if (percEl) percEl.value = `${perc}%`;

  function updateQtyVisibility() {
    const key = sel?.value;
    const item = key ? MENU_ITEMS[key] : null;
    const needsQty = !!item?.needsQty;
    if (qtyWrap) qtyWrap.style.display = needsQty ? "block" : "none";
    if (qtyInput && !needsQty) qtyInput.value = "1";
  }

  if (sel) sel.addEventListener("change", updateQtyVisibility);
  updateQtyVisibility();

  if (btn) btn.addEventListener("click", async () => {
    const key = sel?.value;
    if (!key || !MENU_ITEMS[key]) {
      if (hint) hint.textContent = "Seleziona un prodotto.";
      return;
    }

    const item = MENU_ITEMS[key];
    let qty = 1;

    if (item.needsQty) {
      qty = Number(qtyInput?.value || 1);
      if (!Number.isFinite(qty) || qty < 1) {
        if (hint) hint.textContent = "Quantità non valida.";
        return;
      }
      qty = Math.floor(qty);
    }

    const importo = item.price * qty;
    const guadagno = importo * (perc / 100);

    await addDoc(collection(db, "utenti", session.id, "fatture"), {
      prodottoKey: key,
      prodotto: item.name,
      qty,
      unitPrice: item.price,
      importo,
      percentuale: perc,
      guadagnoDipendente: guadagno,
      createdAt: Date.now()
    });

    await updateDoc(doc(db, "utenti", session.id), {
      totalSales: increment(importo),
      totalPersonalEarnings: increment(guadagno)
    });

    if (hint) hint.textContent =
      `Salvata: ${item.name} x${qty} — Totale $${importo.toLocaleString("it-IT")} — Guadagno $${guadagno.toLocaleString("it-IT")}`;

    if (sel) sel.value = "";
    if (qtyInput) qtyInput.value = "1";
    updateQtyVisibility();

    await renderMyBills(session);
    await renderPie();
  });

  await renderMyBills(session);
  await renderPie();
}

async function renderMyBills(session) {
  const body = document.getElementById("fattureBody");
  if (!body) return;

  const snap = await getDocs(query(
    collection(db, "utenti", session.id, "fatture"),
    orderBy("createdAt", "desc"),
    limit(120)
  ));

  if (snap.empty) {
    body.innerHTML = `<tr><td class="muted">Nessuna fattura</td><td></td><td></td><td></td><td></td></tr>`;
    return;
  }

  body.innerHTML = "";
  snap.forEach(d => {
    const x = d.data();
    const dt = new Date(x.createdAt || Date.now());
    const data = dt.toLocaleString("it-IT", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
    const prod = x.prodotto || "—";
    const qty = Number(x.qty || 1);
    const tot = `$${Number(x.importo||0).toLocaleString("it-IT")}`;
    const g = `$${Number(x.guadagnoDipendente||0).toLocaleString("it-IT")}`;

    body.insertAdjacentHTML("beforeend",
      `<tr><td>${data}</td><td>${prod}</td><td>${qty}</td><td>${tot}</td><td>${g}</td></tr>`
    );
  });
}

async function renderPie() {
  const canvas = document.getElementById("pieChart");
  if (!canvas || !window.Chart) return;

  const snap = await getDocs(collection(db, "utenti"));
  const labels = [];
  const values = [];

  snap.forEach(d => {
    const x = d.data();
    const v = Number(x.totalSales || 0);
    if (v > 0) {
      labels.push(x.nome || "Sconosciuto");
      values.push(v);
    }
  });

  const colors = [
    "#e10600","#ffffff","#1f4fd8","#9ca3af","#7c0000",
    "#2b6fff","#c7c7c7","#ff3b30","#4f7cff","#a3a3a3"
  ];

  if (window.__pie) window.__pie.destroy();
  window.__pie = new Chart(canvas, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map((_,i)=>colors[i%colors.length]),
        borderColor: "rgba(0,0,0,.35)",
        borderWidth: 2
      }]
    },
    options: { plugins: { legend: { labels: { color: "white" } } } }
  });
}
