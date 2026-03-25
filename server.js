const express = require("express");
const session = require("express-session");
const fs      = require("fs");
const path    = require("path");

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

app.use(session({
    secret: "groen-gewoon-doen-secret",
    resave: false,
    saveUninitialized: false
}));

// ========================
// HELPERS
// ========================

const USERS_FILE  = path.join(__dirname, "data", "users.json");
const ORDERS_FILE = path.join(__dirname, "data", "orders.json");
const RATES_FILE  = path.join(__dirname, "data", "rates.json");

function readJSON(file) {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, "utf8"));
}
function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ========================
// PAKKET DUUR (moet overeenkomen met index.js)
// ========================
const PAKKET_DUUR = {
    onderhoud: 1,
    snoeien:   1,
    aanleg:    3
};
const OFFERTE_DUUR = 1;

/**
 * Berekent alle bezette datums voor een gebruiker op basis van hun
 * goedgekeurde of lopende bestellingen.
 */
function getBezetteDatumsVoorUser(username) {
    const orders  = readJSON(ORDERS_FILE);
    const bezet   = new Set();

    orders
        .filter(o =>
            o.username === username &&
            o.datum &&
            (o.status === "goedgekeurd" || o.status === "in behandeling")
        )
        .forEach(o => {
            const duur = o.type === "pakket"
                ? (PAKKET_DUUR[o.pakket] || 1)
                : OFFERTE_DUUR;

            const startDatum = new Date(o.datum + "T12:00:00");
            for (let i = 0; i < duur; i++) {
                bezet.add(startDatum.toISOString().split("T")[0]);
                startDatum.setDate(startDatum.getDate() + 1);
            }
        });

    return Array.from(bezet).sort();
}

/**
 * Controleert of een nieuwe bestelling overlapt met bestaande boekingen.
 * Geeft true terug als er een overlap is.
 */
function heeftOverlap(username, startDatumStr, duur) {
    const bezet = getBezetteDatumsVoorUser(username);

    // Bereken de dagen die de nieuwe bestelling bezet
    const nieuweDagen = [];
    const d = new Date(startDatumStr + "T12:00:00");
    for (let i = 0; i < duur; i++) {
        nieuweDagen.push(d.toISOString().split("T")[0]);
        d.setDate(d.getDate() + 1);
    }

    return nieuweDagen.some(dag => bezet.includes(dag));
}

// ========================
// AUTH ROUTES
// ========================

app.post("/register", (req, res) => {
    const { username, password } = req.body;
    const users = readJSON(USERS_FILE);

    if (users.find(u => u.username === username)) {
        return res.json({ error: "Gebruikersnaam al in gebruik" });
    }

    users.push({ username, password, admin: false });
    writeJSON(USERS_FILE, users);
    req.session.user = { username, admin: false };
    res.json({ success: true, username });
});

app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const users = readJSON(USERS_FILE);
    const user  = users.find(u => u.username === username && u.password === password);

    if (!user) return res.json({ error: "Onjuiste gebruikersnaam of wachtwoord" });

    req.session.user = { username: user.username, admin: user.admin };
    res.json({ success: true, username: user.username, admin: user.admin });
});

app.get("/check-login", (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
    } else {
        res.json(null);
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// ========================
// BEZETTE DATUMS ROUTE
// Geeft alle bezette datums terug voor de ingelogde gebruiker
// ========================

app.get("/bezette-datums", (req, res) => {
    if (!req.session.user) return res.json([]);
    const bezet = getBezetteDatumsVoorUser(req.session.user.username);
    res.json(bezet);
});

// ========================
// RATES ROUTE
// ========================

app.get("/rates", (req, res) => {
    const rates = readJSON(RATES_FILE);
    res.json(rates);
});

// ========================
// BESTEL PAKKET
// ========================

app.post("/bestel-pakket", (req, res) => {
    if (!req.session.user) return res.json({ error: "Niet ingelogd" });

    const { pakket, datum } = req.body;

    if (!pakket) return res.json({ error: "Geen pakket opgegeven" });
    if (!datum)  return res.json({ error: "Geen datum opgegeven" });

    // Werkdag-check (server-side)
    const dag = new Date(datum + "T12:00:00").getDay();
    if (dag === 0 || dag === 6) return res.json({ error: "Kies een werkdag" });

    // Overlap-check
    const duur = PAKKET_DUUR[pakket] || 1;
    if (heeftOverlap(req.session.user.username, datum, duur)) {
        return res.json({ error: "Deze datum overlapt met een bestaande boeking. Kies een andere datum." });
    }

    const orders = readJSON(ORDERS_FILE);
    const id = orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 1;
    const nu = new Date();

    const order = {
        id,
        username: req.session.user.username,
        type:     "pakket",
        pakket,
        datum,
        aangemeld_op: nu.toISOString().split("T")[0],
        tijd:         nu.toTimeString().split(" ")[0],
        status:       "in behandeling"
    };

    orders.push(order);
    writeJSON(ORDERS_FILE, orders);
    res.json({ success: true, order });
});

// ========================
// BESTEL OFFERTE
// ========================

app.post("/bestel-offerte", (req, res) => {
    if (!req.session.user) return res.json({ error: "Niet ingelogd" });

    const { gras, tegels, heg, afval, spoed, datum } = req.body;

    if (!datum) return res.json({ error: "Geen datum opgegeven" });

    // Werkdag-check (server-side)
    const dag = new Date(datum + "T12:00:00").getDay();
    if (dag === 0 || dag === 6) return res.json({ error: "Kies een werkdag" });

    // Overlap-check
    if (heeftOverlap(req.session.user.username, datum, OFFERTE_DUUR)) {
        return res.json({ error: "Deze datum overlapt met een bestaande boeking. Kies een andere datum." });
    }

    const rates = readJSON(RATES_FILE);
    let prijs = 0;
    prijs += (gras   || 0) * rates.gras_per_m2;
    prijs += (tegels || 0) * rates.tegels_per_m2;
    prijs += (heg    || 0) * rates.heg_per_meter;
    if (afval) prijs += rates.afval;
    if (spoed) prijs *= rates.spoed_factor;
    prijs = Math.round(prijs);

    const orders = readJSON(ORDERS_FILE);
    const id = orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 1;
    const nu = new Date();

    const order = {
        id,
        username: req.session.user.username,
        type:  "offerte",
        gras:   gras   || 0,
        tegels: tegels || 0,
        heg:    heg    || 0,
        afval:  afval  || false,
        spoed:  spoed  || false,
        prijs,
        datum,
        aangemeld_op: nu.toISOString().split("T")[0],
        tijd:         nu.toTimeString().split(" ")[0],
        status:       "in behandeling"
    };

    orders.push(order);
    writeJSON(ORDERS_FILE, orders);
    res.json({ success: true, order });
});

// ========================
// MIJN BESTELLINGEN
// ========================

app.get("/mijn-bestellingen", (req, res) => {
    if (!req.session.user) return res.json({ error: "Niet ingelogd" });

    const orders = readJSON(ORDERS_FILE);
    const mijn   = orders.filter(o => o.username === req.session.user.username);
    res.json(mijn);
});

// ========================
// ADMIN ROUTES
// ========================

app.get("/admin/orders", (req, res) => {
    if (!req.session.user?.admin) return res.status(403).json({ error: "Geen toegang" });
    const orders = readJSON(ORDERS_FILE);
    res.json(orders);
});

app.put("/admin/orders/:id", (req, res) => {
    if (!req.session.user?.admin) return res.status(403).json({ error: "Geen toegang" });

    const id     = parseInt(req.params.id);
    const { status } = req.body;
    const orders = readJSON(ORDERS_FILE);
    const order  = orders.find(o => o.id === id);

    if (!order) return res.status(404).json({ error: "Order niet gevonden" });

    order.status = status;
    writeJSON(ORDERS_FILE, orders);
    res.json({ success: true });
});

app.post("/admin/rates", (req, res) => {
    if (!req.session.user?.admin) return res.status(403).json({ error: "Geen toegang" });
    writeJSON(RATES_FILE, req.body);
    res.json({ success: true });
});

// ========================
// START SERVER
// ========================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server draait op http://localhost:${PORT}`);
});