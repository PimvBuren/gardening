const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require("express-session");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: "geheim123",
    resave: false,
    saveUninitialized: true
}));

app.use(express.static(__dirname));

const USERS_FILE = path.join(__dirname, "data/user.json");
const ORDERS_FILE = path.join(__dirname, "data/order.json");

// VERBETERDE FUNCTIE: Handelt lege bestanden en errors af
function readUsers() { 
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf-8');
        // Als het bestand leeg is, return lege array
        if (!data || data.trim() === '') return [];
        return JSON.parse(data);
    } catch (err) {
        // Als het bestand niet bestaat of kapot is, return lege array
        console.error('Error reading users:', err.message);
        return [];
    }
}

function saveUsers(users) { 
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); 
}

function readOrders() {
    try {
        const data = fs.readFileSync(ORDERS_FILE, 'utf-8');
        if (!data || data.trim() === '') return [];
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading orders:', err.message);
        return [];
    }
}

function saveOrders(orders) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

// Bereken prijs voor custom offerte
function calculatePrice(gras, tegels, heg, afval, spoed) {
    let prijs = 0;
    
    // Prijzen per eenheid (je kunt deze aanpassen)
    prijs += gras * 5;      // €5 per m² gras
    prijs += tegels * 15;   // €15 per m² tegels
    prijs += heg * 10;      // €10 per meter heg
    
    if (afval) prijs += 50;  // €50 voor afval afvoeren
    if (spoed) prijs *= 1.5; // 50% toeslag voor spoed
    
    return Math.round(prijs);
}

// REGISTER
app.post("/register", (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.json({ error: "Vul alle velden in" });
    }
    
    const users = readUsers();
    
    if (users.find(u => u.username === username)) {
        return res.json({ error: "Gebruiker bestaat al" });
    }
    
    users.push({ username, password, admin: false });
    saveUsers(users);
    
    console.log('Nieuwe gebruiker geregistreerd:', username);
    res.json({ success: true });
});

// LOGIN
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const users = readUsers();
    const user = users.find(u => u.username === username && u.password === password);
    
    if (!user) {
        return res.json({ error: "Verkeerde gebruikersnaam of wachtwoord" });
    }
    
    req.session.user = user;
    console.log('Gebruiker ingelogd:', username);
    res.json({ success: true, admin: user.admin });
});

// CHECK LOGIN
app.get("/check-login", (req, res) => { 
    res.json(req.session.user || null); 
});

// LOGOUT
app.get("/logout", (req, res) => {
    const username = req.session.user?.username;
    req.session.destroy();
    console.log('Gebruiker uitgelogd:', username);
    res.json({ success: true });
});

// ADMIN DATA
app.get("/admin-data", (req, res) => {
    if (!req.session.user || !req.session.user.admin) {
        return res.status(403).send("Geen toegang");
    }
    res.json({ message: "Admin toegang toegestaan" });
});

// BESTEL PAKKET
app.post("/bestel-pakket", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Niet ingelogd" });
    }
    
    const { pakket } = req.body;
    if (!pakket) {
        return res.json({ error: "Geen pakket geselecteerd" });
    }
    
    const orders = readOrders();
    const newOrder = {
        id: orders.length + 1,
        username: req.session.user.username,
        type: "pakket",
        pakket: pakket,
        datum: new Date().toISOString().split('T')[0],
        tijd: new Date().toLocaleTimeString('nl-NL'),
        status: "in behandeling"
    };
    
    orders.push(newOrder);
    saveOrders(orders);
    
    console.log('Pakket besteld:', newOrder);
    res.json({ success: true, order: newOrder });
});

// BEREKEN EN BESTEL OFFERTE
app.post("/bestel-offerte", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Niet ingelogd" });
    }
    
    const { gras, tegels, heg, afval, spoed } = req.body;
    
    // Converteer naar getallen
    const grassM2 = parseInt(gras) || 0;
    const tegelsM2 = parseInt(tegels) || 0;
    const hegM = parseInt(heg) || 0;
    const afvalBool = afval === 'true' || afval === true;
    const spoedBool = spoed === 'true' || spoed === true;
    
    const prijs = calculatePrice(grassM2, tegelsM2, hegM, afvalBool, spoedBool);
    
    const orders = readOrders();
    const newOrder = {
        id: orders.length + 1,
        username: req.session.user.username,
        type: "offerte",
        gras: grassM2,
        tegels: tegelsM2,
        heg: hegM,
        afval: afvalBool,
        spoed: spoedBool,
        prijs: prijs,
        datum: new Date().toISOString().split('T')[0],
        tijd: new Date().toLocaleTimeString('nl-NL'),
        status: "in behandeling"
    };
    
    orders.push(newOrder);
    saveOrders(orders);
    
    console.log('Offerte besteld:', newOrder);
    res.json({ success: true, order: newOrder, prijs: prijs });
});

// Start server
app.listen(3000, () => {
    console.log("Server draait op http://localhost:3000");
    console.log("Users bestand:", USERS_FILE);
});