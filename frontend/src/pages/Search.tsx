import { useState } from 'react';
import { 
  Box, 
  Card, 
  Typography, 
  InputAdornment, 
  TextField,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button
} from '@mui/material';
import { SearchRounded, DescriptionRounded } from '@mui/icons-material';

export default function Search() {
  const [query, setQuery] = useState('');

  // Placeholder for search results
  const results = query.length > 2 ? [
    { id: '1', title: 'FIR Report - Case 101', snippet: '...the accused was found in possession of the stolen goods near the station...' },
    { id: '2', title: 'Witness Statement - Case 101', snippet: '...I saw the incident happen at approximately 9:00 PM on the 14th...' }
  ] : [];

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
                      <Typography variant="subtitle1">{result.title}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ pl: 3.5, fontStyle: 'italic' }}>
                      "{result.snippet}"
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
      </Box>
    </Box>
  );
}
