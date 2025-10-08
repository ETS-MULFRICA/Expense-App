#!/usr/bin/env tsx

/**
 * Admin Dashboard User Management - Acceptance Tests
 * 
 * Tests the following acceptance criteria:
 * 1. Admin creates a user → new user can log in
 * 2. Admin suspends user → user cannot log in  
 * 3. Soft-deleted user is flagged, not permanently removed
 */

import { pool } from '../api/db';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'password'
};

interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

class TestRunner {
  private passed = 0;
  private failed = 0;
  private adminSession: string | null = null;
  private testUsers: number[] = [];

  async run() {
    console.log('\n🧪 Running Admin User Management Acceptance Tests...\n');

    try {
      await this.setupTest();
      await this.runTests();
    } finally {
      await this.cleanup();
    }

    this.printResults();
    return this.failed === 0;
  }

  async setupTest() {
    console.log('🔧 Setting up test environment...');
    
    // Wait for server
    await this.waitForServer();
    
    // Login as admin
    await this.loginAsAdmin();
    
    console.log('✅ Test environment ready\n');
  }

  async waitForServer(maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`${BASE_URL}/api/health`);
        if (response.ok || response.status === 404) {
          return;
        }
      } catch (error) {
        if (i === maxAttempts - 1) {
          throw new Error(`Server not ready after ${maxAttempts} attempts`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async loginAsAdmin() {
    const response = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ADMIN_CREDENTIALS)
    });

    if (!response.ok) {
      throw new Error(`Admin login failed: ${response.status}`);
    }

    const setCookieHeader = response.headers.get('set-cookie');
    if (!setCookieHeader) {
      throw new Error('No session cookie received');
    }

    this.adminSession = setCookieHeader;
    console.log('🔐 Admin logged in successfully');
  }

  async makeAuthenticatedRequest(path: string, options: any = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.adminSession) {
      headers['Cookie'] = this.adminSession;
    }

    return fetch(`${BASE_URL}${path}`, {
      ...options,
      headers
    });
  }

  async runTests() {
    await this.testCreateUserAndLogin();
    await this.testSuspendUserBlocksLogin();
    await this.testSoftDeletePreservesUser();
  }

  async testCreateUserAndLogin() {
    console.log('⏳ Test 1: Admin creates a user → new user can log in');
    
    try {
      // Create user
      const userData = {
        username: `testuser_${Date.now()}`,
        name: 'Test User',
        email: `test_${Date.now()}@example.com`,
        password: 'testpassword123',
        role: 'user'
      };

      const createResponse = await this.makeAuthenticatedRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(userData)
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create user: ${createResponse.status}`);
      }

      const createdUser = await createResponse.json() as User;
      this.testUsers.push(createdUser.id);

      // Test login
      const loginResponse = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userData.username,
          password: userData.password
        })
      });

      if (!loginResponse.ok) {
        throw new Error(`User login failed: ${loginResponse.status}`);
      }

      const loggedInUser = await loginResponse.json();
      
      if (loggedInUser.username !== userData.username) {
        throw new Error('Username mismatch after login');
      }

      this.passed++;
      console.log('✅ Test 1 passed\n');
      
    } catch (error) {
      this.failed++;
      console.log(`❌ Test 1 failed: ${(error as Error).message}\n`);
    }
  }

  async testSuspendUserBlocksLogin() {
    console.log('⏳ Test 2: Admin suspends user → user cannot log in');
    
    try {
      // Create user
      const userData = {
        username: `suspendtest_${Date.now()}`,
        name: 'Suspend Test User',
        email: `suspend_${Date.now()}@example.com`,
        password: 'testpassword123',
        role: 'user'
      };

      const createResponse = await this.makeAuthenticatedRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(userData)
      });

      const user = await createResponse.json() as User;
      this.testUsers.push(user.id);

      // Verify initial login works
      const initialLogin = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userData.username,
          password: userData.password
        })
      });

      if (!initialLogin.ok) {
        throw new Error('User should be able to log in initially');
      }

      // Suspend user
      const suspendResponse = await this.makeAuthenticatedRequest(`/api/admin/users/${user.id}/suspend`, {
        method: 'PATCH'
      });

      if (!suspendResponse.ok) {
        throw new Error(`Failed to suspend user: ${suspendResponse.status}`);
      }

      // Test login after suspension
      const suspendedLogin = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userData.username,
          password: userData.password
        })
      });

      if (suspendedLogin.ok) {
        throw new Error('Suspended user should not be able to log in');
      }

      if (suspendedLogin.status !== 401) {
        throw new Error(`Expected 401, got ${suspendedLogin.status}`);
      }

      // Verify status in database
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT status FROM users WHERE id = $1', [user.id]);
        const dbUser = result.rows[0];
        
        if (dbUser.status !== 'suspended') {
          throw new Error(`Expected status 'suspended', got '${dbUser.status}'`);
        }
      } finally {
        client.release();
      }

      this.passed++;
      console.log('✅ Test 2 passed\n');
      
    } catch (error) {
      this.failed++;
      console.log(`❌ Test 2 failed: ${(error as Error).message}\n`);
    }
  }

  async testSoftDeletePreservesUser() {
    console.log('⏳ Test 3: Soft-deleted user is flagged, not permanently removed');
    
    try {
      // Create user
      const userData = {
        username: `deletetest_${Date.now()}`,
        name: 'Delete Test User',
        email: `delete_${Date.now()}@example.com`,
        password: 'testpassword123',
        role: 'user'
      };

      const createResponse = await this.makeAuthenticatedRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(userData)
      });

      const user = await createResponse.json() as User;
      this.testUsers.push(user.id);

      // Verify initial login works
      const initialLogin = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userData.username,
          password: userData.password
        })
      });

      if (!initialLogin.ok) {
        throw new Error('User should be able to log in initially');
      }

      // Soft delete user by setting status to 'deleted' (simulating soft delete)
      const client = await pool.connect();
      try {
        await client.query('UPDATE users SET status = $1 WHERE id = $2', ['deleted', user.id]);
      } finally {
        client.release();
      }

      // Verify user still exists in database
      const client2 = await pool.connect();
      try {
        const result = await client2.query('SELECT * FROM users WHERE id = $1', [user.id]);
        const dbUser = result.rows[0];
        
        if (!dbUser) {
          throw new Error('User should still exist in database after soft delete');
        }
        
        if (dbUser.status !== 'deleted') {
          throw new Error(`Expected status 'deleted', got '${dbUser.status}'`);
        }
        
        if (dbUser.username !== userData.username) {
          throw new Error('Username should remain unchanged');
        }
      } finally {
        client2.release();
      }

      // Test login after soft delete
      const deletedLogin = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userData.username,
          password: userData.password
        })
      });

      if (deletedLogin.ok) {
        throw new Error('Deleted user should not be able to log in');
      }

      if (deletedLogin.status !== 401) {
        throw new Error(`Expected 401, got ${deletedLogin.status}`);
      }

      this.passed++;
      console.log('✅ Test 3 passed\n');
      
    } catch (error) {
      this.failed++;
      console.log(`❌ Test 3 failed: ${(error as Error).message}\n`);
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up test data...');
    
    // Hard delete test users
    for (const userId of this.testUsers) {
      try {
        const client = await pool.connect();
        try {
          await client.query('DELETE FROM users WHERE id = $1', [userId]);
        } finally {
          client.release();
        }
      } catch (error) {
        console.warn(`Failed to cleanup user ${userId}:`, (error as Error).message);
      }
    }
    
    console.log('✅ Cleanup complete');
  }

  printResults() {
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📈 Total: ${this.passed + this.failed}`);
    
    if (this.failed === 0) {
      console.log('\n🎉 All acceptance tests passed!');
    } else {
      console.log(`\n💥 ${this.failed} test(s) failed.`);
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new TestRunner();
  runner.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}