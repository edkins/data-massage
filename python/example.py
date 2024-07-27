import argparse
import io
import json
import pandas as pd
import sys

from test2 import extend_evals, human_eval, human_insert

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', type=str)
    parser.add_argument('--payload', type=str)
    parser.add_argument('--file', type=str)
    args = parser.parse_args()

    if args.command == 'extend':
        inp = sys.stdin.read()
        df = pd.read_csv(io.StringIO(inp))
        print(inp)
        extension = extend_evals(df)
        print(extension)
    elif args.command == 'human_eval':
        with open(args.file, 'r') as f:
            inp = f.read()
        payload = json.loads(args.payload)
        column = 'human'
        row = payload.get('row')
        value = payload.get('value')
        if row is not None:
            outp = human_insert(inp, row, column, value)
            with open(args.file, 'w') as f:
                f.write(outp)
        else:
            outp = inp
        chosen_row = human_eval(outp)
        print(json.dumps({'row': chosen_row}))
    else:
        raise ValueError(f"Unknown command: {args.command}")

if __name__ == '__main__':
    main()
