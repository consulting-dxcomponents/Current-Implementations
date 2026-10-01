/**
 * ToolbarComponents.tsx
 * Small, memoised UI primitives used by the editor toolbar.
 */
import { memo } from 'react';

export const ToolbarBtn = memo(function ToolbarBtn({
  title, active, onClick, children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        padding: '4px 8px',
        border: '1px solid',
        borderColor: active ? '#1565c0' : '#ccc',
        borderRadius: 4,
        background: active ? '#e3f2fd' : '#fff',
        color: active ? '#1565c0' : '#333',
        cursor: 'pointer',
        fontWeight: active ? 700 : 400,
        fontSize: '0.82rem',
        lineHeight: 1.4,
        minWidth: 28,
      }}
    >
      {children}
    </button>
  );
});

export const Divider = memo(function Divider() {
  return <span style={{ width: 1, background: '#ddd', alignSelf: 'stretch', margin: '0 4px' }} />;
});
