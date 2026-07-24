#!/usr/bin/env python3
import psycopg2
from datetime import datetime
import sys

DB_CONFIG = {
    'dbname': 'firehose_test',
    'user': 'test',
    'password': 'test',
    'host': 'localhost',
    'port': 5435
}

def generate_report(run_id=None):
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    if run_id:
        cursor.execute("SELECT * FROM ingestion_runs WHERE id = %s", (run_id,))
        runs = cursor.fetchall()
    else:
        cursor.execute("SELECT * FROM ingestion_runs ORDER BY started_at DESC")
        runs = cursor.fetchall()
    
    print("\n" + "="*80)
    print("FIREHOSE INGESTION TEST REPORT")
    print("="*80)
    
    for run in runs:
        run_id, name, duration, started, ended, received, saved, errors, avg_ps, peak_ps, status = run
        
        print(f"\n📊 {name} (ID: {run_id})")
        print(f"   Status: {status.upper()}")
        print(f"   Started: {started.strftime('%Y-%m-%d %H:%M:%S')}")
        if ended:
            print(f"   Ended: {ended.strftime('%Y-%m-%d %H:%M:%S')}")
            actual_duration = (ended - started).total_seconds() / 60
            print(f"   Duration: {actual_duration:.2f} minutes (planned: {duration} min)")
        print(f"   Posts Received: {received:,}")
        print(f"   Posts Saved: {saved:,}")
        print(f"   Errors: {errors:,}")
        print(f"   Avg Posts/Second: {float(avg_ps):.2f}" if avg_ps else "   Avg Posts/Second: N/A")
        print(f"   Peak Posts/Second: {peak_ps}")
        
        # Calculate storage estimates
        if saved > 0:
            avg_bytes = 500  # Estimated avg post size
            total_mb = (saved * avg_bytes) / 1024 / 1024
            posts_per_day = saved / (duration / 1440) if duration > 0 else 0
            storage_per_day_gb = (posts_per_day * avg_bytes) / 1024 / 1024 / 1024
            storage_per_week_gb = storage_per_day_gb * 7
            
            print(f"\n   📦 Storage Estimates:")
            print(f"      Current: {total_mb:.2f} MB")
            print(f"      Projected/Day: {storage_per_day_gb:.2f} GB")
            print(f"      Projected/Week: {storage_per_week_gb:.2f} GB")
        
        # Get metrics
        cursor.execute("""
            SELECT COUNT(*), AVG(posts_count), MAX(posts_count), AVG(memory_mb)
            FROM ingestion_metrics
            WHERE run_id = %s
        """, (run_id,))
        
        metrics = cursor.fetchone()
        if metrics and metrics[0] > 0:
            samples, avg_posts, max_posts, avg_mem = metrics
            print(f"\n   📈 Metrics ({samples} samples):")
            print(f"      Avg Posts/Sample: {float(avg_posts):.2f}")
            print(f"      Max Posts/Sample: {max_posts}")
            print(f"      Avg Memory: {float(avg_mem):.2f} MB")
        
        print("\n" + "-"*80)
    
    # Overall stats
    cursor.execute("""
        SELECT 
            COUNT(*) as total_runs,
            SUM(posts_saved) as total_posts,
            AVG(avg_posts_per_second) as overall_avg_ps
        FROM ingestion_runs
        WHERE status = 'completed'
    """)
    
    overall = cursor.fetchone()
    if overall and overall[0] > 0:
        print(f"\n📊 OVERALL STATISTICS")
        print(f"   Total Runs: {overall[0]}")
        print(f"   Total Posts Saved: {overall[1]:,}")
        print(f"   Average Posts/Second: {float(overall[2]):.2f}")
    
    print("\n" + "="*80 + "\n")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    run_id = int(sys.argv[1]) if len(sys.argv) > 1 else None
    generate_report(run_id)
