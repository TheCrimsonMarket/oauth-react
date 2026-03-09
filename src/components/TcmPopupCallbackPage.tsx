import { useEffect } from 'react';
import { postPopupCallbackResult } from '../client/callback';

export function TcmPopupCallbackPage() {
  useEffect(() => {
    postPopupCallbackResult();
  }, []);

  return (
    <main className="tcm-oauth-callback">
      <h1>Authentication complete</h1>
      <p>This popup can be closed now.</p>
      <p>If it does not close automatically, close it manually and return to the previous tab.</p>
    </main>
  );
}
