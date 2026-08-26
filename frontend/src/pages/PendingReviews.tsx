import { API_BASE_URL } from "../config";
import { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Button, 
  Chip,
  Alert
} from '@mui/material';
import { PendingActionsRounded, VisibilityRounded } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CLEARANCE_SHORT: Record<number, string> = {
  1: 'L1', 2: 'L2', 3: 'L3', 4: 'L4', 5: 'L5-EXEC'
};

const CLEARANCE_COLORS: Record<number, 'default' | 'success' | 'warning' | 'error' | 'primary' | 'secondary' | 'info'> = {
  1: 'default', 2: 'info', 3: 'warning', 4: 'error', 5: 'success'
};

export default function PendingReviews() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { token } = useAuth();

  useEffect(() => {
    if (token) {
      fetchReviews();
    }
  }, [token]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/documents/pending-reviews`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      } else {
        throw new Error('Failed to load pending reviews');
      }
    } catch (err: any) {
      setError('Failed to load pending reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (documentId: string) => {
    navigate(`/documents?id=${documentId}`);
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <PendingActionsRounded sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary' }}>
            Pending Reviews
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Documents submitted to you for approval
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      )}

      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Table>
          <TableHead sx={{ bgcolor: 'rgba(145, 158, 171, 0.08)' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Document Title</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Classification</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Submitted By</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Submitted At</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>Loading reviews...</TableCell>
              </TableRow>
            ) : reviews.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                  <Typography variant="h6" color="text.secondary">You have no pending reviews.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              reviews.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {r.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ID: {r.document_id.slice(0, 8)}...
                    </Typography>
                  </TableCell>
                  <TableCell>{r.document_type}</TableCell>
                  <TableCell>
                    <Chip 
                      label={CLEARANCE_SHORT[r.classification_level] || 'L1'} 
                      size="small" 
                      color={CLEARANCE_COLORS[r.classification_level] || 'default'}
                      sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                    />
                  </TableCell>
                  <TableCell>{r.requester_email}</TableCell>
                  <TableCell>
                    {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell align="right">
                    <Button 
                      variant="contained" 
                      size="small" 
                      startIcon={<VisibilityRounded />}
                      onClick={() => handleReview(r.document_id)}
                      sx={{ textTransform: 'none', borderRadius: 2 }}
                    >
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
