import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';

describe('package exports contract', () => {
  it('includes root, client, callback, server, nextjs, and styles exports with expected targets', () => {
    expect(packageJson.exports).toBeTruthy();

    const rootExport = (packageJson.exports as Record<string, unknown>)['.'] as Record<string, string>;
    const clientExport = (packageJson.exports as Record<string, unknown>)['./client'] as Record<string, string>;
    const callbackExport = (packageJson.exports as Record<string, unknown>)['./client/callback'] as Record<string, string>;
    const serverExport = (packageJson.exports as Record<string, unknown>)['./server'] as Record<string, string>;
    const nextjsExport = (packageJson.exports as Record<string, unknown>)['./nextjs'] as Record<string, string>;
    const stylesExport = (packageJson.exports as Record<string, unknown>)['./styles.css'];

    expect(rootExport.import).toBe('./dist/index.js');
    expect(rootExport.require).toBe('./dist/index.cjs');
    expect(rootExport.types).toBe('./dist/index.d.ts');

    expect(clientExport.import).toBe('./dist/client/index.js');
    expect(clientExport.require).toBe('./dist/client/index.cjs');
    expect(clientExport.types).toBe('./dist/client/index.d.ts');

    expect(callbackExport.import).toBe('./dist/client/callback.js');
    expect(callbackExport.require).toBe('./dist/client/callback.cjs');
    expect(callbackExport.types).toBe('./dist/client/callback.d.ts');

    expect(serverExport.import).toBe('./dist/server.js');
    expect(serverExport.require).toBe('./dist/server.cjs');
    expect(serverExport.types).toBe('./dist/server.d.ts');

    expect(nextjsExport.import).toBe('./dist/nextjs.js');
    expect(nextjsExport.require).toBe('./dist/nextjs.cjs');
    expect(nextjsExport.types).toBe('./dist/nextjs.d.ts');

    expect(stylesExport).toBe('./dist/styles.css');
  });
});
