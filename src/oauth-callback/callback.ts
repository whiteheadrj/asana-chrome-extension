/**
 * OAuth callback page script
 * Extracts the authorization code from URL and sends it to the service worker
 */

const statusEl = document.getElementById('status');
const spinnerEl = document.getElementById('spinner');

function showError(message: string) {
  if (spinnerEl) spinnerEl.style.display = 'none';
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = 'error';
  }
}

// Extract code from URL
const params = new URLSearchParams(window.location.search);
const code = params.get('code');
const error = params.get('error');
const errorDescription = params.get('error_description');

if (error) {
  showError(errorDescription || `Authentication error: ${error}`);
} else if (!code) {
  showError('No authorization code received');
} else {
  // Send the code to the service worker
  chrome.runtime.sendMessage(
    { type: 'OAUTH_CALLBACK', code },
    (response) => {
      if (chrome.runtime.lastError) {
        showError(`Error: ${chrome.runtime.lastError.message}`);
        return;
      }

      if (response?.success) {
        if (statusEl) statusEl.textContent = 'Authentication successful! Closing...';
        // Close this tab after a brief delay
        setTimeout(() => window.close(), 500);
      } else {
        showError(response?.error || 'Authentication failed');
      }
    }
  );
}
