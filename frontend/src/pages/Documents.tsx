import { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Card,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  Breadcrumbs,
  CircularProgress
} from '@mui/material';
import { AddRounded, DescriptionRounded, DownloadRounded, VisibilityRounded, CloudUploadRounded, MoreVertRounded } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { Link as RouterLink } from 'react-router-dom';

export default function Documents() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [caseId, setCaseId] = useState('');
  const [docType, setDocType] = useState('FIR');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const { token, user } = useAuth();

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setDocuments(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [token]);

  const handleUpload = async () => {
    if (!file || !title || !caseId) return;
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('case_id', caseId);
      formData.append('document_type', docType);
      
      const res = await fetch('http://127.0.0.1:8000/documents/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (res.ok) {
        setOpen(false);
        setFile(null);
        setTitle('');
        setCaseId('');
        fetchDocuments();
      } else {
        alert('Upload failed. Ensure case ID is valid.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', mb: 5, width: '100%', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 0 } }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Documents
          </Typography>
          <Breadcrumbs aria-label="breadcrumb">
            <RouterLink to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Typography variant="body2" color="text.primary">Dashboard</Typography>
            </RouterLink>
            <Typography variant="body2" color="text.secondary">Documents</Typography>
          </Breadcrumbs>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddRounded />}
          onClick={() => setOpen(true)}
        >
          New Document
        </Button>
      </Box>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Case ID</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ p: 5 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : documents.map((doc) => (
                <TableRow key={doc.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <DescriptionRounded sx={{ color: 'text.secondary', mr: 2 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{doc.title}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={doc.document_type || 'Unknown'} size="small" sx={{ bgcolor: 'rgba(145, 158, 171, 0.16)' }} />
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                    {doc.case_id}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={doc.status} 
                      size="small" 
                      color={doc.status === 'COMPLETED' ? 'success' : 'warning'} 
                      sx={{ fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View">
                      <IconButton color="info"><VisibilityRounded /></IconButton>
                    </Tooltip>
                    <Tooltip title="Download">
                      <IconButton><DownloadRounded /></IconButton>
                    </Tooltip>
                    <IconButton><MoreVertRounded /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && documents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ p: 5 }}>
                    <Typography variant="body2" color="text.secondary">No documents uploaded yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={open} onClose={() => !uploading && setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload New Document</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            <Box 
              sx={{ 
                border: '2px dashed', 
                borderColor: 'divider',
                borderRadius: 2,
                p: 5,
                textAlign: 'center',
                bgcolor: 'background.default',
                cursor: 'pointer',
                '&:hover': { opacity: 0.8 }
              }}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <input 
                type="file" 
                id="file-upload" 
                hidden 
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <CloudUploadRounded sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6">{file ? file.name : "Select or drag file"}</Typography>
              <Typography variant="body2" color="text.secondary">Support for a single PDF file.</Typography>
            </Box>

            <TextField label="Case ID (UUID)" fullWidth value={caseId} onChange={(e) => setCaseId(e.target.value)} />
            <TextField label="Document Title" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} />
            <TextField label="Document Type (e.g. FIR, Evidence)" fullWidth value={docType} onChange={(e) => setDocType(e.target.value)} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpen(false)} color="inherit" disabled={uploading}>Cancel</Button>
          <Button onClick={handleUpload} variant="contained" disabled={!file || !caseId || uploading}>
            {uploading ? <CircularProgress size={24} color="inherit" /> : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
