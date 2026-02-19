import React from 'react';
import { Handle, Position } from 'reactflow';

export default function ClassNode({ data }) {
  const isComponent = data.classType === 'component';
  
  return (
    <div style={{
      background: isComponent 
        ? 'linear-gradient(135deg, #8b5cf6, #a78bfa)' 
        : 'linear-gradient(135deg, #22c55e, #10b981)',
      borderRadius: '10px',
      padding: '14px 18px',
      minWidth: '160px',
      maxWidth: '240px',
      boxShadow: '0 6px 25px rgba(0,0,0,0.2)',
      border: '2px solid rgba(255,255,255,0.2)',
      cursor: 'pointer',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#fff' }} />
      <Handle type="target" position={Position.Left} style={{ background: '#fff' }} />
      
      <div style={{ 
        fontSize: '10px', 
        color: 'rgba(255,255,255,0.7)',
        textTransform: 'uppercase',
        marginBottom: '4px',
      }}>
        {isComponent ? '⚛️ Component' : '🏛️ Class'}
      </div>
      
      <div style={{ fontSize: '15px', fontWeight: 600, color: 'white', marginBottom: '6px' }}>
        {data.label}
      </div>
      
      {data.extends && (
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
          extends {data.extends}
        </div>
      )}
      
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        fontSize: '10px', 
        color: 'rgba(255,255,255,0.8)',
        borderTop: '1px solid rgba(255,255,255,0.2)',
        paddingTop: '6px',
        marginTop: '6px',
      }}>
        <span>⚙️ {data.methodCount || 0} methods</span>
        <span>📦 {data.propertyCount || 0} props</span>
      </div>
      
      {data.methods && data.methods.length > 0 && (
        <div style={{ 
          fontSize: '10px', 
          color: 'rgba(255,255,255,0.6)',
          marginTop: '6px',
        }}>
          {data.methods.slice(0, 3).map((m, i) => (
            <div key={i}>• {m}()</div>
          ))}
          {data.methods.length > 3 && <div>+{data.methods.length - 3} more</div>}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} style={{ background: '#fff' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#fff' }} />
    </div>
  );
}
