import React from 'react';
import { Handle, Position } from 'reactflow';

export default function PropertyNode({ data }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
      borderRadius: '8px',
      padding: '10px 14px',
      minWidth: '100px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
      border: '2px solid rgba(255,255,255,0.2)',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#fff' }} />
      
      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>
        📦 Property
      </div>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>
        {data.label}
      </div>
      
      <Handle type="source" position={Position.Bottom} style={{ background: '#fff' }} />
    </div>
  );
}
