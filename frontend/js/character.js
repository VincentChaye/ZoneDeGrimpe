// character.js — DiceBear Adventurer + RPG system

const CHAR_KEY  = 'zdg-character';
const QUEST_KEY = 'zdg-quests';

const DICEBEAR_BASE = 'https://api.dicebear.com/9.x/adventurer/svg';

const SKIN_MAP = {
  light:  'f2d3b1',
  medium: 'd08b5b',
  tan:    'a57257',
  dark:   '694d3d',
};

const HAIR_MAP = {
  brown:  '6c4545',
  blonde: 'f4d150',
  black:  '2c1a0a',
  red:    'a0522d',
};

const DEFAULT_CHAR = { skin: 'light', hair: 'brown', levelMin: '', levelMax: '' };

// ── Storage ──────────────────────────────────────────

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
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ── DiceBear avatar ───────────────────────────────────

function buildAvatarUrl(char) {
  const p = new URLSearchParams({
    seed:            'ZDGgrimpeur',
    skinColor:       SKIN_MAP[char.skin]  || SKIN_MAP.light,
    hairColor:       HAIR_MAP[char.hair]  || HAIR_MAP.brown,
    backgroundColor: 'transparent',
  });
  return `${DICEBEAR_BASE}?${p}`;
}

function applyCharacter(char) {
  const fig = document.getElementById('charFigure');
  if (fig) fig.src = buildAvatarUrl(char);

  document.querySelectorAll('.swatch--skin').forEach(s =>
    s.classList.toggle('active', s.dataset.skin === char.skin)
  );
  document.querySelectorAll('.swatch--hair').forEach(s =>
    s.classList.toggle('active', s.dataset.hair === char.hair)
  );

  const minEl = document.getElementById('charLevelMin');
  const maxEl = document.getElementById('charLevelMax');
  if (minEl) minEl.value = char.levelMin || '';
  if (maxEl) maxEl.value = char.levelMax || '';
}

// ── Equipment slot counts ─────────────────────────────

function updateSlotCounts(items) {
  const counts = {};
  (items || []).forEach(item => {
    const cat = item?.category || 'Autre';
    counts[cat] = (counts[cat] || 0) + 1;
  });

  document.querySelectorAll('[data-slot-count]').forEach(badge => {
    const n = counts[badge.dataset.slotCount] || 0;
    badge.textContent = n || '';
    badge.style.display = n > 0 ? 'flex' : 'none';
  });

  const gearEl = document.getElementById('gearCountStat');
  if (gearEl) gearEl.textContent = items?.length ?? '—';
}
window.updateSlotCounts = updateSlotCounts;

// ── Content tabs (desktop right panel) ───────────────

function activateContentTab(contentId) {
  document.querySelectorAll('.content-tab-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.content === contentId)
  );
  document.querySelectorAll('.content-sub').forEach(sub =>
    sub.classList.toggle('content-sub--active', sub.id === `content-${contentId}`)
  );
}
window.activateContentTab = activateContentTab;

// ── Equipment slot clicks ─────────────────────────────

function initSlots() {
  document.querySelectorAll('.eq-slot').forEach(slot => {
    slot.addEventListener('click', () => {
      const cat = slot.dataset.cat;
      const filterSelect = document.getElementById('gearTagFilter');
      if (!filterSelect) return;

      // Toggle: click same slot again to clear filter
      const newVal = filterSelect.value === cat ? '' : cat;
      filterSelect.value = newVal;
      filterSelect.dispatchEvent(new Event('change')); // triggers refresh in materiel-smart.js

      // Sync active state on all slots
      document.querySelectorAll('.eq-slot').forEach(s =>
        s.classList.toggle('eq-slot--active', !!newVal && s.dataset.cat === cat)
      );

      // On mobile: switch to content panel, inventory sub-tab
      if (window.innerWidth < 768) {
        document.querySelectorAll('.rpg-tab-btn').forEach(t =>
          t.classList.toggle('active', t.dataset.panel === 'inventory')
        );
        document.getElementById('panel-character')?.classList.remove('active');
        document.getElementById('panel-content')?.classList.add('active');
      }
      activateContentTab('inventory');
    });
  });

  // Keep slot active state in sync when filter is changed elsewhere
  document.getElementById('gearTagFilter')?.addEventListener('change', e => {
    const val = e.target.value;
    document.querySelectorAll('.eq-slot').forEach(s =>
      s.classList.toggle('eq-slot--active', !!val && s.dataset.cat === val)
    );
  });
}

// ── Mobile panel tabs ─────────────────────────────────

function initPanelTabs() {
  const tabs         = document.querySelectorAll('.rpg-tab-btn');
  const charPanel    = document.getElementById('panel-character');
  const contentPanel = document.getElementById('panel-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const panelId = tab.dataset.panel;
      tabs.forEach(t => t.classList.toggle('active', t.dataset.panel === panelId));

      if (panelId === 'character') {
        charPanel?.classList.add('active');
        contentPanel?.classList.remove('active');
      } else {
        charPanel?.classList.remove('active');
        contentPanel?.classList.add('active');
        activateContentTab(panelId === 'inventory' ? 'inventory' : 'quests');
      }
    });
  });
}

function initContentTabsNav() {
  document.querySelectorAll('.content-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activateContentTab(btn.dataset.content));
  });
}

// ── Quests ────────────────────────────────────────────

function renderQuests() {
  const quests = loadQuests();
  const active = quests.filter(q => !q.completed);
  const done   = quests.filter(q =>  q.completed);

  const activeCount    = document.getElementById('activeQuestCount');
  const doneCount      = document.getElementById('completedCount');
  const questCountStat = document.getElementById('questCountStat');
  if (activeCount)    activeCount.textContent    = active.length;
  if (doneCount)      doneCount.textContent      = done.length;
  if (questCountStat) questCountStat.textContent = active.length;

  const xpFill  = document.getElementById('xpFill');
  const xpLabel = document.getElementById('xpLabel');
  if (xpFill)  xpFill.style.width  = Math.min(done.length * 5, 100) + '%';
  if (xpLabel) xpLabel.textContent = `${done.length} loggée${done.length !== 1 ? 's' : ''}`;

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

// ── Legacy — exposed for materiel-smart.js ───────────
function updateGearCount(count) {
  const el = document.getElementById('gearCountStat');
  if (el) el.textContent = count;
}
window.updateGearCount = updateGearCount;

// ── Init ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const char = loadChar();
  applyCharacter(char);
  renderQuests();
  initPanelTabs();
  initContentTabsNav();
  initSlots();

  // Skin swatches
  document.querySelectorAll('.swatch--skin').forEach(s =>
    s.addEventListener('click', () => {
      const c = loadChar(); c.skin = s.dataset.skin; saveChar(c); applyCharacter(c);
    })
  );

  // Hair swatches
  document.querySelectorAll('.swatch--hair').forEach(s =>
    s.addEventListener('click', () => {
      const c = loadChar(); c.hair = s.dataset.hair; saveChar(c); applyCharacter(c);
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
  const addQuestBtn = document.getElementById('addQuestBtn');
  const questModal  = document.getElementById('questModal');
  const questForm   = document.getElementById('questForm');
  const questClose  = document.getElementById('questModalClose');
  const questCancel = document.getElementById('questModalCancel');

  addQuestBtn?.addEventListener('click', () => questModal?.showModal());
  questClose?.addEventListener('click',  () => questModal?.close());
  questCancel?.addEventListener('click', () => questModal?.close());

  questForm?.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(questForm));
    if (!data.routeName?.trim()) return;
    const quests = loadQuests();
    quests.unshift({
      id:        Date.now().toString(),
      routeName: data.routeName.trim(),
      spotName:  data.spotName?.trim()  || '',
      grade:     data.grade?.trim()     || '',
      notes:     data.notes?.trim()     || '',
      completed: false,
      createdAt: new Date().toISOString(),
    });
    saveQuests(quests);
    renderQuests();
    questModal?.close();
    questForm.reset();
  });

  // Footer year
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
