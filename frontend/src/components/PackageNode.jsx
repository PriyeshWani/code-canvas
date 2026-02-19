import React from 'react';
import { Handle, Position } from 'reactflow';

export default function PackageNode({ data }) {
  return (
    <div className="node-package">
      <Handle type="target" position={Position.Top} />
      <div className="node-type">📦 Package</div>
      <div className="node-header">{data.label}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
