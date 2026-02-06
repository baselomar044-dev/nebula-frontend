// ============================================
// NEBULA AI - Configuration
// ============================================

const CONFIG = {
  // Backend API URL (Railway deployment)
  API_URL: 'https://nebula-api-production.up.railway.app',
  
  // App settings
  APP_NAME: 'Nebula AI',
  VERSION: '2.0.0',
  
  // Feature flags
  FEATURES: {
    AI_CHAT: true,
    FILE_UPLOAD: true,
    PROJECT_EXPORT: true,
    DEPLOY: true,
    DARK_MODE: true,
    BILINGUAL: true // EN/AR support
  }
};

// Make available globally
window.NEBULA_CONFIG = CONFIG;
