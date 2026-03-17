// api/locate.js
// Vercel Edge Function — resolves any {lat, lng} on Earth to a full intelligence card
// Endpoint: GET /api/locate?lat=XX&lng=YY
// Returns: JSON score card with confidence interval, all signals, nearest market
//
// Setup required in Vercel dashboard (Environment Variables):
//   EIA_API_KEY      — free at eia.gov/opendata (register, get key instantly)
//   SUPABASE_URL     — https://nqivrdsnlivtmijtkjqh.supabase.co
//   SUPABASE_SERVICE_KEY — service role key from Supabase dashboard > Settings > API

export const config = { runtime: 'edge' };

// ─── Inline data (avoids module import issues in edge runtime) ─────────────────

const COUNTRY_DATA = {
  US:{pc:0.077,risk:88,conn:1},CA:{pc:0.095,risk:90,conn:1},MX:{pc:0.062,risk:52,conn:2},
  GB:{pc:0.198,risk:87,conn:1},DE:{pc:0.185,risk:88,conn:1},FR:{pc:0.142,risk:82,conn:1},
  NL:{pc:0.148,risk:91,conn:1},IE:{pc:0.210,risk:89,conn:1},CH:{pc:0.175,risk:95,conn:1},
  SE:{pc:0.075,risk:93,conn:1},NO:{pc:0.052,risk:94,conn:2},DK:{pc:0.168,risk:95,conn:1},
  FI:{pc:0.095,risk:94,conn:1},BE:{pc:0.165,risk:83,conn:1},AT:{pc:0.172,risk:87,conn:2},
  ES:{pc:0.135,risk:78,conn:1},PT:{pc:0.158,risk:83,conn:1},IT:{pc:0.178,risk:72,conn:1},
  PL:{pc:0.125,risk:72,conn:2},CZ:{pc:0.138,risk:78,conn:2},SG:{pc:0.148,risk:90,conn:1},
  JP:{pc:0.168,risk:88,conn:1},AU:{pc:0.122,risk:88,conn:1},NZ:{pc:0.115,risk:92,conn:2},
  KR:{pc:0.092,risk:80,conn:1},HK:{pc:0.152,risk:55,conn:1},TW:{pc:0.095,risk:78,conn:1},
  CN:{pc:0.078,risk:42,conn:1},IN:{pc:0.085,risk:58,conn:1},TH:{pc:0.095,risk:52,conn:2},
  MY:{pc:0.072,risk:62,conn:1},ID:{pc:0.082,risk:50,conn:2},PH:{pc:0.145,risk:48,conn:2},
  VN:{pc:0.068,risk:45,conn:2},BD:{pc:0.072,risk:38,conn:3},PK:{pc:0.092,risk:28,conn:3},
  AE:{pc:0.040,risk:72,conn:1},SA:{pc:0.032,risk:55,conn:1},QA:{pc:0.028,risk:65,conn:1},
  TR:{pc:0.098,risk:45,conn:2},EG:{pc:0.055,risk:42,conn:2},ZA:{pc:0.082,risk:55,conn:2},
  NG:{pc:0.068,risk:28,conn:3},KE:{pc:0.095,risk:48,conn:2},GH:{pc:0.078,risk:52,conn:3},
  MA:{pc:0.095,risk:55,conn:2},BR:{pc:0.092,risk:52,conn:1},CL:{pc:0.112,risk:72,conn:2},
  CO:{pc:0.085,risk:52,conn:2},AR:{pc:0.048,risk:38,conn:2},PE:{pc:0.078,risk:48,conn:2},
  UY:{pc:0.115,risk:75,conn:2},PA:{pc:0.115,risk:65,conn:1},IL:{pc:0.115,risk:58,conn:1},
  RU:{pc:0.048,risk:18,conn:2},UA:{pc:0.062,risk:30,conn:3},KZ:{pc:0.038,risk:40,conn:3},
  IS:{pc:0.041,risk:96,conn:2},MU:{pc:0.145,risk:72,conn:2},RW:{pc:0.095,risk:52,conn:3},
  XX:{pc:0.095,risk:45,conn:3},
};

const HOTSPOTS = [
  {id:'nva',name:'N. Virginia',   lat:38.9,  lng:-77.4,  tier:'T1'},
  {id:'sva',name:'Silicon Valley',lat:37.37, lng:-121.97,tier:'T1'},
  {id:'dal',name:'Dallas',        lat:32.78, lng:-96.8,  tier:'T1'},
  {id:'phx',name:'Phoenix',       lat:33.43, lng:-112.07,tier:'T1'},
  {id:'chi',name:'Chicago',       lat:41.88, lng:-87.63, tier:'T1'},
  {id:'ore',name:'Oregon',        lat:45.52, lng:-122.68,tier:'T1'},
  {id:'sea',name:'Seattle',       lat:47.61, lng:-122.33,tier:'T1'},
  {id:'lon',name:'London',        lat:51.5,  lng:-0.12,  tier:'T1'},
  {id:'fra',name:'Frankfurt',     lat:50.11, lng:8.68,   tier:'T1'},
  {id:'ams',name:'Amsterdam',     lat:52.37, lng:4.9,    tier:'T1'},
  {id:'dub',name:'Dublin',        lat:53.33, lng:-6.25,  tier:'T1'},
  {id:'par',name:'Paris',         lat:48.86, lng:2.35,   tier:'T1'},
  {id:'zur',name:'Zurich',        lat:47.38, lng:8.54,   tier:'T1'},
  {id:'sto',name:'Stockholm',     lat:59.33, lng:18.07,  tier:'T2'},
  {id:'nor',name:'Norway',        lat:63.43, lng:10.39,  tier:'T2'},
  {id:'sgp',name:'Singapore',     lat:1.35,  lng:103.82, tier:'T1'},
  {id:'tok',name:'Tokyo',         lat:35.68, lng:139.69, tier:'T1'},
  {id:'osk',name:'Osaka',         lat:34.69, lng:135.5,  tier:'T2'},
  {id:'dxb',name:'Dubai',         lat:25.2,  lng:55.27,  tier:'T2'},
  {id:'syd',name:'Sydney',        lat:-33.87,lng:151.2,  tier:'T2'},
  {id:'bom',name:'Mumbai',        lat:19.08, lng:72.88,  tier:'T2'},
  {id:'mex',name:'Queretaro',     lat:20.59, lng:-100.39,tier:'T2'},
  {id:'scl',name:'Santiago',      lat:-33.45,lng:-70.67, tier:'T2'},
  {id:'joh',name:'Johannesburg',  lat:-26.2, lng:28.04,  tier:'T3'},
  {id:'sao',name:'Sao Paulo',     lat:-23.55,lng:-46.63, tier:'T2'},
];

const CABLE_STATIONS = [
  [38.72,-9.14,1],[51.50,-0.12,1],[48.86,2.35,1],[40.71,-74.01,1],
  [25.77,-80.19,1],[37.77,-122.42,1],[47.61,-122.33,1],[21.31,-157.86,1],
  [1.35,103.82,1],[35.68,139.69,1],[22.39,114.11,1],[-33.87,151.21,1],
  [19.08,72.88,2],[6.45,3.47,2],[-26.20,28.04,2],[30.06,31.25,2],
  [25.20,55.27,2],[36.81,10.18,2],[52.37,4.90,1],[59.33,18.06,2],
  [55.68,12.57,2],[37.98,23.73,2],[41.01,28.97,2],[43.30,5.37,2],
  [14.09,100.48,2],[3.15,101.69,2],[13.76,100.50,2],[-6.21,106.85,2],
  [14.60,120.97,2],[31.23,121.47,2],[37.57,126.98,2],[34.69,135.50,2],
  [-37.81,144.96,2],[-27.47,153.02,2],[-31.95,115.86,3],[60.39,5.32,2],
  [14.69,-17.44,3],[-23.55,-46.63,2],[-33.45,-70.67,3],[9.05,7.49,3],
  [40.42,-3.70,2],[45.46,9.19,2],[50.11,8.68,1],[53.55,9.99,2],
];

// ─── Utility functions ────────────────────────────────────────────────────────

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function nearestHotspot(lat, lng) {
  let best = null, bestDist = Infinity;
  for (const h of HOTSPOTS) {
    const d = haversineKm(lat, lng, h.lat, h.lng);
    if (d < bestDist) { bestDist = d; best = h; }
  }
  return { ...best, distKm: Math.round(bestDist) };
}

function cableConnectivityScore(lat, lng) {
  // Find nearest cable station, score drops off with distance
  let bestDist = Infinity, bestTier = 4;
  for (const [slat, slng, tier] of CABLE_STATIONS) {
    const d = haversineKm(lat, lng, slat, slng);
    if (d < bestDist) { bestDist = d; bestTier = tier; }
  }
  // Tier 1 within 200km = score 95, degrading to 60 at 2000km
  // Tier 4 within 200km = score 50, degrading to 20
  const tierBase = [95, 78, 60, 45][bestTier - 1];
  const distPenalty = Math.min(35, bestDist / 60);
  return {
    score: Math.max(10, Math.round(tierBase - distPenalty)),
    tier: bestTier,
    nearestStationKm: Math.round(bestDist),
  };
}

// Confidence interval: how well do we actually know this location?
// Near a known hotspot = tight. Remote = wide.
function confidenceInterval(distKm, hasLivePrice) {
  // Base uncertainty from distance to nearest known market
  let pct = 5; // minimum ±5% for known markets
  if (distKm > 50)   pct += 5;
  if (distKm > 200)  pct += 10;
  if (distKm > 500)  pct += 10;
  if (distKm > 1000) pct += 10;
  if (!hasLivePrice) pct += 5;
  return Math.min(pct, 40); // cap at ±40%
}

// Compute overall Infra Terminal score (0-100)
// Weights: power cost 25%, demand 25%, connectivity 20%, permitting 15%, political risk 15%
function computeScore({ powerScore, demandScore, connScore, permitScore, riskScore }) {
  return Math.round(
    powerScore   * 0.25 +
    demandScore  * 0.25 +
    connScore    * 0.20 +
    permitScore  * 0.15 +
    riskScore    * 0.15
  );
}

// Convert raw $/kWh to a 0-100 score (lower cost = higher score)
// Scale: $0.025/kWh = 100, $0.25/kWh = 0
function powerCostScore(pcKwh) {
  return Math.max(0, Math.min(100, Math.round((0.25 - pcKwh) / (0.25 - 0.025) * 100)));
}

// Interpolate power cost: blend live data (if available), country baseline, nearest hotspot
function interpolatePowerCost(countryPc, nearestHotspotPc, distKm, livePc) {
  if (livePc) return { pc: livePc, source: 'live' };

  // Within 100km of hotspot: weight hotspot data heavily
  if (distKm < 100) {
    const w = 1 - (distKm / 100) * 0.4; // 0.6-1.0 hotspot weight
    return { pc: nearestHotspotPc * w + countryPc * (1-w), source: 'interpolated' };
  }
  // Beyond 100km: blend country avg with small distance penalty
  const distancePenalty = Math.min(0.03, distKm * 0.00003); // up to +$0.03/kWh
  return { pc: countryPc + distancePenalty, source: 'country_avg' };
}

// ─── EIA Power price fetch (US only) ─────────────────────────────────────────

async function fetchEIAPowerPrice(stateCode) {
  const key = globalThis.__EIA_KEY__;
  if (!key) return null;
  try {
    const url = `https://api.eia.gov/v2/electricity/retail-sales/data/?api_key=${key}` +
      `&frequency=monthly&data[0]=price&facets[stateid][]=${stateCode}` +
      `&facets[sectorName][]=industrial&sort[0][column]=period&sort[0][direction]=desc&length=1`;
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return null;
    const j = await r.json();
    const val = j?.response?.data?.[0]?.price;
    return val ? parseFloat(val) / 100 : null; // EIA returns cents/kWh
  } catch { return null; }
}

// Map lat/lng to US state code for EIA lookup
function latLngToUSState(lat, lng) {
  // Rough bounding boxes for key DC states — precise enough for power pricing
  if (lat > 36.5 && lat < 40.0 && lng > -80.0 && lng < -74.0) return 'VA';
  if (lat > 36.5 && lat < 39.0 && lng > -80.5 && lng < -76.0) return 'MD';
  if (lat > 37.0 && lat < 39.0 && lng > -122.5 && lng < -121.0) return 'CA';
  if (lat > 32.0 && lat < 37.5 && lng > -98.0 && lng < -93.5) return 'TX';
  if (lat > 32.5 && lat < 34.5 && lng > -113.5 && lng < -110.5) return 'AZ';
  if (lat > 41.0 && lat < 43.0 && lng > -89.0 && lng < -86.5) return 'IL';
  if (lat > 44.0 && lat < 47.0 && lng > -124.5 && lng < -120.5) return 'OR';
  if (lat > 46.0 && lat < 49.5 && lng > -124.0 && lng < -120.0) return 'WA';
  if (lat > 45.0 && lat < 49.5 && lng > -116.0 && lng < -104.0) return 'MT'; // rough
  return null; // outside mappable US states
}

// ─── Supabase cache helpers ───────────────────────────────────────────────────

async function getCached(key) {
  try {
    const url = `${globalThis.__SB_URL__}/rest/v1/api_cache?key=eq.${encodeURIComponent(key)}&select=value,fetched_at`;
    const r = await fetch(url, {
      headers: { 'apikey': globalThis.__SB_KEY__, 'Authorization': `Bearer ${globalThis.__SB_KEY__}` }
    });
    if (!r.ok) return null;
    const rows = await r.json();
    if (!rows?.length) return null;
    const age = Date.now() - new Date(rows[0].fetched_at).getTime();
    if (age > 6 * 60 * 60 * 1000) return null; // expired
    return JSON.parse(rows[0].value);
  } catch { return null; }
}

async function setCache(key, value) {
  try {
    const url = `${globalThis.__SB_URL__}/rest/v1/api_cache`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': globalThis.__SB_KEY__,
        'Authorization': `Bearer ${globalThis.__SB_KEY__}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ key, value: JSON.stringify(value), fetched_at: new Date().toISOString() }),
    });
  } catch { /* cache write failure is non-fatal */ }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req) {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat'));
  const lng = parseFloat(searchParams.get('lng'));

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return new Response(JSON.stringify({ error: 'Invalid coordinates' }), { status: 400, headers });
  }

  // Inject env vars into globals for utility functions
  globalThis.__EIA_KEY__  = process.env.EIA_API_KEY;
  globalThis.__SB_URL__   = process.env.SUPABASE_URL || 'https://nqivrdsnlivtmijtkjqh.supabase.co';
  globalThis.__SB_KEY__   = process.env.SUPABASE_SERVICE_KEY;

  const cacheKey = `locate_${lat.toFixed(2)}_${lng.toFixed(2)}`;
  const cached = await getCached(cacheKey);
  if (cached) return new Response(JSON.stringify({ ...cached, cached: true }), { headers });

  // ── Step 1: Reverse geocode to country code ──────────────────────────────
  // Use a lightweight public geocoding API (no key required)
  let countryCode = 'XX';
  try {
    const geoR = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=3`,
      {
        headers: { 'User-Agent': 'InfraTerminal/1.0' },
        signal: AbortSignal.timeout(3000),
      }
    );
    if (geoR.ok) {
      const geoJ = await geoR.json();
      countryCode = geoJ?.address?.country_code?.toUpperCase() || 'XX';
    }
  } catch { /* use fallback */ }

  const country = COUNTRY_DATA[countryCode] || COUNTRY_DATA.XX;

  // ── Step 2: Find nearest hotspot ─────────────────────────────────────────
  const nearest = nearestHotspot(lat, lng);

  // Get nearest hotspot's power cost from inline BASE data
  const HOTSPOT_PC = {
    nva:0.055, sva:0.065, dal:0.065, phx:0.065, chi:0.065, ore:0.038,
    sea:0.065, lon:0.198, fra:0.185, ams:0.148, dub:0.095, par:0.090,
    zur:0.100, sto:0.032, nor:0.028, sgp:0.120, tok:0.168, osk:0.168,
    dxb:0.040, syd:0.122, bom:0.070, mex:0.062, scl:0.112, joh:0.082, sao:0.092,
  };
  const nearestPc = HOTSPOT_PC[nearest.id] || country.pc;

  // ── Step 3: Live power price (US only via EIA) ───────────────────────────
  let livePc = null;
  if (countryCode === 'US') {
    const stateCode = latLngToUSState(lat, lng);
    if (stateCode) {
      const cachedState = await getCached(`eia_${stateCode}`);
      if (cachedState) {
        livePc = cachedState.pc;
      } else {
        livePc = await fetchEIAPowerPrice(stateCode);
        if (livePc) await setCache(`eia_${stateCode}`, { pc: livePc });
      }
    }
  }

  // ── Step 4: Interpolate power cost ───────────────────────────────────────
  const powerInterp = interpolatePowerCost(country.pc, nearestPc, nearest.distKm, livePc);

  // ── Step 5: Connectivity score from cable proximity ──────────────────────
  const connectivity = cableConnectivityScore(lat, lng);

  // ── Step 6: Build score components ───────────────────────────────────────
  const powerScore  = powerCostScore(powerInterp.pc);
  const connScore   = connectivity.score;
  const riskScore   = country.risk;

  // Demand score: interpolated from nearest hotspot with distance decay
  // Known hotspot demand scores
  const HOTSPOT_DEMAND = {
    nva:98, sva:85, dal:78, phx:82, chi:65, ore:72, sea:68,
    lon:88, fra:82, ams:75, dub:70, par:72, zur:55, sto:58, nor:48,
    sgp:85, tok:78, osk:58, dxb:72, syd:65, bom:75, mex:62, scl:48, joh:45, sao:58,
  };
  const nearestDemand = HOTSPOT_DEMAND[nearest.id] || 50;
  // Demand decays with distance — far from any hotspot = lower demand signal
  const demandDecay   = Math.max(0, 1 - (nearest.distKm / 3000));
  const demandScore   = Math.round(nearestDemand * demandDecay * 0.6 + 30 * (1 - demandDecay));

  // Permitting: country-level baseline
  const COUNTRY_PERMITTING = {
    US:72, CA:75, MX:58, GB:52, DE:70, FR:62, NL:45, IE:42,
    CH:68, SE:78, NO:82, DK:80, FI:78, BE:60, AT:65, ES:58,
    PT:62, IT:52, PL:60, CZ:62, SG:88, JP:55, AU:65, NZ:72,
    KR:60, HK:68, TW:62, CN:55, IN:42, TH:55, MY:60, ID:48,
    AE:90, SA:72, QA:78, IL:62, TR:48, ZA:50, NG:32, KE:45,
    BR:40, CL:70, CO:52, AR:38, PE:48, UY:65, XX:45,
  };
  const permitScore = COUNTRY_PERMITTING[countryCode] || 45;

  const overallScore = computeScore({ powerScore, demandScore, connScore, permitScore, riskScore });
  const ci           = confidenceInterval(nearest.distKm, !!livePc);

  // ── Step 7: Build score tier and label ───────────────────────────────────
  const scoreTier = overallScore >= 80 ? 'hot'
    : overallScore >= 60 ? 'active'
    : overallScore >= 40 ? 'watch'
    : 'cold';

  const scoreTierLabels = {
    hot:    { label: 'Hot market',      color: '#0F6E56' },
    active: { label: 'Active market',   color: '#185FA5' },
    watch:  { label: 'Watch list',      color: '#BA7517' },
    cold:   { label: 'Low opportunity', color: '#888780' },
  };

  // ── Step 8: Human-readable signal breakdown ───────────────────────────────
  const signals = [
    {
      key: 'power',
      label: 'Power cost',
      value: `$${powerInterp.pc.toFixed(3)}/kWh`,
      score: powerScore,
      source: livePc ? 'EIA live' : powerInterp.source === 'interpolated' ? 'Interpolated' : 'IEA country avg',
      note: livePc ? 'Live EIA industrial rate' : `Based on ${nearest.distKm < 200 ? nearest.name + ' market data' : countryCode + ' national avg'}`,
    },
    {
      key: 'demand',
      label: 'Demand signal',
      value: `${demandScore}/100`,
      score: demandScore,
      source: 'Derived',
      note: `${nearest.distKm}km from ${nearest.name} (score ${nearestDemand})`,
    },
    {
      key: 'connectivity',
      label: 'Connectivity',
      value: `Tier ${connectivity.tier}`,
      score: connScore,
      source: 'SubmarineCableMap',
      note: `Nearest cable landing ${connectivity.nearestStationKm}km`,
    },
    {
      key: 'permitting',
      label: 'Permitting',
      value: `${permitScore}/100`,
      score: permitScore,
      source: 'CBRE / JLL 2025',
      note: `${countryCode} country-level regulatory index`,
    },
    {
      key: 'risk',
      label: 'Political risk',
      value: `${riskScore}/100`,
      score: riskScore,
      source: 'World Bank WGI',
      note: riskScore >= 75 ? 'Low risk jurisdiction' : riskScore >= 50 ? 'Moderate risk' : 'Elevated risk — factor into SLA planning',
    },
  ];

  const result = {
    lat, lng,
    countryCode,
    overallScore,
    scoreTier,
    scoreTierLabel: scoreTierLabels[scoreTier],
    confidenceInterval: ci,
    powerCost: {
      value: powerInterp.pc,
      formatted: `$${powerInterp.pc.toFixed(3)}/kWh`,
      source: powerInterp.source,
      isLive: !!livePc,
    },
    connectivity: {
      tier: connectivity.tier,
      score: connScore,
      nearestStationKm: connectivity.nearestStationKm,
      label: ['Tier 1 — Major hub','Tier 2 — Regional','Tier 3 — Emerging','Tier 4 — Remote'][connectivity.tier - 1],
    },
    politicalRisk: {
      score: riskScore,
      label: riskScore >= 75 ? 'Low risk' : riskScore >= 50 ? 'Moderate' : riskScore >= 25 ? 'Elevated' : 'High risk',
    },
    nearestHotspot: {
      id: nearest.id,
      name: nearest.name,
      distKm: nearest.distKm,
      tier: nearest.tier,
    },
    signals,
    scoreBreakdown: { powerScore, demandScore, connScore, permitScore, riskScore },
    cached: false,
    generatedAt: new Date().toISOString(),
  };

  // Cache the result
  await setCache(cacheKey, result);

  return new Response(JSON.stringify(result), { headers });
}
