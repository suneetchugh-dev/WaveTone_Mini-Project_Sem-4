FROM node:18-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the server source code
COPY . .

# Expose the application port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production

# Start the Node.js application
CMD ["npm", "start"]
