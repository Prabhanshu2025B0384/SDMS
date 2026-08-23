import { createTheme, alpha } from '@mui/material/styles';

const grey = {
  0: '#FFFFFF',
  100: '#F9FAFB',
  200: '#F4F6F8',
  300: '#DFE3E8',
  400: '#C4CDD5',
  500: '#919EAB',
  600: '#637381',
  700: '#454F5B',
  800: '#212B36',
  900: '#161C24',
};

const primary = {
  lighter: '#C8FAD6',
  light: '#5BE49B',
  main: '#00A76F',
  dark: '#007867',
  darker: '#004B50',
  contrastText: '#FFFFFF',
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary,
    grey,
    text: {
      primary: grey[800],
      secondary: grey[600],
      disabled: grey[500],
    },
    background: {
      paper: '#FFFFFF',
      default: grey[100],
    },
    divider: alpha(grey[500], 0.2),
    action: {
      hover: alpha(grey[500], 0.08),
      selected: alpha(grey[500], 0.16),
      disabled: alpha(grey[500], 0.8),
      disabledBackground: alpha(grey[500], 0.24),
      focus: alpha(grey[500], 0.24),
      hoverOpacity: 0.08,
      disabledOpacity: 0.48,
    },
  },
  typography: {
    fontFamily: '"Public Sans", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    h1: { fontWeight: 800, lineHeight: 80 / 64, fontSize: '4rem' },
    h2: { fontWeight: 800, lineHeight: 64 / 48, fontSize: '3rem' },
    h3: { fontWeight: 700, lineHeight: 1.5, fontSize: '2rem' },
    h4: { fontWeight: 700, lineHeight: 1.5, fontSize: '1.5rem' },
    h5: { fontWeight: 700, lineHeight: 1.5, fontSize: '1.25rem' },
    h6: { fontWeight: 700, lineHeight: 28 / 18, fontSize: '1.125rem' },
    subtitle1: { fontWeight: 600, lineHeight: 1.5, fontSize: '1rem' },
    subtitle2: { fontWeight: 600, lineHeight: 22 / 14, fontSize: '0.875rem' },
    body1: { lineHeight: 1.5, fontSize: '1rem' },
    body2: { lineHeight: 22 / 14, fontSize: '0.875rem' },
    button: { fontWeight: 700, lineHeight: 24 / 14, fontSize: '0.875rem', textTransform: 'none' },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': {
          boxSizing: 'border-box',
        },
        html: {
          margin: 0,
          padding: 0,
          width: '100%',
          height: '100%',
          WebkitOverflowScrolling: 'touch',
        },
        body: {
          margin: 0,
          padding: 0,
          width: '100%',
          height: '100%',
          backgroundColor: grey[100],
        },
        '#root': {
          width: '100%',
          height: '100%',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
        },
        sizeLarge: {
          height: 48,
        },
        contained: {
          boxShadow: `0 8px 16px 0 ${alpha(primary.main, 0.24)}`,
          '&:hover': {
            boxShadow: `0 8px 16px 0 ${alpha(primary.main, 0.32)}`,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: `0 0 2px 0 ${alpha(grey[500], 0.2)}, 0 12px 24px -4px ${alpha(grey[500], 0.12)}`,
          zIndex: 0,
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#FFFFFF', 0.8),
          backdropFilter: 'blur(6px)',
          boxShadow: 'none',
          color: grey[800],
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: `1px dashed ${alpha(grey[500], 0.24)}`,
          backgroundColor: grey[100],
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(grey[500], 0.32),
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderWidth: 1,
            borderColor: grey[800],
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          boxShadow: `0 0 2px 0 ${alpha(grey[500], 0.2)}, 0 24px 48px -12px ${alpha(grey[500], 0.24)}`,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontWeight: 700,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: grey[600],
          backgroundColor: alpha(grey[500], 0.12),
          fontWeight: 600,
        },
      },
    },
  },
});
