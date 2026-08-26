import { API_BASE_URL } from "../config";
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
  Alert,
  Autocomplete,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormControl
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
  AutoAwesomeRounded,
  ShareRounded,
  ShieldRounded,
  CheckCircleRounded,
  VerifiedUserRounded,
  BlockRounded
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { Link as RouterLink, useLocation, useSearchParams } from 'react-router-dom';
import ShareDocumentDialog from '../components/ShareDocumentDialog';

const CLEARANCE_COLORS: Record<number, 'default' | 'info' | 'warning' | 'error' | 'success'> = {
  1: 'default', 2: 'info', 3: 'warning', 4: 'error', 5: 'success'
};
const CLEARANCE_LABELS: Record<number, string> = {
  1: 'L1 – Restricted',
  2: 'L2 – Confidential',
  3: 'L3 – Secret',
  4: 'L4 – Top Secret',
  5: 'L5 – Executive'
};

export default function Documents() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [openCreateCase, setOpenCreateCase] = useState(false);
  const [newCaseNumber, setNewCaseNumber] = useState('');
  const [newCaseJurisdiction, setNewCaseJurisdiction] = useState('Cyber & Financial Crimes Unit');
  const [creatingCase, setCreatingCase] = useState(false);

  const [openCaseStatus, setOpenCaseStatus] = useState(false);
  const [caseStatusError, setCaseStatusError] = useState('');
  const [newCaseStatus, setNewCaseStatus] = useState('');
  const [updatingCaseStatus, setUpdatingCaseStatus] = useState(false);
  
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [caseId, setCaseId] = useState('');
  const [docType, setDocType] = useState('FIR');
  const [classificationLevel, setClassificationLevel] = useState(1);
  const [uploading, setUploading] = useState(false);
  
  // Digital Signatures
  const [signPassword, setSignPassword] = useState('');
  const [openSignModal, setOpenSignModal] = useState(false);
  const [versionToSign, setVersionToSign] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  
  const [sigDetails, setSigDetails] = useState<any>(null);
  const [openSigModal, setOpenSigModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  
  const [integrityVerified, setIntegrityVerified] = useState(false);
  const [integrityError, setIntegrityError] = useState('');
  
  // Share dialog state
  const [shareDoc, setShareDoc] = useState<{ id: string; title: string; classification_level: number } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const [versions, setVersions] = useState<any[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Approval Request State
  const [submitForApproval, setSubmitForApproval] = useState(false);
  const [reviewerId, setReviewerId] = useState<string | null>(null);
  const [reviewerSearch, setReviewerSearch] = useState('');
  const [reviewers, setReviewers] = useState<any[]>([]);
  const [reviewSubmitMode, setReviewSubmitMode] = useState(false);
  const [reviewClassificationLevel, setReviewClassificationLevel] = useState<number | null>(null);

  const { token, user } = useAuth();
  const pollIntervalRef = useRef<any>(null);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkId = searchParams.get('id');

  const fetchCases = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/cases`, {
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

  const handleSignDocument = async () => {
    if (!selectedDoc || !versionToSign || !signPassword) return;
    setSigning(true);
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${selectedDoc.id}/versions/${versionToSign}/sign`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: signPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setOpenSignModal(false);
        fetchVersions(selectedDoc.id); // Refresh versions to show Signed status
      } else {
        window.alert(`Signing failed: ${data.detail || 'Unknown error'}`);
      }
    } catch (e) {
      console.error("Signing failed:", e);
      window.alert("Signing failed due to a network error.");
    } finally {
      setSigning(false);
      setSignPassword('');
    }
  };

  const handleVerifySignature = async (docId: string, versionId: string) => {
    setSigDetails(null);
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${docId}/versions/${versionId}/verify-signature`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setSigDetails(data);
      setOpenSigModal(true);
    } catch (e) {
      console.error(e);
      window.alert("Verification request failed.");
    }
  };

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/documents`, {
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

  useEffect(() => {
    if (deepLinkId && documents.length > 0) {
      if (!selectedDoc || selectedDoc.id !== deepLinkId) {
        handleViewDetails(deepLinkId);
        searchParams.delete('id');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [deepLinkId, documents, searchParams, setSearchParams, selectedDoc]);

  useEffect(() => {
    if (reviewerSearch.length > 1) {
      fetch(`${API_BASE_URL}/auth/search?q=${reviewerSearch}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setReviewers(data))
      .catch(console.error);
    }
  }, [reviewerSearch, token]);

  // Polling when any document is in PROCESSING status
  useEffect(() => {
    const hasProcessing = documents.some(d => d.status === 'PROCESSING');
    if (hasProcessing) {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/documents`, {
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
      const res = await fetch(`${API_BASE_URL}/cases`, {
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

  const handleUpdateCaseStatus = async () => {
    if (!caseId || !newCaseStatus) return;
    setUpdatingCaseStatus(true);
    setCaseStatusError('');
    try {
      const res = await fetch(`${API_BASE_URL}/cases/${caseId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newCaseStatus })
      });
      if (res.ok) {
        setOpenCaseStatus(false);
        setNewCaseStatus('');
        fetchCases();
      } else {
        const err = await res.json();
        setCaseStatusError(err.detail || 'Failed to update case status');
      }
    } catch (e) {
      setCaseStatusError('Network error updating case status');
    } finally {
      setUpdatingCaseStatus(false);
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
      formData.append('classification_level', classificationLevel.toString());
      if (submitForApproval && reviewerId) {
        formData.append('reviewer_id', reviewerId);
      }
      
      const res = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (res.ok) {
        setOpen(false);
        setFile(null);
        setTitle('');
        setClassificationLevel(1);
        setUploadError('');
        setSubmitForApproval(false);
        setReviewerId(null);
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
    setIntegrityVerified(false);
    setIntegrityError('');
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${docId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedDoc(await res.json());
        fetchVersions(docId);
        fetchAuditHistory(docId);
      }
    } catch (e) {
      console.error("Failed to load details:", e);
    } finally {
      setViewLoading(false);
    }
  };

  const fetchVersions = async (docId: string) => {
    setVersionsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${docId}/versions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setVersions(await res.json());
      }
    } catch (e) {
      console.error("Failed to load versions:", e);
    } finally {
      setVersionsLoading(false);
    }
  };

  const fetchAuditHistory = async (docId: string) => {
    setAuditLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${docId}/audit-history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAuditLogs(await res.json());
      }
    } catch (e) {
      console.error("Failed to load audit history:", e);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleUpdateStatus = async (status: string, reason?: string, reviewer_id?: string, classification_level?: number) => {
    if (!selectedDoc) return;
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${selectedDoc.id}/status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, reason, reviewer_id, classification_level })
      });
      if (res.ok) {
        setReviewSubmitMode(false);
        fetchDocuments();
        handleViewDetails(selectedDoc.id);
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to update status');
      }
    } catch (e) {
      alert('Error updating status');
    }
  };

  const handleVerifyIntegrity = async () => {
    if (!selectedDoc) return;
    setIntegrityError('');
    setIntegrityVerified(false);
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${selectedDoc.id}/verify-integrity`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setIntegrityVerified(true);
        fetchVersions(selectedDoc.id);
      } else {
        const err = await res.json();
        setIntegrityError(err.detail || 'Verification failed');
      }
    } catch (e) {
      setIntegrityError('Error verifying integrity');
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!selectedDoc) return;
    if (!window.confirm('Are you sure you want to restore this version? This will create a new current version from the selected past version.')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${selectedDoc.id}/versions/${versionId}/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert('Version restored successfully');
        fetchDocuments();
        handleViewDetails(selectedDoc.id);
      } else {
        const err = await res.json();
        alert(err.detail || 'Restore failed');
      }
    } catch (e) {
      alert('Error restoring version');
    }
  };

  const handleRetryProcessing = async (docId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${docId}/retry`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert('Retrying processing in background');
        fetchDocuments();
      } else {
        const err = await res.json();
        alert(err.detail || 'Retry failed');
      }
    } catch (e) {
      alert('Error retrying processing');
    }
  };

  const handleUploadNewVersion = async () => {
    if (!selectedDoc || !file) {
      alert('Please select a file to upload as the new version.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(`${API_BASE_URL}/documents/${selectedDoc.id}/versions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (res.ok) {
        setFile(null);
        fetchDocuments();
        handleViewDetails(selectedDoc.id);
      } else {
        const err = await res.json();
        alert(err.detail || 'Upload new version failed');
      }
    } catch (e) {
      alert('Error uploading new version');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (docId: string, title: string) => {
    fetch(`${API_BASE_URL}/documents/${docId}/download`, {
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
                <TableCell>Classification</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Case Reference</TableCell>
                <TableCell>Document Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ p: 5 }}><CircularProgress size={28} /></TableCell></TableRow>
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
                    <Chip
                      icon={<ShieldRounded sx={{ fontSize: '13px !important' }} />}
                      label={CLEARANCE_LABELS[doc.classification_level || 1] || 'L1'}
                      size="small"
                      color={CLEARANCE_COLORS[doc.classification_level || 1] || 'default'}
                      sx={{ fontWeight: 700, fontSize: 11 }}
                    />
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
                      color={doc.status === 'READY' ? 'success' : doc.status === 'PROCESSING' ? 'warning' : doc.status === 'PROCESSING_FAILED' ? 'error' : 'info'} 
                      sx={{ fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {doc.status === 'PROCESSING_FAILED' && (
                      <Tooltip title="Retry Processing">
                        <IconButton color="warning" onClick={() => handleRetryProcessing(doc.id)}>
                          <RefreshRounded />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Share / Permissions">
                      <IconButton color="secondary" onClick={() => { setShareDoc(doc); setShareOpen(true); }}>
                        <ShareRounded />
                      </IconButton>
                    </Tooltip>
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
                  <TableCell colSpan={6} align="center" sx={{ p: 6 }}>
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
                  <MenuItem key={c.id} value={c.id} disabled={c.status === 'CLOSED'}>
                    {c.case_number} ({c.jurisdiction}) {c.status === 'CLOSED' ? '[CLOSED]' : ''}
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
              <Button 
                variant="outlined" 
                color="secondary"
                sx={{ height: 54, whiteSpace: 'nowrap' }}
                onClick={() => {
                  setNewCaseStatus('');
                  setCaseStatusError('');
                  setOpenCaseStatus(true);
                }}
                disabled={!caseId || cases.find(c => c.id === caseId)?.status === 'CLOSED'}
              >
                Change Status
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
              label="Security Classification Level" 
              fullWidth 
              value={classificationLevel} 
              onChange={(e) => setClassificationLevel(Number(e.target.value))}
              helperText="Hierarchy clearance level required to access this document"
            >
              {[1, 2, 3, 4, 5]
                .filter(level => level <= (user?.clearance_level || 1))
                .map(level => (
                  <MenuItem key={level} value={level}>
                    {CLEARANCE_LABELS[level]}
                  </MenuItem>
                ))}
            </TextField>

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

            <FormControl component="fieldset" sx={{ mt: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Approval / Review</Typography>
              <RadioGroup
                row
                value={submitForApproval ? "submit" : "none"}
                onChange={(e) => setSubmitForApproval(e.target.value === "submit")}
              >
                <FormControlLabel value="none" control={<Radio size="small" />} label="No approval required" />
                <FormControlLabel value="submit" control={<Radio size="small" />} label="Submit for approval" />
              </RadioGroup>
            </FormControl>

            {submitForApproval && (
              <Autocomplete
                options={reviewers}
                getOptionLabel={(option) => `${option.email} (${option.role} - L${option.clearance_level})`}
                onInputChange={(_, newInputValue) => setReviewerSearch(newInputValue)}
                onChange={(_, newValue) => setReviewerId(newValue ? newValue.id : null)}
                renderInput={(params) => <TextField {...params} label="Select Reviewer" required helperText="Reviewer must have equal or higher clearance level" />}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpen(false)} color="inherit" disabled={uploading}>Cancel</Button>
          <Button onClick={handleUpload} variant="contained" disabled={!file || !title || !caseId || (submitForApproval && !reviewerId) || uploading}>
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
      <Dialog open={Boolean(selectedDoc)} onClose={() => { setSelectedDoc(null); setReviewSubmitMode(false); setIntegrityVerified(false); setIntegrityError(''); setReviewClassificationLevel(null); }} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeRounded color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{selectedDoc?.title}</Typography>
          </Box>
          <IconButton onClick={() => { setSelectedDoc(null); setReviewSubmitMode(false); setIntegrityVerified(false); setIntegrityError(''); setReviewClassificationLevel(null); }} size="small"><CloseRounded /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedDoc && (
            <Stack spacing={3}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  icon={<ShieldRounded sx={{ fontSize: '13px !important' }} />}
                  label={CLEARANCE_LABELS[selectedDoc.classification_level || 1] || 'L1'}
                  color={CLEARANCE_COLORS[selectedDoc.classification_level || 1] || 'default'}
                  sx={{ fontWeight: 700 }}
                />
                <Chip label={`Type: ${selectedDoc.document_type}`} color="primary" variant="outlined" />
                <Chip label={`Status: ${selectedDoc.status}`} color={selectedDoc.status === 'READY' ? 'success' : selectedDoc.status === 'PROCESSING_FAILED' ? 'error' : 'warning'} />
                <Chip label={`Version: ${selectedDoc.version_number || '1.0'}`} variant="outlined" />
              </Box>

              {selectedDoc.status === 'PROCESSING_FAILED' && selectedDoc.failure_reason && (
                <Alert severity="error">
                  <strong>Processing Failed:</strong> {selectedDoc.failure_reason}
                </Alert>
              )}

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                {selectedDoc.status === 'READY' && (
                  !reviewSubmitMode ? (
                    <Button variant="contained" size="small" onClick={() => setReviewSubmitMode(true)}>Submit for Review</Button>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Autocomplete
                        sx={{ width: 300 }}
                        size="small"
                        options={reviewers}
                        getOptionLabel={(option) => `${option.email} (L${option.clearance_level})`}
                        onInputChange={(_, newInputValue) => setReviewerSearch(newInputValue)}
                        onChange={(_, newValue) => setReviewerId(newValue ? newValue.id : null)}
                        renderInput={(params) => <TextField {...params} label="Select Reviewer" />}
                      />
                      <Button variant="contained" size="small" disabled={!reviewerId} onClick={() => handleUpdateStatus('SUBMITTED', undefined, reviewerId as string)}>Confirm</Button>
                      <Button variant="text" size="small" onClick={() => setReviewSubmitMode(false)}>Cancel</Button>
                    </Box>
                  )
                )}
                {selectedDoc.status === 'SUBMITTED' && (
                  <Button variant="contained" color="secondary" size="small" onClick={() => handleUpdateStatus('UNDER_REVIEW')}>Start Review</Button>
                )}
                {selectedDoc.status === 'UNDER_REVIEW' && (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Button variant="outlined" size="small" color="info" onClick={handleVerifyIntegrity} startIcon={<ShieldRounded />}>Verify Integrity</Button>
                    <TextField
                      select
                      size="small"
                      label="Final Classification"
                      value={reviewClassificationLevel || selectedDoc.classification_level}
                      onChange={(e) => setReviewClassificationLevel(Number(e.target.value))}
                      sx={{ width: 160 }}
                    >
                      {[1, 2, 3, 4, 5].filter(level => level <= (user?.clearance_level || 1)).map(level => (
                        <MenuItem key={level} value={level}>{CLEARANCE_LABELS[level]}</MenuItem>
                      ))}
                    </TextField>
                    <Button variant="contained" size="small" color="success" onClick={() => handleUpdateStatus('APPROVED', undefined, undefined, reviewClassificationLevel || selectedDoc.classification_level)}>Verify / Mark as Reviewed</Button>
                    <Button variant="outlined" size="small" color="error" onClick={() => {
                        const reason = window.prompt("Enter rejection reason:");
                        if (reason) handleUpdateStatus('REJECTED', reason);
                    }}>Reject</Button>
                  </Box>
                )}
                {selectedDoc.status === 'APPROVED' && (
                  <Button variant="contained" color="warning" size="small" onClick={() => handleUpdateStatus('LOCKED')}>Lock Document</Button>
                )}
                {selectedDoc.status !== 'UNDER_REVIEW' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button variant="outlined" size="small" color="info" onClick={handleVerifyIntegrity} startIcon={<ShieldRounded />}>Verify Integrity</Button>
                  {integrityVerified && (
                    <Chip icon={<CheckCircleRounded sx={{ fontSize: '16px !important' }} />} label="Integrity Verified" color="success" size="small" sx={{ fontWeight: 700 }} />
                  )}
                </Box>
                )}
              </Box>

              {integrityError && (
                <Alert severity="error">
                  <strong>Verification Failed:</strong> {integrityError}
                </Alert>
              )}

              {/* Structured Metadata Box */}
              {selectedDoc.structured_data && Object.keys(selectedDoc.structured_data).length > 0 && !selectedDoc.structured_data.error ? (
                <Card sx={{ p: 2.5, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AutoAwesomeRounded sx={{ fontSize: 18 }} /> AI-Extracted Structured Metadata
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                    {Object.entries(selectedDoc.structured_data).map(([key, value]) => {
                      if (key === 'document_type') return null;
                      const formattedKey = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                      const displayValue = Array.isArray(value) ? value.join(', ') : (value || 'N/A');
                      return (
                        <Typography key={key} variant="body2">
                          <strong>{formattedKey}:</strong> {String(displayValue)}
                        </Typography>
                      );
                    })}
                  </Box>
                </Card>
              ) : (
                <Card sx={{ p: 2.5, bgcolor: 'rgba(255, 86, 48, 0.08)', border: '1px solid', borderColor: 'error.main' }}>
                  <Typography variant="body2" color="error.main" sx={{ fontWeight: 600 }}>
                    {selectedDoc.structured_data?.message || 'No structured metadata could be extracted from this document.'}
                  </Typography>
                </Card>
              )}

              {/* Extracted Raw OCR Text Box */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Extracted Document Text</Typography>
                <Box sx={{ p: 2, bgcolor: selectedDoc.raw_ocr_text?.startsWith('EXTRACTION_FAILED') ? 'rgba(255, 86, 48, 0.08)' : 'background.default', borderRadius: 1.5, maxHeight: 260, overflowY: 'auto', fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', border: '1px solid', borderColor: selectedDoc.raw_ocr_text?.startsWith('EXTRACTION_FAILED') ? 'error.main' : 'divider' }}>
                  {selectedDoc.raw_ocr_text?.startsWith('EXTRACTION_FAILED') ? (
                    <Typography color="error.main" sx={{ fontFamily: 'monospace', fontSize: 13 }}>
                      Text extraction failed: {selectedDoc.raw_ocr_text.replace('EXTRACTION_FAILED: ', '')}
                    </Typography>
                  ) : (
                    selectedDoc.raw_ocr_text || 'No text extracted.'
                  )}
                </Box>
              </Box>

              {selectedDoc.file_hash && (
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                  SHA-256 Checksum: {selectedDoc.file_hash}
                </Typography>
              )}

              {/* Version History Box */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Version History</Typography>
                {versionsLoading ? <CircularProgress size={20} /> : (
                  <TableContainer component={Card} variant="outlined" sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Version</TableCell>
                          <TableCell>Date</TableCell>
                          <TableCell>Integrity</TableCell>
                          <TableCell>Signature</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {versions.map(v => (
                          <TableRow key={v.id}>
                            <TableCell>{v.version_number} {v.is_current && <Chip label="Current" size="small" color="primary" sx={{ ml: 1, height: 20 }} />}</TableCell>
                            <TableCell>{new Date(v.created_at).toLocaleString()}</TableCell>
                            <TableCell>{v.is_tampered ? <Chip label="Tampered" color="error" size="small" sx={{ height: 20 }} /> : <Chip label="Verified" color="success" size="small" sx={{ height: 20 }} />}</TableCell>
                            <TableCell>
                              {v.is_signed ? (
                                <Chip icon={<VerifiedUserRounded sx={{ fontSize: '14px !important' }} />} label="Signed" color="success" size="small" onClick={() => handleVerifySignature(selectedDoc.id, v.id)} sx={{ cursor: 'pointer', height: 20, fontWeight: 700 }} />
                              ) : (
                                v.is_current ? (
                                  <Button size="small" variant="outlined" color="primary" onClick={() => { setVersionToSign(v.id); setOpenSignModal(true); setSignPassword(''); }} sx={{ height: 24, fontSize: '11px' }}>Sign</Button>
                                ) : null
                              )}
                            </TableCell>
                            <TableCell>
                              {!v.is_current && selectedDoc.status !== 'LOCKED' && (
                                <Button size="small" onClick={() => handleRestoreVersion(v.id)}>Restore</Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
                
                {selectedDoc.status !== 'LOCKED' && selectedDoc.status !== 'PROCESSING' && (
                   <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                     <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                     <Button size="small" variant="contained" onClick={handleUploadNewVersion} disabled={!file || uploading}>
                       {uploading ? <CircularProgress size={20} /> : 'Upload New Version'}
                     </Button>
                   </Box>
                )}
              </Box>

              {/* Audit History Box */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Audit History</Typography>
                {auditLoading ? <CircularProgress size={20} /> : (
                  <TableContainer component={Card} variant="outlined" sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date/Time</TableCell>
                          <TableCell>User</TableCell>
                          <TableCell>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {auditLogs.map(log => (
                          <TableRow key={log.id}>
                            <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                            <TableCell>{log.user_email}</TableCell>
                            <TableCell>
                              {log.action}
                              {log.details?.version_number && ` (v${log.details.version_number})`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setSelectedDoc(null); setReviewSubmitMode(false); }} color="inherit">Close</Button>
          {selectedDoc && (
            <Button variant="contained" startIcon={<DownloadRounded />} onClick={() => handleDownload(selectedDoc.id, selectedDoc.title)}>
              Download Original PDF
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Share Document Dialog */}
      {shareDoc && (
        <ShareDocumentDialog
          open={shareOpen}
          onClose={() => {
            setShareOpen(false);
            setShareDoc(null);
          }}
          documentId={shareDoc.id}
          documentTitle={shareDoc.title}
          classificationLevel={shareDoc.classification_level}
        />
      )}
      {/* Change Case Status Dialog */}
      <Dialog open={openCaseStatus} onClose={() => setOpenCaseStatus(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Case Status</DialogTitle>
        <DialogContent>
          {caseStatusError && <Alert severity="error" sx={{ mb: 2 }}>{caseStatusError}</Alert>}
          <Typography variant="body2" sx={{ mb: 3 }}>
            Current Status: <strong>{cases.find(c => c.id === caseId)?.status || 'CREATED'}</strong>
          </Typography>
          
          <TextField
            select
            label="New Status"
            fullWidth
            value={newCaseStatus}
            onChange={(e) => setNewCaseStatus(e.target.value)}
          >
            {(() => {
              const curr = cases.find(c => c.id === caseId)?.status || 'CREATED';
              const validTransitions: Record<string, string[]> = {
                "CREATED": ["INVESTIGATION"],
                "INVESTIGATION": ["UNDER_REVIEW"],
                "UNDER_REVIEW": ["APPROVED", "REJECTED"],
                "REJECTED": ["INVESTIGATION"],
                "APPROVED": ["CLOSED"],
                "CLOSED": []
              };
              const allowed = validTransitions[curr] || [];
              if (allowed.length === 0) return <MenuItem disabled value="">No valid transitions available</MenuItem>;
              return allowed.map(st => (
                <MenuItem key={st} value={st}>{st}</MenuItem>
              ));
            })()}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenCaseStatus(false)} color="inherit">Cancel</Button>
          <Button 
            onClick={handleUpdateCaseStatus} 
            variant="contained" 
            color="primary"
            disabled={!newCaseStatus || updatingCaseStatus}
          >
            {updatingCaseStatus ? <CircularProgress size={24} color="inherit" /> : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sign Document Modal */}
      <Dialog open={openSignModal} onClose={() => setOpenSignModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Sign Document</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            To cryptographically sign this document version, please authorize by re-entering your password.
            Your digital signature will be permanently attached to this version.
          </Typography>
          <TextField
            fullWidth
            type="password"
            label="Password"
            value={signPassword}
            onChange={(e) => setSignPassword(e.target.value)}
            size="small"
            onKeyPress={(e) => e.key === 'Enter' && handleSignDocument()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSignModal(false)} color="inherit">Cancel</Button>
          <Button onClick={handleSignDocument} variant="contained" color="primary" disabled={!signPassword || signing}>
            {signing ? <CircularProgress size={20} /> : 'Authorize & Sign'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Signature Details Modal */}
      <Dialog open={openSigModal} onClose={() => setOpenSigModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          {sigDetails?.status === 'VALID' ? <CheckCircleRounded color="success" /> : <BlockRounded color="error" />}
          Signature Verification
        </DialogTitle>
        <DialogContent dividers>
          {sigDetails ? (
            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" color="text.secondary">Status</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: sigDetails.status === 'VALID' ? 'success.main' : 'error.main' }}>
                  {sigDetails.status}
                </Typography>
              </Box>
              {sigDetails.status === 'VALID' ? (
                <>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Signer</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{sigDetails.signer}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Timestamp</Typography>
                    <Typography variant="body2">{new Date(sigDetails.timestamp).toLocaleString()}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Algorithm</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{sigDetails.algorithm}</Typography>
                  </Box>
                </>
              ) : (
                <Alert severity="error">{sigDetails.reason}</Alert>
              )}
            </Stack>
          ) : <CircularProgress />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSigModal(false)} color="inherit">Close</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

