import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocketRealtime } from '../../hooks/useSocketRealtime';
import RideChatWidget from '../chat/RideChatWidget';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Navbar from './Navbar';

export default function AppShell({ children }) {
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const { connectionStatus } = useSocketRealtime();
  const [isRiderPanelOpen, setIsRiderPanelOpen] = useState(false);

  const isRider = session?.role === 'rider';
  const hasActiveRide = useMemo(() => {
    try {
      const raw = localStorage.getItem('swiftridex_active_ride');
      if (!raw) {
        return false;
      }

      const ride = JSON.parse(raw);
      const status = String(ride?.status || '').toUpperCase();
      return status === 'REQUESTED' || status === 'ACCEPTED' || status === 'STARTED';
    } catch {
      return false;
    }
  }, [children]);

  const openRiderPanel = () => {
    if (isRider) {
      setIsRiderPanelOpen(true);
    }
  };

  const closeRiderPanel = () => {
    setIsRiderPanelOpen(false);
  };

  const navigateFromPanel = (path) => {
    closeRiderPanel();
    navigate(path);
  };

  const displayName = session?.user?.fullName || session?.user?.email || '';
  const firstName = displayName ? displayName.trim().split(/\s+/)[0] : '';

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="ambient-orb left-0 top-0 h-72 w-72 bg-brand-600/20" />
      <div className="ambient-orb right-0 top-24 h-80 w-80 bg-cyan-400/10" />
      <Navbar
        role={session?.role}
        userName={firstName}
        connectionStatus={connectionStatus}
        onLogout={logout}
        onUserNameClick={openRiderPanel}
      />

      {isRider && isRiderPanelOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={closeRiderPanel}
            aria-label="Close rider navigation overlay"
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-sm p-4">
            <Card className="h-full space-y-4 overflow-auto">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="section-label">Rider Panel</div>
                  <h3 className="mt-2 text-2xl font-bold text-white">Quick navigation</h3>
                  <p className="mt-2 text-sm text-slate-400">Open any section only when you need it.</p>
                </div>
                <button
                  type="button"
                  onClick={closeRiderPanel}
                  className="rounded-lg border border-white/15 bg-white/10 p-2 text-white transition hover:bg-white/15"
                  aria-label="Close rider navigation"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid gap-3">
                <Button variant="secondary" onClick={() => navigateFromPanel('/rider')}>Overview</Button>
                <Button variant="secondary" onClick={() => navigateFromPanel('/rider/tracking')} disabled={!hasActiveRide}>Track current ride</Button>
                <Button variant="secondary" onClick={() => navigateFromPanel('/rider/history')}>My rides history</Button>
              </div>
            </Card>
          </aside>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      <RideChatWidget />
    </div>
  );
}
