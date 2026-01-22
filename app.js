import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

// ==================== FIREBASE CONFIG ====================
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

console.log("🔥 Firebase collegato");

let userID = localStorage.getItem("discordID") || null;
let turnoAttivo = null;

// ==================== LOGIN AUTOMATICO ====================
function getDiscordInfo() {
  const hash = window.location.hash;
  if (hash) {
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get("access_token");
    if (token) {
      fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: "Bearer " + token }
      })
      .then(res => res.json())
      .then(async data => {
        userID = data.id;
        localStorage.setItem("discordID", userID);
        await creaUtente(userID, data.username);
      });
    }
  }
}
getDiscordInfo();

// ==================== CREA UTENTE AUTOMATICO ====================
async function creaUtente(discordID, nome) {
  const ref = doc(db, "utenti", discordID);
  const docSnap = await getDoc(ref);
  if (!docSnap.exists()) {
    await setDoc(ref, {
      nome: nome,
      ruolo: "dipendente",
      pagaOraria: 20
    });
    console.log("🟢 Utente creato automaticamente:", nome);
  } else {
    console.log("👀 Utente già registrato:", nome);
  }
}

// ==================== PULSANTI IN/OUT SERVIZIO ====================
document.getElementById("startBtn")?.addEventListener("click", () => {
  turnoAttivo = Date.now();
  alert("✅ Entrato in servizio");
});

document.getElementById("stopBtn")?.addEventListener("click", async () => {
  if (!turnoAttivo) return alert("⚠️ Devi prima entrare in servizio");
  const fine = Date.now();
  const ore = (fine - turnoAttivo) / 3600000;

  await addDoc(collection(db, "turni"), {
    discordID: userID,
    start: turnoAttivo,
    end: fine,
    ore: ore,
    data: new Date().toISOString().slice(0, 10)
  });

  turnoAttivo = null;
  alert("🟢 Uscito dal servizio. Ore registrate: " + ore.toFixed(2));
});

// ==================== INSERIMENTO FATTURA ====================
document.getElementById("addFattura")?.addEventListener("click", async () => {
  const cliente = document.getElementById("cliente").value;
  const descrizione = document.getElementById("descrizione").value;
  const importo = Number(document.getElementById("importo").value);
  const percentuale = Number(document.getElementById("percentuale").value);

  if (!cliente || !descrizione || !importo || !percentuale) return alert("⚠️ Compila tutti i campi");

  const guadagno = importo * (percentuale / 100);

  await addDoc(collection(db, "fatture"), {
    discordID: userID,
    cliente,
    descrizione,
    importo,
    percentuale,
    guadagnoDipendente: guadagno,
    data: new Date()
  });

  alert("🧾 Fattura salvata! Guadagno dipen
