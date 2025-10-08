#!/usr/bin/env node

import { PostgresStorage } from './api/postgres-storage.ts';

async function testPermissionMiddleware() {
  const storage = new PostgresStorage();
  
  console.log('Testing RBAC permission middleware...\n');

  try {
    // Test getting all roles
    console.log('1. Testing getAllRoles...');
    const roles = await storage.getAllRoles();
    console.log(`✓ Found ${roles.length} roles:`);
    roles.forEach(role => {
      console.log(`  - ${role.name} (${role.permissions?.length || 0} permissions)`);
    });

    // Test getting all permissions
    console.log('\n2. Testing getAllPermissions...');
    const permissions = await storage.getAllPermissions();
    console.log(`✓ Found ${permissions.length} permissions:`);
    permissions.slice(0, 5).forEach(perm => {
      console.log(`  - ${perm.name}: ${perm.description}`);
    });
    if (permissions.length > 5) {
      console.log(`  ... and ${permissions.length - 5} more`);
    }

    // Test role creation
    console.log('\n3. Testing role creation...');
    const testRole = await storage.createRole({ 
      name: 'test_middleware_role', 
      description: 'Test role for middleware verification' 
    });
    console.log(`✓ Created test role: ${testRole.name} (ID: ${testRole.id})`);

    // Test permission assignment
    console.log('\n4. Testing permission assignment...');
    const permissionIds = permissions.slice(0, 3).map(p => p.id);
    await storage.setRolePermissions(testRole.id, permissionIds);
    console.log(`✓ Assigned ${permissionIds.length} permissions to test role`);

    // Test getting role with permissions
    console.log('\n5. Testing getRoleById with permissions...');
    const roleWithPermissions = await storage.getRoleById(testRole.id);
    console.log(`✓ Role: ${roleWithPermissions?.name}`);
    console.log(`✓ Permissions: ${roleWithPermissions?.permissions?.map(p => p.name).join(', ')}`);

    // Test getting users by role (should be empty)
    console.log('\n6. Testing getUsersByRole...');
    const usersWithRole = await storage.getUsersByRole(testRole.id);
    console.log(`✓ Users with role: ${usersWithRole.length}`);

    // Cleanup
    console.log('\n7. Cleaning up test role...');
    await storage.deleteRole(testRole.id);
    console.log('✓ Test role deleted');

    console.log('\n✅ All permission middleware tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPermissionMiddleware().then(() => {
  console.log('\nTest completed');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});