import { useState, useEffect, useRef } from 'react';
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
  Breadcrumbs,
  CircularProgress,
  MenuItem,
  Stack,
  Alert
} from '@mui/material';
import { 
  AddRounded, 
  DescriptionRounded, 
  DownloadRounded, 
  VisibilityRounded, 
  CloudUploadRounded, 
  FolderRounded,
  CloseRounded,
  RefreshRounded,
  AutoAwesomeRounded
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { Link as RouterLink } from 'react-router-dom';

export default function Documents() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [openCreateCase, setOpenCreateCase] = useState(false);
  const [newCaseNumber, setNewCaseNumber] = useState('');
  const [newCaseJurisdiction, setNewCaseJurisdiction] = useState('Cyber & Financial Crimes Unit');
  const [creatingCase, setCreatingCase] = useState(false);
  
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [caseId, setCaseId] = useState('');
  const [docType, setDocType] = useState('FIR');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  
  const { token } = useAuth();
  const pollIntervalRef = useRef<any>(null);

  const fetchCases = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/cases`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCases(data);
        if (data.length > 0 && !caseId) {
          setCaseId(data[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch cases:", e);
    }
  };

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/documents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const docs = await res.json();
        setDocuments(docs);
      }
    } catch (e) {
      console.error("Failed to fetch documents:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDocuments();
      fetchCases();
    }
  }, [token]);

  // Polling when any document is in PROCESSING status
  useEffect(() => {
    const hasProcessing = documents.some(d => d.status === 'PROCESSING');
    if (hasProcessing) {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`http://${window.location.hostname}:8000/documents`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const updated = await res.json();
            setDocuments(updated);
            if (!updated.some((d: any) => d.status === 'PROCESSING')) {
              clearInterval(pollIntervalRef.current);
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 2500);
    } else {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [documents, token]);

  const handleCreateCase = async () => {
    if (!newCaseNumber) return;
    setCreatingCase(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/cases`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          case_number: newCaseNumber,
          jurisdiction: newCaseJurisdiction
        })
      });
      if (res.ok) {
        const newCase = await res.json();
        setCases(prev => [newCase, ...prev]);
        setCaseId(newCase.id);
        setOpenCreateCase(false);
        setNewCaseNumber('');
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to create case');
      }
    } catch (e) {
      alert('Error creating case');
    } finally {
      setCreatingCase(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !title || !caseId) {
      setUploadError('Please select a file, fill in the title, and select a case.');
      return;
    }
    setUploading(true);
    setUploadError('');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('case_id', caseId);
      formData.append('document_type', docType);
      
      const res = await fetch(`http://${window.location.hostname}:8000/documents/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (res.ok) {
        setOpen(false);
        setFile(null);
        setTitle('');
        setUploadError('');
        fetchDocuments();
      } else {
        const errData = await res.json().catch(() => ({}));
        setUploadError(errData.detail || 'Upload failed. Please try again.');
      }
    } catch (e: any) {
      setUploadError('Network error uploading document: ' + (e.message || e));
    } finally {
      setUploading(false);
    }
  };

  const handleViewDetails = async (docId: string) => {
    setViewLoading(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/documents/${docId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedDoc(await res.json());
      }
    } catch (e) {
      console.error("Failed to load details:", e);
    } finally {
      setViewLoading(false);
    }
  };

  const handleDownload = (docId: string, title: string) => {
    fetch(`http://${window.location.hostname}:8000/documents/${docId}/download`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      if (!res.ok) throw new Error('Download failed');
      return res.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch(err => alert("Download failed: " + err.message));
  };

  const getCaseDisplay = (id: string) => {
    const found = cases.find(c => c.id === id);
    return found ? `${found.case_number}` : id.substring(0, 8) + '...';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', mb: 4, width: '100%', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 0 } }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }} gutterBottom>
            Documents Repository
          </Typography>
          <Breadcrumbs aria-label="breadcrumb">
            <RouterLink to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Typography variant="body2" color="text.primary">Dashboard</Typography>
            </RouterLink>
            <Typography variant="body2" color="text.secondary">Documents</Typography>
          </Breadcrumbs>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button 
            variant="outlined" 
            startIcon={<RefreshRounded />} 
            onClick={fetchDocuments}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button 
            variant="contained" 
            startIcon={<AddRounded />}
            onClick={() => {
              setUploadError('');
              setOpen(true);
            }}
          >
            Upload Document
          </Button>
        </Stack>
      </Box>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Document Title</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Case Reference</TableCell>
                <TableCell>Processing Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ p: 5 }}><CircularProgress size={28} /></TableCell></TableRow>
              ) : documents.map((doc) => (
                <TableRow key={doc.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <DescriptionRounded color="primary" sx={{ mr: 2, fontSize: 24 }} />
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{doc.title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Just now'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={doc.document_type || 'General'} size="small" sx={{ bgcolor: 'rgba(145, 158, 171, 0.16)', fontWeight: 500 }} />
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontWeight: 500 }}>
                    <Chip icon={<FolderRounded sx={{ fontSize: '16px !important' }} />} label={getCaseDisplay(doc.case_id)} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={doc.status === 'READY' ? 'READY / EXTRACTED' : doc.status} 
                      size="small" 
                      color={doc.status === 'READY' ? 'success' : doc.status === 'PROCESSING' ? 'warning' : 'error'} 
                      sx={{ fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Extracted Metadata & OCR Text">
                      <IconButton color="primary" onClick={() => handleViewDetails(doc.id)} disabled={viewLoading}>
                        <VisibilityRounded />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Download Original PDF">
                      <IconButton color="info" onClick={() => handleDownload(doc.id, doc.title)}>
                        <DownloadRounded />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && documents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ p: 6 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>No documents uploaded yet</Typography>
                    <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                      Click "Upload Document" to upload a PDF document and extract metadata automatically.
                    </Typography>
                    <Button variant="contained" startIcon={<CloudUploadRounded />} onClick={() => setOpen(true)}>
                      Upload First Document
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={open} onClose={() => !uploading && setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Upload New Document</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            {uploadError && <Alert severity="error">{uploadError}</Alert>}

            <Box 
              sx={{ 
                border: '2px dashed', 
                borderColor: file ? 'primary.main' : 'divider',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                bgcolor: file ? 'rgba(0, 167, 111, 0.04)' : 'background.default',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(0, 167, 111, 0.04)' }
              }}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <input 
                type="file" 
                id="file-upload" 
                hidden 
                accept="application/pdf"
                onChange={(e) => {
                  const selected = e.target.files?.[0] || null;
                  setFile(selected);
                  if (selected && !title) {
                    setTitle(selected.name.replace(/\.[^/.]+$/, ""));
                  }
                }}
              />
              <CloudUploadRounded sx={{ fontSize: 44, color: file ? 'primary.main' : 'text.disabled', mb: 1.5 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{file ? file.name : "Choose PDF file or drag & drop"}</Typography>
              <Typography variant="caption" color="text.secondary">PDF format supported • OCR & AI metadata auto-extraction enabled</Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField 
                select 
                label="Assign to Case" 
                fullWidth 
                value={caseId} 
                onChange={(e) => setCaseId(e.target.value)}
                helperText="Select the case file this document belongs to"
              >
                {cases.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.case_number} ({c.jurisdiction})
                  </MenuItem>
                ))}
              </TextField>
              <Button 
                variant="outlined" 
                sx={{ height: 54, whiteSpace: 'nowrap' }}
                onClick={() => setOpenCreateCase(true)}
              >
                + New Case
              </Button>
            </Box>

            <TextField 
              label="Document Title" 
              fullWidth 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="e.g. First Information Report 2026"
              required
            />

            <TextField 
              select
              label="Document Type" 
              fullWidth 
              value={docType} 
              onChange={(e) => setDocType(e.target.value)}
            >
              <MenuItem value="FIR">FIR (First Information Report)</MenuItem>
              <MenuItem value="Charge Sheet">Charge Sheet</MenuItem>
              <MenuItem value="Witness Statement">Witness Statement</MenuItem>
              <MenuItem value="Forensic Report">Forensic Report</MenuItem>
              <MenuItem value="Evidence Log">Evidence Log</MenuItem>
              <MenuItem value="Court Order">Court Order</MenuItem>
              <MenuItem value="Other">Other / General Document</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpen(false)} color="inherit" disabled={uploading}>Cancel</Button>
          <Button onClick={handleUpload} variant="contained" disabled={!file || !title || !caseId || uploading}>
            {uploading ? <CircularProgress size={24} color="inherit" /> : 'Start Upload & Extraction'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Case Modal */}
      <Dialog open={openCreateCase} onClose={() => setOpenCreateCase(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create New Case</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField 
              label="Case Number" 
              fullWidth 
              value={newCaseNumber} 
              onChange={(e) => setNewCaseNumber(e.target.value)}
              placeholder="e.g. CR-2026-089"
              autoFocus
            />
            <TextField 
              label="Jurisdiction / Unit" 
              fullWidth 
              value={newCaseJurisdiction} 
              onChange={(e) => setNewCaseJurisdiction(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenCreateCase(false)} color="inherit">Cancel</Button>
          <Button onClick={handleCreateCase} variant="contained" disabled={!newCaseNumber || creatingCase}>
            {creatingCase ? <CircularProgress size={20} /> : 'Save Case'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Document Details & OCR / Metadata Modal */}
      <Dialog open={Boolean(selectedDoc)} onClose={() => setSelectedDoc(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeRounded color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{selectedDoc?.title}</Typography>
          </Box>
          <IconButton onClick={() => setSelectedDoc(null)} size="small"><CloseRounded /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedDoc && (
            <Stack spacing={3}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label={`Type: ${selectedDoc.document_type}`} color="primary" variant="outlined" />
                <Chip label={`Status: ${selectedDoc.status}`} color={selectedDoc.status === 'READY' ? 'success' : 'warning'} />
                <Chip label={`Version: ${selectedDoc.version_number || '1.0'}`} variant="outlined" />
              </Box>

              {/* Structured Metadata Box */}
              {selectedDoc.structured_data && Object.keys(selectedDoc.structured_data).length > 0 && (
                <Card sx={{ p: 2.5, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AutoAwesomeRounded sx={{ fontSize: 18 }} /> AI-Extracted Structured Metadata
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                    <Typography variant="body2"><strong>FIR / Ref No:</strong> {selectedDoc.structured_data.fir_number || 'N/A'}</Typography>
                    <Typography variant="body2"><strong>Incident Date:</strong> {selectedDoc.structured_data.incident_date || 'N/A'}</Typography>
                    <Typography variant="body2"><strong>Police Station:</strong> {selectedDoc.structured_data.police_station || 'N/A'}</Typography>
                    <Typography variant="body2"><strong>Complainant:</strong> {selectedDoc.structured_data.complainant || 'N/A'}</Typography>
                    <Typography variant="body2"><strong>Accused:</strong> {selectedDoc.structured_data.accused || 'N/A'}</Typography>
                    <Typography variant="body2">
                      <strong>IPC / Legal Sections:</strong> {Array.isArray(selectedDoc.structured_data.ipc_sections) ? selectedDoc.structured_data.ipc_sections.join(', ') : selectedDoc.structured_data.ipc_sections || 'N/A'}
                    </Typography>
                  </Box>
                </Card>
              )}

              {/* Extracted Raw OCR Text Box */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Extracted Document Text</Typography>
                <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1.5, maxHeight: 260, overflowY: 'auto', fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', border: '1px solid', borderColor: 'divider' }}>
                  {selectedDoc.raw_ocr_text || 'No text extracted.'}
                </Box>
              </Box>

              {selectedDoc.file_hash && (
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                  SHA-256 Checksum: {selectedDoc.file_hash}
                </Typography>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSelectedDoc(null)} color="inherit">Close</Button>
          {selectedDoc && (
            <Button variant="contained" startIcon={<DownloadRounded />} onClick={() => handleDownload(selectedDoc.id, selectedDoc.title)}>
              Download Original PDF
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

