// api/pipeline.js
// Vercel Edge Function — DC project pipeline ingestion
// Endpoint: GET /api/pipeline          → returns all projects as GeoJSON
//           POST /api/pipeline/refresh  → triggers fresh scrape (cron or manual)
//
// Data sources:
//   1. Epoch AI Frontier DC CSV (seeded on first run, CC-BY licensed)
//   2. datacenterknowledge.com RSS
//   3. datacenterdynamics.com RSS
//
// Setup required (Vercel env vars):
//   ANTHROPIC_API_KEY    — your Anthropic key (for news parsing)
//   SUPABASE_URL         — https://nqivrdsnlivtmijtkjqh.supabase.co
//   SUPABASE_SERVICE_KEY — service role key

export const config = { runtime: 'edge' };

const SB_URL = () => process.env.SUPABASE_URL || 'https://nqivrdsnlivtmijtkjqh.supabase.co';
const SB_KEY = () => process.env.SUPABASE_SERVICE_KEY;
const AN_KEY = () => process.env.ANTHROPIC_API_KEY;

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=1800',
};

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function sbFetch(path, opts = {}) {
  return fetch(`${SB_URL()}/rest/v1${path}`, {
    ...opts,
    headers: {
      'apikey': SB_KEY(),
      'Authorization': `Bearer ${SB_KEY()}`,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
}

async function getAllProjects() {
  const r = await sbFetch('/dc_projects?select=*&order=announced_date.desc.nullslast&limit=2000');
  if (!r.ok) return [];
  return r.json();
}

async function upsertProjects(projects) {
  if (!projects.length) return;
  // Batch upsert, dedup by external_id
  const r = await sbFetch('/dc_projects', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(projects),
  });
  return r.ok;
}

async function getLastRefresh() {
  const r = await sbFetch('/api_cache?key=eq.pipeline_last_refresh&select=fetched_at');
  if (!r.ok) return null;
  const rows = await r.json();
  return rows?.[0]?.fetched_at || null;
}

async function markRefreshed() {
  await sbFetch('/api_cache', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ key: 'pipeline_last_refresh', value: '1', fetched_at: new Date().toISOString() }),
  });
}

// ─── Epoch AI CSV ingestion ───────────────────────────────────────────────────
// Dataset: https://epoch.ai/data/notable-ai-models (also tracks DCs)
// Direct CSV: https://epoch.ai/data/large-scale-ai-infrastructure.csv
// CC-BY 4.0 licensed — free to use with attribution

async function ingestEpochAI() {
  const projects = [];
  try {
    const r = await fetch(
      'https://epoch.ai/data/large-scale-ai-infrastructure.csv',
      { signal: AbortSignal.timeout(10000) }
    );
    if (!r.ok) return projects;

    const text = await r.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // CSV parse (handles quoted fields)
      const vals = [];
      let cur = '', inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
      vals.push(cur.trim());

      const row = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });

      // Epoch AI columns (approximate — check actual CSV headers)
      const lat = parseFloat(row.latitude || row.lat);
      const lng = parseFloat(row.longitude || row.lng || row.lon);
      if (isNaN(lat) || isNaN(lng)) continue;

      const mwRaw = parseFloat(row.power_capacity_mw || row.capacity_mw || row.mw || 0);
      const status = normalizeStatus(row.status || row.phase || 'operational');

      projects.push({
        external_id: `epoch_${i}`,
        name: row.name || row.facility_name || row.project_name || `Epoch AI Project ${i}`,
        operator: row.operator || row.company || row.owner || '',
        lat, lng,
        mw: isNaN(mwRaw) ? null : mwRaw,
        status,
        announced_date: row.announced || row.year ? `${row.announced || row.year}-01-01` : null,
        source: 'epoch_ai',
        source_url: 'https://epoch.ai/data/large-scale-ai-infrastructure',
        confidence: 'high', // Epoch AI uses satellite verification
      });
    }
  } catch (e) {
    console.error('Epoch AI ingest error:', e);
  }
  return projects;
}

// ─── RSS feed scraping + Claude parsing ──────────────────────────────────────

const RSS_FEEDS = [
  { url: 'https://www.datacenterdynamics.com/en/rss/', name: 'DCD' },
  { url: 'https://www.datacenterknowledge.com/rss.xml', name: 'DCK' },
];

async function fetchRSSItems(feedUrl) {
  try {
    const r = await fetch(feedUrl, {
      headers: { 'User-Agent': 'InfraTerminal/1.0 (news aggregator)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const text = await r.text();

    // Lightweight XML parse — extract <item> blocks
    const items = [];
    const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/gi);
    for (const m of itemMatches) {
      const block = m[1];
      const title       = extractTag(block, 'title');
      const link        = extractTag(block, 'link');
      const description = extractTag(block, 'description');
      const pubDate     = extractTag(block, 'pubDate');
      if (title) items.push({ title, link, description, pubDate });
    }
    return items.slice(0, 30); // max 30 per feed
  } catch { return []; }
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'))
    || xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}

// Use Claude to extract structured DC project data from headlines
async function parseHeadlinesWithClaude(items) {
  if (!items.length || !AN_KEY()) return [];

  const headlines = items
    .map((item, i) => `${i+1}. ${item.title} — ${(item.description || '').slice(0, 150)}`)
    .join('\n');

  const prompt = `You are a data extraction assistant for a data center intelligence platform.

Extract data center project announcements from these news headlines. Only extract items that are clearly about a physical data center construction, expansion, or announcement.

Headlines:
${headlines}

For each data center project found, return a JSON array with objects having exactly these fields:
- "headline_index": number (1-based index from the list above)
- "name": string (project/campus name, or operator + city if no specific name)
- "operator": string (company building/owning it, e.g. "Microsoft", "Amazon", "Equinix")
- "city": string (city name)
- "country": string (country name, spelled out)
- "mw": number or null (power capacity in MW if mentioned, else null)
- "status": string (one of: "announced", "under_construction", "operational", "cancelled")
- "confidence": string (one of: "high", "medium", "low")

Rules:
- Only include items where you can identify a specific location (city + country minimum)
- If MW is not mentioned, use null
- If status is ambiguous, use "announced"
- Return ONLY the JSON array, no other text, no markdown

Return [] if no valid projects found.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': AN_KEY(),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!r.ok) return [];
    const j = await r.json();
    const text = j.content?.[0]?.text || '[]';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed)) return [];

    // Geocode each extracted project using Nominatim
    const geocoded = [];
    for (const p of parsed) {
      const coords = await geocodeCity(p.city, p.country);
      if (!coords) continue;
      const sourceItem = items[p.headline_index - 1];
      geocoded.push({
        external_id: `rss_${sourceItem?.link ? btoa(sourceItem.link).slice(0,32) : Math.random().toString(36).slice(2)}`,
        name: p.name,
        operator: p.operator,
        lat: coords.lat,
        lng: coords.lng,
        mw: p.mw,
        status: p.status,
        announced_date: sourceItem?.pubDate ? new Date(sourceItem.pubDate).toISOString().split('T')[0] : null,
        source: 'rss_claude',
        source_url: sourceItem?.link || '',
        confidence: p.confidence,
      });
    }
    return geocoded;
  } catch (e) {
    console.error('Claude parse error:', e);
    return [];
  }
}

// Simple geocoding via Nominatim (free, no key)
const geocodeCache = new Map();
async function geocodeCity(city, country) {
  const key = `${city},${country}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key);
  try {
    const q = encodeURIComponent(`${city}, ${country}`);
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      {
        headers: { 'User-Agent': 'InfraTerminal/1.0' },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!r.ok) return null;
    const j = await r.json();
    if (!j?.length) return null;
    const result = { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) };
    geocodeCache.set(key, result);
    return result;
  } catch { return null; }
}

function normalizeStatus(raw) {
  const s = raw.toLowerCase();
  if (s.includes('operat') || s.includes('live') || s.includes('complet')) return 'operational';
  if (s.includes('construct') || s.includes('build') || s.includes('underway')) return 'under_construction';
  if (s.includes('cancel') || s.includes('halt') || s.includes('hold') || s.includes('suspend')) return 'cancelled';
  return 'announced';
}

// Deduplicate projects by proximity (2km radius = same project)
function deduplicateProjects(existing, incoming) {
  const DEDUP_KM = 2;
  function dist(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI/180;
    const dLng = (b.lng - a.lng) * Math.PI/180;
    const aa = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
    return R*2*Math.atan2(Math.sqrt(aa),Math.sqrt(1-aa));
  }
  return incoming.filter(np =>
    !existing.some(ep => dist(ep, np) < DEDUP_KM)
  );
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);

  // GET /api/pipeline — return all projects as GeoJSON
  if (req.method === 'GET') {
    const projects = await getAllProjects();

    // Convert to GeoJSON FeatureCollection
    const geojson = {
      type: 'FeatureCollection',
      features: projects.map(p => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          name: p.name,
          operator: p.operator,
          mw: p.mw,
          status: p.status,
          announced_date: p.announced_date,
          source: p.source,
          source_url: p.source_url,
          confidence: p.confidence,
        },
      })),
      meta: {
        count: projects.length,
        generatedAt: new Date().toISOString(),
      },
    };

    return new Response(JSON.stringify(geojson), { headers: CORS });
  }

  // POST /api/pipeline/refresh — trigger fresh ingestion
  if (req.method === 'POST' && url.pathname.endsWith('/refresh')) {
    // Rate limit: don't refresh more than once per hour
    const lastRefresh = await getLastRefresh();
    if (lastRefresh) {
      const age = Date.now() - new Date(lastRefresh).getTime();
      if (age < 60 * 60 * 1000) {
        return new Response(JSON.stringify({ ok: false, reason: 'Refreshed recently', lastRefresh }), { headers: CORS });
      }
    }

    const existing = await getAllProjects();
    const allNew = [];

    // 1. Epoch AI (high priority, run always)
    const epochProjects = await ingestEpochAI();
    allNew.push(...epochProjects);

    // 2. RSS feeds
    for (const feed of RSS_FEEDS) {
      const items = await fetchRSSItems(feed.url);
      const parsed = await parseHeadlinesWithClaude(items);
      allNew.push(...parsed);
    }

    // 3. Deduplicate against existing
    const newUnique = deduplicateProjects(existing, allNew);

    // 4. Upsert to Supabase
    if (newUnique.length > 0) {
      await upsertProjects(newUnique);
    }

    await markRefreshed();

    return new Response(JSON.stringify({
      ok: true,
      epochProjects: epochProjects.length,
      rssProjects: allNew.length - epochProjects.length,
      newUnique: newUnique.length,
      total: existing.length + newUnique.length,
    }), { headers: CORS });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS });
}
