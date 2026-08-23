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
  IconButton
} from '@mui/material';
import { SearchRounded, DescriptionRounded, DownloadRounded, VisibilityRounded, CloseRounded } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setLoading(true);
        try {
          const res = await fetch(`http://${window.location.hostname}:8000/search/documents?query=${encodeURIComponent(query.trim())}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            setResults(await res.json());
          }
        } catch (e) {
          console.error("Search error:", e);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query, token]);

  const handleViewDoc = async (docId: string) => {
    setViewLoading(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/documents/${docId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedDoc(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setViewLoading(false);
    }
  };

  const handleDownload = (docId: string, title: string) => {
    fetch(`http://${window.location.hostname}:8000/documents/${docId}/download`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch(err => alert("Download failed: " + err));
  };

  return (
    <Box sx={{ maxWidth: 850, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 700 }}>Advanced Document Search</Typography>
      
      <TextField
        fullWidth
        placeholder="Search for cases, FIRs, suspects, sections, or document text..."
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

      <Box sx={{ mt: 4 }}>
        {query.length > 0 && query.length < 2 && (
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
        {query.trim().length >= 2 && results.length === 0 && !loading && (
          <Typography color="text.secondary" align="center" sx={{ mt: 4 }}>No documents found matching "{query}"</Typography>
        )}
      </Box>

      {/* Document Details Modal */}
      <Dialog open={Boolean(selectedDoc)} onClose={() => setSelectedDoc(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{selectedDoc?.title}</Typography>
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

              {selectedDoc.structured_data && Object.keys(selectedDoc.structured_data).length > 0 && (
                <Card sx={{ p: 2.5, bgcolor: 'background.default' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: 'primary.main' }}>
                    AI-Extracted Structured Metadata
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                    <Typography variant="body2"><strong>FIR / Case No:</strong> {selectedDoc.structured_data.fir_number || 'N/A'}</Typography>
                    <Typography variant="body2"><strong>Incident Date:</strong> {selectedDoc.structured_data.incident_date || 'N/A'}</Typography>
                    <Typography variant="body2"><strong>Police Station:</strong> {selectedDoc.structured_data.police_station || 'N/A'}</Typography>
                    <Typography variant="body2"><strong>Complainant:</strong> {selectedDoc.structured_data.complainant || 'N/A'}</Typography>
                    <Typography variant="body2"><strong>Accused:</strong> {selectedDoc.structured_data.accused || 'N/A'}</Typography>
                    <Typography variant="body2"><strong>IPC Sections:</strong> {Array.isArray(selectedDoc.structured_data.ipc_sections) ? selectedDoc.structured_data.ipc_sections.join(', ') : selectedDoc.structured_data.ipc_sections || 'N/A'}</Typography>
                  </Box>
                </Card>
              )}

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Extracted Document Text</Typography>
                <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1.5, maxHeight: 240, overflowY: 'auto', fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                  {selectedDoc.raw_ocr_text || 'No text extracted.'}
                </Box>
              </Box>

              {selectedDoc.file_hash && (
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                  SHA-256 Hash: {selectedDoc.file_hash}
                </Typography>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSelectedDoc(null)} color="inherit">Close</Button>
          {selectedDoc && (
            <Button variant="contained" startIcon={<DownloadRounded />} onClick={() => handleDownload(selectedDoc.id, selectedDoc.title)}>
              Download PDF
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
