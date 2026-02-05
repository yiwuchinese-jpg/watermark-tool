# Use Node.js LTS (Long Term Support)
FROM node:18-slim

# Install system dependencies required for sharp and ffmpeg operations
# libvips is needed for sharp, and we install ffmpeg as a system backup
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
# --omit=dev keeps the image smaller
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p uploads processed

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "server.js"]
