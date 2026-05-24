const BACKEND_URL = 'http://localhost:8080';
const USER_ID = 'dev_user_1';

// Initial storage configurations
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    autoGps: true,
    meetingMute: true,
    isMeetingActive: false,
    lat: -6.2088,
    lng: 106.8456
  });
  console.log('[DevAura] Background service worker initialized.');
  
  // Set up repeating alarm to check tabs every 20 seconds
  chrome.alarms.create('checkActiveTabsAlarm', { periodInMinutes: 0.33 });
});

// Watch tab updates
chrome.tabs.onUpdated.addListener(() => {
  scanMeetingTabs();
});

chrome.tabs.onRemoved.addListener(() => {
  scanMeetingTabs();
});

// Alarm triggers
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkActiveTabsAlarm') {
    scanMeetingTabs();
  }
});

// Message listener from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkTabs') {
    scanMeetingTabs().then((isActive) => {
      sendResponse({ isMeetingActive: isActive });
    });
    return true; // Keep response channel open asynchronously
  }
});

/**
 * Scans browser tabs for active conference platforms
 */
async function scanMeetingTabs() {
  return new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => {
      let isMeetingActive = false;
      const meetingUrls = ['meet.google.com', 'zoom.us', 'teams.microsoft.com', 'teams.live.com'];
      
      for (const tab of tabs) {
        if (tab.url) {
          const url = tab.url.toLowerCase();
          const matches = meetingUrls.some(pattern => url.includes(pattern));
          if (matches) {
            isMeetingActive = true;
            break;
          }
        }
      }

      chrome.storage.local.get(['isMeetingActive', 'meetingMute'], (data) => {
        const previousState = data.isMeetingActive || false;
        
        // If state shifts, report to the Flask backend!
        if (isMeetingActive !== previousState) {
          chrome.storage.local.set({ isMeetingActive });
          console.log(`[DevAura] Meeting Active state changed: ${isMeetingActive}`);
          
          if (data.meetingMute) {
            syncMeetingStateWithBackend(isMeetingActive);
          }
        }
        resolve(isMeetingActive);
      });
    });
  });
}

/**
 * Communicates browser meeting status to Cloud Run Flask Backend
 */
function syncMeetingStateWithBackend(isMeetingActive) {
  const url = `${BACKEND_URL}/event`;
  const payload = {
    userId: USER_ID,
    state: isMeetingActive ? 'meeting' : 'idle',
    isMeetingActive: isMeetingActive,
    keystrokes: 0,
    backspaces: 0,
    saves: 0,
    frustrationScore: 0
  };

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    console.log('[DevAura] Backend synchronized browser meeting state:', data);
  })
  .catch(err => {
    console.log('[DevAura] Offline or failed backend call:', err.message);
  });
}
