import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const distDir = resolve(process.cwd(), 'dist');

const outputs = [
  {
    file: 'client.d.ts',
    content: `export * from './client/index';
`,
  },
  {
    file: 'callback.d.ts',
    content: `export * from './client-callback';
`,
  },
  {
    file: 'nextjs.d.ts',
    content: `export * from './nextjs';
`,
  },
];

await Promise.all(
  outputs.map(({ file, content }) => writeFile(resolve(distDir, file), content, 'utf8')),
);

console.log('Declaration entry files ensured: dist/client.d.ts, dist/callback.d.ts, dist/nextjs.d.ts');
