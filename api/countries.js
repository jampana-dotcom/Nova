// data/countries.js
// Static lookup tables for global pin-drop resolution
// Sources:
//   Power: IEA World Energy Prices 2024 (industrial $/kWh)
//   Political risk: World Bank WGI 2023 (rule of law + political stability, normalized 0-100)
//   Connectivity: derived from submarinecablemap.com landing station density, 1-4 tier
// Update cadence: annually (IEA releases Q4, WB WGI releases Q4)

export const COUNTRY_DATA = {
  // ISO2: { pc: $/kWh, risk: 0-100 (100=safest), conn: 1-4 (1=best) }
  // North America
  US: { pc: 0.077, risk: 88, conn: 1 },
  CA: { pc: 0.095, risk: 90, conn: 1 },
  MX: { pc: 0.062, risk: 52, conn: 2 },

  // Western Europe
  GB: { pc: 0.198, risk: 87, conn: 1 },
  DE: { pc: 0.185, risk: 88, conn: 1 },
  FR: { pc: 0.142, risk: 82, conn: 1 },
  NL: { pc: 0.148, risk: 91, conn: 1 },
  IE: { pc: 0.210, risk: 89, conn: 1 },
  CH: { pc: 0.175, risk: 95, conn: 1 },
  SE: { pc: 0.075, risk: 93, conn: 1 },
  NO: { pc: 0.052, risk: 94, conn: 2 },
  DK: { pc: 0.168, risk: 95, conn: 1 },
  FI: { pc: 0.095, risk: 94, conn: 1 },
  BE: { pc: 0.165, risk: 83, conn: 1 },
  AT: { pc: 0.172, risk: 87, conn: 2 },
  ES: { pc: 0.135, risk: 78, conn: 1 },
  PT: { pc: 0.158, risk: 83, conn: 1 },
  IT: { pc: 0.178, risk: 72, conn: 1 },
  PL: { pc: 0.125, risk: 72, conn: 2 },
  CZ: { pc: 0.138, risk: 78, conn: 2 },
  HU: { pc: 0.128, risk: 65, conn: 2 },
  RO: { pc: 0.112, risk: 62, conn: 2 },
  GR: { pc: 0.168, risk: 68, conn: 2 },
  LU: { pc: 0.158, risk: 92, conn: 1 },
  IS: { pc: 0.041, risk: 96, conn: 2 },

  // Eastern Europe / Central Asia
  RU: { pc: 0.048, risk: 18, conn: 2 },
  UA: { pc: 0.062, risk: 30, conn: 3 },
  KZ: { pc: 0.038, risk: 40, conn: 3 },
  UZ: { pc: 0.032, risk: 35, conn: 3 },
  BY: { pc: 0.055, risk: 22, conn: 3 },
  GE: { pc: 0.072, risk: 55, conn: 3 },
  AZ: { pc: 0.058, risk: 42, conn: 3 },

  // Middle East
  AE: { pc: 0.040, risk: 72, conn: 1 },
  SA: { pc: 0.032, risk: 55, conn: 1 },
  QA: { pc: 0.028, risk: 65, conn: 1 },
  KW: { pc: 0.025, risk: 60, conn: 2 },
  BH: { pc: 0.038, risk: 58, conn: 2 },
  OM: { pc: 0.045, risk: 60, conn: 2 },
  JO: { pc: 0.112, risk: 62, conn: 2 },
  IL: { pc: 0.115, risk: 58, conn: 1 },
  TR: { pc: 0.098, risk: 45, conn: 2 },
  EG: { pc: 0.055, risk: 42, conn: 2 },

  // Africa
  ZA: { pc: 0.082, risk: 55, conn: 2 },
  NG: { pc: 0.068, risk: 28, conn: 3 },
  KE: { pc: 0.095, risk: 48, conn: 2 },
  ET: { pc: 0.048, risk: 35, conn: 3 },
  GH: { pc: 0.078, risk: 52, conn: 3 },
  TZ: { pc: 0.082, risk: 48, conn: 3 },
  MA: { pc: 0.095, risk: 55, conn: 2 },
  TN: { pc: 0.088, risk: 52, conn: 2 },
  CI: { pc: 0.102, risk: 45, conn: 3 },
  CM: { pc: 0.095, risk: 35, conn: 4 },
  SN: { pc: 0.112, risk: 52, conn: 3 },
  UG: { pc: 0.088, risk: 42, conn: 4 },
  ZM: { pc: 0.072, risk: 48, conn: 4 },
  AO: { pc: 0.065, risk: 32, conn: 3 },
  MZ: { pc: 0.058, risk: 35, conn: 3 },
  RW: { pc: 0.095, risk: 52, conn: 3 },
  MU: { pc: 0.145, risk: 72, conn: 2 },
  DZ: { pc: 0.042, risk: 38, conn: 3 },
  LY: { pc: 0.028, risk: 12, conn: 4 },

  // Asia Pacific
  JP: { pc: 0.168, risk: 88, conn: 1 },
  SG: { pc: 0.148, risk: 90, conn: 1 },
  AU: { pc: 0.122, risk: 88, conn: 1 },
  NZ: { pc: 0.115, risk: 92, conn: 2 },
  KR: { pc: 0.092, risk: 80, conn: 1 },
  HK: { pc: 0.152, risk: 55, conn: 1 },
  TW: { pc: 0.095, risk: 78, conn: 1 },
  CN: { pc: 0.078, risk: 42, conn: 1 },
  IN: { pc: 0.085, risk: 58, conn: 1 },
  TH: { pc: 0.095, risk: 52, conn: 2 },
  MY: { pc: 0.072, risk: 62, conn: 1 },
  ID: { pc: 0.082, risk: 50, conn: 2 },
  PH: { pc: 0.145, risk: 48, conn: 2 },
  VN: { pc: 0.068, risk: 45, conn: 2 },
  BD: { pc: 0.072, risk: 38, conn: 3 },
  PK: { pc: 0.092, risk: 28, conn: 3 },
  LK: { pc: 0.112, risk: 42, conn: 3 },
  MM: { pc: 0.058, risk: 18, conn: 4 },
  KH: { pc: 0.118, risk: 38, conn: 3 },
  NP: { pc: 0.058, risk: 42, conn: 4 },
  MN: { pc: 0.065, risk: 52, conn: 4 },

  // Latin America
  BR: { pc: 0.092, risk: 52, conn: 1 },
  CL: { pc: 0.112, risk: 72, conn: 2 },
  CO: { pc: 0.085, risk: 52, conn: 2 },
  AR: { pc: 0.048, risk: 38, conn: 2 },
  PE: { pc: 0.078, risk: 48, conn: 2 },
  EC: { pc: 0.072, risk: 45, conn: 3 },
  UY: { pc: 0.115, risk: 75, conn: 2 },
  PY: { pc: 0.048, risk: 48, conn: 3 },
  BO: { pc: 0.058, risk: 42, conn: 3 },
  VE: { pc: 0.012, risk: 10, conn: 3 },
  CR: { pc: 0.108, risk: 75, conn: 2 },
  PA: { pc: 0.115, risk: 65, conn: 1 },
  DO: { pc: 0.145, risk: 55, conn: 2 },
  GT: { pc: 0.118, risk: 42, conn: 3 },
  CU: { pc: 0.085, risk: 20, conn: 4 },

  // Fallback for unknown
  XX: { pc: 0.095, risk: 45, conn: 3 },
};

// Submarine cable landing station clusters
// Preprocessed from submarinecablemap.com GeoJSON
// Each entry: [lat, lng, tier] where tier 1 = major hub, 4 = minimal
// Used to compute connectivity score for arbitrary coordinates
export const CABLE_STATIONS = [
  // Major Atlantic hubs
  [38.72, -9.14,  1], // Lisbon
  [51.50, -0.12,  1], // London (Bude/Porthcurno area)
  [48.86,  2.35,  1], // Paris (Marseille landing)
  [40.71, -74.01, 1], // New York
  [25.77, -80.19, 1], // Miami
  [37.77,-122.42, 1], // San Francisco
  [47.61,-122.33, 1], // Seattle
  [21.31,-157.86, 1], // Hawaii (major trans-pac hub)
  [1.35,  103.82, 1], // Singapore
  [35.68, 139.69, 1], // Tokyo
  [22.39, 114.11, 1], // Hong Kong
  [-33.87,151.21, 1], // Sydney
  [19.08,  72.88, 2], // Mumbai
  [6.45,   3.47,  2], // Lagos
  [-26.20, 28.04, 2], // Johannesburg (Mtunzini landing)
  [36.81,  10.18, 2], // Tunis
  [30.06,  31.25, 2], // Cairo (Alexandria)
  [25.20,  55.27, 2], // Dubai
  [14.69, -17.44, 3], // Dakar
  [-23.55,-46.63, 2], // São Paulo (Fortaleza)
  [-33.45,-70.67, 3], // Santiago
  [10.48, -66.87, 3], // Caracas (La Guaira)
  [9.05,   7.49,  3], // Abuja
  [-4.32,  15.32, 4], // Kinshasa
  [59.33,  18.06, 2], // Stockholm
  [60.39,   5.32, 2], // Bergen (NO)
  [55.68,  12.57, 2], // Copenhagen
  [52.37,   4.90, 1], // Amsterdam
  [53.55,   9.99, 2], // Hamburg
  [37.98,  23.73, 2], // Athens (Chania)
  [41.01,  28.97, 2], // Istanbul
  [43.30,   5.37, 2], // Marseille
  [45.46,   9.19, 2], // Milan (Genoa)
  [40.42,  -3.70, 2], // Madrid (Valencia)
  [14.09, 100.48, 2], // Bangkok
  [10.82, 106.63, 2], // Ho Chi Minh City
  [3.15,  101.69, 2], // Kuala Lumpur (Port Dickson)
  [13.76, 100.50, 2], // Thailand
  [-6.21, 106.85, 2], // Jakarta
  [14.60, 120.97, 2], // Manila
  [31.23, 121.47, 2], // Shanghai
  [22.54, 114.06, 2], // Shenzhen
  [39.90, 116.41, 2], // Beijing (Qingdao)
  [37.57, 126.98, 2], // Seoul (Busan)
  [34.69, 135.50, 2], // Osaka
  [35.17, 136.91, 2], // Nagoya
  [-37.81, 144.96, 2], // Melbourne
  [-27.47, 153.02, 2], // Brisbane
  [-31.95, 115.86, 3], // Perth
  [36.86,  10.18, 2], // Tunis
  [-18.91,  47.54, 4], // Antananarivo
  [-4.04,  39.67, 3], // Mombasa
  [-8.84,  13.23, 3], // Luanda
  [15.55,  32.53, 4], // Khartoum
  [0,       0,     4], // fallback
];

// Political risk tier labels for UI display
export const RISK_LABELS = {
  high:   { min: 75, label: 'Low risk',      color: '#0F6E56' },
  medium: { min: 50, label: 'Moderate risk', color: '#BA7517' },
  low:    { min: 25, label: 'Elevated risk', color: '#D85A30' },
  vlow:   { min: 0,  label: 'High risk',     color: '#A32D2D' },
};

// Connectivity tier labels
export const CONN_LABELS = {
  1: { label: 'Tier 1 — Major hub',     desc: 'Direct submarine cable landing, <5ms to internet backbone' },
  2: { label: 'Tier 2 — Regional',      desc: 'Within 500km of cable landing, low-latency terrestrial link' },
  3: { label: 'Tier 3 — Emerging',      desc: 'Indirect connectivity, 10–30ms additional latency expected' },
  4: { label: 'Tier 4 — Remote',        desc: 'Satellite or single terrestrial provider, high latency risk' },
};
