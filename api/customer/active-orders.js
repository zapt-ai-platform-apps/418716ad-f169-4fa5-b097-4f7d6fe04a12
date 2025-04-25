import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, or } from 'drizzle-orm';
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
  console.log('customer/active-orders API called');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await authenticateUser(req);
    
    const client = postgres(process.env.COCKROACH_DB_URL);
    const db = drizzle(client);
    
    // Get active orders with partner info if available
    const result = await db
      .select({
        id: orders.id,
        serviceType: orders.serviceType,
        description: orders.description,
        location: orders.location,
        status: orders.status,
        createdAt: orders.createdAt,
        partnerId: orders.partnerId,
        partnerName: profiles.name
      })
      .from(orders)
      .leftJoin(profiles, eq(orders.partnerId, profiles.userId))
      .where(
        and(
          eq(orders.customerId, user.id),
          or(
            eq(orders.status, 'pending'),
            eq(orders.status, 'accepted'),
            eq(orders.status, 'in_progress')
          )
        )
      )
      .orderBy(orders.createdAt);
    
    await client.end();
    
    return res.status(200).json({ orders: result });
  } catch (error) {
    console.error('Error in customer/active-orders API:', error);
    Sentry.captureException(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}