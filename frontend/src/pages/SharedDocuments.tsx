import { API_BASE_URL } from "../config";
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  Typography,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Avatar,
  CircularProgress,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Alert
} from '@mui/material';
import {
  DescriptionRounded,
  VisibilityRounded,
  DownloadRounded,
  EditRounded,
  FolderSharedRounded,
  AutoAwesomeRounded,
  CloseRounded,
  ShieldRounded,
  CheckCircleRounded,
  BlockRounded,
  VerifiedUserRounded
} from '@mui/icons-material';

const CLEARANCE_LABELS: Record<number, string> = {
  1: 'Level 1: Restricted',
  2: 'Level 2: Confidential',
  3: 'Level 3: Secret',
  4: 'Level 4: Top Secret',
  5: 'Level 5: Executive'
};

const CLEARANCE_COLORS: Record<number, 'default' | 'info' | 'warning' | 'error' | 'success'> = {
  1: 'default', 2: 'info', 3: 'warning', 4: 'error', 5: 'success'
};
const CLEARANCE_SHORT: Record<number, string> = {
  1: 'L1', 2: 'L2', 3: 'L3', 4: 'L4', 5: 'L5'
};

export default function SharedDocuments() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // View Modal state
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [openSigModal, setOpenSigModal] = useState(false);
  const [sigDetails, setSigDetails] = useState<any | null>(null);
  const [integrityVerified, setIntegrityVerified] = useState<boolean | null>(null);
  const [integrityError, setIntegrityError] = useState('');
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkId = searchParams.get('id');

  const fetchDocuments = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`${API_BASE_URL}/documents/shared`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    
    // Initial fetch
    fetchDocuments(false);
    
    // Setup visibility-aware polling
    let intervalId: ReturnType<typeof setInterval> | null = null;
    
    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(() => fetchDocuments(true), 5000);
      }
    };
    
    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDocuments(true);
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (document.visibilityState === 'visible') {
      startPolling();
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredDocuments(documents);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredDocuments(
        documents.filter(d => 
          d.title.toLowerCase().includes(q) || 
          d.case_number?.toLowerCase().includes(q) || 
          d.document_type.toLowerCase().includes(q) ||
          d.shared_by.toLowerCase().includes(q)
        )
      );
    }
  }, [searchQuery, documents]);

  const handleViewDetails = async (doc: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${doc.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedDoc(await res.json());
        fetchVersions(doc.id);
        fetchAuditHistory(doc.id);
      } else {
        alert("Failed to load details or access denied.");
      }
    } catch (e) {
      console.error("Failed to load details:", e);
    }
  };

  const fetchVersions = async (docId: string) => {
    setVersionsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${docId}/versions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setVersions(await res.json());
    } catch (e) {
      console.error(e);
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
      if (res.ok) setAuditLogs(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setAuditLoading(false);
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
      } else {
        const err = await res.json();
        setIntegrityError(err.detail || 'Verification failed');
      }
    } catch (e) {
      setIntegrityError('Error verifying integrity');
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

  useEffect(() => {
    if (deepLinkId && documents.length > 0) {
      const doc = documents.find(d => d.id === deepLinkId);
      if (doc) {
        handleViewDetails(doc);
        searchParams.delete('id');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [deepLinkId, documents, searchParams, setSearchParams]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', mb: 4, flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 0 } }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5, display: 'flex', alignItems: 'center' }}>
            Shared Documents
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Documents explicitly shared with you by other officers
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          placeholder="Search shared documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          fullWidth
          sx={{ bgcolor: 'background.paper', borderRadius: 2 }}
        />
      </Box>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Document</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Shared By</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Shared On</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Permission</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Classification</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Case Reference</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ p: 5 }}><CircularProgress size={28} /></TableCell></TableRow>
              ) : filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 8 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <FolderSharedRounded sx={{ fontSize: 64, color: 'text.disabled', mb: 2, opacity: 0.5 }} />
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        No Shared Documents
                      </Typography>
                      <Typography variant="body2" color="text.disabled">
                        Documents shared with you will appear here.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocuments.map((doc) => {
                  const canDownload = doc.permission_type === 'DOWNLOAD' || doc.permission_type === 'EDIT';
                  const canEdit = doc.permission_type === 'EDIT';
                  
                  return (
                    <TableRow 
                      key={doc.id}
                      hover
                      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar sx={{ bgcolor: 'rgba(142, 51, 255, 0.08)', color: '#8e33ff', borderRadius: 2 }}>
                            <DescriptionRounded />
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{doc.title}</Typography>
                            <Typography variant="caption" color="text.secondary">{doc.document_type}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{doc.shared_by}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{doc.shared_at ? new Date(doc.shared_at).toLocaleString() : '-'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={doc.permission_type} 
                          size="small" 
                          sx={{ 
                            bgcolor: 'rgba(142, 51, 255, 0.08)', 
                            color: '#8e33ff', 
                            fontWeight: 700, 
                            fontSize: '0.75rem' 
                          }} 
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={CLEARANCE_SHORT[doc.classification_level] || 'L1'} 
                          size="small" 
                          color={CLEARANCE_COLORS[doc.classification_level] || 'default'}
                          sx={{ fontWeight: 600, fontSize: '0.75rem' }} 
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{doc.case_number}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View Details">
                          <IconButton color="primary" onClick={() => handleViewDetails(doc)}>
                            <VisibilityRounded />
                          </IconButton>
                        </Tooltip>
                        {canDownload && (
                          <Tooltip title="Download PDF">
                            <IconButton color="primary" onClick={() => window.open(`${API_BASE_URL}/documents/${doc.id}/download?token=${token}`, '_blank')}>
                              <DownloadRounded />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canEdit && (
                          <Tooltip title="Edit Document">
                            <IconButton color="secondary" onClick={() => window.alert('Edit feature currently available via normal document workflow.')}>
                              <EditRounded />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={Boolean(selectedDoc)} onClose={() => { setSelectedDoc(null); setIntegrityVerified(false); setIntegrityError(''); }} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeRounded color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{selectedDoc?.title}</Typography>
          </Box>
          <IconButton onClick={() => { setSelectedDoc(null); setIntegrityVerified(false); setIntegrityError(''); }} size="small"><CloseRounded /></IconButton>
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

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button variant="outlined" size="small" color="info" onClick={handleVerifyIntegrity} startIcon={<ShieldRounded />}>Verify Integrity</Button>
                  {integrityVerified && (
                    <Chip icon={<CheckCircleRounded sx={{ fontSize: '16px !important' }} />} label="Integrity Verified" color="success" size="small" sx={{ fontWeight: 700 }} />
                  )}
                </Box>
              </Box>

              {integrityError && (
                <Alert severity="error">
                  <strong>Verification Failed:</strong> {integrityError}
                </Alert>
              )}

              {/* Structured Metadata Box */}
              {selectedDoc.structured_data && Object.keys(selectedDoc.structured_data).length > 0 && (
                <Card sx={{ p: 2.5, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AutoAwesomeRounded sx={{ fontSize: 18 }} /> AI-Extracted Structured Metadata
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                    {Object.entries(selectedDoc.structured_data).map(([key, val]) => {
                      if (val === null || val === undefined || val === '') return null;
                      const formattedKey = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                      const formattedVal = Array.isArray(val) ? val.join(', ') : String(val);
                      return (
                        <Typography variant="body2" key={key}>
                          <strong>{formattedKey}:</strong> {formattedVal}
                        </Typography>
                      );
                    })}
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
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {versions.map(v => (
                          <TableRow key={v.id}>
                            <TableCell>{v.version_number} {v.is_current && <Chip label="Current" size="small" color="primary" sx={{ ml: 1, height: 20 }} />}</TableCell>
                            <TableCell>{new Date(v.created_at).toLocaleString()}</TableCell>
                            <TableCell>{v.is_tampered ? <Chip label="Tampered" color="error" size="small" sx={{ height: 20 }} /> : <Chip label="Verified" color="success" size="small" sx={{ height: 20 }} />}</TableCell>
                            <TableCell>
                              {v.is_signed && (
                                <Chip icon={<VerifiedUserRounded sx={{ fontSize: '14px !important' }} />} label="Signed" color="success" size="small" onClick={() => handleVerifySignature(selectedDoc.id, v.id)} sx={{ cursor: 'pointer', height: 20, fontWeight: 700 }} />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
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
          <Button onClick={() => setSelectedDoc(null)} color="inherit">Close</Button>
          {selectedDoc && (
            <Button variant="contained" startIcon={<DownloadRounded />} onClick={() => handleDownload(selectedDoc.id, selectedDoc.title)}>
              Download Original PDF
            </Button>
          )}
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
              <Box>
                <Typography variant="caption" color="text.secondary">Signed By</Typography>
                <Typography variant="body2">{sigDetails.signer_email} ({sigDetails.signer_role})</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Signed At</Typography>
                <Typography variant="body2">{new Date(sigDetails.signed_at).toLocaleString()}</Typography>
              </Box>
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
