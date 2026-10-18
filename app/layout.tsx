import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Johor Commodity Exchange | Market Terminal', description: 'Commodity prices, daily market history and exchange administration terminal.' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="id"><body>{children}</body></html>; }
