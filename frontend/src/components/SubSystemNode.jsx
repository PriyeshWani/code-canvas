import React from 'react';
import { Handle, Position } from 'reactflow';

export default function SubSystemNode({ data }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
      borderRadius: '12px',
      padding: '16px 20px',
      minWidth: '200px',
      maxWidth: '280px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
      border: '2px solid rgba(255,255,255,0.2)',
      cursor: data.hasChildren ? 'pointer' : 'default',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#fff' }} />
      
      <div style={{ fontSize: '24px', marginBottom: '6px' }}>{data.icon}</div>
      <div style={{ fontSize: '16px', fontWeight: 600, color: 'white', marginBottom: '4px' }}>
        {data.label}
      </div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
        {data.description}
      </div>
      
      {data.features && data.features.length > 0 && (
        <div style={{
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '6px',
          padding: '8px',
          marginBottom: '8px',
        }}>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
            CONTAINS:
          </div>
          {data.features.slice(0, 5).map((f, i) => (
            <div key={i} style={{ 
              fontSize: '10px', 
              color: 'rgba(255,255,255,0.85)',
              padding: '2px 0',
            }}>
              • {f}
            </div>
          ))}
          {data.features.length > 5 && (
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
              +{data.features.length - 5} more
            </div>
          )}
        </div>
      )}
      
      <div style={{ 
        fontSize: '10px', 
        color: 'rgba(255,255,255,0.5)', 
        borderTop: '1px solid rgba(255,255,255,0.2)',
        paddingTop: '6px',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>📄 {data.fileCount} files</span>
        {data.hasChildren && <span>🔍 Explore</span>}
      </div>
      
      <Handle type="source" position={Position.Bottom} style={{ background: '#fff' }} />
    </div>
  );
}
