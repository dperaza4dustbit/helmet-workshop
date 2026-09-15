FROM registry.access.redhat.com/ubi9/nodejs-20:latest

WORKDIR /opt/app-root/src
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./

ENV PORT=8080
ENV CREDENTIALS_PATH=/data/credentials.csv
ENV STATE_PATH=/data/state.json

EXPOSE 8080
CMD ["npm", "start"]
