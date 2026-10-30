import { Button, withConfiguration } from '@pega/cosmos-react-core';

import type { PConnProps } from './PConnProps';
import './create-nonce';

import StyledCitiExtensionsActionBarWrapper from './styles';
import { ACTION_BAR_EVENT } from '../Citi_Extensions_IDP/utils/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CitiExtensionsActionBarProps extends PConnProps {
  /** When true (or "true"), the Save button is shown. */
  enableSave?: boolean | string;
  /** Recipient of the published action (set in config). */
  target: ActionTarget;
  /** Label for the Cancel button. */
  cancelButtonLabel?: string;
  /** Label for the Save button. */
  saveButtonLabel?: string;
  /** Label for the Save & Submit button. */
  saveAndSubmitButtonLabel?: string;
}

/** Action performed by a button in the action bar. */
type ActionType = 'Save' | 'SaveAndSubmit';

/** Recipient of a published action. */
type ActionTarget = 'MFE' | 'Dynamic view';

/** Single entry published in the pub/sub event payload. */
interface ActionPayload {
  type: ActionType;
  target: ActionTarget;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Footer action bar.
 *   Left  : Cancel        — cancels the current assignment.
 *   Right : Save          — saves the current assignment (shown only when enabled).
 *           Save & Submit — publishes the ACTION_BAR_EVENT pub/sub event.
 */
function CitiExtensionsActionBar(props: CitiExtensionsActionBarProps) {
  const {
    getPConnect,
    enableSave,
    target,
    cancelButtonLabel,
    saveButtonLabel,
    saveAndSubmitButtonLabel
  } = props;
  const pConn = getPConnect();

  /** Show the Save button only when explicitly enabled. */
  const showSave = enableSave === true || enableSave === 'true';

  const publishEvent = (action: ActionPayload) => {
    PCore.getPubSubUtils().publish(ACTION_BAR_EVENT, action);
  };

  const handleCancel = () => {
    pConn.getActionsApi().cancelAssignment(pConn.getContextName());
  };

  /**
  * Saves directly for non-IDP targets, then publishes the action event. Dynamic views
  * own the save flow so they can validate before persisting the assignment.
   */
  const handleSaveandSubmit = (finish: boolean) => {
    if (!finish && target !== 'Dynamic view') {
      pConn.getActionsApi().saveAssignment(pConn.getContextName());
    }
    const type: ActionType = finish ? 'SaveAndSubmit' : 'Save';
    publishEvent({ type, target });
  };

  return (
    <StyledCitiExtensionsActionBarWrapper>
      <div className='action-bar-left'>
        <Button variant='secondary' onClick={handleCancel}>
          {cancelButtonLabel || 'Cancel'}
        </Button>
      </div>
      <div className='action-bar-right'>
        {showSave && (
          <Button variant='secondary' onClick={() => handleSaveandSubmit(false)}>
            {saveButtonLabel || 'Save'}
          </Button>
        )}
        <Button variant='primary' onClick={() => handleSaveandSubmit(true)}>
          {saveAndSubmitButtonLabel || 'Save & Submit'}
        </Button>
      </div>
    </StyledCitiExtensionsActionBarWrapper>
  );
}

export default withConfiguration(CitiExtensionsActionBar);
