import { useState } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import Documents from './pages/Documents';
import Search from './pages/Search';
import SharedDocuments from './pages/SharedDocuments';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import PendingReviews from './pages/PendingReviews';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ProfileModal from './components/ProfileModal';
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
  Button,
  Chip,
  Tooltip,
  Menu,
  MenuItem,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  FolderRounded,
  FolderSharedRounded,
  SearchRounded,
  NotificationsRounded,
  AdminPanelSettingsRounded,
  LogoutRounded,
  ShieldRounded,
  AccountCircleRounded,
  PendingActionsRounded,
  DescriptionRounded
} from '@mui/icons-material';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const DRAWER_WIDTH = 280;

const CLEARANCE_COLORS: Record<number, 'default' | 'success' | 'warning' | 'error' | 'primary' | 'secondary' | 'info'> = {
  1: 'default', 2: 'info', 3: 'warning', 4: 'error', 5: 'success'
};
const CLEARANCE_SHORT: Record<number, string> = {
  1: 'L1', 2: 'L2', 3: 'L3', 4: 'L4', 5: 'L5-EXEC'
};

function Sidebar({ mobileOpen, onClose, onProfileClick }: { mobileOpen: boolean; onClose: () => void; onProfileClick: () => void }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const menuItems = [
    { title: 'Documents', path: '/documents', icon: <FolderRounded /> },
    { title: 'Shared Documents', path: '/shared-documents', icon: <FolderSharedRounded /> },
    { title: 'Search', path: '/search', icon: <SearchRounded /> },
    { title: 'Pending Reviews', path: '/pending-reviews', icon: <PendingActionsRounded /> },
  ];

  if (user?.role === 'Admin') {
    menuItems.push({ title: 'Admin Panel', path: '/admin', icon: <AdminPanelSettingsRounded /> });
  }

  const clearanceLevel = user?.clearance_level || 1;

  const drawerContent = (
    <>
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center' }}>
        <Box sx={{
          width: 32, height: 32, mr: 1.5,
          bgcolor: 'primary.main',
          borderRadius: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 800, fontSize: 16
        }}>
          S
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }} color="text.primary">Secure DMS</Typography>
      </Box>

      <Box sx={{ px: 2, pb: 2 }}>
        <Box
          sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(145, 158, 171, 0.12)', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(145,158,171,0.2)' }, transition: 'background 0.2s' }}
          onClick={onProfileClick}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Avatar sx={{ width: 40, height: 40, mr: 2, bgcolor: 'primary.main', fontSize: 14, fontWeight: 700 }}>
              {user?.email?.slice(0, 2).toUpperCase() || 'U'}
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                {user?.email?.split('@')[0]}
              </Typography>
              <Typography variant="body2" color="text.secondary">{user?.role}</Typography>
            </Box>
            <AccountCircleRounded sx={{ fontSize: 18, color: 'text.disabled' }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Chip
              icon={<ShieldRounded sx={{ fontSize: '12px !important' }} />}
              label={CLEARANCE_SHORT[clearanceLevel] || 'L1'}
              size="small"
              color={CLEARANCE_COLORS[clearanceLevel]}
              sx={{ fontSize: 10, height: 20 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
              Click to view profile
            </Typography>
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
                onClick={onClose}
                sx={{
                  borderRadius: 2,
                  color: active ? 'primary.main' : 'text.secondary',
                  bgcolor: active ? 'rgba(0, 167, 111, 0.08)' : 'transparent',
                  '&:hover': {
                    bgcolor: active ? 'rgba(0, 167, 111, 0.16)' : 'rgba(145, 158, 171, 0.08)',
                  }
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText
                  disableTypography
                  primary={<Typography variant="body2" sx={{ fontWeight: active ? 600 : 500 }}>{item.title}</Typography>}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ p: 2 }}>
        <Button fullWidth color="error" startIcon={<LogoutRounded />} onClick={logout}>
          Logout
        </Button>
      </Box>
    </>
  );

  return (
    <Box sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, backgroundColor: 'background.default' },
        }}
      >
        {drawerContent}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', borderRight: '1px dashed rgba(145, 158, 171, 0.24)', backgroundColor: 'background.default' },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
}

function Topbar({ onMenuClick, onProfileClick }: { onMenuClick: () => void; onProfileClick: () => void }) {
  const { user, token } = useAuth();
  const clearanceLevel = user?.clearance_level || 1;
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const handleClearNotifications = async () => {
    try {
      await fetch(`http://${window.location.hostname}:8000/notifications/all`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications([]);
      setClearDialogOpen(false);
      setAnchorEl(null);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user && token) {
      fetch(`http://${window.location.hostname}:8000/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setNotifications(data))
      .catch(console.error);
    }
  }, [user, token]);

  const handleNotificationClick = async (notif: any) => {
    try {
      await fetch(`http://${window.location.hostname}:8000/notifications/${notif.id}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
      setAnchorEl(null);
      if (notif.link) {
        navigate(notif.link);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AppBar position="fixed" sx={{ width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, ml: { md: `${DRAWER_WIDTH}px` } }}>
      <Toolbar sx={{ minHeight: 80, px: { xs: 2, md: 5 } }}>
        <IconButton
          color="inherit"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2, display: { md: 'none' }, color: 'text.primary' }}
        >
          <Box component="span" sx={{ fontSize: 24 }}>☰</Box>
        </IconButton>
        <Box sx={{ flexGrow: 1 }} />
        <Chip
          icon={<ShieldRounded sx={{ fontSize: '14px !important' }} />}
          label={`Clearance ${CLEARANCE_SHORT[clearanceLevel]}`}
          size="small"
          color={CLEARANCE_COLORS[clearanceLevel]}
          sx={{ mr: 2, fontWeight: 700 }}
        />
        <IconButton sx={{ color: 'text.secondary' }} onClick={(e) => setAnchorEl(e.currentTarget)}>
          <Badge badgeContent={notifications.length} color="error">
            <NotificationsRounded />
          </Badge>
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          sx={{
            '& .MuiPaper-root': {
              width: 360,
              mt: 1.5,
              borderRadius: 3,
              border: '1px solid rgba(145, 158, 171, 0.16)',
              overflow: 'hidden'
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: '1px solid rgba(145, 158, 171, 0.16)' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Notifications
              {notifications.length > 0 && (
                <Chip label={notifications.length} size="small" color="primary" sx={{ ml: 1, height: 20, fontSize: 11, fontWeight: 700 }} />
              )}
            </Typography>
            {notifications.length > 0 && (
              <Button size="small" sx={{ fontSize: 12, fontWeight: 600 }} onClick={() => { setClearDialogOpen(true); setAnchorEl(null); }}>
                Clear notifications
              </Button>
            )}
          </Box>
          
          <Box sx={{ maxHeight: 400, overflowY: 'auto', p: 1 }}>
            {notifications.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <NotificationsRounded sx={{ fontSize: 48, color: 'text.disabled', mb: 1, opacity: 0.5 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>No notifications</Typography>
                <Typography variant="body2" color="text.secondary">You're all caught up.</Typography>
              </Box>
            ) : (
              notifications.map(n => {
                let sender = "";
                let isShare = n.message.includes("You received");
                if (isShare) {
                  const parts = n.message.split(" from ");
                  if (parts.length > 1) sender = parts[1].replace(".", "");
                }
                
                return (
                  <MenuItem 
                    key={n.id} 
                    onClick={() => handleNotificationClick(n)} 
                    sx={{ 
                      whiteSpace: 'normal', 
                      borderRadius: 2, 
                      p: 1.5, 
                      mb: 0.5,
                      alignItems: 'flex-start',
                      gap: 2,
                      bgcolor: 'rgba(0, 167, 111, 0.04)',
                      '&:hover': { bgcolor: 'rgba(0, 167, 111, 0.08)' }
                    }}
                  >
                    <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main', color: '#fff', flexShrink: 0 }}>
                      <DescriptionRounded fontSize="small" />
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {isShare ? "Document Access Granted" : "Notification"}
                      </Typography>
                      <Typography variant="body2" color="text.primary" sx={{ display: 'block', mb: 0.5 }}>
                        {n.message.split(" from ")[0]}
                      </Typography>
                      {sender && (
                        <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          from {sender}
                        </Typography>
                      )}
                      {n.created_at && (
                        <Typography variant="caption" color="text.disabled">
                          {new Date(n.created_at).toLocaleString()}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', mt: 1, flexShrink: 0 }} />
                  </MenuItem>
                );
              })
            )}
          </Box>
        </Menu>

        <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>Clear all notifications?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              This will remove all notifications from your notification list.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2, pt: 0 }}>
            <Button onClick={() => setClearDialogOpen(false)} color="inherit">Cancel</Button>
            <Button onClick={handleClearNotifications} variant="contained" color="error">Clear notifications</Button>
          </DialogActions>
        </Dialog>

        <Tooltip title="My Profile & Password">
          <IconButton sx={{ ml: 1 }} onClick={onProfileClick}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 13, fontWeight: 700 }}>
              {user?.email?.slice(0, 2).toUpperCase() || 'U'}
            </Avatar>
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}

function AuthenticatedLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onProfileClick={() => setProfileOpen(true)} />
      <Topbar onMenuClick={handleDrawerToggle} onProfileClick={() => setProfileOpen(true)} />
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, pt: { xs: 10, md: 12 }, width: { xs: '100%', md: `calc(100% - ${DRAWER_WIDTH}px)` } }}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/documents" element={<Documents />} />
            <Route path="/shared-documents" element={<SharedDocuments />} />
            <Route path="/search" element={<Search />} />
            <Route path="/pending-reviews" element={<PendingReviews />} />
          </Route>

          <Route element={<ProtectedRoute requiredRole="Admin" />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Routes>
      </Box>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
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
