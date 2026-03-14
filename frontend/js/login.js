// login.js
const API_BASE = (window.APP_CONFIG?.API_URL || "http://localhost:3000") + "/api";

const form = document.getElementById("loginForm");
const err = document.getElementById("loginErr");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  err.style.display = "none";

  const fd = new FormData(form);
  const email = fd.get("email");
  const password = fd.get("password");

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();

    if (!res.ok) throw new Error(json?.error || "login_failed");
    if (!json.token || !json.user?._id) throw new Error("missing_token");

    localStorage.setItem(
      "auth",
      JSON.stringify({
        token: json.token,
        user: json.user
      })
    );

    // Redirection vers la page demandée (si ?next=...)
    const next = new URLSearchParams(location.search).get("next");
    location.href = next ? decodeURIComponent(next) : "./parametres.html";

  } catch (e2) {
    console.error("Erreur login:", e2);
    err.textContent = "Échec de connexion. Vérifiez vos identifiants.";
    err.style.display = "";
  }
});
