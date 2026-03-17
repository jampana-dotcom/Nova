// api/refresh.js
// Vercel Edge Function — triggers DC project pipeline refresh
// Endpoint: POST /api/refresh
// Pulls Epoch AI CSV + RSS feeds, parses via Claude, upserts to Supabase

export const config = { runtime: 'edge' };

const SB_URL = () => process.env.SUPABASE_URL || 'https://nqivrdsnlivtmijtkjqh.supabase.co';
const SB_KEY = () => process.env.SUPABASE_SERVICE_KEY;
const AN_KEY = () => process.env.ANTHROPIC_API_KEY;

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

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
  const r = await sbFetch('/dc_projects?select=lat,lng&limit=5000');
  if (!r.ok) return [];
  return r.json();
}

async function upsertProjects(projects) {
  if (!projects.length) return;
  const r = await sbFetch('/dc_projects', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(projects),
  });
  return r.ok;
}

async function getLastRefresh() {
  try {
    const r = await sbFetch('/api_cache?key=eq.pipeline_last_refresh&select=fetched_at');
    if (!r.ok) return null;
    const rows = await r.json();
    return rows?.[0]?.fetched_at || null;
  } catch { return null; }
}

async function markRefreshed() {
  await sbFetch('/api_cache', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ key: 'pipeline_last_refresh', value: '1', fetched_at: new Date().toISOString() }),
  });
}

async function ingestEpochAI() {
  const projects = [];
  try {
    const r = await fetch('https://epoch.ai/data/large-scale-ai-infrastructure.csv', {
      headers: { 'User-Agent': 'InfraTerminal/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return projects;
    const text = await r.text();
    const lines = text.split('\n');
    if (lines.length < 2) return projects;
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''));

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
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

      const lat = parseFloat(row.latitude || row.lat);
      const lng = parseFloat(row.longitude || row.lng || row.lon);
      if (isNaN(lat) || isNaN(lng)) continue;

      const mwRaw = parseFloat(row.power_capacity_mw || row.capacity_mw || row.mw || 0);
      const rawStatus = (row.status || row.phase || 'operational').toLowerCase();
      const status = rawStatus.includes('operat') || rawStatus.includes('complet') ? 'operational'
        : rawStatus.includes('construct') || rawStatus.includes('build') ? 'under_construction'
        : rawStatus.includes('cancel') || rawStatus.includes('halt') ? 'cancelled'
        : 'announced';

      projects.push({
        external_id: `epoch_row_${i}`,
        name: row.name || row.facility_name || row.project_name || `Project ${i}`,
        operator: row.operator || row.company || row.owner || '',
        lat, lng,
        mw: isNaN(mwRaw) ? null : mwRaw,
        status,
        announced_date: row.announced || row.year ? `${(row.announced || row.year).slice(0,4)}-01-01` : null,
        source: 'epoch_ai',
        source_url: 'https://epoch.ai/data/large-scale-ai-infrastructure',
        confidence: 'high',
      });
    }
  } catch (e) {
    console.error('Epoch ingest error:', e.message);
  }
  return projects;
}

async function fetchRSS(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'InfraTerminal/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const text = await r.text();
    const items = [];
    for (const m of text.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
      const block = m[1];
      const title = (block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1]?.trim();
      const link  = (block.match(/<link[^>]*>([^<]*)<\/link>/i) || [])[1]?.trim();
      const desc  = (block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i) || [])[1]?.trim();
      const date  = (block.match(/<pubDate[^>]*>([^<]*)<\/pubDate>/i) || [])[1]?.trim();
      if (title) items.push({ title, link, description: (desc||'').slice(0,200), pubDate: date });
    }
    return items.slice(0, 25);
  } catch { return []; }
}

async function parseWithClaude(items) {
  if (!items.length || !AN_KEY()) return [];
  const headlines = items.map((it,i) => `${i+1}. ${it.title} — ${it.description||''}`).join('\n');
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
        max_tokens: 1500,
        messages: [{ role: 'user', content: `Extract data center project announcements from these headlines. Return ONLY a JSON array, no markdown, no explanation. Each object must have: headline_index (number), name (string), operator (string), city (string), country (string), mw (number or null), status (announced|under_construction|operational|cancelled), confidence (high|medium|low). Only include items with a clear city+country. Return [] if none found.\n\nHeadlines:\n${headlines}` }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return [];
    const j = await r.json();
    const text = (j.content?.[0]?.text || '[]').replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];

    const results = [];
    for (const p of parsed) {
      try {
        const geoR = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(p.city+', '+p.country)}&format=json&limit=1`,
          { headers: { 'User-Agent': 'InfraTerminal/1.0' }, signal: AbortSignal.timeout(4000) }
        );
        if (!geoR.ok) continue;
        const geo = await geoR.json();
        if (!geo?.length) continue;
        const src = items[p.headline_index - 1];
        results.push({
          external_id: `rss_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
          name: p.name, operator: p.operator,
          lat: parseFloat(geo[0].lat), lng: parseFloat(geo[0].lon),
          mw: p.mw || null, status: p.status,
          announced_date: src?.pubDate ? new Date(src.pubDate).toISOString().split('T')[0] : null,
          source: 'rss_claude', source_url: src?.link || '', confidence: p.confidence,
        });
      } catch { continue; }
    }
    return results;
  } catch (e) {
    console.error('Claude parse error:', e.message);
    return [];
  }
}

function dedup(existing, incoming) {
  function dist(a, b) {
    const R = 6371, dLat=(b.lat-a.lat)*Math.PI/180, dLng=(b.lng-a.lng)*Math.PI/180;
    const aa=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
    return R*2*Math.atan2(Math.sqrt(aa),Math.sqrt(1-aa));
  }
  return incoming.filter(np => !existing.some(ep => dist(ep, np) < 2));
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: CORS });
  }

  // Rate limit: once per hour
  const lastRefresh = await getLastRefresh();
  if (lastRefresh) {
    const age = Date.now() - new Date(lastRefresh).getTime();
    if (age < 60 * 60 * 1000) {
      return new Response(JSON.stringify({
        ok: false, reason: 'Refreshed recently',
        nextRefreshIn: Math.round((60*60*1000 - age) / 60000) + ' minutes',
      }), { headers: CORS });
    }
  }

  const existing = await getAllProjects();
  const allNew = [];

  // 1. Epoch AI
  const epochProjects = await ingestEpochAI();
  allNew.push(...epochProjects);

  // 2. RSS feeds
  const feeds = [
    'https://www.datacenterdynamics.com/en/rss/',
    'https://www.datacenterknowledge.com/rss.xml',
  ];
  for (const feed of feeds) {
    const items = await fetchRSS(feed);
    if (items.length) {
      const parsed = await parseWithClaude(items);
      allNew.push(...parsed);
    }
  }

  // 3. Dedup + upsert
  const newUnique = dedup(existing, allNew);
  if (newUnique.length > 0) await upsertProjects(newUnique);
  await markRefreshed();

  return new Response(JSON.stringify({
    ok: true,
    epochProjects: epochProjects.length,
    rssProjects: allNew.length - epochProjects.length,
    newUnique: newUnique.length,
    total: existing.length + newUnique.length,
    timestamp: new Date().toISOString(),
  }), { headers: CORS });
}
