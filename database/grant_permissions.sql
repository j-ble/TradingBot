-- ============================================================================
-- Grant Permissions to trading_user
-- ============================================================================
-- This script grants all necessary permissions to the trading_user role
-- for accessing tables, views, sequences, and functions
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO trading_user;

-- Grant permissions on all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO trading_user;

-- Grant permissions on all sequences (for SERIAL columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO trading_user;

-- Grant permissions on all views
GRANT SELECT ON ALL VIEWS IN SCHEMA public TO trading_user;

-- Grant execute on all functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO trading_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO trading_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT USAGE, SELECT ON SEQUENCES TO trading_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT SELECT ON VIEWS TO trading_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT EXECUTE ON FUNCTIONS TO trading_user;

-- Verify permissions
\echo '=======================================================================';
\echo 'Permissions Granted Successfully';
\echo '=======================================================================';
\echo 'User: trading_user';
\echo 'Permissions:';
\echo '  - SELECT, INSERT, UPDATE, DELETE on all tables';
\echo '  - SELECT on all views';
\echo '  - USAGE on all sequences';
\echo '  - EXECUTE on all functions';
\echo '=======================================================================';
