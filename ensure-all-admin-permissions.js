#!/usr/bin/env node

import { PostgresStorage } from './api/postgres-storage.ts';

async function ensureAllAdminPermissions() {
  console.log('🔧 Ensuring all admin users have full permissions...');
  
  const storage = new PostgresStorage();
  
  try {
    // Use the new method to ensure all admin permissions
    await storage.ensureAllAdminPermissions();
    
    console.log('\n🎉 Success! All admin users now have full permissions.');
    console.log('📋 What this means:');
    console.log('   ✅ All users with role="admin" have the admin role in RBAC');
    console.log('   ✅ Admin role has all available permissions');
    console.log('   ✅ Admin users can access all admin dashboard features');
    console.log('   ✅ No more 403 errors for admin users');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error ensuring admin permissions:', error);
    process.exit(1);
  }
}

ensureAllAdminPermissions();