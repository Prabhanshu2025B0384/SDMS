import { API_BASE_URL } from "../config";
import { useState, useEffect } from 'react';
import { 
  Box, 
  Card, 
  Typography, 
  InputAdornment, 
  TextField, 
  List, 
  ListItem, 
  Divider, 
  Button, 
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  MenuItem
} from '@mui/material';
import { 
  SearchRounded, 
  DescriptionRounded, 
  DownloadRounded, 
  VisibilityRounded, 
  CloseRounded,
  ShieldRounded,
  AutoAwesomeRounded,
  CheckCircleRounded,
  ShareRounded
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import ShareDocumentDialog from '../components/ShareDocumentDialog';

export default function Search() {
  const [query, setQuery] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<number | ''>('');
  const [typeFilter, setTypeFilter] = useState<string>('All Types');
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [documentToShare, setDocumentToShare] = useState<any | null>(null);
  
  const [versions, setVersions] = useState<any[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  
  const [integrityResult, setIntegrityResult] = useState<any | null>(null);
  const [verifyingIntegrity, setVerifyingIntegrity] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const { token, user } = useAuth();

  const CLEARANCE_LABELS: Record<number, string> = {
    1: 'L1 – Restricted', 2: 'L2 – Confidential', 3: 'L3 – Secret', 4: 'L4 – Top Secret', 5: 'L5 – Executive'
  };
  
  const DOCUMENT_TYPES = [
    "FIR", "Evidence Log", "Investigation Report", "Forensic Report",
    "Witness Statement", "Charge Sheet", "Court Order", "Court Filing",
    "Legal Notice", "Judgment", "Other"
  ];

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      const isQueryValid = query.trim().length >= 2;
      const hasFilters = classificationFilter !== '' || typeFilter !== 'All Types';
      
      if (isQueryValid || hasFilters) {
        setLoading(true);
        setHasSearched(true);
        try {
          const params = new URLSearchParams();
          if (isQueryValid) params.append('query', query.trim());
          if (classificationFilter !== '') params.append('classification_level', classificationFilter.toString());
          if (typeFilter !== 'All Types') params.append('document_type', typeFilter);

          const res = await fetch(`${API_BASE_URL}/search/documents?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            setResults(await res.json());
            setSearchError(null);
          } else {
            setSearchError(`Backend returned ${res.status}`);
          }
        } catch (e: any) {
          console.error("Search error:", e);
          setSearchError(e.message || "Failed to perform search");
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
        setHasSearched(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query, classificationFilter, typeFilter, token]);

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

  const handleViewDoc = async (docId: string) => {
    setViewLoading(true);
    setIntegrityResult(null);
    setFile(null);
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
      console.error(e);
    } finally {
      setViewLoading(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    if (!selectedDoc) return;
    setVerifyingIntegrity(true);
    setIntegrityResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${selectedDoc.id}/verify-integrity`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIntegrityResult(data);
        fetchVersions(selectedDoc.id);
        fetchAuditHistory(selectedDoc.id);
      } else {
        const err = await res.json();
        setIntegrityResult({ status: 'FAILED', error: err.detail || 'Verification failed' });
      }
    } catch (e) {
      setIntegrityResult({ status: 'FAILED', error: 'Error verifying integrity' });
    } finally {
      setVerifyingIntegrity(false);
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
        handleViewDoc(selectedDoc.id);
      } else {
        const err = await res.json();
        alert(err.detail || 'Restore failed');
      }
    } catch (e) {
      alert('Error restoring version');
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
        alert('New version uploaded successfully.');
        handleViewDoc(selectedDoc.id);
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
      if (!res.ok) throw new Error('Download failed. You may not be authorized.');
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

  return (
    <Box sx={{ maxWidth: 850, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 700 }}>Advanced Document Search</Typography>
      
      <TextField
        fullWidth
        placeholder="Search documents, case numbers, or extracted metadata (use commas to combine terms)..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: 'background.paper',
            boxShadow: '0 8px 16px 0 rgba(145, 158, 171, 0.16)',
            borderRadius: 2,
            fieldset: { border: 'none' }
          }
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded color="action" />
              </InputAdornment>
            ),
            endAdornment: loading ? <CircularProgress size={20} color="inherit" /> : null
          }
        }}
      />

      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
        <TextField
          select
          size="small"
          label="Classification"
          value={classificationFilter}
          onChange={(e) => setClassificationFilter(e.target.value as any)}
          sx={{ minWidth: 200, bgcolor: 'background.paper' }}
        >
          <MenuItem value="">All Levels</MenuItem>
          {[1, 2, 3, 4, 5].filter(l => l <= (user?.clearance_level || 1)).map(level => (
            <MenuItem key={level} value={level}>{CLEARANCE_LABELS[level]}</MenuItem>
          ))}
        </TextField>
        
        <TextField
          select
          size="small"
          label="Document Type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          sx={{ minWidth: 200, bgcolor: 'background.paper' }}
        >
          <MenuItem value="All Types">All Types</MenuItem>
          {DOCUMENT_TYPES.map(type => (
            <MenuItem key={type} value={type}>{type}</MenuItem>
          ))}
        </TextField>
      </Box>

      <Box sx={{ mt: 4 }}>
        {query.length > 0 && query.length < 2 && classificationFilter === '' && typeFilter === 'All Types' && (
          <Typography color="text.secondary" align="center">Type at least 2 characters to search</Typography>
        )}
        
        {results.length > 0 && (
          <Card sx={{ mt: 2 }}>
            <List disablePadding>
              {results.map((result, index) => (
                <Box key={result.id}>
                  <ListItem sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <DescriptionRounded color="primary" sx={{ mr: 1.5, fontSize: 24 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{result.title}</Typography>
                      </Box>
                      <Chip label={result.document_type || 'Document'} size="small" sx={{ bgcolor: 'rgba(145, 158, 171, 0.16)' }} />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ pl: 4.5 }}>
                      Case ID: <span style={{ fontFamily: 'monospace' }}>{result.case_id}</span> • Status: <Chip label={result.status} size="small" color={result.status === 'READY' ? 'success' : 'warning'} sx={{ height: 20, fontSize: 11, ml: 0.5 }} />
                    </Typography>
                    <Stack direction="row" spacing={1.5} sx={{ pl: 4.5, mt: 2 }}>
                      <Button 
                        size="small" 
                        variant="outlined" 
                        startIcon={<VisibilityRounded />} 
                        onClick={() => handleViewDoc(result.id)}
                        disabled={viewLoading}
                      >
                        View Details
                      </Button>
                      <Button 
                        size="small" 
                        variant="outlined" 
                        startIcon={<ShareRounded />}
                        onClick={() => {
                          setDocumentToShare(result);
                          setShareDialogOpen(true);
                        }}
                      >
                        Share
                      </Button>
                      <Button 
                        size="small" 
                        variant="outlined" 
                        color="secondary"
                        startIcon={<DownloadRounded />}
                        onClick={() => handleDownload(result.id, result.title)}
                      >
                        Download PDF
                      </Button>
                    </Stack>
                  </ListItem>
                  {index < results.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          </Card>
        )}
        {hasSearched && results.length === 0 && !loading && !searchError && (
          <Typography color="text.secondary" align="center" sx={{ mt: 4 }}>No documents found matching your criteria.</Typography>
        )}
        {searchError && (
          <Alert severity="error" sx={{ mt: 4 }}>Search Failed: {searchError}</Alert>
        )}
      </Box>

      {/* Document Details Modal */}
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
                <Chip label={`Status: ${selectedDoc.status}`} color={selectedDoc.status === 'READY' ? 'success' : selectedDoc.status === 'PROCESSING_FAILED' ? 'error' : 'warning'} />
                <Chip label={`Version: ${selectedDoc.version_number || '1.0'}`} variant="outlined" />
              </Box>

              {/* AI Metadata */}
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
                <Card sx={{ p: 2.5, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No structured metadata could be extracted from this document.
                  </Typography>
                </Card>
              )}

              {/* OCR Text */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Extracted Document Text</Typography>
                <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1.5, maxHeight: 240, overflowY: 'auto', fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', border: '1px solid', borderColor: 'divider' }}>
                  {selectedDoc.raw_ocr_text || 'No text extracted.'}
                </Box>
              </Box>

              {/* Integrity */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Integrity</Typography>
                <Card sx={{ p: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block', mb: 1 }}>
                    SHA-256 Hash: {selectedDoc.file_hash || 'N/A'}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      color="info" 
                      onClick={handleVerifyIntegrity} 
                      disabled={verifyingIntegrity || !selectedDoc.file_hash}
                      startIcon={<ShieldRounded />}
                    >
                      {verifyingIntegrity ? 'Verifying...' : 'Verify Integrity'}
                    </Button>
                    
                    {integrityResult && (
                      integrityResult.status === 'VERIFIED' ? (
                        <Chip icon={<CheckCircleRounded sx={{ fontSize: '16px !important' }} />} label="Integrity Verified" color="success" size="small" sx={{ fontWeight: 700 }} />
                      ) : (
                        <Alert severity="error" sx={{ py: 0, '& .MuiAlert-message': { py: 1 } }}>
                          <strong>Verification Failed:</strong> {integrityResult.error || 'Integrity Check Failed'}
                        </Alert>
                      )
                    )}
                  </Box>
                </Card>
              </Box>

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
                          <TableCell>Uploaded By</TableCell>
                          <TableCell>Integrity</TableCell>
                          <TableCell>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {versions.map(v => (
                          <TableRow key={v.id}>
                            <TableCell>{v.version_number} {v.is_current && <Chip label="CURRENT" size="small" color="primary" sx={{ ml: 1, height: 20 }} />}</TableCell>
                            <TableCell>{v.created_at ? new Date(v.created_at).toLocaleString() : 'Unknown'}</TableCell>
                            <TableCell>{v.created_by}</TableCell>
                            <TableCell>{v.is_tampered ? <Chip label="Tampered" color="error" size="small" sx={{ height: 20 }} /> : <Chip label="✓ Verified" color="success" size="small" sx={{ height: 20 }} />}</TableCell>
                            <TableCell>
                              {!v.is_current && selectedDoc.status !== 'LOCKED' && (
                                <Button size="small" onClick={() => handleRestoreVersion(v.id)}>RESTORE</Button>
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
                          <TableCell>Timestamp</TableCell>
                          <TableCell>User</TableCell>
                          <TableCell>Action</TableCell>
                          <TableCell>Version</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {auditLogs.map(log => (
                          <TableRow key={log.id}>
                            <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                            <TableCell>{log.user_email}</TableCell>
                            <TableCell>{log.action}</TableCell>
                            <TableCell>{log.details?.version_number || '-'}</TableCell>
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
              Download Current PDF
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {documentToShare && (
        <ShareDocumentDialog
          open={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
          documentId={documentToShare.id}
          documentTitle={documentToShare.title}
          classificationLevel={documentToShare.classification_level}
        />
      )}
    </Box>
  );
}
