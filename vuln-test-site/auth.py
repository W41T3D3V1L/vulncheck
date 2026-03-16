import sqlite3
import hashlib
import subprocess
import pickle
import os

# VULN: Hardcoded secret key
SECRET_KEY = "flask-secret-abc123"
ADMIN_PASSWORD = "password123"

def get_user(username):
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    # VULN: SQL Injection
    query = f"SELECT * FROM users WHERE username = '{username}'"
    cursor.execute(query)
    return cursor.fetchone()

def check_password(password):
    # VULN: MD5 for password hashing (weak)
    return hashlib.md5(password.encode()).hexdigest()

def run_command(user_input):
    # VULN: Command injection via shell=True
    result = subprocess.run(user_input, shell=True, capture_output=True)
    return result.stdout

def load_session(data):
    # VULN: Insecure deserialization
    return pickle.loads(data)

def read_file(path):
    # VULN: Path traversal
    base = "/app/uploads/"
    full_path = base + path
    with open(full_path, 'r') as f:
        return f.read()

def eval_expr(expression):
    # VULN: Arbitrary code execution via eval
    return eval(expression)
