// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { execFile } from 'child_process';
import * as vscode from 'vscode';

let human_eval_row:string|undefined = undefined;
let human_eval_question:string|undefined = undefined;
let human_eval_answer:string|undefined = undefined;
let human_eval_column:string = 'human';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "data-massage" is now active!');

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('data-massage', new DataMassageViewProvider(context.extensionUri))
	);

	async function invokePython(args: string[], stdin: string, on_stdout: (data: string) => void): Promise<number> {
		const pythonScriptPath = vscode.Uri.joinPath(context.extensionUri, 'python', 'example_venv.py');
		const openaiKey = await context.secrets.get('data-massage.openai-key');
		const p = execFile('python', [pythonScriptPath.fsPath, ...args], {
			env: {
				OPENAI_API_KEY: openaiKey,
				PATH: process.env.PATH,
			}
		});
		p.stdin?.write(stdin, () => p.stdin?.end());
		p.stdout?.on('data', on_stdout);
		p.stderr?.on('data', (data) => console.error(data));

		return await new Promise((resolve) => {
			p.addListener('exit', (code) => resolve(code ?? -123));
		});
	}

	async function collectPython(args: string[], stdin: string): Promise<string> {
		console.error('collectPython', args);
		let data = '';
		const code = await invokePython(args, stdin, (chunk) => data += chunk);
		console.error('collectPythonCode', code);
		if (code !== 0) {
			vscode.window.showErrorMessage('Failed to run Python script');
			throw new Error('Failed to run Python script');
		}
		console.error('collectPythonOutput', data);
		return data;
	}

	context.subscriptions.push(
		vscode.commands.registerCommand('data-massage.extend', async(count?, hint?) => {
			const pythonScriptPath = vscode.Uri.joinPath(context.extensionUri, 'python', 'example_venv.py');

			const editor = vscode.window.activeTextEditor;
			if (editor !== undefined) {
				const filenameUri = editor.document.uri;
				if (filenameUri.scheme !== 'file') {
					vscode.window.showErrorMessage(`File must be saved before human evaluation ${filenameUri}`);
					return;
				}
				const filename = filenameUri.fsPath;
				const payload = {
					count: count,
					hint: hint,
				};
				const result = await collectPython(['extend', '--file', filename, '--payload', JSON.stringify(payload)], '');
				console.log(result)
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('data-massage.remove_duplicate', async() => {
			const pythonScriptPath = vscode.Uri.joinPath(context.extensionUri, 'python', 'example_venv.py');

			const editor = vscode.window.activeTextEditor;
			if (editor !== undefined) {
				const filenameUri = editor.document.uri;
				if (filenameUri.scheme !== 'file') {
					vscode.window.showErrorMessage(`File must be saved before human evaluation ${filenameUri}`);
					return;
				}
				const filename = filenameUri.fsPath;
				await collectPython(['remove_duplicate', '--file', filename], '');
				console.log('removed_duplicate')
			}
		})
	);


	context.subscriptions.push(
		vscode.commands.registerCommand('data-massage.human-eval', async(opinion?: string) => {
			if (opinion === undefined) {
				opinion = await vscode.window.showInputBox({
					prompt: 'Enter your opinion (correct, wrong, unsure)'
				});
			}
			if (opinion === undefined) {
				return;
			}

			const editor = vscode.window.activeTextEditor;
			if (editor !== undefined) {
				const filenameUri = editor.document.uri;
				if (filenameUri.scheme !== 'file') {
					vscode.window.showErrorMessage(`File must be saved before human evaluation ${filenameUri}`);
					return;
				}
				const filename = filenameUri.fsPath;
				const payload = {
					row: human_eval_row,
					column: human_eval_column,
					value: opinion,
				};
				const result = await collectPython(['human_eval', '--file', filename, '--payload', JSON.stringify(payload)], '');
				const result_payload = JSON.parse(result);
				human_eval_row = result_payload.row;
				human_eval_question = result_payload.question;
				human_eval_answer = result_payload.answer;
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
	private _view?: vscode.WebviewView;
	constructor(private readonly _extensionUri: vscode.Uri) {
		this._extensionUri = _extensionUri;
	}
	resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Thenable<void> | void {
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')]
		};
		webviewView.webview.onDidReceiveMessage(async message => {
			switch (message.command) {
				case 'extend':
					await vscode.commands.executeCommand('data-massage.extend', message.count, message.hint);
					return;
				case 'human-eval':
					await vscode.commands.executeCommand('data-massage.human-eval', message.opinion, message.row ?? human_eval_row);
					webviewView.webview.postMessage({ command: 'human-eval', row: human_eval_row, question: human_eval_question, answer: human_eval_answer });
					return;
				case 'delete_duplicates':
					await vscode.commands.executeCommand('data-massage.remove_duplicate');
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
				<div id="visit_human_eval" class="option">Human Eval</div>
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
				<div id="human_eval" style="display:none">
					Row <span id="human_eval_row">-</span>
					<br>
					Question: <span id="human_eval_question">-</span>
					<br>
					Answer: <span id="human_eval_answer">-</span>
					<br>
					<button id="human_eval_correct">Correct</button>
					<button id="human_eval_wrong">Wrong</button>
					<button id="human_eval_unsure">Unsure</button>
				</div>
			</div>
			</div>
			<script>
				const vscode = acquireVsCodeApi();
				window.addEventListener('message', event => {
					const message = event.data;
					switch (message.command) {
						case 'human-eval':
							document.getElementById('human_eval_row').textContent = message.row;
							document.getElementById('human_eval_question').textContent = message.question;
							document.getElementById('human_eval_answer').textContent = message.answer;
							break;
					}
				});
				document.getElementById('extend').addEventListener('click', () => {
					vscode.postMessage({ command: 'extend', count: parseInt(document.getElementById('extend_amount').value), hint: document.getElementById('extend_hint').value });
				});
				document.getElementById('delete_duplicates').addEventListener('click', () => {
					vscode.postMessage({ command: 'delete_duplicates' });
				});
				document.getElementById('human_eval_correct').addEventListener('click', () => {
					vscode.postMessage({ command: 'human-eval', opinion: 'correct', row: parseInt(document.getElementById('human_eval_row').textContent) });
				});
				document.getElementById('human_eval_wrong').addEventListener('click', () => {
					vscode.postMessage({ command: 'human-eval', opinion: 'wrong', row: parseInt(document.getElementById('human_eval_row').textContent) });
				});
				document.getElementById('human_eval_unsure').addEventListener('click', () => {
					vscode.postMessage({ command: 'human-eval', opinion: 'unsure', row: parseInt(document.getElementById('human_eval_row').textContent) });
				});
				document.getElementById('visit_grow_shrink').addEventListener('click', () => {
					document.getElementById('visit_grow_shrink').classList.add('active');
					document.getElementById('visit_edit').classList.remove('active');
					document.getElementById('visit_eval').classList.remove('active');
					document.getElementById('visit_human_eval').classList.remove('active');
					document.getElementById('grow_shrink').style.display = 'block';
					document.getElementById('edit').style.display = 'none';
					document.getElementById('eval').style.display = 'none';
					document.getElementById('human_eval').style.display = 'none';
				});
				document.getElementById('visit_edit').addEventListener('click', () => {
					document.getElementById('visit_grow_shrink').classList.remove('active');
					document.getElementById('visit_edit').classList.add('active');
					document.getElementById('visit_eval').classList.remove('active');
					document.getElementById('visit_human_eval').classList.remove('active');
					document.getElementById('grow_shrink').style.display = 'none';
					document.getElementById('edit').style.display = 'block';
					document.getElementById('eval').style.display = 'none';
					document.getElementById('human_eval').style.display = 'none';
				});
				document.getElementById('visit_eval').addEventListener('click', () => {
					document.getElementById('visit_grow_shrink').classList.remove('active');
					document.getElementById('visit_edit').classList.remove('active');
					document.getElementById('visit_eval').classList.add('active');
					document.getElementById('visit_human_eval').classList.remove('active');
					document.getElementById('grow_shrink').style.display = 'none';
					document.getElementById('edit').style.display = 'none';
					document.getElementById('eval').style.display = 'block';
					document.getElementById('human_eval').style.display = 'none';
				});
				document.getElementById('visit_human_eval').addEventListener('click', () => {
					document.getElementById('visit_grow_shrink').classList.remove('active');
					document.getElementById('visit_edit').classList.remove('active');
					document.getElementById('visit_eval').classList.remove('active');
					document.getElementById('visit_human_eval').classList.add('active');
					document.getElementById('grow_shrink').style.display = 'none';
					document.getElementById('edit').style.display = 'none';
					document.getElementById('eval').style.display = 'none';
					document.getElementById('human_eval').style.display = 'block';
				});
			</script>
			</body>
			</html>`;
	}

}

// This method is called when your extension is deactivated
export function deactivate() {}
