import { useEffect } from 'react';
import { handleOAuthCallback } from '../client/callback';

export function TcmOAuthCallbackPage() {
  useEffect(() => {
    handleOAuthCallback();
  }, []);

  return (
    <main className="tcm-oauth-callback">
      <h1>Authentication complete</h1>
      <p>Completing sign-in and returning you to the app.</p>
      <p>If nothing happens, return to the previous page and try again.</p>
    </main>
  );
}
