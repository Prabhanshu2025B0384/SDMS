import { useState, useEffect } from 'react';
import { Box, Card, Typography, TextField, Button, Alert } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate(user.role === 'Admin' ? '/admin' : '/documents');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await fetch('http://127.0.0.1:8000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const token = data.access_token;

        // Fetch user details
        const meRes = await fetch('http://127.0.0.1:8000/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (meRes.ok) {
          const user = await meRes.json();
          login(token, user);
          
          if (user.role === 'Admin') {
            navigate('/admin');
          } else {
            navigate('/documents');
          }
        }
      } else {
        const errData = await response.json();
        setError(errData.detail || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred connecting to the server.');
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Card sx={{ p: 5, width: '100%', maxWidth: 480 }}>
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
          Sign in to Secure DMS
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 5 }}>
          Enter your details below.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <form onSubmit={handleLogin}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button
              fullWidth
              size="large"
              type="submit"
              variant="contained"
              color="primary"
            >
              Sign In
            </Button>
          </Box>
        </form>
      </Card>
    </Box>
  );
}
