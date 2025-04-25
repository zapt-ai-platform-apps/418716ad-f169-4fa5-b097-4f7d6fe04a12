CREATE TABLE IF NOT EXISTS "settings" (
  "id" SERIAL PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "notifications_enabled" BOOLEAN DEFAULT TRUE,
  "theme" TEXT DEFAULT 'light',
  "language" TEXT DEFAULT 'id',
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);