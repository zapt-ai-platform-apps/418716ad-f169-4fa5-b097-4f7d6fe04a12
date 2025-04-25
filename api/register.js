import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users, profiles } from '../drizzle/schema.js';
import { authenticateUser } from "./_apiUtils.js";
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
  console.log('Register API called');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await authenticateUser(req);
    const { id, email, role, name, phone, address, city } = req.body;
    
    if (!id || !email || !role || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate role
    if (role !== 'partner' && role !== 'customer') {
      return res.status(400).json({ error: 'Invalid role. Must be "partner" or "customer"' });
    }
    
    const client = postgres(process.env.COCKROACH_DB_URL);
    const db = drizzle(client);
    
    // Begin transaction
    await db.transaction(async (tx) => {
      // Insert into users table
      await tx.insert(users).values({
        id,
        email,
        role
      });
      
      // Insert into profiles table
      await tx.insert(profiles).values({
        userId: id,
        name,
        phone,
        address,
        city
      });
    });
    
    await client.end();
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in register API:', error);
    Sentry.captureException(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}