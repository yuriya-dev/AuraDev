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
   * Update the status bar based on state changes
   */
  public update(state: FocusState, stats: TrackerStats) {
    const stateConfig = this.getStateConfig(state);
    
    // Format label
    const muteIndicator = this._isMuted ? ' 🔇' : '';
    this._statusBarItem.text = `${stateConfig.icon} DevAura: ${stateConfig.label}${muteIndicator}`;
    this._statusBarItem.color = stateConfig.color;
    
    // Structured tooltip info (using markdown for a premium feel!)
    const tooltipMarkdown = new vscode.MarkdownString();
    tooltipMarkdown.isTrusted = true;
    
    tooltipMarkdown.appendMarkdown(`### ✨ **DevAura — Life OS**\n\n`);
    tooltipMarkdown.appendMarkdown(`**Current State:** ${stateConfig.icon} *${stateConfig.label}*\n\n`);
    tooltipMarkdown.appendMarkdown(`---\n\n`);
    tooltipMarkdown.appendMarkdown(`📊 **Metrics (Session)**\n`);
    tooltipMarkdown.appendMarkdown(`* ⌨️ Keystrokes: \`${stats.keystrokes}\`\n`);
    tooltipMarkdown.appendMarkdown(`* ↩️ Corrections: \`${stats.backspaces}\`\n`);
    tooltipMarkdown.appendMarkdown(`* 💾 File Saves: \`${stats.saves}\`\n`);
    tooltipMarkdown.appendMarkdown(`* ⏱️ Time Active: \`${this.formatTime(stats.totalTimeSeconds)}\`\n`);
    tooltipMarkdown.appendMarkdown(`* 🤯 Frustration Index: \`${stats.frustrationScore}%\`\n\n`);
    
    if (state === 'frustrated') {
      tooltipMarkdown.appendMarkdown(`> ⚠️ **Frustration detected!** Maybe take a 5-minute stretch or a drink of water? 💧\n\n`);
    } else if (state === 'deep-focus') {
      tooltipMarkdown.appendMarkdown(`> 🔥 **In Flow State.** Notifications and non-urgent alerts are silenced.\n\n`);
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
   */
  private getStateConfig(state: FocusState) {
    switch (state) {
      case 'idle':
        return {
          icon: '💤',
          label: 'Idle',
          color: new vscode.ThemeColor('statusBarItem.prominentForeground')
        };
      case 'warming-up':
        return {
          icon: '🌱',
          label: 'Warming Up',
          color: '#81e6d9' // Teal
        };
      case 'focus':
        return {
          icon: '🔥',
          label: 'Focusing',
          color: '#63b3ed' // Ocean Blue
        };
      case 'deep-focus':
        return {
          icon: '⚡',
          label: 'Deep Flow',
          color: '#ecc94b' // Amber/Yellow
        };
      case 'frustrated':
        return {
          icon: '🤯',
          label: 'Struggling',
          color: '#fc8181' // Soft Red
        };
    }
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
