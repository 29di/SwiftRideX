import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import DriverDashboardPage from './pages/DriverDashboardPage';
import NotFoundPage from './pages/NotFoundPage';
import RideBookingPage from './pages/RideBookingPage';
import RiderDashboardPage from './pages/RiderDashboardPage';
import RideTrackingPage from './pages/RideTrackingPage';

function ProtectedRoute({ children }) {
  const { session } = useAuth();

  if (!session?.token) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

function HomeRedirect() {
  const { session } = useAuth();

  if (!session?.token) {
    return <Navigate to="/auth" replace />;
  }

  return <Navigate to={session.role === 'driver' ? '/driver' : '/rider'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/rider"
        element={
          <ProtectedRoute>
            <AppShell>
              <RiderDashboardPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rider/book"
        element={
          <ProtectedRoute>
            <AppShell>
              <RideBookingPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rider/tracking"
        element={
          <ProtectedRoute>
            <AppShell>
              <RideTrackingPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/driver"
        element={
          <ProtectedRoute>
            <AppShell>
              <DriverDashboardPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route path="/register" element={<Navigate to="/auth" replace />} />
      <Route path="/dashboard" element={<Navigate to="/rider" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
