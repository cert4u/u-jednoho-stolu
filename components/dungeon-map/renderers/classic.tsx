import { edgeCells, type Dungeon } from '../../../lib/dungeon';
import { edgeVertices, PAD, SIZE } from '../model';

export function ClassicWall({
  edge,
  kind,
  opacity = 1,
  ghost = false,
  open = false,
}: {
  edge: string;
  open?: boolean;
  kind: 'wall' | 'door';
  opacity?: number;
  ghost?: boolean;
}) {
  const [a, b] = edgeVertices(edge);
  const x = PAD + a[0] * SIZE,
    y = PAD + a[1] * SIZE,
    horizontal = a[1] === b[1];
  return (
    <g
      opacity={opacity}
      data-map-edge={ghost ? undefined : edge}
      data-edge-kind={kind}
      pointerEvents="none"
    >
      <line
        x1={x}
        y1={y}
        x2={PAD + b[0] * SIZE}
        y2={PAD + b[1] * SIZE}
        stroke={ghost ? '#87956e' : '#565648'}
        strokeWidth={ghost ? 2 : 2.6}
        strokeLinecap="square"
      />
      {kind === 'door' && (
        <g transform={`translate(${x},${y}) rotate(${horizontal ? 0 : 90})`}>
          <rect x="6" y="-4" width="24" height="8" fill="#faf7e9" />
          <rect
            transform={open ? 'rotate(55 7 -3)' : undefined}
            x="7"
            y="-3"
            width="22"
            height="6"
            fill="#f0ead4"
            stroke="#67634e"
            strokeWidth="1.5"
          />
          <line
            transform={open ? 'rotate(55 7 -3)' : undefined}
            x1="10"
            x2="26"
            y1="0"
            y2="0"
            stroke="#9f987c"
            strokeWidth=".7"
          />
        </g>
      )}
    </g>
  );
}


export type SurfaceProps = {
  shown: Dungeon;
  revealed: ReadonlySet<string>;
  lit: ReadonlySet<string>;
  visible: boolean;
  exploring: boolean;
};

export function ClassicSurface({ shown, revealed, lit, visible, exploring }: SurfaceProps) {
  return <>
      {shown.floors.map((k) => {
        const [x, y] = k.split(',').map(Number);
        return (
          <rect
            key={k}
            data-map-floor={k}
            x={PAD + x * SIZE + 1}
            y={PAD + y * SIZE + 1}
            width={SIZE - 2}
            height={SIZE - 2}
            fill={revealed.has(k) ? '#ded3ae' : '#bcc1ad'}
            opacity={
              exploring && visible && !lit.has(k)
                ? 0.06
                : revealed.has(k)
                  ? 0.2
                  : 0.13
            }
            pointerEvents="none"
          />
        );
      })}
      {Object.entries(shown.edges).map(([key, kind]) => (
        <ClassicWall
          key={key}
          edge={key}
          kind={kind}
          open={shown.openDoors?.includes(key)}
          opacity={
            exploring &&
            visible &&
            !edgeCells(key).some((k) => lit.has(k))
              ? 0.3
              : visible || edgeCells(key).some((k) => revealed.has(k))
                ? 1
                : 0.25
          }
        />
      ))}

  </>;
}
