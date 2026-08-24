import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, Button, Avatar, Chip,
  Alert, Divider, CircularProgress, IconButton, Tooltip
} from '@mui/material';
import {
  LockRounded, AccountCircleRounded, ShieldRounded, CloseRounded,
  CheckCircleRounded, BadgeRounded, BusinessRounded
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const CLEARANCE_COLORS: Record<number, 'default' | 'success' | 'warning' | 'error' | 'primary' | 'secondary' | 'info'> = {
  1: 'default',
  2: 'info',
  3: 'warning',
  4: 'error',
  5: 'success'
};

const CLEARANCE_LABELS: Record<number, string> = {
  1: 'Level 1 – Restricted',
  2: 'Level 2 – Confidential',
  3: 'Level 3 – Secret',
  4: 'Level 4 – Top Secret',
  5: 'Level 5 – Executive'
};

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { user, token } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const clearanceLevel = user?.clearance_level || 1;
  const initials = user?.email?.slice(0, 2).toUpperCase() || 'U';

  const handleChangePassword = async () => {
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword) {
      setError('Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }
    if (newPassword.length < 3) {
      setError('New password must be at least 3 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/auth/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Failed to change password.');
      } else {
        setSuccess('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (e: any) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setSuccess('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountCircleRounded color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>My Profile</Typography>
        </Box>
        <IconButton onClick={handleClose} size="small"><CloseRounded /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Profile Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5, bgcolor: 'primary.main', borderRadius: 2, mb: 3, color: 'white' }}>
          <Avatar sx={{ width: 64, height: 64, bgcolor: 'rgba(255,255,255,0.2)', fontSize: 22, fontWeight: 700, border: '2px solid rgba(255,255,255,0.5)' }}>
            {initials}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'inherit' }}>{user?.email?.split('@')[0]}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.8, mb: 0.5 }}>{user?.email}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.9, mb: 1, display: 'block', fontFamily: 'monospace', fontWeight: 600 }}>User ID: {user?.id || '—'}</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label={user?.role || 'Officer'} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 600, fontSize: 11 }} />
              <Chip
                icon={<ShieldRounded sx={{ fontSize: '14px !important', color: 'white !important' }} />}
                label={CLEARANCE_LABELS[clearanceLevel] || `Level ${clearanceLevel}`}
                size="small"
                color={CLEARANCE_COLORS[clearanceLevel] || 'default'}
                sx={{ fontWeight: 700, fontSize: 11 }}
              />
            </Box>
          </Box>
        </Box>

        {/* Profile Info */}
        <Box sx={{ mb: 3, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <BadgeRounded color="primary" fontSize="small" />
            <Box>
              <Typography variant="caption" color="text.secondary">Role</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{user?.role}</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <BusinessRounded color="primary" fontSize="small" />
            <Box>
              <Typography variant="caption" color="text.secondary">Department</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{user?.department || 'General'}</Typography>
            </Box>
          </Box>
        </Box>

        {/* Clearance Level Visual */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(145,158,171,0.08)', borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }} gutterBottom>
            Security Clearance Hierarchy
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
            {[1, 2, 3, 4, 5].map((lvl) => (
              <Tooltip key={lvl} title={CLEARANCE_LABELS[lvl]}>
                <Box sx={{
                  flex: 1, height: 8, borderRadius: 1,
                  bgcolor: lvl <= clearanceLevel ? 'primary.main' : 'divider',
                  opacity: lvl <= clearanceLevel ? (0.4 + 0.15 * lvl) : 0.3,
                  transition: 'all 0.3s'
                }} />
              </Tooltip>
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Your clearance: <strong>{CLEARANCE_LABELS[clearanceLevel]}</strong> — You can access documents classified up to Level {clearanceLevel}.
          </Typography>
        </Box>

        <Divider sx={{ mb: 3 }}>
          <Chip icon={<LockRounded />} label="Change Password" size="small" />
        </Divider>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" icon={<CheckCircleRounded />} sx={{ mb: 2 }}>{success}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            type="password"
            label="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            size="small"
            autoComplete="current-password"
          />
          <TextField
            fullWidth
            type="password"
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            size="small"
            autoComplete="new-password"
          />
          <TextField
            fullWidth
            type="password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            size="small"
            autoComplete="new-password"
            error={confirmPassword !== '' && confirmPassword !== newPassword}
            helperText={confirmPassword !== '' && confirmPassword !== newPassword ? 'Passwords do not match' : ''}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2.5, pt: 0 }}>
        <Button onClick={handleClose} color="inherit">Cancel</Button>
        <Button
          onClick={handleChangePassword}
          variant="contained"
          disabled={loading || !currentPassword || !newPassword || !confirmPassword}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <LockRounded />}
        >
          {loading ? 'Updating...' : 'Update Password'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
