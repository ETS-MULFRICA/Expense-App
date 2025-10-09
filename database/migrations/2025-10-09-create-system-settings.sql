-- Create system_settings table for app-wide configurations
-- Migration: 2025-10-09-create-system-settings.sql

CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  setting_type VARCHAR(20) NOT NULL DEFAULT 'text', -- text, number, boolean, json, file
  category VARCHAR(50) NOT NULL, -- site, branding, localization, email, security
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE, -- whether setting can be exposed to frontend
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, is_public) VALUES
-- Site Information
('site_name', 'Expense Tracker', 'text', 'site', 'Application name displayed in header and emails', true),
('site_description', 'Manage your finances with ease', 'text', 'site', 'Site description for meta tags', true),
('site_url', 'http://localhost:5000', 'text', 'site', 'Base URL for the application', false),

-- Branding
('logo_url', '', 'file', 'branding', 'URL path to uploaded logo image', true),
('favicon_url', '', 'file', 'branding', 'URL path to favicon', true),
('primary_color', '#3b82f6', 'text', 'branding', 'Primary brand color (hex code)', true),
('secondary_color', '#64748b', 'text', 'branding', 'Secondary brand color (hex code)', true),

-- Localization
('default_currency', 'XAF', 'text', 'localization', 'Default currency for new users', true),
('default_language', 'en', 'text', 'localization', 'Default language for the application', true),
('timezone', 'UTC', 'text', 'localization', 'Default timezone', true),
('date_format', 'MM/DD/YYYY', 'text', 'localization', 'Default date format', true),
('number_format', 'en-US', 'text', 'localization', 'Default number format locale', true),

-- Email Settings
('email_enabled', 'false', 'boolean', 'email', 'Enable email notifications', false),
('email_from_name', 'Expense Tracker', 'text', 'email', 'From name for outgoing emails', false),
('email_from_address', 'noreply@localhost', 'text', 'email', 'From address for outgoing emails', false),
('smtp_host', '', 'text', 'email', 'SMTP server host', false),
('smtp_port', '587', 'number', 'email', 'SMTP server port', false),
('smtp_username', '', 'text', 'email', 'SMTP username', false),
('smtp_password', '', 'text', 'email', 'SMTP password (encrypted)', false),

-- Security
('session_timeout', '24', 'number', 'security', 'Session timeout in hours', false),
('max_login_attempts', '5', 'number', 'security', 'Maximum login attempts before lockout', false),
('lockout_duration', '15', 'number', 'security', 'Account lockout duration in minutes', false),
('password_min_length', '8', 'number', 'security', 'Minimum password length', false),
('require_password_complexity', 'true', 'boolean', 'security', 'Require complex passwords', false),

-- Features
('enable_budgets', 'true', 'boolean', 'features', 'Enable budget functionality', true),
('enable_analytics', 'true', 'boolean', 'features', 'Enable analytics dashboard', true),
('enable_exports', 'true', 'boolean', 'features', 'Enable data export functionality', true),
('enable_categories', 'true', 'boolean', 'features', 'Enable custom categories', true),

-- Email Templates
('email_template_welcome', '{"subject": "Welcome to {{site_name}}", "body": "Hello {{user_name}},\n\nWelcome to {{site_name}}! Your account has been created successfully.\n\nBest regards,\nThe {{site_name}} Team"}', 'json', 'email', 'Welcome email template', false),
('email_template_password_reset', '{"subject": "Password Reset - {{site_name}}", "body": "Hello {{user_name}},\n\nClick the link below to reset your password:\n{{reset_link}}\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nThe {{site_name}} Team"}', 'json', 'email', 'Password reset email template', false),
('email_template_expense_notification', '{"subject": "Expense Added - {{site_name}}", "body": "Hello {{user_name}},\n\nA new expense of {{amount}} has been added to your account.\n\nDescription: {{description}}\nCategory: {{category}}\nDate: {{date}}\n\nBest regards,\nThe {{site_name}} Team"}', 'json', 'email', 'Expense notification email template', false)

ON CONFLICT (setting_key) DO NOTHING;

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_system_settings_updated_at();

-- Create function to get setting value by key
CREATE OR REPLACE FUNCTION get_system_setting(key_name VARCHAR)
RETURNS TEXT AS $$
DECLARE
    setting_val TEXT;
BEGIN
    SELECT setting_value INTO setting_val 
    FROM system_settings 
    WHERE setting_key = key_name;
    
    RETURN setting_val;
END;
$$ LANGUAGE plpgsql;

-- Create function to update setting
CREATE OR REPLACE FUNCTION update_system_setting(key_name VARCHAR, new_value TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    rows_affected INTEGER;
BEGIN
    UPDATE system_settings 
    SET setting_value = new_value, updated_at = NOW()
    WHERE setting_key = key_name;
    
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql;