FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY server.js ./

# Create data directory for persistent key storage
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3550

CMD ["npm", "start"]