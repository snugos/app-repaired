// js/daw/welcome/welcomeUtils.js
// Utility functions specifically for the welcome page

/**
 * Creates the default desktop layout for SnugOS welcome screen
 * This function opens the initial application windows
 */
export function openDefaultLayout() {
  console.log("Opening default layout for SnugOS welcome page");
  
  setTimeout(() => {
    // This is a placeholder for opening default windows on the welcome screen
    // In the actual implementation, this could open file manager, browser, etc.
    const desktopEl = document.getElementById('desktop');
    if (!desktopEl) return;

    const rect = desktopEl.getBoundingClientRect();
    
    // For now, just log that the default layout is being opened
    console.log("Default welcome layout initialized with desktop dimensions:", {
      width: rect.width,
      height: rect.height
    });
    
    // You can add specific window opening logic here for the welcome screen
    // such as opening a welcome tutorial, file browser, or other initial applications
    
  }, 100);
}

/**
 * Initialize welcome page utilities
 * @param {Object} appServices - The main app services object
 */
export function initializeWelcomeUtils(appServices) {
  // Make openDefaultLayout available globally for the welcome page context
  window.openDefaultLayout = openDefaultLayout;
  
  // Add any other utility functions that the welcome page might need
  console.log("Welcome utilities initialized");
  
  return {
    openDefaultLayout
  };
}

/**
 * Get welcome page specific settings
 */
export function getWelcomeSettings() {
  return {
    showDesktopIcons: true,
    enableCustomBackground: true,
    autoLaunchDAW: false
  };
}

/**
 * Apply welcome page theme
 * @param {string} theme - Theme name ('light', 'dark', 'system')
 */
export function applyWelcomeTheme(theme) {
  const body = document.body;
  
  // Remove existing theme classes
  body.classList.remove('theme-light', 'theme-dark');
  
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = prefersDark ? 'dark' : 'light';
  }
  
  body.classList.add(`theme-${theme}`);
  console.log(`Applied welcome theme: ${theme}`);
}