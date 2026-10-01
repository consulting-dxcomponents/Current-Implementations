/**
 * EditorToolbar.tsx
 * The formatting toolbar rendered above the contentEditable editor.
 */
import type React from 'react';
import { Button, Input, Text } from '@pega/cosmos-react-core';
import { ToolbarBtn, Divider } from './ToolbarComponents';
import type { FormatState } from './useEditorInput';
import type { TableConfig } from './types';

interface Props {
  readOnly:        boolean;
  formatState:     FormatState;
  fontFamily:      string;
  fontSize:        string;
  textColor:       string;
  showFindReplace: boolean;
  showTableDialog: boolean;
  showComments:    boolean;
  tableConfig:     TableConfig;
  commentsCount:   number;
  imageInputRef:   React.RefObject<HTMLInputElement>;

  saveSelection:   () => void;
  exec:            (cmd: string, val?: string) => void;
  applyHeading:    (tag: string) => void;
  applyAlignment:  (align: string) => void;
  setFontFamily:   (v: string) => void;
  setFontSize:     (v: string) => void;
  setTextColor:    (v: string) => void;
  setShowFindReplace: React.Dispatch<React.SetStateAction<boolean>>;
  setShowTableDialog: React.Dispatch<React.SetStateAction<boolean>>;
  setShowComments: React.Dispatch<React.SetStateAction<boolean>>;
  setTableConfig:  React.Dispatch<React.SetStateAction<TableConfig>>;

  // Find & Replace panel
  findText:        string;
  replaceText:     string;
  setFindText:     (v: string) => void;
  setReplaceText:  (v: string) => void;
  handleFindReplace: () => void;

  // Table dialog
  insertTable:     () => void;

  // Table context toolbar (shown when a cell is selected)
  activeTableCell: HTMLTableCellElement | null;
  tableAddRow:     (below: boolean) => void;
  tableDeleteRow:  () => void;
  tableAddCol:     (right: boolean) => void;
  tableDeleteCol:  () => void;
  tableDeleteTable:() => void;
}

export function EditorToolbar({
  readOnly, formatState, fontFamily, fontSize, textColor,
  showFindReplace, showTableDialog, showComments, tableConfig, commentsCount,
  imageInputRef, saveSelection,
  exec, applyHeading, applyAlignment,
  setFontFamily, setFontSize, setTextColor,
  setShowFindReplace, setShowTableDialog, setShowComments, setTableConfig,
  findText, replaceText, setFindText, setReplaceText, handleFindReplace,
  insertTable, activeTableCell,
  tableAddRow, tableDeleteRow, tableAddCol, tableDeleteCol, tableDeleteTable,
}: Props) {
  return (
    <>
      {!readOnly && (
        <div onMouseDown={saveSelection}
          style={{ padding: '6px 10px', background: '#f5f5f5', borderBottom: '1px solid #e0e0e0', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>

          <select title='Heading style' onChange={e => applyHeading(e.target.value)} defaultValue='p'
            style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid #ccc', fontSize: '0.82rem' }}>
            <option value='p'>Normal</option>
            <option value='h1'>Heading 1</option>
            <option value='h2'>Heading 2</option>
            <option value='h3'>Heading 3</option>
          </select>

          <select title='Font family' value={fontFamily}
            onChange={e => { const v = e.target.value; if (v) { exec('fontName', v); setFontFamily(v); } }}
            style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid #ccc', fontSize: '0.82rem' }}>
            <option value=''>-- Font --</option>
            {['Georgia', 'Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Calibri'].map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>

          <select title='Font size' value={fontSize}
            onChange={e => { const v = e.target.value; if (v) { exec('fontSize', v); setFontSize(v); } }}
            style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid #ccc', fontSize: '0.82rem', width: 60 }}>
            <option value=''>--</option>
            {['1','2','3','4','5','6','7'].map((s, i) => (
              <option key={s} value={s}>{['10','12','14','16','18','24','36'][i]}pt</option>
            ))}
          </select>

          <label title='Text color' style={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
            <span style={{ fontSize: '0.82rem', color: '#555' }}>A</span>
            <input type='color' value={textColor}
              onChange={e => { setTextColor(e.target.value); exec('foreColor', e.target.value); }}
              style={{ width: 24, height: 24, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 4 }} />
          </label>

          <Divider />
          <ToolbarBtn title='Bold'          active={formatState.bold}          onClick={() => exec('bold')}><strong>B</strong></ToolbarBtn>
          <ToolbarBtn title='Italic'        active={formatState.italic}        onClick={() => exec('italic')}><em>I</em></ToolbarBtn>
          <ToolbarBtn title='Underline'     active={formatState.underline}     onClick={() => exec('underline')}><u>U</u></ToolbarBtn>
          <ToolbarBtn title='Strikethrough' active={formatState.strikeThrough} onClick={() => exec('strikeThrough')}><s>S</s></ToolbarBtn>
          <Divider />
          <ToolbarBtn title='Align left'   active={formatState.justifyLeft}   onClick={() => applyAlignment('left')}>⬅</ToolbarBtn>
          <ToolbarBtn title='Align center' active={formatState.justifyCenter} onClick={() => applyAlignment('center')}>↔</ToolbarBtn>
          <ToolbarBtn title='Align right'  active={formatState.justifyRight}  onClick={() => applyAlignment('right')}>➡</ToolbarBtn>
          <ToolbarBtn title='Justify'      active={formatState.justifyFull}   onClick={() => applyAlignment('justify')}>☰</ToolbarBtn>
          <Divider />
          <ToolbarBtn title='Bullet list'   active={formatState.insertUnorderedList} onClick={() => exec('insertUnorderedList')}>• List</ToolbarBtn>
          <ToolbarBtn title='Numbered list' active={formatState.insertOrderedList}   onClick={() => exec('insertOrderedList')}>1. List</ToolbarBtn>
          <Divider />
          <ToolbarBtn title='Insert table'    onClick={() => setShowTableDialog(t => !t)}>⊞ Table</ToolbarBtn>
          <ToolbarBtn title='Find & Replace'  active={showFindReplace} onClick={() => setShowFindReplace(f => !f)}>🔍 Find</ToolbarBtn>
          <ToolbarBtn title='Insert image'    onClick={() => imageInputRef.current?.click()}>🖼 Image</ToolbarBtn>
          <Divider />
          <ToolbarBtn title='Toggle comments panel' active={showComments} onClick={() => setShowComments(v => !v)}>
            💬 {commentsCount > 0 ? commentsCount : ''}
          </ToolbarBtn>
        </div>
      )}

      {/* Table insert dialog */}
      {showTableDialog && !readOnly && (
        <div style={{ padding: '8px 12px', background: '#fffde7', borderBottom: '1px solid #f9a825', display: 'flex', gap: 12, alignItems: 'center' }}>
          <Text as='span' style={{ fontSize: '0.85rem', fontWeight: 600 }}>Insert Table:</Text>
          <label style={{ fontSize: '0.82rem' }}>Rows:&nbsp;
            <input type='number' min={1} max={20} value={tableConfig.rows}
              onChange={e => setTableConfig(t => ({ ...t, rows: Number(e.target.value) }))}
              style={{ width: 50, padding: '2px 4px', border: '1px solid #ccc', borderRadius: 4 }} />
          </label>
          <label style={{ fontSize: '0.82rem' }}>Cols:&nbsp;
            <input type='number' min={1} max={10} value={tableConfig.cols}
              onChange={e => setTableConfig(t => ({ ...t, cols: Number(e.target.value) }))}
              style={{ width: 50, padding: '2px 4px', border: '1px solid #ccc', borderRadius: 4 }} />
          </label>
          <Button variant='primary' onClick={insertTable}>Insert</Button>
          <Button variant='secondary' onClick={() => setShowTableDialog(false)}>Cancel</Button>
        </div>
      )}

      {/* Find & Replace bar */}
      {showFindReplace && (
        <div style={{ padding: '8px 12px', background: '#e8f5e9', borderBottom: '1px solid #a5d6a7', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Input label='Find' value={findText} onChange={(e: any) => setFindText(e.target.value)} />
          <Input label='Replace with' value={replaceText} onChange={(e: any) => setReplaceText(e.target.value)} />
          <Button variant='primary' onClick={handleFindReplace} disabled={!findText}>Replace All</Button>
          <Button variant='secondary' onClick={() => { setShowFindReplace(false); setFindText(''); setReplaceText(''); }}>Close</Button>
        </div>
      )}

      {/* Table context toolbar */}
      {!readOnly && activeTableCell && (
        <div style={{ padding: '5px 10px', background: '#e8f5e9', borderBottom: '1px solid #a5d6a7', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem' }}>
          <span style={{ fontWeight: 600, color: '#2e7d32', marginRight: 4 }}>⊞ Table:</span>
          <ToolbarBtn title='Add row above'      onClick={() => tableAddRow(false)}>↑ Row</ToolbarBtn>
          <ToolbarBtn title='Add row below'      onClick={() => tableAddRow(true)}>↓ Row</ToolbarBtn>
          <ToolbarBtn title='Delete current row' onClick={tableDeleteRow}>✕ Row</ToolbarBtn>
          <Divider />
          <ToolbarBtn title='Add column left'      onClick={() => tableAddCol(false)}>← Col</ToolbarBtn>
          <ToolbarBtn title='Add column right'     onClick={() => tableAddCol(true)}>→ Col</ToolbarBtn>
          <ToolbarBtn title='Delete current column' onClick={tableDeleteCol}>✕ Col</ToolbarBtn>
          <Divider />
          <ToolbarBtn title='Delete entire table' onClick={tableDeleteTable}>🗑 Table</ToolbarBtn>
          <span style={{ marginLeft: 'auto', color: '#888', fontSize: '0.75rem' }}>Tab = next cell · Shift+Tab = prev cell</span>
        </div>
      )}
    </>
  );
}
