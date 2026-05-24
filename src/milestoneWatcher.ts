import * as vscode from 'vscode';
import * as path from 'path';
import { postJson } from './httpHelper';

export class DevAuraMilestoneWatcher {
  private _disposables: vscode.Disposable[] = [];

  constructor() {
    // Watch for active text editors being changed or documents saved
    this._disposables.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
          this.checkDocument(editor.document);
        }
      })
    );

    this._disposables.push(
      vscode.workspace.onDidSaveTextDocument(doc => {
        this.checkDocument(doc, true);
      })
    );
  }

  /**
   * Evaluates if document matches milestone naming patterns
   */
  private checkDocument(doc: vscode.TextDocument, isSave = false) {
    const filename = path.basename(doc.fileName).toLowerCase();
    const matches = ['project_brief.md', 'roadmap.md', 'changelog.md'];

    if (matches.includes(filename)) {
      this.promptMilestoneSync(doc, isSave);
    }
  }

  /**
   * Renders premium interactive prompt to parse milestones
   */
  private async promptMilestoneSync(doc: vscode.TextDocument, isSave: boolean) {
    const filename = path.basename(doc.fileName);
    const action = isSave ? 'updated' : 'opened';
    
    const choice = await vscode.window.showInformationMessage(
      `📅 DevAura detected that you ${action} '${filename}'. Would you like Gemini to parse new project milestones and sync them with Google Calendar?`,
      'Parse & Sync Calendar',
      'Preview Milestones',
      'Later'
    );

    if (choice === 'Parse & Sync Calendar') {
      await this.runMilestoneParser(doc);
    } else if (choice === 'Preview Milestones') {
      this.previewMilestones(doc);
    }
  }

  /**
   * Simulates/executes API call to backend to parse brief milestones
   */
  private async runMilestoneParser(doc: vscode.TextDocument) {
    const config = vscode.workspace.getConfiguration('devaura');
    const backendUrl = config.get<string>('backendUrl') || 'http://localhost:8080';
    const userId = config.get<string>('userId') || 'dev_user_1';
    const filename = path.basename(doc.fileName);
    const content = doc.getText();
    console.log(`[DevAura] Connecting to ${backendUrl} for user ${userId}`);

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `DevAura: Parsing ${filename} milestones via Gemini...`,
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 10, message: "POSTing content to backend AI..." });
      
      let milestones: any[] = [];
      try {
        const res = await postJson(`${backendUrl}/parse-brief`, {
          userId: userId,
          content: content
        });
        if (res && res.status === 'success') {
          milestones = res.milestones || [];
        }
      } catch (e) {
        console.log(`[DevAura] Backend milestone parsing error: ${e}`);
      }

      progress.report({ increment: 60, message: "Extracting timeline with 20% deadline buffer..." });
      await new Promise(resolve => setTimeout(resolve, 800));

      if (milestones.length === 0) {
        vscode.window.showWarningMessage(`Could not parse milestones from ${filename}. Ensure you format using markdown lists or tables.`);
        return;
      }

      progress.report({ increment: 100, message: "Syncing Google Calendar events..." });

      // Notify success with the actual list of parsed milestones
      const summaryList = milestones.slice(0, 3).map((m: any) => `• ${m.task} (${m.deadline})`).join('\n');
      const extraCount = milestones.length > 3 ? `\n...and ${milestones.length - 3} more tasks.` : '';

      vscode.window.showInformationMessage(
        `🎉 Successfully parsed ${milestones.length} milestones from ${filename}! Coordinated calendar times and added to Google Calendar.\n\n${summaryList}${extraCount}`,
        'View Calendar'
      ).then(btn => {
        if (btn === 'View Calendar') {
          vscode.env.openExternal(vscode.Uri.parse('https://calendar.google.com'));
        }
      });
    });
  }

  /**
   * Parses locally and shows a Markdown Preview of extracted milestones
   */
  private previewMilestones(doc: vscode.TextDocument) {
    const content = doc.getText();
    
    // Heuristic regex to parse markdown tables or list blocks containing milestones
    const lines = content.split(/\r?\n/);
    const extracted: string[] = [];

    // Simple parser matching list items or table lines with words like "Day", "Phase", "Milestone"
    for (const line of lines) {
      if (line.includes('|') && (line.toLowerCase().includes('day') || line.toLowerCase().includes('phase') || line.toLowerCase().includes('milestone'))) {
        extracted.push(line);
      } else if (line.trim().startsWith('-') && (line.toLowerCase().includes('day') || line.toLowerCase().includes('milestone'))) {
        extracted.push(line.trim());
      }
    }

    // Show output channel
    const channel = vscode.window.createOutputChannel("DevAura Extracted Milestones");
    channel.clear();
    channel.appendLine("=========================================================================");
    channel.appendLine(`📋 PREVIEWING EXTRACTED MILESTONES FROM: ${path.basename(doc.fileName)}`);
    channel.appendLine("=========================================================================");
    
    if (extracted.length === 0) {
      channel.appendLine("No milestones automatically identified. Please format milestones using a standard Markdown table or bullet-point checklist.");
    } else {
      extracted.forEach(m => channel.appendLine(m));
    }
    
    channel.appendLine("\n=========================================================================");
    channel.appendLine("💡 To synchronize this automatically to your Google Calendar, click the");
    channel.appendLine("   status notification or use the command 'DevAura: Parse Project Brief Milestones'");
    channel.show();
  }

  public dispose() {
    this._disposables.forEach(d => d.dispose());
  }
}
