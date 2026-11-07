'use client';

import { useState, type CSSProperties } from 'react';
import { Shield } from 'lucide-react';
import { professionArtwork } from '../lib/character-artwork';

type Member = {
  name: string;
  role: 'pj' | 'player';
  profession?: string;
  color: string;
};

export default function CharacterAvatar({ member }: { member: Member }) {
  const artwork = member.role === 'player' ? professionArtwork(member.profession ?? '') : undefined;
  const [failedFile, setFailedFile] = useState<string>();
  if (!artwork || failedFile === artwork.file) {
    return (
      <span className="member-avatar" style={{ background: member.color }} aria-hidden="true">
        {member.role === 'pj' ? <Shield size={19} /> : member.name.slice(0, 1)}
      </span>
    );
  }

  return (
    <span
      className="member-avatar character-avatar"
      style={{ '--portrait-color': member.color } as CSSProperties}
      aria-hidden="true"
    >
      <img
        src={`/characters/${artwork.file}`}
        alt=""
        width={720}
        height={1080}
        loading="lazy"
        decoding="async"
        onError={() => setFailedFile(artwork.file)}
      />
    </span>
  );
}
