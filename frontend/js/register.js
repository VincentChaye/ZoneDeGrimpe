import { API_BASE_URL, API_PATH_PREFIX } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("regForm");
  const err = document.getElementById("regErr");

  if (!form) {
    console.error("Formulaire #regForm introuvable dans la page !");
    return;
  }

  const apiUrl = (path) => new URL(`${API_PATH_PREFIX}${path}`, API_BASE_URL).toString();

  function getNext() {
    const p = new URLSearchParams(location.search);
    const next = p.get("next");
    // n’autorise que des chemins internes (évite open redirect)
    return next && next.startsWith("/") ? decodeURIComponent(next) : "./map.html";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.style.display = "none";

    const fd = new FormData(form);
    const email = String(fd.get("email") || "").trim().toLowerCase();
    const password = String(fd.get("password") || "");
    const displayName = String(fd.get("displayName") || "").trim();
    const level = String(fd.get("level") || "debutant").toLowerCase();

    try {
      const res = await fetch(apiUrl("/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ email, password, displayName, level }),
        mode: "cors",
        cache: "no-store",
      });

      let json = {};
      try { json = await res.json(); } catch {}

      if (res.status === 409) {
        err.textContent = "Cet email est déjà utilisé. Essayez de vous connecter.";
        err.style.display = "";
        return;
      }
      if (res.status === 400) {
        err.textContent = json?.error || "Vérifiez les champs (email / mot de passe).";
        err.style.display = "";
        return;
      }
      if (!res.ok) {
        err.textContent = json?.error || `Erreur ${res.status}`;
        err.style.display = "";
        return;
      }

      if (!json?.token || !json?.user?._id) {
        err.textContent = "Réponse d'inscription invalide (token ou user manquant).";
        err.style.display = "";
        return;
      }

      localStorage.setItem("auth", JSON.stringify({ token: json.token, user: json.user }));
      location.replace(getNext());
    } catch (e2) {
      console.error(e2);
      err.textContent = "Erreur réseau/serveur. Réessayez dans un instant.";
      err.style.display = "";
    }
  });
});
