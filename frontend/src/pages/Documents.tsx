import { useState } from 'react';
import { 
  Box, 
  Card, 
  Table, 
  TableRow, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  Typography, 
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem
} from '@mui/material';
import { AddRounded, MoreVertRounded, CloudUploadRounded } from '@mui/icons-material';
import axios from 'axios';

// Placeholder data since we don't have the API fully hooked up for fetching all cases/docs on the frontend yet
const MOCK_DOCS = [
  { id: '1', title: 'FIR Report - Case 101', type: 'FIR', status: 'READY', date: '2026-08-22' },
  { id: '2', title: 'Witness Statement - Case 102', type: 'STATEMENT', status: 'PROCESSING', date: '2026-08-23' },
];

export default function Documents() {
  const [openUpload, setOpenUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleUpload = async () => {
    // Note: The actual API call is commented out because it requires valid auth tokens & case_ids
    /*
    const formData = new FormData();
    if (file) formData.append('file', file);
    
    await axios.post('http://localhost:8000/documents/upload?case_id=UUID...', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': 'Bearer ...'
      }
    });
    */
    setOpenUpload(false);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 5 }}>
        <Typography variant="h4">Documents</Typography>
        <Button 
          variant="contained" 
          startIcon={<AddRounded />}
          onClick={() => setOpenUpload(true)}
        >
          Upload Document
        </Button>
      </Box>

      <Card>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: 'background.default' }}>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {MOCK_DOCS.map((doc) => (
                <TableRow key={doc.id} hover>
                  <TableCell>
                    <Typography variant="subtitle2">{doc.title}</Typography>
                  </TableCell>
                  <TableCell>{doc.type}</TableCell>
                  <TableCell>{doc.date}</TableCell>
                  <TableCell>
                    <Chip 
                      label={doc.status} 
                      size="small" 
                      color={doc.status === 'READY' ? 'success' : 'warning'} 
                      sx={{ borderRadius: 1 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small">
                      <MoreVertRounded />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={openUpload} onClose={() => setOpenUpload(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload New Document</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField label="Document Title" fullWidth />
            <TextField select label="Document Type" fullWidth defaultValue="FIR">
              <MenuItem value="FIR">FIR</MenuItem>
              <MenuItem value="STATEMENT">Witness Statement</MenuItem>
              <MenuItem value="EVIDENCE">Evidence Photo</MenuItem>
            </TextField>
            <Box 
              sx={{ 
                border: '1px dashed', 
                borderColor: 'divider', 
                borderRadius: 2, 
                p: 5, 
                textAlign: 'center',
                bgcolor: 'background.default',
                cursor: 'pointer',
                '&:hover': { opacity: 0.72 }
              }}
            >
              <CloudUploadRounded color="primary" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h6">Select File</Typography>
              <Typography variant="body2" color="text.secondary">Drop files here or click to browse</Typography>
              <input 
                type="file" 
                style={{ opacity: 0, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                onChange={(e) => e.target.files && setFile(e.target.files[0])}
              />
              {file && <Typography sx={{ mt: 2 }} color="primary">{file.name}</Typography>}
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
