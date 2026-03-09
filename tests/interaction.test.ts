import { describe, expect, it, vi } from 'vitest';
import { resolveInteractionMode } from '../src/internal/interaction';

describe('resolveInteractionMode', () => {
  it('returns explicit popup and redirect modes unchanged', () => {
    expect(resolveInteractionMode('popup')).toBe('popup');
    expect(resolveInteractionMode('redirect')).toBe('redirect');
  });

  it('prefers redirect for mobile-like environments in auto mode', () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      },
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        innerWidth: 390,
        matchMedia: vi.fn(() => ({ matches: true })),
      },
    });

    expect(resolveInteractionMode('auto')).toBe('redirect');
  });

  it('prefers popup for desktop-like environments in auto mode', () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        innerWidth: 1440,
        matchMedia: vi.fn(() => ({ matches: false })),
      },
    });

    expect(resolveInteractionMode('auto')).toBe('popup');
  });
});
