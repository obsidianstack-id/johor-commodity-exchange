export type Commodity = { id: string; slug: string; name: string; symbol: string; category: string; priceGold: number; priceUsd: number; change: number; volume: string; unit: string };
export type PricePoint = { date: string; open: number; high: number; low: number; close: number; price_gold: number; price_usd: number; change_percentage: number };
export const commodities: Commodity[] = [
 {id:'c01',slug:'makanan',name:'Makanan',symbol:'FOOD',category:'Agrikultur',priceGold:1.18,priceUsd:23.01,change:1.84,volume:'18.42K',unit:'per lot'},
 {id:'c02',slug:'senjata',name:'Senjata',symbol:'ARMS',category:'Industri',priceGold:8.4,priceUsd:163.8,change:-0.72,volume:'2.84K',unit:'per unit'},
 {id:'c03',slug:'tiket',name:'Tiket',symbol:'TICK',category:'Layanan',priceGold:0.42,priceUsd:8.19,change:0.31,volume:'41.20K',unit:'per tiket'},
 {id:'c04',slug:'kapal',name:'Kapal',symbol:'SHIP',category:'Transportasi',priceGold:940,priceUsd:18330,change:2.65,volume:'184',unit:'per kapal'},
 {id:'c05',slug:'gandum-mentah',name:'Gandum Mentah',symbol:'WHEAT',category:'Agrikultur',priceGold:0.86,priceUsd:16.77,change:1.12,volume:'12.70K',unit:'per ton'},
 {id:'c06',slug:'besi-mentah',name:'Besi Mentah',symbol:'IRON',category:'Logam',priceGold:2.75,priceUsd:53.63,change:-1.35,volume:'8.15K',unit:'per ton'},
 {id:'c07',slug:'minyak-mentah',name:'Minyak Mentah',symbol:'OIL',category:'Energi',priceGold:4.32,priceUsd:84.24,change:3.24,volume:'26.91K',unit:'per barel'},
 {id:'c08',slug:'kapas-mentah',name:'Kapas Mentah',symbol:'COTN',category:'Agrikultur',priceGold:1.52,priceUsd:29.64,change:-0.44,volume:'6.72K',unit:'per bal'},
 {id:'c09',slug:'kayu',name:'Kayu',symbol:'WOOD',category:'Bahan baku',priceGold:0.74,priceUsd:14.43,change:0.88,volume:'14.50K',unit:'per m³'},
 {id:'c10',slug:'batu-bara',name:'Batu Bara',symbol:'COAL',category:'Energi',priceGold:1.34,priceUsd:26.13,change:-2.08,volume:'21.08K',unit:'per ton'},
 {id:'c11',slug:'tembaga-mentah',name:'Tembaga Mentah',symbol:'COPR',category:'Logam',priceGold:5.7,priceUsd:111.15,change:1.91,volume:'4.64K',unit:'per ton'},
 {id:'c12',slug:'bahan-bangunan',name:'Bahan Bangunan',symbol:'BLDG',category:'Konstruksi',priceGold:1.06,priceUsd:20.67,change:0.54,volume:'9.24K',unit:'per lot'},
 {id:'c13',slug:'bahan-bakar',name:'Bahan Bakar',symbol:'FUEL',category:'Energi',priceGold:2.18,priceUsd:42.51,change:2.16,volume:'19.43K',unit:'per unit'},
 {id:'c14',slug:'elektronik',name:'Elektronik',symbol:'ELEC',category:'Teknologi',priceGold:12.5,priceUsd:243.75,change:1.07,volume:'3.81K',unit:'per unit'}
];
export function historyFor(c: Commodity): PricePoint[] {
 const dates = ['10/13','10/14','10/15','10/16','10/17','10/18','10/19'];
 const factors = [0.92,0.95,0.97,1.02,0.99,1.01,1];
 return dates.map((date,i)=> { const close = +(c.priceUsd*factors[i]).toFixed(2); const prev = i ? +(c.priceUsd*factors[i-1]).toFixed(2) : close*0.99; const open = +(i ? prev : close*0.985).toFixed(2); return {date,open,high:+(Math.max(open,close)*1.012).toFixed(2),low:+(Math.min(open,close)*0.988).toFixed(2),close,price_gold:+(close/19.5).toFixed(4),price_usd:close,change_percentage:+(((close-prev)/prev)*100).toFixed(2)}; });
}
