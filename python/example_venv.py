import os
import subprocess
import sys
import venv

def venv_stuff():
    file_dir = os.path.dirname(os.path.realpath(__file__))
    env = f'{file_dir}/env'
    if not os.path.exists(env):
        venv.EnvBuilder(with_pip=True).create(env)
        subprocess.run([f'{env}/bin/pip', 'install', '-r', f'{file_dir}/requirements.txt'], check=True, stdout=sys.stderr)
    subprocess.run([f'{env}/bin/python', f'{file_dir}/example.py', '--', *sys.argv[1:]])

if __name__ == '__main__':
    venv_stuff()
