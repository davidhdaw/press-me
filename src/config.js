// API Configuration
// This allows the app to work on both localhost and Vercel deployment
const getApiUrl = () => {
  // If we're running on localhost, use localhost (for development)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  
  // For Vercel deployment, use the Vercel API URL
  return 'https://press-me.vercel.app/api';
};

export const API_BASE_URL = getApiUrl();
