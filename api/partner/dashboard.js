import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, desc, count, sum } from 'drizzle-orm';
import { orders, transactions } from '../../drizzle/schema.js';
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
  console.log('partner/dashboard API called');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await authenticateUser(req);
    
    const client = postgres(process.env.COCKROACH_DB_URL);
    const db = drizzle(client);
    
    // Get active orders count
    const activeOrdersResult = await db
      .select({ count: count() })
      .from(orders)
      .where(
        and(
          eq(orders.partnerId, user.id),
          eq(orders.status, 'accepted')
        )
      );
    
    // Get completed orders count
    const completedOrdersResult = await db
      .select({ count: count() })
      .from(orders)
      .where(
        and(
          eq(orders.partnerId, user.id),
          eq(orders.status, 'completed')
        )
      );
    
    // Get total income
    const totalIncomeResult = await db
      .select({ total: sum(transactions.amount) })
      .from(transactions)
      .innerJoin(orders, eq(transactions.orderId, orders.id))
      .where(
        and(
          eq(orders.partnerId, user.id),
          eq(transactions.status, 'completed')
        )
      );
    
    // Get recent orders
    const recentOrders = await db
      .select({
        id: orders.id,
        serviceType: orders.serviceType,
        status: orders.status,
        createdAt: orders.createdAt
      })
      .from(orders)
      .where(eq(orders.partnerId, user.id))
      .orderBy(desc(orders.createdAt))
      .limit(5);
    
    await client.end();
    
    return res.status(200).json({
      activeOrders: activeOrdersResult[0]?.count || 0,
      completedOrders: completedOrdersResult[0]?.count || 0,
      totalIncome: totalIncomeResult[0]?.total || 0,
      recentOrders
    });
  } catch (error) {
    console.error('Error in partner/dashboard API:', error);
    Sentry.captureException(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}