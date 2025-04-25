import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { orders } from '../../drizzle/schema.js';
import { authenticateUser } from "../_apiUtils.js";
import * as Sentry from "@sentry/node";

// Initialize Sentry
Sentry.init({
  dsn: process.env.VITE_PUBLIC_SENTRY_DSN,
  environment: process.env.VITE_PUBLIC_APP_ENV,
  initialScope: {
    tags: {
      type: 'backend',
      projectId: process.env.VITE_PUBLIC_APP_ID
    }
  }
});

export default async function handler(req, res) {
  console.log('partner/available-orders API called');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await authenticateUser(req);
    
    const client = postgres(process.env.COCKROACH_DB_URL);
    const db = drizzle(client);
    
    const availableOrders = await db
      .select({
        id: orders.id,
        serviceType: orders.serviceType,
        description: orders.description,
        location: orders.location,
        price: orders.price,
        createdAt: orders.createdAt
      })
      .from(orders)
      .where(eq(orders.status, 'pending'))
      .orderBy(orders.createdAt);
    
    await client.end();
    
    return res.status(200).json({ orders: availableOrders });
  } catch (error) {
    console.error('Error in partner/available-orders API:', error);
    Sentry.captureException(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}