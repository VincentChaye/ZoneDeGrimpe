// character.js — Grimpeur RPG + Quêtes
// No imports needed, pure localStorage + DOM

const CHAR_KEY = 'zdg-character';
const QUEST_KEY = 'zdg-quests';

const SKIN_COLORS = {
  light: '#FDDBB4', medium: '#C8874A', tan: '#8D5524', dark: '#4A2C0A'
};
const OUTFIT_COLORS = {
  olive: '#5D7052', amber: '#C18845', stone: '#6A645A', peach: '#F0BE86'
};
const SHOES_COLORS = {
  olive: '#3D4A30', amber: '#7A4A15', stone: '#3A342C', peach: '#C07830'
};
const DEFAULT_CHAR = { skin: 'light', outfit: 'olive', helmet: 'none', levelMin: '', levelMax: '' };

function loadChar() {
  try { return { ...DEFAULT_CHAR, ...JSON.parse(localStorage.getItem(CHAR_KEY) || '{}') }; }
  catch { return { ...DEFAULT_CHAR }; }
}
function saveChar(c) { localStorage.setItem(CHAR_KEY, JSON.stringify(c)); }

function loadQuests() {
  try { return JSON.parse(localStorage.getItem(QUEST_KEY) || '[]'); }
  catch { return []; }
}
function saveQuests(q) { localStorage.setItem(QUEST_KEY, JSON.stringify(q)); }

function escapeHTML(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function applyCharacter(char) {
  const svg = document.getElementById('charSvg');
  if (!svg) return;
  svg.style.setProperty('--skin-color', SKIN_COLORS[char.skin] || SKIN_COLORS.light);
  svg.style.setProperty('--outfit-color', OUTFIT_COLORS[char.outfit] || OUTFIT_COLORS.olive);
  svg.style.setProperty('--shoes-color', SHOES_COLORS[char.outfit] || SHOES_COLORS.olive);

  const helmetNone   = document.getElementById('charHelmetNone');
  const helmetBeanie = document.getElementById('charHelmetBeanie');
  const helmetHelmet = document.getElementById('charHelmetHelmet');
  if (helmetNone)   helmetNone.style.display   = char.helmet === 'none'   ? '' : 'none';
  if (helmetBeanie) helmetBeanie.style.display = char.helmet === 'beanie' ? '' : 'none';
  if (helmetHelmet) helmetHelmet.style.display = char.helmet === 'helmet' ? '' : 'none';

  // Active swatches
  document.querySelectorAll('.swatch--skin').forEach(s =>
    s.classList.toggle('active', s.dataset.skin === char.skin)
  );
  document.querySelectorAll('.swatch--outfit').forEach(s =>
    s.classList.toggle('active', s.dataset.outfit === char.outfit)
  );
  document.querySelectorAll('.swatch--helmet').forEach(s =>
    s.classList.toggle('active', s.dataset.helmet === char.helmet)
  );

  // Level inputs
  const minEl = document.getElementById('charLevelMin');
  const maxEl = document.getElementById('charLevelMax');
  if (minEl) minEl.value = char.levelMin || '';
  if (maxEl) maxEl.value = char.levelMax || '';
}

function renderQuests() {
  const quests = loadQuests();
  const active = quests.filter(q => !q.completed);
  const done   = quests.filter(q => q.completed);

  // Update counts
  const activeCount    = document.getElementById('activeQuestCount');
  const doneCount      = document.getElementById('completedCount');
  const questCountStat = document.getElementById('questCountStat');
  if (activeCount)    activeCount.textContent    = active.length;
  if (doneCount)      doneCount.textContent      = done.length;
  if (questCountStat) questCountStat.textContent = active.length;

  // XP bar (5% per completed route, max 100)
  const xpFill  = document.getElementById('xpFill');
  const xpLabel = document.getElementById('xpLabel');
  if (xpFill)  xpFill.style.width    = Math.min(done.length * 5, 100) + '%';
  if (xpLabel) xpLabel.textContent   = `${done.length} loggée${done.length !== 1 ? 's' : ''}`;

  // Active quests
  const activeEl = document.getElementById('activeQuests');
  if (activeEl) {
    activeEl.innerHTML = active.length
      ? active.map(q => questHTML(q, false)).join('')
      : '<div class="quest-empty">Aucun projet pour l\'instant</div>';
    activeEl.querySelectorAll('[data-complete]').forEach(btn =>
      btn.addEventListener('click', () => completeQuest(btn.dataset.complete))
    );
    activeEl.querySelectorAll('[data-delete-quest]').forEach(btn =>
      btn.addEventListener('click', () => deleteQuest(btn.dataset.deleteQuest))
    );
  }

  // Completed quests
  const doneEl = document.getElementById('completedQuests');
  if (doneEl) {
    doneEl.innerHTML = done.length
      ? done.map(q => questHTML(q, true)).join('')
      : '<div class="quest-empty">Aucune voie loggée</div>';
    doneEl.querySelectorAll('[data-delete-quest]').forEach(btn =>
      btn.addEventListener('click', () => deleteQuest(btn.dataset.deleteQuest))
    );
  }
}

function questHTML(q, isDone) {
  const grade   = q.grade    ? `<span class="quest-grade">${escapeHTML(q.grade)}</span>` : '';
  const spot    = q.spotName ? `<span class="quest-spot">📍 ${escapeHTML(q.spotName)}</span>` : '';
  const date    = q.completedAt
    ? `<span class="quest-date">✓ ${new Date(q.completedAt).toLocaleDateString('fr-FR')}</span>`
    : '';
  const actions = isDone
    ? `<button class="quest-btn quest-btn--del" data-delete-quest="${q.id}" title="Supprimer">×</button>`
    : `<button class="quest-btn quest-btn--complete" data-complete="${q.id}" title="Réalisée">✓</button>
       <button class="quest-btn quest-btn--del" data-delete-quest="${q.id}" title="Supprimer">×</button>`;
  return `
    <div class="quest-item ${isDone ? 'quest-item--done' : ''}">
      <div class="quest-item__main">
        <span class="quest-name">${escapeHTML(q.routeName)}</span>
        <div class="quest-meta">${grade}${spot}${date}</div>
      </div>
      <div class="quest-item__actions">${actions}</div>
    </div>`;
}

function completeQuest(id) {
  const quests = loadQuests();
  const q = quests.find(x => x.id === id);
  if (q) { q.completed = true; q.completedAt = new Date().toISOString(); }
  saveQuests(quests);
  renderQuests();
}

function deleteQuest(id) {
  saveQuests(loadQuests().filter(x => x.id !== id));
  renderQuests();
}

function initPanelTabs() {
  const tabs   = document.querySelectorAll('.rpg-tab-btn');
  const panels = document.querySelectorAll('.rpg-panel');
  function activate(panelId) {
    tabs.forEach(t   => t.classList.toggle('active', t.dataset.panel === panelId));
    panels.forEach(p => p.classList.toggle('active', p.id === `panel-${panelId}`));
  }
  tabs.forEach(tab => tab.addEventListener('click', () => activate(tab.dataset.panel)));
}

function updateGearCount(count) {
  const el = document.getElementById('gearCountStat');
  if (el) el.textContent = count;
}

document.addEventListener('DOMContentLoaded', () => {
  const char = loadChar();
  applyCharacter(char);
  renderQuests();
  initPanelTabs();

  // Skin swatches
  document.querySelectorAll('.swatch--skin').forEach(s =>
    s.addEventListener('click', () => {
      const c = loadChar(); c.skin = s.dataset.skin; saveChar(c); applyCharacter(c);
    })
  );
  // Outfit swatches
  document.querySelectorAll('.swatch--outfit').forEach(s =>
    s.addEventListener('click', () => {
      const c = loadChar(); c.outfit = s.dataset.outfit; saveChar(c); applyCharacter(c);
    })
  );
  // Helmet swatches
  document.querySelectorAll('.swatch--helmet').forEach(s =>
    s.addEventListener('click', () => {
      const c = loadChar(); c.helmet = s.dataset.helmet; saveChar(c); applyCharacter(c);
    })
  );

  // Level inputs
  ['charLevelMin', 'charLevelMax'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      const c = loadChar();
      c.levelMin = document.getElementById('charLevelMin')?.value || '';
      c.levelMax = document.getElementById('charLevelMax')?.value || '';
      saveChar(c);
    });
  });

  // Quest modal
  const addQuestBtn  = document.getElementById('addQuestBtn');
  const questModal   = document.getElementById('questModal');
  const questForm    = document.getElementById('questForm');
  const questClose   = document.getElementById('questModalClose');
  const questCancel  = document.getElementById('questModalCancel');

  addQuestBtn?.addEventListener('click', () => questModal?.showModal());
  questClose?.addEventListener('click',  () => questModal?.close());
  questCancel?.addEventListener('click', () => questModal?.close());

  questForm?.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(questForm));
    if (!data.routeName?.trim()) return;
    const quests = loadQuests();
    quests.unshift({
      id: Date.now().toString(),
      routeName: data.routeName.trim(),
      spotName:  data.spotName?.trim()  || '',
      grade:     data.grade?.trim()     || '',
      notes:     data.notes?.trim()     || '',
      completed: false,
      createdAt: new Date().toISOString()
    });
    saveQuests(quests);
    renderQuests();
    questModal?.close();
    questForm.reset();
  });

  // Year footer
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});

// Expose for materiel-smart.js to update gear count
window.updateGearCount = updateGearCount;
