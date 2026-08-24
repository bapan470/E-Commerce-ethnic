-- Add views and tracking columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS views INT DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS clicks INT DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP DEFAULT NULL;

-- Create product_views_log table for detailed tracking
CREATE TABLE IF NOT EXISTS product_views_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID,
  viewed_at TIMESTAMP DEFAULT NOW(),
  referrer TEXT,
  source TEXT DEFAULT 'direct'
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_product_views_log_product_id ON product_views_log(product_id);
CREATE INDEX IF NOT EXISTS idx_product_views_log_viewed_at ON product_views_log(viewed_at);
CREATE INDEX IF NOT EXISTS idx_products_views ON products(views DESC);

-- Enable RLS if needed
ALTER TABLE product_views_log ENABLE ROW LEVEL SECURITY;
