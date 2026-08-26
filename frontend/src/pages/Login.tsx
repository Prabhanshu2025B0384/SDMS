import { API_BASE_URL } from "../config";
import { useState, useEffect } from 'react';
import { Box, Card, Typography, TextField, Button, Alert, Stack, InputAdornment, IconButton } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
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

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const token = data.access_token;

        const meRes = await fetch(`${API_BASE_URL}/auth/me`, {
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
        } else {
           setError('Failed to fetch user profile after login.');
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 401) {
            setError(errData.detail || 'Invalid email or password.');
        } else if (response.status === 422) {
            setError('Validation Error: Please check your input format.');
        } else {
            setError(errData.detail || `Login failed (HTTP ${response.status})`);
        }
      }
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        setError('Backend is unreachable or CORS policy blocked the request. Please verify the API URL and backend status.');
      } else {
        setError('An error occurred connecting to the server: ' + (err.message || String(err)));
      }
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.paper' }}>

      {/* Left Side: Illustration / Branding */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: { md: 480, lg: 600, xl: 720 },
          flexShrink: 0,
          p: 5,
          position: 'relative'
        }}
      >
        <Box sx={{ position: 'absolute', top: 40, left: 40, display: 'flex', alignItems: 'center' }}>
          <Box sx={{
            width: 40, height: 40, mr: 1.5,
            bgcolor: 'primary.main',
            borderRadius: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 800, fontSize: 20
          }}>
            S
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }} color="text.primary">Secure DMS</Typography>
        </Box>

        <Box
          component="img"
          src="https://minimals.cc/assets/illustrations/illustration-dashboard.webp"
          alt="login"
          sx={{ width: '100%', maxWidth: 540, opacity: 0.9 }}
          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
        />
      </Box>

      {/* Right Side: Form */}
      <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 2, sm: 5 } }}>
        <Card sx={{ p: { xs: 3, sm: 5 }, width: '100%', maxWidth: 480, boxShadow: { xs: 'none', sm: '0 0 2px 0 rgba(145, 158, 171, 0.2), 0 12px 24px -4px rgba(145, 158, 171, 0.12)' } }}>
          <Stack spacing={2} sx={{ mb: 5 }}>
            <Typography variant="h4">Sign in to Secure DMS</Typography>
          </Stack>

          {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}
          {info && <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>{info}</Alert>}

          <form onSubmit={handleLogin}>
            <Stack spacing={3}>
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
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }
                }}
              />
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', mt: -1 }}>
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  onClick={() => setInfo("Please connect to your Administrator to reset your password.")}
                  sx={{ textDecoration: 'underline', cursor: 'pointer' }}
                >
                  Forgot password?
                </Typography>
              </Box>
              <Button
                fullWidth
                size="large"
                type="submit"
                variant="contained"
                color="primary"
              >
                Sign In
              </Button>
            </Stack>
          </form>
        </Card>
      </Box>
    </Box>
  );
}
