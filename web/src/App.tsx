import { useEffect, useState } from 'react';
import './App.css';

interface Status {
  status: string;
  database: string;
  redis: string;
}

function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const enableDemoMode = () => {
    setStatus({
      status: 'Running (Demo)',
      database: 'Connected (Mock)',
      redis: 'Connected (Mock)',
    });
    setError(null);
  };

  return (
    <div className="container">
      <header className="header">
        <h1>🌌 Chaja Mesh</h1>
        <p className="subtitle">Productivity Suite & Infra-Controller</p>
      </header>
      
      <main className="dashboard">
        <section className="card">
          <h2>System Status</h2>
          {loading && <p>Loading system status...</p>}
          {error && (
            <div className="error-box">
              <p>{error}</p>
              <button className="demo-button" onClick={enableDemoMode}>
                Enable Demo Mode
              </button>
            </div>
          )}
          {status && (
            <div className="status-grid">
              <div className="status-item">
                <span className="label">Core Service</span>
                <span className={`value ${status.status.includes('Running') ? 'ok' : 'error'}`}>
                  {status.status}
                </span>
              </div>
              <div className="status-item">
                <span className="label">Database (Postgres)</span>
                <span className={`value ${status.database.includes('Connected') ? 'ok' : 'error'}`}>
                  {status.database}
                </span>
              </div>
              <div className="status-item">
                <span className="label">Cache (Redis)</span>
                <span className={`value ${status.redis.includes('Connected') ? 'ok' : 'error'}`}>
                  {status.redis}
                </span>
              </div>
            </div>
          )}
        </section>

        <section className="features-grid">
          <div className="card feature">
            <h3>📅 Calendar Engine</h3>
            <p>Native event logic implementation (RFC 5545) with push notifications.</p>
          </div>
          <div className="card feature">
            <h3>📝 Block-Based Notes</h3>
            <p>Notion-style notes with real-time persistence.</p>
          </div>
          <div className="card feature">
            <h3>✅ Task Orchestrator</h3>
            <p>Task management with priorities & lifecycle.</p>
          </div>
          <div className="card feature">
            <h3>🐳 Infra-Controller</h3>
            <p>Docker management & health monitoring.</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
