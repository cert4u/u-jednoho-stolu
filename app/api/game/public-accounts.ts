import { env } from 'cloudflare:workers';

export function publicAccounts() {
  return (
    (env as unknown as { STUL_PUBLIC_ACCOUNTS?: boolean })
      .STUL_PUBLIC_ACCOUNTS === true
  );
}

export function pjAccount(request: Request) {
  return publicAccounts()
    ? request.headers.get('x-stul-pj-account') || undefined
    : undefined;
}
