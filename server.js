const express = require('express');
const path = require('path');
const app = express();

const buildPath = path.join(__dirname, 'build');
console.log('Starting React server, serving from:', buildPath);

// Serve static files with proper MIME types
app.use(express.static(buildPath));

// Fallback for SPA routing - MUST come after static middleware
app.use((req, res) => {
  console.log('Serving index.html for route:', req.path);
  res.sendFile(path.join(buildPath, 'index.html'));
});

app.listen(3000, () => {
  console.log('✅ React app listening on port 3000');
});
