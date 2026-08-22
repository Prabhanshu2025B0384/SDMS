import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface Case {
  id: string;
  title: string;
  description: string;
  status: string;
  jurisdiction: string;
}

export const Dashboard: React.FC = () => {
  const { logout, token } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const response = await fetch('http://localhost:8000/cases', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setCases(data);
        }
      } catch (error) {
        console.error("Failed to fetch cases:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, [token]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Active Cases</h2>
        <button className="btn btn-outline" onClick={logout}>Sign Out</button>
      </div>
      
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <div className="spinner"></div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {cases.length === 0 ? (
            <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
              <p>No active cases found.</p>
            </div>
          ) : (
            cases.map(c => (
              <div key={c.id} className="card">
                <h3>{c.title}</h3>
                <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>{c.description}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`status-badge ${c.status === 'OPEN' ? 'status-warning' : 'status-default'}`}>
                    {c.status}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.jurisdiction}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
