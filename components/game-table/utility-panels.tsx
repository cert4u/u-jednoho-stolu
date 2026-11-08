import { ArrowRight, Copy, Download, LogOut } from 'lucide-react';
import { RecoveryCard, RestoreForms, PartyAccess } from '../campaign-access';
import type { PanelContentProps } from './table-dialog-types';

// Render helpers return elements only; stateful hooks belong in the panel components.
export function renderUtilityPanels({
  modal,
  game,
  me,
  session,
  busy,
  act,
  setModal,
  copy,
  exportGame,
  leave,
  selection,
}: PanelContentProps) {
  const pj = me.role === 'pj';
  const { recoveryCode, recoveryName } = selection;
  switch (modal) {
    case 'account':
      return (
        <>
          <h2>Tvoje místo u stolu</h2>
          <p>
            Přihlášen jako <strong>{me.name}</strong>. Kód místnosti:
          </p>
          <div className="room-code">{session.room}</div>
          <p>
            Přístup si pamatuje tento prohlížeč. Pro návrat na jiném zařízení si
            ulož osobní obnovovací klíč. Postava i její deník zůstanou stejné.
          </p>
          <button className="primary" onClick={copy}>
            <Copy size={17} /> Zkopírovat pozvánku
          </button>
          {recoveryCode && (
            <RecoveryCard
              key={recoveryCode}
              code={recoveryCode}
              name={recoveryName}
            />
          )}
          <PartyAccess
            members={game.members}
            archived={game.archivedMembers || []}
            me={me.id}
            pj={!!pj}
            busy={busy}
            onAction={act}
          />
          {pj && (
            <button className="secondary" onClick={exportGame}>
              <Download size={17} /> Stáhnout úplnou zálohu kampaně
            </button>
          )}
          <RestoreForms busy={busy} onAction={act} />
          <button className="text-button danger" onClick={leave}>
            <LogOut size={16} /> Opustit stůl v tomto prohlížeči
          </button>
        </>
      );
  }
  return (
    <>
      <span className="eyebrow">V JEDNODUCHOSTI JE SÍLA</span>
      <h2>Vítej u jednoho stolu.</h2>
      <p>
        <strong>1. Svolej družinu.</strong> Pozvánku najdeš nahoře. Hlasový
        hovor najdeš u chatu, pokud ho správce serveru zapnul. Přístup k
        hostované aplikaci je zatím soukromý pro majitele.
      </p>
      <p>
        <strong>2. Otevři deník.</strong> Pravidla necháváme na vás. Vlastnosti
        i výbavu zapisuj volně.
      </p>
      <p>
        <strong>3. Prozkoumej mapu.</strong> Hráč vybírá a posouvá svou značku.
        PJ v přípravě kreslí zdi, místnosti a dveře. V odkrývání tažením
        odhaluje oblasti; skrytá kresba zůstává jen u něj. Pohled družiny ověří,
        co hráči vidí, a šipka Zpět vrátí poslední akci mapy.
      </p>
      <p>
        <strong>4. Nech kostky promluvit.</strong> V Hody a souboj hodíš na
        vlastnost (1k10 + bonus) nebo útok/obranu (1k6+). Cíl útoku odpoví
        tlačítkem Hodit obranu v chatu a PJ potvrdí zranění. Tlačítkem hodíš
        jednou kostkou, příkazem /hod 2k6+1 vlastním hodem. Příjemce přepneš na
        celou družinu nebo šeptání.
      </p>
      <p className="muted">
        MVP · až osm propojených pater · sdílení se obnovuje každé 2 sekundy ·
        bez automatického vyhodnocování pravidel.
      </p>
      <button className="primary" onClick={() => setModal('')}>
        Jdeme hrát <ArrowRight size={17} />
      </button>
    </>
  );
}
