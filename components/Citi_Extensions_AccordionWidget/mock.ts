// @ts-nocheck
import { createElement } from 'react';

// ── Editable form panels (simulating Pega view regions in Storybook) ──────────
const ce = createElement;

const s = {
  wrap:    { display: 'flex', flexDirection: 'column', flex: '1 1 200px', minWidth: 180 } as React.CSSProperties,
  row:     { display: 'flex', flexWrap: 'wrap', gap: '12px 20px', marginBottom: 14 } as React.CSSProperties,
  divider: { borderTop: '1px solid #eef1f8', margin: '6px 0 16px' } as React.CSSProperties,
  lbl:     { display: 'block', marginBottom: 4, fontSize: '0.73rem', fontWeight: 600, color: '#555' } as React.CSSProperties,
  input:   { width: '100%', padding: '7px 10px', fontSize: '0.875rem', border: '1px solid #d0d5dd', borderRadius: 6, outline: 'none', background: '#fff', color: '#1a1a2e', boxSizing: 'border-box' } as React.CSSProperties,
  select:  { width: '100%', padding: '7px 10px', fontSize: '0.875rem', border: '1px solid #d0d5dd', borderRadius: 6, outline: 'none', background: '#fff', color: '#1a1a2e', cursor: 'pointer', boxSizing: 'border-box' } as React.CSSProperties,
};

const txt = (lbl: string, ph = '', dv = '') =>
  ce('div', { key: lbl, style: s.wrap },
    ce('label', { style: s.lbl }, lbl),
    ce('input', { type: 'text', placeholder: ph, defaultValue: dv, style: s.input }));

const sel = (lbl: string, opts: string[]) =>
  ce('div', { key: lbl, style: s.wrap },
    ce('label', { style: s.lbl }, lbl),
    ce('select', { style: s.select },
      ce('option', { value: '' }, '— Select —'),
      ...opts.map(o => ce('option', { key: o, value: o }, o))));

const dat = (lbl: string) =>
  ce('div', { key: lbl, style: s.wrap },
    ce('label', { style: s.lbl }, lbl),
    ce('input', { type: 'date', style: s.input }));

const num = (lbl: string, ph = '0.00') =>
  ce('div', { key: lbl, style: { ...s.wrap } },
    ce('label', { style: s.lbl }, lbl),
    ce('div', { style: { display: 'flex' } },
      ce('span', { style: { padding: '7px 10px', background: '#f3f4f6', border: '1px solid #d0d5dd', borderRight: 'none', borderRadius: '6px 0 0 6px', fontSize: '0.875rem', color: '#666' } }, '$'),
      ce('input', { type: 'number', placeholder: ph, style: { ...s.input, borderRadius: '0 6px 6px 0', flex: 1 } })));

const area = (lbl: string, ph = '') =>
  ce('div', { key: lbl, style: { ...s.wrap, flex: '1 1 100%' } },
    ce('label', { style: s.lbl }, lbl),
    ce('textarea', { rows: 3, placeholder: ph, style: { ...s.input, resize: 'vertical', height: 'auto' } }));

const panel = (...rows: React.ReactElement[]) =>
  ce('div', { style: { display: 'flex', flexDirection: 'column' } }, ...rows);

const row = (...fields: React.ReactElement[]) =>
  ce('div', { style: s.row }, ...fields);

const hr = () => ce('div', { style: s.divider });

export const MOCK_CHILDREN = [
  // 1 — Transaction Cancelled
  panel(
    row(dat('Date of Cancellation'), txt('Merchant Name', 'Merchant on the statement'), txt('Transaction ID', 'Reference / authorisation #')),
    hr(),
    row(num('Disputed Amount'), sel('Cancellation Source', ['Merchant', 'Payment network', 'Issuing bank', 'Unknown'])),
    row(area('Additional details', 'Describe how the cancellation was confirmed…')),
  ),

  // 2 — Unauthorized Charge
  panel(
    row(dat('Charge Date'), txt('Merchant Name', 'Merchant on the statement'), num('Disputed Amount')),
    hr(),
    row(sel('Card Status', ['In my possession', 'Lost', 'Stolen', 'Never received']), sel('Reported to Police', ['No', 'Yes — report on file'])),
    row(area('Additional details', 'Anything else we should know about this charge…')),
  ),

  // 3 — Duplicate Charge
  panel(
    row(txt('Merchant Name', 'Merchant on the statement'), num('Charge Amount')),
    hr(),
    row(dat('Original Charge Date'), dat('Duplicate Charge Date')),
    row(area('Additional details', 'List all dates this charge appeared on your statement…')),
  ),

  // 4 — Goods not Received
  panel(
    row(txt('Merchant Name', 'Merchant on the statement'), dat('Purchase Date'), dat('Expected Delivery')),
    hr(),
    row(num('Amount Paid'), sel('Contacted Merchant', ['Yes', 'No', 'Unable to reach merchant'])),
    row(area('Additional details', 'Describe the items / services not received…')),
  ),

  // 5 — Service not as Expected
  panel(
    row(txt('Merchant Name', 'Merchant on the statement'), dat('Service Date'), num('Amount Paid')),
    hr(),
    row(sel('Resolution Attempted', ['Refund refused', 'Replacement refused', 'No response from merchant', 'Other'])),
    row(area('Additional details', 'Describe how the goods or services differed from what was agreed…')),
  ),

  // 6 — Damaged Item
  panel(
    row(txt('Merchant Name', 'Merchant on the statement'), dat('Purchase Date'), dat('Delivery Date')),
    hr(),
    row(num('Amount Paid'), sel('Item Condition', ['Damaged in transit', 'Defective on arrival', 'Broken / unusable', 'Other'])),
    row(area('Additional details', 'Describe the damage and any communication with the merchant…')),
  ),

  // 7 — Returned Goods
  panel(
    row(txt('Merchant Name', 'Merchant on the statement'), dat('Return Date'), num('Amount Expected')),
    hr(),
    row(txt('Return Tracking #', 'Carrier tracking number'), sel('Refund Status', ['Not received', 'Partial refund only', 'Wrong amount refunded'])),
    row(area('Additional details', 'Confirm the merchant has acknowledged the return…')),
  ),
];
