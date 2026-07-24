FROM node:18-alpine
WORKDIR /app

# Install Canvas dependencies and fonts
RUN apk add --no-cache \
    build-base \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    python3 \
    make \
    g++ \
    ttf-dejavu \
    fontconfig

# Create uploads directory and set permissions
RUN mkdir -p uploads public && \
    chown -R node:node /app

COPY package*.json ./
RUN npm install

COPY . .

# Ensure proper permissions for uploads
RUN chown -R node:node /app && \
    chmod 755 uploads public

USER node
EXPOSE 3000
CMD ["node", "daily-content-bot.js"]