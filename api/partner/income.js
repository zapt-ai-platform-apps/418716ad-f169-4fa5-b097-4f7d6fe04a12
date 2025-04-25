import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, desc, sum, count, sql } from 'drizzle-orm';
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
  console.log('partner/income API called');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await authenticateUser(req);
    
    const client = postgres(process.env.COCKROACH_DB_URL);
    const db = drizzle(client);
    
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
    
    // Get current month's income
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyIncomeResult = await db
      .select({ total: sum(transactions.amount) })
      .from(transactions)
      .innerJoin(orders, eq(transactions.orderId, orders.id))
      .where(
        and(
          eq(orders.partnerId, user.id),
          eq(transactions.status, 'completed'),
          sql`${transactions.createdAt} >= ${firstDayOfMonth.toISOString()}`
        )
      );
    
    // Get count of completed orders
    const completedOrdersResult = await db
      .select({ count: count() })
      .from(orders)
      .where(
        and(
          eq(orders.partnerId, user.id),
          eq(orders.status, 'completed')
        )
      );
    
    // Get transaction history
    const transactionHistory = await db
      .select({
        id: transactions.id,
        orderId: transactions.orderId,
        amount: transactions.amount,
        createdAt: transactions.createdAt,
        serviceType: orders.serviceType
      })
      .from(transactions)
      .innerJoin(orders, eq(transactions.orderId, orders.id))
      .where(
        and(
          eq(orders.partnerId, user.id),
          eq(transactions.status, 'completed')
        )
      )
      .orderBy(desc(transactions.createdAt));
    
    await client.end();
    
    return res.status(200).json({
      totalIncome: totalIncomeResult[0]?.total || 0,
      monthlyIncome: monthlyIncomeResult[0]?.total || 0,
      totalCompletedOrders: completedOrdersResult[0]?.count || 0,
      transactions: transactionHistory
    });
  } catch (error) {
    console.error('Error in partner/income API:', error);
    Sentry.captureException(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}