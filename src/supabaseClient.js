import { initializeZapt } from '@zapt/zapt-js';
export const { supabase, recordLogin } = initializeZapt(import.meta.env.VITE_PUBLIC_APP_ID);