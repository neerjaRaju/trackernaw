import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LiveMap from './pages/LiveMap';
import Attendance from './pages/Attendance';
import Tasks from './pages/Tasks';
import Expenses from './pages/Expenses';
import Orders from './pages/Orders';
import Employees from './pages/Employees';
import SosAlerts from './pages/SosAlerts';
import Reports from './pages/Reports';
import Heatmap from './pages/Heatmap';
import Geofences from './pages/Geofences';
import RoutesPage from './pages/Routes';
import Privacy from './pages/Privacy';
import Leaves from './pages/Leaves';
import Forms from './pages/Forms';
import AuditLogs from './pages/AuditLogs';
import Webhooks from './pages/Webhooks';
import CompanyManagement from './pages/CompanyManagement';
import AppLayout from './components/AppLayout';
import type { RootState } from './store';

function Protected({ children }: { children: JSX.Element }) {
  const token = useSelector((s: RootState) => s.auth.accessToken);
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="companies" element={<CompanyManagement />} />
        <Route path="live-map" element={<LiveMap />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="orders" element={<Orders />} />
        <Route path="employees" element={<Employees />} />
        <Route path="sos" element={<SosAlerts />} />
        <Route path="reports" element={<Reports />} />
        <Route path="heatmap" element={<Heatmap />} />
        <Route path="geofences" element={<Geofences />} />
        <Route path="routes" element={<RoutesPage />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="leaves" element={<Leaves />} />
        <Route path="forms" element={<Forms />} />
        <Route path="audit" element={<AuditLogs />} />
        <Route path="webhooks" element={<Webhooks />} />
      </Route>
    </Routes>
  );
}
