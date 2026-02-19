import React from 'react';

const groupStyles = {
  frontend: {
    background: 'rgba(139, 92, 246, 0.08)',
    borderColor: 'rgba(139, 92, 246, 0.4)',
    label: 'Frontend',
    icon: '🖥️',
  },
  backend: {
    background: 'rgba(34, 197, 94, 0.08)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
    label: 'Backend',
    icon: '⚙️',
  },
  external: {
    background: 'rgba(6, 182, 212, 0.08)',
    borderColor: 'rgba(6, 182, 212, 0.4)',
    label: 'External',
    icon: '🌐',
  },
};

export default function GroupNode({ data }) {
  const style = groupStyles[data.groupType] || groupStyles.backend;
  
  return (
    <div style={{
      background: style.background,
      border: `2px dashed ${style.borderColor}`,
      borderRadius: '20px',
      padding: '20px',
      minWidth: data.width || 400,
      minHeight: data.height || 300,
    }}>
      <div style={{
        position: 'absolute',
        top: '-14px',
        left: '20px',
        background: '#0f172a',
        padding: '4px 12px',
        borderRadius: '8px',
        border: `1px solid ${style.borderColor}`,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <span style={{ fontSize: '14px' }}>{style.icon}</span>
        <span style={{ 
          fontSize: '12px', 
          fontWeight: 600, 
          color: style.borderColor,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {data.label || style.label}
        </span>
      </div>
    </div>
  );
}
