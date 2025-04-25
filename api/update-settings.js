import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { settings } from '../drizzle/schema.js';
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
  console.log('update-settings API called');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await authenticateUser(req);
    const { notificationsEnabled, theme, language } = req.body;
    
    const client = postgres(process.env.COCKROACH_DB_URL);
    const db = drizzle(client);
    
    // Check if settings exist
    const settingsResult = await db
      .select({ id: settings.id })
      .from(settings)
      .where(eq(settings.userId, user.id))
      .limit(1);
    
    if (settingsResult.length === 0) {
      // Create new settings
      await db
        .insert(settings)
        .values({
          userId: user.id,
          notificationsEnabled: notificationsEnabled !== undefined ? notificationsEnabled : true,
          theme: theme || 'light',
          language: language || 'id'
        });
    } else {
      // Update settings
      const updateData = {};
      
      if (notificationsEnabled !== undefined) {
        updateData.notificationsEnabled = notificationsEnabled;
      }
      
      if (theme) {
        updateData.theme = theme;
      }
      
      if (language) {
        updateData.language = language;
      }
      
      updateData.updatedAt = new Date();
      
      await db
        .update(settings)
        .set(updateData)
        .where(eq(settings.userId, user.id));
    }
    
    await client.end();
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in update-settings API:', error);
    Sentry.captureException(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}