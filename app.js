import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc,
  collection, addDoc, getDocs, query, orderBy, limit,
  increment, deleteDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

/** FIREBASE CONFIG (il tuo) */
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

function money(n) {
  return `$${Number(n || 0).toLocaleString("it-IT")}`;
}

/* --------- MENU --------- */
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
  "AC_ALCOLICO":    { name: "Alcolico (qualsiasi)", price: 2000 },

  "GV_GRATTA":      { name: "Gratta e Vinci", price: 1750 }
};


/* --------- PERCENTUALI GUADAGNO (CONFIGURABILI) --------- */
const DEFAULT_ROLE_PERCENTS = {
  "tirocinante": 25,
  "dipendente": 28,
  "dipendente esperto": 33,
  "direttore": 0,
  "licenziato": 0
};
let ROLE_PERCENTS_CACHE = null;

async function loadRolePercents() {
  try {
    const ref = doc(db, "config", "role_percents");
    const snap = await getDoc(ref);
    const data = snap.exists() ? (snap.data() || {}) : {};
    // merge defaults + remote
    ROLE_PERCENTS_CACHE = { ...DEFAULT_ROLE_PERCENTS };
    for (const k of Object.keys(DEFAULT_ROLE_PERCENTS)) {
      if (data[k] !== undefined && data[k] !== null && data[k] !== "") {
        ROLE_PERCENTS_CACHE[k] = Number(data[k]);
      }
    }
    return ROLE_PERCENTS_CACHE;
  } catch (e) {
    ROLE_PERCENTS_CACHE = { ...DEFAULT_ROLE_PERCENTS };
    return ROLE_PERCENTS_CACHE;
  }
}

async function ensureRolePercentsLoaded() {
  if (ROLE_PERCENTS_CACHE) return ROLE_PERCENTS_CACHE;
  return await loadRolePercents();
}

function clampPercent(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}
function percentByRole(roleRaw) {
  const r = (roleRaw || "").toLowerCase().trim();
  const map = ROLE_PERCENTS_CACHE || DEFAULT_ROLE_PERCENTS;
  if (map[r] !== undefined) return Number(map[r]) || 0;
  // fallback
  return Number(map["dipendente"]) || 28;
}

/* --------- USER DOC --------- */
async function ensureUserDoc(session) {
  const ref = doc(db, "utenti", session.id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      nome: session.username,
      ruolo: "dipendente",
      pagaOraria: 0,
      totalHours: 0,
      totalSales: 0,
      totalPersonalEarnings: 0,
      totalInvoices: 0,
      inService: false,
      inServiceStartMs: null,
      createdAt: Date.now()
    });
  } else {
    const data = snap.data() || {};
    const patch = {};
    if (data?.nome !== session.username) patch.nome = session.username;

    // backfill fields for older users
    if (data?.pagaOraria === undefined) patch.pagaOraria = 0;
    if (data?.totalInvoices === undefined) patch.totalInvoices = 0;

    if (Object.keys(patch).length) await updateDoc(ref, patch);
  }

  return (await getDoc(ref)).data();
}

function setAdminLinkVisible(isDirector) {
  const link = document.getElementById("adminLink");
  if (!link) return;
  link.style.display = isDirector ? "" : "none";
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
  await loadRolePercents(); // carica % guadagno per grado
  const roleNow = (me?.ruolo || "").toLowerCase().trim();
  if (roleNow === "licenziato") {
    alert("Accesso negato: utente licenziato.");
    logout();
    return;
  }
  const isDirector = (me?.ruolo || "").toLowerCase().trim() === "direttore";
  setAdminLinkVisible(isDirector);

  const activeLocal = localStorage.getItem("in_service") === "1";
  setInServicePill(me?.inService ?? activeLocal);

  const page = location.pathname.split("/").pop();
  if (page === "timbri.html") await initTimbri(session);
  if (page === "fatture.html") await initFatture(session, me);
  if (page === "gestionale.html") await initGestionale(session, me);
  if (page === "home.html" || page === "") await initHome(session);
})();

/* --------- HOME --------- */
async function initHome(session) {
  // Home: tempo totale rimosso (ora in Timbri)
  await renderLeaderboard();        // tempo dipendenti (filtrato <10 min)
  await renderPresence();           // solo chi è in servizio
  await renderTopInvoices();        // medaglie + top
  await renderInvoicesChart();      // grafico n° fatture
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
  body.innerHTML = "";
  snap.forEach(d => {
    const x = d.data();
    const hrs = Number(x.totalHours||0);
    if (hrs * 60 < 10) return; // nascondi < 10 minuti totali
    body.insertAdjacentHTML("beforeend",
      `<tr><td>${x.nome || "Sconosciuto"}</td><td>${hoursToHHMM(hrs)}</td></tr>`
    );
  });
  if (!body.innerHTML.trim()) {
    body.innerHTML = `<tr><td class="muted">Nessun dato (min. 10 minuti)</td><td></td></tr>`;
  }
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
  for (const p of list.filter(x=>x.active).slice(0, 30)) {
    const stato = `<span class="pill on">IN SERVIZIO</span>`;
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

    await updateDoc(doc(db, "utenti", session.id), {
      inService: true,
      inServiceStartMs: runningStart
    });

    await setDoc(doc(db, "presence", session.id), {
      nome: session.username,
      active: true,
      startMs: runningStart,
      updatedAt: Date.now()
    }, { merge: true });
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

    await setDoc(doc(db, "presence", session.id), {
      nome: session.username,
      active: false,
      startMs: null,
      updatedAt: Date.now()
    }, { merge: true });

    alert(`Timbro salvato: ${hoursToHHMM(hours)}`);
    await renderMyShifts(session);
  });

  await renderMyShifts(session);
  await renderMyTotal(session);
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

/* --------- FATTURE --------- */
async function initFatture(session, me) {
  const sel = document.getElementById("fProdotto");
  const qtyInput = document.getElementById("fQty");
  const unitEl = document.getElementById("fUnit");
  const totEl = document.getElementById("fTot");
  const btn = document.getElementById("btnAddFattura");
  const hint = document.getElementById("fatturaHint");
  const minus = document.getElementById("qtyMinus");
  const plus = document.getElementById("qtyPlus");

  const perc = percentByRole(me?.ruolo || "dipendente");

  function clampQty(v) {
    let n = Number(v);
    if (!Number.isFinite(n) || n < 1) n = 1;
    return Math.floor(n);
  }

  function recalc() {
    const key = sel?.value;
    const item = key ? MENU_ITEMS[key] : null;

    const qty = clampQty(qtyInput?.value || 1);
    if (qtyInput) qtyInput.value = String(qty);

    if (!item) {
      if (unitEl) unitEl.value = "—";
      if (totEl) totEl.value = "—";
      return;
    }

    const total = item.price * qty;
    if (unitEl) unitEl.value = money(item.price);
    if (totEl) totEl.value = money(total);
  }

  if (sel) sel.addEventListener("change", recalc);
  if (qtyInput) qtyInput.addEventListener("input", recalc);

  if (minus) minus.addEventListener("click", () => {
    const q = clampQty(qtyInput?.value || 1);
    if (qtyInput) qtyInput.value = String(Math.max(1, q - 1));
    recalc();
  });

  if (plus) plus.addEventListener("click", () => {
    const q = clampQty(qtyInput?.value || 1);
    if (qtyInput) qtyInput.value = String(q + 1);
    recalc();
  });

  recalc();

  if (btn) btn.addEventListener("click", async () => {
    const key = sel?.value;
    const item = key ? MENU_ITEMS[key] : null;
    if (!item) {
      if (hint) hint.textContent = "Seleziona un prodotto.";
      return;
    }

    const qty = clampQty(qtyInput?.value || 1);
    const importo = item.price * qty;
    const guadagno = perc > 0 ? (importo * (perc / 100)) : 0;

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
      totalPersonalEarnings: increment(guadagno),
      totalInvoices: increment(1)
    });

    if (hint) {
      const ptxt = perc > 0 ? `${perc}%` : "—";
      hint.textContent = `Salvata: ${item.name} x${qty} • Totale ${money(importo)} • % ${ptxt} • Guadagno ${money(guadagno)}`;
    }

    if (sel) sel.value = "";
    if (qtyInput) qtyInput.value = "1";
    recalc();

    await renderMyBills(session);
  });

  // Cestino: elimina SOLO le proprie fatture
  const fattureBody = document.getElementById("fattureBody");
  if (fattureBody && !fattureBody.dataset.boundDelete) {
    fattureBody.dataset.boundDelete = "1";
    fattureBody.addEventListener("click", async (ev) => {
      const b = ev.target?.closest?.("button[data-del]");
      if (!b) return;
      const billId = b.getAttribute("data-del");
      if (!billId) return;
      const ok = confirm("Vuoi eliminare questa fattura?\n\nL'operazione aggiorna anche i tuoi totali.");
      if (!ok) return;

      try {
        b.disabled = true;
        await deleteMyInvoice(session, billId);
        await renderMyBills(session);
      } catch (e) {
        console.error(e);
        alert("Errore durante l'eliminazione. Riprova o controlla la console.");
      } finally {
        b.disabled = false;
      }
    });
  }

  await renderMyBills(session);
}

async function deleteMyInvoice(session, invoiceId) {
  const billRef = doc(db, "utenti", session.id, "fatture", invoiceId);
  const snap = await getDoc(billRef);
  if (!snap.exists()) return; // già eliminata

  const data = snap.data() || {};
  const importo = Number(data.importo || 0);
  const guadagno = Number(data.guadagnoDipendente || 0);

  // Batch: aggiorna totali utente + elimina fattura in modo consistente
  const batch = writeBatch(db);
  batch.update(doc(db, "utenti", session.id), {
    totalSales: increment(-importo),
    totalPersonalEarnings: increment(-guadagno),
    totalInvoices: increment(-1)
  });
  batch.delete(billRef);
  await batch.commit();
}

async function renderMyBills(session) {
  const body = document.getElementById("fattureBody");
  if (!body) return;

  const snap = await getDocs(query(
    collection(db, "utenti", session.id, "fatture"),
    orderBy("createdAt", "desc"),
    limit(150)
  ));

  if (snap.empty) {
    body.innerHTML = `<tr><td class="muted">Nessuna fattura</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
    return;
  }

  body.innerHTML = "";
  snap.forEach(d => {
    const x = d.data();
    const dt = new Date(x.createdAt || Date.now());
    const data = dt.toLocaleString("it-IT", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });

    const prod = x.prodotto || "—";
    const qty = Number(x.qty || 1);
    const tot = money(x.importo || 0);

    const p = Number(x.percentuale || 0);
    const perc = p > 0 ? `${p}%` : "—";

    const g = money(x.guadagnoDipendente || 0);

    body.insertAdjacentHTML("beforeend",
      `<tr>
        <td>${data}</td>
        <td>${prod}</td>
        <td>${qty}</td>
        <td>${tot}</td>
        <td>${perc}</td>
        <td>${g}</td>
        <td class="actions">
          <button class="btn danger btn-mini" title="Elimina" aria-label="Elimina" data-del="${d.id}">🗑️</button>
        </td>
      </tr>`
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
    data: { labels, datasets: [{ data: values, backgroundColor: labels.map((_,i)=>colors[i%colors.length]), borderColor:"rgba(0,0,0,.35)", borderWidth:2 }] },
    options: { plugins: { legend: { labels: { color: "white" } } } }
  });
}

/* --------- GESTIONALE (SOLO DIRETTORE) --------- */
async function initGestionale(session, me) {
  const role = (me?.ruolo || "").toLowerCase().trim();
  if (role !== "direttore") {
    alert("Accesso negato: pagina riservata al Direttore.");
    window.location.href = "./home.html";
    return;
  }

  const hint = document.getElementById("adminHint");
  const btnReset = document.getElementById("btnResetAll");
  const btnRefresh = document.getElementById("btnRefreshAdmin");

  if (btnRefresh) btnRefresh.addEventListener("click", async () => {
    if (hint) hint.textContent = "Aggiornamento...";
    await renderAdmin();
    await initRolePercentsAdmin();
    if (hint) hint.textContent = "Aggiornato.";
  });

  if (btnReset) btnReset.addEventListener("click", async () => {
    const ok = confirm("ATTENZIONE: vuoi resettare TUTTO? (Ore + Fatture + Totali di tutti)");
    if (!ok) return;

    const ok2 = confirm("Conferma finale: questa azione NON si può annullare. Procedo?");
    if (!ok2) return;

    if (hint) hint.textContent = "Reset in corso... non chiudere la pagina.";
    await resetAllData(hint);
    await renderAdmin();
    if (hint) hint.textContent = "RESET COMPLETATO ✅";
  });

  await renderAdmin();
  // inizializza anche la sezione percentuali (tasto "Salva percentuali")
  await initRolePercentsAdmin();
}


/* --------- GESTIONALE: PERCENTUALI PER GRADO --------- */
async function initRolePercentsAdmin() {
  const hint = document.getElementById("rolePercHint");
  const btn = document.getElementById("btnSaveRolePercents");
  const inputs = {
    "tirocinante": document.getElementById("perc_tirocinante"),
    "dipendente": document.getElementById("perc_dipendente"),
    "dipendente esperto": document.getElementById("perc_esperto"),
    "direttore": document.getElementById("perc_direttore"),
    "licenziato": document.getElementById("perc_licenziato")
  };

  // se la UI non è presente, esci
  if (!btn) return;

  // load
  const map = await ensureRolePercentsLoaded();
  for (const k of Object.keys(inputs)) {
    if (inputs[k]) inputs[k].value = String(clampPercent(map[k], DEFAULT_ROLE_PERCENTS[k]));
  }
  if (hint) hint.textContent = "Percentuali caricate ✅";

  btn.addEventListener("click", async () => {
    const patch = {};
    for (const k of Object.keys(inputs)) {
      const el = inputs[k];
      const fb = DEFAULT_ROLE_PERCENTS[k];
      patch[k] = clampPercent(el ? el.value : fb, fb);
    }

    try {
      if (hint) hint.textContent = "Salvataggio...";
      await setDoc(doc(db, "config", "role_percents"), {
        ...patch,
        updatedAt: Date.now()
      }, { merge: true });

      ROLE_PERCENTS_CACHE = { ...DEFAULT_ROLE_PERCENTS, ...patch };
      if (hint) hint.textContent = "Salvato ✅ (vale per tutti i dipendenti di quel grado)";
    } catch (e) {
      console.error(e);
      if (hint) hint.textContent = "Errore nel salvataggio ❌ (controlla Firestore Rules)";
      alert("Errore nel salvataggio percentuali. Controlla Firestore Rules o console.");
    }
  });
}

/* Admin: render + totals */
async function renderAdmin() {
  const totF = document.getElementById("totFatturato");
  const totO = document.getElementById("totOre");
  const totS = document.getElementById("totStipendi");
  const body = document.getElementById("adminUsersBody");

  const snap = await getDocs(collection(db, "utenti"));
  const users = [];
  snap.forEach(d => users.push({ id: d.id, ...d.data() }));

  let sumSales = 0;
  let sumHours = 0;
  let sumSalary = 0;

  users.forEach(u => {
    const hours = Number(u.totalHours || 0);
    const sales = Number(u.totalSales || 0);
    const earn = Number(u.totalPersonalEarnings || 0);
    const paga = Number(u.pagaOraria || 0);
    const stipendio = (hours * paga) + earn;

    sumSales += sales;
    sumHours += hours;
    sumSalary += stipendio;
  });

  if (totF) totF.textContent = money(sumSales);
  if (totO) totO.textContent = hoursToHHMM(sumHours);
  if (totS) totS.textContent = money(sumSalary);

  if (!body) return;
  if (users.length === 0) {
    body.innerHTML = `<tr><td class="muted">Nessun utente</td><td colspan="9"></td></tr>`;
    return;
  }

  users.sort((a,b) => (b.totalSales||0) - (a.totalSales||0));

  const roleBadge = (rRaw) => {
    const r = (rRaw||"dipendente").toLowerCase().trim();
    const cls = r==="direttore" ? "role director" :
                r==="dipendente esperto" ? "role expert" :
                r==="tirocinante" ? "role trainee" :
                r==="licenziato" ? "role fired" : "role staff";
    const label = r==="dipendente esperto" ? "⭐ Esperto" :
                  r==="direttore" ? "👑 Direttore" :
                  r==="tirocinante" ? "🧑‍🎓 Tirocinante" :
                  r==="licenziato" ? "🚫 Licenziato" : "👷 Dipendente";
    return `<span class="${cls}">${label}</span>`;
  };

  body.innerHTML = "";
  for (const u of users) {
    const hours = Number(u.totalHours || 0);
    const salesEarn = Number(u.totalPersonalEarnings || 0);
    const paga = Number(u.pagaOraria || 0);
    const stipendio = (hours * paga) + salesEarn;

    const safeName = (u.nome || "Sconosciuto").replace(/"/g, "&quot;");
    const safeRole = (u.ruolo || "dipendente");

    body.insertAdjacentHTML("beforeend", `
      <tr>
        <td class="mono">${u.id}</td>
        <td>
          <input class="table-input" data-user="${u.id}" data-field="nome" value="${safeName}" />
        </td>
        <td class="role-cell">
          ${roleBadge(safeRole)}
          <select class="table-select" data-user="${u.id}" data-field="ruolo">
            <option value="tirocinante" ${safeRole==="tirocinante"?"selected":""}>Tirocinante</option>
            <option value="dipendente" ${safeRole==="dipendente"?"selected":""}>Dipendente</option>
            <option value="dipendente esperto" ${safeRole==="dipendente esperto"?"selected":""}>Dipendente Esperto</option>
            <option value="direttore" ${safeRole==="direttore"?"selected":""}>Direttore</option>
            <option value="licenziato" ${safeRole==="licenziato"?"selected":""}>Licenziato</option>
          </select>
        </td>
        <td>
          <input class="table-input mono" style="width:110px" type="number" min="0" step="1"
                 data-user="${u.id}" data-field="pagaOraria" value="${Number.isFinite(paga)?paga:0}" />
        </td>
        <td>${hoursToHHMM(hours)}</td>
        <td>${money(salesEarn)}</td>
        <td><b>${money(stipendio)}</b></td>
        <td class="mono">${Number(u.totalInvoices||0)}</td>
        <td class="actions">
          <button class="btn ghost btn-mini" data-save="${u.id}">Salva</button>
          <button class="btn danger btn-mini" data-fire="${u.id}">Licenzia</button>
        </td>
      </tr>
    `);
  }

  const bindSave = async (uid) => {
    const nameEl = document.querySelector(`input[data-user="${uid}"][data-field="nome"]`);
    const roleEl = document.querySelector(`select[data-user="${uid}"][data-field="ruolo"]`);
    const payEl  = document.querySelector(`input[data-user="${uid}"][data-field="pagaOraria"]`);

    const newName = (nameEl?.value || "").trim();
    const newRole = (roleEl?.value || "dipendente").trim();
    const newPay  = Math.max(0, Number(payEl?.value || 0));

    if (!newName) return alert("Nome non valido.");

    await updateDoc(doc(db, "utenti", uid), { nome:newName, ruolo:newRole, pagaOraria:newPay });
    await setDoc(doc(db, "presence", uid), { nome:newName, updatedAt: Date.now() }, { merge:true });

    await logAdmin("UPDATE_USER", { uid, nome:newName, ruolo:newRole, pagaOraria:newPay });

    const btn = document.querySelector(`[data-save="${uid}"]`);
    if (btn) {
      btn.textContent = "Salvato ✅";
      setTimeout(()=> btn.textContent = "Salva", 1200);
    }

    // refresh role badge without full reload
    await renderAdmin();
    await renderAdminLogs();
  };

  document.querySelectorAll("[data-save]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid = btn.getAttribute("data-save");
      await bindSave(uid);
    });
  });

  document.querySelectorAll("[data-fire]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid = btn.getAttribute("data-fire");
      const ok = confirm("Vuoi licenziare questo dipendente? (Blocca l'accesso)");
      if (!ok) return;

      await updateDoc(doc(db, "utenti", uid), { ruolo: "licenziato" });
      await setDoc(doc(db, "presence", uid), { active:false, startMs:null, updatedAt: Date.now() }, { merge:true });
      await logAdmin("FIRE_USER", { uid });

      await renderAdmin();
      await renderAdminLogs();
    });
  });

  // export buttons (if present)
  const expUsers = document.getElementById("btnExportUsers");
  if (expUsers && !expUsers.__bound) {
    expUsers.__bound = true;
    expUsers.addEventListener("click", async () => {
      const snap2 = await getDocs(collection(db,"utenti"));
      const rows = [["discord_id","nome","ruolo","pagaOraria","totalHours","totalSales","totalPersonalEarnings","totalInvoices"]];
      snap2.forEach(d => {
        const x=d.data()||{};
        rows.push([d.id, x.nome||"", x.ruolo||"", x.pagaOraria??0, x.totalHours??0, x.totalSales??0, x.totalPersonalEarnings??0, x.totalInvoices??0]);
      });
      downloadCSV("dipendenti.csv", rows);
    });
  }

  const expLogs = document.getElementById("btnExportLogs");
  if (expLogs && !expLogs.__bound) {
    expLogs.__bound = true;
    expLogs.addEventListener("click", async () => {
      const snap3 = await getDocs(query(collection(db,"admin_logs"), orderBy("createdAt","desc"), limit(500)));
      const rows = [["when","action","payload"]];
      snap3.forEach(d => {
        const x=d.data()||{};
        rows.push([new Date(x.createdAt||Date.now()).toISOString(), x.action||"", JSON.stringify(x.payload||{})]);
      });
      downloadCSV("admin_logs.csv", rows);
    });
  }

  await renderAdminLogs();
}

/* Reset totale: azzera totali e cancella fatture/turni di tutti */
async function resetAllData(hintEl) {
  const usersSnap = await getDocs(collection(db, "utenti"));
  const userIds = [];
  usersSnap.forEach(d => userIds.push(d.id));

  // 1) azzera totals (batch a blocchi)
  for (let i = 0; i < userIds.length; i += 400) {
    const chunk = userIds.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const uid of chunk) {
      batch.update(doc(db, "utenti", uid), {
        totalHours: 0,
        totalSales: 0,
        totalPersonalEarnings: 0,
        totalInvoices: 0,
        inService: false,
        inServiceStartMs: null
      });
    }
    await batch.commit();
    if (hintEl) hintEl.textContent = `Reset totali: ${Math.min(i+400, userIds.length)}/${userIds.length}...`;
  }

  // 2) cancella sottocollezioni turni/fatture per ciascun utente
  for (let idx = 0; idx < userIds.length; idx++) {
    const uid = userIds[idx];
    if (hintEl) hintEl.textContent = `Cancellazione dati utente ${idx+1}/${userIds.length}...`;

    await deleteAllDocsInSubcollection(`utenti/${uid}/turni`);
    await deleteAllDocsInSubcollection(`utenti/${uid}/fatture`);
  }

  await logAdmin("RESET_ALL", { users: userIds.length });

  // 3) presence: set OFF (best-effort)
  for (let i = 0; i < userIds.length; i += 400) {
    const chunk = userIds.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const uid of chunk) {
      batch.set(doc(db, "presence", uid), { active:false, startMs:null, updatedAt: Date.now() }, { merge:true });
    }
    await batch.commit();
  }
}

/* --------- HOME: TOP FATTURE + GRAFICO (NUMERO FATTURE) --------- */
function medal(i){
  if (i===0) return "🥇";
  if (i===1) return "🥈";
  if (i===2) return "🥉";
  return "🏅";
}

async function renderTopInvoices() {
  const wrap = document.getElementById("topInvoices");
  const listEl = document.getElementById("topInvoicesList");
  if (!wrap && !listEl) return;

  const snap = await getDocs(query(collection(db, "utenti"), orderBy("totalInvoices", "desc"), limit(20)));
  const arr = [];
  snap.forEach(d => {
    const x = d.data() || {};
    arr.push({ id:d.id, nome:x.nome||"Sconosciuto", n:Number(x.totalInvoices||0) });
  });

  const top = arr.filter(x=>x.n>0).slice(0,5);

  if (wrap) {
    wrap.innerHTML = "";
    const top3 = top.slice(0,3);
    if (top3.length === 0) {
      wrap.innerHTML = `<div class="muted">Nessuna fattura ancora.</div>`;
    } else {
      top3.forEach((u, i) => {
        wrap.insertAdjacentHTML("beforeend", `
          <div class="medal-card medal-${i+1}">
            <div class="medal-emoji">${medal(i)}</div>
            <div class="medal-name">${u.nome}</div>
            <div class="medal-sub">${u.n} fatture</div>
          </div>
        `);
      });
    }
  }

  if (listEl) {
    if (top.length === 0) {
      listEl.innerHTML = `<tr><td class="muted">Nessun dato</td><td></td></tr>`;
    } else {
      listEl.innerHTML = "";
      top.forEach((u, i) => {
        listEl.insertAdjacentHTML("beforeend",
          `<tr><td>${medal(i)} ${u.nome}</td><td>${u.n}</td></tr>`
        );
      });
    }
  }
}

async function renderInvoicesChart() {
  const canvas = document.getElementById("invoicesChart");
  if (!canvas || !window.Chart) return;

  const snap = await getDocs(query(collection(db, "utenti"), orderBy("totalInvoices", "desc"), limit(12)));
  const labels = [];
  const values = [];
  snap.forEach(d => {
    const x = d.data() || {};
    const v = Number(x.totalInvoices||0);
    if (v>0) { labels.push(x.nome||"Sconosciuto"); values.push(v); }
  });

  if (window.__invChart) window.__invChart.destroy();
  window.__invChart = new Chart(canvas, {
    type: "bar",
    data: { labels, datasets: [{ data: values, borderWidth: 1 }] },
    options: {
      plugins: { legend: { display:false } },
      scales: {
        x: { ticks: { color: "rgba(245,245,245,.85)" }, grid: { color:"rgba(255,255,255,.06)" } },
        y: { ticks: { color: "rgba(245,245,245,.85)" }, grid: { color:"rgba(255,255,255,.06)" } }
      }
    }
  });
}

/* --------- ADMIN LOG --------- */
async function logAdmin(action, payload = {}) {
  try {
    await addDoc(collection(db, "admin_logs"), {
      action,
      payload,
      createdAt: Date.now()
    });
  } catch {}
}

function downloadCSV(filename, rows) {
  const esc = (v) => `"${String(v ?? "").replaceAll('"','""')}"`;
  const csv = rows.map(r => r.map(esc).join(",")).join("\\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function renderAdminLogs() {
  const body = document.getElementById("adminLogBody");
  if (!body) return;

  const snap = await getDocs(query(collection(db, "admin_logs"), orderBy("createdAt","desc"), limit(60)));
  if (snap.empty) {
    body.innerHTML = `<tr><td class="muted">Nessun log</td><td></td><td></td></tr>`;
    return;
  }

  body.innerHTML = "";
  snap.forEach(d => {
    const x = d.data() || {};
    const dt = new Date(x.createdAt || Date.now());
    const when = dt.toLocaleString("it-IT",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
    body.insertAdjacentHTML("beforeend", `<tr><td>${when}</td><td>${x.action||"—"}</td><td class="muted small mono">${JSON.stringify(x.payload||{}).slice(0,120)}</td></tr>`);
  });
}

async function deleteAllDocsInSubcollection(path) {
  // path: "utenti/{uid}/turni" etc.
  const colRef = collection(db, ...path.split("/"));
  while (true) {
    const snap = await getDocs(query(colRef, limit(200)));
    if (snap.empty) break;

    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}
