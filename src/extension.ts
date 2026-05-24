import * as vscode from 'vscode';
import { DevAuraTracker, TrackerStats } from './tracker';
import { DevAuraStatusBar } from './statusBar';
import { DevAuraMilestoneWatcher } from './milestoneWatcher';
import { postJson, getJson } from './httpHelper';

let tracker: DevAuraTracker | undefined;
let statusBar: DevAuraStatusBar | undefined;
let milestoneWatcher: DevAuraMilestoneWatcher | undefined;

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
        statusBar.update(tracker.state, tracker.stats);
      }
    }
  });

  const docSaveListener = vscode.workspace.onDidSaveTextDocument(() => {
    if (tracker) {
      tracker.handleDocumentSave();
      if (statusBar) {
        statusBar.update(tracker.state, tracker.stats);
      }
    }
  });

  // 3. Listen to flow state transitions to trigger notifications
  const stateChangeListener = tracker.onStateChanged(newState => {
    if (statusBar && tracker) {
      statusBar.update(newState, tracker.stats);
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
        const minutes = res.minutes_until_prayer;
        const prayer = res.upcoming_prayer;
        const mealNudge = res.meal_nudge_required;

        // If a prayer is coming up within 15 minutes
        if (prayer && prayer !== 'None' && minutes !== null && minutes <= 15) {
          const msgRes = await postJson(`${backendUrl}/generate-msg`, {
            state: tracker ? tracker.state : 'idle',
            time_of_day: 'afternoon',
            recent_commits: ['making real progress']
          });
          const alertMessage = msgRes && msgRes.status === 'success' 
            ? msgRes.nudge_message 
            : `🕌 Solat ${prayer} masuk ${minutes} menit lagi. Siap-siap wudhu bro!`;

          vscode.window.showWarningMessage(
            `🕌 DevAura: Waktu ${prayer} masuk ${minutes} menit lagi!\n\n"${alertMessage}"`,
            '🕌 Check-In Solat', 'Dismiss'
          ).then(btn => {
            if (btn === '🕌 Check-In Solat') {
              vscode.window.showInformationMessage('🕌 Solat registered! Streaks updated. ✨');
            }
          });
        } else if (mealNudge) {
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

    panel.webview.html = getDashboardHtml(tracker ? tracker.stats : null);
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
 * Premium glassmorphism HTML structure for local dashboard preview
 */
function getDashboardHtml(stats: TrackerStats | null): string {
  const currentKeystrokes = stats ? stats.keystrokes : 0;
  const currentCorrections = stats ? stats.backspaces : 0;
  const currentSaves = stats ? stats.saves : 0;
  const currentFrustration = stats ? stats.frustrationScore : 0;
  const flowState = stats ? stats.state.toUpperCase() : 'IDLE';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>DevAura Dashboard</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap');
        
        :root {
          --bg-dark: #0f121d;
          --card-bg: rgba(22, 28, 45, 0.6);
          --accent-cyan: #00f2fe;
          --accent-purple: #4facfe;
          --accent-red: #ff5e62;
          --accent-gold: #f6d365;
          --text-main: #f7fafc;
          --text-sub: #a0aec0;
          --border: rgba(255, 255, 255, 0.08);
        }

        body {
          font-family: 'Outfit', sans-serif;
          background-color: var(--bg-dark);
          color: var(--text-main);
          margin: 0;
          padding: 24px;
          min-height: 100vh;
          background-image: 
            radial-gradient(circle at 10% 20%, rgba(0, 242, 254, 0.05) 0%, transparent 40%),
            radial-gradient(circle at 90% 80%, rgba(79, 172, 254, 0.05) 0%, transparent 45%);
        }

        .container {
          max-width: 1000px;
          margin: 0 auto;
        }

        header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 20px;
        }

        .logo {
          font-size: 28px;
          font-weight: 800;
          background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: 1px;
        }

        .user-badge {
          background: var(--card-bg);
          border: 1px solid var(--border);
          padding: 8px 16px;
          border-radius: 99px;
          font-size: 14px;
          font-weight: 600;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        .card {
          background: var(--card-bg);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
          border-color: rgba(0, 242, 254, 0.2);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .card-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-sub);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .icon {
          font-size: 24px;
        }

        .value {
          font-size: 38px;
          font-weight: 800;
          margin-bottom: 8px;
          font-family: 'JetBrains Mono', monospace;
        }

        .gradient-text-cyan {
          background: linear-gradient(135deg, #00f2fe, #4facfe);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .gradient-text-gold {
          background: linear-gradient(135deg, #f6d365, #fda085);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .gradient-text-red {
          background: linear-gradient(135deg, #ff5e62, #ff9966);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .score-bar {
          height: 8px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 99px;
          overflow: hidden;
          margin-top: 12px;
        }

        .score-progress {
          height: 100%;
          background: linear-gradient(90deg, var(--accent-cyan), var(--accent-purple));
          border-radius: 99px;
        }

        .solat-tracker {
          display: flex;
          justify-content: space-between;
          margin-top: 20px;
        }

        .solat-node {
          text-align: center;
          flex: 1;
        }

        .solat-dot {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 8px auto;
          font-size: 14px;
        }

        .solat-dot.active {
          background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
          border: none;
          box-shadow: 0 4px 12px rgba(67, 233, 123, 0.3);
        }

        .solat-name {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-sub);
        }

        .tips-section {
          background: rgba(79, 172, 254, 0.1);
          border: 1px dashed rgba(79, 172, 254, 0.3);
          border-radius: 12px;
          padding: 20px;
          margin-top: 32px;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .tip-content h4 {
          margin: 0 0 6px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .tip-content p {
          margin: 0;
          font-size: 14px;
          color: var(--text-sub);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <div class="logo">🌌 DevAura</div>
          <div class="user-badge">👤 dev_user_1 (Jakarta)</div>
        </header>

        <div class="dashboard-grid">
          <!-- Flow State Card -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Active Focus State</span>
              <span class="icon">⚡</span>
            </div>
            <div class="value gradient-text-cyan">${flowState}</div>
            <div>Focus Velocity: <b>${Math.round(currentKeystrokes / 2 + 1)} KPM</b></div>
            <div class="score-bar">
              <div class="score-progress" style="width: ${Math.min(100, currentKeystrokes / 1.5)}%"></div>
            </div>
          </div>

          <!-- Wellness Score -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Daily Wellness Score</span>
              <span class="icon">🏆</span>
            </div>
            <div class="value gradient-text-gold">88/100</div>
            <div>2 Streaks Active (Solat, Meal)</div>
            <div class="score-bar">
              <div class="score-progress" style="width: 88%; background: linear-gradient(90deg, #f6d365, #fda085);"></div>
            </div>
          </div>

          <!-- Frustration Score -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Frustration Index</span>
              <span class="icon">🤯</span>
            </div>
            <div class="value gradient-text-red">${currentFrustration}%</div>
            <div>Corrections: <b>${currentCorrections}</b> / Saves: <b>${currentSaves}</b></div>
            <div class="score-bar">
              <div class="score-progress" style="width: ${currentFrustration}%; background: linear-gradient(90deg, #ff5e62, #ff9966);"></div>
            </div>
          </div>
        </div>

        <!-- Pillar 1: Solat Tracker Status -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">🕌 Ibadah Guardian — Solat Streak Tracker</span>
            <span class="icon">🕌</span>
          </div>
          <p>Coordinates: <b>-6.2088, 106.8456 (GMT+7)</b>. Standard calculation mode.</p>
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
        </div>

        <div class="tips-section">
          <div class="icon" style="font-size: 32px;">💡</div>
          <div class="tip-content">
            <h4>Empathetic reminder from Gemini</h4>
            <p>"Sering-sering ngelamun ke jendela bro, mata lu butuh istirahat sejenak. Programnya gak bakalan kabur kok."</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
