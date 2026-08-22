import { useState, useEffect } from 'react';
import { 
  Box, 
  Card, 
  Typography, 
  Button, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress
} from '@mui/material';
import { AddRounded, MoreVertRounded, CloudUploadRounded } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

export default function Documents() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caseId, setCaseId] = useState('');
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('FIR');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { token } = useAuth();

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setDocuments(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUpload = async () => {
    if (!file || !caseId || !title || !docType) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('case_id', caseId);
      formData.append('title', title);
      formData.append('document_type', docType);

      const res = await fetch('http://127.0.0.1:8000/documents/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        setOpen(false);
        setFile(null);
        fetchDocuments();
      } else {
        alert("Upload failed. Ensure case ID is valid.");
      }
    } catch (e) {
      alert("Error uploading file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 5 }}>
        <Typography variant="h4">Documents</Typography>
        <Button 
          variant="contained" 
          startIcon={<AddRounded />}
          onClick={() => setOpen(true)}
          sx={{ boxShadow: '0 8px 16px 0 rgba(0, 167, 111, 0.24)' }}
        >
          New Document
        </Button>
      </Box>

      <Card>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: 'background.default' }}>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Case ID</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              ) : documents.map((doc) => (
                <TableRow key={doc.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{doc.title}</TableCell>
                  <TableCell>{doc.document_type}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>{doc.case_id}</TableCell>
                  <TableCell>
                    <Chip 
                      label={doc.status} 
                      size="small" 
                      color={doc.status === 'COMPLETED' ? 'success' : 'warning'} 
                      sx={{ fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton><MoreVertRounded /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && documents.length === 0 && (
                <TableRow><TableCell colSpan={5} align="center">No documents uploaded yet.</TableCell></TableRow>
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
                cursor: 'pointer'
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenUpload(false)} color="inherit">Cancel</Button>
          <Button onClick={handleUpload} variant="contained" disabled={!file}>Upload</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
