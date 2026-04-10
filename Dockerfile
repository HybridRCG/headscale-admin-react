FROM node:20-alpine
WORKDIR /app

# Install docker CLI
RUN apk add --no-cache docker-cli

# Copy package files
COPY package.json package-lock.json ./
RUN npm install --production

# Copy the actual server.js with all our logic
COPY server.js ./

# Copy built React app
COPY build/ ./build/

EXPOSE 3000
CMD ["node", "server.js"]
