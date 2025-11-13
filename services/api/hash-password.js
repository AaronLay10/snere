#!/usr/bin/env node
/**
 * Utility script to hash a password using bcrypt
 * Usage: node hash-password.js <password>
 */

const bcrypt = require('bcrypt');

const password = process.argv[2] || 'changeme123!';

bcrypt.hash(password, 10).then(hash => {
  console.log(hash);
  process.exit(0);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
