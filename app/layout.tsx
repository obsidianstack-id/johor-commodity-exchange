import type {Metadata} from 'next';
import './globals.css';
import {MarketDataProvider} from '@/components/MarketDataProvider';
export const metadata:Metadata={title:'Johor Commodity Exchange',description:'Premium commodity market reference terminal'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="id"><body><MarketDataProvider>{children}</MarketDataProvider></body></html>}
