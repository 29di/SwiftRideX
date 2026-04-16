import { useAuth } from '../../context/AuthContext';
import { useSocketRealtime } from '../../hooks/useSocketRealtime';
import Navbar from './Navbar';

export default function AppShell({ children }) {
  const { session, logout } = useAuth();
  const { connectionStatus } = useSocketRealtime();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="ambient-orb left-0 top-0 h-72 w-72 bg-brand-600/20" />
      <div className="ambient-orb right-0 top-24 h-80 w-80 bg-cyan-400/10" />
      <Navbar
        role={session?.role}
        userName={session?.user?.fullName || session?.user?.email}
        connectionStatus={connectionStatus}
        onLogout={logout}
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
