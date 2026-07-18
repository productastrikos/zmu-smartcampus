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
// Restored extended modules — Super-Admin only (RBAC-guarded below)
import SIS from './pages/SIS';
import LMS from './pages/LMS';
import MeritBoard from './pages/MeritBoard';
import StreamPage from './pages/Streams';
import CadetJourney from './pages/CadetJourney';
import ITManagement from './pages/ITManagement';
import SecurityOps from './pages/SecurityOps';
import Integration from './pages/Integration';
import StandaloneShell from './components/StandaloneShell';
import { ROLE_ROUTES, homeFor } from './components/Layout';

// Modules launched in their own tab from the Academics / Readiness pages.
// Rendered via StandaloneShell (no navigation back to the dashboard).
export const STANDALONE_MODULES = {
  sis: 'page.sis', lms: 'page.lms', merit: 'page.merit', 'cadet-journey': 'page.cadetJourney',
  hpo: 'page.hpo', military: 'page.military', conduct: 'page.conduct',
};

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

  // Standalone module tabs — rendered without the dashboard Layout so there's
  // no path back to the dashboard. Super-Admin only.
  if (location.pathname.startsWith('/standalone/')) {
    if (user.role !== 'superadmin') return <Navigate to={homeFor(user.role)} replace />;
    return (
      <Routes>
        <Route path="/standalone/sis" element={<StandaloneShell titleKey="page.sis"><SIS user={user} /></StandaloneShell>} />
        <Route path="/standalone/lms" element={<StandaloneShell titleKey="page.lms"><LMS user={user} /></StandaloneShell>} />
        <Route path="/standalone/merit" element={<StandaloneShell titleKey="page.merit"><MeritBoard user={user} /></StandaloneShell>} />
        <Route path="/standalone/cadet-journey" element={<StandaloneShell titleKey="page.cadetJourney"><CadetJourney /></StandaloneShell>} />
        <Route path="/standalone/hpo" element={<StandaloneShell titleKey="page.hpo"><StreamPage user={user} which="hpo" /></StandaloneShell>} />
        <Route path="/standalone/military" element={<StandaloneShell titleKey="page.military"><StreamPage user={user} which="military" /></StandaloneShell>} />
        <Route path="/standalone/conduct" element={<StandaloneShell titleKey="page.conduct"><StreamPage user={user} which="conduct" /></StandaloneShell>} />
        <Route path="*" element={<Navigate to={homeFor(user.role)} replace />} />
      </Routes>
    );
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
        {/* Extended modules kept in the sidebar */}
        <Route path="/it-ops" element={<ITManagement />} />
        <Route path="/security" element={<SecurityOps />} />
        <Route path="/integration" element={<Integration />} />
        <Route path="*" element={<Navigate to={homeFor(user.role)} replace />} />
      </Routes>
    </Layout>
  );
}
