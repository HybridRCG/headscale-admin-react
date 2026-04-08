FROM node:20-alpine
WORKDIR /app

# Copy package files and install express
COPY package.json package-lock.json ./
RUN npm install express

# Copy built React app
COPY build/ ./build/

# Write the WORKING server.js directly
RUN cat > /app/server.js << 'EOFJS'
const express = require('express');
const path = require('path');
const app = express();
const buildPath = path.join(__dirname, 'build');
console.log('Starting React server, serving from:', buildPath);
app.use(express.static(buildPath));
app.use((req, res) => {
  console.log('Serving index.html for route:', req.path);
  res.sendFile(path.join(buildPath, 'index.html'));
});
app.listen(3000, () => {
  console.log('✅ React app listening on port 3000');
});
EOFJS

EXPOSE 3000
CMD ["node", "/app/server.js"]
