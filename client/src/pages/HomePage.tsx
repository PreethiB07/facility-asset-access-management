import { useEffect, useState } from 'react';
import { getHealthStatus } from '../services/health.service';

function HomePage() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    getHealthStatus()
      .then((data) => {
        setStatus('ok');
        setMessage(data.status);
      })
      .catch(() => {
        setStatus('error');
        setMessage('Unable to reach the backend API');
      });
  }, []);

  return (
    <main className="home">
      <h1>Facility &amp; Asset Access Management</h1>
      <p className="subtitle">Application is running</p>
      <section className="status-card">
        <h2>Backend Health</h2>
        {status === 'loading' && <p>Checking API connection...</p>}
        {status === 'ok' && (
          <p className="status-ok">
            API status: <strong>{message}</strong>
          </p>
        )}
        {status === 'error' && <p className="status-error">{message}</p>}
      </section>
    </main>
  );
}

export default HomePage;
