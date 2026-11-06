'use client';
import { useRef,useState } from 'react';
import { Star,Users } from 'lucide-react';
import type { MemberView as Member } from '../../app/api/game/view';
export default function ExperienceForm({
  members,
  busy,
  onAward,
}: {
  members: Member[];
  busy: boolean;
  onAward: (values: Record<string, unknown>) => Promise<void>;
}) {
  const players = members.filter((m) => m.role === 'player');
  const [target, setTarget] = useState('all'),
    [amount, setAmount] = useState('100'),
    [reason, setReason] = useState('');
  const request = useRef<{ signature: string; id: string } | null>(null);
  const count =
    target === 'all'
      ? players.length
      : players.filter((m) => m.id === target).length;
  return (
    <>
      <span className="eyebrow">ODMĚNA OD PÁNA JESKYNĚ</span>
      <h2>Každá výprava něco naučí.</h2>
      <p className="experience-intro">
        Odměň odvahu, dobrý nápad nebo dokončené dobrodružství.
      </p>
      {players.length === 0 ? (
        <div className="experience-empty">
          <Users size={26} />
          <p>
            U stolu zatím nejsou žádní hráči. Pozvi družinu a potom můžeš
            rozdělit první zkušenosti.
          </p>
        </div>
      ) : (
        <>
          <div className="experience-roster">
            {players.map((m) => (
              <div key={m.id}>
                <span className="member-avatar" style={{ background: m.color }}>
                  {m.name[0]}
                </span>
                <span>
                  <strong>{m.name}</strong>
                  <small>
                    {m.profession || 'Dobrodruh'} · úroveň {m.level ?? 1}
                  </small>
                </span>
                <b>
                  {(m.experience ?? 0).toLocaleString('cs-CZ')}{' '}
                  <small>zk.</small>
                </b>
              </div>
            ))}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const values = { target, amount: Number(amount), reason };
              const signature = JSON.stringify(values);
              if (request.current?.signature !== signature)
                request.current = { signature, id: crypto.randomUUID() };
              await onAward({ ...values, requestId: request.current!.id });
            }}
          >
            <label>
              Komu přidělit zkušenosti
              <select
                className="experience-select"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                disabled={busy}
              >
                <option value="all">Celé družině ({players.length})</option>
                {players.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Počet zkušeností pro každého vybraného hráče
              <input
                aria-label="Počet zkušeností"
                type="number"
                min="1"
                max="1000000"
                step="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={busy}
              />
            </label>
            <label>
              Za co? <span className="optional">(nepovinné)</span>
              <textarea
                rows={2}
                maxLength={300}
                placeholder="Např. záchrana vesnice nebo chytré vyřešení hádanky"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy}
              />
            </label>
            <div className="experience-summary">
              <Star size={18} />
              <span>
                {count > 1
                  ? `Počet hráčů: ${count} · každý +${(Number(amount) || 0).toLocaleString('cs-CZ')} zk.`
                  : `${players.find((m) => m.id === target)?.name || players[0]?.name} · +${(Number(amount) || 0).toLocaleString('cs-CZ')} zk.`}
              </span>
            </div>
            <p className="sheet-hint">
              Odměna se přičte do deníků a zapíše do společného chatu. Úroveň se
              mění ručně.
            </p>
            <button className="primary" disabled={busy || count === 0}>
              {busy ? 'Přidělujeme…' : 'Přidělit zkušenosti'}
              <Star size={17} />
            </button>
          </form>
        </>
      )}
    </>
  );
}
