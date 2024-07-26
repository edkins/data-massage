// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { exec } from 'child_process';
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
			const pythonScriptPath = vscode.Uri.joinPath(context.extensionUri, 'python', 'example.py');
			exec(`python ${pythonScriptPath.fsPath}`, (error, stdout, stderr) => {
				if (error) {
					vscode.window.showErrorMessage(error.message);
					return;
				}
				if (stderr) {
					vscode.window.showErrorMessage(stderr);
					return;
				}
				vscode.window.showInformationMessage(stdout);
			});
		})
	);
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
