# Firehose Ingestion Test

Test harness to measure real-world Bluesky firehose ingestion performance.

## Setup

1. Start PostgreSQL:
```bash
docker compose up -d
```

2. Wait 5 seconds for DB to start, then initialize schema:
```bash
docker compose exec postgres psql -U test -d firehose_test -f /schema.sql
```

Or from host:
```bash
PGPASSWORD=test psql -h localhost -U test -d firehose_test -f schema.sql
```

3. Install Python dependencies:
```bash
pip install -r requirements.txt
```

## Run Tests

**1 minute test:**
```bash
python3 ingest_test.py 1 "Quick Test"
```

**5 minute test:**
```bash
python3 ingest_test.py 5 "Peak Hour Test"
```

**Custom duration:**
```bash
python3 ingest_test.py <minutes> "Optional Run Name"
```

## View Reports

**All runs:**
```bash
python3 report.py
```

**Specific run:**
```bash
python3 report.py <run_id>
```

## What It Measures

- Posts received per second (avg & peak)
- Database write performance
- Memory usage
- Error rate
- Storage projections (per day/week)

## Cleanup

```bash
docker compose down -v
```
