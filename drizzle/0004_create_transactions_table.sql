CREATE TABLE IF NOT EXISTS "transactions" (
  "id" SERIAL PRIMARY KEY,
  "order_id" INTEGER NOT NULL REFERENCES "orders"("id"),
  "amount" DECIMAL(10, 2) NOT NULL,
  "status" TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'refunded')),
  "created_at" TIMESTAMP DEFAULT NOW()
);