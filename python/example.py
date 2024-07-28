import argparse
import io
import json
import pandas as pd
import sys

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', type=str)
    parser.add_argument('--payload', type=str)
    parser.add_argument('--file', type=str)
    args = parser.parse_args()

    if args.command == 'extend':
        from test2 import extend_evals
        inp = sys.stdin.read()
        df = pd.read_csv(io.StringIO(inp))
        extension = extend_evals(df)
        print("OUTPUT", extension)
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
    else:
        raise ValueError(f"Unknown command: {args.command}")

if __name__ == '__main__':
    main()
