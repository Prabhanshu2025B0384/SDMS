import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export const Signup: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Investigating Officer');
  const [department, setDepartment] = useState('Police');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email.endsWith('@gmail.com')) {
      setError('Only @gmail.com email addresses are allowed.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, role, department }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to create account');
      }

      navigate('/login', { state: { message: 'Account created successfully. Please log in.' } });
    } catch (err: any) {
      setError(err.message || 'An error occurred during signup');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-left">
        <h3 style={{ marginBottom: '1rem' }}>Manage the job more effectively with Secure DMS</h3>
        <img src="https://minimals.cc/assets/illustrations/illustration-dashboard.webp" alt="Dashboard" style={{ maxWidth: '100%' }} />
      </div>
      
      <div className="auth-right">
        <div className="auth-form-container">
          <h4 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Get started absolutely free</h4>
          <p style={{ marginBottom: '2rem' }}>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
          
          {error && (
            <div style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-color)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <input
                id="email"
                type="email"
                placeholder="Email address"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="input-group">
              <input
                id="password"
                type="password"
                placeholder="Password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                  <select 
                    className="input-field"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="Investigating Officer">Investigating Officer</option>
                    <option value="Senior Officer">Senior Officer</option>
                    <option value="Prosecutor">Prosecutor</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                  <select 
                    className="input-field"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <option value="Police">Police</option>
                    <option value="Court">Court</option>
                    <option value="Cyber Cell">Cyber Cell</option>
                  </select>
                </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ width: '100%' }}>
              {isLoading ? <div className="spinner" /> : 'Create account'}
            </button>
            
            <p style={{ textAlign: 'center', fontSize: '0.75rem', marginTop: '1.5rem' }}>
              By signing up, I agree to Secure DMS <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};
