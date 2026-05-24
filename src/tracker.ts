import * as vscode from 'vscode';
import { postJson } from './httpHelper';

export type FocusState = 'idle' | 'warming-up' | 'focus' | 'deep-focus' | 'frustrated';

export interface TrackerStats {
  keystrokes: number;
  backspaces: number;
  saves: number;
  totalTimeSeconds: number;
  state: FocusState;
  frustrationScore: number; // 0 to 100
}

export class DevAuraTracker {
  private _state: FocusState = 'idle';
  private _keystrokes = 0;
  private _backspaces = 0;
  private _saves = 0;
  private _startTime: number;
  
  // Rolling minute counters
  private _recentKeystrokes: number[] = [];
  private _recentBackspaces: number[] = [];
  
  private _intervalId?: NodeJS.Timeout;
  private _onStateChanged = new vscode.EventEmitter<FocusState>();
  public readonly onStateChanged = this._onStateChanged.event;

  constructor() {
    this._startTime = Date.now();
    this.startRollingWindow();
  }

  public get state(): FocusState {
    return this._state;
  }

  public get stats(): TrackerStats {
    return {
      keystrokes: this._keystrokes,
      backspaces: this._backspaces,
      saves: this._saves,
      totalTimeSeconds: Math.floor((Date.now() - this._startTime) / 1000),
      state: this._state,
      frustrationScore: this.calculateFrustrationScore()
    };
  }

  /**
   * Tracks document changes (keystrokes, deletes)
   */
  public handleDocumentChange(event: vscode.TextDocumentChangeEvent) {
    if (event.document.uri.scheme === 'git') {
      return; // Skip git output changes
    }

    const contentChanges = event.contentChanges;
    if (contentChanges.length === 0) {
      return;
    }

    for (const change of contentChanges) {
      const text = change.text;
      
      // Increment overall typing keystrokes
      if (text.length > 0) {
        // Approximate keystrokes by length (or 1 for small additions)
        const typedCount = Math.max(1, text.replace(/\s/g, '').length);
        this._keystrokes += typedCount;
        this._recentKeystrokes.push(typedCount);
      } else if (change.rangeLength > 0) {
        // If rangeLength > 0 and text is empty, it's a deletion/backspace
        this._backspaces += 1;
        this._recentBackspaces.push(1);
      }
    }
  }

  /**
   * Tracks file saves
   */
  public handleDocumentSave() {
    this._saves += 1;
  }

  /**
   * Clean up background polling
   */
  public dispose() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
    }
  }

  /**
   * Start 5-second interval evaluation of state
   */
  private startRollingWindow() {
    this._intervalId = setInterval(() => {
      this.evaluateState();
    }, 5000);
  }

  /**
   * Calculate rolling counts and update states
   */
  private evaluateState() {
    // Prune old entries
    // Since we don't store timestamps with each count directly for performance, 
    // we can use a simpler approach: periodically decay the recent counts
    // Let's implement a sliding buffer of 12 buckets of 5 seconds each
    if (this._recentKeystrokes.length > 300) {
      this._recentKeystrokes = this._recentKeystrokes.slice(-300);
    }
    if (this._recentBackspaces.length > 100) {
      this._recentBackspaces = this._recentBackspaces.slice(-100);
    }

    // Decay recent stats to simulate 1-minute rolling average
    // Each 5 seconds, we scale down the "active" recent array 
    // to model an exponential decay or standard rolling window.
    // For simplicity and predictability:
    const kpm = this.calculateKeystrokesPerMinute();
    
    const oldState = this._state;
    const frustration = this.calculateFrustrationScore();

    if (frustration > 40 && kpm > 10) {
      this._state = 'frustrated';
    } else if (kpm === 0) {
      this._state = 'idle';
    } else if (kpm < 25) {
      this._state = 'warming-up';
    } else if (kpm < 75) {
      this._state = 'focus';
    } else {
      this._state = 'deep-focus';
    }

    // Fire state change if updated
    if (this._state !== oldState) {
      this._onStateChanged.fire(this._state);
    }

    // Decay the recent pools gradually so the metrics represent active work
    // We remove 10% of items every 5 seconds to simulate a window
    this._recentKeystrokes = this._recentKeystrokes.slice(Math.ceil(this._recentKeystrokes.length * 0.15));
    this._recentBackspaces = this._recentBackspaces.slice(Math.ceil(this._recentBackspaces.length * 0.15));
  }

  private calculateKeystrokesPerMinute(): number {
    return this._recentKeystrokes.reduce((sum, val) => sum + val, 0);
  }

  private calculateBackspacesPerMinute(): number {
    return this._recentBackspaces.reduce((sum, val) => sum + val, 0);
  }

  /**
   * Measures potential frustration.
   * High ratio of backspaces/deletes to normal keystrokes indicates the developer is struggling/refactoring frequently.
   */
  private calculateFrustrationScore(): number {
    const kpm = this.calculateKeystrokesPerMinute();
    const bpm = this.calculateBackspacesPerMinute();

    if (kpm === 0) {
      return 0;
    }

    // Ratio of backspaces to characters. Anything over 25% starts pointing to struggle.
    const ratio = bpm / (kpm + bpm);
    const score = Math.min(100, Math.round(ratio * 200)); // Scaled up so 50% ratio = 100 score
    return score;
  }

  /**
   * Syncs active statistics to the Flask server
   */
  public async syncWithBackend(userId: string, backendUrl: string): Promise<any> {
    try {
      const url = `${backendUrl}/event`;
      const payload = {
        userId: userId,
        keystrokes: this._keystrokes,
        backspaces: this._backspaces,
        saves: this._saves,
        state: this._state,
        frustrationScore: this.calculateFrustrationScore()
      };
      const result = await postJson(url, payload);
      return result;
    } catch (e) {
      console.log(`[DevAura] Failed syncing event to backend: ${e}`);
      return null;
    }
  }
}
