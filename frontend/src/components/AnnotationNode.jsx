import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';

export default function AnnotationNode({ id, data, selected }) {
  const [isEditing, setIsEditing] = useState(!data.text);
  const [text, setText] = useState(data.text || '');

  const handleSave = () => {
    if (text.trim()) {
      data.text = text;
      data.onUpdate?.(id, text);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  return (
    <div className={`annotation-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} style={{ background: '#f59e0b' }} />
      
      <div className="annotation-header">
        <span className="annotation-icon">📝</span>
        <span className="annotation-label">Change Request</span>
        {data.targetNode && (
          <span className="annotation-target">→ {data.targetNode}</span>
        )}
      </div>
      
      {isEditing ? (
        <div className="annotation-editor">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what changes you want..."
            autoFocus
            rows={3}
          />
          <div className="annotation-actions">
            <button onClick={handleSave} className="save-btn">Save</button>
            <button onClick={() => setIsEditing(false)} className="cancel-btn">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="annotation-content" onDoubleClick={() => setIsEditing(true)}>
          <p>{data.text || 'Double-click to edit...'}</p>
          <div className="annotation-hint">
            Wire to a node, then use "Generate Prompt"
          </div>
        </div>
      )}
      
      <Handle type="source" position={Position.Right} style={{ background: '#f59e0b' }} />
    </div>
  );
}
