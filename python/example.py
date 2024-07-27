import sys
import time

def main():
    inp = sys.stdin.read()
    for _ in range(20):
        sys.stdout.write(f"{inp} was read from stdin by example.py\n")
        sys.stdout.flush()
        time.sleep(1)

if __name__ == '__main__':
    main()
