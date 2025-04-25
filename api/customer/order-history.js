import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, or, desc } from 'drizzle-orm';
import { orders, profiles } from '../../drizzle/schema.js';
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
  console.log('customer/order-history API called');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await authenticateUser(req);
    
    const client = postgres(process.env.COCKROACH_DB_URL);
    const db = drizzle(client);
    
    const result = await db
      .select({
        id: orders.id,
        serviceType: orders.serviceType,
        status: orders.status,
        price: orders.price,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        partnerId: orders.partnerId,
        partnerName: profiles.name
      })
      .from(orders)
      .leftJoin(profiles, eq(orders.partnerId, profiles.userId))
      .where(
        and(
          eq(orders.customerId, user.id),
          or(
            eq(orders.status, 'completed'),
            eq(orders.status, 'cancelled')
          )
        )
      )
      .orderBy(desc(orders.updatedAt));
    
    await client.end();
    
    return res.status(200).json({ orders: result });
  } catch (error) {
    console.error('Error in customer/order-history API:', error);
    Sentry.captureException(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}