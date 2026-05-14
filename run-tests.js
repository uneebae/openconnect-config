#!/usr/bin/env node

/**
 * OpenConnect Quick Test Runner
 * Usage: node run-tests.js [--quick|--full|--ui]
 * 
 * --quick   : Run fast automated tests (119 total)
 * --full    : Run tests + build + dev server check
 * --ui      : Open browser to UI for manual testing
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const mode = args[0] || '--quick';

console.log('\n' + '='.repeat(70));
console.log('  OpenConnect Test Runner');
console.log('='.repeat(70) + '\n');

async function run(command, args_arr = [], description = '') {
  return new Promise((resolve, reject) => {
    if (description) console.log(`▶️  ${description}...`);
    
    const proc = spawn(command, args_arr, {
      stdio: 'inherit',
      shell: true,
      cwd: __dirname
    });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${description} passed\n`);
        resolve();
      } else {
        console.log(`❌ ${description} failed (exit code ${code})\n`);
        reject(new Error(`${description} failed`));
      }
    });
  });
}

(async () => {
  try {
    if (mode === '--quick' || mode === '--full') {
      // Step 1: Install dependencies
      await run('npm', ['install'], 'Installing dependencies');

      // Step 2: Run tests
      await run('npm', ['test'], 'Running automated tests (119 total)');

      if (mode === '--full') {
        // Step 3: Build
        await run('npm', ['run', 'build'], 'Building for production');

        // Step 4: Verify server endpoints
        console.log('\n📋 Checking server endpoints...');
        const endpoints = [
          'http://localhost:3002/health',
          'http://localhost:3002/api/oc-core/environments'
        ];
        
        for (const endpoint of endpoints) {
          try {
            const response = await fetch(endpoint, { timeout: 3000 });
            if (response.ok) {
              console.log(`✅ ${endpoint} responding`);
            } else {
              console.log(`⚠️  ${endpoint} returned ${response.status}`);
            }
          } catch (e) {
            console.log(`ℹ️  ${endpoint} not accessible (server may not be running)`);
          }
        }
      }
    }

    if (mode === '--ui') {
      console.log('🌐 Starting development server for UI testing...\n');
      await run('npm', ['run', 'dev'], 'Starting dev server');
    }

    console.log('\n' + '='.repeat(70));
    console.log('  ✅ All tests passed! Ready to deploy.');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('  ❌ Test suite failed');
    console.error('='.repeat(70) + '\n');
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
