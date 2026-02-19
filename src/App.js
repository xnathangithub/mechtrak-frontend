import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_URL = 'https://mechtrak-backend-production.up.railway.app';

function App() {
  const [sessions, setSessions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedShot, setSelectedShot] = useState(null);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [customPlanName, setCustomPlanName] = useState('');
  const [customPlanDesc, setCustomPlanDesc] = useState('');
  const [customShotNames, setCustomShotNames] = useState(['']);
  const [currentView, setCurrentView] = useState('home');
  const [statsDateRange, setStatsDateRange] = useState({ start: '', end: '' });
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);
  const [showSessionSelector, setShowSessionSelector] = useState(false);
  const [availableSessions, setAvailableSessions] = useState([]);
  const [statsChartType, setStatsChartType] = useState('line');
  const [statsChartMode, setStatsChartMode] = useState('overview');
  const [user, setUser] = useState(null);
  const [authView, setAuthView] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [pluginConnected, setPluginConnected] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [startingSession, setStartingSession] = useState(false);
  const [statsPlanFilter, setStatsPlanFilter] = useState('all');
  const manuallyUnselectedIds = useRef(new Set());
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const deleteSession = async (sessionId) => {
    try {
      await axios.delete(`${API_URL}/api/sessions/${sessionId}`);
      await fetchSessions();
      if (selectedSession?.session_id === sessionId) setSelectedSession(null);
      showToast('Session deleted!');
    } catch (error) {
      console.error('Error deleting session:', error);
      showToast('Failed to delete session', 'error');
    }
  };

  const deletePlan = async (planId) => {
    try {
      await axios.delete(`${API_URL}/api/plans/${planId}`);
      await fetchPlans();
      showToast('Plan deleted!');
    } catch (error) {
      console.error('Error deleting plan:', error);
      showToast('Failed to delete plan', 'error');
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }, [user]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const init = async () => {
      await checkAuth();
      await fetchSessions();
      await fetchPlans();
    };
    init();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (currentView !== 'sessions' && currentView !== 'stats') return;
    const interval = setInterval(() => fetchSessions(), 30000);
    fetchSessions();
    return () => clearInterval(interval);
  }, [currentView]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedSession) {
      const updated = sessions.find(s => s.id === selectedSession.id);
      if (updated) setSelectedSession(updated);
    }
  }, [sessions]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showProfileMenu && !e.target.closest('.profile-menu-container')) setShowProfileMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) { setCheckingAuth(false); return; }
    try {
      const response = await axios.get(`${API_URL}/api/auth/verify`, { headers: { Authorization: `Bearer ${token}` } });
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(response.data.user);
      await new Promise(resolve => setTimeout(resolve, 500));
      try { await axios.post(`${API_URL}/api/plugin/register-token`, {}, { headers: { Authorization: `Bearer ${token}` } }); } catch (e) {}
      setCurrentView('connecting');
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
      } else if (error.response?.status === 429) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setUser({ id: payload.userId, email: payload.email });
          setCurrentView('connecting');
        } catch (e) { console.error('Failed to decode token:', e); }
      }
    } finally { setCheckingAuth(false); }
  };

  const login = async () => {
    setAuthLoading(true); setAuthError('');
    if (!authEmail.includes('@')) { setAuthError('Please enter a valid email'); setAuthLoading(false); return; }
    if (authPassword.length < 8) { setAuthError('Password must be at least 8 characters'); setAuthLoading(false); return; }
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, { email: authEmail, password: authPassword });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      await new Promise(resolve => setTimeout(resolve, 500));
      try { await axios.post(`${API_URL}/api/plugin/register-token`, {}, { headers: { Authorization: `Bearer ${token}` } }); } catch (e) { console.log('register-token failed:', e.response?.status); }
      setUser(user);
      await fetchSessions();
      await fetchPlans();
      setCurrentView('connecting');
    } catch (error) {
      setAuthError(error.response?.data?.error || error.response?.data?.message || `Login failed (${error.response?.status})` || 'Login failed');
    } finally { setAuthLoading(false); }
  };

  const register = async () => {
    setAuthLoading(true); setAuthError('');
    if (!authEmail.includes('@')) { setAuthError('Please enter a valid email'); setAuthLoading(false); return; }
    if (authPassword.length < 8) { setAuthError('Password must be at least 8 characters'); setAuthLoading(false); return; }
    if (authView === 'register' && authUsername.trim().length < 3) { setAuthError('Username must be at least 3 characters'); setAuthLoading(false); return; }
    try {
      const response = await axios.post(`${API_URL}/api/auth/register`, { email: authEmail, password: authPassword, username: authUsername });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      await new Promise(resolve => setTimeout(resolve, 500));
      try { await axios.post(`${API_URL}/api/plugin/register-token`, {}, { headers: { Authorization: `Bearer ${token}` } }); } catch (e) {}
      setUser(user);
      await fetchSessions();
      await fetchPlans();
      setCurrentView('connecting');
    } catch (error) {
      setAuthError(error.response?.data?.error || 'Registration failed');
    } finally { setAuthLoading(false); }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null); setSessions([]); setPlans([]);
    setCurrentView('home');
  };

  const fetchSessions = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sessions`, { headers: getAuthHeaders() });
      setSessions(response.data.sessions);
    } catch (error) { console.error('Error fetching sessions:', error); }
  };

  const fetchPlans = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/plans`, { headers: getAuthHeaders() });
      setPlans(response.data.plans);
    } catch (error) { console.error('Error fetching plans:', error); }
  };

  const renameSession = async (sessionId, newName) => {
    try {
      await axios.patch(`${API_URL}/api/sessions/${sessionId}/rename`, { name: newName });
      await fetchSessions();
      setSelectedSession(prev => ({ ...prev, name: newName }));
      showToast('Session renamed!');
    } catch (error) {
      console.error('Error renaming session:', error);
      showToast('Failed to rename session', 'error');
    }
  };

  const getAccuracyColor = (accuracy) => {
    if (accuracy >= 66) return 'green';
    if (accuracy >= 33) return 'orange';
    return 'red';
  };

  const calculateAccuracy = (session) => {
    if (session.total_attempts === 0) return 0;
    return (session.total_goals / session.total_attempts) * 100;
  };

  const createCustomPlan = async (startSession = false) => {
    const filteredShots = customShotNames.filter(name => name.trim() !== '');
    if (!customPlanName.trim()) { showToast('Please enter a plan name', 'error'); return; }
    if (filteredShots.length === 0) { showToast('Please add at least one shot', 'error'); return; }
    try {
      const response = await axios.post(`${API_URL}/api/plans`, {
        name: customPlanName, description: customPlanDesc, shot_names: filteredShots
      }, { headers: getAuthHeaders() });
      const newPlan = response.data.plan;
      setCustomPlanName(''); setCustomPlanDesc(''); setCustomShotNames(['']);
      setShowCreatePlan(false);
      await fetchPlans();
      if (startSession) await startSessionWithPlan(newPlan.id);
    } catch (error) {
      console.error('Error creating plan:', error);
      showToast('Failed to create plan', 'error');
    }
  };

  const addShotField = () => setCustomShotNames([...customShotNames, '']);

  const updateShotName = (index, value) => {
    const updated = [...customShotNames];
    updated[index] = value;
    setCustomShotNames(updated);
  };

  const removeShotField = (index) => {
    if (customShotNames.length > 1) setCustomShotNames(customShotNames.filter((_, i) => i !== index));
  };

  const startSessionWithPlan = async (planId) => {
    setStartingSession(true);
    try {
      const response = await axios.post(`${API_URL}/api/sessions/start`, { plan_id: planId }, { headers: getAuthHeaders() });
      await fetchSessions();
      setSelectedSession(response.data.session);
      setShowLibraryModal(false);
      setCurrentView('sessions');
      showToast(`Session started with ${response.data.plan.name}!`);
    } catch (error) {
      console.error('Error starting session:', error);
      showToast('Failed to start session', 'error');
    } finally { setStartingSession(false); }
  };

  const filterSessionsByDate = (planFilter = statsPlanFilter) => {
    let filtered = [...sessions];
    if (statsDateRange.start && statsDateRange.end) {
      const start = new Date(statsDateRange.start);
      const end = new Date(statsDateRange.end);
      filtered = filtered.filter(session => {
        const sessionDate = new Date(session.start_time);
        return sessionDate >= start && sessionDate <= end;
      });
    }
    if (planFilter !== 'all') filtered = filtered.filter(s => s.plan_id === parseInt(planFilter));
    setAvailableSessions(filtered);
    setSelectedSessionIds(prev => {
      const existingSelected = prev.filter(id => filtered.some(s => s.id === id));
      const newSessions = filtered.map(s => s.id).filter(id => !manuallyUnselectedIds.current.has(id) && !prev.includes(id));
      return [...existingSelected, ...newSessions];
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (currentView !== 'connecting') return;
    const checkConnection = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/heartbeat/check`, { headers: { Authorization: `Bearer ${token}` } });
        if (response.data.connected) { setPluginConnected(true); setTimeout(() => setCurrentView('home'), 2000); }
      } catch (error) { console.error('Connection check failed:', error); }
    };
    const interval = setInterval(checkConnection, 3000);
    checkConnection();
    return () => clearInterval(interval);
  }, [currentView]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sessions.length > 0) {
      if (!statsDateRange.start && !statsDateRange.end) {
        const end = new Date(); end.setDate(end.getDate() + 2);
        const start = new Date(); start.setDate(start.getDate() - 31);
        setStatsDateRange({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
      } else { filterSessionsByDate(); }
    }
  }, [sessions]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sessions.length > 0 && statsDateRange.start && statsDateRange.end) filterSessionsByDate();
  }, [statsDateRange]);

  const prepareChartData = () => {
    const selectedSessions = sessions.filter(s => selectedSessionIds.includes(s.id) && (statsPlanFilter === 'all' || s.plan_id === parseInt(statsPlanFilter)));
    if (statsChartMode === 'overview') {
      selectedSessions.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      const allDataPoints = [];
      selectedSessions.forEach((session, sessionIndex) => {
        const dateStr = new Date(session.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        Object.entries(session.shots_data).sort(([a], [b]) => parseInt(a) - parseInt(b)).filter(([_, sd]) => sd.attempts > 0).forEach(([shotNum, shotData]) => {
          allDataPoints.push({ label: `${dateStr} S${shotNum}`, fullLabel: `${dateStr} - Shot ${shotNum}`, accuracy: Math.round((shotData.goals / shotData.attempts) * 100), sessionIndex, sessionId: session.id, date: dateStr, shotNum: parseInt(shotNum) });
        });
      });
      return allDataPoints;
    } else {
      selectedSessions.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      return selectedSessions.map((session, index) => {
        const dataPoint = { name: `Session ${index + 1}`, date: new Date(session.start_time).toLocaleDateString() };
        Object.entries(session.shots_data).forEach(([shotNum, shotData]) => {
          if (shotData.attempts > 0) dataPoint[`Shot ${shotNum}`] = Math.round((shotData.goals / shotData.attempts) * 100);
        });
        return dataPoint;
      });
    }
  };

  const generateColors = () => ['#a855f7','#00d4ff','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#14b8a6','#f97316','#ec4899','#3b82f6','#84cc16','#f43f5e','#0ea5e9','#d946ef','#22c55e','#fb923c','#818cf8','#2dd4bf','#fbbf24'];

  const calculateHighlights = () => {
    const selectedSessions = sessions.filter(s => selectedSessionIds.includes(s.id) && (statsPlanFilter === 'all' || s.plan_id === parseInt(statsPlanFilter)));
    if (selectedSessions.length === 0) return { totalAttempts: 0, totalGoals: 0, bestAccuracy: 0, bestAccuracyDate: null };
    let totalAttempts = 0, totalGoals = 0, bestSession = null, bestAccuracy = 0;
    selectedSessions.forEach(session => {
      totalAttempts += session.total_attempts; totalGoals += session.total_goals;
      const accuracy = session.total_attempts > 0 ? (session.total_goals / session.total_attempts) * 100 : 0;
      if (accuracy > bestAccuracy) { bestAccuracy = accuracy; bestSession = session; }
    });
    return { totalAttempts, totalGoals, bestAccuracy: Math.round(bestAccuracy), bestAccuracyDate: bestSession ? new Date(bestSession.start_time).toLocaleDateString() : null };
  };

  const renderChart = () => {
    const data = prepareChartData();
    const selectedSessions = sessions.filter(s => selectedSessionIds.includes(s.id));
    const colors = generateColors();

    if (statsChartMode === 'overview') {
      if (statsChartType === 'line') return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis dataKey="label" stroke="#888" angle={-45} textAnchor="end" height={80} />
          <YAxis stroke="#888" label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', fill: '#888' }} />
          <Tooltip content={({ active, payload }) => { if (active && payload?.length) { const d = payload[0].payload; return <div style={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '10px' }}><p style={{ color: '#fff', margin: 0 }}>{d.fullLabel}</p><p style={{ color: colors[d.sessionIndex % colors.length], margin: '5px 0 0 0' }}>Accuracy: {d.accuracy}%</p></div>; } return null; }} />
          <Line type="monotone" dataKey="accuracy" stroke="#666" strokeWidth={2}
            dot={(props) => { const { cx, cy, payload } = props; const c = colors[payload.sessionIndex % colors.length]; return <circle key={`dot-${payload.sessionIndex}-${payload.shotNum}`} cx={cx} cy={cy} r={5} fill={c} stroke={c} strokeWidth={2} />; }}
            activeDot={(props) => { const { cx, cy, payload } = props; const c = colors[payload.sessionIndex % colors.length]; return <circle key={`active-${payload.sessionIndex}-${payload.shotNum}`} cx={cx} cy={cy} r={7} fill={c} stroke="#fff" strokeWidth={2} />; }}
          />
        </LineChart>
      );
      if (statsChartType === 'bar') return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis dataKey="label" stroke="#888" angle={-45} textAnchor="end" height={80} />
          <YAxis stroke="#888" label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', fill: '#888' }} />
          <Tooltip content={({ active, payload }) => { if (active && payload?.length) { const d = payload[0].payload; return <div style={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '10px' }}><p style={{ color: '#fff', margin: 0 }}>{d.fullLabel}</p><p style={{ color: colors[d.sessionIndex % colors.length], margin: '5px 0 0 0' }}>Accuracy: {d.accuracy}%</p></div>; } return null; }} />
          <Bar dataKey="accuracy" shape={(props) => { const { x, y, width, height, payload } = props; return <rect x={x} y={y} width={width} height={height} fill={colors[payload.sessionIndex % colors.length]} />; }} />
        </BarChart>
      );
      return (
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis dataKey="label" stroke="#888" angle={-45} textAnchor="end" height={80} />
          <YAxis stroke="#888" label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', fill: '#888' }} />
          <Tooltip content={({ active, payload }) => { if (active && payload?.length) { const d = payload[0].payload; return <div style={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '10px' }}><p style={{ color: '#fff', margin: 0 }}>{d.fullLabel}</p><p style={{ color: colors[d.sessionIndex % colors.length], margin: '5px 0 0 0' }}>Accuracy: {d.accuracy}%</p></div>; } return null; }} />
          <defs><linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">{selectedSessions.map((_, i) => <stop key={i} offset={`${(i / selectedSessions.length) * 100}%`} stopColor={colors[i % colors.length]} stopOpacity={0.8} />)}</linearGradient></defs>
          <Area type="monotone" dataKey="accuracy" stroke="#666" fill="url(#colorGradient)" fillOpacity={0.3} />
        </AreaChart>
      );
    } else {
      const allShotNumbers = new Set();
      selectedSessions.forEach(s => Object.keys(s.shots_data).forEach(n => allShotNumbers.add(parseInt(n))));
      const sortedShotNumbers = Array.from(allShotNumbers).sort((a, b) => a - b);
      if (statsChartType === 'line') return (
        <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" /><XAxis dataKey="name" stroke="#888" /><YAxis stroke="#888" label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', fill: '#888' }} /><Tooltip contentStyle={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} /><Legend />{sortedShotNumbers.map((n, i) => <Line key={n} type="monotone" dataKey={`Shot ${n}`} stroke={colors[i % colors.length]} strokeWidth={2} />)}</LineChart>
      );
      if (statsChartType === 'bar') return (
        <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" /><XAxis dataKey="name" stroke="#888" /><YAxis stroke="#888" label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', fill: '#888' }} /><Tooltip contentStyle={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} /><Legend />{sortedShotNumbers.map((n, i) => <Bar key={n} dataKey={`Shot ${n}`} fill={colors[i % colors.length]} />)}</BarChart>
      );
      return (
        <AreaChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" /><XAxis dataKey="name" stroke="#888" /><YAxis stroke="#888" label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', fill: '#888' }} /><Tooltip contentStyle={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} /><Legend />{sortedShotNumbers.map((n, i) => <Area key={n} type="monotone" dataKey={`Shot ${n}`} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.3} />)}</AreaChart>
      );
    }
  };

  if (checkingAuth) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#070707', color: '#fff', fontSize: '18px' }}>Loading...</div>;

  if (!user) return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">MECH TRAK</div>
        <p className="auth-subtitle">Track your training, master your shots</p>
        <div className="auth-tabs">
          <button className={`auth-tab ${authView === 'login' ? 'active' : ''}`} onClick={() => { setAuthView('login'); setAuthError(''); }}>Sign In</button>
          <button className={`auth-tab ${authView === 'register' ? 'active' : ''}`} onClick={() => { setAuthView('register'); setAuthError(''); }}>Sign Up</button>
        </div>
        <div className="auth-form">
          {authView === 'register' && <div className="auth-field"><label>Username</label><input type="text" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} placeholder="Your username" className="auth-input" /></div>}
          <div className="auth-field"><label>Email</label><input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="your@email.com" className="auth-input" onKeyDown={(e) => e.key === 'Enter' && (authView === 'login' ? login() : register())} /></div>
          <div className="auth-field"><label>Password</label><input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="••••••••" className="auth-input" onKeyDown={(e) => e.key === 'Enter' && (authView === 'login' ? login() : register())} /></div>
          {authError && <div className="auth-error">{authError}</div>}
          <button className="glossy-btn auth-submit" onClick={authView === 'login' ? login : register} disabled={authLoading}>
            {authLoading ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><span className="btn-spinner"></span>{authView === 'login' ? 'Signing in...' : 'Creating account...'}</span> : (authView === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </div>
      </div>
    </div>
  );

  const presetPlans = plans.filter(p => p.is_preset);
  const customPlans = plans.filter(p => !p.is_preset).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="App">
      <header className={`header ${currentView === 'sessions' ? 'no-border' : ''}`}>
        <div className="logo" onClick={() => { setCurrentView('home'); setSelectedSession(null); setSelectedShot(null); }} style={{ cursor: 'pointer' }}>
          MECH TRAK
        </div>
        {currentView !== 'sessions' && (
          <div className="profile-menu-container">
            <div className="profile-icon" onClick={() => setShowProfileMenu(!showProfileMenu)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            {showProfileMenu && (
              <div className="profile-menu">
                <div className="profile-menu-header">
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff' }}>{user.username || user.email}</div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{user.email}</div>
                </div>
                <button className="profile-menu-item" onClick={() => { setShowProfileMenu(false); setShowFAQ(true); }}>❓ FAQ</button>
                <button className="profile-menu-item logout" onClick={() => { setShowProfileMenu(false); logout(); }}>🚪 Logout</button>
              </div>
            )}
          </div>
        )}
        {currentView === 'sessions' && <div></div>}
      </header>

      <div className="main-container" style={{ marginRight: currentView === 'sessions' ? '320px' : '0' }}>
        <div className="main-section">

          {currentView === 'connecting' && (
            <div className="connecting-page">
              <div className="connecting-container">
                <h1>Checking Connection</h1>
                <p style={{ color: '#888', marginBottom: '40px' }}>Looking for your Rocket League plugin...</p>
                <div className="connecting-spinner">
                  {pluginConnected ? <div className="connecting-checkmark">✓</div> : <div className="spinner"></div>}
                </div>
                {!pluginConnected && (
                  <>
                    <div className="connecting-status">Waiting for plugin connection...</div>
                    <div className="install-instructions">
                      <h3>Plugin not installed?</h3>
                      <div className="instruction-steps">
                        <div className="instruction-step"><div className="step-number">1</div><div className="step-text">Download and install BakkesMod from <strong>bakkesmod.com</strong></div></div>
                        <div className="instruction-step"><div className="step-number">2</div><div className="step-text">Download the Mech Trak plugin from{' '}<a href="https://github.com/xnathangithub/MechTrak/releases/download/V1.0.0/MechTrak.dll" target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>here</a></div></div>
                        <div className="instruction-step"><div className="step-number">3</div><div className="step-text">Place the .dll in your BakkesMod plugins folder</div></div>
                        <div className="instruction-step"><div className="step-number">4</div><div className="step-text">Launch Rocket League and Click (F6) and enter "Plugin load MechTrak"</div></div>
                      </div>
                    </div>
                    <button className="glossy-btn" style={{ marginTop: '30px' }} onClick={() => setCurrentView('home')}>Skip for now</button>
                  </>
                )}
              </div>
            </div>
          )}

          {currentView === 'home' && (
            <div className="homepage" style={{ backgroundImage: 'url(/home.jpg)' }}>
              <h1 className="homepage-title">MECH TRAK</h1>
              <p className="homepage-subtitle">Track your training, master your shots</p>
              <div className="home-cards-grid">
                <div className="glass-card" onClick={() => setCurrentView('sessions')}>
                  <div className="card-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></div>
                  <h2>Sessions</h2><p>View and manage your training sessions</p>
                  <div className="card-badge">{sessions.length} total</div>
                </div>
                <div className="glass-card" onClick={() => setCurrentView('plans')}>
                  <div className="card-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><polygon points="5,3 19,12 5,21"/></svg></div>
                  <h2>Start Session</h2><p>Begin a new training session</p>
                  <div className="card-badge">{customPlans.length} custom plans</div>
                </div>
                <div className="glass-card" onClick={() => setCurrentView('stats')}>
                  <div className="card-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
                  <h2>Stats</h2><p>Analyze your progress over time</p>
                  <div className="card-badge">{sessions.length} sessions</div>
                </div>
              </div>
            </div>
          )}

          {currentView === 'sessions' && (
            <div style={{ position: 'relative', minHeight: '100%' }}>
              <div style={{ position: 'fixed', bottom: 0, right: 0, width: '600px', height: '600px', borderRadius: '50%', background: sessions.some(s => s.status === 'active') ? 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0, transition: 'background 1s ease' }} />
              <div style={{ position: 'relative', zIndex: 1, pointerEvents: 'all' }}>
                {!selectedSession ? (
                  <div style={{ marginTop: '10px' }}>
                    <h1 style={{ fontSize: '36px', marginBottom: '20px' }}>Sessions</h1>
                    {sessions.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎯</div>
                        <p style={{ fontSize: '18px', marginBottom: '10px' }}>No sessions yet!</p>
                        <p style={{ fontSize: '14px' }}>Start a training session to see your stats here</p>
                        <button className="glossy-btn" style={{ marginTop: '20px' }} onClick={() => setCurrentView('home')}>Start Training</button>
                      </div>
                    ) : (
                      <div>
                        <p style={{ color: '#888', marginBottom: '20px' }}>Select a session from the sidebar →</p>
                        {sessions.some(s => s.status === 'active') ? (
                          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '500px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'pulse 2s infinite' }}></div>
                            <div>
                              <p style={{ color: '#10b981', fontWeight: '600', marginBottom: '2px' }}>Session Active</p>
                              <p style={{ color: '#888', fontSize: '13px' }}>{sessions.find(s => s.status === 'active')?.name || 'Training in progress'} — Plugin is recording</p>
                            </div>
                          </div>
                        ) : (
                          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '500px' }}>
                            <div style={{ fontSize: '20px' }}>⚠️</div>
                            <div>
                              <p style={{ color: '#ef4444', fontWeight: '600', marginBottom: '2px' }}>No Active Session</p>
                              <p style={{ color: '#888', fontSize: '13px' }}>Start a session from the homepage to begin tracking</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : selectedShot ? (
                  <div>
                    <button className="back-button" onClick={() => setSelectedShot(null)} style={{ marginTop: '20px' }}>← Back to Shots</button>
                    <div style={{ marginTop: '30px' }}>
                      <h1 style={{ fontSize: '36px', marginBottom: '10px', color: '#ffffff' }}>Shot {selectedShot.shotNum}</h1>
                      <div className="detail-stats-grid">
                        <div className="stat-box"><div className="stat-label">Goals</div><div className="stat-value">{selectedShot.goals}</div></div>
                        <div className="stat-box"><div className="stat-label">Attempts</div><div className="stat-value">{selectedShot.attempts}</div></div>
                        <div className="stat-box"><div className="stat-label">Accuracy</div><div className="stat-value">{selectedShot.attempts > 0 ? Math.round((selectedShot.goals / selectedShot.attempts) * 100) : 0}%</div></div>
                      </div>
                      <div className="chart-container"><h3>Goals vs Attempts</h3><div style={{ color: '#888', padding: '40px', textAlign: 'center' }}>Pie chart coming soon...</div></div>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ marginBottom: '40px' }}>
                      {editingName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                          <input type="text" value={tempName} onChange={(e) => setTempName(e.target.value)} className="form-input" style={{ fontSize: '24px', fontWeight: '700', maxWidth: '400px' }} autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') { renameSession(selectedSession.session_id, tempName); setEditingName(false); } if (e.key === 'Escape') setEditingName(false); }}
                          />
                          <button className="glossy-btn" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => { renameSession(selectedSession.session_id, tempName); setEditingName(false); }}>Save</button>
                          <button onClick={() => setEditingName(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                          <h1 style={{ fontSize: '36px' }}>{selectedSession.name || `Session ${selectedSession.session_id.slice(-8)}`}</h1>
                          <button className="rename-btn" onClick={() => { setEditingName(true); setTempName(selectedSession.name || ''); }}>✏️ Rename</button>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '30px', color: '#888', alignItems: 'center' }}>
                        <span>Duration: {selectedSession.duration_minutes || 0} min</span>
                        <span>Total: {selectedSession.total_goals}/{selectedSession.total_attempts}</span>
                        <span>Accuracy: {Math.round(selectedSession.total_accuracy || 0)}%</span>
                        <button className="delete-btn" onClick={() => deleteSession(selectedSession.session_id)}>🗑️ Delete Session</button>
                      </div>
                    </div>
                    <h2 style={{ marginBottom: '20px', color: '#ffffff' }}>Shots</h2>
                    <div className="shot-cards-container">
                      {Object.entries(selectedSession.shots_data || {}).map(([shotNum, shot]) => {
                        const accuracy = shot.attempts > 0 ? (shot.goals / shot.attempts) * 100 : -1;
                        const accuracyClass = accuracy === -1 ? 'accuracy-none' : accuracy >= 50 ? 'accuracy-high' : accuracy >= 25 ? 'accuracy-medium' : 'accuracy-low';
                        const barColor = accuracy === -1 ? 'rgba(255,255,255,0.3)' : accuracy >= 50 ? 'rgba(16,185,129,0.6)' : accuracy >= 25 ? 'rgba(245,158,11,0.6)' : 'rgba(239,68,68,0.6)';
                        return (
                          <div key={shotNum} className={`shot-card ${accuracyClass}`} onClick={() => setSelectedShot({ shotNum, ...shot })}>
                            <div className="shot-number">Shot {shotNum}</div>
                            <div className="shot-type">{shot.shotType || 'Unknown'}</div>
                            <div className="vertical-bar-container">
                              <div className="vertical-bar-background"><div className="vertical-bar-fill" style={{ height: `${accuracy === -1 ? 0 : accuracy}%`, background: barColor }} /></div>
                              <div className="bar-label">{shot.goals}/{shot.attempts}</div>
                            </div>
                            <div className="shot-stats">{accuracy === -1 ? '0%' : `${Math.round(accuracy)}%`}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentView === 'plans' && (
            <div>
              <div style={{ padding: '30px 40px 0' }}>
                <h1 style={{ fontSize: '36px', marginBottom: '8px' }}>Training Plans</h1>
                <p style={{ color: '#888', fontSize: '14px' }}>Create and manage your custom training plans</p>
              </div>
              <div className="plans-grid-new">

                {/* Free Train - Coming Soon */}
                <div className="plan-create-card plan-coming-soon">
                  <div className="plan-create-icon">⚡</div>
                  <div className="plan-create-text">Free Train</div>
                  <div className="plan-create-subtext">Train freely without a plan</div>
                  <div className="coming-soon-badge">Coming Soon</div>
                </div>

                {/* Plan Library - opens modal with ALL plans (preset + custom) */}
                <div className="plan-create-card" onClick={() => setShowLibraryModal(true)}>
                  <div className="plan-create-icon">📚</div>
                  <div className="plan-create-text">Plan Library</div>
                  <div className="plan-create-subtext">Browse pre-made training plans</div>
                </div>

                {/* Show user's most recent custom plan as preview */}
                {customPlans.length > 0 && (() => {
                  const plan = customPlans[0];
                  const planColors = ['#a855f7', '#00d4ff', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                  const color = planColors[0];
                  const sessionCount = sessions.filter(s => s.plan_id === plan.id).length;
                  const lastUsed = sessions.filter(s => s.plan_id === plan.id).sort((a, b) => new Date(b.start_time) - new Date(a.start_time))[0];
                  return (
                    <div key={plan.id} className="plan-card-new" style={{ '--plan-color': color }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div className="plan-card-title">My Mechs</div>
                        <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Most Recent</div>
                      </div>
                      <div className="plan-card-description">Mechanics I want to focus on.</div>
                      <div className="plan-card-meta">
                        <div className="plan-meta-item"><span className="plan-meta-label">Shots</span><span className="plan-meta-value">{plan.shots?.length || 0}</span></div>
                        <div className="plan-meta-item"><span className="plan-meta-label">Sessions</span><span className="plan-meta-value">{sessionCount}</span></div>
                        {lastUsed && <div className="plan-meta-item"><span className="plan-meta-label">Last Used</span><span className="plan-meta-value" style={{ fontSize: '13px' }}>{new Date(lastUsed.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>}
                      </div>
                      <div className="plan-card-actions">
                        <button className="plan-use-btn" onClick={() => startSessionWithPlan(plan.id)} disabled={startingSession}>
                          {startingSession ? <span className="btn-spinner"></span> : 'Use Plan'}
                        </button>
                        <button className="plan-delete-btn" onClick={() => deletePlan(plan.id)}>🗑️</button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {currentView === 'stats' && (
            <div>
              <div className="stats-container">
                <div className="stats-top-controls">
                  <div className="stats-control-box">
                    <label>Filter by Plan</label>
                    <select value={statsPlanFilter} onChange={(e) => { const planId = e.target.value; setStatsPlanFilter(planId); manuallyUnselectedIds.current.clear(); filterSessionsByDate(planId); }}
                      style={{ width: '100%', background: '#1a1a1a', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', cursor: 'pointer' }}>
                      <option value="all" style={{ background: '#1a1a1a' }}>All Plans</option>
                      {plans.map(plan => <option key={plan.id} value={plan.id} style={{ background: '#1a1a1a' }}>{plan.name}</option>)}
                    </select>
                  </div>
                  <div className="stats-control-box">
                    <label>Viewing Sessions</label>
                    <div className="date-range-inputs">
                      <input type="date" value={statsDateRange.start} onChange={(e) => setStatsDateRange({...statsDateRange, start: e.target.value})} className="date-input" />
                      <span>to</span>
                      <input type="date" value={statsDateRange.end} onChange={(e) => setStatsDateRange({...statsDateRange, end: e.target.value})} className="date-input" />
                    </div>
                  </div>
                  <div className="stats-control-box" onClick={() => setShowSessionSelector(true)} style={{ cursor: 'pointer' }}>
                    <label>Total Sessions (click to select sessions)</label>
                    <div className="session-count-display">{selectedSessionIds.length} selected</div>
                  </div>
                </div>
                <div className="stats-main-grid">
                  <div className="stats-left-controls">
                    <div className="stats-control-panel">
                      <h4>Chart Mode</h4>
                      <div className="chart-type-buttons" style={{ minHeight: '80px' }}>
                        <button className={`chart-type-btn ${statsChartMode === 'breakdown' ? 'active' : ''}`} onClick={() => setStatsChartMode('breakdown')}>Session Overview</button>
                        <button className={`chart-type-btn ${statsChartMode === 'overview' ? 'active' : ''}`} onClick={() => setStatsChartMode('overview')}>Shot Breakdown</button>
                      </div>
                    </div>
                    <div className="stats-control-panel">
                      <h4>Chart Type</h4>
                      <div className="chart-type-buttons">
                        <button className={`chart-type-btn ${statsChartType === 'line' ? 'active' : ''}`} onClick={() => setStatsChartType('line')}>Line</button>
                        <button className={`chart-type-btn ${statsChartType === 'bar' ? 'active' : ''}`} onClick={() => setStatsChartType('bar')}>Bar</button>
                        <button className={`chart-type-btn ${statsChartType === 'area' ? 'active' : ''}`} onClick={() => setStatsChartType('area')}>Area</button>
                      </div>
                    </div>
                  </div>
                  <div className="stats-graph-container">
                    {selectedSessionIds.length === 0 ? (
                      <div className="graph-placeholder"><p>Select sessions to view chart</p><p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>Choose a date range and select sessions</p></div>
                    ) : (
                      <ResponsiveContainer width="100%" height={400}>{renderChart()}</ResponsiveContainer>
                    )}
                  </div>
                  <div className="stats-right-highlights">
                    <div className="stats-control-panel">
                      <h4>Highlights</h4>
                      {(() => { const h = calculateHighlights(); return (<><div className="highlight-stat"><div className="highlight-label">Total Attempts</div><div className="highlight-value">{h.totalAttempts}</div></div><div className="highlight-stat"><div className="highlight-label">Total Goals</div><div className="highlight-value">{h.totalGoals}</div></div><div className="highlight-stat"><div className="highlight-label">Best Accuracy</div><div className="highlight-value">{h.bestAccuracy}%</div>{h.bestAccuracyDate && <div className="highlight-date">{h.bestAccuracyDate}</div>}</div></>); })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {currentView !== 'plans' && currentView !== 'stats' && currentView !== 'home' && !selectedShot && currentView !== 'connecting' && (
          <div className="discovery-sidebar">
            <div className="discovery-inner">
              <h2 className="discovery-title">Discovery</h2>
              <div className="discovery-sessions-list">
                {sessions.length === 0 ? <p style={{ color: '#888' }}>No sessions yet. Start training!</p> : (
                  [...sessions].sort((a, b) => new Date(b.start_time) - new Date(a.start_time)).map((session) => {
                    const accuracy = calculateAccuracy(session);
                    const colorClass = getAccuracyColor(accuracy);
                    const fillPercentage = session.total_attempts > 0 ? (session.total_goals / session.total_attempts) * 100 : 0;
                    return (
                      <div key={session.id} className="session-bar" onClick={() => { setSelectedSession(session); setSelectedShot(null); setCurrentView('sessions'); }}>
                        <div className="session-info">
                          <span className="session-name">{session.name || `Session ${session.session_id.slice(-8)}`}</span>
                          <span className="session-accuracy">{session.total_goals}/{session.total_attempts}</span>
                        </div>
                        <div className="progress-bar"><div className={`progress-fill ${colorClass}`} style={{ width: `${fillPercentage}%` }} /></div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Custom Plan Modal - opens directly to form */}
      {showCreatePlan && (
        <div className="modal-overlay" onClick={() => setShowCreatePlan(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Custom Plan</h2>
              <button className="close-btn" onClick={() => setShowCreatePlan(false)}>✕</button>
            </div>
            <div className="create-plan-form">
              <div className="form-group">
                <label>Plan Name</label>
                <input type="text" value={customPlanName} onChange={(e) => setCustomPlanName(e.target.value)} placeholder="e.g., My Ceiling Shot Training" className="form-input" />
              </div>
              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea value={customPlanDesc} onChange={(e) => setCustomPlanDesc(e.target.value)} placeholder="What will you practice?" className="form-textarea" />
              </div>
              <div className="form-group">
                <label>Shots</label>
                {customShotNames.map((shotName, index) => (
                  <div key={index} className="shot-input-row">
                    <input type="text" value={shotName} onChange={(e) => updateShotName(index, e.target.value)} placeholder={`Shot ${index + 1} name`} className="form-input" />
                    {customShotNames.length > 1 && <button className="remove-shot-btn" onClick={() => removeShotField(index)}>✕</button>}
                  </div>
                ))}
                <button className="add-shot-btn" onClick={addShotField}>+ Add Shot</button>
              </div>
              <div className="form-actions">
                <button className="cancel-btn" onClick={() => setShowCreatePlan(false)}>Cancel</button>
                <button className="save-only-btn" onClick={() => createCustomPlan(false)}>Save Only</button>
                <button className="glossy-btn" onClick={() => createCustomPlan(true)}>Create & Start</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan Library Modal - shows ALL plans (preset + custom) */}
      {showLibraryModal && (
        <div className="modal-overlay" onClick={() => setShowLibraryModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Plan Library</h2>
              <button className="close-btn" onClick={() => setShowLibraryModal(false)}>✕</button>
            </div>
            
            {/* Create New Plan button at top */}
            <div style={{ padding: '20px 30px 0' }}>
              <button 
                className="glossy-btn" 
                style={{ width: '100%', padding: '14px', fontSize: '15px' }}
                onClick={() => { setShowLibraryModal(false); setShowCreatePlan(true); }}
              >
                + Create New Plan
              </button>
            </div>
            
            <div className="plans-grid" style={{ padding: '20px 30px 30px' }}>
              {[...presetPlans, ...customPlans].length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#888', gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
                  <p style={{ fontSize: '18px', marginBottom: '10px' }}>No plans yet</p>
                  <p style={{ fontSize: '14px' }}>Create your first training plan to get started!</p>
                </div>
              ) : (
                [...presetPlans, ...customPlans].map((plan, index) => {
                  const planColors = ['#a855f7', '#00d4ff', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                  const color = planColors[index % planColors.length];
                  const sessionCount = sessions.filter(s => s.plan_id === plan.id).length;
                  const lastUsed = sessions.filter(s => s.plan_id === plan.id).sort((a, b) => new Date(b.start_time) - new Date(a.start_time))[0];
                  const isPreset = plan.is_preset;
                  
                  return (
                    <div key={plan.id} className="plan-card-new plan-library-card" style={{ '--plan-color': color }}>
                      {isPreset && (
                        <div style={{ 
                          position: 'absolute', 
                          top: '12px', 
                          right: '12px', 
                          background: 'rgba(88, 86, 214, 0.2)', 
                          border: '1px solid rgba(88, 86, 214, 0.4)',
                          borderRadius: '999px',
                          padding: '4px 10px',
                          fontSize: '10px',
                          color: '#8b86d6',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Pre-made
                        </div>
                      )}
                      <div className="plan-card-title">{plan.name}</div>
                      {plan.description && <div className="plan-card-description">{plan.description}</div>}
                      <div className="plan-card-meta">
                        <div className="plan-meta-item"><span className="plan-meta-label">Shots</span><span className="plan-meta-value">{plan.shots?.length || 0}</span></div>
                        <div className="plan-meta-item"><span className="plan-meta-label">Sessions</span><span className="plan-meta-value">{sessionCount}</span></div>
                        {lastUsed && <div className="plan-meta-item"><span className="plan-meta-label">Last Used</span><span className="plan-meta-value" style={{ fontSize: '13px' }}>{new Date(lastUsed.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>}
                      </div>
                      <div className="plan-shot-pills">
                        {(plan.shots || []).map((shot, i) => <span key={i} className="plan-shot-pill">{shot.name}</span>)}
                      </div>
                      <div className="plan-card-actions">
                        <button className="plan-use-btn" onClick={() => startSessionWithPlan(plan.id)} disabled={startingSession}>
                          {startingSession ? <span className="btn-spinner"></span> : 'Use Plan'}
                        </button>
                        {!isPreset && (
                          <button className="plan-delete-btn" onClick={() => deletePlan(plan.id)}>🗑️</button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {showSessionSelector && (
        <div className="modal-overlay" onClick={() => setShowSessionSelector(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Select Sessions</h2>
              <button className="close-btn" onClick={() => setShowSessionSelector(false)}>✕</button>
            </div>
            <div className="session-selector-content">
              {availableSessions.length === 0 ? <p style={{ color: '#888', textAlign: 'center', padding: '40px' }}>No sessions in this date range</p> : (
                <>
                  <div style={{ marginBottom: '10px', display: 'flex', gap: '10px' }}>
                    <button className="glossy-btn" style={{ fontSize: '12px', padding: '8px 12px' }} onClick={() => setSelectedSessionIds(availableSessions.map(s => s.id))}>Select All</button>
                    <button className="glossy-btn" style={{ fontSize: '12px', padding: '8px 12px' }} onClick={() => setSelectedSessionIds([])}>Deselect All</button>
                  </div>
                  <div className="session-checkbox-list">
                    {availableSessions.map((session) => (
                      <label key={session.id} className="session-checkbox-item">
                        <input type="checkbox" checked={selectedSessionIds.includes(session.id)} onChange={(e) => { if (e.target.checked) { setSelectedSessionIds([...selectedSessionIds, session.id]); } else { setSelectedSessionIds(selectedSessionIds.filter(id => id !== session.id)); } }} />
                        <div className="session-checkbox-info">
                          <div className="session-checkbox-name">{session.name || `Session ${session.session_id.slice(-8)}`}</div>
                          <div className="session-checkbox-date">{new Date(session.start_time).toLocaleDateString()}</div>
                          <div className="session-checkbox-stats">{session.total_goals}/{session.total_attempts} ({Math.round(session.total_accuracy || 0)}%)</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span className="toast-icon">{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {showFAQ && (
        <div className="modal-overlay" onClick={() => setShowFAQ(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>FAQ</h2>
              <button className="close-btn" onClick={() => setShowFAQ(false)}>✕</button>
            </div>
            <div style={{ padding: '30px' }}>
              <details className="faq-item">
                <summary className="faq-question">How do I change the HUD?</summary>
                <div className="faq-answer">
                  <p>To customize your in-game HUD:</p>
                  <ol style={{ marginLeft: '20px', marginTop: '10px', color: '#aaa', lineHeight: '1.8' }}>
                    <li>Press <strong style={{ color: '#fff' }}>F2</strong> to open BakkesMod</li>
                    <li>Navigate to <strong style={{ color: '#fff' }}>Plugins</strong></li>
                    <li>Find <strong style={{ color: '#fff' }}>MechTrak</strong> in the list</li>
                    <li>Toggle <strong style={{ color: '#fff' }}>Hide HUD</strong> or <strong style={{ color: '#fff' }}>Compact HUD</strong> options</li>
                  </ol>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
