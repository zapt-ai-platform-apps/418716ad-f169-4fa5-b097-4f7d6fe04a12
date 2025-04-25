import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { users } from '../drizzle/schema.js';
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
  console.log('checkUser API called');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = await authenticateUser(req);
    const { id } = req.body;
    
    if (auth.id !== id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const client = postgres(process.env.COCKROACH_DB_URL);
    const db = drizzle(client);
    
    const result = await db.select({
      id: users.id,
      role: users.role
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
    
    await client.end();
    
    if (result.length === 0) {
      return res.status(200).json({ exists: false });
    }
    
    return res.status(200).json({ 
      exists: true,
      role: result[0].role
    });
  } catch (error) {
    console.error('Error in checkUser API:', error);
    Sentry.captureException(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}