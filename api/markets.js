// api/markets.js
// Vercel Edge Function — returns all 25 hotspot markets scored and ranked
// Endpoint: GET /api/markets
// Optional: GET /api/markets?refresh=1  to bust cache
//
// Scoring weights:
//   Power cost        25%  (live EIA/IEA where available)
//   Demand signal     25%  (static MARKET_INTEL, updated quarterly)
//   Connectivity      20%  (static tier + cable proximity)
//   Permitting        15%  (static MARKET_INTEL)
//   Political risk    15%  (World Bank WGI via COUNTRY_DATA)

export const config = { runtime: 'edge' };

const SB_URL = () => process.env.SUPABASE_URL || 'https://nqivrdsnlivtmijtkjqh.supabase.co';
const SB_KEY = () => process.env.SUPABASE_SERVICE_KEY;
const EIA_KEY = () => process.env.EIA_API_KEY;

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=3600',
};

// ─── Static data (inlined for edge runtime) ───────────────────────────────────

const HOTSPOTS = [
  {id:'nva',name:'N. Virginia',    lat:38.9,   lng:-77.4,   tier:'T1', country:'US'},
  {id:'sva',name:'Silicon Valley', lat:37.37,  lng:-121.97, tier:'T1', country:'US'},
  {id:'dal',name:'Dallas',         lat:32.78,  lng:-96.8,   tier:'T1', country:'US'},
  {id:'phx',name:'Phoenix',        lat:33.43,  lng:-112.07, tier:'T1', country:'US'},
  {id:'chi',name:'Chicago',        lat:41.88,  lng:-87.63,  tier:'T1', country:'US'},
  {id:'ore',name:'Oregon',         lat:45.52,  lng:-122.68, tier:'T1', country:'US'},
  {id:'sea',name:'Seattle',        lat:47.61,  lng:-122.33, tier:'T1', country:'US'},
  {id:'lon',name:'London',         lat:51.5,   lng:-0.12,   tier:'T1', country:'GB'},
  {id:'fra',name:'Frankfurt',      lat:50.11,  lng:8.68,    tier:'T1', country:'DE'},
  {id:'ams',name:'Amsterdam',      lat:52.37,  lng:4.9,     tier:'T1', country:'NL'},
  {id:'dub',name:'Dublin',         lat:53.33,  lng:-6.25,   tier:'T1', country:'IE'},
  {id:'par',name:'Paris',          lat:48.86,  lng:2.35,    tier:'T1', country:'FR'},
  {id:'zur',name:'Zurich',         lat:47.38,  lng:8.54,    tier:'T1', country:'CH'},
  {id:'sto',name:'Stockholm',      lat:59.33,  lng:18.07,   tier:'T2', country:'SE'},
  {id:'nor',name:'Norway',         lat:63.43,  lng:10.39,   tier:'T2', country:'NO'},
  {id:'sgp',name:'Singapore',      lat:1.35,   lng:103.82,  tier:'T1', country:'SG'},
  {id:'tok',name:'Tokyo',          lat:35.68,  lng:139.69,  tier:'T1', country:'JP'},
  {id:'osk',name:'Osaka',          lat:34.69,  lng:135.5,   tier:'T2', country:'JP'},
  {id:'dxb',name:'Dubai',          lat:25.2,   lng:55.27,   tier:'T2', country:'AE'},
  {id:'syd',name:'Sydney',         lat:-33.87, lng:151.2,   tier:'T2', country:'AU'},
  {id:'bom',name:'Mumbai',         lat:19.08,  lng:72.88,   tier:'T2', country:'IN'},
  {id:'mex',name:'Queretaro',      lat:20.59,  lng:-100.39, tier:'T2', country:'MX'},
  {id:'scl',name:'Santiago',       lat:-33.45, lng:-70.67,  tier:'T2', country:'CL'},
  {id:'joh',name:'Johannesburg',   lat:-26.2,  lng:28.04,   tier:'T3', country:'ZA'},
  {id:'sao',name:'Sao Paulo',      lat:-23.55, lng:-46.63,  tier:'T2', country:'BR'},
];

// Market intelligence (demand, permitting, saturation, key signals)
const INTEL = {
  nva:{demand:98,permitting:55,saturation:'high',  connTier:1,risk:88,pc:0.055,gridMw:800,  highlights:['Largest DC cluster globally','AWS/Azure/Google all expanding','Grid constrained — 2026 investment']},
  sva:{demand:85,permitting:35,saturation:'high',  connTier:1,risk:88,pc:0.065,gridMw:300,  highlights:['AI startup density unmatched','Permitting 18-36mo','Hyperscalers moving to OR/AZ']},
  dal:{demand:78,permitting:82,saturation:'medium',connTier:1,risk:88,pc:0.065,gridMw:2200, highlights:['Fast permitting','ERCOT capacity building','No state income tax']},
  phx:{demand:82,permitting:78,saturation:'medium',connTier:1,risk:88,pc:0.065,gridMw:3500, highlights:['Fastest growing US market','Microsoft+Meta+Google under construction','Water stress — critical risk']},
  chi:{demand:65,permitting:62,saturation:'medium',connTier:1,risk:88,pc:0.065,gridMw:1200, highlights:['Nuclear baseload reliability','Financial sector anchor','Central US latency']},
  ore:{demand:72,permitting:70,saturation:'low',   connTier:1,risk:88,pc:0.038,gridMw:2800, highlights:['Cheapest US power (hydro)','72% renewables','Proven hyperscaler corridor']},
  sea:{demand:68,permitting:55,saturation:'medium',connTier:1,risk:88,pc:0.065,gridMw:900,  highlights:['Microsoft HQ effect','Hydro via Eastern WA','Seismic risk']},
  lon:{demand:88,permitting:48,saturation:'high',  connTier:1,risk:87,pc:0.198,gridMw:600,  highlights:['Strongest EU AI demand','Grid severely constrained','Premium pricing market']},
  fra:{demand:82,permitting:72,saturation:'medium',connTier:1,risk:88,pc:0.185,gridMw:1800, highlights:['DE-CIX largest EU exchange','Central EU location','High power cost']},
  ams:{demand:75,permitting:30,saturation:'high',  connTier:1,risk:91,pc:0.148,gridMw:400,  highlights:['Active permitting moratorium','AMS-IX anchor','Power at capacity']},
  dub:{demand:70,permitting:38,saturation:'high',  connTier:1,risk:89,pc:0.095,gridMw:350,  highlights:['EirGrid moratorium Dublin area','12.5% corp tax','EU HQ concentration']},
  par:{demand:72,permitting:60,saturation:'medium',connTier:1,risk:82,pc:0.090,gridMw:1200, highlights:['French AI national plan','Nuclear baseload','Growing startup ecosystem']},
  zur:{demand:55,permitting:68,saturation:'low',   connTier:1,risk:95,pc:0.100,gridMw:500,  highlights:['Highest political stability','Privacy law premium','Very high cost']},
  sto:{demand:58,permitting:75,saturation:'low',   connTier:1,risk:93,pc:0.032,gridMw:2200, highlights:['Natural cooling (PUE <1.2)','90% renewables','20ms+ from core EU']},
  nor:{demand:48,permitting:80,saturation:'low',   connTier:2,risk:94,pc:0.028,gridMw:5000, highlights:['World cheapest clean power','Near-unlimited capacity','Remote — latency tradeoff']},
  sgp:{demand:85,permitting:85,saturation:'high',  connTier:1,risk:90,pc:0.120,gridMw:500,  highlights:['Best APAC regulatory env','Government MW caps active','ASEAN demand hub']},
  tok:{demand:78,permitting:55,saturation:'medium',connTier:1,risk:88,pc:0.168,gridMw:1200, highlights:['Japan AI national strategy','SoftBank/NTT expanding','Earthquake risk']},
  osk:{demand:58,permitting:65,saturation:'low',   connTier:2,risk:88,pc:0.168,gridMw:900,  highlights:['Lower cost than Tokyo','Nuke restart helping','Growing Tokyo alternative']},
  dxb:{demand:72,permitting:90,saturation:'low',   connTier:1,risk:72,pc:0.040,gridMw:2000, highlights:['Easiest DC permitting globally','Tax-free jurisdiction','G42/MGX sovereign demand']},
  syd:{demand:65,permitting:62,saturation:'medium',connTier:1,risk:88,pc:0.122,gridMw:800,  highlights:['Dominant ANZ market','Grid transition risk','Government cloud adoption']},
  bom:{demand:75,permitting:45,saturation:'low',   connTier:1,risk:58,pc:0.070,gridMw:1500, highlights:['Fastest growing DC market globally','India Digital Infrastructure Bill','Grid reliability improving']},
  mex:{demand:62,permitting:70,saturation:'low',   connTier:2,risk:52,pc:0.062,gridMw:1200, highlights:['US latency <20ms','Nearshoring boom','Political uncertainty risk']},
  scl:{demand:48,permitting:72,saturation:'low',   connTier:2,risk:72,pc:0.112,gridMw:800,  highlights:['Most stable LatAm market','World-class solar resource','LATAM south gateway']},
  joh:{demand:45,permitting:52,saturation:'low',   connTier:2,risk:55,pc:0.082,gridMw:600,  highlights:['Only viable Sub-Saharan hub','Eskom reforms ongoing','Load shedding risk reducing']},
  sao:{demand:58,permitting:42,saturation:'low',   connTier:1,risk:52,pc:0.092,gridMw:1200, highlights:['Largest LatAm market 200M+','Hydro baseload','FX/regulatory complexity']},
};

// ─── EIA power price fetch (batch US states) ─────────────────────────────────

const EIA_STATES = { nva:'VA', sva:'CA', dal:'TX', phx:'AZ', chi:'IL', ore:'OR', sea:'WA' };

async function fetchEIAPrices() {
  const key = EIA_KEY();
  if (!key) return {};
  const prices = {};
  await Promise.all(
    Object.entries(EIA_STATES).map(async ([id, state]) => {
      try {
        const url = `https://api.eia.gov/v2/electricity/retail-sales/data/?api_key=${key}` +
          `&frequency=monthly&data[0]=price&facets[stateid][]=${state}` +
          `&facets[sectorName][]=industrial&sort[0][column]=period&sort[0][direction]=desc&length=1`;
        const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (!r.ok) return;
        const j = await r.json();
        const val = j?.response?.data?.[0]?.price;
        if (val) prices[id] = parseFloat(val) / 100;
      } catch { /* individual failure non-fatal */ }
    })
  );
  return prices;
}

// ─── Supabase cache ───────────────────────────────────────────────────────────

async function getCached(key) {
  try {
    const r = await fetch(`${SB_URL()}/rest/v1/api_cache?key=eq.${key}&select=value,fetched_at`, {
      headers: { 'apikey': SB_KEY(), 'Authorization': `Bearer ${SB_KEY()}` },
    });
    if (!r.ok) return null;
    const rows = await r.json();
    if (!rows?.length) return null;
    if (Date.now() - new Date(rows[0].fetched_at).getTime() > 6*60*60*1000) return null;
    return JSON.parse(rows[0].value);
  } catch { return null; }
}

async function setCache(key, value) {
  try {
    await fetch(`${SB_URL()}/rest/v1/api_cache`, {
      method: 'POST',
      headers: {
        'apikey': SB_KEY(), 'Authorization': `Bearer ${SB_KEY()}`,
        'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ key, value: JSON.stringify(value), fetched_at: new Date().toISOString() }),
    });
  } catch { /* non-fatal */ }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function powerScore(pc)      { return Math.max(0, Math.min(100, Math.round((0.25-pc)/(0.25-0.025)*100))); }
function connScore(tier)     { return [95, 78, 60, 45][tier-1] || 45; }
function saturationBonus(s)  { return s === 'low' ? 8 : s === 'medium' ? 3 : -5; } // greenfield premium

function scoreMarket(id, livePc) {
  const intel = INTEL[id];
  const pc = livePc || intel.pc;
  const ps = powerScore(pc);
  const cs = connScore(intel.connTier);
  const rs = intel.risk;
  const ds = intel.demand;
  const perm = intel.permitting;
  const sat = saturationBonus(intel.saturation);

  const raw = ps*0.25 + ds*0.25 + cs*0.20 + perm*0.15 + rs*0.15;
  const final = Math.max(0, Math.min(100, Math.round(raw + sat)));

  const tier = final >= 80 ? 'hot' : final >= 65 ? 'active' : final >= 45 ? 'watch' : 'cold';
  const tierColors = { hot:'#0F6E56', active:'#185FA5', watch:'#BA7517', cold:'#888780' };

  return {
    score: final,
    tier,
    tierColor: tierColors[tier],
    breakdown: {
      power:       { score: ps,   weight: 0.25, value: `$${pc.toFixed(3)}/kWh`, live: !!livePc },
      demand:      { score: ds,   weight: 0.25, value: `${ds}/100` },
      connectivity:{ score: cs,   weight: 0.20, value: `Tier ${intel.connTier}` },
      permitting:  { score: perm, weight: 0.15, value: `${perm}/100` },
      political:   { score: rs,   weight: 0.15, value: `${rs}/100` },
    },
    saturationRisk: intel.saturation,
    gridHeadroomMw: intel.gridMw,
    highlights: intel.highlights,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const { searchParams } = new URL(req.url);
  const forceRefresh = searchParams.get('refresh') === '1';

  if (!forceRefresh) {
    const cached = await getCached('markets_ranked');
    if (cached) return new Response(JSON.stringify({ ...cached, cached: true }), { headers: CORS });
  }

  // Fetch live EIA prices in parallel with static scoring
  const livePrices = await fetchEIAPrices();

  // Score all 25 markets
  const scored = HOTSPOTS.map(h => {
    const s = scoreMarket(h.id, livePrices[h.id] || null);
    return {
      ...h,
      ...s,
      intel: INTEL[h.id],
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Add rank
  scored.forEach((m, i) => { m.rank = i + 1; });

  const result = {
    markets: scored,
    meta: {
      count: scored.length,
      liveMarkets: Object.keys(livePrices).length,
      generatedAt: new Date().toISOString(),
      topMarket: scored[0]?.name,
    },
    cached: false,
  };

  await setCache('markets_ranked', result);

  return new Response(JSON.stringify(result), { headers: CORS });
}
