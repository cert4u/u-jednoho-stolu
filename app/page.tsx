'use client';

import { useState } from 'react';
import Lobby from '../components/game-table/lobby';
import TableWorkspace from '../components/game-table/table-workspace';
import { useBrowserEntry } from '../components/game-table/use-browser-entry';
import { useTableSession } from '../components/game-table/use-table-session';

export default function Home() {
  const { initial, ready } = useBrowserEntry();
  const table = useTableSession(initial.session);
  const { session, game, me, act, busy, error, setError, leave, sessionId } =
    table;
  const [name, setName] = useState('');
  const [code, setCode] = useState(initial.code);
  const [joining, setJoining] = useState(initial.joining);

  if (!ready) return <div className="loading">Rozsvěcujeme pochodně…</div>;
  if (!session)
    return (
      <Lobby
        name={name}
        code={code}
        joining={joining}
        busy={busy}
        error={error}
        setName={setName}
        setCode={setCode}
        setJoining={setJoining}
        setError={setError}
        act={act}
      />
    );
  if (!game || !me)
    return (
      <div className="loading">
        {error || 'Připravujeme váš stůl…'}
        <button onClick={leave}>Zpět</button>
      </div>
    );
  return (
    <TableWorkspace
      key={sessionId}
      table={{ ...table, session, game }}
      me={me}
    />
  );
}
