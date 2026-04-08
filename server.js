const express = require('express');
const path = require('path');
const app = express();

console.log('Starting server, serving from:', path.join(__dirname, 'build'));

// Serve static files
app.use(express.static(path.join(__dirname, 'build')));

// Log all requests
app.use((req, res, next) => {
  console.log('Request:', req.method, req.path);
  next();
});

// SPA fallback - serve index.html only for route requests
app.get('*', (req, res) => {
  console.log('Serving index.html for:', req.path);
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(3000, () => {
  console.log('React app listening on port 3000');
});
