import { useEffect, useState } from 'react';

function App() {
  const [status, setStatus] = useState<{ status: string; db: string } | null>(null);

  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch((err) => console.error('Failed to fetch status:', err));
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Family Finances</h1>
      <p>Backend Status: {status ? `${status.status} (DB: ${status.db})` : 'Connecting...'}</p>
    </div>
  );
}

export default App;
