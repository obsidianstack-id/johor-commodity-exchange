'use client';
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import type {ReactNode} from 'react';
import {supabase} from '@/lib/supabase';
import {commodities as seed,defaultSettings,historyFor} from '@/lib/data';
import type {Commodity,MarketSettings,PricePoint} from '@/lib/data';
type Ctx={commodities:Commodity[];settings:MarketSettings;histories:Record<string,PricePoint[]>;loading:boolean;connected:boolean;refresh:()=>Promise<void>};
const MarketContext=createContext<Ctx|null>(null);
function mapCommodity(r:any):Commodity{return {id:r.id,slug:r.slug,name:r.name,symbol:r.symbol,category:r.category,unit:r.unit,priceGold:Number(r.price_gold),priceUsd:Number(r.price_usd),change:Number(r.daily_change_pct||0),volume:r.indicative_volume||'—'};}
function mapHistory(r:any):PricePoint{return {date:String(r.date),open:Number(r.open_usd??r.close_usd??r.price_usd),high:Number(r.high_usd??r.close_usd??r.price_usd),low:Number(r.low_usd??r.close_usd??r.price_usd),close:Number(r.close_usd??r.price_usd),price_gold:Number(r.price_gold),price_usd:Number(r.price_usd),change_percentage:Number(r.change_percentage||0)};}
export function MarketDataProvider({children}:{children:ReactNode}){
 const [rows,setRows]=useState<Commodity[]>(seed);const [settings,setSettings]=useState<MarketSettings>(defaultSettings);const [histories,setHistories]=useState<Record<string,PricePoint[]>>(()=>Object.fromEntries(seed.map(c=>[c.slug,historyFor(c)])));const [loading,setLoading]=useState(true);const [connected,setConnected]=useState(false);
 const refresh=async()=>{if(!supabase){setLoading(false);setConnected(false);return;} const [cr,sr,hr]=await Promise.all([supabase.from('commodities').select('*').eq('is_active',true).order('name'),supabase.from('exchange_settings').select('*').eq('id',1).maybeSingle(),supabase.from('price_history').select('*,commodities!inner(slug)').order('date',{ascending:true})]);
  if(!cr.error&&cr.data?.length){setRows(cr.data.map(mapCommodity));setConnected(true);} if(!sr.error&&sr.data)setSettings({usd_per_gold:Number(sr.data.usd_per_gold),import_tax_pct:Number(sr.data.import_tax_pct),domestic_export_tax_pct:Number(sr.data.domestic_export_tax_pct)});
  if(!hr.error&&hr.data){const grouped:Record<string,PricePoint[]>={};for(const r of hr.data as any[]){const slug=r.commodities.slug;(grouped[slug]??=[]).push(mapHistory(r));}setHistories(old=>Object.fromEntries((cr.data||[]).map((r:any)=>[r.slug,grouped[r.slug]?.length?grouped[r.slug]:old[r.slug]||[]])));}
  setLoading(false);
 };
 useEffect(()=>{void refresh();if(!supabase)return;const channel=supabase.channel('public-market-updates').on('postgres_changes',{event:'*',schema:'public',table:'commodities'},()=>void refresh()).on('postgres_changes',{event:'*',schema:'public',table:'exchange_settings'},()=>void refresh()).on('postgres_changes',{event:'*',schema:'public',table:'price_history'},()=>void refresh()).subscribe();return()=>{void supabase.removeChannel(channel)};},[]);
 const value=useMemo(()=>({commodities:rows,settings,histories,loading,connected,refresh}),[rows,settings,histories,loading,connected]);return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}
export function useMarketData(){const value=useContext(MarketContext);if(!value)throw new Error('useMarketData must be used within MarketDataProvider');return value;}
