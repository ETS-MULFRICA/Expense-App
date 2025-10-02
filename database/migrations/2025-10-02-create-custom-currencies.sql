-- Create custom_currencies table
CREATE TABLE IF NOT EXISTS custom_currencies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(5) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, code)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_custom_currencies_user_id ON custom_currencies(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_currencies_code ON custom_currencies(code);

-- Add some helpful comments
COMMENT ON TABLE custom_currencies IS 'User-defined custom currencies for expense tracking';
COMMENT ON COLUMN custom_currencies.code IS 'Currency code (3-5 characters, e.g., BTC, USDT)';
COMMENT ON COLUMN custom_currencies.name IS 'Human-readable currency name (e.g., Bitcoin, Tether)';