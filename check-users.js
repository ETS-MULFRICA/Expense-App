#!/usr/bin/env node

import { PostgresStorage } from './api/postgres-storage.js';

async function checkUsers() {
  const storage = new PostgresStorage();
  
  try {
    console.log('Checking existing users...');
    
    // Let's check what users exist
    const userExists = await storage.getUser(1);
    console.log('User 1:', userExists ? `${userExists.username} (${userExists.email})` : 'Not found');
    
    const user2Exists = await storage.getUser(2);
    console.log('User 2:', user2Exists ? `${user2Exists.username} (${user2Exists.email})` : 'Not found');
    
    const user3Exists = await storage.getUser(3);
    console.log('User 3:', user3Exists ? `${user3Exists.username} (${user3Exists.email})` : 'Not found');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkUsers();