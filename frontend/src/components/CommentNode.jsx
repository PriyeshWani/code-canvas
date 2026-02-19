import React from 'react';
import { Handle, Position } from 'reactflow';

export default function CommentNode({ data }) {
  return (
    <div className="comment-node">
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 600, marginBottom: '5px' }}>💬 Comment</div>
      <div>{data.text}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
