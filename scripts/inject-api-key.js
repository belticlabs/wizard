#!/usr/bin/env node
/**
 * Build-time script to inject Anthropic API key into compiled bundle
 * This allows the key to be compiled into the bundle without appearing in source code
 * 
 * Usage: node scripts/inject-api-key.js <dist-dir> <api-key>
 */

const fs = require('fs');
const path = require('path');

const distDir = process.argv[2] || 'dist';
const apiKey = process.argv[3] || process.env.ANTHROPIC_API_KEY || '';

if (!apiKey) {
  console.warn('⚠️  No API key provided. Wizard will require users to provide their own key.');
  process.exit(0);
}

if (!fs.existsSync(distDir)) {
  console.error(`❌ Dist directory not found: ${distDir}`);
  process.exit(1);
}

// Pattern to find and replace: process.env.ANTHROPIC_API_KEY || ''
// TypeScript compiles this to: process.env.ANTHROPIC_API_KEY || ""
const placeholderPattern = /(process\.env\.ANTHROPIC_API_KEY\s*\|\|\s*)(['"]{2})/g;
const replacement = `$1'${apiKey}'`;

let filesModified = 0;

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  if (placeholderPattern.test(content)) {
    const modified = content.replace(placeholderPattern, replacement);
    fs.writeFileSync(filePath, modified, 'utf8');
    filesModified++;
    return true;
  }
  return false;
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.js') && !file.endsWith('.map')) {
      processFile(filePath);
    }
  }
}

walkDir(distDir);

if (filesModified > 0) {
  console.log(`✅ Injected API key into ${filesModified} file(s)`);
} else {
  console.warn('⚠️  No files modified. Pattern not found in compiled code.');
}

