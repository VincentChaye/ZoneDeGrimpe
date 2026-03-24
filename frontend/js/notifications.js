/**
 * notifications.js — Page notifications + exported initNotifBell()
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
 * Returns an icon for a notification type.
 */
function notifIcon(type) {
  const icons = {
    friend_request: "\uD83E\uDD1D",
    friend_accepted: "\u2705",
    spot_approved: "\uD83C\uDF89",
    spot_rejected: "\u274C",
    review: "\u2B50",
    logbook: "\uD83E\uDDD7",
    edit_approved: "\u2705",
    edit_rejected: "\u274C",
    mention: "\uD83D\uDCAC",
    system: "\uD83D\uDD14",
  };
  return icons[type] || "\uD83D\uDD14";
}

/**
 * Renders a single notification card.
 */
function renderNotifCard(notif) {
  const unreadClass = notif.read ? "" : " notif-card--unread";
  const icon = notifIcon(notif.type);
  const message = esc(notif.message || "Notification");
  const date = relativeDate(notif.createdAt || notif.date);

  return `
    <div class="notif-card${unreadClass}" data-notif-id="${esc(notif._id)}" onclick="handleNotifClick('${esc(notif._id)}', '${esc(notif.link || "")}')">
      <div class="notif-card__icon">${icon}</div>
      <div class="notif-card__body">
        <div class="notif-card__text">${message}</div>
        <div class="notif-card__date">${date}</div>
      </div>
    </div>
  `;
}

/**
 * Loads all notifications.
 */
async function loadNotifications() {
  const list = document.getElementById("notifList");
  if (!list) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const notifications = await res.json();

    if (!notifications.length) {
      list.innerHTML = `<p class="empty-state" data-i18n="notif.no_notifications">Aucune notification.</p>`;
      return;
    }

    list.innerHTML = notifications.map(renderNotifCard).join("");
  } catch (e) {
    console.error("Erreur chargement notifications:", e);
    list.innerHTML = `<p class="empty-state">Erreur de chargement des notifications.</p>`;
  }
}

/**
 * Handle click on a notification: mark as read + navigate.
 */
window.handleNotifClick = async function(notifId, link) {
  try {
    await fetch(`${API_BASE_URL}/api/notifications/${notifId}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    // Update visual state immediately
    const card = document.querySelector(`[data-notif-id="${notifId}"]`);
    if (card) card.classList.remove("notif-card--unread");

    // Navigate if a link is provided
    if (link) {
      window.location.href = link;
    }
  } catch (e) {
    console.error("Erreur marquage notification:", e);
  }
};

/**
 * Mark all notifications as read.
 */
async function markAllAsRead() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);

    // Update all cards visually
    document.querySelectorAll(".notif-card--unread").forEach(card => {
      card.classList.remove("notif-card--unread");
    });

    // Update bell badge if present
    const badge = document.getElementById("notifBadge");
    if (badge) {
      badge.textContent = "";
      badge.hidden = true;
    }
  } catch (e) {
    console.error("Erreur marquage tout lu:", e);
    alert("Erreur lors du marquage des notifications.");
  }
}

/**
 * Initializes the notification bell icon with unread count badge.
 * Call this from any page that has a #notifBadge element.
 * Sets up polling every 60 seconds.
 */
export function initNotifBell() {
  const token = getToken();
  if (!token) return;

  async function updateBadge() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const count = data.count || 0;
      const badge = document.getElementById("notifBadge");
      if (!badge) return;

      if (count > 0) {
        badge.textContent = count > 99 ? "99+" : String(count);
        badge.hidden = false;
      } else {
        badge.textContent = "";
        badge.hidden = true;
      }
    } catch (e) {
      console.error("Erreur badge notifications:", e);
    }
  }

  // Initial fetch
  updateBadge();

  // Poll every 60 seconds
  setInterval(updateBadge, 60_000);
}

// Also expose on window for non-module usage
window.initNotifBell = initNotifBell;

// Page initialization (only runs on notifications.html)
document.addEventListener("DOMContentLoaded", () => {
  const token = getToken();
  const mainEl = document.getElementById("main");
  const loginEl = document.getElementById("loginPrompt");

  if (!token) {
    if (loginEl) loginEl.hidden = false;
  } else {
    if (mainEl) mainEl.hidden = false;
    loadNotifications();

    const markAllBtn = document.getElementById("markAllRead");
    if (markAllBtn) {
      markAllBtn.addEventListener("click", markAllAsRead);
    }
  }
});
