import { useEffect, useState } from 'react';
import { fetchTcmOAuthClientPolicy } from '../client/policy';
import type { TcmOAuthClientPolicy } from '../types';

export interface UseTcmOAuthClientPolicyOptions {
  clientId: string;
  tcmWebUrl: string;
  fetch?: typeof fetch;
}

export interface UseTcmOAuthClientPolicyResult {
  loading: boolean;
  policy: TcmOAuthClientPolicy | null;
  error: Error | null;
}

export function useTcmOAuthClientPolicy(
  options: UseTcmOAuthClientPolicyOptions,
): UseTcmOAuthClientPolicyResult {
  const [state, setState] = useState<UseTcmOAuthClientPolicyResult>({
    loading: true,
    policy: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    if (!options.clientId || !options.tcmWebUrl) {
      setState({
        loading: false,
        policy: null,
        error: null,
      });
      return;
    }

    setState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    void fetchTcmOAuthClientPolicy({
      clientId: options.clientId,
      tcmWebUrl: options.tcmWebUrl,
      fetchImpl: options.fetch,
    })
      .then((policy) => {
        if (cancelled) return;
        setState({
          loading: false,
          policy,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          loading: false,
          policy: null,
          error: error instanceof Error ? error : new Error('Failed to load OAuth client policy.'),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [options.clientId, options.fetch, options.tcmWebUrl]);

  return state;
}
