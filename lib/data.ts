export type Commodity = { id: string; slug: string; name: string; symbol: string; category: string; priceGold: number; priceUsd: number; change: number; volume: string; unit: string };
export type PricePoint = { date: string; open: number; high: number; low: number; close: number; price_gold: number; price_usd: number; change_percentage: number };
export type MarketSettings = { usd_per_gold: number; import_tax_pct: number; domestic_export_tax_pct: number };
// Official initial price list from the user's decision document dated 19 Oct 2026.
export const commodities: Commodity[] = [
 {id:'seed-food',slug:'makanan',name:'Makanan',symbol:'FOOD',category:'Agrikultur',priceGold:0.86,priceUsd:16.77,change:0,volume:'—',unit:'per lot'},
 {id:'seed-arms',slug:'senjata',name:'Senjata',symbol:'ARMS',category:'Industri',priceGold:1.22,priceUsd:23.79,change:0,volume:'—',unit:'per unit'},
 {id:'seed-ticket',slug:'tiket',name:'Tiket',symbol:'TICK',category:'Layanan',priceGold:1.20,priceUsd:23.40,change:0,volume:'—',unit:'per tiket'},
 {id:'seed-ship',slug:'kapal',name:'Kapal',symbol:'SHIP',category:'Transportasi',priceGold:6.99,priceUsd:136.31,change:0,volume:'—',unit:'per kapal'},
 {id:'seed-wheat',slug:'gandum-mentah',name:'Gandum Mentah',symbol:'WHEAT',category:'Agrikultur',priceGold:0.13,priceUsd:2.54,change:0,volume:'—',unit:'per ton'},
 {id:'seed-iron',slug:'besi-mentah',name:'Besi Mentah',symbol:'IRON',category:'Logam',priceGold:0.10,priceUsd:1.95,change:0,volume:'—',unit:'per ton'},
 {id:'seed-oil',slug:'minyak-mentah',name:'Minyak Mentah',symbol:'OIL',category:'Energi',priceGold:0.10,priceUsd:1.95,change:0,volume:'—',unit:'per barel'},
 {id:'seed-cotton',slug:'kapas-mentah',name:'Kapas Mentah',symbol:'COTN',category:'Agrikultur',priceGold:0.13,priceUsd:2.54,change:0,volume:'—',unit:'per bal'},
 {id:'seed-wood',slug:'kayu',name:'Kayu',symbol:'WOOD',category:'Bahan baku',priceGold:0.13,priceUsd:2.54,change:0,volume:'—',unit:'per m³'},
 {id:'seed-coal',slug:'batu-bara',name:'Batu Bara',symbol:'COAL',category:'Energi',priceGold:0.09,priceUsd:1.76,change:0,volume:'—',unit:'per ton'},
 {id:'seed-copper',slug:'tembaga-mentah',name:'Tembaga Mentah',symbol:'COPR',category:'Logam',priceGold:0.13,priceUsd:2.54,change:0,volume:'—',unit:'per ton'},
 {id:'seed-building',slug:'bahan-bangunan',name:'Bahan Bangunan',symbol:'BLDG',category:'Konstruksi',priceGold:1.39,priceUsd:27.11,change:0,volume:'—',unit:'per lot'},
 {id:'seed-fuel',slug:'bahan-bakar',name:'Bahan Bakar',symbol:'FUEL',category:'Energi',priceGold:1.00,priceUsd:19.50,change:0,volume:'—',unit:'per unit'},
 {id:'seed-electronics',slug:'elektronik',name:'Elektronik',symbol:'ELEC',category:'Teknologi',priceGold:1.40,priceUsd:27.30,change:0,volume:'—',unit:'per unit'}
];
export const defaultSettings: MarketSettings = {usd_per_gold:19.5, import_tax_pct:5, domestic_export_tax_pct:3};
export function historyFor(c: Commodity): PricePoint[] { return [{date:'2026-10-19',open:c.priceUsd,high:c.priceUsd,low:c.priceUsd,close:c.priceUsd,price_gold:c.priceGold,price_usd:c.priceUsd,change_percentage:c.change}]; }
export function rangeFor(priceUsd:number, settings:MarketSettings, priceGold?:number){
 // Use the unrounded conversion (GOLD × FX) for tax calculation, then round each displayed amount.
 // This matches the source PDF even where rounding the displayed base first would differ (e.g. coal/ship).
 const rawBase=priceGold===undefined?priceUsd:priceGold*settings.usd_per_gold;
 // The source says 3% domestic/export adjustment, but its published minimum equals base price.
 return {min:round2(rawBase),max:round2(rawBase*(1+settings.import_tax_pct/100))};
}
export function round2(n:number){return Math.round((n+Number.EPSILON)*100)/100;}
