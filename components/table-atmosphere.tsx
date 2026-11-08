'use client';

import { useId, useLayoutEffect, useRef, type RefObject } from 'react';
import type { Dungeon } from '../lib/dungeon';
import {
  keepsakeFootprint,
  keepsakeProjection,
} from './dungeon-map/keepsake-mask';
import { SIZE, WIDTH, HEIGHT } from './dungeon-map/model';

type Props = {
  shown: Dungeon;
  mapSvg: RefObject<SVGSVGElement | null>;
  viewport: RefObject<HTMLDivElement | null>;
  zoom: number;
};

/** Fixed sketches disappear only beneath geometry actually shown to this viewer. */
export default function TableAtmosphere({
  shown,
  mapSvg,
  viewport,
  zoom,
}: Props) {
  const id = useId().replaceAll(':', '');
  const illustration = useRef<SVGSVGElement>(null);
  const maskShape = useRef<SVGGElement>(null);
  const footprint = keepsakeFootprint(shown);
  useLayoutEffect(() => {
    const sketch = illustration.current,
      shape = maskShape.current;
    if (!sketch || !shape) return;
    let frame: number | undefined,
      attached: HTMLDivElement | null = null;
    let observedPaper: SVGSVGElement | null = null;
    const resize = new ResizeObserver(schedule);
    function update() {
      const view = viewport.current,
        paper = mapSvg.current;
      if (view !== attached) {
        attached?.removeEventListener('scroll', schedule);
        if (attached) resize.unobserve(attached);
        attached = view;
        attached?.addEventListener('scroll', schedule, { passive: true });
        if (attached) resize.observe(attached);
      }
      if (paper !== observedPaper) {
        if (observedPaper) resize.unobserve(observedPaper);
        observedPaper = paper;
        if (paper) resize.observe(paper);
      }
      if (!paper) return;
      const matrix = keepsakeProjection(
        paper.getBoundingClientRect(),
        sketch!.getBoundingClientRect(),
      );
      if (matrix)
        shape!.setAttribute('transform', `matrix(${matrix.join(' ')})`);
    }
    function schedule() {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        update();
      });
    }
    resize.observe(sketch);
    update();
    schedule();
    window.addEventListener('resize', schedule);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      attached?.removeEventListener('scroll', schedule);
      resize.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [mapSvg, viewport, zoom]);
  return (
    <>
      <svg
        className="paper-worn-edges"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <filter
            id={`paper-fray-${id}`}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency=".017 .037"
              numOctaves="3"
              seed="23"
              result="grain"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="grain"
              scale="35"
              xChannelSelector="R"
              yChannelSelector="G"
            />
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>
        <path
          d="M-8 -9L1006 -9L1006 1010L-8 1010Z"
          fill="none"
          stroke="#eeeadd"
          strokeWidth="48"
          filter={`url(#paper-fray-${id})`}
        />
      </svg>
      <svg
        ref={illustration}
        className="table-keepsakes"
        viewBox="0 0 330 160"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <pattern
            id={`graphite-hatch-${id}`}
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-25)"
          >
            <path d="M0 0V4" stroke="#625f55" strokeWidth=".55" opacity=".4" />
          </pattern>
          <pattern
            id={`graphite-dense-${id}`}
            width="2.5"
            height="3"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(24)"
          >
            <path d="M0 0V3" stroke="#625f55" strokeWidth=".6" opacity=".5" />
          </pattern>
          <filter
            id={`graphite-line-${id}`}
            x="-10%"
            y="-20%"
            width="120%"
            height="140%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency=".1"
              numOctaves="2"
              seed="7"
              result="pencil-grain"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="pencil-grain"
              scale=".65"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          <filter
            id={`keepsake-soft-${id}`}
            filterUnits="userSpaceOnUse"
            x={-SIZE * 2}
            y={-SIZE * 2}
            width={WIDTH + SIZE * 4}
            height={HEIGHT + SIZE * 4}
          >
            <feGaussianBlur stdDeviation={SIZE / 3} />
          </filter>
          <mask
            id={`keepsake-map-${id}`}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="330"
            height="160"
            style={{ maskType: 'luminance' }}
          >
            <rect width="330" height="160" fill="white" />
            <g
              ref={maskShape}
              transform="translate(-100000 -100000)"
              data-map-occlusion="true"
            >
              <g
                filter={`url(#keepsake-soft-${id})`}
                fill="black"
                stroke="black"
                strokeWidth={SIZE}
                strokeLinejoin="round"
                strokeLinecap="round"
                data-occlusion-halo="true"
              >
                <path d={footprint.floor} />
                <path d={footprint.edges} fill="none" />
              </g>
              <path data-occlusion="floor" d={footprint.floor} fill="black" />
              <path
                data-occlusion="edges"
                d={footprint.edges}
                fill="none"
                stroke="black"
                strokeWidth="6"
                strokeLinecap="round"
              />
            </g>
          </mask>
        </defs>
        <g mask={`url(#keepsake-map-${id})`}>
          <g
            transform="translate(17 121) rotate(-24)"
            filter={`url(#graphite-line-${id})`}
            stroke="#68665b"
            strokeWidth=".85"
            strokeLinejoin="round"
          >
            <path
              d="M-1 1L30 -8L222 -8M33 8L219 8"
              fill="none"
              opacity=".22"
              strokeWidth=".6"
            />
            <path d="M0 0L29 -7V7Z" fill="none" />
            <path d="M0 0L10 -2.4L10 2.4Z" fill="#68665b" />
            <path
              d="M29 -7H221Q224 -7 224 -4V4Q224 7 221 7H29L33 3L29 0L33 -3Z"
              fill={`url(#graphite-hatch-${id})`}
            />
            <path
              d="M34 -5.5H219M35 2.5H220"
              stroke="#68665b"
              strokeWidth=".8"
              opacity=".65"
            />
            <path
              d="M40 -6L66 -6M110 6L120 6M177 -6L183 -6"
              stroke="#68665b"
              strokeWidth=".7"
              opacity=".5"
            />
            <path
              d="M218 -7H222Q224 -7 224 -4V4Q224 7 222 7H218Z"
              fill={`url(#graphite-dense-${id})`}
            />
            <text
              x="115"
              y="1"
              fontSize="4"
              letterSpacing="1.5"
              fill="#68665b"
              stroke="none"
              fontFamily="serif"
            >
              TUŽKA · HB
            </text>
          </g>
          <g
            transform="translate(252 70) rotate(13)"
            filter={`url(#graphite-line-${id})`}
            stroke="#68665b"
            strokeWidth=".95"
            strokeLinejoin="round"
          >
            <path
              d="M-1 -34L-34 -1L-25 17L0 34L17 20L32 4L35 0L25 -17Z"
              fill="none"
              opacity=".22"
              strokeWidth=".65"
            />
            <path
              d="M0.0 -33.3L-15.7 -19.3L-30.4 -4.4L-33.5 -0.6Z"
              fill="none"
            />
            <path
              d="M0.0 -33.3L30.4 4.4L33.5 0.6L23.9 -16.2Z"
              fill={`url(#graphite-dense-${id})`}
            />
            <path
              d="M0.0 33.3L-23.9 16.2L-5.1 14.1L15.7 19.3Z"
              fill={`url(#graphite-dense-${id})`}
            />
            <path d="M0.0 -33.3L-33.5 -0.6L-23.9 16.2L-5.1 14.1Z" fill="none" />
            <text
              x="-15.6"
              y="3.1"
              fill="#68665b"
              stroke="none"
              fontFamily="Georgia,serif"
              fontStyle="italic"
              fontSize="13"
              textAnchor="middle"
            >
              8
            </text>
            <path
              d="M0.0 -33.3L-5.1 14.1L15.7 19.3L30.4 4.4Z"
              fill={`url(#graphite-hatch-${id})`}
            />
            <text
              x="10.3"
              y="5.1"
              fill="#68665b"
              stroke="none"
              fontFamily="Georgia,serif"
              fontStyle="italic"
              fontSize="13"
              textAnchor="middle"
            >
              2
            </text>
          </g>
        </g>
      </svg>
    </>
  );
}
