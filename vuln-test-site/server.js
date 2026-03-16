const express = require('express');
const mysql = require('mysql');
const fs = require('fs');
const { exec } = require('child_process');
const app = express();

// VULN: Hardcoded credentials
const DB_PASSWORD = "admin123";
const JWT_SECRET = "supersecretkey_hardcoded";
const API_KEY = "sk-prod-abc123xyz789";

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: DB_PASSWORD,
  database: 'users'
});

app.use(express.json());

// VULN: SQL Injection - user input directly in query
app.get('/user', (req, res) => {
  const username = req.query.name;
  const query = "SELECT * FROM users WHERE username = '" + username + "'";
  db.query(query, (err, results) => {
    res.json(results);
  });
});

// VULN: Command Injection - user input passed to shell
app.post('/ping', (req, res) => {
  const host = req.body.host;
  exec('ping -c 1 ' + host, (err, stdout) => {
    res.send(stdout);
  });
});

// VULN: Path Traversal - reading arbitrary files
app.get('/file', (req, res) => {
  const filename = req.query.name;
  const content = fs.readFileSync('/var/www/' + filename, 'utf8');
  res.send(content);
});

// VULN: XSS - reflecting user input directly
app.get('/search', (req, res) => {
  const q = req.query.q;
  res.send('<html><body>Results for: ' + q + '</body></html>');
});

// VULN: Insecure random for security token
const token = Math.random().toString(36);

// VULN: No rate limiting, no auth on admin route
app.delete('/admin/delete-all', (req, res) => {
  db.query('DELETE FROM users', () => res.send('done'));
});

app.listen(3000);
