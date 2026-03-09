import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const requiredFiles = [
  'dist/index.js',
  'dist/index.cjs',
  'dist/index.d.ts',
  'dist/client.js',
  'dist/client.cjs',
  'dist/client.d.ts',
  'dist/callback.js',
  'dist/callback.cjs',
  'dist/callback.d.ts',
  'dist/server.js',
  'dist/server.cjs',
  'dist/server.d.ts',
  'dist/styles.css',
];

const missing = [];
for (const file of requiredFiles) {
  const fullPath = resolve(process.cwd(), file);
  try {
    await access(fullPath);
  } catch {
    missing.push(file);
  }
}

if (missing.length > 0) {
  console.error('Missing build artifacts:');
  missing.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

console.log('Artifact verification passed.');
