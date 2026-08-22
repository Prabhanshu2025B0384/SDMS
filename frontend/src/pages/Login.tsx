import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const stateMessage = location.state?.message;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email.endsWith('@gmail.com')) {
      setError('Only @gmail.com email addresses are allowed.');
      return;
    }

    setIsLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await fetch('http://localhost:8000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Invalid email or password');
      }

      const data = await response.json();
      login(data.access_token);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-left">
        <h3 style={{ marginBottom: '1rem' }}>Hi, Welcome back</h3>
        <img src="https://minimals.cc/assets/illustrations/illustration-dashboard.webp" alt="Dashboard" style={{ maxWidth: '100%' }} />
      </div>
      
      <div className="auth-right">
        <div className="auth-form-container">
          <h4 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Sign in to Secure DMS</h4>
          <p style={{ marginBottom: '2rem' }}>
            New user? <Link to="/signup">Create an account</Link>
          </p>
          
          {stateMessage && (
            <div style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-color)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              {stateMessage}
            </div>
          )}

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
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
              <Link to="#" style={{ fontSize: '0.875rem' }}>Forgot password?</Link>
            </div>

            <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ width: '100%' }}>
              {isLoading ? <div className="spinner" /> : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
