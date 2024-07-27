import argparse
import io
import pandas as pd
import sys

from test2 import extend_evals

def main():
    inp = sys.stdin.read()
    df = pd.read_csv(io.StringIO(inp))
    extend_evals(df)

if __name__ == '__main__':
    main()
