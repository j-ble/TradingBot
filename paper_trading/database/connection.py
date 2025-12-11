"""
Database connection pool manager for paper trading system.
Handles asyncpg connection pooling and provides query execution methods.
"""

import asyncpg
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
from config import config
from utils.logger import logger


class DatabasePool:
    """Manages PostgreSQL connection pool with asyncpg."""

    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self._connected = False

    async def connect(self) -> None:
        """Initialize the connection pool."""
        if self._connected:
            logger.warning("Database pool already connected")
            return

        try:
            self.pool = await asyncpg.create_pool(
                host=config.DB_HOST,
                port=config.DB_PORT,
                database=config.DB_NAME,
                user=config.DB_USER,
                password=config.DB_PASSWORD,
                min_size=2,
                max_size=10,
                command_timeout=60,
                timeout=30
            )
            self._connected = True
            logger.info(
                f"Database pool connected to {config.DB_HOST}:{config.DB_PORT}/{config.DB_NAME}"
            )

            # Test connection
            async with self.pool.acquire() as conn:
                version = await conn.fetchval("SELECT version()")
                logger.debug(f"PostgreSQL version: {version}")

        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise

    async def disconnect(self) -> None:
        """Close the connection pool."""
        if self.pool:
            await self.pool.close()
            self._connected = False
            logger.info("Database pool disconnected")

    async def fetch_one(self, query: str, *args) -> Optional[Dict[str, Any]]:
        """
        Execute a query and return a single row as a dict.

        Args:
            query: SQL query string
            *args: Query parameters

        Returns:
            Dictionary of column_name: value or None if no results
        """
        if not self._connected:
            raise RuntimeError("Database pool not connected. Call connect() first.")

        try:
            async with self.pool.acquire() as conn:
                row = await conn.fetchrow(query, *args)
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Query failed: {query[:100]}... Error: {e}")
            raise

    async def fetch_all(self, query: str, *args) -> List[Dict[str, Any]]:
        """
        Execute a query and return all rows as list of dicts.

        Args:
            query: SQL query string
            *args: Query parameters

        Returns:
            List of dictionaries (column_name: value)
        """
        if not self._connected:
            raise RuntimeError("Database pool not connected. Call connect() first.")

        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(query, *args)
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Query failed: {query[:100]}... Error: {e}")
            raise

    async def fetch_val(self, query: str, *args) -> Any:
        """
        Execute a query and return a single value.

        Args:
            query: SQL query string
            *args: Query parameters

        Returns:
            Single value from first column of first row
        """
        if not self._connected:
            raise RuntimeError("Database pool not connected. Call connect() first.")

        try:
            async with self.pool.acquire() as conn:
                return await conn.fetchval(query, *args)
        except Exception as e:
            logger.error(f"Query failed: {query[:100]}... Error: {e}")
            raise

    async def execute(self, query: str, *args) -> str:
        """
        Execute a query without returning results (INSERT, UPDATE, DELETE).

        Args:
            query: SQL query string
            *args: Query parameters

        Returns:
            Status string from the database
        """
        if not self._connected:
            raise RuntimeError("Database pool not connected. Call connect() first.")

        try:
            async with self.pool.acquire() as conn:
                return await conn.execute(query, *args)
        except Exception as e:
            logger.error(f"Query failed: {query[:100]}... Error: {e}")
            raise

    async def execute_many(self, query: str, args_list: List[tuple]) -> None:
        """
        Execute a query multiple times with different parameters.

        Args:
            query: SQL query string
            args_list: List of tuples containing query parameters
        """
        if not self._connected:
            raise RuntimeError("Database pool not connected. Call connect() first.")

        try:
            async with self.pool.acquire() as conn:
                await conn.executemany(query, args_list)
        except Exception as e:
            logger.error(f"Batch query failed: {query[:100]}... Error: {e}")
            raise

    @asynccontextmanager
    async def transaction(self):
        """
        Context manager for database transactions.

        Usage:
            async with db.transaction() as conn:
                await conn.execute("INSERT ...")
                await conn.execute("UPDATE ...")
        """
        if not self._connected:
            raise RuntimeError("Database pool not connected. Call connect() first.")

        async with self.pool.acquire() as conn:
            async with conn.transaction():
                yield conn

    @property
    def is_connected(self) -> bool:
        """Check if the pool is connected."""
        return self._connected and self.pool is not None


# Global database instance
db = DatabasePool()
