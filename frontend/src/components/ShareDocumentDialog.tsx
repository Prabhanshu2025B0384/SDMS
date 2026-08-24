import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Chip, Button, Avatar, CircularProgress,
  Checkbox, Alert, List, ListItem,
  ListItemAvatar, ListItemText, ListItemSecondaryAction,
  Select, MenuItem, FormControl, InputLabel, IconButton,
  Divider, Tooltip
} from '@mui/material';
import {
  ShareRounded, CloseRounded, DeleteRounded, PersonAddRounded,
  ShieldRounded, CheckCircleRounded, SearchRounded
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const PERMISSION_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
  VIEW: 'info',
  DOWNLOAD: 'warning',
  EDIT: 'success'
};

interface User {
  id: string;
  public_id?: string;
  email: string;
  role: string;
  clearance_level?: number;
}

interface Permission {
  id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  user_clearance: number;
  permission_type: string;
  created_at: string;
}

interface ShareDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle: string;
  classificationLevel?: number;
}

const CLEARANCE_LABELS: Record<number, string> = {
  1: 'L1 – Restricted',
  2: 'L2 – Confidential',
  3: 'L3 – Secret',
  4: 'L4 – Top Secret',
  5: 'L5 – Executive'
};

export default function ShareDocumentDialog({
  open,
  onClose,
  documentId,
  documentTitle,
  classificationLevel = 1
}: ShareDocumentDialogProps) {
  const { token, user: currentUser } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [permissionType, setPermissionType] = useState<string>('VIEW');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchPermissions = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/documents/${documentId}/permissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPermissions(data);
      }
    } catch (e) {
      console.error('Failed to fetch permissions:', e);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      }
    } catch {
      setAllUsers([]);
    }
  };

  useEffect(() => {
    if (open && documentId && token) {
      setError('');
      setSuccess('');
      setSelectedUsers([]);
      setSearchQuery('');
      setLoading(true);
      Promise.all([fetchPermissions(), fetchUsers()]).finally(() => setLoading(false));
    }
  }, [open, documentId, token]);

  const toggleUser = (uid: string) => {
    setSelectedUsers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleShare = async () => {
    if (selectedUsers.length === 0) {
      setError('Please select at least one user to share with.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/documents/${documentId}/permissions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: selectedUsers, permission_type: permissionType })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Failed to share document.');
      } else {
        setSuccess(`Access granted to ${selectedUsers.length} user(s) with ${permissionType} permission.`);
        setSelectedUsers([]);
        fetchPermissions();
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (userId: string) => {
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/documents/${documentId}/permissions/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setPermissions((prev) => prev.filter((p) => p.user_id !== userId));
      }
    } catch {
      setError('Failed to revoke permission.');
    }
  };

  const existingUserIds = new Set(permissions.map(p => p.user_id));
  const eligibleUsers = allUsers.filter(
    (u) => u.id !== currentUser?.id && !existingUserIds.has(u.id)
  );

  const filteredEligibleUsers = eligibleUsers.filter((u) => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    return (
      u.email.toLowerCase().includes(lowerQuery) ||
      u.id.toLowerCase().includes(lowerQuery) ||
      (u.public_id && u.public_id.toLowerCase().includes(lowerQuery))
    );
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShareRounded color="primary" />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Share Document</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>{documentTitle}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={<ShieldRounded sx={{ fontSize: '14px !important' }} />}
            label={CLEARANCE_LABELS[classificationLevel]}
            size="small"
            color={classificationLevel >= 4 ? 'error' : classificationLevel >= 3 ? 'warning' : 'info'}
          />
          <IconButton onClick={onClose} size="small"><CloseRounded /></IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" icon={<CheckCircleRounded />} sx={{ mb: 2 }}>{success}</Alert>}

        {/* Current Permissions */}
        {permissions.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }} gutterBottom>
              Current Permissions ({permissions.length})
            </Typography>
            <List dense disablePadding sx={{ bgcolor: 'rgba(145,158,171,0.08)', borderRadius: 2 }}>
              {permissions.map((perm, idx) => (
                <ListItem key={perm.id} divider={idx < permissions.length - 1}>
                  <ListItemAvatar>
                    <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: 'primary.main' }}>
                      {perm.user_email.slice(0, 2).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>{perm.user_email}</Typography>}
                    secondary={
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                        <Chip label={perm.user_role} size="small" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
                        <Chip
                          label={perm.permission_type}
                          size="small"
                          color={PERMISSION_COLORS[perm.permission_type] || 'default'}
                          sx={{ fontSize: 10, height: 18, fontWeight: 700 }}
                        />
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Revoke Access">
                      <IconButton size="small" color="error" onClick={() => handleRevoke(perm.user_id)}>
                        <DeleteRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        <Divider sx={{ mb: 2 }}>
          <Chip icon={<PersonAddRounded />} label="Grant Access" size="small" />
        </Divider>

        {/* Permission Type Selector */}
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Permission Level</InputLabel>
          <Select value={permissionType} onChange={(e) => setPermissionType(e.target.value)} label="Permission Level">
            <MenuItem value="VIEW">
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>VIEW</Typography>
                <Typography variant="caption" color="text.secondary">Can open & read the document</Typography>
              </Box>
            </MenuItem>
            <MenuItem value="DOWNLOAD">
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>DOWNLOAD</Typography>
                <Typography variant="caption" color="text.secondary">Can view and download the PDF file</Typography>
              </Box>
            </MenuItem>
            <MenuItem value="EDIT">
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>EDIT</Typography>
                <Typography variant="caption" color="text.secondary">Full access including metadata editing</Typography>
              </Box>
            </MenuItem>
          </Select>
        </FormControl>

        {/* Select Users */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 2 }}>
          <SearchRounded sx={{ color: 'action.active', mr: 1, my: 0.5 }} />
          <FormControl fullWidth>
            <input 
              type="text"
              placeholder="Search users by email, name, or user ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 0',
                border: 'none',
                borderBottom: '1px solid #ccc',
                outline: 'none',
                fontSize: '15px',
                fontFamily: 'inherit',
                backgroundColor: 'transparent'
              }}
            />
          </FormControl>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={32} />
          </Box>
        ) : eligibleUsers.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            All available users already have access to this document.
          </Typography>
        ) : filteredEligibleUsers.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            No users found matching your search.
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 220, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            {filteredEligibleUsers.map((u) => (
              <Box
                key={u.id}
                sx={{
                  display: 'flex', alignItems: 'center', px: 1.5, py: 1,
                  cursor: 'pointer', borderBottom: '1px solid', borderColor: 'divider',
                  '&:last-child': { borderBottom: 'none' },
                  bgcolor: selectedUsers.includes(u.id) ? 'rgba(0,167,111,0.06)' : 'transparent',
                  transition: 'background 0.15s'
                }}
                onClick={() => toggleUser(u.id)}
              >
                <Checkbox
                  checked={selectedUsers.includes(u.id)}
                  size="small"
                  sx={{ mr: 1 }}
                />
                <Avatar sx={{ width: 28, height: 28, mr: 1.5, fontSize: 11, bgcolor: selectedUsers.includes(u.id) ? 'primary.main' : 'text.secondary' }}>
                  {u.email.slice(0, 2).toUpperCase()}
                </Avatar>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{u.email}</Typography>
                  <Typography variant="caption" color="text.secondary">{u.role}</Typography>
                </Box>
                <Chip
                  label={CLEARANCE_LABELS[u.clearance_level || 1]}
                  size="small"
                  sx={{ fontSize: 10, height: 18 }}
                />
              </Box>
            ))}
          </Box>
        )}

        {selectedUsers.length > 0 && (
          <Typography variant="caption" color="primary.main" sx={{ mt: 1, display: 'block' }}>
            {selectedUsers.length} user(s) selected
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button
          onClick={handleShare}
          variant="contained"
          disabled={submitting || selectedUsers.length === 0}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <ShareRounded />}
        >
          {submitting ? 'Sharing...' : `Share with ${selectedUsers.length || ''} user${selectedUsers.length !== 1 ? 's' : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
