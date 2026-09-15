let apiUrl = import.meta.env.VITE_API_URL;

if (import.meta.env.PROD) {
  if (!apiUrl) {
    console.error("VITE_API_URL is missing in production. API calls will fail.");
    // In production, we don't fall back to localhost to prevent silent, dangerous bugs.
    apiUrl = "";
  }
} else {
  // Local development fallback
  if (!apiUrl) {
    apiUrl = "http://localhost:8080";
  }
}

// Remove trailing slash if present to avoid //api/...
if (apiUrl && apiUrl.endsWith('/')) {
  apiUrl = apiUrl.slice(0, -1);
}

export const API_BASE_URL = apiUrl;
