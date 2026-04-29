import { TcmOAuthButton } from './TcmOAuthButton';
import type { TcmProvider } from '../types';

interface TcmOAuthPanelProps {
  providers?: TcmProvider[];
  googleOnly?: boolean;
  loading?: boolean;
  onProviderClick: (provider: TcmProvider) => void;
}

const DEFAULT_PROVIDERS: TcmProvider[] = ['google', 'steam', 'battlenet', 'discord', 'twitch', 'credentials'];

export function TcmOAuthPanel({
  providers = DEFAULT_PROVIDERS,
  googleOnly = false,
  loading = false,
  onProviderClick,
}: TcmOAuthPanelProps) {
  const resolvedProviders: TcmProvider[] = googleOnly ? ['google'] : providers;

  return (
    <div className="tcm-oauth-panel">
      {resolvedProviders.map((provider) => (
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
