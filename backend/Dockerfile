FROM node:20-alpine

# better-sqlite3 has a native binding. Install build deps for npm install,
# then prune them after install to keep the image small.
RUN apk add --no-cache --virtual .build-deps python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN apk del .build-deps

# Persistent SQLite location. Mount a volume here in docker-compose.
ENV TELEMETRY_DB_PATH=/app/data/telemetry.db
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["npm", "start"]
