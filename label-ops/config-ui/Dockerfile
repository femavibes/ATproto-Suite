FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
COPY templates ./templates
COPY static ./static
ENV LABEL_OPS_CONFIG=/data/config/labels.json
ENV LABEL_OPS_OVERLAYS=/data/config/overlays
ENV CONFIG_UI_PORT=8787
EXPOSE 8787
CMD ["python", "app.py"]
