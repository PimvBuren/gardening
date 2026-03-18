async function loadOrders() {
    const user = await checkLogin();

    if (!user) {
        alert("Log eerst in");
        location.href = "/";
        return;
    }

    const res = await fetch("/mijn-bestellingen");
    const orders = await res.json();
    const container = document.getElementById("orders");
    container.innerHTML = "";

    if (orders.length === 0) {
        container.innerHTML = "Geen bestellingen gevonden.";
        return;
    }

    orders.forEach(order => {
        let details = "";

        if (order.type === "pakket") {
            details = "Pakket: " + order.pakket;
        } else {
            details = `
                Gras: ${order.gras}m²<br>
                Tegels: ${order.tegels}m²<br>
                Heg: ${order.heg}m<br>
                Prijs: €${order.prijs}
            `;
        }

        container.innerHTML += `
            <div style="border:1px solid #ccc; padding:10px; margin:10px;">
                <strong>Order #${order.id}</strong><br>
                ${details}<br>
                Status: <b>${order.status}</b><br>
                Datum: ${order.datum} ${order.tijd}
            </div>
        `;
    });
}

document.addEventListener("DOMContentLoaded", loadOrders);