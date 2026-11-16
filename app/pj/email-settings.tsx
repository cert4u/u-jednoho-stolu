'use client';

import { useState } from 'react';

export type EmailChange = {
  mode: 'self' | 'recovery';
  email?: string;
  expiresAt: number;
  oldConfirmed: boolean;
  newConfirmed: boolean;
};

type Props = {
  email: string;
  pending?: EmailChange | null;
  busy: boolean;
  onStart: (email: string) => Promise<boolean>;
  onCancel: () => void;
};

export default function EmailSettings({
  email,
  pending,
  busy,
  onStart,
  onCancel,
}: Props) {
  const [target, setTarget] = useState('');
  return (
    <details className="pj-invite-settings">
      <summary>Přihlašovací e-mail</summary>
      <p>{email}</p>
      {pending?.mode === 'self' ? (
        <>
          <p>
            Nová adresa <strong>{pending.email}</strong>
          </p>
          <ul>
            <li>
              {pending.oldConfirmed
                ? 'Původní schránka potvrzená'
                : 'Čeká se na potvrzení v původní schránce'}
            </li>
            <li>
              {pending.newConfirmed
                ? 'Nová schránka potvrzená'
                : 'Čeká se na potvrzení v nové schránce'}
            </li>
          </ul>
          <p>
            Odkazy platí do{' '}
            {new Date(pending.expiresAt).toLocaleTimeString('cs', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            .
          </p>
          <button className="secondary" disabled={busy} onClick={onCancel}>
            Zrušit změnu e-mailu
          </button>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onStart(target).then((sent) => {
              if (sent) setTarget('');
            });
          }}
        >
          <label>
            Nová e-mailová adresa
            <input
              type="email"
              value={target}
              maxLength={254}
              required
              onChange={(event) => setTarget(event.target.value)}
            />
          </label>
          <p>
            Změnu potvrdíš z původní i nové schránky. Pokud už původní schránku
            nemáš, požádej správce instance o obnovu přístupu.
          </p>
          <button className="secondary" disabled={busy}>
            Odeslat ověřovací odkazy
          </button>
        </form>
      )}
    </details>
  );
}
