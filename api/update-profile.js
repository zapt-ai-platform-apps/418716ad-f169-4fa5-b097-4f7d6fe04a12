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
  console.log('update-profile API called');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await authenticateUser(req);
    const { name, phone, address, city } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const client = postgres(process.env.COCKROACH_DB_URL);
    const db = drizzle(client);
    
    // Check if profile exists
    const profileResult = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);
    
    if (profileResult.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    // Update profile
    await db
      .update(profiles)
      .set({
        name,
        phone,
        address,
        city,
        updatedAt: new Date()
      })
      .where(eq(profiles.userId, user.id));
    
    await client.end();
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in update-profile API:', error);
    Sentry.captureException(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}