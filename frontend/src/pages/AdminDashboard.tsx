import { useState, useEffect } from 'react';
import { 
  Box, 
  Card, 
  Typography, 
  Tabs, 
  Tab, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Button,
  IconButton,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Breadcrumbs,
  MenuItem
} from '@mui/material';
import { DeleteRounded, EditRounded, VerifiedUserRounded, AdminPanelSettingsRounded } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

function TabPanel(props: { children?: React.ReactNode; index: number; value: number }) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function AdminDashboard() {
  const [tabValue, setTabValue] = useState(0);
  const [users, setUsers] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [openAddUser, setOpenAddUser] = useState(false);
  const [submittingUser, setSubmittingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'Investigating Officer'
  });
  
  const [openEditUser, setOpenEditUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    email: '',
    password: '',
    department: '',
    role: 'Investigating Officer',
    is_active: true
  });
  
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: 'user' | 'case' | null; id: string | null }>({
    open: false, type: null, id: null
  });
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [openAssignModal, setOpenAssignModal] = useState(false);
  const [selectedCaseForAssign, setSelectedCaseForAssign] = useState<any | null>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [assigningOfficer, setAssigningOfficer] = useState(false);

  const { token } = useAuth();

  const confirmDelete = (type: 'user' | 'case', id: string) => {
    setDeleteConfirm({ open: true, type, id });
  };

  const handleAssignCase = async () => {
    if (!selectedCaseForAssign || !selectedOfficerId) return;
    setAssigningOfficer(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/cases/${selectedCaseForAssign.id}/reassign`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ officer_id: selectedOfficerId })
      });
      if (res.ok) {
        setOpenAssignModal(false);
        fetchCases();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to assign case: ${err.detail || 'Unknown error'}`);
      }
    } catch (e: any) {
      alert(`Network error assigning case: ${e.message || e}`);
    } finally {
      setAssigningOfficer(false);
    }
  };


  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } });
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

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/admin/audit-logs`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setAuditLogs(await res.json());
    } finally { setLoading(false); }
  };

  const handleAddUser = async () => {
    setSubmittingUser(true);
    try {
      const queryParams = new URLSearchParams({
        email: newUserForm.email,
        password: newUserForm.password,
        full_name: newUserForm.full_name,
        role: newUserForm.role
      });
      const res = await fetch(`http://${window.location.hostname}:8000/auth/signup?${queryParams.toString()}`, {
        method: 'POST',
      });
      
      if (res.ok) {
        setOpenAddUser(false);
        setNewUserForm({ email: '', password: '', full_name: '', role: 'Investigating Officer' });
        fetchUsers();
      } else {
        const data = await res.json();
        alert(`Failed to add user: ${data.detail}`);
      }
    } catch (e) {
      alert("Error adding user.");
    } finally {
      setSubmittingUser(false);
    }
  };

  const executeDelete = async () => {
    setIsDeleting(true);
    try {
      if (deleteConfirm.type === 'user') {
        const res = await fetch(`http://${window.location.hostname}:8000/admin/users/${deleteConfirm.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          fetchUsers();
        } else {
          const data = await res.json().catch(() => ({}));
          alert(`Failed to delete user: ${data.detail || 'Unknown error'}`);
        }
      } else if (deleteConfirm.type === 'case') {
        const res = await fetch(`http://${window.location.hostname}:8000/admin/cases/${deleteConfirm.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          fetchCases();
        } else {
          const data = await res.json().catch(() => ({}));
          alert(`Failed to delete case: ${data.detail || 'Unknown error'}`);
        }
      }
      setDeleteConfirm({ open: false, type: null, id: null });
    } catch(e) {
      alert("Network error occurred during deletion.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleUserStatus = async (user: any) => {
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: !user.is_active })
      });
      if (res.ok) fetchUsers();
      else alert("Failed to update status.");
    } catch (e) {
      alert("Error updating status.");
    }
  };

  const handleEditClick = (user: any) => {
    setEditingUserId(user.id);
    setEditUserForm({
      email: user.email,
      password: '', // Leave blank unless they want to change it
      department: user.department,
      role: user.role,
      is_active: user.is_active
    });
    setOpenEditUser(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUserId) return;
    setSubmittingUser(true);
    try {
      // Remove empty password from payload so it doesn't get updated
      const payload: any = { ...editUserForm };
      if (!payload.password) delete payload.password;

      const res = await fetch(`http://${window.location.hostname}:8000/admin/users/${editingUserId}`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setOpenEditUser(false);
        fetchUsers();
      } else {
        alert("Failed to update user.");
      }
    } catch (e) {
      alert("Error updating user.");
    } finally {
      setSubmittingUser(false);
    }
  };

  useEffect(() => {
    if (tabValue === 0) fetchUsers();
    if (tabValue === 1) fetchCases();
    if (tabValue === 2) fetchAuditLogs();
  }, [tabValue]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', mb: 5, width: '100%', position: 'relative', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 0 } }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            System Administration
          </Typography>
          <Breadcrumbs aria-label="breadcrumb">
            <Typography variant="body2" color="text.secondary">Dashboard</Typography>
            <Typography variant="body2" color="text.secondary">Admin</Typography>
          </Breadcrumbs>
        </Box>
        <AdminPanelSettingsRounded color="error" sx={{ fontSize: 48, opacity: 0.2, position: 'absolute', right: 40, top: 10 }} />
      </Box>

      <Card sx={{ p: 2 }}>
        <Tabs 
          value={tabValue} 
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="User Management" />
          <Tab label="Global Case Control" />
          <Tab label="Audit Logs" />
        </Tabs>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
        ) : (
          <>
            <TabPanel value={tabValue} index={0}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="contained" color="primary" onClick={() => setOpenAddUser(true)}>Add New User</Button>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{user.email}</TableCell>
                        <TableCell>
                          <Chip 
                            icon={user.role === 'Admin' ? <VerifiedUserRounded /> : undefined}
                            label={user.role} 
                            size="small" 
                            color={user.role === 'Admin' ? 'error' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={user.is_active ? 'Account Enabled' : 'Account Disabled'} 
                            size="small" 
                            color={user.is_active ? "success" : "error"} 
                            variant="outlined"
                            onClick={() => handleToggleUserStatus(user)}
                            sx={{ cursor: 'pointer' }}
                            title="Click to toggle account status"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton color="info" onClick={() => handleEditClick(user)} title="Edit User"><EditRounded /></IconButton>
                          <IconButton color="error" onClick={() => confirmDelete('user', user.id)}><DeleteRounded /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && <TableRow><TableCell colSpan={4} align="center">No users found</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Add User Dialog */}
              <Dialog open={openAddUser} onClose={() => setOpenAddUser(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add New User</DialogTitle>
                <DialogContent dividers>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
                    <TextField label="Full Name" fullWidth value={newUserForm.full_name} onChange={(e) => setNewUserForm({...newUserForm, full_name: e.target.value})} />
                    <TextField label="Email Address" fullWidth value={newUserForm.email} onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})} />
                    <TextField label="Password" type="password" fullWidth value={newUserForm.password} onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})} />
                    <TextField 
                      select
                      label="Role" 
                      fullWidth 
                      value={newUserForm.role} 
                      onChange={(e) => setNewUserForm({...newUserForm, role: e.target.value})}
                    >
                      <MenuItem value="Investigating Officer">Investigating Officer</MenuItem>
                      <MenuItem value="Admin">Admin</MenuItem>
                    </TextField>
                  </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2.5 }}>
                  <Button onClick={() => setOpenAddUser(false)} color="inherit" disabled={submittingUser}>Cancel</Button>
                  <Button onClick={handleAddUser} variant="contained" disabled={!newUserForm.email || !newUserForm.password || submittingUser}>
                    {submittingUser ? <CircularProgress size={24} color="inherit" /> : 'Create User'}
                  </Button>
                </DialogActions>
              </Dialog>

              {/* Edit User Dialog */}
              <Dialog open={openEditUser} onClose={() => setOpenEditUser(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Edit User</DialogTitle>
                <DialogContent dividers>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
                    <TextField label="Email Address" fullWidth value={editUserForm.email} onChange={(e) => setEditUserForm({...editUserForm, email: e.target.value})} />
                    <TextField label="New Password (leave blank to keep current)" type="password" fullWidth value={editUserForm.password} onChange={(e) => setEditUserForm({...editUserForm, password: e.target.value})} />
                    <TextField label="Department" fullWidth value={editUserForm.department} onChange={(e) => setEditUserForm({...editUserForm, department: e.target.value})} />
                    <TextField 
                      select
                      label="Role" 
                      fullWidth 
                      value={editUserForm.role} 
                      onChange={(e) => setEditUserForm({...editUserForm, role: e.target.value})}
                    >
                      <MenuItem value="Investigating Officer">Investigating Officer</MenuItem>
                      <MenuItem value="Admin">Admin</MenuItem>
                    </TextField>
                    <TextField 
                      select
                      label="Status" 
                      fullWidth 
                      value={editUserForm.is_active ? "true" : "false"} 
                      onChange={(e) => setEditUserForm({...editUserForm, is_active: e.target.value === "true"})}
                    >
                      <MenuItem value="true">Active</MenuItem>
                      <MenuItem value="false">Inactive</MenuItem>
                    </TextField>
                  </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2.5 }}>
                  <Button onClick={() => setOpenEditUser(false)} color="inherit" disabled={submittingUser}>Cancel</Button>
                  <Button onClick={handleUpdateUser} variant="contained" disabled={!editUserForm.email || submittingUser}>
                    {submittingUser ? <CircularProgress size={24} color="inherit" /> : 'Save Changes'}
                  </Button>
                </DialogActions>
              </Dialog>

              {/* Confirm Delete Dialog */}
              <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, type: null, id: null })} maxWidth="xs" fullWidth>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogContent dividers>
                  <Typography>
                    Are you sure you want to permanently delete this {deleteConfirm.type}? This action cannot be undone and may affect associated records.
                  </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                  <Button onClick={() => setDeleteConfirm({ open: false, type: null, id: null })} color="inherit" disabled={isDeleting}>Cancel</Button>
                  <Button onClick={executeDelete} variant="contained" color="error" disabled={isDeleting}>
                    {isDeleting ? <CircularProgress size={24} color="inherit" /> : 'Delete Permanently'}
                  </Button>
                </DialogActions>
              </Dialog>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="body1" color="text.secondary">
                  Superuser Case Control: View all cases, manage ownership, and assign cases to investigating officers.
                </Typography>
                <Button variant="outlined" onClick={fetchCases}>Refresh Cases</Button>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Case Number</TableCell>
                      <TableCell>Jurisdiction / Unit</TableCell>
                      <TableCell>Assigned Officer (Owner)</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cases.map((c) => (
                      <TableRow key={c.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{c.case_number}</TableCell>
                        <TableCell>{c.jurisdiction}</TableCell>
                        <TableCell>
                          <Chip 
                            icon={<VerifiedUserRounded sx={{ fontSize: '16px !important' }} />}
                            label={c.owning_officer_email || 'Unassigned'} 
                            size="small" 
                            color="primary" 
                            variant="outlined" 
                          />
                        </TableCell>
                        <TableCell><Chip label={c.status} size="small" color="info" /></TableCell>
                        <TableCell align="right">
                          <Button 
                            size="small" 
                            variant="outlined" 
                            color="primary"
                            sx={{ mr: 1 }}
                            onClick={() => {
                              setSelectedCaseForAssign(c);
                              setSelectedOfficerId(c.owning_officer_id || '');
                              setOpenAssignModal(true);
                            }}
                          >
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

              {/* Assign Officer Modal */}
              <Dialog open={openAssignModal} onClose={() => setOpenAssignModal(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 700 }}>Assign Case to Officer</DialogTitle>
                <DialogContent dividers>
                  <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="subtitle2">
                      Case: <strong>{selectedCaseForAssign?.case_number}</strong> ({selectedCaseForAssign?.jurisdiction})
                    </Typography>
                    <TextField
                      select
                      fullWidth
                      label="Select Assigned Officer"
                      value={selectedOfficerId}
                      onChange={(e) => setSelectedOfficerId(e.target.value)}
                    >
                      {users.map((u) => (
                        <MenuItem key={u.id} value={u.id}>
                          {u.email} ({u.role})
                        </MenuItem>
                      ))}
                    </TextField>
                    <Typography variant="caption" color="text.secondary">
                      The assigned officer will immediately have full permissions to upload, view, and manage documents for this case.
                    </Typography>
                  </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                  <Button onClick={() => setOpenAssignModal(false)} color="inherit">Cancel</Button>
                  <Button onClick={handleAssignCase} variant="contained" disabled={!selectedOfficerId || assigningOfficer}>
                    {assigningOfficer ? <CircularProgress size={20} /> : 'Save Assignment'}
                  </Button>
                </DialogActions>
              </Dialog>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>Result</TableCell>
                      <TableCell>Current Hash</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {auditLogs.map((audit) => (
                      <TableRow key={audit.id} hover>
                        <TableCell>{new Date(audit.timestamp).toLocaleString()}</TableCell>
                        <TableCell>{audit.action}</TableCell>
                        <TableCell>
                          <Chip label={audit.result} size="small" color={audit.result === 'SUCCESS' ? 'success' : 'error'} />
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{audit.current_hash.substring(0, 16)}...</TableCell>
                      </TableRow>
                    ))}
                    {auditLogs.length === 0 && <TableRow><TableCell colSpan={4} align="center">No audit logs found</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>
          </>
        )}
      </Card>
    </Box>
  );
}
