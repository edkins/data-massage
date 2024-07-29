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

	const viewProvider = new DataMassageViewProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('data-massage', viewProvider)
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

	function getFilename(): string {
		const editor = vscode.window.activeTextEditor;
		if (editor !== undefined) {
			const filenameUri = editor.document.uri;
			if (filenameUri.scheme !== 'file') {
				vscode.window.showErrorMessage(`File must be saved first ${filenameUri}`);
				throw new Error(`File must be saved first ${filenameUri}`);
			}
			editor.document.save();
			return filenameUri.fsPath;
		} else {
			vscode.window.showErrorMessage('No active editor');
			throw new Error('No active editor');
		}
	}

	function updateCurrentLine(editor: vscode.TextEditor) {
		const line = editor.selections[0].active.line + 1;
		let question = '';
		let answer = '';
		const firstLineText = editor.document.lineAt(0).text;
		const fields = splitCsvLine(firstLineText);
		const lineText = editor.document.lineAt(line - 1).text;
		const lineFields = splitCsvLine(lineText);
		for (let i = 0; i < fields.length; i++) {
			const field = fields[i];
			if (field === 'question') {
				question = lineFields[i];
			}
			if (field === 'answer') {
				answer = lineFields[i];
			}
		}
		viewProvider.updateCurrentLine(line, question, answer);
	}

	context.subscriptions.push(
		vscode.commands.registerCommand('data-massage.extend', async(count?, hint?, mark_original_correct?) => {
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
					mark_original_correct: mark_original_correct ?? false,
				};
				const result = await collectPython(['extend', '--file', filename, '--payload', JSON.stringify(payload)], '');
				console.log(result)
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('data-massage.remove_duplicate', async() => {
			const editor = vscode.window.activeTextEditor;
			if (editor !== undefined) {
				const filename = getFilename();
				const response = await collectPython(['remove_duplicate', '--file', filename], '');
				const {rows_deleted} = JSON.parse(response);
				vscode.window.showInformationMessage(`Rows deleted: ${rows_deleted}`);
				console.log('removed_duplicate')
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('data-massage.edit-dodgy', async(hint) => {
			if (hint === undefined) {
				hint = await vscode.window.showInputBox({
					prompt: 'Enter your hint (or empty to auto-fix)'
				});
			}
			const filename = getFilename();
			const payload = {hint};
			const result = await collectPython(['edit_dodgy', '--file', filename, '--payload', JSON.stringify(payload)], '');
			console.log(result);
			const {rows_considered, rows_edited} = JSON.parse(result);
			vscode.window.showInformationMessage(`Rows considered: ${rows_considered}, Rows edited: ${rows_edited}`);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('data-massage.remove-dodgy', async(hint) => {
			const filename = getFilename();
			const result = await collectPython(['remove_dodgy', '--file', filename], '');
			const {num_removed} = JSON.parse(result);
			vscode.window.showInformationMessage(`Dodgy Rows Removed: ${num_removed}`);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('data-massage.edit_with_llm', async(hint) => {
			if (hint === undefined) {
				hint = await vscode.window.showInputBox({
					prompt: 'Enter your hint (or empty to auto-fix)'
				});
			}
			const filename = getFilename();
			const payload = {hint};
			const result = await collectPython(['edit_llm', '--file', filename, '--payload', JSON.stringify(payload)], '');
			console.log(result);
			const {rows_incorrect, rows_potentially_incorrect, rows_correct} = JSON.parse(result);
			vscode.window.showInformationMessage(`Rows correct: ${rows_correct}, Rows Possibly Wrong: ${rows_potentially_incorrect}, Rows incorrect: ${rows_incorrect}`);
		})
	);


	context.subscriptions.push(
		vscode.commands.registerCommand('data-massage.human-eval', async(opinion?: string, row?: number) => {
			if (opinion === undefined) {
				opinion = await vscode.window.showInputBox({
					prompt: 'Enter your opinion (correct, wrong, unsure)'
				});
			}
			if (opinion === undefined) {
				return;
			}

			const editor = vscode.window.activeTextEditor;
			if (editor === undefined) {
				return;
			}
			const filename = getFilename();
			if (row === undefined) {
				row = editor.selection.active.line + 1;
			}
			const payload = {
				row,
				column: 'human',
				value: opinion,
			};
			const result = await collectPython(['human_eval', '--file', filename, '--payload', JSON.stringify(payload)], '');
			const result_payload = JSON.parse(result);
			if (result_payload.row === null || result_payload.row === undefined) {
				vscode.window.showInformationMessage("No more rows to evaluate. You're all set!");
				return;
			}
			editor.selection = new vscode.Selection(result_payload.row - 1, 0, result_payload.row - 1, 0);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('data-massage.human-eval-fix', async(hint?:string, row?:number) => {
			const editor = vscode.window.activeTextEditor;
			if (editor === undefined) {
				return;
			}
			if (hint === undefined) {
				hint = await vscode.window.showInputBox({
					prompt: 'Enter your hint'
				});
			}
			if (hint === undefined) {
				return;
			}
			if (row === undefined) {
				row = editor.selection.active.line + 1;
			}
			const filename = getFilename();
			const payload = {
				row,
				column: 'human',
				hint,
			};
			const result = await collectPython(['human_eval_fix', '--file', filename, '--payload', JSON.stringify(payload)], '');
			editor.selection = new vscode.Selection(row - 1, 0, row - 1, 0);
			viewProvider.clearHumanEvalHint();
		}));

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

	context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(event => {
        if (event.textEditor === vscode.window.activeTextEditor) {
            updateCurrentLine(event.textEditor);
        }
    }));
}

function splitCsvLine(line: string): string[] {
	const fields = [];
	let field = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (c === ',' && !inQuotes) {
			fields.push(field);
			field = '';
		} else if (c === '"') {
			inQuotes = !inQuotes;
		} else {
			field += c;
		}
	}
	fields.push(field);
	return fields;
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
	updateCurrentLine(line: number, question: string, answer: string) {
		if (this._view) {
			this._view.webview.postMessage({
				command: 'human-eval',
				row: line,
				question: question,
				answer: answer,
			});
		}
	}
	clearHumanEvalHint() {
		if (this._view) {
			this._view.webview.postMessage({
				command: 'human-eval-clear-hint',
			});
		}
	}
	resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Thenable<void> | void {
		this._view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')]
		};
		webviewView.webview.onDidReceiveMessage(async message => {
			switch (message.command) {
				case 'extend':
					await vscode.commands.executeCommand('data-massage.extend', message.count, message.hint, message.mark_original_correct);
					return;
				case 'edit-dodgy':
					await vscode.commands.executeCommand('data-massage.edit-dodgy', message.hint);
					return;
				case 'edit_with_llm':
					await vscode.commands.executeCommand('data-massage.edit_with_llm', message.hint);
					return;
				case 'human-eval':
					await vscode.commands.executeCommand('data-massage.human-eval', message.opinion, message.row);
					return;
				case 'human-eval-fix':
					await vscode.commands.executeCommand('data-massage.human-eval-fix', message.fix, message.row);
					return;
				case 'delete_duplicates':
					await vscode.commands.executeCommand('data-massage.remove_duplicate');
					return;
				case 'remove_dodgy':
					await vscode.commands.executeCommand('data-massage.remove-dodgy');
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
				<div id="visit_eval" class="option" style="display:none">Eval</div>
				<div id="visit_human_eval" class="option">Human Eval</div>
			</div>
			<div id="panel_main">
				<div id="grow_shrink">
					Current size: <span id="current_size">-</span>
					<br>
					<button id="extend">Extend by</button>
					<input type="number" id="extend_amount" value="100">
					<input type="checkbox" id="extend_mark_correct">Mark original correct
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
					<hr>					
				</div>
				<div id="edit" style="display:none">
					<textarea id="edit_hint"></textarea>
					<br>
					<button id="edit_dodgy">Fix dodgy</button>
					<button id="edit_all">Edit all records</button>
					<button id="edit_with_llm">Check record with LLM</button>
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
					<button id="human_eval_correct">Yes</button>
					<button id="human_eval_wrong">No</button>
					<button id="human_eval_unsure">Unsure</button>
					<button id="human_eval_garbage">Poor quality</button>
					<button id="human_eval_duplicate">Duplicate</button>
					<br>
					<br>
					<textarea id="human_eval_hint"></textarea>
					<br>
					<button id="human_eval_fix">Fix</button>
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
						case 'human-eval-clear-hint':
							document.getElementById('human_eval_hint').value = '';
							break;
					}
				});
				document.getElementById('extend').addEventListener('click', () => {
					vscode.postMessage({
						command: 'extend',
						count: parseInt(document.getElementById('extend_amount').value),
						hint: document.getElementById('extend_hint').value,
						mark_original_correct: document.getElementById('extend_mark_correct').checked
					});
				});
				document.getElementById('delete_duplicates').addEventListener('click', () => {
					vscode.postMessage({ command: 'delete_duplicates' });
				});
				document.getElementById('delete_dodgy').addEventListener('click', () => {
					vscode.postMessage({ command: 'remove_dodgy' });
				});
				document.getElementById('edit_dodgy').addEventListener('click', () => {
					vscode.postMessage({ command: 'edit-dodgy', hint: document.getElementById('edit_hint').value });
				}); edit_with_llm
				document.getElementById('edit_with_llm').addEventListener('click', () => {
					vscode.postMessage({ command: 'edit_with_llm', hint: document.getElementById('edit_hint').value });
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
				document.getElementById('human_eval_garbage').addEventListener('click', () => {
					vscode.postMessage({ command: 'human-eval', opinion: 'garbage', row: parseInt(document.getElementById('human_eval_row').textContent) });
				});
				document.getElementById('human_eval_duplicate').addEventListener('click', () => {
					vscode.postMessage({ command: 'human-eval', opinion: 'duplicate', row: parseInt(document.getElementById('human_eval_row').textContent) });
				});
				document.getElementById('human_eval_fix').addEventListener('click', () => {
					vscode.postMessage({ command: 'human-eval-fix', fix: document.getElementById('human_eval_hint').value, row: parseInt(document.getElementById('human_eval_row').textContent) });
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
