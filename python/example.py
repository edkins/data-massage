import sys
import time

#from test import extend_evals

def main():
    inp = sys.stdin.read()
    for _ in range(4):
        for _ in range(3):
            sys.stdout.write(f"blah")
            sys.stdout.flush()
            time.sleep(1)
        sys.stdout.write(f"blah\n")
        sys.stdout.flush()
        time.sleep(1)

if __name__ == '__main__':
    main()
