/**
 * Pour chaque modèle de chaque CSV matériel :
 *   1. Cherche une image via DuckDuckGo Image API
 *   2. Fallback : Google Images via Playwright
 *   3. Upload sur Cloudinary
 *   4. Écrit l'URL Cloudinary dans la colonne "Image" du CSV
 *
 * Usage : node scripts/csv-images-cloudinary.js
 * Reprise : les lignes ayant déjà une URL Cloudinary sont ignorées.
 */

import { chromium } from 'playwright';
import { v2 as cloudinary } from 'cloudinary';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Cloudinary ───────────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: 'dgwuvkuvm',
  api_key:    '132551378852163',
  api_secret: 'oljGSo4lur3M9kcdxN__BB7jlYk',
});

// ── Config ───────────────────────────────────────────────────────────────────
const DOWNLOADS_DIR  = '/home/natil/Downloads';
const CHROMIUM_PATH  = '/home/natil/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';

const CSV_FILES = [
  { file: 'assureur.csv',   category: 'assureur'   },
  { file: 'baudrier.csv',   category: 'baudrier'   },
  { file: 'chausson.csv',   category: 'chausson'   },
  { file: 'corde.csv',      category: 'corde'      },
  { file: 'crashpad.csv',   category: 'crashpad'   },
  { file: 'degaine.csv',    category: 'degaine'    },
  { file: 'mousqueton.csv', category: 'mousqueton' },
  { file: 'plaquette.csv',  category: 'plaquette'  },
];

// ── CSV helpers ──────────────────────────────────────────────────────────────
function parseLine(line) {
  const cols = [];
  let cur = '', inQ = false;
  for (const c of line) {
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  cols.push(cur.trim());
  return cols;
}

function parseCSV(txt) {
  const lines = txt.replace(/\r\n/g, '\n').trim().split('\n');
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).filter(l => l.trim()).map(l => {
    const vals = parseLine(l);
    const row  = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
    return row;
  });
  return { headers, rows };
}

function serializeCSV(headers, rows) {
  const esc = v => {
    if (!v) return '';
    return (v.includes(',') || v.includes('"') || v.includes('\n'))
      ? `"${v.replace(/"/g, '""')}"`
      : v;
  };
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => esc(r[h] || '')).join(',')),
  ].join('\n');
}

function getColumns(headers) {
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const brandCol = headers.find(h => norm(h).includes('marque')) || headers[0];
  // "Modele", "Modèle", "Modèle", "Modèle" → all normalize to "modele"
  const modelCol = headers.find(h => {
    const n = norm(h);
    return n === 'modele' || n.startsWith('modele') || n === 'model';
  }) || headers[1];
  return { brandCol, modelCol };
}

// ── Image search ─────────────────────────────────────────────────────────────

// Primary: DuckDuckGo image API (no browser required, fast)
async function searchDDG(brand, model, category) {
  try {
    const query = `${brand} ${model} ${category} escalade`;
    const UA    = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

    // 1. Get vqd token
    const init = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}&ia=images`,
      { headers: { 'User-Agent': UA } }
    );
    const html   = await init.text();
    const vqdM   = html.match(/vqd=['"]([^'"]+)['"]/);
    if (!vqdM) return null;

    // 2. Fetch images JSON
    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqdM[1])}&l=fr-fr&o=json&s=0`,
      { headers: { 'User-Agent': UA, 'Referer': 'https://duckduckgo.com/' } }
    );
    if (!imgRes.ok) return null;

    const data = await imgRes.json();
    for (const r of (data.results || []).slice(0, 5)) {
      if (r.image?.startsWith('https://') && !r.image.includes('duckduckgo')) {
        return r.image;
      }
    }
  } catch { /* fall through */ }
  return null;
}

// Fallback: Google Images via Playwright
async function searchGoogle(page, brand, model, category) {
  const query = `${brand} ${model} ${category} climbing gear`;
  try {
    await page.goto(
      `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&hl=fr`,
      { waitUntil: 'domcontentloaded', timeout: 20000 }
    );

    // Accept cookies banner if present
    try {
      const btn = page.locator('button:has-text("Tout accepter"), button:has-text("Accept all")').first();
      if (await btn.isVisible({ timeout: 2000 })) await btn.click();
    } catch { /* no banner */ }

    await page.waitForTimeout(1500);

    // Extract actual image URLs from embedded JS data
    const html = await page.content();
    const hits = [...html.matchAll(/"(https:\/\/(?!encrypted)[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi)]
      .map(m => m[1])
      .filter(u => !u.includes('google') && !u.includes('gstatic') && !u.includes('googleapis'));

    if (hits.length > 0) return hits[0];
  } catch (e) {
    console.error(`    Google error: ${String(e.message).slice(0, 70)}`);
  }
  return null;
}

// ── Cloudinary upload ────────────────────────────────────────────────────────
async function uploadToCloudinary(imgUrl, brand, model, category) {
  const slug = `${brand}-${model}`
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-|-$/g, '');

  const publicId = `zonedegrimpe/materiel/${category}/${slug}`;

  try {
    const res = await cloudinary.uploader.upload(imgUrl, {
      public_id:    publicId,
      overwrite:    false,
      quality:      'auto:good',
      fetch_format: 'auto',
      transformation: [{ width: 600, height: 600, crop: 'limit' }],
    });
    return res.secure_url;
  } catch (e) {
    // If already exists (overwrite:false), the error contains the existing URL
    if (e.message?.includes('already exists')) {
      const url = `https://res.cloudinary.com/dgwuvkuvm/image/upload/zonedegrimpe/materiel/${category}/${slug}`;
      return url;
    }
    console.error(`    Cloudinary: ${String(e.message).slice(0, 80)}`);
    return null;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  let browser = null;
  let page    = null;

  // Lazy browser init — only opened if DDG fails
  const getPage = async () => {
    if (!page) {
      console.log('  🌐 Lancement de Chromium (fallback Google)...');
      browser = await chromium.launch({
        executablePath: CHROMIUM_PATH,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const ctx = await browser.newContext({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        locale: 'fr-FR',
      });
      page = await ctx.newPage();
    }
    return page;
  };

  let total    = 0;
  let uploaded = 0;
  let notFound = 0;

  for (const { file, category } of CSV_FILES) {
    const filePath = path.join(DOWNLOADS_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.log(`\n⚠  ${file} introuvable — ignoré`);
      continue;
    }

    const { headers, rows } = parseCSV(fs.readFileSync(filePath, 'utf8'));
    const { brandCol, modelCol } = getColumns(headers);

    if (!headers.includes('Image')) headers.push('Image');

    console.log(`\n📁 ${file}  (${rows.length} modèles)  brand="${brandCol}"  model="${modelCol}"`);

    for (let i = 0; i < rows.length; i++) {
      const row   = rows[i];
      const brand = row[brandCol]?.trim() || '';
      const model = row[modelCol]?.trim() || '';
      if (!brand || !model) continue;

      // Déjà traité
      if (row['Image']?.startsWith('https://res.cloudinary.com')) {
        process.stdout.write(`  ⏭  [${i+1}/${rows.length}] ${brand} ${model}          \r`);
        continue;
      }

      console.log(`  🔍 [${i+1}/${rows.length}] ${brand} ${model}`);
      total++;

      // 1. DuckDuckGo
      let imgUrl = await searchDDG(brand, model, category);

      // 2. Fallback Google via Playwright
      if (!imgUrl) {
        process.stdout.write('    ↩  DDG vide, fallback Google...\n');
        imgUrl = await searchGoogle(await getPage(), brand, model, category);
      }

      if (!imgUrl) {
        console.log('    ⚠  Aucune image trouvée');
        notFound++;
        continue;
      }

      // 3. Upload Cloudinary
      const cloudUrl = await uploadToCloudinary(imgUrl, brand, model, category);
      if (cloudUrl) {
        row['Image'] = cloudUrl;
        uploaded++;
        console.log(`    ✅ ${cloudUrl}`);
      } else {
        notFound++;
      }

      // Sauvegarde incrémentale (reprise possible si coupure)
      fs.writeFileSync(filePath, serializeCSV(headers, rows), 'utf8');

      // Petit délai anti-rate-limit
      await new Promise(r => setTimeout(r, 700 + Math.random() * 600));
    }

    // Sauvegarde finale du CSV
    fs.writeFileSync(filePath, serializeCSV(headers, rows), 'utf8');
    console.log(`  💾 ${file} sauvegardé`);
  }

  if (browser) await browser.close();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅  ${uploaded} / ${total} uploadés sur Cloudinary`);
  console.log(`⚠   ${notFound} sans image`);
}

main().catch(e => { console.error('\n❌ Fatal:', e); process.exit(1); });
