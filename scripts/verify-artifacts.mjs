import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const packageRoot = process.cwd();
const packageJsonPath = resolve(packageRoot, 'package.json');
const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));

function collectExportTargets(exportsField) {
  const targets = new Set();

  for (const value of Object.values(exportsField)) {
    if (typeof value === 'string') {
      targets.add(value);
      continue;
    }

    if (!value || typeof value !== 'object') continue;

    for (const target of Object.values(value)) {
      if (typeof target === 'string') {
        targets.add(target);
      }
    }
  }

  return [...targets];
}

const requiredFiles = [
  ...collectExportTargets(packageJson.exports),
  './dist/nextjs/createTcmOAuthExchangeRoute.d.ts',
  './dist/nextjs/createTcmLogoutRoute.d.ts',
];

const missing = [];
for (const file of requiredFiles) {
  const fullPath = resolve(packageRoot, file);
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

const nextjsDtsPath = resolve(packageRoot, 'dist/nextjs.d.ts');
const nextjsDts = await readFile(nextjsDtsPath, 'utf8');
const requiredNextjsExports = [
  'createTcmOAuthExchangeRoute',
  'createTcmLogoutRoute',
  'CreateTcmOAuthExchangeRouteOptions',
  'CreateTcmLogoutRouteOptions',
];

const missingExports = requiredNextjsExports.filter((entry) => !nextjsDts.includes(entry));
if (missingExports.length > 0) {
  console.error('dist/nextjs.d.ts is missing expected exports:');
  missingExports.forEach((entry) => console.error(`- ${entry}`));
  process.exit(1);
}

const tempDir = await mkdtemp(resolve(tmpdir(), 'oauth-react-verify-'));
const scopedPackageDir = resolve(tempDir, 'node_modules', '@crimsoncorp');
const linkedPackageDir = resolve(scopedPackageDir, 'oauth-react');
const testFilePath = resolve(tempDir, 'verify-package-exports.ts');
const tsconfigPath = resolve(tempDir, 'tsconfig.json');

await mkdir(scopedPackageDir, { recursive: true });
await symlink(packageRoot, linkedPackageDir, process.platform === 'win32' ? 'junction' : 'dir');

await writeFile(
  testFilePath,
  `import { resetTcmOAuthBrowserState } from '@crimsoncorp/oauth-react';
import { createTcmOAuthClient } from '@crimsoncorp/oauth-react/client';
import {
  handleOAuthCallback,
  postPopupCallbackResult,
  type PostPopupCallbackResultOptions,
} from '@crimsoncorp/oauth-react/client/callback';
import {
  createTcmLogoutRoute,
  createTcmOAuthExchangeRoute,
  type CreateTcmLogoutRouteOptions,
  type CreateTcmOAuthExchangeRouteOptions,
} from '@crimsoncorp/oauth-react/nextjs';
import {
  createTcmCookieSessionAdapter,
  type TcmOAuthServerOptions,
} from '@crimsoncorp/oauth-react/server';

type RootExport = typeof resetTcmOAuthBrowserState;
type ClientExport = typeof createTcmOAuthClient;
type CallbackExport = typeof handleOAuthCallback;
type CallbackOptions = PostPopupCallbackResultOptions;
type NextjsExchangeOptions = CreateTcmOAuthExchangeRouteOptions<unknown, unknown>;
type NextjsLogoutOptions = CreateTcmLogoutRouteOptions<Record<string, unknown>>;
type NextjsLogoutFactory = typeof createTcmLogoutRoute;
type NextjsExchangeFactory = typeof createTcmOAuthExchangeRoute;
type ServerFactory = typeof createTcmCookieSessionAdapter;
type ServerOptions = TcmOAuthServerOptions;

void (0 as unknown as RootExport);
void (0 as unknown as ClientExport);
void (0 as unknown as CallbackExport);
void (0 as unknown as CallbackOptions);
void (0 as unknown as NextjsExchangeOptions);
void (0 as unknown as NextjsLogoutOptions);
void (0 as unknown as NextjsLogoutFactory);
void (0 as unknown as NextjsExchangeFactory);
void (0 as unknown as ServerFactory);
void (0 as unknown as ServerOptions);
void postPopupCallbackResult;
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

const tscBin = resolve(packageRoot, 'node_modules', 'typescript', 'bin', 'tsc');

try {
  await execFileAsync(process.execPath, [tscBin, '-p', tsconfigPath], {
    cwd: tempDir,
  });
} catch (error) {
  console.error('Packaged export type smoke test failed.');
  if (error.stdout) process.stderr.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  process.exit(1);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log('Artifact verification passed.');
