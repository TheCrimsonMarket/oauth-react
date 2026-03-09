import type { TcmProvider } from '../types';

const TXN_STORAGE_KEY = 'tcm_oauth_popup_txn_v1';

export interface TcmPopupTransaction {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  provider: TcmProvider;
  createdAt: number;
  expiresAt: number;
  tcmWebUrl: string;
}

export function saveTransaction(txn: TcmPopupTransaction): void {
  sessionStorage.setItem(TXN_STORAGE_KEY, JSON.stringify(txn));
}

export function readTransaction(): TcmPopupTransaction | null {
  const raw = sessionStorage.getItem(TXN_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as TcmPopupTransaction;
  } catch {
    return null;
  }
}

export function clearTransaction(): void {
  sessionStorage.removeItem(TXN_STORAGE_KEY);
}

export function consumeTransaction(): TcmPopupTransaction | null {
  const txn = readTransaction();
  clearTransaction();
  return txn;
}
