import React from 'react';
import { Handle, Position } from 'reactflow';

export default function ModuleNode({ data }) {
  return (
    <div className="node-module">
      <Handle type="target" position={Position.Top} />
      <div className="node-type">📄 Module</div>
      <div className="node-header">{data.label}</div>
      {data.path && (
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
          {data.path}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
