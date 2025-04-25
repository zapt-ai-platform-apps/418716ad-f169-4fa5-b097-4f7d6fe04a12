import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { profiles } from '../drizzle/schema.js';
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
  console.log('profile API called');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await authenticateUser(req);
    
    const client = postgres(process.env.COCKROACH_DB_URL);
    const db = drizzle(client);
    
    const result = await db
      .select({
        id: profiles.id,
        name: profiles.name,
        phone: profiles.phone,
        address: profiles.address,
        city: profiles.city,
        avatarUrl: profiles.avatarUrl
      })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);
    
    await client.end();
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    return res.status(200).json(result[0]);
  } catch (error) {
    console.error('Error in profile API:', error);
    Sentry.captureException(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}