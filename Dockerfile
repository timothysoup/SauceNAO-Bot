FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies for building
RUN npm install

COPY src ./src
COPY entrypoint.sh ./
COPY deploy-commands.js ./

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev

# Make entrypoint executable
RUN chmod +x entrypoint.sh

ENTRYPOINT [ "./entrypoint.sh" ]
