// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { execFile } from 'child_process';
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "data-massage" is now active!');

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('data-massage', new DataMassageViewProvider(context.extensionUri))
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('data-massage.extend', async() => {
			const pythonScriptPath = vscode.Uri.joinPath(context.extensionUri, 'python', 'example_venv.py');

			const editor = vscode.window.activeTextEditor;
			if (editor !== undefined) {
				const streamer = new Streamer(editor);
				const openaiKey = await context.secrets.get('data-massage.openai-key');
				const p = execFile('python', [pythonScriptPath.fsPath, 'extend'], {
					env: {
						OPENAI_API_KEY: openaiKey,
						PATH: process.env.PATH,
					}
				});

				p.stdout?.on('data', (data) => streamer.write(data));
				p.stdin?.write(editor.document.getText(), () => p.stdin?.end());
				p.stderr?.on('data', (data) => console.error(data));
				p.addListener('exit', (code) => streamer.end());
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('data-massage.openai-key', async() => {
			const apiKey = await vscode.window.showInputBox({
				prompt: 'Enter your API Key',
				password: true
			});
	
			if (apiKey) {
				await context.secrets.store('data-massage.openai-key', apiKey);
				vscode.window.showInformationMessage('OpenAI API Key stored successfully');
			}
		})
	);
}

class Streamer {
	private _line: number;
	private _column: number;
	constructor(private readonly _editor: vscode.TextEditor) {
		this._editor = _editor;
		this._line = 0;
		this._column = 0;
	}

	write(data: string) {
		const datalines = data.split('\n');
		this._editor.edit((editBuilder) => {
			for (let i = 0; i < datalines.length; i++) {
				if (i !== 0) {
					this._writeNewLine(editBuilder);
				}
				this._writeWithinLine(editBuilder, datalines[i]);
			}
		});
	}

	end() {
		this._editor.edit((editBuilder) => {
			editBuilder.delete(new vscode.Range(
				new vscode.Position(this._line, this._column),
				new vscode.Position(this._editor.document.lineCount, 0),
			));
		});
	}

	private _writeWithinLine(editBuilder: vscode.TextEditorEdit, data: string) {
		editBuilder.replace(new vscode.Range(
			new vscode.Position(this._line, this._column),
			new vscode.Position(this._line, this._column + data.length),
		), data);
		this._column += data.length;
	}

	private _writeNewLine(editBuilder: vscode.TextEditorEdit) {
		editBuilder.replace(new vscode.Range(
			new vscode.Position(this._line, this._column),
			new vscode.Position(this._line+1, 0),
		), '\n');
		this._line += 1;
		this._column = 0;
	}
}

class DataMassageViewProvider implements vscode.WebviewViewProvider {
	constructor(private readonly _extensionUri: vscode.Uri) {
		this._extensionUri = _extensionUri;
	}
	resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Thenable<void> | void {
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')]
		};
		webviewView.webview.onDidReceiveMessage(message => {
			switch (message.command) {
				case 'extend':
					vscode.commands.executeCommand('data-massage.extend');
					return;
			}
		});
		webviewView.webview.html = `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<style>
				body.vscode-dark button {
					background-color: #333;
					color: white;
				}
				body.vscode-dark input {
					background-color: #333;
					color: white;
				}
				body.vscode-dark textarea {
					background-color: #333;
					color: white;
				}

				div#panel_outer {
					display: flex;
				}
				div#panel_left {
					width: 100px;
				}
				div#panel_main {
					flex-grow: 1;
					padding-left: 5px;
				}

				div.option {
					padding: 10px;
					cursor: default;
				}
				div.option.active {
					background-color: #888;
					color: white;
				}

				textarea {
					width: 100%;
				}
				</style>
			</head>
			<body>
			<div id="panel_outer">
			<div id="panel_left">
				<div id="visit_grow_shrink" class="option active">Grow/shrink</div>
				<div id="visit_edit" class="option">Edit</div>
				<div id="visit_eval" class="option">Eval</div>
			</div>
			<div id="panel_main">
				<div id="grow_shrink">
					Current size: <span id="current_size">-</span>
					<br>
					<button id="extend">Extend by</button>
					<input type="number" id="extend_amount" value="100">
					<br>
					<input type="text" id="extend_hint" placeholder="Hint">
					<hr>
					Dodgy records: <span id="dodgy_count">-</span>
					<br>
					<button id="delete_dodgy">Remove dodgy</button>
					<hr>
					Duplicates: <span id="duplicate_count">-</span>
					<br>
					<button id="delete_duplicates">Remove duplicates</button>
				</div>
				<div id="edit" style="display:none">
					<textarea id="edit_hint"></textarea>
					<br>
					<button id="edit_button">Fix dodgy</button>
					<button id="edit_button">Edit all records</button>
				</div>
				<div id="eval" style="display:none">
					<textarea id="eval_hint"></textarea>
					<br>
					<button id="eval_button">Mark dodgy</button>
				</div>
			</div>
			</div>
			<script>
				const vscode = acquireVsCodeApi();
				document.getElementById('extend').addEventListener('click', () => {
					vscode.postMessage({ command: 'extend' });
				});
				document.getElementById('visit_grow_shrink').addEventListener('click', () => {
					document.getElementById('visit_grow_shrink').classList.add('active');
					document.getElementById('visit_edit').classList.remove('active');
					document.getElementById('visit_eval').classList.remove('active');
					document.getElementById('grow_shrink').style.display = 'block';
					document.getElementById('edit').style.display = 'none';
					document.getElementById('eval').style.display = 'none';
				});
				document.getElementById('visit_edit').addEventListener('click', () => {
					document.getElementById('visit_grow_shrink').classList.remove('active');
					document.getElementById('visit_edit').classList.add('active');
					document.getElementById('visit_eval').classList.remove('active');
					document.getElementById('grow_shrink').style.display = 'none';
					document.getElementById('edit').style.display = 'block';
					document.getElementById('eval').style.display = 'none';
				});
				document.getElementById('visit_eval').addEventListener('click', () => {
					document.getElementById('visit_grow_shrink').classList.remove('active');
					document.getElementById('visit_edit').classList.remove('active');
					document.getElementById('visit_eval').classList.add('active');
					document.getElementById('grow_shrink').style.display = 'none';
					document.getElementById('edit').style.display = 'none';
					document.getElementById('eval').style.display = 'block';
				});
			</script>
			</body>
			</html>`;
	}

}

// This method is called when your extension is deactivated
export function deactivate() {}
