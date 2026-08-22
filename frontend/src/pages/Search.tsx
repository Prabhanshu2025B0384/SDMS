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
  CircularProgress
} from '@mui/material';
import { SearchRounded, DescriptionRounded } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 2) {
        setLoading(true);
        try {
          const res = await fetch(`http://127.0.0.1:8000/search/documents?query=${query}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            setResults(await res.json());
          }
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 500); // Debounce search 500ms

    return () => clearTimeout(delayDebounceFn);
  }, [query, token]);

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 5 }}>Advanced Document Search</Typography>
      
      <TextField
        fullWidth
        placeholder="Search for cases, individuals, or keywords..."
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
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchRounded color="action" />
            </InputAdornment>
          ),
          endAdornment: loading ? <CircularProgress size={20} color="inherit" /> : null
        }}
      />

      <Box sx={{ mt: 5 }}>
        {query.length > 0 && query.length <= 2 && (
          <Typography color="text.secondary" align="center">Type at least 3 characters to search</Typography>
        )}
        
        {results.length > 0 && (
          <Card>
            <List disablePadding>
              {results.map((result, index) => (
                <div key={result.id}>
                  <ListItem sx={{ p: 3, flexDirection: 'column', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <DescriptionRounded color="primary" sx={{ mr: 1, fontSize: 20 }} />
                      <Typography variant="subtitle1">{result.title} (Case: {result.case_id})</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ pl: 3.5, fontStyle: 'italic' }}>
                      Status: {result.status}
                    </Typography>
                    <Box sx={{ pl: 3.5, mt: 1.5 }}>
                      <Button size="small" variant="outlined" sx={{ borderRadius: 1 }}>View Document</Button>
                    </Box>
                  </ListItem>
                  {index < results.length - 1 && <Divider />}
                </div>
              ))}
            </List>
          </Card>
        )}
        {query.length > 2 && results.length === 0 && !loading && (
          <Typography color="text.secondary" align="center">No documents found matching "{query}"</Typography>
        )}
      </Box>
    </Box>
  );
}
