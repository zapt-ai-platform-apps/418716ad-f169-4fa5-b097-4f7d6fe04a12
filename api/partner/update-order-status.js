import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';
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
  console.log('partner/update-order-status API called');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await authenticateUser(req);
    const { orderId, status } = req.body;
    
    if (!orderId || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate status
    if (!['accepted', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const client = postgres(process.env.COCKROACH_DB_URL);
    const db = drizzle(client);
    
    // Check if order exists and belongs to this partner
    const orderResult = await db
      .select({
        id: orders.id,
        status: orders.status,
        price: orders.price
      })
      .from(orders)
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.partnerId, user.id)
        )
      )
      .limit(1);
    
    if (orderResult.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = orderResult[0];
    
    // Begin transaction
    await db.transaction(async (tx) => {
      // Update order status
      await tx
        .update(orders)
        .set({
          status,
          updatedAt: new Date()
        })
        .where(eq(orders.id, orderId));
      
      // If status is completed, create transaction record
      if (status === 'completed' && order.price) {
        await tx
          .insert(transactions)
          .values({
            orderId,
            amount: order.price,
            status: 'completed'
          });
      }
    });
    
    await client.end();
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in partner/update-order-status API:', error);
    Sentry.captureException(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}