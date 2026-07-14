import React, { useState, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import CommandCenter from './pages/CommandCenter';
import DigitalTwin from './pages/DigitalTwin';
import Academic from './pages/Academic';
import Readiness from './pages/Readiness';
import Enterprise from './pages/Enterprise';
import CampusOps from './pages/CampusOps';
import SecurityOps from './pages/SecurityOps';
import Integration from './pages/Integration';
import CadetJourney from './pages/CadetJourney';
import IncidentManagement from './pages/IncidentManagement';
import ITManagement from './pages/ITManagement';
import SIS from './pages/SIS';
import LMS from './pages/LMS';
import StreamPage from './pages/Streams';
import MeritBoard from './pages/MeritBoard';
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
    // Unauthenticated — only the login screen is reachable.
    if (location.pathname !== '/login') return <Navigate to="/login" replace />;
    return <Login onLogin={login} />;
  }

  // Authenticated — redirect away from /login into the app shell.
  if (location.pathname === '/login') return <Navigate to={homeFor(user.role)} replace />;

  // RBAC route guard — restricted roles bounced to their home view
  const allowed = ROLE_ROUTES[user.role];
  if (allowed && location.pathname !== '/login' && !allowed.some((p) => location.pathname.startsWith(p))) {
    return <Navigate to={homeFor(user.role)} replace />;
  }

  return (
    <Layout user={user} onLogout={logout}>
      <Routes>
        <Route path="/" element={<CommandCenter />} />
        <Route path="/digital-twin" element={<DigitalTwin />} />
        <Route path="/academic" element={<Academic />} />
        <Route path="/readiness" element={<Readiness />} />
        <Route path="/enterprise" element={<Enterprise />} />
        <Route path="/campus-ops" element={<CampusOps />} />
        <Route path="/cadet-journey" element={<CadetJourney />} />
        <Route path="/it-ops" element={<ITManagement />} />
        <Route path="/sis" element={<SIS user={user} />} />
        <Route path="/lms" element={<LMS user={user} />} />
        <Route path="/merit" element={<MeritBoard user={user} />} />
        <Route path="/hpo" element={<StreamPage user={user} which="hpo" />} />
        <Route path="/military" element={<StreamPage user={user} which="military" />} />
        <Route path="/conduct" element={<StreamPage user={user} which="conduct" />} />
        <Route path="/security" element={<SecurityOps />} />
        <Route path="/incidents" element={<IncidentManagement />} />
        <Route path="/integration" element={<Integration />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
