import { CarFront, LayoutDashboard, LogOut, MapPinned, Route } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import Button from '../ui/Button';

const riderLinks = [
  { to: '/rider', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/rider/book', label: 'Book Ride', icon: CarFront },
  { to: '/rider/tracking', label: 'Tracking', icon: MapPinned },
];

const driverLinks = [
  { to: '/driver', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/driver', label: 'Ride Control', icon: Route },
];

export default function Navbar({ role, userName, connectionStatus, onLogout }) {
  const links = role === 'driver' ? driverLinks : riderLinks;

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-midnight/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <NavLink to={role === 'driver' ? '/driver' : '/rider'} className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600/15 text-brand-300 ring-1 ring-brand-400/20">
            <CarFront className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold text-white">SwiftrideX</div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Premium mobility</div>
          </div>
        </NavLink>

        <nav className="hidden flex-1 items-center justify-center gap-2 md:flex">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                    isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-sm font-semibold text-white">{userName || 'Active user'}</span>
            <span className="text-xs text-slate-400">{connectionStatus === 'connected' ? 'Realtime connected' : 'Connecting to live updates'}</span>
          </div>
          <span className="status-pill status-accepted">{role || 'guest'}</span>
          <Button variant="secondary" onClick={onLogout} className="hidden sm:inline-flex">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto px-4 pb-4 md:hidden sm:px-6 lg:px-8">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  isActive ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-300'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </NavLink>
          );
        })}
      </div>
    </header>
  );
}
