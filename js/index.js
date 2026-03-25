let registerMode = false;
let pendingForm = null;

// ========================
// PAKKET CONFIGURATIE
// Duur per pakket in dagen — hier aanpassen als een pakket langer duurt
// ========================
const PAKKET_DUUR = {
    onderhoud: 1,
    snoeien:   1,
    aanleg:    3
};

// Offerte duurt altijd 1 dag
const OFFERTE_DUUR = 1;

// ========================
// RATES & PRIJSBEREKENING
// ========================

async function loadRates() {
    const res = await fetch("/rates");
    return await res.json();
}

function calculateQuote(rates, gras, tegels, heg, afval, spoed) {
    let prijs = 0;
    prijs += gras   * rates.gras_per_m2;
    prijs += tegels * rates.tegels_per_m2;
    prijs += heg    * rates.heg_per_meter;
    if (afval) prijs += rates.afval;
    if (spoed) prijs *= rates.spoed_factor;
    return Math.round(prijs);
}

// ========================
// DATUMHULPFUNCTIES
// ========================

/**
 * Geeft de minimale selecteerbare datum terug (morgen, alleen werkdagen).
 */
function getMinDatum() {
    const d = new Date();
    d.setDate(d.getDate() + 1); // minimaal morgen
    // Sla weekend over
    while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() + 1);
    }
    return d.toISOString().split("T")[0];
}

/**
 * Controleer of een datum een werkdag is.
 */
function isWerkdag(datumStr) {
    const d = new Date(datumStr + "T12:00:00"); // T12 voorkomt timezone-issues
    const dag = d.getDay();
    return dag !== 0 && dag !== 6;
}

/**
 * Geeft alle datums terug die de bestelling bezet (startdatum + duur - 1 extra dagen).
 */
function getBezetteDagen(startDatumStr, duur) {
    const dagen = [];
    const d = new Date(startDatumStr + "T12:00:00");
    for (let i = 0; i < duur; i++) {
        dagen.push(d.toISOString().split("T")[0]);
        d.setDate(d.getDate() + 1);
    }
    return dagen;
}

/**
 * Haalt alle al-bezette datums op van goedgekeurde of lopende bestellingen.
 * Dit vraagt de server om de bezette datums van de ingelogde gebruiker.
 */
async function laadBezetteDatums() {
    try {
        const res = await fetch("/bezette-datums");
        if (!res.ok) return [];
        return await res.json(); // array van "YYYY-MM-DD" strings
    } catch {
        return [];
    }
}

/**
 * Controleert of een geplande bestelling overlapt met al-bezette datums.
 * @param {string} startDatum   – "YYYY-MM-DD"
 * @param {number} duur         – aantal dagen
 * @param {string[]} bezet      – array van bezette "YYYY-MM-DD" strings
 * @returns {string|null}       – foutmelding of null als het vrij is
 */
function controleerOverlap(startDatum, duur, bezet) {
    const nieuweDagen = getBezetteDagen(startDatum, duur);
    const overlapDagen = nieuweDagen.filter(d => bezet.includes(d));
    if (overlapDagen.length > 0) {
        return `⛔ Deze datum overlapt met een bestaande boeking (${overlapDagen.join(", ")}). Kies een andere datum.`;
    }
    return null;
}

/**
 * Zet de minimale datum op een date-input en toont een overzicht van bezette dagen.
 */
async function initialiseerDatumPrikker(inputId, infoId, foutId) {
    const input = document.getElementById(inputId);
    const infoEl = document.getElementById(infoId);
    const foutEl = document.getElementById(foutId);
    if (!input) return;

    input.min = getMinDatum();
    input.value = "";

    const bezet = await laadBezetteDatums();

    if (bezet.length > 0 && infoEl) {
        infoEl.textContent = `📅 Al bezet: ${bezet.join(", ")}`;
    } else if (infoEl) {
        infoEl.textContent = "";
    }

    // Valideer datum bij wijziging
    input.addEventListener("change", () => {
        if (foutEl) foutEl.style.display = "none";

        const gekozenDatum = input.value;
        if (!gekozenDatum) return;

        if (!isWerkdag(gekozenDatum)) {
            foutEl.textContent = "⛔ Kies een werkdag (maandag t/m vrijdag).";
            foutEl.style.display = "block";
            input.value = "";
            return;
        }

        // Live overlap-check tonen (niet blokkerend, definitieve check bij submit)
        const duur = inputId === "pakket-datum"
            ? (PAKKET_DUUR[document.getElementById("pakket")?.value] || 1)
            : OFFERTE_DUUR;

        const overlapFout = controleerOverlap(gekozenDatum, duur, bezet);
        if (overlapFout && foutEl) {
            foutEl.textContent = overlapFout;
            foutEl.style.display = "block";
            input.value = "";
        }
    });
}

// ========================
// PAKKET SELECTIE (kaarten)
// ========================

/**
 * Wordt aangeroepen vanuit de HTML onclick op een pakket-kaart.
 */
function selecteerPakket(pakketNaam, element) {
    // Verwijder eerdere selectie
    document.querySelectorAll(".pakket-kaart").forEach(k => k.classList.remove("geselecteerd"));
    element.classList.add("geselecteerd");

    // Zet verborgen veld
    document.getElementById("pakket").value = pakketNaam;

    // Toon bevestiging
    const label = document.getElementById("pakket-keuze-label");
    if (label) {
        const duur = PAKKET_DUUR[pakketNaam] || 1;
        label.textContent = `✓ Geselecteerd: ${pakketNaam.charAt(0).toUpperCase() + pakketNaam.slice(1)} (${duur} dag${duur > 1 ? "en" : ""})`;
    }
}

// ========================
// MODAL
// ========================

function openAuthModal() {
    document.getElementById("auth-modal").style.display = "flex";
}

document.addEventListener("DOMContentLoaded", async () => {

    const modal        = document.getElementById("auth-modal");
    const closeModal   = document.getElementById("close-modal");
    const toggleReg    = document.getElementById("toggle-register");
    const modalTitle   = document.getElementById("modal-title");
    const authSubmit   = document.getElementById("auth-submit");
    const authUsername = document.getElementById("auth-username");
    const authPassword = document.getElementById("auth-password");
    const authError    = document.getElementById("auth-error");
    const loginBtn     = document.getElementById("login-btn");

    // Datumprikkers initialiseren
    await initialiseerDatumPrikker("pakket-datum",  "bezette-dagen-pakket",  "datum-fout-pakket");
    await initialiseerDatumPrikker("offerte-datum", "bezette-dagen-offerte", "datum-fout-offerte");

    // Login knop opent modal
    loginBtn?.addEventListener("click", () => {
        modal.style.display = "flex";
    });

    // Sluiten
    closeModal?.addEventListener("click", () => {
        modal.style.display = "none";
    });

    // Wissel tussen login en register
    toggleReg?.addEventListener("click", () => {
        registerMode = !registerMode;
        modalTitle.textContent = registerMode ? "Register" : "Login";
        authSubmit.textContent = registerMode ? "Register" : "Login";
        toggleReg.textContent  = registerMode ? "Al een account? Login" : "Geen account? Register";
        authError.textContent  = "";
    });

    // Submit login of register
    authSubmit?.addEventListener("click", async () => {
        const username = authUsername.value.trim();
        const password = authPassword.value.trim();

        if (!username || !password) {
            authError.textContent = "Vul beide velden in!";
            return;
        }

        let res;
        try {
            res = registerMode
                ? await register(username, password)
                : await login(username, password);
        } catch (e) {
            console.error("Auth error:", e);
            authError.textContent = "Server error!";
            return;
        }

        if (res.error) {
            authError.textContent = res.error;
        } else {
            modal.style.display = "none";
            authError.textContent = "";
            authUsername.value = "";
            authPassword.value = "";

            await updateLoginStatus();

            // Ververs bezette datums na inloggen
            await initialiseerDatumPrikker("pakket-datum",  "bezette-dagen-pakket",  "datum-fout-pakket");
            await initialiseerDatumPrikker("offerte-datum", "bezette-dagen-offerte", "datum-fout-offerte");

            // Als er een form stond te wachten, verwerk die nu
            if (pendingForm) {
                if (pendingForm.id === "pakket-form") {
                    await handlePakketBestelling(pendingForm);
                } else if (pendingForm.id === "offerte-form") {
                    await handleOfferteBestelling(pendingForm);
                }
                pendingForm = null;
            }
        }
    });

    // ========================
    // FORM SUBMITS
    // ========================

    document.querySelectorAll("form.requires-login").forEach(form => {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const user = await checkLogin();

            if (!user) {
                pendingForm = form;
                openAuthModal();
                return;
            }

            if (form.id === "pakket-form") {
                await handlePakketBestelling(form);
            } else if (form.id === "offerte-form") {
                await handleOfferteBestelling(form);
            }
        });
    });
});

// ========================
// PAKKET BESTELLEN
// ========================

async function handlePakketBestelling(form) {
    const pakket = form.querySelector('[name="pakket"]').value;
    const datum  = form.querySelector('[name="datum"]').value;
    const foutEl = document.getElementById("datum-fout-pakket");

    if (!pakket) {
        alert("Selecteer eerst een pakket!");
        return;
    }
    if (!datum) {
        if (foutEl) { foutEl.textContent = "Kies eerst een datum."; foutEl.style.display = "block"; }
        return;
    }
    if (!isWerkdag(datum)) {
        if (foutEl) { foutEl.textContent = "Kies een werkdag (maandag t/m vrijdag)."; foutEl.style.display = "block"; }
        return;
    }

    // Definitieve overlap-check via server
    const bezet = await laadBezetteDatums();
    const duur  = PAKKET_DUUR[pakket] || 1;
    const overlapFout = controleerOverlap(datum, duur, bezet);
    if (overlapFout) {
        if (foutEl) { foutEl.textContent = overlapFout; foutEl.style.display = "block"; }
        return;
    }

    const res = await fetch("/bestel-pakket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pakket, datum })
    });

    const data = await res.json();
    const resultEl = document.getElementById("pakket-result");

    if (data.error) {
        resultEl.textContent = "Error: " + data.error;
        resultEl.style.color = "red";
    } else {
        resultEl.textContent = `✓ Bestelling geplaatst! Pakket: ${data.order.pakket} op ${datum}`;
        resultEl.style.color = "green";
        form.reset();
        document.getElementById("pakket").value = "";
        document.getElementById("pakket-keuze-label").textContent = "";
        document.querySelectorAll(".pakket-kaart").forEach(k => k.classList.remove("geselecteerd"));
        // Ververs bezette datums
        await initialiseerDatumPrikker("pakket-datum", "bezette-dagen-pakket", "datum-fout-pakket");
    }
}

// ========================
// OFFERTE BESTELLEN
// ========================

async function handleOfferteBestelling(form) {
    const formData = new FormData(form);
    const gras   = parseInt(formData.get("gras"))   || 0;
    const tegels = parseInt(formData.get("tegels")) || 0;
    const heg    = parseInt(formData.get("heg"))    || 0;
    const afval  = formData.get("afval") === "on";
    const spoed  = formData.get("spoed") === "on";
    const datum  = formData.get("datum");
    const foutEl = document.getElementById("datum-fout-offerte");

    if (!datum) {
        if (foutEl) { foutEl.textContent = "Kies eerst een datum."; foutEl.style.display = "block"; }
        return;
    }
    if (!isWerkdag(datum)) {
        if (foutEl) { foutEl.textContent = "Kies een werkdag (maandag t/m vrijdag)."; foutEl.style.display = "block"; }
        return;
    }

    // Definitieve overlap-check
    const bezet = await laadBezetteDatums();
    const overlapFout = controleerOverlap(datum, OFFERTE_DUUR, bezet);
    if (overlapFout) {
        if (foutEl) { foutEl.textContent = overlapFout; foutEl.style.display = "block"; }
        return;
    }

    const rates = await loadRates();
    const prijs = calculateQuote(rates, gras, tegels, heg, afval, spoed);

    const res = await fetch("/bestel-offerte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gras, tegels, heg, afval, spoed, datum })
    });

    const result = await res.json();
    const resultEl = document.getElementById("offerte-result");

    if (result.error) {
        resultEl.textContent = "Error: " + result.error;
        resultEl.style.color = "red";
    } else {
        resultEl.innerHTML = `✓ Offerte aangevraagd op ${datum}!<br>Geschatte prijs: €${prijs}`;
        resultEl.style.color = "green";
        form.reset();
        // Ververs bezette datums
        await initialiseerDatumPrikker("offerte-datum", "bezette-dagen-offerte", "datum-fout-offerte");
    }
}