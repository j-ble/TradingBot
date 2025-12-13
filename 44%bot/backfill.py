
import asyncio
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Dict, Any, Optional

from coinbase.rest import RESTClient
from config import config
from database.connection import db
from utils.logger import logger

# Constants
PRODUCT_ID = "BTC-USD"
GRANULARITY = "FIVE_MINUTE"

class CoinbaseBackfillerSdk:
    def __init__(self):
        # The SDK handles auth automatically
        # Remove newlines for SDK if present, similar to manual handling
        api_secret = config.COINBASE_API_SECRET
        if '\\n' in api_secret:
            api_secret = api_secret.replace('\\n', '\n')
            
        self.client = RESTClient(
            api_key=config.COINBASE_API_KEY,
            api_secret=api_secret
        )

    def fetch_candles(self, start: datetime, end: datetime) -> List[Dict[str, Any]]:
        # SDK uses unix timestamps
        start_ts = int(start.timestamp())
        end_ts = int(end.timestamp())
        
        try:
            # get_candles returns a dictionary with 'candles' key
            response = self.client.get_candles(
                product_id=PRODUCT_ID,
                start=start_ts,
                end=end_ts,
                granularity=GRANULARITY
            )
            
            # SDK returns an object, not a dict
            if hasattr(response, 'candles'):
                return response.candles
            return []
            
        except Exception as e:
            logger.error(f"Failed to fetch candles: {e}")
            return []

    async def save_candles(self, candles: List[Dict[str, Any]]):
        if not candles:
            return

        values = []
        for c in candles:
            # Candles from SDK might be objects
            if hasattr(c, 'start'):
                 start_val = c.start
                 open_val = c.open
                 high_val = c.high
                 low_val = c.low
                 close_val = c.close
                 volume_val = c.volume
            else:
                 # Fallback to dict
                 start_val = c['start']
                 open_val = c['open']
                 high_val = c['high']
                 low_val = c['low']
                 close_val = c['close']
                 volume_val = c['volume']

            if isinstance(start_val, str) and not start_val.isdigit():
                 dt = datetime.fromisoformat(start_val.replace('Z', '+00:00'))
            else:
                 dt = datetime.fromtimestamp(int(start_val), tz=timezone.utc)
            
            values.append((
                dt,
                Decimal(str(open_val)),
                Decimal(str(high_val)),
                Decimal(str(low_val)),
                Decimal(str(close_val)),
                Decimal(str(volume_val))
            ))

        query = """
            INSERT INTO candles_5m (timestamp, open, high, low, close, volume)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (timestamp) DO NOTHING
        """
        
        await db.execute_many(query, values)
        logger.info(f"Saved {len(values)} candles")


async def main():
    start_date = datetime(2025, 10, 1, tzinfo=timezone.utc)
    end_date = datetime(2025, 11, 20, tzinfo=timezone.utc)
    
    # 24 hour chunks
    chunk_size = timedelta(hours=24)
    
    backfiller = CoinbaseBackfillerSdk()
    await db.connect()
    
    try:
        current_start = start_date
        total_fetched = 0
        
        logger.info(f"Starting backfill from {start_date} to {end_date}")
        
        while current_start < end_date:
            current_end = min(current_start + chunk_size, end_date)
            
            logger.info(f"Fetching chunk: {current_start} -> {current_end}")
            
            # SDK is synchronous for this call usually, wrap in executor if needed
            # But here we run it directly since it's a script
            candles = backfiller.fetch_candles(current_start, current_end)
            
            if candles:
                await backfiller.save_candles(candles)
                total_fetched += len(candles)
                logger.info(f"Progress: {total_fetched} candles total")
            else:
                logger.warning(f"No candles found for chunk {current_start} -> {current_end}")
            
            # Rate limit politeness
            await asyncio.sleep(0.5)
            
            current_start = current_end
            
        logger.info("Backfill complete!")
        
    finally:
        await db.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
