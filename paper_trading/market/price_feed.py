"""
Coinbase price feed for fetching live BTC-USD market data.
Uses direct HTTP requests with JWT authentication.
"""

import asyncio
import time
import uuid
import httpx
from decimal import Decimal
from typing import Optional, Dict
from datetime import datetime, timedelta
import jwt as pyjwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

from config import config
from utils.logger import logger


class PriceFeed:
    """Fetches live BTC-USD prices from Coinbase Advanced Trade API."""

    BASE_URL = "https://api.coinbase.com"
    PRODUCT_ID = "BTC-USD"

    def __init__(self):
        self.api_key = config.COINBASE_API_KEY
        self.api_secret = config.COINBASE_API_SECRET
        self.client: Optional[httpx.AsyncClient] = None

        # Price caching to reduce API calls (cache for 1 second)
        self._last_price: Optional[Decimal] = None
        self._last_fetch_time: Optional[datetime] = None
        self._cache_duration = timedelta(seconds=1)

        self._connected = False
        self._private_key = None

    async def connect(self) -> None:
        """Initialize the price feed (validate credentials)."""
        if self._connected:
            logger.warning("Price feed already connected")
            return

        try:
            # Initialize HTTP client
            self.client = httpx.AsyncClient(timeout=10.0)

            # Process API secret (handle escaped newlines)
            api_secret = self.api_secret
            if '\\n' in api_secret:
                api_secret = api_secret.replace('\\n', '\n')

            # Load the private key
            self._private_key = serialization.load_pem_private_key(
                api_secret.encode(),
                password=None,
                backend=default_backend()
            )
            logger.debug("Private key loaded successfully")

            # Test credentials by fetching current price
            price = await self._fetch_price_from_api()
            if price:
                logger.info(f"Price feed connected. Current BTC-USD: ${price:,.2f}")
                self._connected = True
            else:
                raise RuntimeError("Failed to fetch initial price")
        except Exception as e:
            logger.error(f"Failed to connect price feed: {e}")
            raise

    async def disconnect(self) -> None:
        """Close the HTTP client."""
        if self.client:
            await self.client.aclose()
        self._connected = False
        self._private_key = None
        logger.info("Price feed disconnected")

    def _generate_jwt(self, request_method: str, request_path: str) -> str:
        """
        Generate JWT token for Coinbase API authentication.

        Args:
            request_method: HTTP method (GET, POST, etc.)
            request_path: API endpoint path

        Returns:
            JWT token string
        """
        try:
            # Create JWT payload
            uri = f"{request_method} api.coinbase.com{request_path}"
            now = int(time.time())

            payload = {
                'sub': self.api_key,
                'iss': 'coinbase-cloud',
                'nbf': now,
                'exp': now + 120,  # 2 minutes
                'aud': ['cdp_service'],
                'uri': uri
            }

            # Sign JWT
            token = pyjwt.encode(
                payload,
                self._private_key,
                algorithm='ES256',  # ECDSA with SHA-256
                headers={'kid': self.api_key, 'nonce': str(uuid.uuid4())}
            )

            logger.debug(f"Generated JWT for {request_method} {request_path}")
            return token

        except Exception as e:
            logger.error(f"JWT generation failed: {e}")
            raise RuntimeError(f"Failed to generate authentication token: {e}")

    async def _fetch_price_from_api(self) -> Optional[Decimal]:
        """
        Fetch current BTC-USD price from Coinbase API.
        Uses best bid/ask endpoint for most accurate price.

        Returns:
            Current mid-price (average of best bid and ask) or None on failure
        """
        if not self.client or not self._private_key:
            raise RuntimeError("Client not initialized")

        endpoint = f"/api/v3/brokerage/best_bid_ask?product_ids={self.PRODUCT_ID}"
        url = f"{self.BASE_URL}{endpoint}"

        try:
            # Generate JWT token
            jwt_token = self._generate_jwt('GET', endpoint)

            # Build headers
            headers = {
                'Authorization': f'Bearer {jwt_token}',
                'Content-Type': 'application/json'
            }

            # Make API request
            response = await self.client.get(url, headers=headers)
            response.raise_for_status()

            data = response.json()

            # Parse response
            if 'pricebooks' in data and len(data['pricebooks']) > 0:
                pricebook = data['pricebooks'][0]

                if 'bids' in pricebook and 'asks' in pricebook and len(pricebook['bids']) > 0 and len(pricebook['asks']) > 0:
                    best_bid = Decimal(pricebook['bids'][0]['price'])
                    best_ask = Decimal(pricebook['asks'][0]['price'])

                    # Calculate mid-price
                    mid_price = (best_bid + best_ask) / Decimal('2')
                    logger.debug(
                        f"Fetched BTC-USD: ${mid_price:,.2f} "
                        f"(bid: ${best_bid:,.2f}, ask: ${best_ask:,.2f})"
                    )
                    return mid_price
                else:
                    logger.warning("Missing bid or ask in API response")
                    return None
            else:
                logger.warning("No pricebooks in API response")
                return None

        except httpx.HTTPStatusError as e:
            logger.error(f"API request failed with status {e.response.status_code}: {e}")
            return None
        except Exception as e:
            logger.error(f"Failed to fetch price from API: {e}")
            return None

    async def get_current_price(self, use_cache: bool = True) -> Decimal:
        """
        Get the current BTC-USD price.

        Args:
            use_cache: If True, return cached price if < 1 second old

        Returns:
            Current BTC-USD price

        Raises:
            RuntimeError: If price fetch fails
        """
        if not self._connected:
            raise RuntimeError("Price feed not connected. Call connect() first.")

        # Check cache
        now = datetime.utcnow()
        if use_cache and self._last_price and self._last_fetch_time:
            cache_age = now - self._last_fetch_time
            if cache_age < self._cache_duration:
                logger.debug(f"Using cached price: ${self._last_price:,.2f}")
                return self._last_price

        # Fetch fresh price
        price = await self._fetch_price_from_api()

        if price is None:
            if self._last_price:
                logger.warning("API fetch failed, using last cached price")
                return self._last_price
            else:
                raise RuntimeError("Failed to fetch price and no cached price available")

        # Update cache
        self._last_price = price
        self._last_fetch_time = now

        return price

    async def get_bid_ask_spread(self) -> Dict[str, Decimal]:
        """
        Get detailed bid/ask information.

        Returns:
            Dictionary with 'bid', 'ask', 'mid', 'spread', 'spread_percent'
        """
        if not self.client or not self._private_key:
            raise RuntimeError("Client not initialized")

        endpoint = f"/api/v3/brokerage/best_bid_ask?product_ids={self.PRODUCT_ID}"
        url = f"{self.BASE_URL}{endpoint}"

        try:
            # Generate JWT token
            jwt_token = self._generate_jwt('GET', endpoint)

            # Build headers
            headers = {
                'Authorization': f'Bearer {jwt_token}',
                'Content-Type': 'application/json'
            }

            # Make API request
            response = await self.client.get(url, headers=headers)
            response.raise_for_status()

            data = response.json()

            if 'pricebooks' in data and len(data['pricebooks']) > 0:
                pricebook = data['pricebooks'][0]

                best_bid = Decimal(pricebook['bids'][0]['price'])
                best_ask = Decimal(pricebook['asks'][0]['price'])
                mid_price = (best_bid + best_ask) / Decimal('2')
                spread = best_ask - best_bid
                spread_percent = (spread / mid_price) * Decimal('100')

                return {
                    'bid': best_bid,
                    'ask': best_ask,
                    'mid': mid_price,
                    'spread': spread,
                    'spread_percent': spread_percent
                }
            else:
                raise RuntimeError("No pricebooks in API response")

        except Exception as e:
            logger.error(f"Failed to fetch bid/ask spread: {e}")
            raise

    @property
    def is_connected(self) -> bool:
        """Check if the price feed is connected."""
        return self._connected and self.client is not None


# Global price feed instance
price_feed = PriceFeed()
