#!/usr/bin/env tsx

/**
 * RBAC Storage Test - Quick verification of Step 2
 * Tests the new Role-Based Access Control storage methods
 */

import { pool } from '../api/db';
import { PostgresStorage } from '../api/postgres-storage';

async function testRBACStorage() {
  console.log('🧪 Testing RBAC Storage Methods...\n');
  
  // Create a mock session store for testing
  const mockSessionStore = {} as any;
  const storage = new PostgresStorage(mockSessionStore);

  try {
    // Test 1: Get all roles
    console.log('📋 Test 1: Get all roles');
    const roles = await storage.getAllRoles();
    console.log(`Found ${roles.length} roles:`, roles.map(r => r.name));
    
    // Test 2: Get all permissions
    console.log('\n📋 Test 2: Get all permissions');
    const permissions = await storage.getAllPermissions();
    console.log(`Found ${permissions.length} permissions`);
    const byResource = permissions.reduce((acc, p) => {
      acc[p.resource] = (acc[p.resource] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('Permissions by resource:', byResource);

    // Test 3: Get admin role with permissions
    console.log('\n📋 Test 3: Get admin role with permissions');
    const adminRole = await storage.getRoleByName('admin');
    if (adminRole) {
      const adminRoleWithPerms = await storage.getRoleWithPermissions(adminRole.id);
      console.log(`Admin role has ${adminRoleWithPerms?.permissions.length} permissions`);
    }

    // Test 4: Check user permissions (find an admin user)
    console.log('\n📋 Test 4: Check user permissions');
    const adminUser = await pool.query(`
      SELECT u.id, u.username 
      FROM users u 
      JOIN user_roles ur ON u.id = ur.user_id 
      JOIN roles r ON ur.role_id = r.id 
      WHERE r.name = 'admin' 
      LIMIT 1
    `);
    
    if (adminUser.rows.length > 0) {
      const userId = adminUser.rows[0].id;
      const username = adminUser.rows[0].username;
      
      const userPermissions = await storage.getUserPermissions(userId);
      const hasUserCreate = await storage.hasPermission(userId, 'users:create');
      const hasAdminDashboard = await storage.hasPermission(userId, 'admin:dashboard');
      
      console.log(`User "${username}" has ${userPermissions.length} permissions`);
      console.log(`Can create users: ${hasUserCreate}`);
      console.log(`Can access admin dashboard: ${hasAdminDashboard}`);
    }

    // Test 5: Create a test role (and clean it up)
    console.log('\n📋 Test 5: Create and delete test role');
    const testRole = await storage.createRole({
      name: 'test_role_temp',
      description: 'Temporary test role'
    });
    console.log(`Created test role: ${testRole.name}`);
    
    // Assign a permission to the test role
    const userReadPerm = permissions.find(p => p.name === 'users:read');
    if (userReadPerm) {
      await storage.assignPermissionToRole(testRole.id, userReadPerm.id);
      console.log('Assigned users:read permission to test role');
    }
    
    // Check role permissions
    const testRolePerms = await storage.getRolePermissions(testRole.id);
    console.log(`Test role has ${testRolePerms.length} permission(s)`);
    
    // Clean up
    await storage.deleteRole(testRole.id);
    console.log('Deleted test role');

    console.log('\n✅ All RBAC storage tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testRBACStorage().then(() => {
    console.log('\n🎉 RBAC Storage Layer ready for Step 3!');
    process.exit(0);
  }).catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}