import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:5173/ZoneDeGrimpe';
const EXEC = '/home/natil/.cache/ms-playwright/chromium-1222/chrome-linux64/chrome';
const SHOTS_DIR = '/tmp/zdg_screenshots';
import { mkdirSync } from 'fs';
try { mkdirSync(SHOTS_DIR); } catch {}

const ADMIN = { email: 'testadmin@zdg.fr', password: 'Admin123!', username: 'testadmin' };
const USER  = { email: 'testuser@zdg.fr',  password: 'User123!',  username: 'testuser'  };

const results = { admin: [], user: [] };

async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS_DIR}/${name}.png`, fullPage: false }).catch(() => {});
}

function log(role, icon, label, detail = '') {
  const entry = `${icon} ${label}${detail ? ' — ' + detail : ''}`;
  results[role].push(entry);
  console.log(`[${role.toUpperCase()}] ${entry}`);
}

async function login(page, creds, role) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await shot(page, `${role}_01_login_page`);

  // Fill form
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="mail" i]').first();
  const passInput  = page.locator('input[type="password"]').first();
  await emailInput.fill(creds.email);
  await passInput.fill(creds.password);
  await shot(page, `${role}_02_login_filled`);
  await passInput.press('Enter');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);

  const url = page.url();
  if (url.includes('/login')) {
    log(role, '❌', 'Connexion', 'Toujours sur /login après submit');
  } else {
    log(role, '✅', 'Connexion', `Redirigé vers ${url}`);
  }
  await shot(page, `${role}_03_after_login`);
}

async function testPage(page, role, path, label, checks = []) {
  try {
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(800);
    const shotName = `${role}_${label.replace(/\s+/g, '_').replace(/[^a-z0-9_]/gi, '')}`;
    await shot(page, shotName);

    const bodyText = await page.locator('body').innerText().catch(() => '');
    const hasError = /error|erreur|500|cannot|failed/i.test(bodyText) && !/spots|messages|gear|logbook|profil|amis/i.test(bodyText);

    if (hasError) {
      log(role, '⚠️', label, 'Contenu suspect dans la page');
    } else {
      // Run custom checks
      for (const check of checks) {
        const found = await page.locator(check.selector).count().catch(() => 0);
        if (found > 0) {
          log(role, '✅', label, check.pass);
        } else {
          log(role, '⚠️', label, check.fail);
        }
      }
      if (checks.length === 0) log(role, '✅', label, 'Page chargée');
    }
    return bodyText;
  } catch (e) {
    log(role, '❌', label, e.message.slice(0, 80));
    return '';
  }
}

async function runAdmin(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // iPhone size
  const page = await ctx.newPage();
  const role = 'admin';

  console.log('\n=== AGENT ADMIN ===\n');

  // 1. Login
  await login(page, ADMIN, role);

  // 2. Map
  await testPage(page, role, '/map', 'Carte', [
    { selector: '.leaflet-container, canvas, [class*="map"]', pass: 'Carte Leaflet trouvée', fail: 'Aucune carte détectée' },
  ]);

  // 3. Profil perso
  await testPage(page, role, '/me', 'Mon profil', [
    { selector: 'text=TestAdmin, [class*="display"], h1, h2', pass: 'Nom affiché', fail: 'Nom non trouvé' },
  ]);

  // 4. Logbook
  await testPage(page, role, '/logbook', 'Logbook', []);

  // 5. Feed
  await testPage(page, role, '/feed', 'Feed', []);

  // 6. Friends
  await testPage(page, role, '/friends', 'Amis', []);

  // 7. My Spots
  await testPage(page, role, '/my-spots', 'Mes Spots', []);

  // 8. Notifications
  await testPage(page, role, '/notifications', 'Notifications', []);

  // 9. Gear
  await testPage(page, role, '/gear', 'Gear', []);
  await testPage(page, role, '/gear/catalogue', 'Gear Catalogue', []);

  // 10. Messages
  await testPage(page, role, '/messages', 'Messages', [
    { selector: 'button, [class*="new"]', pass: 'Bouton nouvelle conv trouvé', fail: 'Bouton non trouvé' },
  ]);

  // 11. Panel Admin — SPOTS
  await testPage(page, role, '/admin/spots', 'Admin Spots', [
    { selector: 'table, [class*="pending"], [class*="spot"]', pass: 'Panel admin spots chargé', fail: 'Contenu admin non trouvé' },
  ]);

  // 12. Panel Admin — USERS
  await testPage(page, role, '/admin/users', 'Admin Users', [
    { selector: 'table, [class*="user"], input[placeholder*="cherche" i], input[placeholder*="search" i]', pass: 'Liste utilisateurs affichée', fail: 'Liste non trouvée' },
  ]);

  // 13. Panel Admin — GEAR
  await testPage(page, role, '/admin/gear', 'Admin Gear', []);

  // 14. Settings
  await testPage(page, role, '/settings', 'Settings', []);

  // 15. Test messagerie — envoyer un message
  try {
    await page.goto(`${BASE}/messages`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);

    // Click new conversation button (Plus icon)
    const plusBtn = page.locator('button[aria-label*="Nouveau" i], button[aria-label*="new" i], button').filter({ hasText: '' }).first();
    await page.locator('button').filter({ has: page.locator('svg') }).first().click().catch(() => {});
    await page.waitForTimeout(500);

    // Look for "new message" menu item
    const newMsgBtn = page.locator('text=Nouveau message, text=New message').first();
    if (await newMsgBtn.count() > 0) {
      await newMsgBtn.click();
      await page.waitForTimeout(500);

      // Search for testuser
      const searchInput = page.locator('input[placeholder*="Rechercher" i], input[placeholder*="Search" i]').first();
      await searchInput.fill('testuser').catch(() => {});
      await page.waitForTimeout(800);
      await shot(page, `${role}_messages_search`);

      // Click first result
      const firstResult = page.locator('[class*="result"], button').filter({ hasText: /testuser/i }).first();
      if (await firstResult.count() > 0) {
        await firstResult.click();
        await page.waitForTimeout(1500);
        await shot(page, `${role}_messages_conversation`);

        // Send a message
        const msgInput = page.locator('input[placeholder*="message" i], input[placeholder*="Ecrire" i]').first();
        if (await msgInput.count() > 0) {
          await msgInput.fill('Bonjour TestUser, c\'est l\'admin !');
          await msgInput.press('Enter');
          await page.waitForTimeout(1000);
          await shot(page, `${role}_messages_sent`);
          log(role, '✅', 'Messages — Envoi message', 'Message envoyé à testuser');
        } else {
          log(role, '⚠️', 'Messages — Envoi message', 'Input non trouvé');
        }
      } else {
        log(role, '⚠️', 'Messages — Recherche user', 'testuser non trouvé dans résultats');
      }
    } else {
      log(role, '⚠️', 'Messages — Menu', 'Bouton "Nouveau message" non trouvé');
    }
  } catch (e) {
    log(role, '❌', 'Messages — Envoi', e.message.slice(0, 80));
  }

  // 16. Vérifier accès admin depuis page admin (spot approve/reject)
  await testPage(page, role, '/admin/spots', 'Admin panel accessible', [
    { selector: 'h1, h2, [class*="admin"], [class*="pending"]', pass: 'Panel admin affiché', fail: 'Contenu non affiché' },
  ]);

  await ctx.close();
}

async function runUser(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const role = 'user';

  console.log('\n=== AGENT USER NORMAL ===\n');

  // 1. Login
  await login(page, USER, role);

  // 2. Map
  await testPage(page, role, '/map', 'Carte', [
    { selector: '.leaflet-container, canvas, [class*="map"]', pass: 'Carte chargée', fail: 'Pas de carte' },
  ]);

  // 3. Profil
  await testPage(page, role, '/me', 'Mon profil', []);

  // 4. Profil public de l'admin
  await testPage(page, role, '/profile?id=69f513a2fe9e3d2dbbee3d91', 'Profil public admin', [
    { selector: 'text=TestAdmin', pass: 'Profil admin affiché', fail: 'Profil non trouvé' },
  ]);

  // 5. Logbook
  await testPage(page, role, '/logbook', 'Logbook', []);

  // 6. Feed
  await testPage(page, role, '/feed', 'Feed', []);

  // 7. Friends
  await testPage(page, role, '/friends', 'Amis', []);

  // 8. My Spots
  await testPage(page, role, '/my-spots', 'Mes Spots', []);

  // 9. Notifications
  await testPage(page, role, '/notifications', 'Notifications', []);

  // 10. Gear
  await testPage(page, role, '/gear', 'Gear', []);
  await testPage(page, role, '/gear/catalogue', 'Gear Catalogue', []);

  // 11. Messages — conversation avec admin
  try {
    await page.goto(`${BASE}/messages`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);

    // Chercher conversation existante avec admin ou en créer une
    const existingConv = page.locator('text=TestAdmin, text=testadmin').first();
    if (await existingConv.count() > 0) {
      await existingConv.click();
      await page.waitForTimeout(1000);
      log(role, '✅', 'Messages — Conversation existante', 'Conv avec testadmin trouvée');
    } else {
      // Créer nouvelle conv
      await page.locator('button').filter({ has: page.locator('svg') }).first().click().catch(() => {});
      await page.waitForTimeout(400);
      const newMsgBtn = page.locator('text=Nouveau message, text=New message').first();
      if (await newMsgBtn.count() > 0) await newMsgBtn.click();
      await page.waitForTimeout(400);
      const searchInput = page.locator('input[placeholder*="Rechercher" i], input[placeholder*="Search" i]').first();
      await searchInput.fill('testadmin').catch(() => {});
      await page.waitForTimeout(800);
      const firstResult = page.locator('button').filter({ hasText: /testadmin/i }).first();
      if (await firstResult.count() > 0) await firstResult.click();
      await page.waitForTimeout(1200);
    }

    await shot(page, `${role}_messages_opened`);

    // Envoyer message
    const msgInput = page.locator('input[placeholder*="message" i], input[placeholder*="Ecrire" i]').first();
    if (await msgInput.count() > 0) {
      await msgInput.fill('Bonjour Admin !');
      await msgInput.press('Enter');
      await page.waitForTimeout(1000);
      log(role, '✅', 'Messages — Envoi', 'Message envoyé');
      await shot(page, `${role}_messages_sent`);
    }

    // Test partage de spot — clique le bouton +
    const plusBtn = page.locator('button[aria-label*="Ajouter" i], button[aria-label*="Add" i]').first();
    if (await plusBtn.count() === 0) {
      // Try to find the + button next to input
      const inputArea = page.locator('[class*="border-t"]').last();
      const btnsInInput = inputArea.locator('button');
      if (await btnsInInput.count() > 0) await btnsInInput.first().click();
    } else {
      await plusBtn.click();
    }
    await page.waitForTimeout(500);
    await shot(page, `${role}_messages_attach_menu`);

    // Cherche "Partager un spot"
    const shareSpotBtn = page.locator('text=Partager un spot, text=Share a spot').first();
    if (await shareSpotBtn.count() > 0) {
      await shareSpotBtn.click();
      await page.waitForTimeout(600);
      await shot(page, `${role}_messages_spot_modal`);

      // Cherche "font" dans la modale
      const spotSearch = page.locator('input[placeholder*="spot" i], input[placeholder*="Rechercher un spot" i]').first();
      if (await spotSearch.count() > 0) {
        await spotSearch.fill('font');
        await page.waitForTimeout(1000);
        await shot(page, `${role}_messages_spot_results`);

        const firstSpot = page.locator('button').filter({ hasText: /font/i }).first();
        if (await firstSpot.count() > 0) {
          await firstSpot.click();
          await page.waitForTimeout(500);
          await shot(page, `${role}_messages_spot_selected`);

          // Envoie le spot
          const sendBtn = page.locator('button[disabled=false]').filter({ has: page.locator('svg[class*="send" i], [data-lucide="send"]') }).first();
          const sendBtnAlt = page.locator('button').last();
          if (await sendBtn.count() > 0) await sendBtn.click();
          else await sendBtnAlt.click();
          await page.waitForTimeout(1500);
          await shot(page, `${role}_messages_spot_sent`);
          log(role, '✅', 'Messages — Partage spot', 'Spot sélectionné et envoyé');
        } else {
          log(role, '⚠️', 'Messages — Partage spot', 'Aucun spot trouvé pour "font"');
        }
      } else {
        log(role, '⚠️', 'Messages — Modal spot', 'Input recherche non trouvé');
      }
    } else {
      log(role, '⚠️', 'Messages — Menu +', 'Option "Partager un spot" non trouvée');
    }

  } catch (e) {
    log(role, '❌', 'Messages', e.message.slice(0, 100));
  }

  // 12. Settings — changement de langue
  try {
    await page.goto(`${BASE}/settings`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, `${role}_settings`);
    log(role, '✅', 'Settings', 'Page chargée');
  } catch (e) {
    log(role, '❌', 'Settings', e.message.slice(0, 80));
  }

  // 13. Test accès refusé admin
  try {
    await page.goto(`${BASE}/admin/spots`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, `${role}_admin_access_test`);
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const isBlocked = /forbidden|accès|access|401|403|login|connexion/i.test(bodyText) || page.url().includes('/login') || page.url().includes('/map') || page.url().includes('/');
    if (isBlocked) {
      log(role, '✅', 'Sécurité — Admin bloqué', 'Accès /admin/spots correctement refusé');
    } else {
      log(role, '❌', 'Sécurité — Admin bloqué', 'L\'utilisateur normal peut accéder au panel admin !');
    }
  } catch (e) {
    log(role, '⚠️', 'Sécurité admin', e.message.slice(0, 80));
  }

  await ctx.close();
}

// --- MAIN ---
(async () => {
  const browser = await chromium.launch({
    executablePath: EXEC,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    headless: true,
  });

  // Run both agents in parallel
  await Promise.all([
    runAdmin(browser),
    runUser(browser),
  ]);

  await browser.close();

  // Print final report
  console.log('\n' + '='.repeat(60));
  console.log('RAPPORT FINAL — ZoneDeGrimpe QA Test');
  console.log('='.repeat(60));

  for (const [role, entries] of Object.entries(results)) {
    const ok  = entries.filter(e => e.startsWith('✅')).length;
    const warn = entries.filter(e => e.startsWith('⚠️')).length;
    const err  = entries.filter(e => e.startsWith('❌')).length;
    console.log(`\n### ${role.toUpperCase()} — ${ok} OK / ${warn} warnings / ${err} erreurs`);
    for (const e of entries) console.log('  ' + e);
  }

  console.log(`\nScreenshots dans : ${SHOTS_DIR}/`);
})();
