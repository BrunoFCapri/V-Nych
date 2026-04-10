import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Notes from './pages/Notes';
import Calendar from './pages/Calendar';
import Tasks from './pages/Tasks';
import { API_URL } from './config';
import { calendarIcon, folderIcon, starIcon, taskIcon } from './assets/icons';
import beetleTorso from './assets/logo/beetle/torso.svg';
import beetleShellLeft from './assets/logo/beetle/shell-left.svg?url';
import beetleShellRight from './assets/logo/beetle/shell-right.svg?url';
import beetleWingLeft from './assets/logo/beetle/wing-left.svg';
import beetleWingRight from './assets/logo/beetle/wing-right.svg';
import './App.css';

interface Status {
  status: string;
  database: string;
  redis: string;
}

function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [beetleState, setBeetleState] = useState<'idle' | 'online' | 'offline'>('idle');
  const [beetleAnimationKey, setBeetleAnimationKey] = useState(0);
  const hasBeenOnline = useRef(false);
  const wasConnectedRef = useRef(false);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    let firstCheck = true;

    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/status`);
        if (!res.ok) {
          throw new Error('Failed to fetch status');
        }

        const data: Status = await res.json();
        if (!isMounted) return;

        setStatus(data);
        setError(null);
      } catch (err) {
        console.error(err);
        if (!isMounted) return;

        setStatus(null);
        setError('Backend not connected (Is the Rust server running?)');
      } finally {
        if (isMounted && firstCheck) {
          setLoading(false);
          firstCheck = false;
        }
      }
    };

    checkStatus();
    const intervalId = setInterval(checkStatus, 2000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const normalize = (value: string | undefined) => (value ?? '').trim().toLowerCase();
  const isConnectedValue = (value: string | undefined) => {
    const normalized = normalize(value);
    return normalized === 'connected' || normalized === 'ok' || normalized === 'running';
  };

  const allServicesConnected =
    status !== null &&
    isConnectedValue(status.status) &&
    isConnectedValue(status.database) &&
    isConnectedValue(status.redis);

  useEffect(() => {
    const wasConnected = wasConnectedRef.current;

    if (allServicesConnected && !wasConnected) {
      hasBeenOnline.current = true;
      setBeetleState('online');
      setBeetleAnimationKey((prev) => prev + 1);
    } else if (!allServicesConnected && wasConnected && hasBeenOnline.current) {
      setBeetleState('offline');
      setBeetleAnimationKey((prev) => prev + 1);
    }

    wasConnectedRef.current = allServicesConnected;
  }, [allServicesConnected]);

  const beetleStateClass =
    beetleState === 'online' ? 'beetle-offline' : beetleState === 'offline' ? 'beetle-online' : '';

  return (
    <div className="container">
      <header className="header">
        <h1>V-NYCH</h1>
        <p className="subtitle">Private, Secure, Self-Hosted</p>
        <div className="user-info">
          <span>Hola, {user?.username}</span>
          <button onClick={logout} className="logout-btn">Salir</button>
        </div>
      </header>
      
      <main className="dashboard">
        <section className="card">
          <div key={beetleAnimationKey} className={`beetle-logo ${beetleStateClass}`} aria-hidden="true">
            <img className="beetle-wing beetle-wing-left" src={beetleWingLeft} alt="" />
            <img className="beetle-wing beetle-wing-right" src={beetleWingRight} alt="" />
            <img className="beetle-part beetle-torso" src={beetleTorso} alt="" />
            <img className="beetle-part beetle-shell-left" src={beetleShellLeft} alt="" />
            <img className="beetle-part beetle-shell-right" src={beetleShellRight} alt="" />
          </div>
          <h2>System Status</h2>
          {loading && <div className="loading">Checking connectivity...</div>}
          {error && <div className="error">{error}</div>}
          
          {status && (
            <div className="status-grid">
              <div className="status-item ok">
                <span className="label">Backend Core</span>
                <span className="value">Running</span>
              </div>
              <div className={`status-item ${status.database === "Connected" ? 'ok' : 'error'}`}>
                <span className="label">PostgreSQL</span>
                <span className="value">{status.database}</span>
              </div>
              <div className={`status-item ${status.redis === "Connected" ? 'ok' : 'error'}`}>
                <span className="label">Redis Cache</span>
                <span className="value">{status.redis}</span>
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <h2>Quick Actions</h2>
          <div className="actions">
            <button className="action-btn" onClick={() => navigate('/notes')}>
              <img src={folderIcon} alt="Notes icon" />
              <span>My Notes</span>
            </button>
            <button className="action-btn" onClick={() => navigate('/calendar')}>
              <img src={calendarIcon} alt="Calendar icon" />
              <span>My Calendar</span>
            </button>
            <button className="action-btn" onClick={() => navigate('/tasks')}>
              <img src={taskIcon} alt="Tasks icon" />
              <span>My Tasks</span>
            </button>
            <button className="action-btn">
              <img src={starIcon} alt="Sync icon" />
              <span>Sync Calendar</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/notes"
          element={
            <ProtectedRoute>
              <Notes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <Calendar />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <Tasks />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
