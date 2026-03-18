async function updateLoginStatus() {
    const user = await checkLogin();
    const statusEl = document.getElementById("login-status");
    const logoutBtn = document.getElementById("logout-btn");
    const adminLink = document.getElementById("admin-link");
    const ordersLink = document.getElementById("my-orders-link");
    const loginBtn = document.getElementById("login-btn");

    if (user) {
        if (statusEl) {
            statusEl.textContent = `✓ Ingelogd als: ${user.username}`;
            statusEl.style.color = "green";
        }
        if (logoutBtn) logoutBtn.style.display = "inline-block";
        if (loginBtn) loginBtn.style.display = "none";
        if (adminLink) adminLink.style.display = user.admin ? "inline-block" : "none";
        if (ordersLink) ordersLink.style.display = "inline-block";
    } else {
        if (statusEl) statusEl.textContent = "";
        if (logoutBtn) logoutBtn.style.display = "none";
        if (loginBtn) loginBtn.style.display = "inline-block";
        if (adminLink) adminLink.style.display = "none";
        if (ordersLink) ordersLink.style.display = "none";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    updateLoginStatus();

    document.getElementById("logout-btn")?.addEventListener("click", async () => {
        await logout();
    });

    document.getElementById("go-to-admin")?.addEventListener("click", () => {
        window.location.href = "admin.html";
    });
});