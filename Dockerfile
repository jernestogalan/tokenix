FROM node:20-alpine

# Security: run as non-root user
RUN addgroup -S tokenix && adduser -S tokenix -G tokenix

WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy application source
COPY --chown=tokenix:tokenix . .

# Remove dev files
RUN rm -rf test/ .github/ .env.example 2>/dev/null || true

USER tokenix

EXPOSE 3000

ENV NODE_ENV=production \
    PORT=3000

CMD ["node", "server.js"]
