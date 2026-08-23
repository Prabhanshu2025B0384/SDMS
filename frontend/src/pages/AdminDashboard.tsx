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
  TextField
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
  
  const { token } = useAuth();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/admin/users', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setUsers(await res.json());
    } finally { setLoading(false); }
  };

  const fetchCases = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/admin/cases', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setCases(await res.json());
    } finally { setLoading(false); }
  };

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/admin/audit-logs', { headers: { 'Authorization': `Bearer ${token}` } });
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
      const res = await fetch(`http://127.0.0.1:8000/auth/signup?${queryParams.toString()}`, {
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

  useEffect(() => {
    if (tabValue === 0) fetchUsers();
    if (tabValue === 1) fetchCases();
    if (tabValue === 2) fetchAuditLogs();
  }, [tabValue]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 5 }}>
        <AdminPanelSettingsRounded color="error" sx={{ fontSize: 40, mr: 2 }} />
        <Typography variant="h4">System Administration</Typography>
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
                  <TableHead sx={{ bgcolor: 'background.default' }}>
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
                        <TableCell><Chip label={user.is_active ? 'Active' : 'Inactive'} size="small" color={user.is_active ? "success" : "error"} /></TableCell>
                        <TableCell align="right">
                          <IconButton color="info"><EditRounded /></IconButton>
                          <IconButton color="error"><DeleteRounded /></IconButton>
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
                      SelectProps={{ native: true }}
                      label="Role" 
                      fullWidth 
                      value={newUserForm.role} 
                      onChange={(e) => setNewUserForm({...newUserForm, role: e.target.value})}
                    >
                      <option value="Investigating Officer">Investigating Officer</option>
                      <option value="Admin">Admin</option>
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
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                Superuser view: All cases are listed here regardless of assignment. You have full Read/Write/Delete access.
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead sx={{ bgcolor: 'background.default' }}>
                    <TableRow>
                      <TableCell>Case ID</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cases.map((c) => (
                      <TableRow key={c.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{c.case_number}</TableCell>
                        <TableCell><Chip label={c.status} size="small" color="info" /></TableCell>
                        <TableCell align="right">
                          <Button size="small" color="error" startIcon={<DeleteRounded />}>Force Delete</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {cases.length === 0 && <TableRow><TableCell colSpan={3} align="center">No cases found</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <TableContainer>
                <Table>
                  <TableHead sx={{ bgcolor: 'background.default' }}>
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
