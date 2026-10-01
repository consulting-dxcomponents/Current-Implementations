/**
 * useTableActions.ts
 * All table-editing helpers: insert, add/delete rows & columns, delete table.
 * Returns plain functions — no hooks needed, so callers can just call them directly.
 */

const CELL_STYLE = 'padding:6px 10px;border:1px solid #ccc;min-width:60px';

export interface TableActions {
  insertTable: () => void;
  tableAddRow: (below: boolean) => void;
  tableDeleteRow: () => void;
  tableAddCol: (right: boolean) => void;
  tableDeleteCol: () => void;
  tableDeleteTable: () => void;
}

interface TableActionsOptions {
  readOnly: boolean;
  tableConfig: { rows: number; cols: number };
  activeTableCell: HTMLTableCellElement | null;
  setActiveTableCell: (cell: HTMLTableCellElement | null) => void;
  setShowTableDialog: (v: boolean) => void;
  execCommand: (cmd: string, value?: string) => void;
  onMutation: () => void;
}

export function createTableActions({
  readOnly, tableConfig, activeTableCell,
  setActiveTableCell, setShowTableDialog, execCommand, onMutation,
}: TableActionsOptions): TableActions {

  function insertTable() {
    if (readOnly) return;
    const { rows, cols } = tableConfig;
    let html = '<table border="1" style="border-collapse:collapse;width:100%;margin:8px 0">';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        const tag = r === 0 ? 'th' : 'td';
        html += `<${tag} style="${CELL_STYLE}"> </${tag}>`;
      }
      html += '</tr>';
    }
    html += '</table><p><br></p>';
    execCommand('insertHTML', html);
    setShowTableDialog(false);
  }

  function tableAddRow(below: boolean) {
    if (!activeTableCell) return;
    const row = activeTableCell.closest('tr') as HTMLTableRowElement | null;
    if (!row) return;
    const table = row.closest('table') as HTMLTableElement;
    const colCount = table.rows[0]?.cells.length ?? 1;
    const newRow = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
      const td = document.createElement('td');
      td.style.cssText = CELL_STYLE;
      td.innerHTML = ' ';
      newRow.appendChild(td);
    }
    row.insertAdjacentElement(below ? 'afterend' : 'beforebegin', newRow);
    onMutation();
  }

  function tableDeleteRow() {
    if (!activeTableCell) return;
    const row = activeTableCell.closest('tr') as HTMLTableRowElement | null;
    const table = row?.closest('table') as HTMLTableElement | null;
    if (!table || table.rows.length <= 1) return;
    row!.remove();
    setActiveTableCell(null);
    onMutation();
  }

  function tableAddCol(right: boolean) {
    if (!activeTableCell) return;
    const table = activeTableCell.closest('table') as HTMLTableElement | null;
    if (!table) return;
    const colIdx = activeTableCell.cellIndex;
    Array.from(table.rows).forEach((row, rowIdx) => {
      const cell = document.createElement(rowIdx === 0 ? 'th' : 'td');
      cell.style.cssText = CELL_STYLE;
      cell.innerHTML = ' ';
      const ref = row.cells[right ? colIdx + 1 : colIdx] ?? null;
      if (ref) row.insertBefore(cell, ref);
      else row.appendChild(cell);
    });
    onMutation();
  }

  function tableDeleteCol() {
    if (!activeTableCell) return;
    const table = activeTableCell.closest('table') as HTMLTableElement | null;
    if (!table) return;
    const colIdx = activeTableCell.cellIndex;
    if ((table.rows[0]?.cells.length ?? 0) <= 1) return;
    Array.from(table.rows).forEach(row => { if (row.cells[colIdx]) row.deleteCell(colIdx); });
    setActiveTableCell(null);
    onMutation();
  }

  function tableDeleteTable() {
    if (!activeTableCell) return;
    const table = activeTableCell.closest('table') as HTMLTableElement | null;
    if (!table) return;
    table.remove();
    setActiveTableCell(null);
    onMutation();
  }

  return { insertTable, tableAddRow, tableDeleteRow, tableAddCol, tableDeleteCol, tableDeleteTable };
}
