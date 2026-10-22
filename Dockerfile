FROM node:20-bullseye

COPY --from=mwader/static-ffmpeg:9.0.2-1 /ffmpeg /usr/local/bin/
COPY --from=mwader/static-ffmpeg:9.0.2-1 /ffprobe /usr/local/bin/

RUN ffmpeg -version && ffprobe -version

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["node", "server/index.js"]