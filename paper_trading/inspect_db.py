
import asyncio
from database.connection import db
from datetime import datetime

async def inspect():
    await db.connect()
    try:
        # Check 5M candles in October
        query_5m_oct = """
            SELECT COUNT(*) as count 
            FROM candles_5m 
            WHERE timestamp >= '2025-10-01' 
            AND timestamp < '2025-11-01'
        """
        row_oct = await db.fetch_one(query_5m_oct)
        print(f"5M Candles in October 2025: {row_oct['count']}")
        
        # Check overall stats again
        q = "SELECT MIN(timestamp) as min_t, MAX(timestamp) as max_t FROM candles_5m"
        r = await db.fetch_one(q)
        print(f"5M Range: {r['min_t']} to {r['max_t']}")

    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(inspect())
