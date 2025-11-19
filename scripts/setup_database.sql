-- Trading Bot Database Setup Script
-- This script creates the database and user for the trading bot

-- Create database user (if doesn't exist)
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'trading_bot_user') THEN

      CREATE ROLE trading_bot_user LOGIN PASSWORD 'changeme_in_production';
   END IF;
END
$do$;

-- Create database (run this as postgres user)
-- If database already exists, this will fail gracefully
CREATE DATABASE trading_bot
    WITH
    OWNER = trading_bot_user
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TEMPLATE = template0
    CONNECTION LIMIT = -1;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE trading_bot TO trading_bot_user;

-- Connect to the trading_bot database to set schema permissions
\c trading_bot

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO trading_bot_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO trading_bot_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO trading_bot_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO trading_bot_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO trading_bot_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO trading_bot_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO trading_bot_user;

-- Display success message
\echo 'Database setup complete!'
\echo 'Database: trading_bot'
\echo 'User: trading_bot_user'
\echo 'Password: changeme_in_production (remember to change this in .env file)'
