# ---- Stage 1: Build the React frontend ----
FROM node:20-bullseye AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ---- Stage 2: Production image ----
FROM node:20-bullseye
WORKDIR /app

COPY --from=mwader/static-ffmpeg:9.0.2-1 /ffmpeg /usr/local/bin/
COPY --from=mwader/static-ffmpeg:9.0.2-1 /ffprobe /usr/local/bin/
RUN ffmpeg -version && ffprobe -version

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/build ./build
COPY . .

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000
CMD ["node", "server/index.js"]