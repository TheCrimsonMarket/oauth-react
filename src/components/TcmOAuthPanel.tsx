import { TcmOAuthButton } from './TcmOAuthButton';
import type { TcmProvider } from '../types';

interface TcmOAuthPanelProps {
  providers?: TcmProvider[];
  loading?: boolean;
  onProviderClick: (provider: TcmProvider) => void;
}

const DEFAULT_PROVIDERS: TcmProvider[] = ['google', 'steam', 'battlenet', 'discord', 'twitch', 'credentials'];

export function TcmOAuthPanel({ providers = DEFAULT_PROVIDERS, loading = false, onProviderClick }: TcmOAuthPanelProps) {
  return (
    <div className="tcm-oauth-panel">
      {providers.map((provider) => (
        <TcmOAuthButton
          key={provider}
          provider={provider}
          loading={loading}
          onClick={onProviderClick}
        />
      ))}
    </div>
  );
}
