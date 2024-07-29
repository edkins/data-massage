import argparse
import io
import json
import pandas as pd
import sys

def remove_first_line(s):
    # Find the index of the first newline character
    newline_index = s.find('\n')
    
    # If a newline character is found, slice the string
    if newline_index != -1:
        return s[newline_index + 1:]
    else:
        # If no newline character is found, return the original string
        return s


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', type=str)
    parser.add_argument('--payload', type=str)
    parser.add_argument('--file', type=str)
    args = parser.parse_args()

    if args.command == 'extend':
        from test2 import extend_evals
        with open(args.file, 'r') as f:
            inp = f.read()
        
        payload = json.loads(args.payload)
        hint = payload.get('hint', '')
        amount = payload.get('count', 20)
        mark_original_correct = payload.get('mark_original_correct', False)

        df = pd.read_csv(io.StringIO(inp))
        
        if mark_original_correct:
            if 'human' in df.columns:
                # Mark all rows with empty or NaN human column as correct
                df.loc[(df['human'] == '') | df['human'].isna()]['human'] = 'correct'
            else:
                # Add a human column and mark all rows as correct
                df['human'] = 'correct'
            extension = extend_evals(df, hint, amount)
            original_csv = df.to_csv(index=False, header=True)
            with open(args.file, 'w') as f:
                f.write(original_csv)
                f.write(extension)
        else:
            extension = extend_evals(df, hint, amount)
            with open(args.file, 'a') as f:
                if not inp.endswith('\n'):
                    f.write('\n')
                f.write(extension)
    elif args.command == 'edit_llm':
        from utils.RagCheck import RAGCheck
        with open(args.file, 'r') as f:
            inp = f.read()

        payload = json.loads(args.payload)
        hint = payload.get('hint', '')
        checker = RAGCheck()
        checked = checker.rag_check(inp, 5, hint)

        with open(args.file, 'w') as f:
            f.write(checked)

        df = pd.read_csv(io.StringIO(checked))
        value_counts = df['model_result'].value_counts()

        # Load counts into variables, defaulting to 0 if the value is not found
        count_00 = value_counts.get(0, 0)
        count_01 = value_counts.get(1, 0)
        count_11 = value_counts.get(2, 0)

        print(json.dumps({'rows_incorrect': str(count_00), 'rows_potentially_incorrect': str(count_01), 'rows_correct': str(count_11)}))


    elif args.command == 'edit_dodgy':
        from edit import edit_dodgy
        with open(args.file, 'r') as f:
            inp = f.read()
        payload = json.loads(args.payload)
        hint = payload.get('hint', '')
        outp, rows_considered, rows_edited = edit_dodgy(inp, hint)
        with open(args.file, 'w') as f:
            f.write(outp)
        print(json.dumps({'rows_considered': rows_considered, 'rows_edited': rows_edited}))
    elif args.command == 'human_eval':
        from human_eval import human_eval, human_insert
        with open(args.file, 'r') as f:
            inp = f.read()
        payload = json.loads(args.payload)
        column = payload.get('column', 'human')
        row = payload.get('row')
        value = payload.get('value')
        outp = human_insert(inp, row, column, value)
        with open(args.file, 'w') as f:
            f.write(outp)
        chosen_row, qa = human_eval(outp, column)
        print(json.dumps({'row': chosen_row, 'question': qa.get('question'), 'answer': qa.get('answer')}))
    elif args.command == 'remove_duplicate':
        from test2 import remove_duplicates
        with open(args.file, 'r') as f:
            inp = f.read()
        df = pd.read_csv(io.StringIO(inp))
        delete = remove_duplicates(df)
        with open(args.file, 'w') as f:
            f.write(delete)
        print(json.dumps({'rows_deleted': str(len(df) - len(pd.read_csv(io.StringIO(delete))))}))
    elif args.command == 'remove_dodgy':
        from edit import remove_dodgy
        with open(args.file, 'r') as f:
            inp = f.read()
        outp, num_removed = remove_dodgy(inp)
        with open(args.file, 'w') as f:
            f.write(outp)
        print(json.dumps({'num_removed': num_removed}))
    else:
        raise ValueError(f"Unknown command: {args.command}")

if __name__ == '__main__':
    main()
