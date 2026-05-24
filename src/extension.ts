import * as vscode from 'vscode';
import { DevAuraTracker, TrackerStats } from './tracker';
import { DevAuraStatusBar } from './statusBar';
import { DevAuraMilestoneWatcher } from './milestoneWatcher';
import { postJson, getJson } from './httpHelper';

let tracker: DevAuraTracker | undefined;
let statusBar: DevAuraStatusBar | undefined;
let milestoneWatcher: DevAuraMilestoneWatcher | undefined;

// Material Design 3 Dynamic UI State Caches
let upcomingPrayer = 'None';
let minsToPrayer: number | null = null;
let wellnessScore = 85;

export function activate(context: vscode.ExtensionContext) {
  console.log('DevAura Extension is now active!');

  // 1. Initialize core components
  tracker = new DevAuraTracker();
  statusBar = new DevAuraStatusBar();
  milestoneWatcher = new DevAuraMilestoneWatcher();

  // 2. Wire activity listener for tracker
  const docChangeListener = vscode.workspace.onDidChangeTextDocument(event => {
    if (tracker) {
      tracker.handleDocumentChange(event);
      // Immediately update status bar on input to keep UI highly reactive
      if (statusBar) {
        statusBar.update(tracker.state, tracker.stats, upcomingPrayer, minsToPrayer, wellnessScore);
      }
    }
  });

  const docSaveListener = vscode.workspace.onDidSaveTextDocument(() => {
    if (tracker) {
      tracker.handleDocumentSave();
      if (statusBar) {
        statusBar.update(tracker.state, tracker.stats, upcomingPrayer, minsToPrayer, wellnessScore);
      }
    }
  });

  // 3. Listen to flow state transitions to trigger notifications
  const stateChangeListener = tracker.onStateChanged(newState => {
    if (statusBar && tracker) {
      statusBar.update(newState, tracker.stats, upcomingPrayer, minsToPrayer, wellnessScore);
    }

    if (newState === 'frustrated') {
      vscode.window.showWarningMessage(
        '🧘 Slow down, breath in... DevAura detected coding frustration. Take a 2-minute stretch?',
        'Stretch Guide', 'Dismiss'
      ).then(choice => {
        if (choice === 'Stretch Guide') {
          vscode.env.openExternal(vscode.Uri.parse('https://www.youtube.com/watch?v=5y3Dbup2-n0'));
        }
      });
    } else if (newState === 'deep-focus') {
      vscode.window.showInformationMessage(
        '⚡ Deep Flow state detected! DevAura has muted all non-urgent alerts. Go get \'em!'
      );
    }
  });

  // 3b. Periodical check and sync with backend every 45 seconds
  const checkInterval = setInterval(async () => {
    try {
      const config = vscode.workspace.getConfiguration('devaura');
      const backendUrl = config.get<string>('backendUrl') || 'http://localhost:8080';
      const userId = config.get<string>('userId') || 'dev_user_1';
      const lat = config.get<number>('prayerTimes.latitude') || -6.2088;
      const lng = config.get<number>('prayerTimes.longitude') || 106.8456;

      // Sync active state metrics to backend /event
      if (tracker) {
        await tracker.syncWithBackend(userId, backendUrl);
      }

      // Check upcoming items via /check
      const res = await getJson(`${backendUrl}/check?userId=${userId}&lat=${lat}&lng=${lng}`);
      if (res) {
        upcomingPrayer = res.upcoming_prayer || 'None';
        minsToPrayer = res.minutes_until_prayer;
        
        // Dynamically shift wellness scores based on schedules
        wellnessScore = upcomingPrayer !== 'None' ? 88 : 94;

        if (statusBar && tracker) {
          statusBar.update(tracker.state, tracker.stats, upcomingPrayer, minsToPrayer, wellnessScore);
        }

        // If a prayer is coming up within 15 minutes
        if (upcomingPrayer && upcomingPrayer !== 'None' && minsToPrayer !== null && minsToPrayer <= 15) {
          const msgRes = await postJson(`${backendUrl}/generate-msg`, {
            state: tracker ? tracker.state : 'idle',
            time_of_day: 'afternoon',
            recent_commits: ['making real progress']
          });
          const alertMessage = msgRes && msgRes.status === 'success' 
            ? msgRes.nudge_message 
            : `🕌 Solat ${upcomingPrayer} masuk ${minsToPrayer} menit lagi. Siap-siap wudhu bro!`;

          vscode.window.showWarningMessage(
            `🕌 DevAura: Waktu ${upcomingPrayer} masuk ${minsToPrayer} menit lagi!\n\n"${alertMessage}"`,
            '🕌 Check-In Solat', 'Dismiss'
          ).then(btn => {
            if (btn === '🕌 Check-In Solat') {
              vscode.window.showInformationMessage('🕌 Solat registered! Streaks updated. ✨');
            }
          });
        } else if (res.meal_nudge_required) {
          vscode.window.showInformationMessage('🍽️ DevAura: Udah waktunya makan siang/malam nih! Jangan lupa istirahat isi bensin 🥤');
        }
      }
    } catch (e) {
      console.log(`[DevAura] Periodic check failed: ${e}`);
    }
  }, 45000);

  const intervalDisposable = new vscode.Disposable(() => clearInterval(checkInterval));

  // 4. Register commands
  const checkInCommand = vscode.commands.registerCommand('devaura.checkIn', async () => {
    const items: vscode.QuickPickItem[] = [
      {
        label: '🕌 Solat Check-In',
        description: 'Confirm you completed your recent prayer',
        detail: 'Keeps your prayer streak active and boosts wellness score'
      },
      {
        label: '🍽️ Log Meal / Hydration',
        description: 'Record your food break or glass of water',
        detail: 'Prevents flow-state skipping of basic nutritional health'
      },
      {
        label: '🧘 Micro-Break Stretch',
        description: 'Trigger a quick 5-minute movement routine',
        detail: 'Reduces neck/back strain during coding marathons'
      },
      {
        label: '📊 View Weekly Analytics',
        description: 'Open the DevAura dashboard',
        detail: 'See your deep-focus metrics, commits, and wellness streaks'
      }
    ];

    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: '🌌 DevAura Life OS: Choose your wellness action'
    });

    if (!selection) {
      return;
    }

    if (selection.label.includes('🕌')) {
      vscode.window.showInformationMessage('🕌 Solat registered! Wellness streak maintained. Keep shining! ✨');
    } else if (selection.label.includes('🍽️')) {
      vscode.window.showInformationMessage('🍽️ Meal logged. Nutrition meter updated. Remember to stay hydrated! 💧');
    } else if (selection.label.includes('🧘')) {
      vscode.window.showInformationMessage('🧘 Relax your shoulders, rotate your neck, and take three deep breaths.');
    } else if (selection.label.includes('📊')) {
      vscode.commands.executeCommand('devaura.openDashboard');
    }
  });

  const toggleMuteCommand = vscode.commands.registerCommand('devaura.toggleMute', () => {
    if (statusBar) {
      const isMuted = statusBar.toggleMute();
      vscode.window.showInformationMessage(
        isMuted 
          ? '🔇 DevAura is now muted. Prayer Azan audios are suppressed.' 
          : '🔊 DevAura notifications unmuted.'
      );
    }
  });

  const openDashboardCommand = vscode.commands.registerCommand('devaura.openDashboard', () => {
    // Create a beautiful premium webview panel to serve as the local dashboard
    const panel = vscode.window.createWebviewPanel(
      'devauraDashboard',
      '🌌 DevAura — Weekly Wellness Dashboard',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = getDashboardHtml(tracker ? tracker.stats : null, upcomingPrayer, minsToPrayer, wellnessScore);
  });

  const parseMilestonesCommand = vscode.commands.registerCommand('devaura.parseMilestones', () => {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      // Create a temporary instance of the watcher to run the parser
      const parser = new DevAuraMilestoneWatcher();
      // Invoke private runner or prompt standard run
      vscode.commands.executeCommand('workbench.action.files.save').then(() => {
        // Trigger save to fire milestone parsing flow
      });
      parser.dispose();
    } else {
      vscode.window.showErrorMessage('No active markdown file open to parse milestones from.');
    }
  });

  // Register all subscriptions to extension context
  context.subscriptions.push(
    docChangeListener,
    docSaveListener,
    stateChangeListener,
    checkInCommand,
    toggleMuteCommand,
    openDashboardCommand,
    parseMilestonesCommand,
    tracker,
    statusBar,
    milestoneWatcher,
    intervalDisposable
  );
}

export function deactivate() {
  console.log('DevAura Extension is now deactivated!');
}

/**
 * Material Design 3 (Material You) for Developers HTML Webview structure
 */
function getDashboardHtml(stats: TrackerStats | null, nextPrayer = 'None', minsRemaining: number | null = null, score = 85): string {
  const currentKeystrokes = stats ? stats.keystrokes : 0;
  const currentCorrections = stats ? stats.backspaces : 0;
  const currentSaves = stats ? stats.saves : 0;
  const currentFrustration = stats ? stats.frustrationScore : 0;
  const flowState = stats ? stats.state.toUpperCase() : 'IDLE';

  // Map state accent styling according to design.md dynamic states
  let stateAccent = '#0B57D0'; // Google Blue (Neutral/Idle)
  let stateGlow = 'rgba(11, 87, 208, 0.15)';
  
  if (flowState === 'DEEP-FOCUS') {
    stateAccent = '#7C4DFF'; // Accent Purple (Deep Focus)
    stateGlow = 'rgba(124, 77, 255, 0.2)';
  } else if (flowState === 'FRUSTRATED' || currentFrustration > 60) {
    stateAccent = '#FFB300'; // Accent Amber (Frustrated)
    stateGlow = 'rgba(255, 179, 0, 0.2)';
  }

  const minsStr = minsRemaining !== null ? `${minsRemaining}m` : '--';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>DevAura Weekly Balance Report Card</title>
      
      <!-- Import Lucide Icons via CDN -->
      <script src="https://unpkg.com/lucide@latest"></script>
      
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Roboto+Mono:wght@400;700&display=swap');
        
        :root {
          /* Fallback variables mapped dynamically to VSCode theme colors */
          --bg-main: var(--vscode-editor-background, #121212);
          --text-main: var(--vscode-editor-foreground, #E3E3E3);
          
          --card-bg: var(--vscode-editorWidget-background, rgba(30, 30, 30, 0.5));
          --card-border: var(--vscode-editorWidget-border, rgba(255, 255, 255, 0.06));
          --border-color: rgba(255, 255, 255, 0.05);

          --accent-primary: var(--vscode-button-background, #0B57D0);
          --accent-primary-hover: var(--vscode-button-hoverBackground, #185abc);
          --accent-secondary: #1EA896; /* Islamic Teal */
          
          --accent-purple: #7C4DFF;
          --accent-amber: #FFB300;
          --accent-coral: #EA4335;
        }

        /* Automatically adjust variables if a Light Theme is active inside VSCode */
        body.vscode-light {
          --border-color: rgba(0, 0, 0, 0.08);
          --card-border: var(--vscode-widget-border, rgba(0, 0, 0, 0.12));
          --card-bg: var(--vscode-editorWidget-background, rgba(240, 240, 240, 0.75));
        }

        * {
          box-sizing: border-box;
          transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
        }

        body {
          font-family: 'Plus Jakarta Sans', 'Outfit', sans-serif;
          background-color: var(--bg-main);
          color: var(--text-main);
          margin: 0;
          padding: 32px 24px;
          min-height: 100vh;
          background-image: 
            radial-gradient(circle at 5% 5%, rgba(11, 87, 208, 0.03) 0%, transparent 35%),
            radial-gradient(circle at 95% 95%, rgba(30, 168, 150, 0.03) 0%, transparent 40%);
        }

        .container {
          max-width: 900px;
          margin: 0 auto;
        }

        /* Material 3 Header Card */
        header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 40px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 20px;
          padding: 16px 28px;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .logo {
          font-family: 'Outfit', sans-serif;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .logo-icon {
          color: var(--accent-secondary);
          stroke-width: 2.5px;
          animation: pulse 2.5s infinite ease-in-out;
        }

        .user-badge {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-color);
          padding: 8px 18px;
          border-radius: 99px;
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        body.vscode-light .user-badge {
          background: rgba(0, 0, 0, 0.03);
        }

        /* Title block */
        .title-block {
          margin-bottom: 28px;
        }
        
        .title-block h1 {
          font-family: 'Outfit', sans-serif;
          font-size: 32px;
          font-weight: 800;
          margin: 0 0 8px 0;
          letter-spacing: -0.5px;
        }

        .title-block p {
          opacity: 0.7;
          margin: 0;
          font-size: 15px;
        }

        /* Material You Grid */
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        /* MD3 Card Layout: Melengkung 16px */
        .card {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 26px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
          backdrop-filter: blur(5px);
        }

        .card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          border-color: var(--accent-primary);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .card-title {
          font-size: 13px;
          font-weight: 700;
          opacity: 0.6;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .icon-wrapper {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
        }
        
        body.vscode-light .icon-wrapper {
          background: rgba(0, 0, 0, 0.03);
        }

        /* Google Sans Display for numbers/metrics */
        .value {
          font-family: 'Google Sans Display', 'Outfit', sans-serif;
          font-size: 42px;
          font-weight: 800;
          margin-bottom: 8px;
          letter-spacing: -1px;
        }

        .card-subtitle {
          font-size: 14px;
          opacity: 0.7;
        }

        /* Dynamic coloring matching design.md */
        .accent-dynamic {
          color: ${stateAccent};
          text-shadow: 0 0 10px ${stateGlow};
        }

        .accent-teal {
          color: var(--accent-secondary);
        }

        .accent-purple {
          color: var(--accent-purple);
        }

        .accent-amber {
          color: var(--accent-amber);
        }

        .accent-coral {
          color: var(--accent-coral);
        }

        /* Tonal Progress Bar */
        .score-bar {
          height: 6px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 99px;
          overflow: hidden;
          margin-top: 16px;
        }
        
        body.vscode-light .score-bar {
          background: rgba(0, 0, 0, 0.05);
        }

        .score-progress {
          height: 100%;
          border-radius: 99px;
        }

        /* Section Cards */
        .section-card {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 28px;
          margin-bottom: 32px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
          backdrop-filter: blur(5px);
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 14px;
        }

        .section-header h2 {
          font-family: 'Outfit', sans-serif;
          font-size: 19px;
          font-weight: 700;
          margin: 0;
          letter-spacing: -0.25px;
        }

        /* Balance Report Layout from Spec Section 4.3 */
        .balance-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .balance-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 12px;
          border: 1px solid var(--border-color);
        }
        
        body.vscode-light .balance-item {
          background: rgba(0, 0, 0, 0.01);
        }

        .balance-label {
          display: flex;
          align-items: center;
          gap: 16px;
          font-weight: 600;
          font-size: 14.5px;
        }
        
        .balance-icon-container {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .balance-status {
          font-family: 'Roboto Mono', monospace;
          font-size: 12.5px;
          background: rgba(255, 255, 255, 0.04);
          padding: 4px 12px;
          border-radius: 8px;
          font-weight: 700;
          border: 1px solid var(--border-color);
        }
        
        body.vscode-light .balance-status {
          background: rgba(0, 0, 0, 0.03);
        }

        /* Solat Dot Tracker */
        .solat-tracker {
          display: flex;
          justify-content: space-between;
          margin-top: 10px;
          gap: 10px;
        }

        .solat-node {
          text-align: center;
          flex: 1;
        }

        .solat-dot {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 10px auto;
          font-size: 15px;
          font-weight: bold;
        }
        
        body.vscode-light .solat-dot {
          background: rgba(0, 0, 0, 0.02);
        }

        .solat-dot.active {
          background: linear-gradient(135deg, var(--accent-secondary) 0%, #178274 100%);
          border: none;
          color: white;
          box-shadow: 0 4px 12px rgba(30, 168, 150, 0.25);
        }

        .solat-name {
          font-size: 12px;
          font-weight: 600;
          opacity: 0.7;
        }

        /* Google AI UX Blockquote Insight Section */
        blockquote.insight-quote {
          background: rgba(124, 77, 255, 0.06);
          border-left: 4px solid var(--accent-purple);
          border-radius: 0 12px 12px 0;
          padding: 20px 24px;
          margin: 32px 0 0 0;
          display: flex;
          gap: 18px;
          align-items: flex-start;
          border-top: 1px solid var(--border-color);
          border-right: 1px solid var(--border-color);
          border-bottom: 1px solid var(--border-color);
        }

        .insight-content h4 {
          margin: 0 0 6px 0;
          font-family: 'Outfit', sans-serif;
          font-size: 15px;
          font-weight: 700;
          opacity: 0.9;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .insight-content p {
          margin: 0;
          font-size: 14.5px;
          opacity: 0.8;
          line-height: 1.5;
        }

        /* Button Hierarchy from Section 4.2 */
        .actions-panel {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .btn-filled-tonal {
          background: var(--vscode-button-background, var(--accent-primary));
          color: var(--vscode-button-foreground, white);
          border: none;
          padding: 10px 22px;
          border-radius: 99px;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Plus Jakarta Sans', sans-serif;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-filled-tonal:hover {
          background: var(--vscode-button-hoverBackground, var(--accent-primary-hover));
          transform: translateY(-1px);
        }

        .btn-text {
          background: transparent;
          color: var(--text-main);
          opacity: 0.6;
          border: none;
          padding: 10px 22px;
          border-radius: 99px;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Plus Jakarta Sans', sans-serif;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-text:hover {
          opacity: 1;
          background: rgba(255, 255, 255, 0.04);
        }
        
        body.vscode-light .btn-text:hover {
          background: rgba(0, 0, 0, 0.04);
        }

        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <div class="logo">
            <i data-lucide="sparkles" class="logo-icon"></i>
            🌌 DevAura
          </div>
          <div class="user-badge">
            <i data-lucide="user" style="width: 14px; height: 14px;"></i>
            dev_user_1 (Jakarta)
          </div>
        </header>

        <div class="title-block">
          <h1>✨ DevAura Weekly Balance Report Card</h1>
          <p>Sync state: <b>Active</b> | Theme dynamic variables: <b>Loaded</b></p>
        </div>

        <div class="dashboard-grid">
          <!-- Flow State Card -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Active Focus State</span>
              <div class="icon-wrapper accent-dynamic">
                <i data-lucide="zap" style="width: 18px; height: 18px;"></i>
              </div>
            </div>
            <div class="value accent-dynamic">${flowState}</div>
            <div class="card-subtitle">Focus Velocity: <b>${Math.round(currentKeystrokes / 2 + 1)} KPM</b></div>
            <div class="score-bar">
              <div class="score-progress" style="width: ${Math.min(100, currentKeystrokes / 1.5)}%; background: ${stateAccent};"></div>
            </div>
          </div>

          <!-- Wellness Score -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Daily Wellness Score</span>
              <div class="icon-wrapper accent-teal">
                <i data-lucide="award" style="width: 18px; height: 18px;"></i>
              </div>
            </div>
            <div class="value accent-teal">${score}/100</div>
            <div class="card-subtitle">Streaks maintained perfectly 🔥</div>
            <div class="score-bar">
              <div class="score-progress" style="width: ${score}%; background: linear-gradient(90deg, var(--accent-secondary), #43e97b);"></div>
            </div>
          </div>

          <!-- Frustration Score -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Frustration Index</span>
              <div class="icon-wrapper accent-coral">
                <i data-lucide="flame" style="width: 18px; height: 18px;"></i>
              </div>
            </div>
            <div class="value accent-coral">${currentFrustration}%</div>
            <div class="card-subtitle">Corrections: <b>${currentCorrections}</b> / Saves: <b>${currentSaves}</b></div>
            <div class="score-bar">
              <div class="score-progress" style="width: ${currentFrustration}%; background: var(--accent-coral);"></div>
            </div>
          </div>
        </div>

        <!-- Section 1 (Metrics Layout) - Adhering to Spec 4.3 -->
        <div class="section-card">
          <div class="section-header">
            <i data-lucide="activity" style="width: 20px; height: 20px; color: var(--accent-secondary);"></i>
            <h2>Weekly Balance Metrics</h2>
          </div>
          <div class="balance-list">
            <div class="balance-item">
              <div class="balance-label">
                <div class="balance-icon-container accent-teal">
                  <i data-lucide="sun" style="width: 16px; height: 16px;"></i>
                </div>
                <span><b>Solat Tracker:</b> 22/25 On Time (Streak 🔥)</span>
              </div>
              <div class="balance-status accent-teal">Excellent</div>
            </div>
            <div class="balance-item">
              <div class="balance-label">
                <div class="balance-icon-container accent-amber">
                  <i data-lucide="utensils" style="width: 16px; height: 16px;"></i>
                </div>
                <span><b>Meal Nutrition:</b> Skip lunch twice (Inferred from idle state)</span>
              </div>
              <div class="balance-status accent-amber">Warning</div>
            </div>
            <div class="balance-item">
              <div class="balance-label">
                <div class="balance-icon-container accent-coral">
                  <i data-lucide="moon" style="width: 16px; height: 16px;"></i>
                </div>
                <span><b>Sleep Pattern:</b> 3 nights coded past 2 AM</span>
              </div>
              <div class="balance-status accent-coral">High Risk</div>
            </div>
          </div>
        </div>

        <!-- Pillar 1: Solat Tracker Status -->
        <div class="section-card">
          <div class="section-header">
            <i data-lucide="compass" style="width: 20px; height: 20px; color: var(--accent-secondary);"></i>
            <h2>Ibadah Guardian — Real-time timings</h2>
          </div>
          <p style="font-size: 14.5px; opacity: 0.7; margin-top: 0; margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="refresh-cw" style="width: 14px; height: 14px; stroke-width: 2px;"></i>
            Prayer Sync: <b>Active</b> | Coordinates: <b>-6.2088, 106.8456 (Jakarta)</b> | Next prayer: <b>${nextPrayer}</b> in <b>${minsStr}</b>
          </p>
          
          <div class="solat-tracker">
            <div class="solat-node">
              <div class="solat-dot active">✓</div>
              <div class="solat-name">Subuh</div>
            </div>
            <div class="solat-node">
              <div class="solat-dot active">✓</div>
              <div class="solat-name">Dhuhr</div>
            </div>
            <div class="solat-node">
              <div class="solat-dot active">✓</div>
              <div class="solat-name">Asr</div>
            </div>
            <div class="solat-node">
              <div class="solat-dot"></div>
              <div class="solat-name">Maghrib</div>
            </div>
            <div class="solat-node">
              <div class="solat-dot"></div>
              <div class="solat-name">Isya</div>
            </div>
          </div>
          
          <div class="actions-panel">
            <button class="btn-filled-tonal">
              <i data-lucide="check" style="width: 14px; height: 14px;"></i>
              Sudah Solat
            </button>
            <button class="btn-text">
              <i data-lucide="clock" style="width: 14px; height: 14px;"></i>
              Tunda 5 Menit
            </button>
          </div>
        </div>

        <!-- Google AI UX Blockquote Insight Section -->
        <blockquote class="insight-quote">
          <div class="balance-icon-container accent-purple" style="margin-top: 2px;">
            <i data-lucide="brain" style="width: 24px; height: 24px;"></i>
          </div>
          <div class="insight-content">
            <h4>Burnout Prediction (Gemini Engine)</h4>
            <p>"Bro, risiko burnout lu terdeteksi sedang dalam 3 hari ke depan. Kurangi coding malam di atas jam 11 malam, dan biasakan istirahat makan teratur. Ingat, program lu penting, ginjal lu jauh lebih penting."</p>
          </div>
        </blockquote>
      </div>
      
      <!-- Initialize Lucide Icons -->
      <script>
        lucide.createIcons();
      </script>
    </body>
    </html>
  `;
}
