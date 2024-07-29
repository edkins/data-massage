# data-massage
VS Code plugin for creating and improving datasets with LLMs

## Developing

```
npm install
npm run compile
```

Then open `src/extension.ts` in vscode and `Run/Start Debugging`.

## Using the tool

First run the command `Data Massage - Set OpenAI Key` and paste in an OpenAI API key. The tool will not work without this.

Next click `View` / `Open View` / `Data Massage` to ensure the Data Massage panel is visible.

You'll need to create and save a .csv file with `question` and `answer` columns. Make sure the editor for that file is active when you are using Data Massager.

- The `grow/shrink` sub-panel will let you extend the dataset with an optional hint. It will also let you remove records marked as dodgy, or auto-remove duplicates.
- The `edit` sub-panel lets you automatically make changes to all records marked as dodgy.
- The `human eval` sub-panel shows the question and answer for the currently selected row. You can click Yes/No/Unsure/Poor Quality/Duplicate to set the corresponding value in the `human` column in the data (the column will be created if not already present).
- Alternatively you can type instructions to the LLM and hit `Fix` which will attempt to fix up the current row.
