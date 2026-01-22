import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc,
  collection, addDoc, getDocs, query, where, orderBy, limit
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

/** =========================
 *  FIREBASE CONFIG (TUO)
 *  ========================= */
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

/** =========================
 *  AUTH (Discord Implicit)
 *  ========================= */
function getAccessTokenFromHash() {
  const hash = window.location.hash || "";
  if (!hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  return params.get("access_token");
}

async function fetchDiscordUser(accessToken) {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error("Discord API error");
  return await res.json();
}

function saveSession(user) {
  localStorage.setItem("discord_id", user.id);
  localStorage.setItem("discord_name", user.username);
  localStorage.setItem("discord_avatar", user.avatar || "");
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
  if (page === "index.html" || page === "" ) return;
  const s = getSession();
  if (!s) window.location.href = "./index.html";
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

async function ensureUserInFirestore(session) {
  // utenti/{discordID}
  const ref = doc(db, "utenti", session.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      nome: session.username,
      ruolo: "dipendente",
      pagaOraria: 20,
      createdAt: new Date().toISOString()
    });
  }
  return (await getDoc(ref)).data();
}

/** =========================
 *  PRESENCE (in_service)
 *  ========================= */
async function setPresence(discordID, nome, active, startMs = null) {
  const ref = doc(db, "presence", discordID);
  await setDoc(ref, {
    nome,
    active,
    startMs: startMs || null,
    updatedAt: Date.now()
  }, { merge: true });
}

function setInServicePill(active) {
  const t = document.getElementById("inServiceText");
  if (!t) return;
  t.textContent = active ? "Sì" : "No";
  t.style.color = active ? "#00ff88" : "#e10600";
}

/** =========================
 *  TIME HELPERS
 *  ========================= */
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

/** =========================
 *  PAGE INIT
 *  ========================= */
(async function main() {
  // 1) se arrivi dal redirect Discord: home.html#access_token=...
  const token = getAccessTokenFromHash();
  if (token) {
    try {
      const discordUser = await fetchDiscordUser(token);
      saveSession(discordUser);
      // pulisci hash per non restare col token in URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {
      console.error(e);
      alert("Login Discord fallito. Controlla Redirect URI.");
      window.location.href = "./index.html";
      return;
    }
  }

  // 2) se non loggato: fuori
  requireAuthOrRedirect();
  const session = getSession();
  if (!session) return;

  // logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  setAvatarUI(session);

  // 3) ensure user in db
  const me = await ensureUserInFirestore(session);

  // 4) in_service UI from localStorage
  const inService = localStorage.getItem("in_service") === "1";
  setInServicePill(inService);

  // 5) page-specific
  const page = location.pathname.split("/").pop();

  if (page === "timbri.html") await initTimbri(session);
  if (page === "fatture.html") await initFatture(session, me);
  if (page === "home.html" || page === "" ) await initHome(session, me);

})();

/** =========================
 *  TIMBRI PAGE
 *  ========================= */
async function initTimbri(session) {
  const startBtn = document.getElementById("btnStart");
  const stopBtn = document.getElementById("btnStop");
  const timerText = document.getElementById("timerText");

  // riprendi eventuale turno attivo
  const startMsSaved = Number(localStorage.getItem("shift_start_ms") || "0");
  let runningStart = startMsSaved > 0 ? startMsSaved : null;

  function tick() {
    if (!timerText) return;
    if (!runningStart) { timerText.textContent = "00:00:00"; return; }
    timerText.textContent = msToHMS(Date.now() - runningStart);
  }
  setInterval(tick, 1000);
  tick();

  // mostra pill
  setInServicePill(!!runningStart);

  // buttons
  if (startBtn) startBtn.addEventListener("click", async () => {
    if (runningStart) return alert("Sei già in servizio.");
    runningStart = Date.now();
    localStorage.setItem("shift_start_ms", String(runningStart));
    localStorage.setItem("in_service", "1");
    setInServicePill(true);
    await setPresence(session.id, session.username, true, runningStart);
  });

  if (stopBtn) stopBtn.addEventListener("click", async () => {
    if (!runningStart) return alert("Non sei in servizio.");
    const endMs = Date.now();
    const hours = (endMs - runningStart) / 3600000;

    await addDoc(collection(db, "turni"), {
      discordID: session.id,
      nome: session.username,
      startMs: runningStart,
      endMs,
      ore: hours,
      dateISO: new Date().toISOString()
    });

    runningStart = null;
    localStorage.removeItem("shift_start_ms");
    localStorage.setItem("in_service", "0");
    setInServicePill(false);
    await setPresence(session.id, session.username, false, null);

    alert(`Timbro salvato: ${hoursToHHMM(hours)}`);
    await renderMyShifts(session.id);
  });

  await renderMyShifts(session.id);
}

async function renderMyShifts(discordID) {
  const body = document.getElementById("myShiftsBody");
  if (!body) return;

  const qy = query(
    collection(db, "turni"),
    where("discordID", "==", discordID),
    orderBy("startMs", "desc"),
    limit(15)
  );
  const snap = await getDocs(qy);

  if (snap.empty) {
    body.innerHTML = `<tr><td class="muted">Nessun timbro</td><td></td><td></td><td></td></tr>`;
    return;
  }

  body.innerHTML = "";
  for (const d of snap.docs) {
    const x = d.data();
    const start = new Date(x.startMs);
    const end = new Date(x.endMs);
    const date = start.toLocaleDateString("it-IT");
    const ore = hoursToHHMM(Number(x.ore || 0));
    const st = start.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    const en = end.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

    body.insertAdjacentHTML("beforeend",
      `<tr>
        <td>${date}</td>
        <td>${ore}</td>
        <td>${st}</td>
        <td>${en}</td>
      </tr>`
    );
  }
}

/** =========================
 *  HOME PAGE
 *  ========================= */
async function initHome(session) {
  await renderMyTotal(session.id);
  await renderLeaderboard();
  await renderPresence();
}

async function renderMyTotal(discordID) {
  const el = document.getElementById("myTotal");
  if (!el) return;

  const qy = query(collection(db, "turni"), where("discordID", "==", discordID));
  const snap = await getDocs(qy);

  let sum = 0;
  snap.forEach(d => { sum += Number(d.data().ore || 0); });
  el.textContent = hoursToHHMM(sum);
}

async function renderLeaderboard() {
  const body = document.getElementById("leaderboardBody");
  if (!body) return;

  // Somma ore per nome (client-side)
  const snap = await getDocs(collection(db, "turni"));
  const map = new Map(); // nome -> ore
  snap.forEach(d => {
    const x = d.data();
    const nome = x.nome || "Sconosciuto";
    map.set(nome, (map.get(nome) || 0) + Number(x.ore || 0));
  });

  const rows = [...map.entries()]
    .sort((a,b) => b[1]-a[1])
    .slice(0, 20);

  if (rows.length === 0) {
    body.innerHTML = `<tr><td class="muted">Nessun timbro</td><td></td></tr>`;
    return;
  }

  body.innerHTML = "";
  for (const [nome, ore] of rows) {
    body.insertAdjacentHTML("beforeend",
      `<tr><td>${nome}</td><td>${hoursToHHMM(ore)}</td></tr>`
    );
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
  for (const p of list.slice(0, 20)) {
    const stato = p.active ? `<span style="color:#00ff88;font-weight:900;">IN SERVIZIO</span>` : `<span style="color:#e10600;font-weight:900;">OFF</span>`;
    body.insertAdjacentHTML("beforeend",
      `<tr><td>${p.nome || p.id}</td><td>${stato}</td></tr>`
    );
  }
}

/** =========================
 *  FATTURE PAGE
 *  ========================= */
async function initFatture(session, me) {
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

    await addDoc(collection(db, "fatture"), {
      discordID: session.id,
      nome: session.username,
      cliente,
      descrizione: desc,
      importo,
      percentuale: perc,
      guadagnoDipendente: guadagno,
      createdAt: Date.now()
    });

    if (hint) hint.textContent = `Salvata. Guadagno: $${guadagno.toLocaleString("it-IT")}`;

    document.getElementById("fCliente").value = "";
    document.getElementById("fDesc").value = "";
    document.getElementById("fImporto").value = "";
    document.getElementById("fPerc").value = "";

    await renderFattureTable(session, me);
    await renderPie();
  });

  await renderFattureTable(session, me);
  await renderPie();
}

async function renderFattureTable(session, me) {
  const body = document.getElementById("fattureBody");
  if (!body) return;

  const isBoss = (me?.ruolo === "manager" || me?.ruolo === "ceo");

  let snap;
  if (isBoss) {
    snap = await getDocs(query(collection(db, "fatture"), orderBy("createdAt", "desc"), limit(100)));
  } else {
    snap = await getDocs(query(collection(db, "fatture"), where("discordID", "==", session.id), orderBy("createdAt", "desc"), limit(100)));
  }

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
    const idShort = d.id.slice(0, 6).toUpperCase();

    body.insertAdjacentHTML("beforeend",
      `<tr>
        <td>${idShort}</td>
        <td>${data}</td>
        <td>${x.nome || "Sconosciuto"}</td>
        <td>${tot}</td>
        <td>${g}</td>
      </tr>`
    );
  });
}

async function renderPie() {
  const canvas = document.getElementById("pieChart");
  if (!canvas || !window.Chart) return;

  const snap = await getDocs(collection(db, "fatture"));
  const map = new Map(); // nome -> importo
  snap.forEach(d => {
    const x = d.data();
    const nome = x.nome || "Sconosciuto";
    map.set(nome, (map.get(nome) || 0) + Number(x.importo || 0));
  });

  const labels = [...map.keys()];
  const values = [...map.values()];

  const colors = [
    "#e10600", "#ffffff", "#1f4fd8", "#9ca3af", "#7c0000",
    "#2b6fff", "#c7c7c7", "#ff3b30", "#4f7cff", "#a3a3a3"
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
      plugins: {
        legend: { labels: { color: "white" } }
      }
    }
  });
}
