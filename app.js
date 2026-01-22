import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc,
  collection, addDoc, getDocs, query, orderBy, limit,
  increment
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

/* --------- FIRESTORE MODEL ---------
utenti/{id}
  nome, ruolo, pagaOraria
  totalHours, totalSales, totalPersonalEarnings
  inService, inServiceStartMs
  sottocollezioni:
    turni/{autoId}
    fatture/{autoId}
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
    // aggiorna nome se cambia
    const data = snap.data();
    if (data?.nome !== session.username) {
      await updateDoc(ref, { nome: session.username });
    }
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
  // Se arrivi dal redirect Discord: home.html#access_token=...
  const token = getAccessTokenFromHash();
  if (token) {
    try {
      const u = await fetchDiscordUser(token);
      saveSession(u);
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {
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

  // pill in servizio da utente doc / fallback local
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

    await updateDoc(doc(db, "utenti", session.id), {
      inService: true,
      inServiceStartMs: runningStart
    });
    await setPresence(session, true, runningStart);
  });

  if (stopBtn) stopBtn.addEventListener("click", async () => {
    if (!runningStart) return alert("Non sei in servizio.");
    const endMs = Date.now();
    const hours = (endMs - runningStart) / 3600000;

    // salva timbro in sottocollezione: utenti/{id}/turni
    await addDoc(collection(db, "utenti", session.id, "turni"), {
      startMs: runningStart,
      endMs,
      ore: hours,
      createdAt: Date.now()
    });

    // aggiorna totali utente
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

/* --------- FATTURE --------- */
async function initFatture(session) {
  const btn = document.getElementById("btnAddFattura");
  const hint = document.getElementById("fatturaHint");

  if (btn) btn.addEventListener("click", async () => {
    const cliente = document.getElementById("fCliente").value.trim();
    const desc = document.getElementById("fDesc").value.trim();
    const importo = Number(document.getElementById("fImporto").value);
    const perc = Number(document.getElementById("fPerc").value);

    if (!cliente || !desc || !importo || !perc) {
      if (hint) hint.textContent = "Compila tutti i campi.";
      return;
    }

    const guadagno = importo * (perc / 100);

    await addDoc(collection(db, "utenti", session.id, "fatture"), {
      cliente,
      descrizione: desc,
      importo,
      percentuale: perc,
      guadagnoDipendente: guadagno,
      createdAt: Date.now()
    });

    await updateDoc(doc(db, "utenti", session.id), {
      totalSales: increment(importo),
      totalPersonalEarnings: increment(guadagno)
    });

    if (hint) hint.textContent = `Salvata. Guadagno: $${guadagno.toLocaleString("it-IT")}`;

    document.getElementById("fCliente").value = "";
    document.getElementById("fDesc").value = "";
    document.getElementById("fImporto").value = "";
    document.getElementById("fPerc").value = "";

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
    limit(80)
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
    const tot = `$${Number(x.importo||0).toLocaleString("it-IT")}`;
    const g = `$${Number(x.guadagnoDipendente||0).toLocaleString("it-IT")}`;
    body.insertAdjacentHTML("beforeend",
      `<tr>
        <td>${data}</td>
        <td>${x.cliente || "-"}</td>
        <td>${x.descrizione || "-"}</td>
        <td>${tot}</td>
        <td>${g}</td>
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
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map((_,i)=>colors[i%colors.length]),
        borderColor: "rgba(0,0,0,.35)",
        borderWidth: 2
      }]
    },
    options: {
      plugins: { legend: { labels: { color: "white" } } }
    }
  });
}
