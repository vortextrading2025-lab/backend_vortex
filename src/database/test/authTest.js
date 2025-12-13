#!/usr/bin/env node

/**
 * Authentication Test Script
 * Tests login, logout, and refresh token flows including expired token handling
 * Usage: node src/database/test/authTest.js
 */

const database = require('../../config/database');
const logger = require('../../modules/logging/logger');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AuthService = require('../../modules/auth/authService');

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}${message ? ` - ${message}` : ''}`);
  testResults.tests.push({ name, passed, message });
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

async function testLogin() {
  try {
    const prisma = database.getClient();
    
    // Create or get test user
    let testUser = await prisma.user.findUnique({
      where: { email: 'authtest@example.com' }
    });

    if (!testUser) {
      const hashedPassword = await bcrypt.hash('testpassword123', 12);
      testUser = await prisma.user.create({
        data: {
          email: 'authtest@example.com',
          password: hashedPassword,
          firstName: 'Auth',
          lastName: 'Test',
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true
        }
      });
    }

    // Test login
    const credentials = {
      email: 'authtest@example.com',
      password: 'testpassword123'
    };

    const deviceInfo = {
      platform: 'test',
      browser: 'test'
    };

    const result = await AuthService.login(
      credentials,
      '127.0.0.1',
      'test-agent',
      deviceInfo
    );

    if (result.success && result.data.accessToken && result.data.refreshToken) {
      logTest('Login - Valid credentials', true);
      return {
        success: true,
        user: result.data.user,
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        sessionId: result.data.sessionId
      };
    } else {
      logTest('Login - Valid credentials', false, 'Missing tokens in response');
      return null;
    }
  } catch (error) {
    logTest('Login - Valid credentials', false, error.message);
    return null;
  }
}

async function testLoginInvalidPassword() {
  try {
    const credentials = {
      email: 'authtest@example.com',
      password: 'wrongpassword'
    };

    const deviceInfo = {
      platform: 'test',
      browser: 'test'
    };

    await AuthService.login(
      credentials,
      '127.0.0.1',
      'test-agent',
      deviceInfo
    );

    logTest('Login - Invalid password', false, 'Should have thrown error');
  } catch (error) {
    if (error.message.includes('Invalid credentials')) {
      logTest('Login - Invalid password', true);
    } else {
      logTest('Login - Invalid password', false, `Unexpected error: ${error.message}`);
    }
  }
}

async function testRefreshToken(accessToken, refreshToken, sessionId) {
  try {
    // Test refresh with valid token
    const result = await AuthService.refreshToken({ refreshToken });

    if (result.success && result.data.accessToken) {
      logTest('Refresh Token - Valid refresh token', true);
      
      // Verify new access token is different
      if (result.data.accessToken !== accessToken) {
        logTest('Refresh Token - New access token generated', true);
      } else {
        logTest('Refresh Token - New access token generated', false, 'Token should be different');
      }

      return result.data.accessToken;
    } else {
      logTest('Refresh Token - Valid refresh token', false, 'Missing access token in response');
      return null;
    }
  } catch (error) {
    logTest('Refresh Token - Valid refresh token', false, error.message);
    return null;
  }
}

async function testRefreshTokenExpired() {
  try {
    // Create an expired refresh token
    const expiredToken = jwt.sign(
      { userId: 'test', sessionId: 'test', type: 'refresh', exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_REFRESH_SECRET || 'refresh-secret'
    );

    await AuthService.refreshToken({ refreshToken: expiredToken });
    logTest('Refresh Token - Expired token', false, 'Should have thrown error');
  } catch (error) {
    if (error.message.includes('expired') || error.message.includes('Invalid')) {
      logTest('Refresh Token - Expired token', true);
    } else {
      logTest('Refresh Token - Expired token', false, `Unexpected error: ${error.message}`);
    }
  }
}

async function testRefreshTokenInvalid() {
  try {
    await AuthService.refreshToken({ refreshToken: 'invalid-token-string' });
    logTest('Refresh Token - Invalid token', false, 'Should have thrown error');
  } catch (error) {
    if (error.message.includes('Invalid') || error.message.includes('invalid')) {
      logTest('Refresh Token - Invalid token', true);
    } else {
      logTest('Refresh Token - Invalid token', false, `Unexpected error: ${error.message}`);
    }
  }
}

async function testLogout(userId, sessionId) {
  try {
    const result = await AuthService.logout(
      userId,
      sessionId,
      '127.0.0.1',
      'test-agent'
    );

    if (result.success) {
      logTest('Logout - Valid session', true);

      // Verify session is revoked
      const prisma = database.getClient();
      const session = await prisma.session.findUnique({
        where: { sessionId }
      });

      if (session && session.status === 'REVOKED') {
        logTest('Logout - Session revoked', true);
      } else {
        logTest('Logout - Session revoked', false, 'Session status not REVOKED');
      }

      // Verify refresh tokens are revoked
      const refreshTokens = await prisma.refreshToken.findMany({
        where: { userId, isRevoked: false }
      });

      if (refreshTokens.length === 0) {
        logTest('Logout - Refresh tokens revoked', true);
      } else {
        logTest('Logout - Refresh tokens revoked', false, `${refreshTokens.length} tokens still active`);
      }

      return true;
    } else {
      logTest('Logout - Valid session', false, 'Logout did not succeed');
      return false;
    }
  } catch (error) {
    logTest('Logout - Valid session', false, error.message);
    return false;
  }
}

async function testAccessTokenExpiration() {
  try {
    // Create a short-lived access token (1 second)
    const originalExpire = process.env.JWT_EXPIRE;
    process.env.JWT_EXPIRE = '1s';

    const prisma = database.getClient();
    const testUser = await prisma.user.findUnique({
      where: { email: 'authtest@example.com' }
    });

    if (!testUser) {
      logTest('Access Token - Expiration handling', false, 'Test user not found');
      return;
    }

    // Create a session
    const sessionId = require('uuid').v4();
    const { accessToken } = AuthService.generateTokens(testUser.id, sessionId, testUser.role);

    // Wait for token to expire
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Try to verify expired token
    try {
      jwt.verify(accessToken, process.env.JWT_SECRET);
      logTest('Access Token - Expiration handling', false, 'Token should be expired');
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        logTest('Access Token - Expiration handling', true);
      } else {
        logTest('Access Token - Expiration handling', false, `Unexpected error: ${error.name}`);
      }
    }

    // Restore original expire time
    if (originalExpire) {
      process.env.JWT_EXPIRE = originalExpire;
    } else {
      delete process.env.JWT_EXPIRE;
    }
  } catch (error) {
    logTest('Access Token - Expiration handling', false, error.message);
  }
}

async function runAllTests() {
  try {
    console.log('🧪 Starting Authentication Tests\n');
    console.log('═'.repeat(60));

    // Connect to database
    await database.connect();

    // Test 1: Login with valid credentials
    console.log('\n📝 Testing Login...');
    const loginResult = await testLogin();
    await testLoginInvalidPassword();

    if (!loginResult) {
      console.log('\n⚠️  Login failed, skipping dependent tests\n');
      printSummary();
      await database.disconnect();
      return;
    }

    // Test 2: Refresh token with valid token
    console.log('\n📝 Testing Refresh Token...');
    const newAccessToken = await testRefreshToken(
      loginResult.accessToken,
      loginResult.refreshToken,
      loginResult.sessionId
    );
    await testRefreshTokenExpired();
    await testRefreshTokenInvalid();

    // Test 3: Access token expiration
    console.log('\n📝 Testing Access Token Expiration...');
    await testAccessTokenExpiration();

    // Test 4: Logout
    console.log('\n📝 Testing Logout...');
    await testLogout(loginResult.user.id, loginResult.sessionId);

    // Print summary
    printSummary();

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    console.error(error.stack);
    testResults.failed++;
  } finally {
    await database.disconnect();
  }
}

function printSummary() {
  console.log('\n' + '═'.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📝 Total:  ${testResults.passed + testResults.failed}`);
  console.log('═'.repeat(60));

  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests
      .filter(t => !t.passed)
      .forEach(t => console.log(`   - ${t.name}: ${t.message || 'No details'}`));
  }

  if (testResults.failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log(`\n⚠️  ${testResults.failed} test(s) failed`);
  }
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests };

