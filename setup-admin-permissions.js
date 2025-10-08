#!/usr/bin/env node

import { PostgresStorage } from './api/postgres-storage.js';

async function assignAdminPermissions() {
  console.log('🔧 Setting up admin permissions for production use...');
  
  const storage = new PostgresStorage();
  
  try {
    // Get admin role and all permissions
    const roles = await storage.getAllRoles();
    const permissions = await storage.getAllPermissions();
    const adminRole = roles.find(r => r.name === 'admin');
    
    if (!adminRole) {
      console.error('❌ Admin role not found');
      process.exit(1);
    }
    
    console.log(`📋 Found admin role (ID: ${adminRole.id})`);
    console.log(`📋 Found ${permissions.length} permissions`);
    
    // Assign all permissions to admin role
    const allPermissionIds = permissions.map(p => p.id);
    await storage.setRolePermissions(adminRole.id, allPermissionIds);
    console.log('✅ All permissions assigned to admin role');
    
    // Ensure admin user (ID: 14) has admin role
    try {
      await storage.assignRoleToUser(14, adminRole.id);
      console.log('✅ Admin role assigned to admin user (ID: 14)');
    } catch (error) {
      console.log('✅ Admin user already has admin role');
    }
    
    // Verify admin permissions
    const adminCanReadUsers = await storage.hasPermission(14, 'users:read');
    const adminCanReadAdmin = await storage.hasPermission(14, 'admin:read');
    const adminCanManageRoles = await storage.hasPermission(14, 'admin:write');
    
    console.log('\n🔍 Verification:');
    console.log(`   - users:read: ${adminCanReadUsers}`);
    console.log(`   - admin:read: ${adminCanReadAdmin}`);
    console.log(`   - admin:write: ${adminCanManageRoles}`);
    
    if (adminCanReadUsers && adminCanReadAdmin && adminCanManageRoles) {
      console.log('\n🎉 Admin permissions setup complete!');
      console.log('   - Admin can now access all admin pages');
      console.log('   - Role management interface should work');
      console.log('   - No more 403 errors for admin user');
    } else {
      console.log('\n⚠️  Some permissions may not be working properly');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error setting up admin permissions:', error);
    process.exit(1);
  }
}

assignAdminPermissions();