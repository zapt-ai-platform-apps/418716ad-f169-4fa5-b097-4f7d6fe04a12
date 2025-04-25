import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
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
  console.log('customer/create-order API called');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await authenticateUser(req);
    const { serviceType, description, location } = req.body;
    
    if (!serviceType || !description || !location) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const client = postgres(process.env.COCKROACH_DB_URL);
    const db = drizzle(client);
    
    const result = await db
      .insert(orders)
      .values({
        customerId: user.id,
        serviceType,
        description,
        location,
        status: 'pending'
      })
      .returning({ id: orders.id });
    
    await client.end();
    
    return res.status(201).json({ 
      success: true,
      orderId: result[0].id
    });
  } catch (error) {
    console.error('Error in customer/create-order API:', error);
    Sentry.captureException(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}