// 🔥 INCOLLERAI QUI LE CHIAVI FIREBASE
const firebaseConfig = {
  apiKey: "API_KEY",
  authDomain: "PROJECT.firebaseapp.com",
  projectId: "PROJECT_ID",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let userID = localStorage.getItem("discordID");
let turnoAttivo = null;

// LOGIN DISCORD (semplificato)
function loginDiscord() {
  window.location.href = "https://discord.com/oauth2/authorize?client_id=CLIENT_ID&redirect_uri=TUO_SITO/dashboard.html&response_type=token&scope=identify";
}

// CREA UTENTE AUTOMATICO
async function creaUtente(discordID, nome) {
  const ref = db.collection("utenti").doc(discordID);
  const doc = await ref.get();

  if (!doc.exists) {
    await ref.set({
      nome: nome,
      ruolo: "dipendente",
      pagaOraria: 20
    });
  }
}

// IN SERVIZIO
document.getElementById("startBtn")?.addEventListener("click", async () => {
  turnoAttivo = Date.now();
});

// FUORI SERVIZIO
document.getElementById("stopBtn")?.addEventListener("click", async () => {
  const fine = Date.now();
  const ore = (fine - turnoAttivo) / 3600000;

  await db.collection("turni").add({
    discordID: userID,
    start: turnoAttivo,
    end: fine,
    ore: ore,
    data: new Date().toISOString().slice(0, 10)
  });

  turnoAttivo = null;
});

// FATTURA
document.getElementById("addFattura")?.addEventListener("click", async () => {
  const importo = Number(document.getElementById("importo").value);
  const percentuale = Number(document.getElementById("percentuale").value);
  const guadagno = importo * (percentuale / 100);

  await db.collection("fatture").add({
    discordID: userID,
    cliente: cliente.value,
    descrizione: descrizione.value,
    importo: importo,
    percentuale: percentuale,
    guadagnoDipendente: guadagno,
    data: new Date()
  });
});
