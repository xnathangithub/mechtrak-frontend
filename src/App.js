import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_URL = 'https://mechtrak-backend-production.up.railway.app';

function App() {
  const [sessions, setSessions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedShot, setSelectedShot] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
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

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };
  
  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };
  
  const deleteSession = async (sessionId) => {
  try {
    await axios.delete(`${API_URL}/api/sessions/${sessionId}`);
    await fetchSessions();
    if (selectedSession?.session_id === sessionId) {
      setSelectedSession(null);
    }
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
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
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
    // Only poll when on sessions or stats page
    if (currentView !== 'sessions' && currentView !== 'stats') return;
    
    // Poll every 30 seconds
    const interval = setInterval(() => {
      fetchSessions();
    }, 30000);
    
    // Also fetch immediately when switching to these views
    fetchSessions();
    
    return () => clearInterval(interval);
  }, [currentView]);

  //auto update stats in session shot view 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedSession) {
      const updated = sessions.find(s => s.id === selectedSession.id);
      if (updated) {
        setSelectedSession(updated);
      }
    }
  }, [sessions]);


  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setCheckingAuth(false);
      return;
    }
    
    try {
      const response = await axios.get(`${API_URL}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(response.data.user);
      
      // Register token for plugin every time app loads
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        await axios.post(`${API_URL}/api/plugin/register-token`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {}
      
      setCurrentView('connecting');
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
      } else if (error.response?.status === 429) {
        console.log('Rate limited on verify, keeping session');
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setUser({ id: payload.userId, email: payload.email });
          setCurrentView('connecting');
        } catch (e) {
          console.error('Failed to decode token:', e);
        }
      }
    } finally {
      setCheckingAuth(false);
    }
  };

  const login = async () => {
    setAuthLoading(true);
    setAuthError('');
    
    if (!authEmail.includes('@')) {
      setAuthError('Please enter a valid email');
      setAuthLoading(false);
      return;
    }
    if (authPassword.length < 8) {
      setAuthError('Password must be at least 8 characters');
      setAuthLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email: authEmail,
        password: authPassword
      });
      
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        await axios.post(`${API_URL}/api/plugin/register-token`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {}
      setUser(user);
      await fetchSessions();
      await fetchPlans();
      setCurrentView('connecting');
      
    } catch (error) {
      setAuthError(error.response?.data?.error || error.response?.data?.message || `Login failed (${error.response?.status})` || 'Login failed');    } finally {
      setAuthLoading(false);
    }
  };

  const register = async () => {
    setAuthLoading(true);
    setAuthError('');
    
    // Validation
    if (!authEmail.includes('@')) {
      setAuthError('Please enter a valid email');
      setAuthLoading(false);
      return;
    }
    if (authPassword.length < 8) {
      setAuthError('Password must be at least 8 characters');
      setAuthLoading(false);
      return;
    }
    if (authView === 'register' && authUsername.trim().length < 3) {
      setAuthError('Username must be at least 3 characters');
      setAuthLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/api/auth/register`, {
        email: authEmail,
        password: authPassword,
        username: authUsername
      });
      
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        await axios.post(`${API_URL}/api/plugin/register-token`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {}
      setUser(user);
      await fetchSessions();
      await fetchPlans();
      setCurrentView('connecting');
      
    } catch (error) {
      setAuthError(error.response?.data?.error || 'Registration failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setSessions([]);
    setPlans([]);
    setCurrentView('home')
  };
  //
  const fetchSessions = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/sessions`, {
        headers: getAuthHeaders()
      });
      setSessions(response.data.sessions);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/plans`, {
        headers: getAuthHeaders()
      });
      setPlans(response.data.plans);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const renameSession = async (sessionId, newName) => {
    try {
      await axios.patch(`${API_URL}/api/sessions/${sessionId}/rename`, {
        name: newName
      });
      await fetchSessions();
      // Update selectedSession with new name so it reflects immediately
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
    
    if (!customPlanName.trim()) {
      showToast('Please enter a plan name', 'error');
      return;
    }
    if (filteredShots.length === 0) {
      showToast('Please add at least one shot', 'error');
      return;
    }
    
    try {
      const response = await axios.post(`${API_URL}/api/plans`, {
        name: customPlanName,
        description: customPlanDesc,
        shot_names: filteredShots
      }, { headers: getAuthHeaders() });
      
      const newPlan = response.data.plan;
      
      setCustomPlanName('');
      setCustomPlanDesc('');
      setCustomShotNames(['']);
      setShowCreatePlan(false);
      
      await fetchPlans();
      
      if (startSession) {
        await startSessionWithPlan(newPlan.id);
      }
      
    } catch (error) {
      console.error('Error creating plan:', error);
      showToast('Failed to create plan', 'error');
    }
  };

  const addShotField = () => {
    setCustomShotNames([...customShotNames, '']);
  };

  const updateShotName = (index, value) => {
    const updated = [...customShotNames];
    updated[index] = value;
    setCustomShotNames(updated);
  };

  const removeShotField = (index) => {
    if (customShotNames.length > 1) {
      const updated = customShotNames.filter((_, i) => i !== index);
      setCustomShotNames(updated);
    }
  };

  const startSessionWithPlan = async (planId) => {
    setStartingSession(true);
    try {
      const response = await axios.post(`${API_URL}/api/sessions/start`, {
        plan_id: planId
      }, { headers: getAuthHeaders() });
      
      await fetchSessions();
      setSelectedSession(response.data.session);
      setShowPlanModal(false);
      setCurrentView('sessions');
      showToast(`Session started with ${response.data.plan.name}!`);
      
    } catch (error) {
      console.error('Error starting session:', error);
      showToast('Failed to start session', 'error');
    } finally {
      setStartingSession(false);
    }
  };

  const filterSessionsByDate = () => {
    if (!statsDateRange.start || !statsDateRange.end) {
      setAvailableSessions(sessions);
      setSelectedSessionIds(sessions.map(s => s.id));
      return;
    }
    
    const start = new Date(statsDateRange.start);
    const end = new Date(statsDateRange.end);
    
    const filtered = sessions.filter(session => {
      const sessionDate = new Date(session.start_time);
      return sessionDate >= start && sessionDate <= end;
    });
    
    setAvailableSessions(filtered);
    setSelectedSessionIds(filtered.map(s => s.id));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (currentView !== 'connecting') return;
    
    const checkConnection = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/heartbeat/check`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.connected) {
          setPluginConnected(true);
          setTimeout(() => setCurrentView('home'), 2000); // Wait 2 seconds then redirect
        }
      } catch (error) {
        console.error('Connection check failed:', error);
      }
    };
    
    // Check every 3 seconds
    const interval = setInterval(checkConnection, 3000);
    checkConnection(); // Check immediately
    
    return () => clearInterval(interval);
  }, [currentView]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sessions.length > 0) {
      if (!statsDateRange.start && !statsDateRange.end) {
        const end = new Date();
        end.setDate(end.getDate() + 2);
        const start = new Date();
        start.setDate(start.getDate() - 31);
        
        setStatsDateRange({
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        });
      } else {
        filterSessionsByDate();
      }
    }
  }, [sessions]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sessions.length > 0 && statsDateRange.start && statsDateRange.end) {
      filterSessionsByDate();
    }
  }, [statsDateRange]);

  const prepareChartData = () => {
    const selectedSessions = sessions.filter(s => selectedSessionIds.includes(s.id));
    
    if (statsChartMode === 'overview') {
      selectedSessions.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      
      const allDataPoints = [];
      
      selectedSessions.forEach((session, sessionIndex) => {
        const sessionDate = new Date(session.start_time);
        const dateStr = sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        const shots = Object.entries(session.shots_data)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .filter(([_, shotData]) => shotData.attempts > 0);
        
        shots.forEach(([shotNum, shotData]) => {
          const accuracy = (shotData.goals / shotData.attempts) * 100;
          
          allDataPoints.push({
            label: `${dateStr} S${shotNum}`,
            fullLabel: `${dateStr} - Shot ${shotNum}`,
            accuracy: Math.round(accuracy),
            sessionIndex: sessionIndex,
            sessionId: session.id,
            date: dateStr,
            shotNum: parseInt(shotNum)
          });
        });
      });
      
      return allDataPoints;
      
    } else {
      selectedSessions.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      
      return selectedSessions.map((session, index) => {
        const dataPoint = { 
          name: `Session ${index + 1}`,
          date: new Date(session.start_time).toLocaleDateString()
        };
        
        Object.entries(session.shots_data).forEach(([shotNum, shotData]) => {
          if (shotData.attempts > 0) {
            const accuracy = (shotData.goals / shotData.attempts) * 100;
            dataPoint[`Shot ${shotNum}`] = Math.round(accuracy);
          }
        });
        
        return dataPoint;
      });
    }
  };

  const generateColors = (count) => {
    const colors = [
      '#a855f7', '#00d4ff', '#10b981', '#f59e0b', '#ef4444',
      '#8b5cf6', '#06b6d4', '#14b8a6', '#f97316', '#ec4899'
    ];
    return colors.slice(0, count);
  };

  const calculateHighlights = () => {
    const selectedSessions = sessions.filter(s => selectedSessionIds.includes(s.id));
    
    if (selectedSessions.length === 0) {
      return { totalAttempts: 0, totalGoals: 0, bestAccuracy: 0, bestAccuracyDate: null };
    }
    
    let totalAttempts = 0;
    let totalGoals = 0;
    let bestSession = null;
    let bestAccuracy = 0;
    
    selectedSessions.forEach(session => {
      totalAttempts += session.total_attempts;
      totalGoals += session.total_goals;
      
      const accuracy = session.total_attempts > 0 
        ? (session.total_goals / session.total_attempts) * 100 
        : 0;
      
      if (accuracy > bestAccuracy) {
        bestAccuracy = accuracy;
        bestSession = session;
      }
    });
    
    return {
      totalAttempts,
      totalGoals,
      bestAccuracy: Math.round(bestAccuracy),
      bestAccuracyDate: bestSession ? new Date(bestSession.start_time).toLocaleDateString() : null
    };
  };

  const getTop5Sessions = () => {
    const selectedSessions = sessions.filter(s => selectedSessionIds.includes(s.id));
    
    return selectedSessions
      .map(session => ({
        ...session,
        accuracy: session.total_attempts > 0 
          ? (session.total_goals / session.total_attempts) * 100 
          : 0
      }))
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 5);
  };

  const prepareMiniGraphData = (session) => {
    return Object.entries(session.shots_data)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([shotNum, shotData]) => ({
        shot: parseInt(shotNum),
        accuracy: shotData.attempts > 0 
          ? Math.round((shotData.goals / shotData.attempts) * 100)
          : 0
      }));
  };

  const renderChart = () => {
    const data = prepareChartData();
    const selectedSessions = sessions.filter(s => selectedSessionIds.includes(s.id));
    
    if (statsChartMode === 'overview') {
      const colors = generateColors(selectedSessions.length);
      
      if (statsChartType === 'line') {
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="label" stroke="#888" angle={-45} textAnchor="end" height={80} />
            <YAxis stroke="#888" label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', fill: '#888' }} />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '10px' }}>
                      <p style={{ color: '#fff', margin: 0 }}>{d.fullLabel}</p>
                      <p style={{ color: colors[d.sessionIndex], margin: '5px 0 0 0' }}>Accuracy: {d.accuracy}%</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line 
              type="monotone" 
              dataKey="accuracy"
              stroke="#666"
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props;
                return <circle cx={cx} cy={cy} r={5} fill={colors[payload.sessionIndex]} stroke={colors[payload.sessionIndex]} strokeWidth={2} />;
              }}
              activeDot={(props) => {
                const { cx, cy, payload } = props;
                return <circle cx={cx} cy={cy} r={7} fill={colors[payload.sessionIndex]} stroke="#fff" strokeWidth={2} />;
              }}
            />
          </LineChart>
        );
      } else if (statsChartType === 'bar') {
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="label" stroke="#888" angle={-45} textAnchor="end" height={80} />
            <YAxis stroke="#888" label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', fill: '#888' }} />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '10px' }}>
                      <p style={{ color: '#fff', margin: 0 }}>{d.fullLabel}</p>
                      <p style={{ color: colors[d.sessionIndex], margin: '5px 0 0 0' }}>Accuracy: {d.accuracy}%</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar 
              dataKey="accuracy"
              shape={(props) => {
                const { x, y, width, height, payload } = props;
                return <rect x={x} y={y} width={width} height={height} fill={colors[payload.sessionIndex]} />;
              }}
            />
          </BarChart>
        );
      } else {
        return (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="label" stroke="#888" angle={-45} textAnchor="end" height={80} />
            <YAxis stroke="#888" label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', fill: '#888' }} />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '10px' }}>
                      <p style={{ color: '#fff', margin: 0 }}>{d.fullLabel}</p>
                      <p style={{ color: colors[d.sessionIndex], margin: '5px 0 0 0' }}>Accuracy: {d.accuracy}%</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
                {selectedSessions.map((_, index) => (
                  <stop key={index} offset={`${(index / selectedSessions.length) * 100}%`} stopColor={colors[index]} stopOpacity={0.8} />
                ))}
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="accuracy" stroke="#666" fill="url(#colorGradient)" fillOpacity={0.3} />
          </AreaChart>
        );
      }
    } else {
      const allShotNumbers = new Set();
      selectedSessions.forEach(session => {
        Object.keys(session.shots_data).forEach(shotNum => {
          allShotNumbers.add(parseInt(shotNum));
        });
      });
      
      const sortedShotNumbers = Array.from(allShotNumbers).sort((a, b) => a - b);
      const colors = generateColors(sortedShotNumbers.length);
      
      if (statsChartType === 'line') {
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="name" stroke="#888" />
            <YAxis stroke="#888" label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', fill: '#888' }} />
            <Tooltip contentStyle={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} />
            <Legend />
            {sortedShotNumbers.map((shotNum, index) => (
              <Line key={shotNum} type="monotone" dataKey={`Shot ${shotNum}`} stroke={colors[index]} strokeWidth={2} />
            ))}
          </LineChart>
        );
      } else if (statsChartType === 'bar') {
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="name" stroke="#888" />
            <YAxis stroke="#888" label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', fill: '#888' }} />
            <Tooltip contentStyle={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} />
            <Legend />
            {sortedShotNumbers.map((shotNum, index) => (
              <Bar key={shotNum} dataKey={`Shot ${shotNum}`} fill={colors[index]} />
            ))}
          </BarChart>
        );
      } else {
        return (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="name" stroke="#888" />
            <YAxis stroke="#888" label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', fill: '#888' }} />
            <Tooltip contentStyle={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} />
            <Legend />
            {sortedShotNumbers.map((shotNum, index) => (
              <Area key={shotNum} type="monotone" dataKey={`Shot ${shotNum}`} stroke={colors[index]} fill={colors[index]} fillOpacity={0.3} />
            ))}
          </AreaChart>
        );
      }
    }
  };

  if (checkingAuth) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#070707', color: '#fff', fontSize: '18px' }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-logo">MECH TRAK</div>
          <p className="auth-subtitle">Track your training, master your shots</p>
          
          <div className="auth-tabs">
            <button 
              className={`auth-tab ${authView === 'login' ? 'active' : ''}`}
              onClick={() => { setAuthView('login'); setAuthError(''); }}
            >
              Sign In
            </button>
            <button 
              className={`auth-tab ${authView === 'register' ? 'active' : ''}`}
              onClick={() => { setAuthView('register'); setAuthError(''); }}
            >
              Sign Up
            </button>
          </div>
          
          <div className="auth-form">
            {authView === 'register' && (
              <div className="auth-field">
                <label>Username</label>
                <input 
                  type="text"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  placeholder="Your username"
                  className="auth-input"
                />
              </div>
            )}
            
            <div className="auth-field">
              <label>Email</label>
              <input 
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="your@email.com"
                className="auth-input"
                onKeyDown={(e) => e.key === 'Enter' && (authView === 'login' ? login() : register())}
              />
            </div>
            
            <div className="auth-field">
              <label>Password</label>
              <input 
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                className="auth-input"
                onKeyDown={(e) => e.key === 'Enter' && (authView === 'login' ? login() : register())}
              />
            </div>
            
            {authError && (
              <div className="auth-error">{authError}</div>
            )} 
            <button 
              className="glossy-btn auth-submit"
              onClick={authView === 'login' ? login : register}
              disabled={authLoading}
            >
              {authLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span className="btn-spinner"></span>
                  {authView === 'login' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : (
                authView === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const presetPlans = plans.filter(p => p.is_preset);
  const customPlans = plans.filter(p => !p.is_preset).sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );

  return (
    <div className="App">
      <header className="header">
        <div className="logo">MECH TRAK</div>
        <div className="header-actions">
          {user && (
            <button className="glossy-btn" onClick={logout} style={{ fontSize: '13px' }}>
              {user.username || user.email} ↪
            </button>
          )}
        </div>
        <div className="profile-placeholder"></div>
      </header>

      <div className="main-container">
        <div className="main-section">

          {currentView === 'connecting' && (
            <div className="connecting-page">
              <div className="connecting-container">
                <h1>Checking Connection</h1>
                <p style={{ color: '#888', marginBottom: '40px' }}>
                  Looking for your Rocket League plugin...
                </p>
                
                <div className="connecting-spinner">
                  <div className="spinner"></div>
                </div>
                
                <div className="connecting-status">
                  {pluginConnected 
                    ? '✅ Plugin connected! Redirecting...' 
                    : 'Waiting for plugin connection...'}
                </div>
                
                <div className="install-instructions">
                  <h3>Plugin not installed?</h3>
                  <div className="instruction-steps">
                    <div className="instruction-step">
                      <div className="step-number">1</div>
                      <div className="step-text">Download and install BakkesMod from <strong>bakkesmod.com</strong></div>
                    </div>
                    <div className="instruction-step">
                      <div className="step-number">2</div>
                      <div className="step-text">Download the RL Best plugin .dll file</div>
                    </div>
                    <div className="instruction-step">
                      <div className="step-number">3</div>
                      <div className="step-text">Place the .dll in your BakkesMod plugins folder</div>
                    </div>
                    <div className="instruction-step">
                      <div className="step-number">4</div>
                      <div className="step-text">Launch Rocket League and open BakkesMod (F2)</div>
                    </div>
                    <div className="instruction-step">
                      <div className="step-number">5</div>
                      <div className="step-text">Enable the RL Best plugin in the plugins tab</div>
                    </div>
                  </div>
                </div>
                
                <button 
                  className="glossy-btn"
                  style={{ marginTop: '30px' }}
                  onClick={() => setCurrentView('home')}
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {currentView === 'home' && (
            <div className="homepage" style={{ backgroundImage: 'url(/home.jpg)' }}>
              <h1 className="homepage-title">MECH TRAK</h1>
              <p className="homepage-subtitle">Track your training, master your shots</p>
              
              <div className="home-cards-grid">
                <div className="glass-card" onClick={() => setCurrentView('sessions')}>
                  <div className="card-icon">📊</div>
                  <h2>Sessions</h2>
                  <p>View and manage your training sessions</p>
                  <div className="card-badge">{sessions.length} total</div>
                </div>
                
                <div className="glass-card" onClick={() => setCurrentView('plans')}>
                  <div className="card-icon">🚀</div>
                  <h2>Start Session</h2>
                  <p>Begin a new training session</p>
                  <div className="card-badge">{customPlans.length} custom plans</div>
                </div>
                
                <div className="glass-card" onClick={() => setCurrentView('stats')}>
                  <div className="card-icon">📈</div>
                  <h2>Stats</h2>
                  <p>Analyze your progress over time</p>
                  <div className="card-badge">{sessions.length} sessions</div>
                </div>
              </div>
            </div>
          )}
          
          {currentView === 'sessions' && (
            <div>
              <button className="back-button" onClick={() => setCurrentView('home')}>
                ← Back to Home
              </button>
              
              {!selectedSession ? (
                <div style={{ marginTop: '30px' }}>
                  <h1 style={{ fontSize: '36px', marginBottom: '20px' }}>Sessions</h1>
                  {sessions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>
                      <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎯</div>
                      <p style={{ fontSize: '18px', marginBottom: '10px' }}>No sessions yet!</p>
                      <p style={{ fontSize: '14px' }}>Start a training session to see your stats here</p>
                      <button 
                        className="glossy-btn" 
                        style={{ marginTop: '20px' }}
                        onClick={() => setCurrentView('home')}
                      >
                        Start Training
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p style={{ color: '#888', marginBottom: '20px' }}>Select a session from the sidebar →</p>
                      {/* Show active session banner if one exists */}
                        {sessions.some(s => s.status === 'active') ? (
                          <div style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '12px',
                            padding: '16px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            maxWidth: '500px'
                          }}>
                            <div style={{ 
                              width: '10px', height: '10px', 
                              borderRadius: '50%', 
                              background: '#10b981',
                              boxShadow: '0 0 8px #10b981',
                              animation: 'pulse 2s infinite'
                            }}></div>
                            <div>
                              <p style={{ color: '#10b981', fontWeight: '600', marginBottom: '2px' }}>
                                Session Active
                              </p>
                              <p style={{ color: '#888', fontSize: '13px' }}>
                                {sessions.find(s => s.status === 'active')?.name || 'Training in progress'} — Plugin is recording
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '12px',
                            padding: '16px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            maxWidth: '500px'
                          }}>
                            <div style={{ fontSize: '20px' }}>⚠️</div>
                            <div>
                              <p style={{ color: '#ef4444', fontWeight: '600', marginBottom: '2px' }}>
                                No Active Session
                              </p>
                              <p style={{ color: '#888', fontSize: '13px' }}>
                                Start a session from the homepage to begin tracking
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
              ) : selectedShot ? (
                <div>
                  <button className="back-button" onClick={() => setSelectedShot(null)} style={{ marginTop: '20px' }}>
                    ← Back to Shots
                  </button>
                  <div style={{ marginTop: '30px' }}>
                    <h1 style={{ fontSize: '36px', marginBottom: '10px', color: '#ffffff' }}>
                      Shot {selectedShot.shotNum}
                    </h1>
                    <div className="detail-stats-grid">
                      <div className="stat-box">
                        <div className="stat-label">Goals</div>
                        <div className="stat-value">{selectedShot.goals}</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-label">Attempts</div>
                        <div className="stat-value">{selectedShot.attempts}</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-label">Accuracy</div>
                        <div className="stat-value">
                          {selectedShot.attempts > 0 
                            ? Math.round((selectedShot.goals / selectedShot.attempts) * 100) 
                            : 0}%
                        </div>
                      </div>
                    </div>
                    <div className="chart-container">
                      <h3>Goals vs Attempts</h3>
                      <div style={{ color: '#888', padding: '40px', textAlign: 'center' }}>
                        Pie chart coming soon...
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '30px' }}>
                  <div style={{ marginBottom: '40px' }}>
                    {editingName ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <input
                          type="text"
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          className="form-input"
                          style={{ fontSize: '24px', fontWeight: '700', maxWidth: '400px' }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              renameSession(selectedSession.session_id, tempName);
                              setEditingName(false);
                            }
                            if (e.key === 'Escape') {
                              setEditingName(false);
                            }
                          }}
                        />
                        <button
                          className="glossy-btn"
                          style={{ padding: '8px 16px', fontSize: '13px' }}
                          onClick={() => {
                            renameSession(selectedSession.session_id, tempName);
                            setEditingName(false);
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingName(false)}
                          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <h1 style={{ fontSize: '36px' }}>
                          {selectedSession.name || `Session ${selectedSession.session_id.slice(-8)}`}
                        </h1>
                        <button
                          onClick={() => {
                            setTempName(selectedSession.name || `Session ${selectedSession.session_id.slice(-8)}`);
                            setEditingName(true);
                          }}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#888',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px'
                          }}
                        >
                          ✏️ Rename
                        </button>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '30px', color: '#888', alignItems: 'center' }}>
                      <span>Duration: {selectedSession.duration_minutes || 0} min</span>
                      <span>Total: {selectedSession.total_goals}/{selectedSession.total_attempts}</span>
                      <span>Accuracy: {Math.round(selectedSession.total_accuracy || 0)}%</span>
                      <button 
                        onClick={() => deleteSession(selectedSession.session_id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#ef4444',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          marginLeft: 'auto'
                        }}
                      >
                        🗑️ Delete Session
                      </button>
                    </div>
                  </div>
                  <h2 style={{ marginBottom: '20px', color: '#ffffff' }}>Shots</h2>
                  <div className="shot-cards-container">
                    {Object.entries(selectedSession.shots_data).map(([shotNum, shotData]) => {
                      const accuracy = shotData.attempts > 0 
                        ? (shotData.goals / shotData.attempts) * 100 
                        : 0;
                      return (
                        <div key={shotNum} className="shot-card" onClick={() => setSelectedShot({ shotNum, ...shotData })}>
                          <div className="shot-number">Shot {shotNum}</div>
                          <div className="shot-type">{shotData.shotType || 'Unknown'}</div>
                          <div className="vertical-bar-container">
                            <div className="vertical-bar-background">
                              <div className="vertical-bar-fill" style={{ height: `${accuracy}%`, background: '#ffffff' }} />
                            </div>
                            <div className="bar-label">{shotData.goals}/{shotData.attempts}</div>
                          </div>
                          <div className="shot-stats">{Math.round(accuracy)}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {currentView === 'plans' && (
            <div>
              <button className="back-button" onClick={() => setCurrentView('home')}>
                ← Back to Home
              </button>
              <div style={{ marginTop: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                  <div>
                    <h1 style={{ fontSize: '36px', marginBottom: '10px' }}>Training Plans</h1>
                    <p style={{ color: '#888' }}>Create and manage your custom training plans</p>
                  </div>
                  <button className="glossy-btn" onClick={() => setShowPlanModal(true)}>
                    + Start A Session
                  </button>
                </div>
                {customPlans.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>
                    <p style={{ fontSize: '18px' }}>No custom plans yet.</p>
                    <p style={{ marginTop: '10px' }}>Click "Start A Session" to get started!</p>
                  </div>
                ) : (
                  <div className="plans-list-grid">
                    {customPlans.map((plan) => (
                      <div key={plan.id} className="plan-list-item">
                        <button className="star-btn">☆</button>
                        <div className="plan-list-content">
                          <h3>{plan.name}</h3>
                          <p className="plan-description">{plan.description || 'No description'}</p>
                          <p className="plan-shots-list">{plan.shot_names.join(' • ')}</p>
                        </div>
                        <div className="plan-list-meta">
                          <span className="plan-shot-count">{plan.shot_names.length} shots</span>
                          <button 
                            className="glossy-btn"
                            style={{ padding: '8px 16px', fontSize: '13px' }}
                            onClick={() => startSessionWithPlan(plan.id)}
                            disabled={startingSession}
                          >
                            {startingSession ? <span className="btn-spinner"></span> : 'Use Plan'}
                          </button>
                          <button 
                            onClick={() => deletePlan(plan.id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#ef4444',
                              padding: '8px 14px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '13px'
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {currentView === 'stats' && (
            <div>
              <button className="back-button" onClick={() => setCurrentView('home')}>
                ← Back to Home
              </button>
              <div className="stats-container">
                <div className="stats-top-controls">
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
                      <div className="chart-type-buttons">
                        <button className={`chart-type-btn ${statsChartMode === 'overview' ? 'active' : ''}`} onClick={() => setStatsChartMode('overview')}>Session Overview</button>
                        <button className={`chart-type-btn ${statsChartMode === 'breakdown' ? 'active' : ''}`} onClick={() => setStatsChartMode('breakdown')}>Shot Breakdown</button>
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
                      <div className="graph-placeholder">
                        <p>Select sessions to view chart</p>
                        <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>Choose a date range and select sessions</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={400}>
                        {renderChart()}
                      </ResponsiveContainer>
                    )}
                  </div>
                  
                  <div className="stats-right-highlights">
                    <div className="stats-control-panel">
                      <h4>Highlights</h4>
                      {(() => {
                        const highlights = calculateHighlights();
                        return (
                          <>
                            <div className="highlight-stat">
                              <div className="highlight-label">Total Attempts</div>
                              <div className="highlight-value">{highlights.totalAttempts}</div>
                            </div>
                            <div className="highlight-stat">
                              <div className="highlight-label">Total Goals</div>
                              <div className="highlight-value">{highlights.totalGoals}</div>
                            </div>
                            <div className="highlight-stat">
                              <div className="highlight-label">Best Accuracy</div>
                              <div className="highlight-value">{highlights.bestAccuracy}%</div>
                              {highlights.bestAccuracyDate && (
                                <div className="highlight-date">{highlights.bestAccuracyDate}</div>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                
                <div className="stats-top-sessions">
                  <details className="top-sessions-dropdown">
                    <summary>Top 5 Sessions</summary>
                    <div className="top-sessions-grid">
                      {getTop5Sessions().map((session, index) => {
                        const miniData = prepareMiniGraphData(session);
                        return (
                          <div key={session.id} className="top-session-card">
                            <div className="top-session-rank">#{index + 1}</div>
                            <ResponsiveContainer width="100%" height={80}>
                              <LineChart data={miniData}>
                                <Line type="monotone" dataKey="accuracy" stroke="#a855f7" strokeWidth={2} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                            <div className="session-mini-stats">
                              <span>{new Date(session.start_time).toLocaleDateString()}</span>
                              <span>{session.total_goals}/{session.total_attempts}</span>
                              <span className="mini-accuracy">{Math.round(session.accuracy)}%</span>
                            </div>
                          </div>
                        );
                      })}
                      {getTop5Sessions().length === 0 && (
                        <p style={{ color: '#888', padding: '20px', gridColumn: '1 / -1', textAlign: 'center' }}>No sessions selected</p>
                      )}
                    </div>
                  </details>
                </div>
              </div>
            </div>
          )}
        </div>

        {currentView !== 'home' && currentView !== 'connecting' && (
          <div className="discovery-sidebar">
            <h2 className="discovery-title">Discovery</h2>
            {sessions.length === 0 ? (
              <p style={{ color: '#888' }}>No sessions yet. Start training!</p>
            ) : (
              sessions.map((session) => {
                const accuracy = calculateAccuracy(session);
                const colorClass = getAccuracyColor(accuracy);
                const fillPercentage = session.total_attempts > 0 
                  ? (session.total_goals / session.total_attempts) * 100 
                  : 0;
                return (
                  <div 
                    key={session.id} 
                    className="session-bar"
                    onClick={() => {
                      setSelectedSession(session);
                      setSelectedShot(null);
                      setCurrentView('sessions');
                    }}
                  >
                    <div className="session-info">
                      <span className="session-name">
                        {session.name || `Session ${session.session_id.slice(-8)}`}
                      </span>
                      <span className="session-accuracy">{session.total_goals}/{session.total_attempts}</span>
                    </div>
                    <div className="progress-bar">
                      <div className={`progress-fill ${colorClass}`} style={{ width: `${fillPercentage}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {showPlanModal && (
        <div className="modal-overlay" onClick={() => setShowPlanModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Choose Training Plan</h2>
              <button className="close-btn" onClick={() => setShowPlanModal(false)}>✕</button>
            </div>

            {!showCreatePlan ? (
              <>
                <div className="plans-grid">
                  {presetPlans.map((plan) => {
                    const planImages = {
                      'Reset Training': 'reset.png',
                      'Musty Flick Mastery': 'musty.png',
                      'Air Dribble Foundation': 'airdribble.png'
                    };
                    return (
                      <div key={plan.id} className="plan-card">
                        <img src={`/images/${planImages[plan.name] || 'reset.png'}`} alt={plan.name} className="plan-car-image" />
                        <h3>{plan.name}</h3>
                        <p>{plan.description}</p>
                        <div className="plan-shots">{plan.shot_names.length} shots</div>
                        <button className="glossy-btn select-plan-btn" 
                          onClick={() => startSessionWithPlan(plan.id)}
                          disabled={startingSession}
                        >
                          {startingSession ? <span className="btn-spinner"></span> : 'Select Plan'}
                        </button>
                      </div>
                    );
                  })}

                  {/* Custom Plans Card */}
                  <div className="plan-card create-card" onClick={() => setShowCreatePlan(true)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '40px', marginBottom: '15px' }}>+</div>
                    <h3>Custom Plan</h3>
                    <p style={{ textAlign: 'center' }}>Create your own training plan or use an existing one</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="create-plan-form" style={{ padding: '0 30px 30px' }}>
                
              </div>
            )}
          </div>
        </div>
      )}

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
                    {customShotNames.length > 1 && (
                      <button className="remove-shot-btn" onClick={() => removeShotField(index)}>✕</button>
                    )}
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

      {showSessionSelector && (
        <div className="modal-overlay" onClick={() => setShowSessionSelector(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Select Sessions</h2>
              <button className="close-btn" onClick={() => setShowSessionSelector(false)}>✕</button>
            </div>
            <div className="session-selector-content">
              {availableSessions.length === 0 ? (
                <p style={{ color: '#888', textAlign: 'center', padding: '40px' }}>No sessions in this date range</p>
              ) : (
                <>
                  <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
                    <button className="glossy-btn" style={{ fontSize: '12px', padding: '8px 12px' }} onClick={() => setSelectedSessionIds(availableSessions.map(s => s.id))}>Select All</button>
                    <button className="glossy-btn" style={{ fontSize: '12px', padding: '8px 12px' }} onClick={() => setSelectedSessionIds([])}>Deselect All</button>
                  </div>
                  <div className="session-checkbox-list">
                    {availableSessions.map((session) => (
                      <label key={session.id} className="session-checkbox-item">
                        <input 
                          type="checkbox"
                          checked={selectedSessionIds.includes(session.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSessionIds([...selectedSessionIds, session.id]);
                            } else {
                              setSelectedSessionIds(selectedSessionIds.filter(id => id !== session.id));
                            }
                          }}
                        />
                          <div className="session-checkbox-info">
                          <div className="session-checkbox-name">
                            {session.name || `Session ${session.session_id.slice(-8)}`}
                          </div>
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
            <span className="toast-icon">
              {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
            </span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;