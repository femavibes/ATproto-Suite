FROM docker:27-cli AS dockercli

FROM python:3.12-slim
WORKDIR /app

# Docker CLI + compose so UI can recreate workers via mounted docker.sock
COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=dockercli /usr/local/bin/docker-compose /usr/local/bin/docker-compose
COPY --from=dockercli /usr/local/libexec/docker/cli-plugins /usr/local/libexec/docker/cli-plugins

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
COPY templates ./templates
COPY static ./static
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV LABEL_OPS_CONFIG=/data/config/labels.json
ENV LABEL_OPS_OVERLAYS=/data/config/overlays
ENV LABEL_OPS_ENV=/data/stack/.env
ENV LABEL_OPS_COMPOSE_DIR=/data/stack
ENV CONFIG_UI_PORT=8787
EXPOSE 8787
ENTRYPOINT ["/entrypoint.sh"]
CMD ["python", "app.py"]
