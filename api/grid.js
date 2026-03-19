// api/grid.js — Grid intelligence edge function
// GET /api/grid?market=nva
// GET /api/grid?lat=XX&lng=YY&country=US
export const config = { runtime: 'edge' };
const SB_URL = () => process.env.SUPABASE_URL || 'https://nqivrdsnlivtmijtkjqh.supabase.co';
const SB_KEY = () => process.env.SUPABASE_SERVICE_KEY;
const CORS = { 'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Cache-Control':'public, max-age=3600' };

const GRID_DATA = {
  US_VA:{country:'US',region:'Virginia / PJM',utility:'Dominion Energy',mix:{solar:4,wind:8,hydro:3,nuclear:35,gas:38,coal:10,other:2},renewablesPct:15,renewables2030Target:30,carbonIntensity:310,gridHeadroomMw:800,queueBacklogMw:42000,queueNote:'PJM queue severely congested — 2-4yr interconnection timeline',ppaAvailable:true,ppaNote:'Active VPPA market. Microsoft, Amazon signed large deals here.',reliability:99.97,saidiHours:2.1,gridStress:'high',gridStressNote:'Dominion adding 970MW solar 2024-2026 but demand outpacing supply',substationAccess:'good',dcFriendlyUtility:true,keyRisk:'Power constraint is #1 limiting factor for new DC development'},
  US_OR:{country:'US',region:'Oregon / BPA',utility:'Bonneville Power Administration',mix:{solar:2,wind:14,hydro:72,nuclear:0,gas:8,coal:2,other:2},renewablesPct:88,renewables2030Target:95,carbonIntensity:45,gridHeadroomMw:2800,queueBacklogMw:8000,queueNote:'BPA processing improving. The Dalles corridor well-served.',ppaAvailable:true,ppaNote:'BPA Green Tariff available. Excellent renewable PPA market.',reliability:99.96,saidiHours:2.4,gridStress:'low',gridStressNote:'Hydro baseload provides exceptional flexibility',substationAccess:'excellent',dcFriendlyUtility:true,keyRisk:'Wildfire risk increasing — resilience planning required'},
  US_TX:{country:'US',region:'Texas / ERCOT',utility:'ERCOT (deregulated)',mix:{solar:18,wind:28,hydro:1,nuclear:11,gas:38,coal:4,other:0},renewablesPct:47,renewables2030Target:60,carbonIntensity:280,gridHeadroomMw:2200,queueBacklogMw:180000,queueNote:'ERCOT queue enormous but processing improved post-2023 reforms',ppaAvailable:true,ppaNote:'Best PPA market in US. Wind + solar both very active.',reliability:99.90,saidiHours:5.2,gridStress:'medium',gridStressNote:'Weather event risk — requires N+2 planning',substationAccess:'good',dcFriendlyUtility:true,keyRisk:'Extreme weather events. No interconnection with rest of US grid.'},
  US_AZ:{country:'US',region:'Arizona / APS + SRP',utility:'Arizona Public Service + Salt River Project',mix:{solar:22,wind:5,hydro:4,nuclear:28,gas:36,coal:5,other:0},renewablesPct:31,renewables2030Target:65,carbonIntensity:260,gridHeadroomMw:3500,queueBacklogMw:22000,queueNote:'WECC queue manageable. Mesa/Goodyear corridor well-served.',ppaAvailable:true,ppaNote:'Strong solar PPA market. APS has DC-specific tariffs.',reliability:99.95,saidiHours:2.8,gridStress:'low',gridStressNote:'Significant new capacity planned. Nuclear + solar mix very reliable.',substationAccess:'excellent',dcFriendlyUtility:true,keyRisk:'Extreme heat — cooling costs 15-20% higher than northern markets'},
  US_IL:{country:'US',region:'Illinois / ComEd / PJM',utility:'ComEd (Exelon)',mix:{solar:3,wind:12,hydro:1,nuclear:54,gas:22,coal:8,other:0},renewablesPct:16,renewables2030Target:40,carbonIntensity:155,gridHeadroomMw:1200,queueBacklogMw:15000,queueNote:'PJM queue applies. ComEd suburban corridors better than city.',ppaAvailable:true,ppaNote:'Nuclear PPAs via Exelon. Wind from central IL.',reliability:99.98,saidiHours:1.8,gridStress:'medium',gridStressNote:'Nuclear baseload provides exceptional reliability',substationAccess:'good',dcFriendlyUtility:true,keyRisk:'High power cost vs Texas/Arizona.'},
  US_CA:{country:'US',region:'California / CAISO',utility:'PG&E / CAISO',mix:{solar:28,wind:13,hydro:11,nuclear:8,gas:35,coal:1,other:4},renewablesPct:52,renewables2030Target:90,carbonIntensity:190,gridHeadroomMw:300,queueBacklogMw:95000,queueNote:'CAISO queue extremely congested. 3-6yr timelines common.',ppaAvailable:true,ppaNote:'Active PPA market but grid injection complex.',reliability:99.92,saidiHours:3.8,gridStress:'high',gridStressNote:'Duck curve problem. Grid stressed during evening peak.',substationAccess:'poor',dcFriendlyUtility:false,keyRisk:'PG&E reliability. Wildfire PSPS events. Grid severely constrained.'},
  US_WA:{country:'US',region:'Washington / Puget Sound Energy',utility:'Puget Sound Energy + Seattle City Light',mix:{solar:1,wind:8,hydro:68,nuclear:0,gas:18,coal:5,other:0},renewablesPct:77,renewables2030Target:100,carbonIntensity:85,gridHeadroomMw:900,queueBacklogMw:12000,queueNote:'Eastern WA corridor better. Western WA constrained.',ppaAvailable:true,ppaNote:'BPA wind PPAs accessible. Hydro RECs available.',reliability:99.95,saidiHours:2.2,gridStress:'medium',gridStressNote:'Eastern WA hydro excellent. Western grid near capacity.',substationAccess:'good',dcFriendlyUtility:true,keyRisk:'Seismic risk. Western grid constrained — prefer East Cascades.'},
  GB:{country:'GB',region:'Great Britain / National Grid ESO',utility:'National Grid ESO',mix:{solar:5,wind:29,hydro:2,nuclear:14,gas:33,coal:1,other:16},renewablesPct:36,renewables2030Target:95,carbonIntensity:180,gridHeadroomMw:600,queueBacklogMw:750000,queueNote:'GB connection queue crisis-level. 10yr+ waits. Govt reform underway.',ppaAvailable:true,ppaNote:'Strong offshore wind PPA market. CfD mechanism available.',reliability:99.97,saidiHours:0.9,gridStress:'high',gridStressNote:'Connection constraint is existential issue for UK DC market',substationAccess:'poor',dcFriendlyUtility:false,keyRisk:'Grid connection queue is #1 constraint. Slough/Berkshire at limit.'},
  DE:{country:'DE',region:'Germany / 4 TSOs',utility:'50Hertz + Amprion + TenneT + TransnetBW',mix:{solar:12,wind:37,hydro:4,nuclear:0,gas:14,coal:26,other:7},renewablesPct:53,renewables2030Target:80,carbonIntensity:350,gridHeadroomMw:1800,queueBacklogMw:35000,queueNote:'Frankfurt Rhine-Main well-served. North-South bottleneck exists.',ppaAvailable:true,ppaNote:'Active wind + solar PPA market. Corporate PPA market mature.',reliability:99.998,saidiHours:0.4,gridStress:'medium',gridStressNote:'World best reliability but coal transition creating volatility.',substationAccess:'good',dcFriendlyUtility:true,keyRisk:'High power cost. Coal transition price volatility 2024-2028.'},
  NL:{country:'NL',region:'Netherlands / TenneT NL',utility:'TenneT Netherlands',mix:{solar:15,wind:22,hydro:0,nuclear:3,gas:55,coal:5,other:0},renewablesPct:37,renewables2030Target:70,carbonIntensity:290,gridHeadroomMw:400,queueBacklogMw:45000,queueNote:'CRITICAL: TenneT declared grid full. No new connections until 2028+.',ppaAvailable:true,ppaNote:'Offshore wind PPAs available but grid injection limited.',reliability:99.99,saidiHours:0.3,gridStress:'high',gridStressNote:'Grid moratorium across Amsterdam/Rotterdam region.',substationAccess:'poor',dcFriendlyUtility:false,keyRisk:'Active grid moratorium. Only viable in Zeeland/Groningen.'},
  IE:{country:'IE',region:'Ireland / EirGrid',utility:'EirGrid',mix:{solar:5,wind:40,hydro:3,nuclear:0,gas:49,coal:3,other:0},renewablesPct:48,renewables2030Target:80,carbonIntensity:260,gridHeadroomMw:350,queueBacklogMw:8000,queueNote:'Dublin DCOM moratorium active. Munster more open.',ppaAvailable:true,ppaNote:'Strong wind PPA market. RESS auction scheme active.',reliability:99.95,saidiHours:2.1,gridStress:'high',gridStressNote:'EirGrid Dublin connection moratorium extended to 2028',substationAccess:'poor',dcFriendlyUtility:false,keyRisk:'Dublin grid at capacity. DCs using 21% of national electricity.'},
  FR:{country:'FR',region:'France / RTE',utility:'RTE',mix:{solar:6,wind:10,hydro:11,nuclear:65,gas:6,coal:1,other:1},renewablesPct:27,renewables2030Target:40,carbonIntensity:55,gridHeadroomMw:1200,queueBacklogMw:18000,queueNote:'Ile-de-France well-served. RTE processing improving.',ppaAvailable:true,ppaNote:'EDF nuclear PPAs (ARENH). Solar/wind corporate PPAs active.',reliability:99.99,saidiHours:0.8,gridStress:'medium',gridStressNote:'Nuclear maintenance creates occasional stress. Baseload reliable.',substationAccess:'good',dcFriendlyUtility:true,keyRisk:'Nuclear dependency risk. 2022 corrosion issue showed vulnerability.'},
  CH:{country:'CH',region:'Switzerland / Swissgrid',utility:'Swissgrid',mix:{solar:6,wind:1,hydro:57,nuclear:33,gas:2,coal:0,other:1},renewablesPct:64,renewables2030Target:68,carbonIntensity:30,gridHeadroomMw:500,queueBacklogMw:3000,queueNote:'Limited but manageable queue. Zug/Zurich corridor premium.',ppaAvailable:true,ppaNote:'Hydro PPAs well-established. Green hydro certificates available.',reliability:99.999,saidiHours:0.2,gridStress:'low',gridStressNote:'Most reliable grid in the world. Alpine hydro exceptional.',substationAccess:'good',dcFriendlyUtility:true,keyRisk:'Very high cost. Limited scale.'},
  SE:{country:'SE',region:'Sweden / Svenska kraftnat',utility:'Svenska kraftnat',mix:{solar:1,wind:22,hydro:44,nuclear:30,gas:1,coal:1,other:1},renewablesPct:67,renewables2030Target:100,carbonIntensity:40,gridHeadroomMw:2200,queueBacklogMw:12000,queueNote:'SE3 (Stockholm) some constraints. SE1 (north) essentially unlimited.',ppaAvailable:true,ppaNote:'Excellent wind + hydro PPA market. Elcertifikat scheme active.',reliability:99.97,saidiHours:1.2,gridStress:'low',gridStressNote:'Abundant capacity. North Sweden has unlimited clean power.',substationAccess:'excellent',dcFriendlyUtility:true,keyRisk:'Distance from EU users (+20ms). Cold climate operations.'},
  NO:{country:'NO',region:'Norway / Statnett',utility:'Statnett',mix:{solar:0,wind:12,hydro:88,nuclear:0,gas:0,coal:0,other:0},renewablesPct:100,renewables2030Target:100,carbonIntensity:18,gridHeadroomMw:5000,queueBacklogMw:6000,queueNote:'Significant capacity in Trondheim/Bergen. Govt actively developing.',ppaAvailable:true,ppaNote:'Direct hydro PPAs available. Best renewable PPA market globally.',reliability:99.96,saidiHours:1.8,gridStress:'low',gridStressNote:'Near-unlimited clean power. Drought risk in very dry years.',substationAccess:'good',dcFriendlyUtility:true,keyRisk:'Remote location. Latency to EU. Cold climate logistics.'},
  SG:{country:'SG',region:'Singapore / EMA',utility:'SP Group / EMA',mix:{solar:3,wind:0,hydro:0,nuclear:0,gas:95,coal:0,other:2},renewablesPct:3,renewables2030Target:10,carbonIntensity:410,gridHeadroomMw:500,queueBacklogMw:2000,queueNote:'EMA DC moratoria in place. Johor interconnect expanding.',ppaAvailable:false,ppaNote:'Limited PPA market. Regional import PPAs emerging.',reliability:99.999,saidiHours:0.1,gridStress:'high',gridStressNote:'Grid constrained by island geography.',substationAccess:'good',dcFriendlyUtility:true,keyRisk:'Near-zero local renewables. Carbon tax escalating. MW caps.'},
  JP:{country:'JP',region:'Japan / TEPCO',utility:'TEPCO / OCCTO',mix:{solar:10,wind:1,hydro:8,nuclear:10,gas:34,coal:32,other:5},renewablesPct:19,renewables2030Target:36,carbonIntensity:445,gridHeadroomMw:1200,queueBacklogMw:28000,queueNote:'TEPCO queue improving. Osaka/Chubu alternatives recommended.',ppaAvailable:true,ppaNote:'Solar PPA market growing. FIP transition creating opportunities.',reliability:99.99,saidiHours:0.3,gridStress:'medium',gridStressNote:'Nuclear restart helping capacity.',substationAccess:'good',dcFriendlyUtility:true,keyRisk:'High carbon intensity. Earthquake/tsunami risk. High power cost.'},
  AE:{country:'AE',region:'UAE / DEWA + ADWEC',utility:'Dubai Electricity and Water Authority (DEWA)',mix:{solar:8,wind:0,hydro:0,nuclear:20,gas:70,coal:2,other:0},renewablesPct:28,renewables2030Target:44,carbonIntensity:370,gridHeadroomMw:2000,queueBacklogMw:3000,queueNote:'DEWA fast-tracks DC connections. White glove service.',ppaAvailable:true,ppaNote:'MBRS Solar Park PPA available. Barakah nuclear PPA emerging.',reliability:99.997,saidiHours:0.4,gridStress:'low',gridStressNote:'DEWA grid world-class. Exceptional reliability.',substationAccess:'excellent',dcFriendlyUtility:true,keyRisk:'Extreme heat — cooling energy 30-40% of total.'},
  AU:{country:'AU',region:'Australia / AEMO NEM',utility:'AEMO',mix:{solar:18,wind:14,hydro:7,nuclear:0,gas:20,coal:38,other:3},renewablesPct:39,renewables2030Target:82,carbonIntensity:520,gridHeadroomMw:800,queueBacklogMw:35000,queueNote:'AEMO queue improving. Western Sydney corridor active.',ppaAvailable:true,ppaNote:'Strong LGC market. Solar PPAs very active.',reliability:99.91,saidiHours:5.8,gridStress:'medium',gridStressNote:'Transitioning rapidly. Coal exits creating PPA opportunity.',substationAccess:'good',dcFriendlyUtility:true,keyRisk:'Grid transition volatility 2024-2030.'},
  IN:{country:'IN',region:'India / MSEDCL',utility:'MSEDCL (Mumbai)',mix:{solar:17,wind:10,hydro:10,nuclear:3,gas:5,coal:55,other:0},renewablesPct:27,renewables2030Target:50,carbonIntensity:620,gridHeadroomMw:1500,queueBacklogMw:55000,queueNote:'Maharashtra queue improving. 12-18 month processing.',ppaAvailable:true,ppaNote:'Large open access solar/wind PPA market. Group Captive structure common.',reliability:99.5,saidiHours:18,gridStress:'medium',gridStressNote:'Reliability varies by area. Industrial zones better served.',substationAccess:'good',dcFriendlyUtility:false,keyRisk:'Grid reliability requires significant backup power investment.'},
  BR:{country:'BR',region:'Brazil / ONS',utility:'CPFL / EDP',mix:{solar:5,wind:13,hydro:63,nuclear:2,gas:12,coal:3,other:2},renewablesPct:81,renewables2030Target:85,carbonIntensity:95,gridHeadroomMw:1200,queueBacklogMw:22000,queueNote:'ANEEL queue improving post-privatization.',ppaAvailable:true,ppaNote:'Excellent renewable PPA market. ACL free market active.',reliability:99.8,saidiHours:8.2,gridStress:'medium',gridStressNote:'Hydro drought risk. Diversification improving.',substationAccess:'good',dcFriendlyUtility:false,keyRisk:'Hydro drought risk. Regulatory complexity. FX volatility.'},
  CL:{country:'CL',region:'Chile / SEN',utility:'Enel Chile / AES Andes',mix:{solar:18,wind:14,hydro:30,nuclear:0,gas:20,coal:18,other:0},renewablesPct:62,renewables2030Target:80,carbonIntensity:230,gridHeadroomMw:800,queueBacklogMw:8000,queueNote:'SEN queue manageable. Atacama solar world-class resource.',ppaAvailable:true,ppaNote:'Excellent solar PPA market. World cheapest solar PPAs.',reliability:99.92,saidiHours:3.2,gridStress:'low',gridStressNote:'Rapid renewable buildout. Transmission improving.',substationAccess:'good',dcFriendlyUtility:true,keyRisk:'Earthquake risk. Transmission constraints Norte-Centro.'},
  MX:{country:'MX',region:'Mexico / CENACE / CFE',utility:'CFE',mix:{solar:8,wind:9,hydro:10,nuclear:2,gas:60,coal:8,other:3},renewablesPct:27,renewables2030Target:35,carbonIntensity:380,gridHeadroomMw:1200,queueBacklogMw:15000,queueNote:'Queretaro SIN grid well-served. CFE permitting improving.',ppaAvailable:true,ppaNote:'Private PPA market active despite CFE policy uncertainty.',reliability:99.85,saidiHours:6.2,gridStress:'medium',gridStressNote:'CFE investment improving. Private sector limited.',substationAccess:'good',dcFriendlyUtility:false,keyRisk:'CFE policy risk. Security concerns in some regions.'},
  ZA:{country:'ZA',region:'South Africa / Eskom',utility:'Eskom',mix:{solar:5,wind:7,hydro:1,nuclear:5,gas:3,coal:79,other:0},renewablesPct:13,renewables2030Target:41,carbonIntensity:750,gridHeadroomMw:600,queueBacklogMw:18000,queueNote:'NERSA queue improving post-Eskom reform. Samrand corridor active.',ppaAvailable:true,ppaNote:'REIPP PPA program active. IPP market opening significantly.',reliability:99.1,saidiHours:52,gridStress:'high',gridStressNote:'Load shedding reducing (2024) but structural risk remains.',substationAccess:'good',dcFriendlyUtility:false,keyRisk:'Load shedding requires full backup generation. Diesel OPEX significant.'},
};

const MARKET_GRID_MAP = {nva:'US_VA',sva:'US_CA',dal:'US_TX',phx:'US_AZ',chi:'US_IL',ore:'US_OR',sea:'US_WA',lon:'GB',fra:'DE',ams:'NL',dub:'IE',par:'FR',zur:'CH',sto:'SE',nor:'NO',sgp:'SG',tok:'JP',osk:'JP',dxb:'AE',syd:'AU',bom:'IN',mex:'MX',scl:'CL',joh:'ZA',sao:'BR'};
const COUNTRY_GRID_MAP = {US:'US_VA',GB:'GB',DE:'DE',NL:'NL',IE:'IE',FR:'FR',CH:'CH',SE:'SE',NO:'NO',SG:'SG',JP:'JP',AU:'AU',AE:'AE',IN:'IN',BR:'BR',CL:'CL',MX:'MX',ZA:'ZA'};

async function fetchEmber(countryCode) {
  const key = process.env.EMBER_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`https://api.ember-climate.org/v1/electricity-generation/monthly?country=${countryCode}&limit=1`,
      {headers:{'Authorization':`Token ${key}`},signal:AbortSignal.timeout(4000)});
    if (!r.ok) return null;
    const j = await r.json();
    const d = j?.data?.[0];
    if (!d) return null;
    return {renewablesPct:d.renewables_share_of_generation?Math.round(d.renewables_share_of_generation):null,carbonIntensity:d.co2_intensity?Math.round(d.co2_intensity):null,period:d.date};
  } catch { return null; }
}

async function fetchWattTime(lat, lng) {
  const user=process.env.WATTTIME_USER, pass=process.env.WATTTIME_PASS;
  if (!user||!pass||isNaN(lat)||isNaN(lng)) return null;
  try {
    const tr = await fetch('https://api.watttime.org/login',{headers:{'Authorization':'Basic '+btoa(`${user}:${pass}`)},signal:AbortSignal.timeout(3000)});
    if (!tr.ok) return null;
    const {token} = await tr.json();
    const r = await fetch(`https://api.watttime.org/index?latitude=${lat}&longitude=${lng}`,{headers:{'Authorization':`Bearer ${token}`},signal:AbortSignal.timeout(4000)});
    if (!r.ok) return null;
    const j = await r.json();
    return {moerGco2:j.moer?Math.round(j.moer*0.453592):null,rating:j.rating,percent:j.percent,region:j.region};
  } catch { return null; }
}

async function getCached(key) {
  try {
    const r=await fetch(`${SB_URL()}/rest/v1/api_cache?key=eq.${encodeURIComponent(key)}&select=value,fetched_at`,{headers:{'apikey':SB_KEY(),'Authorization':`Bearer ${SB_KEY()}`}});
    if (!r.ok) return null;
    const rows=await r.json();
    if (!rows?.length) return null;
    if (Date.now()-new Date(rows[0].fetched_at).getTime()>6*60*60*1000) return null;
    return JSON.parse(rows[0].value);
  } catch { return null; }
}

async function setCache(key, value) {
  try {
    await fetch(`${SB_URL()}/rest/v1/api_cache`,{method:'POST',headers:{'apikey':SB_KEY(),'Authorization':`Bearer ${SB_KEY()}`,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},body:JSON.stringify({key,value:JSON.stringify(value),fetched_at:new Date().toISOString()})});
  } catch {}
}

export default async function handler(req) {
  if (req.method==='OPTIONS') return new Response(null,{status:204,headers:CORS});
  const {searchParams} = new URL(req.url);
  const marketId = searchParams.get('market');
  const lat = parseFloat(searchParams.get('lat'));
  const lng = parseFloat(searchParams.get('lng'));
  const countryCode = searchParams.get('country')||'US';
  const forceRefresh = searchParams.get('refresh')==='1';

  const gridKey = marketId ? MARKET_GRID_MAP[marketId] : COUNTRY_GRID_MAP[countryCode];
  const g = gridKey ? GRID_DATA[gridKey] : null;
  if (!g) return new Response(JSON.stringify({available:false,message:'No grid data for this location'}),{headers:CORS});

  const cacheKey = `grid_${gridKey}`;
  if (!forceRefresh) {
    const cached = await getCached(cacheKey);
    if (cached) return new Response(JSON.stringify({...cached,cached:true}),{headers:CORS});
  }

  const [ember, watt] = await Promise.all([
    fetchEmber(g.country),
    fetchWattTime(lat, lng),
  ]);

  const renewablesPct = ember?.renewablesPct ?? g.renewablesPct;
  const carbonIntensity = watt?.moerGco2 ?? ember?.carbonIntensity ?? g.carbonIntensity;
  const renewables = (g.mix.solar||0)+(g.mix.wind||0)+(g.mix.hydro||0);
  const ppaRating = !g.ppaAvailable?'none':renewablesPct>50?'excellent':renewablesPct>25?'good':'limited';

  const result = {
    available:true, gridKey, marketId:marketId||null,
    region:g.region, utility:g.utility, dcFriendlyUtility:g.dcFriendlyUtility,
    mix:g.mix,
    mixSummary:{renewables,lowCarbon:renewables+(g.mix.nuclear||0),fossil:(g.mix.gas||0)+(g.mix.coal||0)},
    renewablesPct, renewables2030Target:g.renewables2030Target,
    renewablesGap:g.renewables2030Target-renewablesPct,
    renewablesSource:ember?'Ember Climate (live)':'IEA 2024 (baseline)',
    carbonIntensity, carbonSource:watt?'WattTime (real-time)':ember?'Ember (monthly)':'IEA baseline',
    wattTimeRating:watt?.rating||null, wattTimePercent:watt?.percent||null,
    gridHeadroomMw:g.gridHeadroomMw, queueBacklogMw:g.queueBacklogMw,
    queueNote:g.queueNote, gridStress:g.gridStress, gridStressNote:g.gridStressNote,
    substationAccess:g.substationAccess, reliability:g.reliability, saidiHours:g.saidiHours,
    ppaAvailable:g.ppaAvailable, ppaRating, ppaNote:g.ppaNote,
    keyRisk:g.keyRisk,
    liveSignals:{ember:!!ember,wattTime:!!watt},
    generatedAt:new Date().toISOString(), cached:false,
  };

  await setCache(cacheKey, result);
  return new Response(JSON.stringify(result),{headers:CORS});
}
