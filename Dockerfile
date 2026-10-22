FROM node:18-bullseye

# Copy statically linked ffmpeg/ffprobe — no apt-get, no package-manager network
COPY --from=mwader/static-ffmpeg:9.0.2-1 /ffmpeg /usr/local/bin/
COPY --from=mwader/static-ffmpeg:9.0.2-1 /ffprobe /usr/local/bin/

# Verify both binaries run (fails build if incompatible)
RUN ffmpeg -version && ffprobe -version

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["node", "server/index.js"]