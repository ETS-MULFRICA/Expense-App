-- Migration: Add category_name column to incomes table (idempotent)
ALTER TABLE incomes ADD COLUMN IF NOT EXISTS category_name VARCHAR(255);