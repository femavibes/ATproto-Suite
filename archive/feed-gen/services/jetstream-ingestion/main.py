"""Main entry point for jetstream-ingestion service."""

import asyncio
from database import init_db, close_db
from worker import JetstreamWorker


async def main():
    """Main function."""
    # Initialize database
    await init_db()
    
    # Create and run worker
    worker = JetstreamWorker()
    
    try:
        await worker.run()
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
