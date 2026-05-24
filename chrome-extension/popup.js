document.addEventListener('DOMContentLoaded', () => {
  const syncStatus = document.getElementById('syncStatus');
  const meetingState = document.getElementById('meetingState');
  const gpsCoords = document.getElementById('gpsCoords');
  const gpsToggle = document.getElementById('gpsToggle');
  const muteToggle = document.getElementById('muteToggle');
  const btnRefresh = document.getElementById('btnRefresh');

  // Load saved settings
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['autoGps', 'meetingMute', 'isMeetingActive', 'lat', 'lng'], (data) => {
      if (data.autoGps !== undefined) gpsToggle.checked = data.autoGps;
      if (data.meetingMute !== undefined) muteToggle.checked = data.meetingMute;
      
      if (data.isMeetingActive) {
        meetingState.textContent = '📞 Active Virtual Call';
        meetingState.className = 'highlight meeting';
      } else {
        meetingState.textContent = 'No active calls';
        meetingState.className = 'highlight';
      }

      if (data.lat && data.lng) {
        gpsCoords.textContent = `${parseFloat(data.lat).toFixed(4)}, ${parseFloat(data.lng).toFixed(4)}`;
      }
    });
  }

  // Handle toggles
  gpsToggle.addEventListener('change', () => {
    chrome.storage.local.set({ autoGps: gpsToggle.checked });
  });

  muteToggle.addEventListener('change', () => {
    chrome.storage.local.set({ meetingMute: muteToggle.checked });
  });

  // Refresh status
  btnRefresh.addEventListener('click', () => {
    syncStatus.textContent = 'Syncing...';
    
    // Send a message to background.js to force check tabs
    chrome.runtime.sendMessage({ action: 'checkTabs' }, (response) => {
      setTimeout(() => {
        syncStatus.textContent = 'Synced';
        if (response && response.isMeetingActive) {
          meetingState.textContent = '📞 Active Virtual Call';
          meetingState.className = 'highlight meeting';
        } else {
          meetingState.textContent = 'No active calls';
          meetingState.className = 'highlight';
        }
      }, 500);
    });
  });
});
