import React from 'react';
import { Handle, Position } from 'reactflow';

export default function ClassDetailNode({ data }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #22c55e, #059669)',
      borderRadius: '12px',
      padding: '18px 22px',
      minWidth: '250px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
      border: '2px solid rgba(255,255,255,0.3)',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#fff' }} />
      
      <div style={{ 
        fontSize: '11px', 
        color: 'rgba(255,255,255,0.7)',
        textTransform: 'uppercase',
        marginBottom: '6px',
      }}>
        {data.classType === 'component' ? '⚛️ Component' : '🏛️ Class'} Details
      </div>
      
      <div style={{ fontSize: '20px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
        {data.label}
      </div>
      
      {data.extends && (
        <div style={{ 
          fontSize: '12px', 
          color: 'rgba(255,255,255,0.8)',
          marginBottom: '10px',
          padding: '4px 8px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '4px',
          display: 'inline-block',
        }}>
          extends <strong>{data.extends}</strong>
        </div>
      )}
      
      <div style={{
        marginTop: '12px',
        padding: '10px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '8px',
      }}>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
          METHODS ({data.methods?.length || 0})
        </div>
        {data.methods?.map((m, i) => (
          <div key={i} style={{ 
            fontSize: '12px', 
            color: 'white',
            padding: '3px 0',
          }}>
            ⚙️ {m}()
          </div>
        ))}
      </div>
      
      <div style={{
        marginTop: '10px',
        padding: '10px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '8px',
      }}>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
          PROPERTIES ({data.properties?.length || 0})
        </div>
        {data.properties?.map((p, i) => (
          <div key={i} style={{ 
            fontSize: '12px', 
            color: 'white',
            padding: '3px 0',
          }}>
            📦 {p}
          </div>
        ))}
      </div>
      
      <Handle type="source" position={Position.Bottom} style={{ background: '#fff' }} />
    </div>
  );
}
