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

    // ========================
    // LAAD ALLE ORDERS
    // ========================

    const res = await fetch("/admin/orders");
    const orders = await res.json();

    const tbody = document.querySelector("tbody");
    tbody.innerHTML = "";

    orders.forEach(order => {
        let details = "";

        if (order.type === "pakket") {
            details = order.pakket;
        } else {
            details = `Gras: ${order.gras}, Tegels: ${order.tegels}, Heg: ${order.heg}`;
        }

        tbody.innerHTML += `
            <tr>
                <td>${order.id}</td>
                <td>${order.username}</td>
                <td>${details}</td>
                <td>${order.prijs ? "€" + order.prijs : "-"}</td>
                <td>${order.status}</td>
                <td>
                    <button onclick="updateStatus(${order.id}, 'goedgekeurd')">Goedkeuren</button>
                    <button onclick="updateStatus(${order.id}, 'afgewezen')">Afwijzen</button>
                </td>
            </tr>
        `;
    });
});

// ========================
// STATUS UPDATEN
// ========================

async function updateStatus(id, status) {
    await fetch("/admin/orders/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
    });

    location.reload();
}