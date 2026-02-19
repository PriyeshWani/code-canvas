import React from 'react';
import { Handle, Position } from 'reactflow';

const typeColors = {
  ui: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  api: 'linear-gradient(135deg, #22c55e, #10b981)',
  data: 'linear-gradient(135deg, #f59e0b, #ef4444)',
  integration: 'linear-gradient(135deg, #06b6d4, #0ea5e9)',
  realtime: 'linear-gradient(135deg, #ec4899, #f43f5e)',
  core: 'linear-gradient(135deg, #6b7280, #4b5563)',
};

export default function ArchitectureNode({ data }) {
  const bgColor = typeColors[data.compType] || typeColors.core;
  
  return (
    <div style={{
      background: bgColor,
      borderRadius: '16px',
      padding: '20px 25px',
      minWidth: '220px',
      maxWidth: '300px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
      border: data.isContext ? '3px solid #fbbf24' : '2px solid rgba(255,255,255,0.2)',
      cursor: data.hasChildren ? 'pointer' : 'default',
      opacity: data.isContext ? 0.7 : 1,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#fff' }} />
      <Handle type="target" position={Position.Left} style={{ background: '#fff' }} />
      
      <div style={{ fontSize: '36px', marginBottom: '10px' }}>{data.icon}</div>
      <div style={{ 
        fontSize: '18px', 
        fontWeight: 700, 
        color: 'white',
        marginBottom: '6px',
      }}>
        {data.label}
      </div>
      
      {data.description && (
        <div style={{ 
          fontSize: '12px', 
          color: 'rgba(255,255,255,0.8)',
          marginBottom: '10px',
        }}>
          {data.description}
        </div>
      )}
      
      {data.tech && data.tech.length > 0 && (
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '5px',
          marginBottom: '10px',
        }}>
          {data.tech.map((t, i) => (
            <span key={i} style={{
              background: 'rgba(0,0,0,0.3)',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.9)',
            }}>{t}</span>
          ))}
        </div>
      )}
      
      {data.capabilities && data.capabilities.length > 0 && (
        <div style={{ 
          fontSize: '11px', 
          color: 'rgba(255,255,255,0.7)',
          marginBottom: '8px',
        }}>
          {data.capabilities.slice(0, 4).map((c, i) => (
            <span key={i} style={{ marginRight: '8px' }}>• {c}</span>
          ))}
        </div>
      )}
      
      <div style={{ 
        fontSize: '10px', 
        color: 'rgba(255,255,255,0.5)',
        marginTop: '10px',
        borderTop: '1px solid rgba(255,255,255,0.2)',
        paddingTop: '8px',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>📄 {data.fileCount} files</span>
        {data.hasChildren && <span>🔍 Double-click to explore</span>}
      </div>
      
      <Handle type="source" position={Position.Bottom} style={{ background: '#fff' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#fff' }} />
    </div>
  );
}
