#!/usr/bin/env node

import { PostgresStorage } from './api/postgres-storage.js';

async function debugPermissions() {
  console.log('🔍 Debugging permission system...');
  
  const storage = new PostgresStorage();
  
  try {
    // Check user 14's roles and permissions
    console.log('\n1. Checking user 14 roles:');
    const userRoles = await storage.getUserRoles(14);
    console.log('User roles:', userRoles.map(r => `${r.name} (ID: ${r.id})`));
    
    console.log('\n2. Checking user 14 permissions:');
    const userPermissions = await storage.getUserPermissions(14);
    console.log('User permissions:', userPermissions.map(p => p.name));
    
    console.log('\n3. Checking admin role permissions:');
    const adminRole = await storage.getRoleWithPermissions(1);
    console.log('Admin role permissions:', adminRole?.permissions?.map(p => p.name));
    
    console.log('\n4. Testing specific permission checks:');
    const hasAdminRoles = await storage.hasPermission(14, 'admin:roles');
    const hasAdminStats = await storage.hasPermission(14, 'admin:stats');
    const hasUsersRead = await storage.hasPermission(14, 'users:read');
    
    console.log(`hasPermission(14, 'admin:roles'): ${hasAdminRoles}`);
    console.log(`hasPermission(14, 'admin:stats'): ${hasAdminStats}`);
    console.log(`hasPermission(14, 'users:read'): ${hasUsersRead}`);
    
    console.log('\n5. Checking specific permission IDs:');
    const allPermissions = await storage.getAllPermissions();
    const adminReadPerm = allPermissions.find(p => p.name === 'admin:read');
    const adminWritePerm = allPermissions.find(p => p.name === 'admin:write');
    
    console.log(`admin:read permission:`, adminReadPerm);
    console.log(`admin:write permission:`, adminWritePerm);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  }
}

debugPermissions();