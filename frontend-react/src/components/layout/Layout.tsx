import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { TabBar } from './TabBar';
import { cn } from '@/lib/utils';

export function Layout() {
  const location = useLocation();
  const isMapPage = location.pathname === '/map';

  return (
    <div className="flex h-full flex-col">
      <Header />
      <main
        className={cn(
          'flex-1',
          // Map page: fill all available space, no padding
          isMapPage ? 'relative' : 'pb-[var(--spacing-tabbar)] md:pb-0',
        )}
      >
        <Outlet />
      </main>
      {/* Tab bar hidden on map page for max map space on mobile */}
      {!isMapPage && <TabBar />}
    </div>
  );
}
