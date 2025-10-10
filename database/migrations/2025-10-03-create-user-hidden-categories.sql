-- Migration: Create user_hidden_categories table
-- This allows users to hide system categories from their personal view
-- Ensure table exists and add missing columns if needed
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_hidden_categories') THEN
    CREATE TABLE user_hidden_categories (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
      category_type TEXT NOT NULL CHECK (category_type IN ('expense', 'budget')),
      hidden_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, category_id, category_type)
    );
  ELSE
    -- Add any missing columns to the existing table
    ALTER TABLE user_hidden_categories ADD COLUMN IF NOT EXISTS category_type TEXT;
    ALTER TABLE user_hidden_categories ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMP DEFAULT NOW();
  END IF;
END $$;

-- Create indexes if they do not exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_hidden_categories_user_id') THEN
    CREATE INDEX idx_user_hidden_categories_user_id ON user_hidden_categories(user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_hidden_categories_category') THEN
    CREATE INDEX idx_user_hidden_categories_category ON user_hidden_categories(category_id, category_type);
  END IF;
END $$;

-- Add comments for documentation (idempotent)
COMMENT ON TABLE user_hidden_categories IS 'Tracks which system categories each user has chosen to hide from their interface';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_description d JOIN pg_class c ON d.objoid = c.oid WHERE c.relname = 'user_hidden_categories' AND d.description IS NOT NULL) THEN
    COMMENT ON COLUMN user_hidden_categories.category_type IS 'Type of category: expense or budget (for future expansion)';
  END IF;
END $$;