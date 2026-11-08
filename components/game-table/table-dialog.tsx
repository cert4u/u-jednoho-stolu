'use client';
import GuardedDialog from '../guarded-dialog';
import TablePanelContent from './table-panel-content';
import { panelDetails } from './table-panel-details';
import type { TableDialogProps } from './table-dialog-types';
export type { TablePanel } from './table-panel-details';

export default function TableDialog(props: TableDialogProps) {
  const { modal, dialog, error, act, setTab, setModal } = props;
  async function submitAndClose(
    action: string,
    values: Record<string, unknown>,
    showChat = false,
  ) {
    if (!(await act(action, values))) return false;
    if (showChat) setTab('chat');
    setModal('');
    return true;
  }

  const details: { label: string; className?: string } = panelDetails[modal];
  return (
    <GuardedDialog
      ref={dialog}
      label={details.label}
      className={['modal', details.className].filter(Boolean).join(' ')}
      onClose={() => setModal('')}
    >
      <TablePanelContent {...props} submitAndClose={submitAndClose} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </GuardedDialog>
  );
}
