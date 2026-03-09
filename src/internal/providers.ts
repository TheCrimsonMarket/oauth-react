import type { TcmProvider } from '../types';

export const SUPPORTED_PROVIDERS: TcmProvider[] = [
  'google',
  'steam',
  'battlenet',
  'discord',
  'twitch',
  'credentials',
];

export function isSupportedProvider(provider: string): provider is TcmProvider {
  return SUPPORTED_PROVIDERS.includes(provider as TcmProvider);
}
