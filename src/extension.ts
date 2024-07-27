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
		vscode.commands.registerCommand('data-massage.extend', () => {
			const pythonScriptPath = vscode.Uri.joinPath(context.extensionUri, 'python', 'example_venv.py');

			const editor = vscode.window.activeTextEditor;
			if (editor !== undefined) {
				const streamer = new Streamer(editor);
				const process = execFile('python', [pythonScriptPath.fsPath]);

				process.stdout?.on('data', (data) => streamer.write(data));
				process.stdin?.write(editor.document.getText(), () => process.stdin?.end());
				process.stderr?.on('data', (data) => console.error(data));
				process.addListener('exit', (code) => streamer.end());
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
			</head>
			<body>
			hello
			<button id="extend">Extend</button>
			<script>
				const vscode = acquireVsCodeApi();
				document.getElementById('extend').addEventListener('click', () => {
					vscode.postMessage({ command: 'extend' });
				});
			</script>
			</body>
			</html>`;
	}

}

// This method is called when your extension is deactivated
export function deactivate() {}
