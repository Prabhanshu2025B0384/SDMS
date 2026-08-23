import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import Documents from './pages/Documents';
import Search from './pages/Search';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { 
  Box, 
  Drawer, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Avatar,
  Button
} from '@mui/material';
import {
  FolderRounded,
  SearchRounded,
  NotificationsRounded,
  AdminPanelSettingsRounded,
  LogoutRounded
} from '@mui/icons-material';

const DRAWER_WIDTH = 280;

function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  
  const menuItems = [
    { title: 'Documents', path: '/documents', icon: <FolderRounded /> },
    { title: 'Search', path: '/search', icon: <SearchRounded /> },
  ];

  if (user?.role === 'Admin') {
    menuItems.push({ title: 'Admin Panel', path: '/admin', icon: <AdminPanelSettingsRounded /> });
  }

  return (
    <Box sx={{ width: DRAWER_WIDTH, flexShrink: 0 }}>
      <Drawer
        variant="permanent"
        sx={{
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: '1px dashed rgba(145, 158, 171, 0.24)',
            backgroundColor: 'background.default',
          },
        }}
      >
        <Box sx={{ p: 3, display: 'flex', alignItems: 'center' }}>
          <Box
            component="img"
            src="/vite.svg"
            sx={{ width: 40, height: 40, mr: 2 }}
          />
          <Typography variant="h6" fontWeight="700" color="primary.main">
            Secure DMS
          </Typography>
        </Box>
        
        <Box sx={{ px: 2, pb: 2 }}>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(145, 158, 171, 0.12)', display: 'flex', alignItems: 'center', mb: 3 }}>
            <Avatar sx={{ width: 40, height: 40, mr: 2 }} />
            <Box>
              <Typography variant="subtitle2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                {user?.email.split('@')[0]}
              </Typography>
              <Typography variant="body2" color="text.secondary">{user?.role}</Typography>
            </Box>
          </Box>
        </Box>

        <List sx={{ px: 2, flexGrow: 1 }}>
          {menuItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <ListItem key={item.title} disablePadding sx={{ mb: 1 }}>
                <ListItemButton
                  component={Link}
                  to={item.path}
                  sx={{
                    borderRadius: 2,
                    color: active ? 'primary.main' : 'text.secondary',
                    bgcolor: active ? 'rgba(0, 167, 111, 0.08)' : 'transparent',
                    '&:hover': {
                      bgcolor: active ? 'rgba(0, 167, 111, 0.16)' : 'rgba(145, 158, 171, 0.08)',
                    }
                  }}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    disableTypography
                    primary={
                      <Typography variant="body2" sx={{ fontWeight: active ? 600 : 500 }}>
                        {item.title}
                      </Typography>
                    } 
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        <Box sx={{ p: 2 }}>
          <Button 
            fullWidth 
            color="error" 
            startIcon={<LogoutRounded />} 
            onClick={logout}
          >
            Logout
          </Button>
        </Box>
      </Drawer>
    </Box>
  );
}

function Topbar() {
  return (
    <AppBar position="fixed" sx={{ width: `calc(100% - ${DRAWER_WIDTH}px)`, ml: `${DRAWER_WIDTH}px` }}>
      <Toolbar sx={{ justifyContent: 'flex-end', minHeight: 80 }}>
        <IconButton sx={{ color: 'text.secondary' }}>
          <SearchRounded />
        </IconButton>
        <IconButton sx={{ color: 'text.secondary', ml: 1 }}>
          <NotificationsRounded />
        </IconButton>
        <Avatar sx={{ ml: 2, width: 40, height: 40 }} />
      </Toolbar>
    </AppBar>
  );
}

function AuthenticatedLayout() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <Topbar />
      <Box component="main" sx={{ flexGrow: 1, p: 3, pt: 12, bgcolor: '#ffffff' }}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/documents" element={<Documents />} />
            <Route path="/search" element={<Search />} />
          </Route>
          
          <Route element={<ProtectedRoute requiredRole="Admin" />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Routes>
      </Box>
    </Box>
  );
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/*" element={<AuthenticatedLayout />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
