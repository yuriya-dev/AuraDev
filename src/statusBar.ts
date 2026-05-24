import * as vscode from 'vscode';
import { FocusState, TrackerStats } from './tracker';

export class DevAuraStatusBar {
  private _statusBarItem: vscode.StatusBarItem;
  private _isMuted = false;

  constructor() {
    // Create status bar item aligned to the right
    this._statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this._statusBarItem.command = 'devaura.checkIn';
    this.update('idle', {
      keystrokes: 0,
      backspaces: 0,
      saves: 0,
      totalTimeSeconds: 0,
      state: 'idle',
      frustrationScore: 0
    });
    this._statusBarItem.show();
  }

  public get isMuted(): boolean {
    return this._isMuted;
  }

  public toggleMute(): boolean {
    this._isMuted = !this._isMuted;
    this.updateTooltipAndTextOnly();
    return this._isMuted;
  }

  /**
   * Update the status bar based on state changes and backend check results
   */
  public update(
    state: FocusState,
    stats: TrackerStats,
    upcomingPrayer = 'None',
    minsToPrayer: number | null = null,
    wellnessScore = 85
  ) {
    const stateConfig = this.getStateConfig(state);
    
    // Set dynamic color based on state, overriding with Coral alert if extremely frustrated
    let stateColor = stateConfig.color;
    let stateLabel = stateConfig.label;
    
    if (stats.frustrationScore > 70) {
      stateColor = '#EA4335'; // Coral Alert/Overtime
      stateLabel = 'Overloaded';
    }

    // Format time to short (e.g. 2h 15m or 2m)
    const timeStr = this.formatTimeShort(stats.totalTimeSeconds);

    // Format prayer segment
    const prayerStr = upcomingPrayer !== 'None' && minsToPrayer !== null
      ? ` 🕌 Next: ${upcomingPrayer} (${minsToPrayer}m)`
      : ` 🕌 Next: --`;

    const muteIndicator = this._isMuted ? ' 🔇' : '';

    // Apply combined Material You layout:
    // 🔮 DevAura: Deep Focus (2h 15m) | 🕌 Next: Dhuhr (45m) | ✨ Score: 85
    this._statusBarItem.text = `🔮 DevAura: ${stateLabel} (${timeStr}) |${prayerStr} | ✨ Score: ${wellnessScore}${muteIndicator}`;
    this._statusBarItem.color = stateColor;
    
    // Structured tooltip info (using markdown for a premium feel!)
    const tooltipMarkdown = new vscode.MarkdownString();
    tooltipMarkdown.isTrusted = true;
    
    tooltipMarkdown.appendMarkdown(`### 🔮 **DevAura — Material You**\n\n`);
    tooltipMarkdown.appendMarkdown(`**Mental State:** *${stateLabel}* (${stateConfig.icon})\n\n`);
    tooltipMarkdown.appendMarkdown(`---\n\n`);
    tooltipMarkdown.appendMarkdown(`📊 **Metrics (Session)**\n`);
    tooltipMarkdown.appendMarkdown(`* ⌨️ Keystrokes: \`${stats.keystrokes}\`\n`);
    tooltipMarkdown.appendMarkdown(`* ↩️ Corrections: \`${stats.backspaces}\`\n`);
    tooltipMarkdown.appendMarkdown(`* 💾 File Saves: \`${stats.saves}\`\n`);
    tooltipMarkdown.appendMarkdown(`* ⏱️ Time Active: \`${this.formatTime(stats.totalTimeSeconds)}\`\n`);
    tooltipMarkdown.appendMarkdown(`* 🤯 Frustration Index: \`${stats.frustrationScore}%\`\n\n`);
    
    tooltipMarkdown.appendMarkdown(`---\n\n`);
    tooltipMarkdown.appendMarkdown(`🕌 **Ibadah Guardian**\n`);
    if (upcomingPrayer !== 'None' && minsToPrayer !== null) {
      tooltipMarkdown.appendMarkdown(`* Next Prayer: **${upcomingPrayer}** in **${minsToPrayer} minutes**\n\n`);
    } else {
      tooltipMarkdown.appendMarkdown(`* Prayer Schedule synced offline\n\n`);
    }

    if (stats.frustrationScore > 70) {
      tooltipMarkdown.appendMarkdown(`> 🔴 **Coral Alert!** Extreme frustration detected. Stop coding and take a 5-minute wudhu/breathing break. 💧\n\n`);
    } else if (state === 'deep-focus') {
      tooltipMarkdown.appendMarkdown(`> 🔮 **In Deep Flow.** All notifications and non-spiritual alerts are suppressed.\n\n`);
    }

    tooltipMarkdown.appendMarkdown(`---\n`);
    tooltipMarkdown.appendMarkdown(`⚡ *Click to check-in prayers/meals or open dashboard.*`);

    this._statusBarItem.tooltip = tooltipMarkdown;
  }

  /**
   * Simple helper to update text without needing full stats object
   */
  private updateTooltipAndTextOnly() {
    const textWithoutMute = this._statusBarItem.text.replace(' 🔇', '');
    const muteIndicator = this._isMuted ? ' 🔇' : '';
    this._statusBarItem.text = `${textWithoutMute}${muteIndicator}`;
  }

  /**
   * Dispose resources
   */
  public dispose() {
    this._statusBarItem.dispose();
  }

  /**
   * Helper to fetch color, label and icon based on FocusState
   * Uses Material You tonal accent palettes from design.md
   */
  private getStateConfig(state: FocusState) {
    switch (state) {
      case 'idle':
        return {
          icon: '💤',
          label: 'Idle',
          color: '#E3E3E3' // On Surface Neutral
        };
      case 'warming-up':
        return {
          icon: '🌱',
          label: 'Warming Up',
          color: '#0B57D0' // Primary Google Blue
        };
      case 'focus':
        return {
          icon: '🔥',
          label: 'Flowing',
          color: '#1EA896' // Secondary Teal/Islamic Green
        };
      case 'deep-focus':
        return {
          icon: '🔮',
          label: 'Deep Focus',
          color: '#7C4DFF' // Dynamic Purple Accent
        };
      case 'frustrated':
        return {
          icon: '🤯',
          label: 'Struggling',
          color: '#FFB300' // Dynamic Amber Accent
        };
    }
  }

  /**
   * Format seconds to short HHh MMm or MMm
   */
  private formatTimeShort(totalSeconds: number): string {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  }

  /**
   * Format seconds to HH:MM:SS
   */
  private formatTime(totalSeconds: number): string {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    return [
      hrs > 0 ? String(hrs).padStart(2, '0') : null,
      String(mins).padStart(2, '0'),
      String(secs).padStart(2, '0')
    ].filter(Boolean).join(':');
  }
}
