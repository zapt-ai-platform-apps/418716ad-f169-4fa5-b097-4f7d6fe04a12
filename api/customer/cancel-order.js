import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';
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
  console.log('customer/cancel-order API called');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await authenticateUser(req);
    const { orderId } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ error: 'Missing order ID' });
    }
    
    const client = postgres(process.env.COCKROACH_DB_URL);
    const db = drizzle(client);
    
    // Check if order exists and belongs to this customer
    const orderResult = await db
      .select({
        id: orders.id,
        status: orders.status
      })
      .from(orders)
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.customerId, user.id)
        )
      )
      .limit(1);
    
    if (orderResult.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = orderResult[0];
    
    // Can only cancel pending orders
    if (order.status !== 'pending') {
      await client.end();
      return res.status(400).json({ 
        error: 'Cannot cancel order that has been accepted or is in progress'
      });
    }
    
    // Update order status to cancelled
    await db
      .update(orders)
      .set({
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId));
    
    await client.end();
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in customer/cancel-order API:', error);
    Sentry.captureException(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}