# Build context: repository root (see docker-compose.yml).
# Produces feed-api with the visual-editor SPA at /app/ui when UI_STATIC_ROOT=/app/ui.

FROM node:20-alpine AS ui-build
WORKDIR /build
COPY services/visual-editor/package.json services/visual-editor/package-lock.json ./
RUN npm ci
COPY services/visual-editor/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
COPY services/feed-api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/feed-api/ .
COPY database/migrations ./database/migrations
COPY --from=ui-build /build/dist ./ui
ENV UI_STATIC_ROOT=/app/ui
ENV PORT=8000
EXPOSE 8000
CMD ["python", "main.py"]
