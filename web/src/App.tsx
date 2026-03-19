import { useEffect, useState, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
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
  const { logout, user } = useAuth();

  useEffect(() => {
    fetch('http://localhost:3000/api/status')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch status');
        return res.json();
      })
      .then((data) => {
        setStatus(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError('Backend not connected (Is the Rust server running?)');
        setLoading(false);
      });
  }, []);

  return (
    <div className="container">
      <header className="header">
        <h1>🌌 Chaja Mesh</h1>
        <p className="subtitle">Productivity Suite & Infra-Controller</p>
        <div className="user-info">
          <span>Hola, {user?.username}</span>
          <button onClick={logout} className="logout-btn">Salir</button>
        </div>
      </header>
      
      <main className="dashboard">
        <section className="card">
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
            <button>New Note</button>
            <button>Add Task</button>
            <button>Sync Calendar</button>
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
