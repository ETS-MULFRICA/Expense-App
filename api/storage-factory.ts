// Configuration for storage backend
export const USE_SUPABASE = process.env.USE_SUPABASE === 'true';

/**
 * Storage Factory
 * Creates the appropriate storage implementation based on configuration
 */
export async function createStorage(): Promise<any> {
  if (USE_SUPABASE) {
    console.log('⚠️  Supabase storage not fully implemented yet');
    console.log('🧠 Falling back to PostgreSQL storage backend');
  } else {
    console.log('🧠 Using PostgreSQL storage backend');
  }
  
  console.log('✅ Data will persist in PostgreSQL database');
  // Return the PostgreSQL storage instance
  const { storage } = await import('./storage');
  return storage;
}
