/**
 * friends.js — Gestion des amis et demandes d'amitie
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
 * Renders avatar HTML — image if available, initials otherwise.
 */
function renderAvatar(user) {
  if (user.avatarUrl) {
    return `<div class="friend-card__avatar"><img src="${esc(user.avatarUrl)}" alt=""></div>`;
  }
  const initials = (user.displayName || user.username || "?").charAt(0).toUpperCase();
  return `<div class="friend-card__avatar">${initials}</div>`;
}

/**
 * Renders a single friend request card.
 */
function renderRequestCard(req) {
  const user = req.from || req;
  const userId = user._id || user.userId;
  const displayName = esc(user.displayName || user.username || "Utilisateur");
  const username = esc(user.username || "");

  return `
    <div class="friend-card" data-request-id="${esc(req._id)}">
      ${renderAvatar(user)}
      <div class="friend-card__info">
        <div class="friend-card__name"><a href="./profil.html?id=${userId}">${displayName}</a></div>
        ${username ? `<div class="friend-card__username">@${username}</div>` : ""}
      </div>
      <div class="friend-card__actions">
        <button class="btn btn--accept" onclick="acceptRequest('${req._id}')">Accepter</button>
        <button class="btn btn--decline" onclick="declineRequest('${req._id}')">Refuser</button>
      </div>
    </div>
  `;
}

/**
 * Renders a single friend card.
 */
function renderFriendCard(friend) {
  const userId = friend._id || friend.userId;
  const displayName = esc(friend.displayName || friend.username || "Utilisateur");
  const username = esc(friend.username || "");

  return `
    <div class="friend-card" data-friend-id="${userId}">
      ${renderAvatar(friend)}
      <div class="friend-card__info">
        <div class="friend-card__name"><a href="./profil.html?id=${userId}">${displayName}</a></div>
        ${username ? `<div class="friend-card__username">@${username}</div>` : ""}
      </div>
      <div class="friend-card__actions">
        <button class="btn btn--remove" onclick="removeFriend('${userId}')">Retirer</button>
      </div>
    </div>
  `;
}

/**
 * Loads friend requests from the API.
 */
async function loadRequests() {
  const list = document.getElementById("requestsList");
  try {
    const res = await fetch(`${API_BASE_URL}/api/friends/requests`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const requests = await res.json();

    if (!requests.length) {
      list.innerHTML = `<p class="empty-state" data-i18n="friends.no_requests">Aucune demande en attente.</p>`;
      return;
    }

    list.innerHTML = requests.map(renderRequestCard).join("");
  } catch (e) {
    console.error("Erreur chargement demandes:", e);
    list.innerHTML = `<p class="empty-state">Erreur de chargement des demandes.</p>`;
  }
}

/**
 * Loads friends list from the API.
 */
async function loadFriends() {
  const list = document.getElementById("friendsList");
  try {
    const res = await fetch(`${API_BASE_URL}/api/friends`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const friends = await res.json();

    if (!friends.length) {
      list.innerHTML = `<p class="empty-state" data-i18n="friends.no_friends">Aucun ami pour le moment.</p>`;
      return;
    }

    list.innerHTML = friends.map(renderFriendCard).join("");
  } catch (e) {
    console.error("Erreur chargement amis:", e);
    list.innerHTML = `<p class="empty-state">Erreur de chargement de la liste d'amis.</p>`;
  }
}

/**
 * Accept a friend request.
 */
window.acceptRequest = async function(requestId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/friends/requests/${requestId}/accept`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    loadRequests();
    loadFriends();
  } catch (e) {
    console.error("Erreur acceptation:", e);
    alert("Erreur lors de l'acceptation de la demande.");
  }
};

/**
 * Decline a friend request.
 */
window.declineRequest = async function(requestId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/friends/requests/${requestId}/decline`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    loadRequests();
  } catch (e) {
    console.error("Erreur refus:", e);
    alert("Erreur lors du refus de la demande.");
  }
};

/**
 * Remove a friend.
 */
window.removeFriend = async function(friendId) {
  if (!confirm("Retirer cet ami ?")) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/friends/${friendId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    loadFriends();
  } catch (e) {
    console.error("Erreur suppression:", e);
    alert("Erreur lors de la suppression de l'ami.");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const token = getToken();
  if (!token) {
    document.getElementById("loginPrompt").hidden = false;
  } else {
    document.getElementById("main").hidden = false;
    loadRequests();
    loadFriends();
  }
});
