let registerMode = false;
let pendingForm = null;

// ========================
// RATES & PRIJSBEREKENING
// ========================

async function loadRates() {
    const res = await fetch("/rates");
    return await res.json();
}

function calculateQuote(rates, gras, tegels, heg, afval, spoed) {
    let prijs = 0;
    prijs += gras * rates.gras_per_m2;
    prijs += tegels * rates.tegels_per_m2;
    prijs += heg * rates.heg_per_meter;
    if (afval) prijs += rates.afval;
    if (spoed) prijs *= rates.spoed_factor;
    return Math.round(prijs);
}

// ========================
// MODAL
// ========================

function openAuthModal() {
    document.getElementById("auth-modal").style.display = "flex";
}

document.addEventListener("DOMContentLoaded", () => {

    const modal       = document.getElementById("auth-modal");
    const closeModal  = document.getElementById("close-modal");
    const toggleReg   = document.getElementById("toggle-register");
    const modalTitle  = document.getElementById("modal-title");
    const authSubmit  = document.getElementById("auth-submit");
    const authUsername = document.getElementById("auth-username");
    const authPassword = document.getElementById("auth-password");
    const authError   = document.getElementById("auth-error");
    const loginBtn    = document.getElementById("login-btn");

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
        modalTitle.textContent  = registerMode ? "Register" : "Login";
        authSubmit.textContent  = registerMode ? "Register" : "Login";
        toggleReg.textContent   = registerMode ? "Al een account? Login" : "Geen account? Register";
        authError.textContent   = "";
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

    if (!pakket) {
        alert("Selecteer eerst een pakket!");
        return;
    }

    const res = await fetch("/bestel-pakket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pakket })
    });

    const data = await res.json();
    const resultEl = document.getElementById("pakket-result");

    if (data.error) {
        resultEl.textContent = "Error: " + data.error;
        resultEl.style.color = "red";
    } else {
        resultEl.textContent = `✓ Bestelling geplaatst! Pakket: ${data.order.pakket}`;
        resultEl.style.color = "green";
        form.reset();
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

    const rates = await loadRates();
    const prijs = calculateQuote(rates, gras, tegels, heg, afval, spoed);

    const res = await fetch("/bestel-offerte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gras, tegels, heg, afval, spoed })
    });

    const result = await res.json();
    const resultEl = document.getElementById("offerte-result");

    if (result.error) {
        resultEl.textContent = "Error: " + result.error;
        resultEl.style.color = "red";
    } else {
        resultEl.innerHTML = `✓ Offerte aangevraagd!<br>Geschatte prijs: €${prijs}`;
        resultEl.style.color = "green";
        form.reset();
    }
}