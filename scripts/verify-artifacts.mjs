import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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
  'dist/nextjs.js',
  'dist/nextjs.cjs',
  'dist/nextjs.d.ts',
  'dist/nextjs/createTcmOAuthExchangeRoute.d.ts',
  'dist/nextjs/createTcmLogoutRoute.d.ts',
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

const nextjsDtsPath = resolve(process.cwd(), 'dist/nextjs.d.ts');
const nextjsDts = await readFile(nextjsDtsPath, 'utf8');
const requiredExports = [
  'createTcmOAuthExchangeRoute',
  'createTcmLogoutRoute',
  'CreateTcmOAuthExchangeRouteOptions',
  'CreateTcmLogoutRouteOptions',
];

const missingExports = requiredExports.filter((entry) => !nextjsDts.includes(entry));
if (missingExports.length > 0) {
  console.error('dist/nextjs.d.ts is missing expected exports:');
  missingExports.forEach((entry) => console.error(`- ${entry}`));
  process.exit(1);
}

const tempDir = await mkdtemp(resolve('/tmp', 'oauth-react-verify-'));
const relativeNextjsImport = relative(tempDir, resolve(process.cwd(), 'dist/nextjs.js')).replace(/\\/g, '/');
const testFilePath = resolve(tempDir, 'verify-nextjs-exports.ts');
const tsconfigPath = resolve(tempDir, 'tsconfig.json');

await writeFile(
  testFilePath,
  `import {
  createTcmLogoutRoute,
  createTcmOAuthExchangeRoute,
  type CreateTcmLogoutRouteOptions,
  type CreateTcmOAuthExchangeRouteOptions,
} from '${relativeNextjsImport.startsWith('.') ? relativeNextjsImport : `./${relativeNextjsImport}`}';

type LogoutOptions = CreateTcmLogoutRouteOptions<Record<string, unknown>>;
type ExchangeOptions = CreateTcmOAuthExchangeRouteOptions<unknown, unknown>;
type LogoutFactory = typeof createTcmLogoutRoute;
type ExchangeFactory = typeof createTcmOAuthExchangeRoute;

void (0 as unknown as LogoutOptions);
void (0 as unknown as ExchangeOptions);
void (0 as unknown as LogoutFactory);
void (0 as unknown as ExchangeFactory);
`,
  'utf8',
);

await writeFile(
  tsconfigPath,
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        noEmit: true,
        strict: true,
        skipLibCheck: true,
      },
      include: [testFilePath],
    },
    null,
    2,
  ),
  'utf8',
);

const tscBin = resolve(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
);

try {
  await execFileAsync(tscBin, ['-p', tsconfigPath], {
    cwd: process.cwd(),
  });
} catch (error) {
  console.error('Packaged nextjs type smoke test failed.');
  if (error.stdout) process.stderr.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  process.exit(1);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log('Artifact verification passed.');
