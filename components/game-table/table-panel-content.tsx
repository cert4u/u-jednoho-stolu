'use client';
import type { PanelContentProps } from './table-dialog-types';
import { renderAdventurePanels } from './adventure-panels';
import { renderCharacterPanels } from './character-panels';
import { renderUtilityPanels } from './utility-panels';

/** Ordered explicit routing; unauthorized/unavailable panels retain the help fallback. */
export default function TablePanelContent(props: PanelContentProps) {
  return (
    renderAdventurePanels(props) ??
    renderCharacterPanels(props) ??
    renderUtilityPanels(props)
  );
}
