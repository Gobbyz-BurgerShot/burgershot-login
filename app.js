import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc,
  collection, addDoc, getDocs, query, orderBy, limit,
  increment, deleteDoc, writeBatch,
  where, collectionGroup
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

function percentByRole(roleRaw) {
  const r = (roleRaw || "").toLowerCase().trim();
  if (r === "direttore") return 0;
  if (r === "tirocinante") return 25;
  if (r === "dipendente esperto") return 33;
  return 28;
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
    const data = snap.data();
    if (data?.nome !== session.username) await updateDoc(ref, { nome: session.username });
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

  // PWA (Service Worker)
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('./sw.js'); } catch {}
  }
  const session = getSession();
  if (!session) return;

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  setAvatarUI(session);

  const me = await ensureUserDoc(session);
  const isDirector = (me?.ruolo || "").toLowerCase().trim() === "direttore";

  const roleLower = (me?.ruolo || "").toLowerCase().trim();
  if (roleLower === "licenziato" || me?.licenziato === true) {
    alert("Accesso negato: utente licenziato.");
    logout();
    return;
  }

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
  await renderLeaderboard();
  await renderPresence();
  await renderTop3Invoices();
  await renderInvoiceChart();
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
    const h = Number(x.totalHours||0);
    if (h < (10/60)) return; // nascondi < 10 minuti
    body.insertAdjacentHTML("beforeend",
      `<tr><td>${x.nome || "Sconosciuto"}</td><td>${hoursToHHMM(h)}</td></tr>`
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
  for (const p of list) {
    if (!p.active) continue; // mostra solo chi è in servizio
    const stato = `<span style="color:#00ff88;font-weight:950;">IN SERVIZIO</span>`;
    body.insertAdjacentHTML("beforeend",
      `<tr><td>${p.nome || p.id}</td><td>${stato}</td></tr>`
    );
  }
  if (!body.querySelector("tr")) {
    body.innerHTML = `<tr><td class="muted">Nessuno</td><td></td></tr>`;
  }
}

/* --------- TIMBRI --------- */
async function initTimbri(session) {
  await renderMyTotal(session);

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

  await renderMyBills(session);
  
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
    body.innerHTML = `<tr><td class="muted">Nessuna fattura</td><td></td><td></td><td></td><td></td><td></td></tr>`;
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
      `<tr><td>${data}</td><td>${prod}</td><td>${qty}</td><td>${tot}</td><td>${perc}</td><td>${g}</td></tr>`
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
  const btnExportUsers = document.getElementById("btnExportUsers");
  const btnExportInvoicesWeek = document.getElementById("btnExportInvoicesWeek");
  const btnExportLogs = document.getElementById("btnExportLogs");

  if (btnRefresh) btnRefresh.addEventListener("click", async () => {
    if (hint) hint.textContent = "Aggiornamento...";
    await renderAdmin();
    if (hint) hint.textContent = "Aggiornato.";
  });

  if (btnExportUsers) btnExportUsers.addEventListener("click", async () => {
    const snap = await getDocs(collection(db, "utenti"));
    const rows = [];
    snap.forEach(d => rows.push({ id:d.id, ...d.data() }));
    rows.sort((a,b)=> (a.nome||"").localeCompare(b.nome||""));
    const csv = toCsv([
      ["discord_id","nome","ruolo","paga_oraria","ore_totali","fatturato_totale","guadagno_fatture","fatture_totali"]
    ].concat(rows.map(u => [
      u.id,
      u.nome||"",
      u.ruolo||"",
      Number(u.pagaOraria||0),
      Number(u.totalHours||0),
      Number(u.totalSales||0),
      Number(u.totalPersonalEarnings||0),
      Number(u.totalInvoices||0)
    ])));
    downloadTextFile(csv, `dipendenti_${Date.now()}.csv`, "text/csv");
  });

  if (btnExportInvoicesWeek) btnExportInvoicesWeek.addEventListener("click", async () => {
    const startMs = startOfIsoWeekMs(Date.now());
    const endMs = startMs + 7*24*3600*1000;
    const snap = await getDocs(query(
      collectionGroup(db, "fatture"),
      where("createdAt", ">=", startMs),
      where("createdAt", "<", endMs)
    ));
    const out = [["utente_id","fattura_id","prodotto","qty","importo","createdAt"]];
    snap.forEach(docu => {
      const d = docu.data();
      const uid = docu.ref.path.split("/")[1];
      out.push([
        uid,
        docu.id,
        d.prodotto||"",
        Number(d.qty||0),
        Number(d.importo||0),
        d.createdAt||""
      ]);
    });
    downloadTextFile(toCsv(out), `fatture_settimana_${Date.now()}.csv`, "text/csv");
  });

  if (btnExportLogs) btnExportLogs.addEventListener("click", async () => {
    const snap = await getDocs(query(collection(db, "admin_logs"), orderBy("createdAt", "desc"), limit(500)));
    const out = [["createdAt","type","actorId","actorName","targetId","targetName","details_json"]];
    snap.forEach(d => {
      const x = d.data();
      out.push([
        x.createdAt||"",
        x.type||"",
        x.actorId||"",
        x.actorName||"",
        x.targetId||"",
        x.targetName||"",
        JSON.stringify(x.details||{})
      ]);
    });
    downloadTextFile(toCsv(out), `log_direttore_${Date.now()}.csv`, "text/csv");
  });


  if (btnReset) btnReset.addEventListener("click", async () => {
    const ok = confirm("ATTENZIONE: vuoi resettare TUTTO? (Ore + Fatture + Totali di tutti)");
    if (!ok) return;

    const ok2 = confirm("Conferma finale: questa azione NON si può annullare. Procedo?");
    if (!ok2) return;

    if (hint) hint.textContent = "Reset in corso... non chiudere la pagina.";
    await logAdminAction("RESET_ALL", "ALL", "TUTTI", {});
    await resetAllData(hint);
    await renderAdmin();
    if (hint) hint.textContent = "RESET COMPLETATO ✅";
  });

  await renderAdmin();
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

  if (body) {
    if (users.length === 0) {
      body.innerHTML = `<tr><td class="muted">Nessun utente</td><td colspan="8"></td></tr>`;
    } else {
      users.sort((a,b) => (b.totalSales||0) - (a.totalSales||0));
      body.innerHTML = "";

      for (const u of users) {
        const hours = Number(u.totalHours || 0);
        const salesEarn = Number(u.totalPersonalEarnings || 0);
        const paga = Number(u.pagaOraria || 0);
        const stipendio = (hours * paga) + salesEarn;

        const safeName = (u.nome || "Sconosciuto").replace(/"/g, "&quot;");
        const role = (u.ruolo || "dipendente").toLowerCase().trim();

        const roleBadge = roleToBadge(role);
        const roleSelect = roleToSelect(role);

        body.insertAdjacentHTML("beforeend", `
          <tr>
            <td class="mono">${u.id}</td>
            <td>
              <input class="table-input" data-user="${u.id}" data-field="nome" value="${safeName}" />
            </td>
            <td>
              <div style="display:flex;flex-direction:column;gap:8px;">
                ${roleBadge}
                <select class="table-select" data-user="${u.id}" data-field="ruolo">
                  ${roleSelect}
                </select>
              </div>
            </td>
            <td>
              <input class="table-input" data-user="${u.id}" data-field="pagaOraria" type="number" min="0" step="1" value="${Number(paga||0)}" />
            </td>
            <td>${hoursToHHMM(hours)}</td>
            <td>${money(salesEarn)}</td>
            <td><b>${money(stipendio)}</b></td>
            <td style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn ghost btn-mini" data-save="${u.id}">Salva</button>
              ${role === "licenziato"
                ? `<button class="btn primary btn-mini" data-rehire="${u.id}">Riassumi</button>`
                : `<button class="btn danger btn-mini" data-fire="${u.id}">Licenzia</button>`}
            </td>
          </tr>
        `);
      }

      bindAdminRowActions(users);
    }
  }

  await renderWeeklyStats();
  await renderAdminLogs();
}

function roleToBadge(role) {
  const base = (cls, label) => `<span class="role-badge ${cls}"><span class="role-dot"></span>${label}</span>`;
  if (role === "direttore") return base("role-director","Direttore");
  if (role === "dipendente esperto") return base("role-expert","Dipendente Esperto");
  if (role === "tirocinante") return base("role-intern","Tirocinante");
  if (role === "licenziato") return base("role-fired","Licenziato");
  return base("role-employee","Dipendente");
}

function roleToSelect(role) {
  const opts = [
    "direttore",
    "dipendente esperto",
    "dipendente",
    "tirocinante",
    "licenziato"
  ];
  return opts.map(r => `<option value="${r}" ${r===role?"selected":""}>${r}</option>`).join("");
}

function clampNumber(v, def=0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function bindAdminRowActions(users) {
  // Save
  document.querySelectorAll("[data-save]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid = btn.getAttribute("data-save");
      const nameEl = document.querySelector(`input[data-user="${uid}"][data-field="nome"]`);
      const roleEl = document.querySelector(`select[data-user="${uid}"][data-field="ruolo"]`);
      const payEl  = document.querySelector(`input[data-user="${uid}"][data-field="pagaOraria"]`);

      const newName = (nameEl?.value || "").trim();
      const newRole = (roleEl?.value || "dipendente").toLowerCase().trim();
      const newPay  = Math.max(0, Math.floor(clampNumber(payEl?.value, 0)));

      if (!newName) return alert("Nome non valido.");

      const before = users.find(u=>u.id===uid) || {};
      await updateDoc(doc(db, "utenti", uid), { nome: newName, ruolo: newRole, pagaOraria: newPay });

      // aggiorna presence (nome coerente ovunque)
      await setDoc(doc(db, "presence", uid), { nome: newName, updatedAt: Date.now() }, { merge: true });

      // log
      await logAdminAction("UPDATE_USER", uid, newName, {
        before: { nome: before.nome, ruolo: before.ruolo, pagaOraria: before.pagaOraria },
        after:  { nome: newName, ruolo: newRole, pagaOraria: newPay }
      });

      btn.textContent = "Salvato ✅";
      setTimeout(()=> btn.textContent = "Salva", 1200);
      await renderAdmin();
    });
  });

  // Fire
  document.querySelectorAll("[data-fire]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid = btn.getAttribute("data-fire");
      const ok = confirm("Vuoi licenziare questo dipendente? (accesso bloccato)");
      if (!ok) return;

      const u = users.find(x=>x.id===uid) || {};
      await updateDoc(doc(db, "utenti", uid), { ruolo: "licenziato", licenziato: true });
      await setDoc(doc(db, "presence", uid), { active:false, startMs:null, updatedAt: Date.now() }, { merge:true });

      await logAdminAction("FIRE", uid, u.nome || uid, {});
      await renderAdmin();
    });
  });

  // Rehire
  document.querySelectorAll("[data-rehire]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid = btn.getAttribute("data-rehire");
      const u = users.find(x=>x.id===uid) || {};
      await updateDoc(doc(db, "utenti", uid), { ruolo: "dipendente", licenziato: false });
      await logAdminAction("REHIRE", uid, u.nome || uid, {});
      await renderAdmin();
    });
  });
}

async function logAdminAction(type, targetId, targetName, details) {
  const actor = getSession();
  if (!actor) return;
  try {
    await addDoc(collection(db, "admin_logs"), {
      type,
      actorId: actor.id,
      actorName: actor.username,
      targetId,
      targetName,
      details: details || {},
      createdAt: Date.now()
    });
  } catch {}
}

function startOfIsoWeekMs(nowMs) {
  const d = new Date(nowMs);
  const day = (d.getDay() + 6) % 7; // Monday=0
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

async function renderWeeklyStats() {
  const elInv = document.getElementById("weekInvoices");
  const elSales = document.getElementById("weekSales");
  const elHours = document.getElementById("weekHours");
  const body = document.getElementById("weekTopBody");
  if (!elInv && !elSales && !elHours && !body) return;

  const startMs = startOfIsoWeekMs(Date.now());
  const endMs = startMs + 7*24*3600*1000;

  // build maps per user
  const userSnap = await getDocs(collection(db, "utenti"));
  const users = [];
  userSnap.forEach(d => users.push({ id:d.id, ...d.data() }));
  const map = new Map(users.map(u=>[u.id, { id:u.id, nome:u.nome||u.id, inv:0, sales:0, hours:0 }]));

  // invoices group
  const fatSnap = await getDocs(query(
    collectionGroup(db, "fatture"),
    where("createdAt", ">=", startMs),
    where("createdAt", "<", endMs)
  ));
  let sumInv = 0;
  let sumSales = 0;
  fatSnap.forEach(docu => {
    const d = docu.data();
    const uid = docu.ref.path.split("/")[1]; // utenti/{uid}/fatture/{id}
    const row = map.get(uid) || { id:uid, nome:uid, inv:0, sales:0, hours:0 };
    row.inv += 1;
    row.sales += Number(d.importo||0);
    map.set(uid, row);
    sumInv += 1;
    sumSales += Number(d.importo||0);
  });

  // shifts group
  const turniSnap = await getDocs(query(
    collectionGroup(db, "turni"),
    where("createdAt", ">=", startMs),
    where("createdAt", "<", endMs)
  ));
  let sumHours = 0;
  turniSnap.forEach(docu => {
    const d = docu.data();
    const uid = docu.ref.path.split("/")[1];
    const row = map.get(uid) || { id:uid, nome:uid, inv:0, sales:0, hours:0 };
    const h = Number(d.ore||0);
    row.hours += h;
    map.set(uid, row);
    sumHours += h;
  });

  if (elInv) elInv.textContent = String(sumInv);
  if (elSales) elSales.textContent = money(sumSales);
  if (elHours) elHours.textContent = hoursToHHMM(sumHours);

  if (body) {
    const rows = Array.from(map.values()).filter(r => r.inv>0 || r.sales>0 || r.hours>0);
    rows.sort((a,b)=> (b.inv - a.inv) || (b.sales - a.sales));
    const top = rows.slice(0,5);

    if (top.length === 0) {
      body.innerHTML = `<tr><td class="muted">Nessun dato settimana</td><td></td><td></td><td></td></tr>`;
    } else {
      body.innerHTML = "";
      top.forEach(r => {
        body.insertAdjacentHTML("beforeend",
          `<tr><td>${r.nome}</td><td>${r.inv}</td><td>${money(r.sales)}</td><td>${hoursToHHMM(r.hours)}</td></tr>`
        );
      });
    }
  }
}

async function renderAdminLogs() {
  const body = document.getElementById("adminLogsBody");
  if (!body) return;

  const snap = await getDocs(query(collection(db, "admin_logs"), orderBy("createdAt", "desc"), limit(60)));
  if (snap.empty) {
    body.innerHTML = `<tr><td class="muted">Nessun log</td><td></td><td></td><td></td><td></td></tr>`;
    return;
  }

  body.innerHTML = "";
  snap.forEach(d => {
    const x = d.data();
    const dt = new Date(x.createdAt || Date.now());
    const data = dt.toLocaleString("it-IT", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
    const action = x.type || "—";
    const actor = x.actorName || x.actorId || "—";
    const target = x.targetName || x.targetId || "—";
    const details = x.details ? JSON.stringify(x.details) : "";
    const safe = (details||"").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    body.insertAdjacentHTML("beforeend",
      `<tr><td>${data}</td><td>${action}</td><td>${actor}</td><td>${target}</td><td class="mono" style="max-width:420px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safe}</td></tr>`
    );
  });
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

function toCsv(rows) {
  return rows.map(r => r.map(x => {
    const s = String(x ?? "");
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  }).join(",")).join("\n");
}

function downloadTextFile(text, filename, mime) {
  const blob = new Blob([text], { type: mime || "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(a.href), 1500);
}
