FROM debian:bookworm-slim

# Install dependencies including gnupg for key management
RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    gzip \
    cron \
    gnupg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Google Cloud SDK using modern method
RUN curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee /etc/apt/sources.list.d/google-cloud-sdk.list \
    && apt-get update && apt-get install -y google-cloud-sdk \
    && rm -rf /var/lib/apt/lists/*

# Create backup directory
RUN mkdir -p /backups /scripts

# Copy backup scripts
COPY backup.sh /scripts/backup.sh
COPY upload-to-gcs.sh /scripts/upload-to-gcs.sh
COPY cleanup.sh /scripts/cleanup.sh
COPY entrypoint.sh /scripts/entrypoint.sh

# Make scripts executable
RUN chmod +x /scripts/*.sh

# Create log directory
RUN mkdir -p /var/log/backups

WORKDIR /scripts

ENTRYPOINT ["/scripts/entrypoint.sh"]
