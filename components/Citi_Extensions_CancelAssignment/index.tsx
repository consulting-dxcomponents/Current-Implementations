import {
  Button,
  withConfiguration
} from '@pega/cosmos-react-core';

import type { PConnFieldProps } from './PConnProps';
import './create-nonce';

import StyledCitiExtensionsCancelAssignmentWrapper from './styles';

// interface for props
interface CitiExtensionsCancelAssignmentProps extends PConnFieldProps {
  // If any, enter additional props that only exist on TextInput here
}

/**
 * Returns true when the component is running inside a Pega web-embed (web-component) context.
 * Detected by the presence of the <pega-embed> custom element in the DOM.
 */
function isWebEmbed(): boolean {
  return document.querySelector('pega-embed') !== null;
}

/**
 * Collects the current form data from the Pega case context.
 * Returns a plain object representation of the case's view data.
 */
function getFormData(getPConnect: () => any): Record<string, any> {
  try {
    const pConnect = getPConnect();
    const caseInfo = pConnect.getCaseInfo();
    // Attempt to gather field values from the case view
    const viewData = pConnect.getDataObject?.() ?? {};
    return {
      caseId: caseInfo.getBusinessID?.() ?? caseInfo.getID?.() ?? '',
      ...viewData
    };
  } catch {
    return {};
  }
}

/**
 * Closes the <pega-embed> web-component.
 * Tries the standard close() API first; falls back to removing the element from the DOM.
 */
function closeEmbed(): void {
  const embedEl = document.querySelector('pega-embed') as any;
  if (!embedEl) return;
  if (typeof embedEl.close === 'function') {
    embedEl.close();
  } else {
    embedEl.remove();
  }
}

/**
 * Closes the currently open modal/container dialog using Pega's container manager.
 */
function closeDialog(getPConnect: () => any): void {
  try {
    const pConnect = getPConnect();
    // Navigate up to the root pConnect to access the container manager
    const rootPConnect = pConnect.getContainerManager?.() ?? pConnect;
    // Try standard container close mechanisms
    if (typeof rootPConnect.closeContainerItem === 'function') {
      rootPConnect.closeContainerItem();
    } else {
      const actionsAPI = pConnect.getActionsApi?.();
      if (actionsAPI && typeof actionsAPI.cancelAssignment === 'function') {
        actionsAPI.cancelAssignment();
      }
    }
  } catch (e) {
    console.warn('CitiExtensionsCancelAssignment: could not close dialog', e);
  }
}

// props passed in combination of props from property panel (config.json) and run time props from Constellation
// any default values in config.pros should be set in defaultProps at bottom of this file
function CitiExtensionsCancelAssignment(props: CitiExtensionsCancelAssignmentProps) {
  const { getPConnect } = props;

  function handleClick() {
    const pConnect = getPConnect();
    const caseID = pConnect.getCaseInfo().getBusinessID();

    if (isWebEmbed()) {
      // ── Web-embed path ──────────────────────────────────────────────────────
      // Collect current form data, post it to the host page, then close the embed.
      const formData = getFormData(getPConnect);
      window.parent.postMessage(
        { type: 'PEGA_CASE_ID', caseId: caseID, formData },
        '*'
      );
      closeEmbed();
    } else {
      // ── Portal path ─────────────────────────────────────────────────────────
      // Cancel the assignment via Pega's actions API, close the dialog,
      // then redirect the user to the home portal.
      closeDialog(getPConnect);
      try {
        const actionsAPI: any = pConnect.getActionsApi?.();
        if (actionsAPI && typeof actionsAPI.cancelAssignment === 'function') {
          actionsAPI.cancelAssignment(null);
        }
      } catch (e) {
        console.warn('CitiExtensionsCancelAssignment: cancelAssignment API error', e);
      }
      // Navigate to the home/portal page
      try {
        const containerMgr: any = pConnect.getContainerManager?.();
        if (containerMgr && typeof containerMgr.navigateToPage === 'function') {
          containerMgr.navigateToPage('home');
        } else {
          // Fallback: navigate to the root portal URL
          window.location.href = '/prweb/app/disputes--fraud-claims?portal=WebPortal';
        }
      } catch {
        window.location.href = '/';
      }
    }
  }

  return (
    <StyledCitiExtensionsCancelAssignmentWrapper>
      <Button onClick={handleClick}>Cancel Assignment</Button>
    </StyledCitiExtensionsCancelAssignmentWrapper>
  );
};


export default withConfiguration(CitiExtensionsCancelAssignment);
