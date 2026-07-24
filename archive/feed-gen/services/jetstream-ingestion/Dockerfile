FROM python:3.11-slim

WORKDIR /app

COPY services/jetstream-ingestion/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Same graph engine as feed-assignment-worker (strict / short-circuit eval for optional ingest gate)
COPY services/feed-assignment-worker/engine.py \
     services/feed-assignment-worker/condition_eval.py \
     services/feed-assignment-worker/evaluation_cost.py \
     services/feed-assignment-worker/post_payload.py \
     assign_mirror/

COPY services/jetstream-ingestion/ .

CMD ["python", "main.py"]
