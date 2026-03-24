// logbook.js — Carnet de grimpe

const API_BASE_URL = window.APP_CONFIG?.API_URL || "http://localhost:3000";

const STYLE_LABELS = {
  onsight: "A vue",
  flash: "Flash",
  redpoint: "Enchaine",
  repeat: "Repet",
};

const STYLE_BADGE_CLASS = {
  onsight: "logbook-badge--onsight",
  flash: "logbook-badge--flash",
  redpoint: "logbook-badge--redpoint",
  repeat: "logbook-badge--repeat",
};

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getAuth() {
  try {
    return JSON.parse(localStorage.getItem("auth") || "null");
  } catch {
    return null;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const auth = getAuth();

  if (!auth?.token) {
    document.getElementById("loginPrompt").hidden = false;
    return;
  }

  document.getElementById("main").hidden = false;
  const headers = { Authorization: `Bearer ${auth.token}` };

  // Fetch entries and stats in parallel
  const [entriesRes, statsRes] = await Promise.allSettled([
    fetch(`${API_BASE_URL}/api/logbook`, { headers }),
    fetch(`${API_BASE_URL}/api/logbook/stats`, { headers }),
  ]);

  // --- Stats ---
  if (statsRes.status === "fulfilled" && statsRes.value.ok) {
    try {
      const stats = await statsRes.value.json();
      document.getElementById("statTotal").textContent = stats.totalAscents ?? 0;
      document.getElementById("statSpots").textContent = stats.uniqueSpots ?? 0;

      // Grade pyramid
      if (stats.gradeDistribution && Object.keys(stats.gradeDistribution).length > 0) {
        renderPyramid(stats.gradeDistribution);
      }
    } catch (e) {
      console.error("Failed to parse logbook stats:", e);
    }
  }

  // --- Entries timeline ---
  const listEl = document.getElementById("logbookList");
  if (entriesRes.status === "fulfilled" && entriesRes.value.ok) {
    try {
      const entries = await entriesRes.value.json();
      renderTimeline(entries, listEl);
    } catch (e) {
      console.error("Failed to parse logbook entries:", e);
      listEl.innerHTML = `<p class="empty-state">Erreur de chargement.</p>`;
    }
  } else {
    listEl.innerHTML = `<p class="empty-state">Erreur de chargement.</p>`;
  }
});

/**
 * Render grade pyramid as horizontal bars.
 * gradeDistribution: { "6a": 5, "6b": 3, "7a": 1, ... }
 */
function renderPyramid(dist) {
  const section = document.getElementById("pyramidSection");
  const container = document.getElementById("pyramid");

  // Sort grades in climbing order (ascending)
  const gradeOrder = sortGrades(Object.keys(dist));
  const maxCount = Math.max(...Object.values(dist), 1);

  section.style.display = "";
  container.innerHTML = gradeOrder
    .map((grade) => {
      const count = dist[grade];
      const pct = Math.round((count / maxCount) * 100);
      return `
      <div class="pyramid__row">
        <span class="pyramid__grade">${esc(grade)}</span>
        <div class="pyramid__bar-bg">
          <div class="pyramid__bar" style="width:${pct}%"></div>
        </div>
        <span class="pyramid__count">${count}</span>
      </div>`;
    })
    .join("");
}

/**
 * Sort climbing grades: 3, 4a, 4b, 4c, 5a ... 9c
 */
function sortGrades(grades) {
  return grades.slice().sort((a, b) => {
    const pa = parseGrade(a);
    const pb = parseGrade(b);
    if (pa.num !== pb.num) return pa.num - pb.num;
    if (pa.letter !== pb.letter) return pa.letter.localeCompare(pb.letter);
    return (pa.mod || "").localeCompare(pb.mod || "");
  });
}

function parseGrade(g) {
  const m = String(g).match(/^(\d+)([a-cA-C]?)(\+?)$/);
  if (!m) return { num: 0, letter: "", mod: "" };
  return { num: parseInt(m[1], 10), letter: (m[2] || "").toLowerCase(), mod: m[3] };
}

/**
 * Render timeline of logbook entries.
 */
function renderTimeline(entries, container) {
  if (!entries || entries.length === 0) {
    container.innerHTML = `<p class="empty-state" data-i18n="logbook.no_entries">Aucune ascension enregistree.</p>`;
    return;
  }

  // Sort by date descending (most recent first)
  entries.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

  container.innerHTML = entries
    .map((entry) => {
      const date = entry.date || entry.createdAt;
      const dateStr = date
        ? new Date(date).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "";
      const spotName = entry.spotName || entry.spot?.name || "Spot inconnu";
      const spotId = entry.spotId || entry.spot?._id || "";
      const routeName = entry.routeName || entry.route?.name || "";
      const grade = entry.grade || entry.route?.grade || "";
      const style = entry.style || "";
      const styleBadgeClass = STYLE_BADGE_CLASS[style] || "logbook-badge--repeat";
      const styleLabel = STYLE_LABELS[style] || style;
      const comment = entry.comment || "";

      return `
      <div class="logbook-entry"${spotId ? ` onclick="location.href='./map.html?spot=${esc(spotId)}'"` : ""}>
        <div class="logbook-entry__top">
          <span class="logbook-entry__spot">${esc(spotName)}</span>
          <span class="logbook-entry__date">${esc(dateStr)}</span>
        </div>
        <div class="logbook-entry__details">
          ${routeName ? `<span class="logbook-entry__route">${esc(routeName)}</span>` : ""}
          ${grade ? `<span class="logbook-badge logbook-badge--grade">${esc(grade)}</span>` : ""}
          ${style ? `<span class="logbook-badge ${styleBadgeClass}">${esc(styleLabel)}</span>` : ""}
        </div>
        ${comment ? `<p style="font-size:.82rem;color:var(--text-2);margin:0">${esc(comment)}</p>` : ""}
      </div>`;
    })
    .join("");
}
