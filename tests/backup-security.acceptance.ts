#!/usr/bin/env tsx

/**
 * Backup & Security Features - Acceptance Tests (TypeScript)
 * Tests the database backup and security logging functionality
 */

interface LoginCredentials {
  username: string;
  password: string;
}

interface BackupEntry {
  id: number;
  filename: string;
  size: number;
  created_at: string;
  type: 'full' | 'schema_only' | 'data_only';
  status: 'in_progress' | 'completed' | 'failed';
  created_by_username: string;
  created_by_name: string;
  error_message?: string;
}

interface SecurityLogEntry {
  id: number;
  user_id?: number;
  event_type: string;
  ip_address: string;
  user_agent: string;
  details: any;
  created_at: string;
  username?: string;
  user_name?: string;
}

interface TestResult {
  test: string;
  status: 'PASSED' | 'FAILED' | 'TIMEOUT';
  backupId?: number;
  error?: string;
}

const BASE_URL = 'http://localhost:5000';
const ADMIN_CREDENTIALS: LoginCredentials = { username: 'admin', password: 'password' };

class BackupSecurityTestRunner {
  private adminSession: string | null = null;
  private testResults: TestResult[] = [];

  async loginAsAdmin(): Promise<void> {
    console.log('🔐 Logging in as admin...');
    
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
    console.log('✅ Admin logged in successfully');
  }

  async makeAuthenticatedRequest(path: string, options: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>
    };

    if (this.adminSession) {
      headers['Cookie'] = this.adminSession;
    }

    return fetch(`${BASE_URL}${path}`, {
      ...options,
      headers
    });
  }

  async testBackupList(): Promise<void> {
    console.log('\n📋 Test: Admin can view backup list');
    
    try {
      const response = await this.makeAuthenticatedRequest('/api/admin/backups');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch backups: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.hasOwnProperty('backups') || !Array.isArray(data.backups)) {
        throw new Error('Invalid backup list response structure');
      }

      if (!data.hasOwnProperty('pagination')) {
        throw new Error('Missing pagination in backup list response');
      }

      console.log(`✅ Backup list retrieved successfully (${data.backups.length} backups)`);
      this.testResults.push({ test: 'Backup List', status: 'PASSED' });
    } catch (error) {
      console.error(`❌ Test failed: ${error}`);
      this.testResults.push({ test: 'Backup List', status: 'FAILED', error: String(error) });
      throw error;
    }
  }

  async testCreateBackup(): Promise<number> {
    console.log('\n🔧 Test: Admin can initiate database backup');
    
    try {
      const response = await this.makeAuthenticatedRequest('/api/admin/backups/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'schema_only',
          description: 'TypeScript acceptance test backup'
        })
      });

      if (response.status !== 202) {
        throw new Error(`Backup creation failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.message || !data.backupId || !data.filename) {
        throw new Error('Invalid backup creation response');
      }

      if (data.status !== 'in_progress') {
        throw new Error(`Expected status 'in_progress', got '${data.status}'`);
      }

      console.log(`✅ Backup initiated successfully (ID: ${data.backupId})`);
      console.log(`   Filename: ${data.filename}`);
      this.testResults.push({ test: 'Create Backup', status: 'PASSED', backupId: data.backupId });
      
      return data.backupId;
    } catch (error) {
      console.error(`❌ Test failed: ${error}`);
      this.testResults.push({ test: 'Create Backup', status: 'FAILED', error: String(error) });
      throw error;
    }
  }

  async testBackupValidation(): Promise<void> {
    console.log('\n🚫 Test: Invalid backup type is rejected');
    
    try {
      const response = await this.makeAuthenticatedRequest('/api/admin/backups/create', {
        method: 'POST',
        body: JSON.stringify({
          type: 'invalid_type',
          description: 'Should fail'
        })
      });

      if (response.status !== 400) {
        throw new Error(`Expected 400 error, got ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.error || !data.error.includes('Invalid backup type')) {
        throw new Error('Expected "Invalid backup type" error message');
      }

      console.log('✅ Invalid backup type properly rejected');
      this.testResults.push({ test: 'Backup Validation', status: 'PASSED' });
    } catch (error) {
      console.error(`❌ Test failed: ${error}`);
      this.testResults.push({ test: 'Backup Validation', status: 'FAILED', error: String(error) });
      throw error;
    }
  }

  async testSecurityLogs(): Promise<void> {
    console.log('\n🛡️ Test: Admin can view security logs');
    
    try {
      const response = await this.makeAuthenticatedRequest('/api/admin/security/logs');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch security logs: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.hasOwnProperty('logs') || !Array.isArray(data.logs)) {
        throw new Error('Invalid security logs response structure');
      }

      if (!data.hasOwnProperty('pagination')) {
        throw new Error('Missing pagination in security logs response');
      }

      console.log(`✅ Security logs retrieved successfully (${data.logs.length} entries)`);
      
      // Check if we have login events
      const loginEvents = data.logs.filter((log: SecurityLogEntry) => 
        log.event_type === 'login_success' || log.event_type === 'login_failure'
      );
      
      if (loginEvents.length > 0) {
        console.log(`   Found ${loginEvents.length} login events`);
        
        // Verify log structure
        const loginEvent = loginEvents[0];
        const requiredFields = ['id', 'event_type', 'ip_address', 'user_agent', 'created_at'];
        
        for (const field of requiredFields) {
          if (!loginEvent.hasOwnProperty(field)) {
            throw new Error(`Missing required field '${field}' in security log entry`);
          }
        }
        
        console.log('✅ Security log entries have correct structure');
      }

      this.testResults.push({ test: 'Security Logs', status: 'PASSED' });
    } catch (error) {
      console.error(`❌ Test failed: ${error}`);
      this.testResults.push({ test: 'Security Logs', status: 'FAILED', error: String(error) });
      throw error;
    }
  }

  async testFailedLoginLogging(): Promise<void> {
    console.log('\n🔒 Test: Failed login attempts are logged');
    
    try {
      // Attempt login with wrong credentials
      const failedLoginResponse = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'wrong_password'
        })
      });

      if (failedLoginResponse.status !== 401) {
        throw new Error(`Expected 401 for wrong password, got ${failedLoginResponse.status}`);
      }

      // Wait a moment for the log to be written
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check security logs for the failed login
      const logsResponse = await this.makeAuthenticatedRequest('/api/admin/security/logs?event_type=login_failure');
      
      if (!logsResponse.ok) {
        throw new Error(`Failed to fetch security logs: ${logsResponse.status}`);
      }

      const data = await logsResponse.json();
      
      // Look for recent failed login attempts
      const recentFailedLogins = data.logs.filter((log: SecurityLogEntry) => {
        const logTime = new Date(log.created_at);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return log.event_type === 'login_failure' && logTime > fiveMinutesAgo;
      });

      if (recentFailedLogins.length === 0) {
        throw new Error('No recent failed login attempts found in security logs');
      }

      console.log(`✅ Failed login attempt logged successfully`);
      console.log(`   Found ${recentFailedLogins.length} recent failed login(s)`);
      
      this.testResults.push({ test: 'Failed Login Logging', status: 'PASSED' });
    } catch (error) {
      console.error(`❌ Test failed: ${error}`);
      this.testResults.push({ test: 'Failed Login Logging', status: 'FAILED', error: String(error) });
      throw error;
    }
  }

  async testSecurityStats(): Promise<void> {
    console.log('\n📊 Test: Admin can view security statistics');
    
    try {
      const response = await this.makeAuthenticatedRequest('/api/admin/security/stats');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch security stats: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.hasOwnProperty('stats')) {
        throw new Error('Missing stats in security stats response');
      }

      const stats = data.stats;
      const requiredStats = [
        'successful_logins_24h', 'failed_logins_24h', 'successful_logins_7d', 
        'failed_logins_7d', 'unique_users_24h', 'unique_ips_24h', 
        'locked_accounts', 'admin_actions_24h'
      ];

      for (const stat of requiredStats) {
        if (!stats.hasOwnProperty(stat)) {
          throw new Error(`Missing required stat '${stat}'`);
        }
        
        if (typeof stats[stat] !== 'number' || stats[stat] < 0) {
          throw new Error(`Invalid value for stat '${stat}': ${stats[stat]}`);
        }
      }

      console.log('✅ Security statistics retrieved successfully');
      console.log(`   Successful logins (24h): ${stats.successful_logins_24h}`);
      console.log(`   Failed logins (24h): ${stats.failed_logins_24h}`);
      console.log(`   Unique users (24h): ${stats.unique_users_24h}`);
      
      this.testResults.push({ test: 'Security Stats', status: 'PASSED' });
    } catch (error) {
      console.error(`❌ Test failed: ${error}`);
      this.testResults.push({ test: 'Security Stats', status: 'FAILED', error: String(error) });
      throw error;
    }
  }

  async testNonAdminAccess(): Promise<void> {
    console.log('\n🚫 Test: Non-admin cannot access backup/security endpoints');
    
    try {
      // Test without authentication
      const backupResponse = await fetch(`${BASE_URL}/api/admin/backups`);
      if (backupResponse.status !== 401) {
        throw new Error(`Expected 401 for unauthenticated backup access, got ${backupResponse.status}`);
      }

      const securityResponse = await fetch(`${BASE_URL}/api/admin/security/logs`);
      if (securityResponse.status !== 401) {
        throw new Error(`Expected 401 for unauthenticated security logs access, got ${securityResponse.status}`);
      }

      const createBackupResponse = await fetch(`${BASE_URL}/api/admin/backups/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'full' })
      });
      if (createBackupResponse.status !== 401) {
        throw new Error(`Expected 401 for unauthenticated backup creation, got ${createBackupResponse.status}`);
      }

      console.log('✅ Non-admin access properly blocked');
      this.testResults.push({ test: 'Non-Admin Access Control', status: 'PASSED' });
    } catch (error) {
      console.error(`❌ Test failed: ${error}`);
      this.testResults.push({ test: 'Non-Admin Access Control', status: 'FAILED', error: String(error) });
      throw error;
    }
  }

  async logout(): Promise<void> {
    if (this.adminSession) {
      await fetch(`${BASE_URL}/api/logout`, {
        method: 'POST',
        headers: { 'Cookie': this.adminSession }
      });
    }
  }

  printResults(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📋 BACKUP & SECURITY ACCEPTANCE TEST RESULTS');
    console.log('='.repeat(60));
    
    let passed = 0;
    const total = this.testResults.length;
    
    this.testResults.forEach(result => {
      const status = result.status === 'PASSED' ? '✅ PASSED' : 
                    result.status === 'TIMEOUT' ? '⏱️ TIMEOUT' : '❌ FAILED';
      console.log(`${status} - ${result.test}`);
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }
      if (result.status === 'PASSED') passed++;
    });
    
    console.log('='.repeat(60));
    console.log(`📊 Results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 All tests passed! Backup & Security features are working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Please check the implementation.');
    }
  }

  async runAllTests(): Promise<void> {
    try {
      console.log('🚀 Starting Backup & Security Acceptance Tests (TypeScript)...');
      console.log(`🔗 Testing against: ${BASE_URL}`);
      
      await this.loginAsAdmin();
      await this.testBackupList();
      await this.testCreateBackup();
      await this.testBackupValidation();
      await this.testSecurityLogs();
      await this.testFailedLoginLogging();
      await this.testSecurityStats();
      await this.testNonAdminAccess();
      
      this.printResults();
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
      this.printResults();
      process.exit(1);
    } finally {
      await this.logout();
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const testRunner = new BackupSecurityTestRunner();
  testRunner.runAllTests().catch(console.error);
}

export default BackupSecurityTestRunner;