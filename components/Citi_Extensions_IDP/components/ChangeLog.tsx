import { useState } from 'react';
import type { ReactElement } from 'react';
import { Table, Pagination } from '@pega/cosmos-react-core';
import type { ColumnProps } from '@pega/cosmos-react-core';

import type { FieldChange } from '../idpTypes';
import type { AuditCounts } from '../utils/helpers';
import {
  StyledChangeLog,
  StyledAuditCaseId,
  StyledAuditPrevValue,
  StyledAuditNextValue,
  StyledChangeLogEmpty,
  StyledExtractedFieldCount,
  StyledPaginationBar
} from '../styles';
import AccordionSection from './AccordionSection';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ChangeLogProps {
  changes: FieldChange[];
  /** Pre-computed field-count statistics for the stats bar. */
  counts: AuditCounts;
}

// ─── Row shape ────────────────────────────────────────────────────────────────

interface AuditRow {
  id: number;
  caseId: string;
  sectionLabel: string;
  fieldLabel: string;
  previousValue: string;
  newValue: string;
  updatedBy: string;
  updatedTime: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Renders a single object's key/value pairs as "Key: value" segments,
 * skipping empty values.
 */
function formatObject(obj: Record<string, unknown>): string {
  return Object.entries(obj)
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(', ');
}

/**
 * Converts an audit value into user-friendly plain text. Values that are JSON
 * arrays/objects (e.g. repeatable rows like "Beneficial Owner Foreign Taxpayer
 * Id") are flattened into readable segments instead of raw JSON. Plain strings
 * are returned unchanged.
 */
function formatAuditValue(val: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (!(trimmed.startsWith('[') || trimmed.startsWith('{'))) return val;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return val;
  }

  if (Array.isArray(parsed)) {
    const parts = parsed.map(item =>
      item != null && typeof item === 'object'
        ? formatObject(item as Record<string, unknown>)
        : String(item)
    );
    return parts.filter(p => p.trim() !== '').join(' | ');
  }

  if (parsed != null && typeof parsed === 'object') {
    return formatObject(parsed as Record<string, unknown>);
  }

  return String(parsed);
}

// ─── Column renderers ─────────────────────────────────────────────────────────

const CaseIdCell = ({ caseId }: { caseId: string }) => (
  <StyledAuditCaseId>{caseId || '—'}</StyledAuditCaseId>
);

const PrevValueCell = ({ previousValue }: { previousValue: string }) => (
  <StyledAuditPrevValue>{previousValue || '—'}</StyledAuditPrevValue>
);

const NewValueCell = ({ newValue }: { newValue: string }) => (
  <StyledAuditNextValue>{newValue || '—'}</StyledAuditNextValue>
);

// Column definitions are stable — defined outside the component so they are
// not recreated on every render.
const COLUMNS: ColumnProps<AuditRow>[] = [
  { label: 'Case ID', renderer: CaseIdCell, noWrap: true },
  { label: 'Section', renderer: 'sectionLabel' },
  { label: 'Field', renderer: 'fieldLabel' },
  { label: 'Previous value', renderer: PrevValueCell },
  { label: 'New value', renderer: NewValueCell },
  { label: 'Updated by', renderer: 'updatedBy' },
  { label: 'Updated time', renderer: 'updatedTime' }
];

// ─── ChangeLog ────────────────────────────────────────────────────────────────

/**
 * Collapsible audit log rendered below the review panel.
 * Uses the Cosmos OOTB Table for the read-only change history and
 * AccordionSection (Cosmos FieldGroup) as the collapse wrapper, with a
 * badge showing how many fields have been changed.
 */
export default function ChangeLog({ changes, counts }: ChangeLogProps): ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const PAGE_SIZE = 10;

  const { TotalFieldsInSchema, FieldsFromIdp, FieldsAdded, FieldsModified } = counts;
  const showStats = FieldsFromIdp > 0 || TotalFieldsInSchema > 0;

  // Most-recent change first, but work-status rows are pinned to the top so the
  // case work status is always the first row(s), with field edits below.
  const orderedChanges = [...changes].reverse();
  const statusChanges = orderedChanges
    .filter(c => c.entryType === 'workStatus')
    .sort((a, b) => {
      const aTime = new Date(a.updatedTime ?? '').getTime();
      const bTime = new Date(b.updatedTime ?? '').getTime();
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
      return bTime - aTime;
    });
  const fieldChanges = orderedChanges.filter(c => c.entryType !== 'workStatus');
  const allRows: AuditRow[] = [...statusChanges, ...fieldChanges].map((c, i) => ({
    id: i,
    caseId: c.caseId ?? '—',
    sectionLabel: c.sectionLabel,
    fieldLabel: c.fieldLabel,
    previousValue: formatAuditValue(c.previousValue),
    newValue: formatAuditValue(c.newValue),
    updatedBy: c.updatedBy ?? '—',
    updatedTime: c.updatedTime ?? '—'
  }));

  const totalRows = allRows.length;
  const startIndex = (pageNumber - 1) * PAGE_SIZE;
  const rows = allRows.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <StyledChangeLog>
      <AccordionSection
        label='Audit Log'
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(prev => !prev)}
      >
        {showStats && (
          <StyledExtractedFieldCount>
            Total fields from schema: <strong>{TotalFieldsInSchema}</strong>
            <span>·</span>
            Fields from IDP: <strong>{FieldsFromIdp}</strong>
            <span>·</span>
            Newly added fields: <strong>{FieldsAdded}</strong>
            <span>·</span>
            Total modified fields: <strong>{FieldsModified}</strong>
          </StyledExtractedFieldCount>
        )}
        {changes.length === 0 ? (
          <StyledChangeLogEmpty>No changes recorded yet.</StyledChangeLogEmpty>
        ) : (
          <>
            <Table<AuditRow> columns={COLUMNS} data={rows} hoverHighlight />
            {totalRows > PAGE_SIZE && (
              <StyledPaginationBar>
                <span>
                  {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, totalRows)} of {totalRows}
                </span>
                <Pagination
                  total={totalRows}
                  pageSize={PAGE_SIZE}
                  pageNumber={pageNumber}
                  onPageChange={setPageNumber}
                />
              </StyledPaginationBar>
            )}
          </>
        )}
      </AccordionSection>
    </StyledChangeLog>
  );
}
