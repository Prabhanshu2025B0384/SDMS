import { useState, useEffect } from 'react';
import { Box, Card, Typography, TextField, Button, Alert, Stack, InputAdornment, IconButton, useTheme } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

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
          <Typography variant="h6" fontWeight="700" color="text.primary">Secure DMS</Typography>
        </Box>

        <Box
          component="img"
          src="https://minimals.cc/assets/illustrations/illustration-dashboard.webp"
          alt="login"
          sx={{ width: '100%', maxWidth: 540, opacity: 0.9 }}
          onError={(e) => e.currentTarget.style.display = 'none'}
        />
      </Box>

      {/* Right Side: Form */}
      <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 2, sm: 5 } }}>
        <Card sx={{ p: { xs: 3, sm: 5 }, width: '100%', maxWidth: 480, boxShadow: { xs: 'none', sm: theme.components?.MuiCard?.styleOverrides?.root?.boxShadow } }}>
          <Stack spacing={2} sx={{ mb: 5 }}>
            <Typography variant="h4">Sign in to Secure DMS</Typography>
          </Stack>

          {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

          <form onSubmit={handleLogin}>
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Stack direction="row" alignItems="center" justifyContent="flex-end" sx={{ mt: -1 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  onClick={() => alert("Connect to Admin")}
                  sx={{ textDecoration: 'underline', cursor: 'pointer' }}
                >
                  Forgot password?
                </Typography>
              </Stack>
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
