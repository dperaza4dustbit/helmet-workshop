FROM registry.access.redhat.com/ubi9/nodejs-20:latest

WORKDIR /opt/app-root/src
COPY coordinator/package.json ./
RUN npm install --omit=dev
COPY coordinator/server.js ./
COPY rewards-workshop/workshop-activities.md ./workshop-activities.md

ENV PORT=8080
ENV CREDENTIALS_PATH=/data/credentials.csv
ENV STATE_PATH=/data/state.json
ENV ACTIVITIES_PATH=/opt/app-root/src/workshop-activities.md

EXPOSE 8080
CMD ["npm", "start"]
