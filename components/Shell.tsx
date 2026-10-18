'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, LayoutGrid, Settings2, CandlestickChart } from 'lucide-react';
export default function Shell({children,active='market'}:{children:React.ReactNode;active?:string}) {
  const pathname = usePathname();
  const marketActive = pathname === '/' || pathname.startsWith('/market/');
  const adminActive = pathname.startsWith('/admin');
  return <div className="terminal-grid">
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark"><CandlestickChart size={19}/></span><span className="brand-word">JOHOR<span className="brand-sub">EXCHANGE</span></span></Link>
      <div className="nav-label">WORKSPACE</div>
      <Link className={`nav-item ${active==='market'?'active':''}`} href="/"><LayoutGrid size={17}/> <span>Market Overview</span></Link>
      <Link className={`nav-item ${active==='admin'?'active':''}`} href="/admin"><Settings2 size={17}/> <span>Admin Console</span></Link>
      <div className="sidebar-status"><span className="status-dot"/> SYSTEM OPERATIONAL <small>ADMIN-PUBLISHED REFERENCE DATA</small></div>
      <div className="sidebar-foot">JX TERMINAL <span>v1.1 / UTC+7</span></div>
    </aside>
    <div className="main">
      <header className="topbar"><div className="topbar-title"><span className="live-mark"/> JOHOR <span className="topbar-divider">/</span> <strong>{active==='admin'?'CONTROL ROOM':'MARKET INTELLIGENCE'}</strong></div><div className="topbar-meta"><span className="topbar-live"><i/> MARKET STATUS: REFERENCE</span><span className="topbar-currency">USD <b>↔</b> GOLD</span></div></header>
      <div className="mobile-brand"><div className="brand-mark"><CandlestickChart size={19}/></div><div><strong>JOHOR EXCHANGE</strong><small>COMMODITY MARKETS</small></div><span className="mobile-live"><i/> LIVE</span></div>
      {children}
      <nav className="mobile-nav"><Link className={marketActive?'active':''} href="/"><LayoutGrid size={19}/><span>Markets</span></Link><Link className={adminActive?'active':''} href="/admin"><Settings2 size={19}/><span>Admin</span></Link><Link className={pathname.startsWith('/market/')?'active':''} href="/market/makanan"><Activity size={19}/><span>Indices</span></Link></nav>
    </div>
  </div>
}
