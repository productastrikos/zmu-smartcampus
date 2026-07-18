import React, { useState, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import ExecutiveOverview from './pages/ExecutiveOverview';
import CommandCenter from './pages/CommandCenter';
// import DigitalTwin from './pages/DigitalTwin'; // old isometric-SVG twin — commented out in favour of the real GIS/map twin below
import DigitalTwin2 from './pages/digitalTwin_2';
import Academic from './pages/Academic';
import Readiness from './pages/Readiness';
import Enterprise from './pages/Enterprise';
import CampusOps from './pages/CampusOps';
import IoTSensors from './pages/IoTSensors';
import IncidentManagement from './pages/IncidentManagement';
import { ROLE_ROUTES, homeFor } from './components/Layout';

const AUTH_KEY = 'zmu_auth';

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch { return null; }
  });
  const location = useLocation();

  const login = useCallback((u) => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(u));
    setUser(u);
  }, []);
  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setUser(null);
  }, []);

  if (!user) {
    if (location.pathname !== '/login') return <Navigate to="/login" replace />;
    return <Login onLogin={login} />;
  }

  if (location.pathname === '/login') return <Navigate to={homeFor(user.role)} replace />;

  // Role guard — the executive only sees their allowed routes; bounced home otherwise.
  const allowed = ROLE_ROUTES[user.role];
  if (allowed && !allowed.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'))) {
    return <Navigate to={homeFor(user.role)} replace />;
  }

  return (
    <Layout user={user} onLogout={logout}>
      <Routes>
        <Route path="/executive" element={<ExecutiveOverview user={user} />} />
        <Route path="/" element={<CommandCenter />} />
        {/* <Route path="/digital-twin" element={<DigitalTwin />} /> old isometric-SVG twin */}
        <Route path="/digital-twin" element={<DigitalTwin2 />} />
        <Route path="/digital-twin-2" element={<DigitalTwin2 />} />
        <Route path="/academic" element={<Academic />} />
        <Route path="/readiness" element={<Readiness />} />
        <Route path="/enterprise" element={<Enterprise />} />
        <Route path="/campus-ops" element={<CampusOps />} />
        <Route path="/iot" element={<IoTSensors />} />
        <Route path="/incidents" element={<IncidentManagement />} />
        <Route path="*" element={<Navigate to={homeFor(user.role)} replace />} />
      </Routes>
    </Layout>
  );
}
