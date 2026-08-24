import { useState, useEffect } from 'react';
import {
  Box, Card, Typography, Tabs, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, IconButton, Chip,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Avatar, Tooltip, LinearProgress
} from '@mui/material';
import {
  DeleteRounded, EditRounded, VerifiedUserRounded, AdminPanelSettingsRounded,
  PersonAddRounded, ShieldRounded, VisibilityRounded, GetAppRounded,
  UploadFileRounded, LoginRounded, ShareRounded, PeopleRounded,
  RefreshRounded, SecurityRounded, TimelineRounded
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const ROLES = ['Investigating Officer', 'Senior Officer', 'Prosecutor', 'Admin'];
const CLEARANCE_LEVELS = [1, 2, 3, 4, 5];
const CLEARANCE_LABELS: Record<number, string> = {
  1: 'L1 – Restricted',
  2: 'L2 – Confidential',
  3: 'L3 – Secret',
  4: 'L4 – Top Secret',
  5: 'L5 – Executive'
};
const CLEARANCE_COLORS: Record<number, 'default' | 'info' | 'warning' | 'error' | 'success'> = {
  1: 'default', 2: 'info', 3: 'warning', 4: 'error', 5: 'success'
};
const ACTION_ICON: Record<string, any> = {
  VIEW: <VisibilityRounded sx={{ fontSize: 16 }} />,
  DOWNLOAD: <GetAppRounded sx={{ fontSize: 16 }} />,
  UPLOAD: <UploadFileRounded sx={{ fontSize: 16 }} />,
  LOGIN: <LoginRounded sx={{ fontSize: 16 }} />,
  SHARE: <ShareRounded sx={{ fontSize: 16 }} />,
  PASSWORD_CHANGE: <ShieldRounded sx={{ fontSize: 16 }} />
};
const ACTION_COLOR: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error' | 'primary' | 'secondary'> = {
  VIEW: 'info', DOWNLOAD: 'warning', UPLOAD: 'success', LOGIN: 'default',
  SHARE: 'primary', PASSWORD_CHANGE: 'secondary'
};

function TabPanel(props: { children?: React.ReactNode; index: number; value: number }) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: any; color: string }) {
  return (
    <Card sx={{ p: 2, flex: 1, minWidth: 100, display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
        {icon}
      </Box>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
      </Box>
    </Card>
  );
}

export default function AdminDashboard() {
  const [tabValue, setTabValue] = useState(0);
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cases, setCases] = useState<any[]>([]);
  const [auditData, setAuditData] = useState<{ summary: any; logs: any[] }>({ summary: {}, logs: [] });
  const [loading, setLoading] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');

  // Add User
  const [openAddUser, setOpenAddUser] = useState(false);
  const [submittingUser, setSubmittingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    email: '', password: '', full_name: '', role: 'Investigating Officer',
    department: 'General', clearance_level: 1
  });

  // Edit User
  const [openEditUser, setOpenEditUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    email: '', password: '', department: '', role: 'Investigating Officer',
    clearance_level: 1, is_active: true
  });

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: 'user' | 'case' | null; id: string | null; dependencies?: any }>({
    open: false, type: null, id: null
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // Case assignment
  const [openAssignModal, setOpenAssignModal] = useState(false);
  const [selectedCaseForAssign, setSelectedCaseForAssign] = useState<any | null>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [assigningOfficer, setAssigningOfficer] = useState(false);

  const { token } = useAuth();
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const confirmDelete = (type: 'user' | 'case', id: string) => {
    setDeleteConfirm({ open: true, type, id });
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const url = searchQuery 
        ? `http://${window.location.hostname}:8000/admin/users?search=${encodeURIComponent(searchQuery)}`
        : `http://${window.location.hostname}:8000/admin/users`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setUsers(await res.json());
    } finally { setLoading(false); }
  };

  const fetchCases = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/admin/cases`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setCases(await res.json());
    } finally { setLoading(false); }
  };

  const fetchAuditLogs = async (action = auditActionFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (action && action !== 'ALL') params.set('action', action);
      const res = await fetch(`http://${window.location.hostname}:8000/admin/audit-logs?${params}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setAuditData(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  useEffect(() => {
    fetchCases();
    fetchAuditLogs();
  }, []);

  const handleAddUser = async () => {
    setSubmittingUser(true);
    try {
      const queryParams = new URLSearchParams({
        email: newUserForm.email,
        password: newUserForm.password,
        full_name: newUserForm.full_name,
        role: newUserForm.role,
        department: newUserForm.department,
        clearance_level: String(newUserForm.clearance_level)
      });
      const res = await fetch(`http://${window.location.hostname}:8000/auth/signup?${queryParams}`, { method: 'POST' });
      if (res.ok) {
        setOpenAddUser(false);
        setNewUserForm({ email: '', password: '', full_name: '', role: 'Investigating Officer', department: 'General', clearance_level: 1 });
        fetchUsers();
      } else {
        const data = await res.json();
        alert(`Failed to add user: ${data.detail}`);
      }
    } catch (e) { alert('Error adding user.'); }
    finally { setSubmittingUser(false); }
  };

  const handleUpdateUser = async () => {
    if (!editingUserId) return;
    setSubmittingUser(true);
    try {
      const payload: any = { ...editUserForm };
      if (!payload.password) delete payload.password;
      const res = await fetch(`http://${window.location.hostname}:8000/admin/users/${editingUserId}`, {
        method: 'PATCH', headers, body: JSON.stringify(payload)
      });
      if (res.ok) {
        setOpenEditUser(false);
        fetchUsers();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Failed to update: ${data.detail || 'Error'}`);
      }
    } catch (e) { alert('Error updating user.'); }
    finally { setSubmittingUser(false); }
  };

  const executeDelete = async () => {
    setIsDeleting(true);
    try {
      const url = deleteConfirm.type === 'user'
        ? `http://${window.location.hostname}:8000/admin/users/${deleteConfirm.id}`
        : `http://${window.location.hostname}:8000/admin/cases/${deleteConfirm.id}`;
      const res = await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        deleteConfirm.type === 'user' ? fetchUsers() : fetchCases();
        setDeleteConfirm({ open: false, type: null, id: null });
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Failed to delete: ${data.detail || 'Unknown error'}`);
        setDeleteConfirm({ open: false, type: null, id: null });
      }
    } catch (e) { alert('Network error during deletion.'); setDeleteConfirm({ open: false, type: null, id: null }); }
    finally { setIsDeleting(false); }
  };

  const handleToggleUserStatus = async (user: any) => {
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/admin/users/${user.id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ is_active: !user.is_active })
      });
      if (res.ok) fetchUsers();
    } catch (e) { alert('Error toggling user status.'); }
  };

  const handleAssignCase = async () => {
    if (!selectedCaseForAssign || !selectedOfficerId) return;
    setAssigningOfficer(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/cases/${selectedCaseForAssign.id}/reassign`, {
        method: 'PATCH', headers, body: JSON.stringify({ officer_id: selectedOfficerId })
      });
      if (res.ok) { setOpenAssignModal(false); fetchCases(); }
      else { const err = await res.json().catch(() => ({})); alert(`Failed: ${err.detail || 'Error'}`); }
    } catch (e: any) { alert(`Network error: ${e.message}`); }
    finally { setAssigningOfficer(false); }
  };

  const openEditDialog = (user: any) => {
    setEditingUserId(user.id);
    setEditUserForm({
      email: user.email,
      password: '',
      department: user.department || 'General',
      role: user.role,
      clearance_level: user.clearance_level || 1,
      is_active: user.is_active
    });
    setOpenEditUser(true);
  };

  const summary = auditData.summary || {};

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: 'error.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AdminPanelSettingsRounded sx={{ color: 'white' }} />
        </Box>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Admin Control Panel</Typography>
          <Typography variant="body2" color="text.secondary">System-wide user management, hierarchy control, and security audit intelligence</Typography>
        </Box>
      </Box>

      {/* Hierarchy Level Guide */}
      <Card sx={{ p: 2.5, mb: 3, background: 'linear-gradient(135deg, rgba(0,167,111,0.08), rgba(0,120,255,0.08))' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <SecurityRounded color="primary" fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Organizational Clearance Hierarchy</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {CLEARANCE_LEVELS.map((lvl) => (
            <Chip
              key={lvl}
              icon={<ShieldRounded />}
              label={CLEARANCE_LABELS[lvl]}
              color={CLEARANCE_COLORS[lvl]}
              variant="outlined"
              size="small"
              sx={{ fontWeight: 600 }}
            />
          ))}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Users can access documents up to their clearance level. Explicitly shared documents override hierarchy rules.
        </Typography>
      </Card>

      <Card sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ px: 2 }}>
            <Tab icon={<PeopleRounded />} iconPosition="start" label="User & Hierarchy" />
            <Tab icon={<VerifiedUserRounded />} iconPosition="start" label="Global Cases" />
            <Tab icon={<TimelineRounded />} iconPosition="start" label="Audit Intelligence" />
          </Tabs>
        </Box>

        {loading && <LinearProgress />}

        {/* ─── TAB 0: USERS & HIERARCHY ─────────────── */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ px: 3, pb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, flexShrink: 0 }}>User Management & Clearance Levels</Typography>
              <Box sx={{ display: 'flex', gap: 1, flex: 1, justifyContent: 'flex-end' }}>
                <TextField 
                  size="small" 
                  placeholder="Search users..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  sx={{ width: 250 }}
                />
                <Button variant="outlined" startIcon={<RefreshRounded />} onClick={fetchUsers}>Refresh</Button>
                <Button variant="contained" startIcon={<PersonAddRounded />} onClick={() => setOpenAddUser(true)}>Add User</Button>
              </Box>
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>User ID</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Department</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Clearance Level</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                          {u.id || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 32, height: 32, fontSize: 12, bgcolor: 'primary.main' }}>
                            {u.email?.slice(0, 2).toUpperCase()}
                          </Avatar>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{u.email}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{u.department || 'General'}</Typography></TableCell>
                      <TableCell><Chip label={u.role} size="small" variant="outlined" /></TableCell>
                      <TableCell>
                        <Chip
                          icon={<ShieldRounded sx={{ fontSize: '14px !important' }} />}
                          label={u.clearance_label || CLEARANCE_LABELS[u.clearance_level || 1]}
                          size="small"
                          color={CLEARANCE_COLORS[u.clearance_level || 1]}
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={u.is_active ? 'Active' : 'Disabled'}
                          color={u.is_active ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit user & clearance">
                          <IconButton size="small" color="primary" onClick={() => openEditDialog(u)}>
                            <EditRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {!u.is_active && (
                          <Tooltip title="Enable User">
                            <Button size="small" variant="text" color="success" onClick={() => handleToggleUserStatus(u)}>
                              Enable
                            </Button>
                          </Tooltip>
                        )}
                        {u.is_active && (
                          <Tooltip title="Disable User">
                            <Button size="small" variant="text" color="warning" onClick={() => handleToggleUserStatus(u)}>
                              Disable
                            </Button>
                          </Tooltip>
                        )}
                        <Tooltip title="Permanently Delete User">
                          <IconButton size="small" color="error" onClick={() => confirmDelete('user', u.id)}>
                            <DeleteRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && <TableRow><TableCell colSpan={7} align="center">No users found</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </TabPanel>

        {/* ─── TAB 1: GLOBAL CASES ─────────────────── */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ px: 3, pb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Global Case Control</Typography>
              <Button variant="outlined" startIcon={<RefreshRounded />} onClick={fetchCases}>Refresh</Button>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Case Number</TableCell>
                    <TableCell>Jurisdiction</TableCell>
                    <TableCell>Assigned Officer</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cases.map((c) => (
                    <TableRow key={c.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{c.case_number}</TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary">{c.jurisdiction}</Typography></TableCell>
                      <TableCell>
                        <Chip
                          icon={<VerifiedUserRounded sx={{ fontSize: '16px !important' }} />}
                          label={c.owning_officer_email || 'Unassigned'}
                          size="small" color="primary" variant="outlined"
                        />
                      </TableCell>
                      <TableCell><Chip label={c.status} size="small" color="info" /></TableCell>
                      <TableCell align="right">
                        <Button size="small" variant="outlined" color="primary" sx={{ mr: 1 }}
                          onClick={() => { setSelectedCaseForAssign(c); setSelectedOfficerId(c.owning_officer_id || ''); setOpenAssignModal(true); }}>
                          Assign / Transfer
                        </Button>
                        <Button size="small" color="error" startIcon={<DeleteRounded />} onClick={() => confirmDelete('case', c.id)}>Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cases.length === 0 && <TableRow><TableCell colSpan={5} align="center">No cases found</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Assign Modal */}
            <Dialog open={openAssignModal} onClose={() => setOpenAssignModal(false)} maxWidth="xs" fullWidth>
              <DialogTitle sx={{ fontWeight: 700 }}>Assign Case to Officer</DialogTitle>
              <DialogContent dividers>
                <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="subtitle2">
                    Case: <strong>{selectedCaseForAssign?.case_number}</strong> ({selectedCaseForAssign?.jurisdiction})
                  </Typography>
                  <TextField select fullWidth label="Select Officer" value={selectedOfficerId} onChange={(e) => setSelectedOfficerId(e.target.value)}>
                    {users.map((u) => (
                      <MenuItem key={u.id} value={u.id}>{u.email} — {u.role}</MenuItem>
                    ))}
                  </TextField>
                </Box>
              </DialogContent>
              <DialogActions sx={{ p: 2 }}>
                <Button onClick={() => setOpenAssignModal(false)} color="inherit">Cancel</Button>
                <Button onClick={handleAssignCase} variant="contained" disabled={!selectedOfficerId || assigningOfficer}>
                  {assigningOfficer ? <CircularProgress size={20} /> : 'Save'}
                </Button>
              </DialogActions>
            </Dialog>
          </Box>
        </TabPanel>

        {/* ─── TAB 2: AUDIT INTELLIGENCE ───────────── */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ px: 3, pb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Audit Intelligence & Access Logs</Typography>

            {/* Summary Cards */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <StatCard label="Total Records" value={summary.total || 0} icon={<TimelineRounded />} color="#00a76f" />
              <StatCard label="Views" value={summary.views || 0} icon={<VisibilityRounded />} color="#2196f3" />
              <StatCard label="Downloads" value={summary.downloads || 0} icon={<GetAppRounded />} color="#ff9800" />
              <StatCard label="Uploads" value={summary.uploads || 0} icon={<UploadFileRounded />} color="#9c27b0" />
              <StatCard label="Unique Users" value={summary.unique_users || 0} icon={<PeopleRounded />} color="#f44336" />
              <StatCard label="Logins" value={summary.logins || 0} icon={<LoginRounded />} color="#00bcd4" />
            </Box>

            {/* Filter */}
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="subtitle2">Filter by action:</Typography>
              {['ALL', 'VIEW', 'DOWNLOAD', 'UPLOAD', 'LOGIN', 'SHARE', 'PASSWORD_CHANGE'].map((a) => (
                <Chip
                  key={a}
                  label={a}
                  size="small"
                  onClick={() => { setAuditActionFilter(a); fetchAuditLogs(a); }}
                  color={auditActionFilter === a ? (ACTION_COLOR[a] || 'primary') : 'default'}
                  variant={auditActionFilter === a ? 'filled' : 'outlined'}
                  sx={{ cursor: 'pointer', fontWeight: auditActionFilter === a ? 700 : 400 }}
                />
              ))}
              <Button size="small" startIcon={<RefreshRounded />} variant="outlined" onClick={() => fetchAuditLogs(auditActionFilter)}>Refresh</Button>
            </Box>

            {/* Logs Table */}
            <TableContainer sx={{ maxHeight: 480 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Clearance</TableCell>
                    <TableCell>Document</TableCell>
                    <TableCell>Result</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(auditData.logs || []).map((log) => (
                    <TableRow key={log.id} hover>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={ACTION_ICON[log.action] || undefined}
                          label={log.action}
                          size="small"
                          color={ACTION_COLOR[log.action] || 'default'}
                          sx={{ fontWeight: 700, fontSize: 10 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 20, height: 20, fontSize: 9, bgcolor: 'primary.main' }}>
                            {(log.user_email || 'S').slice(0, 1).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 600, maxWidth: 120, display: 'block' }} noWrap>
                              {log.user_email || 'System'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                              {log.user_role || ''}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {log.user_clearance ? (
                          <Chip
                            label={`L${log.user_clearance}`}
                            size="small"
                            color={CLEARANCE_COLORS[log.user_clearance] || 'default'}
                            sx={{ fontSize: 10, height: 18 }}
                          />
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" noWrap sx={{ maxWidth: 140, display: 'block' }}>
                          {log.document_title || (log.document_id ? log.document_id.slice(0, 8) + '...' : '—')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={log.result} size="small" color={log.result === 'SUCCESS' ? 'success' : 'error'} sx={{ fontSize: 10, height: 18 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {(auditData.logs || []).length === 0 && (
                    <TableRow><TableCell colSpan={6} align="center">No audit records found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </TabPanel>
      </Card>

      {/* ─── ADD USER DIALOG ─────────────────────────── */}
      <Dialog open={openAddUser} onClose={() => setOpenAddUser(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add New User</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField fullWidth label="Email" value={newUserForm.email} onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })} size="small" />
            <TextField fullWidth label="Password" type="password" value={newUserForm.password} onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })} size="small" />
            <TextField fullWidth label="Full Name" value={newUserForm.full_name} onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })} size="small" />
            <TextField fullWidth label="Department" value={newUserForm.department} onChange={(e) => setNewUserForm({ ...newUserForm, department: e.target.value })} size="small" />
            <TextField select fullWidth label="Role" value={newUserForm.role} onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })} size="small">
              {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>
            <TextField select fullWidth label="Clearance Level" value={newUserForm.clearance_level} onChange={(e) => setNewUserForm({ ...newUserForm, clearance_level: Number(e.target.value) })} size="small">
              {CLEARANCE_LEVELS.map((lvl) => (
                <MenuItem key={lvl} value={lvl}>
                  <Chip label={CLEARANCE_LABELS[lvl]} size="small" color={CLEARANCE_COLORS[lvl]} sx={{ mr: 1 }} /> {CLEARANCE_LABELS[lvl]}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenAddUser(false)} color="inherit">Cancel</Button>
          <Button onClick={handleAddUser} variant="contained" disabled={!newUserForm.email || !newUserForm.password || submittingUser}>
            {submittingUser ? <CircularProgress size={20} /> : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── EDIT USER DIALOG ───────────────────────── */}
      <Dialog open={openEditUser} onClose={() => setOpenEditUser(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit User & Clearance</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField fullWidth label="Email" value={editUserForm.email} onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })} size="small" />
            <TextField fullWidth label="New Password (leave blank to keep)" type="password" value={editUserForm.password} onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })} size="small" />
            <TextField fullWidth label="Department" value={editUserForm.department} onChange={(e) => setEditUserForm({ ...editUserForm, department: e.target.value })} size="small" />
            <TextField select fullWidth label="Role" value={editUserForm.role} onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })} size="small">
              {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>
            <TextField select fullWidth label="Clearance Level" value={editUserForm.clearance_level} onChange={(e) => setEditUserForm({ ...editUserForm, clearance_level: Number(e.target.value) })} size="small">
              {CLEARANCE_LEVELS.map((lvl) => (
                <MenuItem key={lvl} value={lvl}>{CLEARANCE_LABELS[lvl]}</MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenEditUser(false)} color="inherit">Cancel</Button>
          <Button onClick={handleUpdateUser} variant="contained" disabled={submittingUser}>
            {submittingUser ? <CircularProgress size={20} /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── DELETE CONFIRM DIALOG ─────────────────── */}
      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, type: null, id: null })} maxWidth="xs" fullWidth>
        <DialogTitle>{deleteConfirm.type === 'user' ? 'Permanently Delete User' : 'Confirm Deletion'}</DialogTitle>
        <DialogContent dividers>
          {deleteConfirm.type === 'user' ? (
            <Typography>
              This action cannot be undone.<br /><br />
              The user's account will be permanently removed, but historical cases, documents, permissions, and audit records will be preserved.<br /><br />
              Are you sure?
            </Typography>
          ) : (
            <Typography>
              Are you sure you want to permanently delete this {deleteConfirm.type}? This action cannot be undone and may affect associated records.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirm({ open: false, type: null, id: null })} color="inherit" disabled={isDeleting}>Cancel</Button>
          <Button onClick={executeDelete} variant="contained" color="error" disabled={isDeleting}>
            {isDeleting ? <CircularProgress size={24} color="inherit" /> : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
