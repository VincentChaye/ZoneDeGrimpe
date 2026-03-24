/**
 * feed.js — Fil d'activite (activity feed)
 */

const API_BASE_URL = window.APP_CONFIG?.API_URL || "http://localhost:3000";

function getAuth() {
  try { return JSON.parse(localStorage.getItem("auth") || "null"); } catch { return null; }
}
function getToken() { return getAuth()?.token || ""; }

function esc(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Returns a human-readable relative date string in French.
 */
function relativeDate(dateStr) {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "a l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  if (hours < 24) return `il y a ${hours}h`;
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days}j`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

/**
 * Renders star rating as HTML.
 */
function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return "\u2605".repeat(full) + (half ? "\u00BD" : "") + "\u2606".repeat(empty);
}

/**
 * Returns icon and message HTML for a feed item.
 */
function renderFeedItem(item) {
  const username = esc(item.username || "Anonyme");
  const profileLink = item.userId ? `./profil.html?id=${item.userId}` : "#";
  const userTag = `<a href="${profileLink}">@${username}</a>`;

  let icon = "";
  let message = "";

  switch (item.type) {
    case "review": {
      icon = "\u2B50";
      const spotName = esc(item.spotName || "un spot");
      const spotLink = item.spotId ? `./map.html?spot=${item.spotId}` : "#";
      message = `${userTag} a laisse un avis sur <a href="${spotLink}">${spotName}</a>`;
      if (item.rating) {
        message += `<div class="feed-card__stars">${renderStars(item.rating)}</div>`;
      }
      break;
    }
    case "logbook": {
      icon = "\uD83E\uDDD7";
      const routeName = esc(item.routeName || "une voie");
      const grade = item.grade ? ` (${esc(item.grade)})` : "";
      const style = item.style ? ` - ${esc(item.style)}` : "";
      const spotLink = item.spotId ? `./map.html?spot=${item.spotId}` : "#";
      message = `${userTag} a grimpe <a href="${spotLink}">${routeName}${grade}</a>${style}`;
      break;
    }
    case "spot": {
      icon = "\uD83D\uDCCD";
      const spotName = esc(item.spotName || "un spot");
      const spotLink = item.spotId ? `./map.html?spot=${item.spotId}` : "#";
      message = `${userTag} a propose <a href="${spotLink}">${spotName}</a>`;
      break;
    }
    default: {
      icon = "\uD83D\uDD14";
      message = `${userTag} a effectue une action`;
    }
  }

  return `
    <div class="feed-card">
      <div class="feed-card__top">
        <div class="feed-card__icon">${icon}</div>
        <div class="feed-card__body">
          <div class="feed-card__text">${message}</div>
          <div class="feed-card__date">${relativeDate(item.createdAt || item.date)}</div>
        </div>
      </div>
    </div>
  `;
}

async function loadFeed() {
  const feedList = document.getElementById("feedList");
  try {
    const res = await fetch(`${API_BASE_URL}/api/follows/feed`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const items = await res.json();

    if (!items.length) {
      feedList.innerHTML = `<p class="empty-state" data-i18n="social.no_activity">Aucune activite recente.</p>`;
      return;
    }

    feedList.innerHTML = items.map(renderFeedItem).join("");
  } catch (e) {
    console.error("Erreur chargement feed:", e);
    feedList.innerHTML = `<p class="empty-state">Erreur de chargement du fil d'activite.</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const token = getToken();
  if (!token) {
    document.getElementById("loginPrompt").hidden = false;
  } else {
    document.getElementById("main").hidden = false;
    loadFeed();
  }
});
