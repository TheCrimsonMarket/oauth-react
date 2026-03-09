import type { ButtonHTMLAttributes } from 'react';
import type { TcmProvider } from '../types';

interface TcmOAuthButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  provider: TcmProvider;
  loading?: boolean;
  onClick: (provider: TcmProvider) => void;
}

const LABELS: Record<TcmProvider, string> = {
  google: 'Continue with Google',
  steam: 'Continue with Steam',
  battlenet: 'Continue with Battle.net',
  discord: 'Continue with Discord',
  twitch: 'Continue with Twitch',
  credentials: 'Continue with Email',
};

export function TcmOAuthButton({ provider, loading = false, disabled, onClick, ...rest }: TcmOAuthButtonProps) {
  return (
    <button
      {...rest}
      type="button"
      className="tcm-oauth-btn"
      disabled={disabled || loading}
      onClick={() => onClick(provider)}
      data-provider={provider}
    >
      {loading ? 'Connecting...' : LABELS[provider]}
    </button>
  );
}
