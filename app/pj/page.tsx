'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { downloadText, RestoreForms } from '../../components/campaign-access';
import {
  sendGameAction,
  sessionStorageKey,
} from '../../components/game-table/game-client';
import type { Session } from '../../components/game-table/types';
import {
  gameInvitationUrl,
  type InvitationSettings,
} from '../../lib/game-invitation';
import EmailSettings, { type EmailChange } from './email-settings';
import type { AdventureSummary } from '../../lib/adventure-templates';

type Profile = {
  user: {
    id: string;
    name: string;
    email: string;
    status: 'requested' | 'approved';
  } | null;
  cleanup?: boolean;
  emailChange?: EmailChange | null;
  quota?: {
    tables: number;
    bytes: number;
    tableLimit: number | null;
    byteLimit: number | null;
  } | null;
  rooms: {
    id: string;
    title: string;
    archiveAt: number | null;
    deleteAt: number | null;
    archivedAt: number | null;
    invitesPaused: number;
    completedOn: string | null;
    lastActivityAt: number;
  }[];
};
const date = (time: number) => new Date(time).toLocaleDateString('cs');

const quotaNumber = new Intl.NumberFormat('cs', { maximumFractionDigits: 1 });
const quotaSize = (bytes: number) =>
  bytes < 1024
    ? quotaNumber.format(bytes) + ' B'
    : bytes >= 1024 ** 2
      ? quotaNumber.format(bytes / 1024 ** 2) + ' MiB'
      : quotaNumber.format(bytes / 1024) + ' KiB';

const completionDate = new Intl.DateTimeFormat('cs', { timeZone: 'UTC' });

async function api<T>(
  path: string,
  data?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(
    '/pj/api/' + path,
    data
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      : { cache: 'no-store' },
  );
  const result = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(result.error || 'Požadavek se nepodařil.');
  return result as T;
}

export default function PjPage() {
  const router = useRouter();
  function enter(session: Session) {
    localStorage.setItem(sessionStorageKey, JSON.stringify(session));
    router.push('/');
  }
  const [profile, setProfile] = useState<Profile>();
  const [adventures, setAdventures] = useState<AdventureSummary[]>([]);
  const [secret, setSecret] = useState<{
    type: 'login' | 'email';
    value: string;
  }>();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [adventureId, setAdventureId] = useState('');
  const [selection, setSelection] = useState<{
    id: string;
    action: 'archive' | 'delete';
  }>();
  const [manualInvite, setManualInvite] = useState<{
    room: string;
    url: string;
  }>();
  const [confirmation, setConfirmation] = useState('');
  const [current, setCurrent] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const owner = profile?.user;

  useEffect(() => {
    let active = true;
    function readLink() {
      const hashes = new URLSearchParams(location.hash.slice(1));
      const login = hashes.get('prihlaseni');
      const change = hashes.get('zmena-emailu');
      if (change || login) {
        history.replaceState(null, '', location.pathname);
        if (change) setSecret({ type: 'email', value: change });
        else if (login) setSecret({ type: 'login', value: login });
        setError('');
      }
    }
    window.addEventListener('hashchange', readLink);
    void Promise.resolve().then(() => {
      if (!active) return;
      readLink();
      try {
        const stored = localStorage.getItem(sessionStorageKey);
        if (stored) setCurrent(JSON.parse(stored));
      } catch {
        // The directory stays available when there is no readable saved game session.
      }
    });
    void api<Profile>('profile')
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });
    return () => {
      active = false;
      window.removeEventListener('hashchange', readLink);
    };
  }, []);

  useEffect(() => {
    if (owner?.status !== 'approved') return;
    const controller = new AbortController();
    void fetch('/api/adventures', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : []))
      .then((entries) => {
        if (Array.isArray(entries)) setAdventures(entries);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [owner?.status]);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await task();
      return true;
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Požadavek se nepodařil.',
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setProfile(await api<Profile>('profile'));
  }

  async function create(action: string, values: Record<string, unknown>) {
    return run(async () => {
      const { room, token } = await sendGameAction(
        null,
        undefined,
        action,
        values,
      );
      if (!token) throw new Error('Přístup ke stolu se nepodařilo vytvořit.');
      enter({ room, token });
    });
  }

  async function backup(room: string) {
    const session = await api<Session>('backup', { room });
    const response = await fetch(
      '/api/game?' + new URLSearchParams({ room, download: 'backup' }),
      { headers: { Authorization: 'Bearer ' + session.token } },
    );
    if (!response.ok) throw new Error('Zálohu se nepodařilo stáhnout.');
    downloadText(
      'kampan-' + room + '.json',
      await response.text(),
      'application/json',
    );
  }

  return (
    <main className="lobby pj-directory">
      <nav className="lobby-nav">
        <Link className="brand" href="/">
          U jednoho stolu
        </Link>
        <Link href="/">Zpět do herny</Link>
      </nav>
      <section className="join-card pj-directory-card">
        <h1>
          {owner?.status === 'approved' ? 'Moje stoly' : 'Účet Pána jeskyně'}
        </h1>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {status && <p role="status">{status}</p>}
        {!profile && !error && <p>Načítám účet…</p>}
        {secret ? (
          <>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (secret.type === 'email') {
                    const result = await api<{ completed: boolean }>(
                      'confirm-email-change',
                      { secret: secret.value },
                    );
                    setStatus(
                      result.completed
                        ? 'E-mail je změněný. Přihlas se novou adresou.'
                        : 'Schránka je potvrzená. Změna se dokončí po potvrzení obou adres.',
                    );
                  } else {
                    await api('confirm', { secret: secret.value });
                  }
                  setSecret(undefined);
                  await refresh();
                })
              }
            >
              {secret.type === 'email'
                ? 'Potvrdit změnu e-mailu'
                : 'Potvrdit přihlášení z e-mailu'}
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setSecret(undefined);
                setError('');
              }}
            >
              Zpět k účtu
            </button>
          </>
        ) : profile && !owner ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await api(register ? 'request' : 'login', {
                  email,
                  name,
                  note,
                });
                setStatus(
                  'Pokud lze odkaz odeslat, najdeš ho ve své poště. Odkaz platí 15 minut.',
                );
              });
            }}
          >
            {register && (
              <label>
                Jméno PJ
                <input
                  value={name}
                  maxLength={60}
                  required
                  autoComplete="name"
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            )}
            <label>
              E-mail
              <input
                type="email"
                value={email}
                required
                maxLength={254}
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            {register && (
              <label>
                Poznámka pro správce (volitelně)
                <textarea
                  value={note}
                  maxLength={300}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
            )}
            <button className="primary" disabled={busy}>
              {register ? 'Odeslat žádost' : 'Poslat přihlašovací odkaz'}
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => setRegister(!register)}
            >
              {register ? 'Už mám účet nebo pozvánku' : 'Požádat o účet PJ'}
            </button>
          </form>
        ) : owner?.status === 'requested' ? (
          <div>
            <h2>Čeká na schválení</h2>
            <p>
              E-mail {owner.email} je ověřený. Jakmile správce žádost schválí,
              můžeš zakládat a spravovat stoly.
            </p>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void run(refresh)}
            >
              Zkontrolovat stav
            </button>
          </div>
        ) : owner?.status === 'approved' && profile ? (
          <>
            <p>{owner.name || owner.email}</p>
            {profile.quota && (
              <p className="pj-quota">
                <span>
                  Stoly{' '}
                  <strong>
                    {profile.quota.tables}
                    {profile.quota.tableLimit !== null &&
                      ' / ' + profile.quota.tableLimit}
                  </strong>
                </span>
                <span>
                  Data kampaní{' '}
                  <strong>
                    {quotaSize(profile.quota.bytes)}
                    {profile.quota.byteLimit !== null &&
                      ' / ' + quotaSize(profile.quota.byteLimit)}
                  </strong>
                </span>
                <small>Včetně archivu</small>
              </p>
            )}
            <EmailSettings
              email={owner.email}
              pending={profile.emailChange}
              busy={busy}
              onStart={(email) =>
                run(async () => {
                  await api('request-email-change', { email });
                  await refresh();
                  setStatus('Ověřovací odkazy byly odeslané na obě adresy.');
                })
              }
              onCancel={() =>
                void run(async () => {
                  await api('cancel-email-change', {});
                  await refresh();
                  setStatus('Změna e-mailu byla zrušena.');
                })
              }
            />
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void create('create', {
                  name: name.trim() || owner.name || 'Pán jeskyně',
                  ...(adventureId && { adventureId }),
                });
              }}
            >
              <label>
                Jméno PJ u stolu
                <input
                  value={name}
                  maxLength={30}
                  placeholder={owner.name || 'Pán jeskyně'}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              {adventures.length > 0 && (
                <label>
                  Předloha dobrodružství
                  <select
                    value={adventureId}
                    onChange={(event) => setAdventureId(event.target.value)}
                  >
                    <option value="">Vlastní dobrodružství</option>
                    {adventures.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button className="primary" disabled={busy}>
                Založit stůl
              </button>
            </form>
            <RestoreForms busy={busy} onAction={create} showRecovery={false} />
            {current &&
              !profile.rooms.some((room) => room.id === current.room) && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api('claim', current);
                      await refresh();
                      setStatus('Otevřený stůl je přiřazený k účtu.');
                    })
                  }
                >
                  Přiřadit otevřený stůl k účtu
                </button>
              )}
            {!profile.rooms.length && <p>Zatím nemáš žádný stůl.</p>}
            <ul className="pj-room-list">
              {profile.rooms.map((room) => (
                <li key={room.id}>
                  <h2>{room.title || room.id}</h2>
                  {room.completedOn && (
                    <p className="pj-completed-label">
                      Dohráno{' '}
                      {completionDate.format(
                        new Date(room.completedOn + 'T00:00:00Z'),
                      )}
                    </p>
                  )}
                  <p>
                    <small>
                      {room.id} ·{' '}
                      {room.deleteAt
                        ? 'V archivu od ' +
                          date(room.archivedAt!) +
                          (profile.cleanup
                            ? ' · smazání ' + date(room.deleteAt)
                            : '')
                        : 'Poslední aktivita ' + date(room.lastActivityAt)}
                    </small>
                  </p>
                  <div className="pj-room-actions">
                    {!room.archivedAt && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(async () =>
                              enter(
                                await api<Session>('open', { room: room.id }),
                              ),
                            )
                          }
                        >
                          Otevřít
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await api('keep', { room: room.id });
                              await refresh();
                            })
                          }
                        >
                          Ponechat stůl
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => {
                            setSelection({ id: room.id, action: 'archive' });
                            setConfirmation('');
                          }}
                        >
                          Archivovat
                        </button>
                      </>
                    )}
                    {room.archivedAt && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await api('restore', { room: room.id });
                            await refresh();
                          })
                        }
                      >
                        Obnovit z archivu
                      </button>
                    )}
                    {room.archivedAt && (
                      <button
                        disabled={busy}
                        onClick={() => {
                          setSelection({ id: room.id, action: 'delete' });
                          setConfirmation('');
                        }}
                      >
                        Trvale smazat
                      </button>
                    )}

                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const completed = !room.completedOn;
                          await api('completion', { room: room.id, completed });
                          await refresh();
                          setStatus(
                            completed
                              ? 'Kampaň je označená za dohranou.'
                              : 'Označení dohrání je zrušené.',
                          );
                        })
                      }
                    >
                      {room.completedOn
                        ? 'Zrušit označení dohrání'
                        : 'Označit za dohranou'}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void run(() => backup(room.id))}
                    >
                      Stáhnout zálohu
                    </button>
                  </div>
                  {!room.archivedAt && (
                    <details className="pj-invite-settings">
                      <summary>Pozvánka pro hráče</summary>
                      <p>
                        {room.invitesPaused
                          ? 'Vstup nových hráčů je pozastavený.'
                          : 'Noví hráči se mohou připojit přes pozvánku.'}
                      </p>
                      <div className="pj-room-actions">
                        <button
                          disabled={busy || Boolean(room.invitesPaused)}
                          onClick={() =>
                            void run(async () => {
                              const invite = await api<InvitationSettings>(
                                'invite',
                                { room: room.id, operation: 'read' },
                              );
                              if (invite.paused)
                                throw new Error(
                                  'Vstup nových hráčů je pozastavený.',
                                );
                              const url = gameInvitationUrl(
                                location.origin,
                                room.id,
                                invite.token,
                              );
                              try {
                                await navigator.clipboard.writeText(url);
                                setManualInvite(undefined);
                                setStatus('Pozvánka je ve schránce.');
                              } catch {
                                setManualInvite({ room: room.id, url });
                                setStatus(
                                  'Zkopíruj pozvánku z pole pod tlačítky.',
                                );
                              }
                            })
                          }
                        >
                          Kopírovat pozvánku
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await api('invite', {
                                room: room.id,
                                operation: room.invitesPaused
                                  ? 'resume'
                                  : 'pause',
                              });
                              setManualInvite(undefined);
                              await refresh();
                            })
                          }
                        >
                          {room.invitesPaused
                            ? 'Povolit nové vstupy'
                            : 'Pozastavit nové vstupy'}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await api('invite', {
                                room: room.id,
                                operation: 'rotate',
                              });
                              setManualInvite(undefined);
                              await refresh();
                              setStatus(
                                'Nový odkaz je připravený. Starý už pro vstup neplatí.',
                              );
                            })
                          }
                        >
                          Vystavit nový odkaz
                        </button>
                      </div>
                      {manualInvite?.room === room.id &&
                        !room.invitesPaused && (
                          <label>
                            Odkaz pro hráče
                            <input
                              value={manualInvite.url}
                              readOnly
                              onFocus={(event) => event.target.select()}
                            />
                          </label>
                        )}
                      <small>
                        Výměna odkazu zneplatní starou pozvánku. Přihlášení
                        hráči mohou dál hrát.
                      </small>
                    </details>
                  )}
                  {selection?.id === room.id && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void run(async () => {
                          await api(selection.action, {
                            room: room.id,
                            title: confirmation,
                          });
                          setSelection(undefined);
                          await refresh();
                        });
                      }}
                    >
                      <label>
                        {selection.action === 'delete'
                          ? 'Potvrď trvalé smazání názvem kampaně'
                          : 'Potvrď archivaci názvem kampaně'}
                        <input
                          value={confirmation}
                          onChange={(event) =>
                            setConfirmation(event.target.value)
                          }
                        />
                      </label>
                      <button
                        disabled={
                          busy || confirmation !== (room.title || room.id)
                        }
                      >
                        {selection.action === 'delete'
                          ? 'Trvale smazat stůl'
                          : 'Archivovat stůl'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelection(undefined)}
                      >
                        Zrušit
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {owner && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api('logout', {});
                await refresh();
              })
            }
          >
            Odhlásit účet PJ
          </button>
        )}
      </section>
    </main>
  );
}
