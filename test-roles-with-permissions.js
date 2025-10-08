#!/usr/bin/env node

import { PostgresStorage } from './api/postgres-storage.js';

async function testRolesWithPermissions() {
  console.log('🔍 Testing roles with permissions...');
  
  const storage = new PostgresStorage();
  
  try {
    console.log('\n1. Testing getAllRolesWithPermissions():');
    const rolesWithPermissions = await storage.getAllRolesWithPermissions();
    
    rolesWithPermissions.forEach(role => {
      console.log(`\n📋 Role: ${role.name} (ID: ${role.id})`);
      console.log(`   Description: ${role.description || 'N/A'}`);
      console.log(`   System: ${role.is_system || role.isSystem}`);
      console.log(`   Permissions: ${role.permissions?.length || 0}`);
      
      if (role.permissions && role.permissions.length > 0) {
        role.permissions.slice(0, 5).forEach(perm => {
          console.log(`     - ${perm.name}: ${perm.description}`);
        });
        if (role.permissions.length > 5) {
          console.log(`     ... and ${role.permissions.length - 5} more`);
        }
      }
    });
    
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testRolesWithPermissions();