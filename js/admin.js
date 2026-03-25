// ========================
// PAKKET DUUR (zelfde als index.js)
// ========================
const PAKKET_DUUR = { onderhoud: 1, snoeien: 1, aanleg: 3 };
const OFFERTE_DUUR = 1;

let alleOrders = [];
let kalenderDatum = new Date();

// ========================
// TOEGANGSCONTROLE
// ========================
document.addEventListener("DOMContentLoaded", async () => {
    const user = await checkLogin();
    if (!user || !user.admin) {
        alert("Geen toegang");
        window.location.href = "/";
        return;
    }

    await laadOrders();
    await laadTarieven();
    tekenKalender();
    koppelFilters();
    koppelTariefForm();

    document.getElementById("kal-prev").addEventListener("click", () => {
        kalenderDatum.setMonth(kalenderDatum.getMonth() - 1);
        tekenKalender();
    });
    document.getElementById("kal-next").addEventListener("click", () => {
        kalenderDatum.setMonth(kalenderDatum.getMonth() + 1);
        tekenKalender();
    });
});

// ========================
// LAAD ORDERS
// ========================
async function laadOrders() {
    const res = await fetch("/admin/orders");
    alleOrders = await res.json();
    vulStats(alleOrders);
    vulTabel(alleOrders);
    tekenKalender();
}

// ========================
// STATISTIEKEN
// ========================
function vulStats(orders) {
    document.getElementById("stat-totaal").textContent      = orders.length;
    document.getElementById("stat-behandeling").textContent = orders.filter(o => o.status === "in behandeling").length;
    document.getElementById("stat-goed").textContent        = orders.filter(o => o.status === "goedgekeurd").length;
    document.getElementById("stat-af").textContent          = orders.filter(o => o.status === "afgewezen").length;

    const omzet = orders
        .filter(o => o.status === "goedgekeurd" && o.prijs)
        .reduce((s, o) => s + o.prijs, 0);
    document.getElementById("stat-omzet").textContent = "€" + omzet.toLocaleString("nl-NL");
}

// ========================
// TABEL VULLEN
// ========================
function vulTabel(orders) {
    const tbody = document.getElementById("orders-tbody");
    tbody.innerHTML = "";

    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#999;">Geen orders gevonden.</td></tr>`;
        return;
    }

    orders.forEach(order => {
        let details = "";
        if (order.type === "pakket") {
            details = order.pakket;
        } else {
            const delen = [];
            if (order.gras)   delen.push(`${order.gras}m² gras`);
            if (order.tegels) delen.push(`${order.tegels}m² tegels`);
            if (order.heg)    delen.push(`${order.heg}m heg`);
            if (order.afval)  delen.push("afval");
            if (order.spoed)  delen.push("spoed");
            details = delen.join(", ") || "—";
        }

        // Bereken einddatum bij meerdaagse pakketten
        const duur = order.type === "pakket" ? (PAKKET_DUUR[order.pakket] || 1) : OFFERTE_DUUR;
        let datumTekst = order.datum || "—";
        if (order.datum && duur > 1) {
            const eind = new Date(order.datum + "T12:00:00");
            eind.setDate(eind.getDate() + duur - 1);
            datumTekst = `${order.datum} → ${eind.toISOString().split("T")[0]}`;
        }

        tbody.innerHTML += `
            <tr>
                <td>${order.id}</td>
                <td>${order.username}</td>
                <td>${order.type}</td>
                <td>${details}</td>
                <td>${datumTekst}</td>
                <td>${order.aangemeld_op || order.datum || "—"} ${order.tijd || ""}</td>
                <td>${order.prijs ? "€" + order.prijs : "—"}</td>
                <td>${order.status}</td>
                <td>
                    <button onclick="updateStatus(${order.id}, 'goedgekeurd')">Goedkeuren</button>
                    <button onclick="updateStatus(${order.id}, 'afgewezen')">Afwijzen</button>
                </td>
            </tr>
        `;
    });
}

// ========================
// FILTERS
// ========================
function koppelFilters() {
    document.getElementById("filter-user").addEventListener("input", filterOrders);
    document.getElementById("filter-status").addEventListener("change", filterOrders);
    document.getElementById("filter-type").addEventListener("change", filterOrders);
}

function filterOrders() {
    const user   = document.getElementById("filter-user").value.toLowerCase();
    const status = document.getElementById("filter-status").value;
    const type   = document.getElementById("filter-type").value;

    const gefilterd = alleOrders.filter(o => {
        if (user   && !o.username.toLowerCase().includes(user)) return false;
        if (status && o.status !== status) return false;
        if (type   && o.type   !== type)   return false;
        return true;
    });

    vulTabel(gefilterd);
}

// ========================
// STATUS UPDATEN
// ========================
async function updateStatus(id, status) {
    await fetch("/admin/orders/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
    });
    await laadOrders();
}

// ========================
// KALENDER
// ========================
function tekenKalender() {
    const grid  = document.getElementById("kalender-grid");
    const titel = document.getElementById("kal-titel");
    grid.innerHTML = "";

    const jaar    = kalenderDatum.getFullYear();
    const maand   = kalenderDatum.getMonth();
    const vandaag = new Date().toISOString().split("T")[0];

    const maandNamen = ["Januari","Februari","Maart","April","Mei","Juni",
                        "Juli","Augustus","September","Oktober","November","December"];
    titel.textContent = `${maandNamen[maand]} ${jaar}`;

    // Dag-headers
    ["Ma","Di","Wo","Do","Vr","Za","Zo"].forEach(d => {
        const h = document.createElement("div");
        h.style.cssText = "text-align:center; font-size:11px; font-weight:bold; padding:4px 0; color:#555;";
        h.textContent = d;
        grid.appendChild(h);
    });

    // Bezette datums ophalen uit orders
    const bezetteDagMap = {};
    alleOrders
        .filter(o => o.datum && (o.status === "goedgekeurd" || o.status === "in behandeling"))
        .forEach(o => {
            const duur = o.type === "pakket" ? (PAKKET_DUUR[o.pakket] || 1) : OFFERTE_DUUR;
            const d = new Date(o.datum + "T12:00:00");
            for (let i = 0; i < duur; i++) {
                const key = d.toISOString().split("T")[0];
                if (!bezetteDagMap[key]) bezetteDagMap[key] = [];
                bezetteDagMap[key].push(`${o.username}: ${o.type === "pakket" ? o.pakket : "offerte"}`);
                d.setDate(d.getDate() + 1);
            }
        });

    // Offset: eerste dag van maand (ma=0)
    const eersteJour = new Date(jaar, maand, 1).getDay();
    const offset = eersteJour === 0 ? 6 : eersteJour - 1;

    for (let i = 0; i < offset; i++) {
        const leeg = document.createElement("div");
        grid.appendChild(leeg);
    }

    const dagenInMaand = new Date(jaar, maand + 1, 0).getDate();

    for (let dag = 1; dag <= dagenInMaand; dag++) {
        const datumStr  = `${jaar}-${String(maand + 1).padStart(2, "0")}-${String(dag).padStart(2, "0")}`;
        const dagOfWeek = new Date(datumStr + "T12:00:00").getDay();
        const isWeekend = dagOfWeek === 0 || dagOfWeek === 6;
        const isBezet   = !!bezetteDagMap[datumStr];
        const isVandaag = datumStr === vandaag;

        const cel = document.createElement("div");
        cel.style.cssText = `
            text-align: center;
            padding: 6px 4px;
            border-radius: 4px;
            font-size: 13px;
            position: relative;
            cursor: ${isBezet ? "pointer" : "default"};
            background: ${isBezet ? "#2e7d32" : isWeekend ? "#f0f0f0" : "#f9fdf8"};
            color: ${isBezet ? "white" : isWeekend ? "#aaa" : "#333"};
            outline: ${isVandaag ? "2px solid #ff8f00" : "none"};
            outline-offset: -2px;
        `;
        cel.textContent = dag;

        if (isBezet) {
            const tooltip = document.createElement("div");
            tooltip.style.cssText = `
                display: none;
                position: absolute;
                bottom: calc(100% + 4px);
                left: 50%;
                transform: translateX(-50%);
                background: #333;
                color: white;
                font-size: 11px;
                padding: 4px 8px;
                border-radius: 4px;
                white-space: nowrap;
                z-index: 10;
                pointer-events: none;
            `;
            tooltip.textContent = bezetteDagMap[datumStr].join(" | ");
            cel.appendChild(tooltip);
            cel.addEventListener("mouseenter", () => tooltip.style.display = "block");
            cel.addEventListener("mouseleave", () => tooltip.style.display = "none");
        }

        grid.appendChild(cel);
    }
}

// ========================
// TARIEVEN LADEN & OPSLAAN
// ========================
async function laadTarieven() {
    const res   = await fetch("/rates");
    const rates = await res.json();
    const form  = document.getElementById("tarieven-form");
    Object.entries(rates).forEach(([key, val]) => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input) input.value = val;
    });
}

function koppelTariefForm() {
    document.getElementById("tarieven-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.target;
        const data = {
            gras_per_m2:   parseFloat(form.gras_per_m2.value)   || 0,
            tegels_per_m2: parseFloat(form.tegels_per_m2.value) || 0,
            heg_per_meter: parseFloat(form.heg_per_meter.value) || 0,
            afval:         parseFloat(form.afval.value)         || 0,
            spoed_factor:  parseFloat(form.spoed_factor.value)  || 1.5
        };

        const res    = await fetch("/admin/rates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        const el     = document.getElementById("tarieven-result");

        if (result.success) {
            el.textContent = "✓ Tarieven opgeslagen!";
            el.style.color = "green";
        } else {
            el.textContent = "Fout bij opslaan.";
            el.style.color = "red";
        }
        setTimeout(() => el.textContent = "", 3000);
    });
}