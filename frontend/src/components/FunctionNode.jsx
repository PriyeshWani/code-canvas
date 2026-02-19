import React from 'react';
import { Handle, Position } from 'reactflow';

export default function FunctionNode({ data }) {
  const icon = data.nodeType === 'method' ? '⚙️' : '🔧';
  
  return (
    <div className="node-function">
      <Handle type="target" position={Position.Top} />
      <div className="node-type">{icon} {data.nodeType || 'Function'}</div>
      <div className="node-header">{data.label}()</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
