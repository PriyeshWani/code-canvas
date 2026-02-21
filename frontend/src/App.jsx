import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';

import ArchitectureNode from './components/ArchitectureNode';
import SubSystemNode from './components/SubSystemNode';
import ClassNode from './components/ClassNode';
import ClassDetailNode from './components/ClassDetailNode';
import MethodNode from './components/MethodNode';
import PropertyNode from './components/PropertyNode';
import AnnotationNode from './components/AnnotationNode';
import GroupNode from './components/GroupNode';

const nodeTypes = {
  architecture: ArchitectureNode,
  subsystem: SubSystemNode,
  class: ClassNode,
  classDetail: ClassDetailNode,
  method: MethodNode,
  property: PropertyNode,
  annotation: AnnotationNode,
  group: GroupNode,
};

const LOD_LABELS = {
  4: { name: 'Architecture', desc: 'High-level system overview' },
  3: { name: 'Sub-systems', desc: 'Components within architecture' },
  2: { name: 'Classes', desc: 'Class diagrams with relationships' },
  1: { name: 'Details', desc: 'Class composition' },
  0: { name: 'Code', desc: 'Source code view' },
};

function autoLayout(nodes, lod = 4) {
  if (nodes.length === 0) return nodes;
  
  // If nodes already have positions (e.g., grouped LOD4), preserve them
  const hasPositions = nodes.some(n => n.position && (n.position.x !== undefined || n.position.y !== undefined));
  if (hasPositions) {
    return nodes;
  }
  
  // For LOD1 (class details), group by method category
  const classDetailNode = nodes.find(n => n.type === 'classDetail');
  if (classDetailNode) {
    return layoutClassDetails(nodes);
  }
  
  // Default grid layout for other LODs
  const cols = Math.ceil(Math.sqrt(nodes.length));
  return nodes.map((node, i) => ({
    ...node,
    position: {
      x: 100 + (i % cols) * 350,
      y: 100 + Math.floor(i / cols) * 250,
    },
  }));
}

// Smarter layout for class details (LOD1)
function layoutClassDetails(nodes) {
  const result = [];
  const classNode = nodes.find(n => n.type === 'classDetail');
  const methods = nodes.filter(n => n.type === 'method');
  const properties = nodes.filter(n => n.type === 'property');
  
  // Place class node on the left
  if (classNode) {
    result.push({
      ...classNode,
      position: { x: 50, y: 150 },
    });
  }
  
  // Group methods by prefix
  const groups = {
    lifecycle: [],    // constructor, init, setup
    core: [],         // analyze, build, generate, get
    detect: [],       // detect*
    parse: [],        // parse*
    extract: [],      // extract*
    is: [],           // is*, has*
    other: [],
  };
  
  methods.forEach(m => {
    const name = m.data.label.toLowerCase();
    if (['constructor', 'init', 'setup', 'initialize'].some(k => name.includes(k))) {
      groups.lifecycle.push(m);
    } else if (name.startsWith('detect')) {
      groups.detect.push(m);
    } else if (name.startsWith('parse')) {
      groups.parse.push(m);
    } else if (name.startsWith('extract')) {
      groups.extract.push(m);
    } else if (name.startsWith('is') || name.startsWith('has')) {
      groups.is.push(m);
    } else if (['analyze', 'build', 'generate', 'get', 'find', 'derive'].some(k => name.startsWith(k))) {
      groups.core.push(m);
    } else {
      groups.other.push(m);
    }
  });
  
  // Layout each group in columns
  let currentX = 350;
  const groupGap = 220;
  const itemGap = 70;
  const groupOrder = ['lifecycle', 'core', 'parse', 'extract', 'detect', 'is', 'other'];
  
  groupOrder.forEach(groupName => {
    const group = groups[groupName];
    if (group.length === 0) return;
    
    group.forEach((node, i) => {
      result.push({
        ...node,
        position: {
          x: currentX,
          y: 80 + i * itemGap,
        },
      });
    });
    
    currentX += groupGap;
  });
  
  // Place properties at the bottom
  properties.forEach((prop, i) => {
    result.push({
      ...prop,
      position: {
        x: 350 + i * 180,
        y: 80 + Math.max(methods.length * 0.3, 4) * itemGap + 100,
      },
    });
  });
  
  return result;
}

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [lod, setLod] = useState(4);
  const [path, setPath] = useState('/workspace');
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [focusedNode, setFocusedNode] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState({ code: '', name: '', filePath: '' });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [changeRequest, setChangeRequest] = useState('');
  const [notification, setNotification] = useState(null);
  
  // LLM Analysis state
  const [analysisMode, setAnalysisMode] = useState('semantic'); // 'semantic' or 'llm'
  const [llmProvider, setLlmProvider] = useState('relay');
  const [agentConnected, setAgentConnected] = useState(false);
  const [llmResult, setLlmResult] = useState(null);

  // WebSocket for real-time notifications
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}`);
    
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'request_submitted') {
          setNotification({ type: 'info', message: '📤 ' + msg.data.message });
          setTimeout(() => setNotification(null), 5000);
        } else if (msg.type === 'request_complete') {
          setNotification({ 
            type: msg.data.success ? 'success' : 'error', 
            message: '✅ ' + msg.data.message,
            action: 'refresh',
          });
        } else if (msg.type === 'agent_connected') {
          setAgentConnected(true);
          setNotification({ type: 'success', message: '🤖 Agent connected: ' + msg.agentId });
          setTimeout(() => setNotification(null), 3000);
        } else if (msg.type === 'agent_disconnected') {
          setAgentConnected(false);
          setNotification({ type: 'info', message: '🤖 Agent disconnected' });
          setTimeout(() => setNotification(null), 3000);
        } else if (msg.type === 'llm_analysis_started') {
          setNotification({ type: 'info', message: '🧠 LLM analyzing codebase...' });
        } else if (msg.type === 'llm_analysis_complete') {
          setNotification({ type: 'success', message: '✅ LLM analysis complete!' });
          setTimeout(() => setNotification(null), 3000);
        } else if (msg.type === 'init') {
          // Check if agent is already connected
          if (msg.data?.connectedAgents?.length > 0) {
            setAgentConnected(true);
          }
        }
      } catch (e) {}
    };
    
    // Fetch initial LLM config
    fetch('/api/llm/config').then(r => r.json()).then(data => {
      if (data.connectedAgents?.length > 0) setAgentConnected(true);
      if (data.provider) setLlmProvider(data.provider);
    }).catch(() => {});
    
    return () => ws.close();
  }, []);

  // Fetch nodes for current LOD
  const fetchNodes = useCallback(async (lodLevel, parentId = null, mode = null) => {
    const useMode = mode || analysisMode;
    try {
      const params = new URLSearchParams({ lod: lodLevel });
      if (parentId) params.append('parent', parentId);
      
      // Use LLM endpoint if in LLM mode
      const endpoint = useMode === 'llm' ? '/api/llm/nodes' : '/api/nodes';
      const res = await fetch(`${endpoint}?${params}`);
      const data = await res.json();
      
      if (data.error) {
        console.error(data.error);
        setNotification({ type: 'error', message: '❌ ' + data.error });
        setTimeout(() => setNotification(null), 5000);
        return;
      }
      
      // Handle code view (LOD 0)
      if (lodLevel === 0) {
        if (data.code) {
          setCode({
            code: data.code,
            name: data.className || 'Code',
            filePath: data.filePath || '',
          });
          setShowCode(true);
          setLod(0);
        } else {
          console.error('No code returned for LOD 0');
        }
        return;
      }
      
      setShowCode(false);
      const layoutedNodes = autoLayout(data.nodes);
      setNodes(layoutedNodes);
      setEdges(data.edges || []);
      setLod(lodLevel);
      setFocusedNode(parentId);
    } catch (err) {
      console.error('Failed to fetch nodes:', err);
      setNotification({ type: 'error', message: '❌ ' + err.message });
      setTimeout(() => setNotification(null), 5000);
    }
  }, [analysisMode]);

  // Analyze codebase
  const handleAnalyze = async () => {
    setLoading(true);
    try {
      if (analysisMode === 'llm') {
        // LLM Analysis
        const res = await fetch('/api/llm/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path }),
        });
        const data = await res.json();
        
        if (data.error) {
          setNotification({ type: 'error', message: '❌ ' + data.error });
          setTimeout(() => setNotification(null), 5000);
        } else if (data.success) {
          setAnalyzed(true);
          setLlmResult(data);
          setBreadcrumbs([{ lod: 4, label: data.name || 'Architecture', nodeId: null }]);
          // Fetch LLM nodes
          const nodesRes = await fetch('/api/llm/nodes?lod=4');
          const nodesData = await nodesRes.json();
          if (nodesData.nodes) {
            const layoutedNodes = autoLayout(nodesData.nodes);
            setNodes(layoutedNodes);
            setEdges(nodesData.edges || []);
          }
        }
      } else {
        // Semantic Analysis
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path }),
        });
        const data = await res.json();
        
        if (data.success) {
          setAnalyzed(true);
          setLlmResult(null);
          setBreadcrumbs([{ lod: 4, label: 'Architecture', nodeId: null }]);
          await fetchNodes(4);
        }
      }
    } catch (err) {
      console.error('Analysis failed:', err);
      setNotification({ type: 'error', message: '❌ Analysis failed: ' + err.message });
      setTimeout(() => setNotification(null), 5000);
    }
    setLoading(false);
  };

  // Zoom into a node (double-click)
  const handleNodeDoubleClick = useCallback(async (event, node) => {
    if (lod <= 0) return;
    if (!node.data.hasChildren && lod > 1) return;
    
    const newLod = lod - 1;
    
    // Update breadcrumbs
    setBreadcrumbs(prev => [
      ...prev,
      { lod: newLod, label: node.data.label, nodeId: node.id }
    ]);
    
    await fetchNodes(newLod, node.id);
  }, [lod, fetchNodes]);

  // Zoom out (go back)
  const handleZoomOut = useCallback(async () => {
    if (breadcrumbs.length <= 1) return;
    
    const newBreadcrumbs = breadcrumbs.slice(0, -1);
    const parent = newBreadcrumbs[newBreadcrumbs.length - 1];
    
    setBreadcrumbs(newBreadcrumbs);
    await fetchNodes(parent.lod, parent.nodeId);
  }, [breadcrumbs, fetchNodes]);

  // Navigate via breadcrumb
  const handleBreadcrumbClick = useCallback(async (index) => {
    if (index >= breadcrumbs.length - 1) return;
    
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    const target = newBreadcrumbs[newBreadcrumbs.length - 1];
    
    setBreadcrumbs(newBreadcrumbs);
    await fetchNodes(target.lod, target.nodeId);
  }, [breadcrumbs, fetchNodes]);

  // Handle node click (select for sidebar)
  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
    setSidebarOpen(true);
  }, []);

  // View code for selected node
  const handleViewCode = useCallback(async () => {
    if (!selectedNode) return;
    
    try {
      const res = await fetch(`/api/code?nodeId=${selectedNode.id}`);
      const data = await res.json();
      
      if (data.code) {
        setCode({
          code: data.code,
          name: data.name,
          filePath: data.filePath,
        });
        setShowCode(true);
      }
    } catch (err) {
      console.error('Failed to fetch code:', err);
    }
  }, [selectedNode]);

  // Add annotation node for change requests
  const handleAddAnnotation = useCallback(() => {
    const newAnnotation = {
      id: `annotation_${Date.now()}`,
      type: 'annotation',
      position: { x: 50 + Math.random() * 100, y: 50 + Math.random() * 100 },
      data: { 
        text: '',
        onUpdate: (id, text) => {
          setNodes(nds => nds.map(n => 
            n.id === id ? { ...n, data: { ...n.data, text } } : n
          ));
        }
      },
      draggable: true,
    };
    
    setNodes(nds => [...nds, newAnnotation]);
  }, []);

  // Generate prompt for a specific node with change request
  const handleGeneratePromptForNode = useCallback(async (node) => {
    if (!changeRequest.trim()) return;
    
    let codeContext = '';
    let relatedContext = '';
    
    // Get code for the selected node
    try {
      const res = await fetch(`/api/code?nodeId=${node.id}`);
      const data = await res.json();
      if (data.code) {
        codeContext = `### ${data.name} (${data.filePath})\n\`\`\`javascript\n${data.code}\n\`\`\``;
      }
    } catch (e) {
      console.error('Failed to fetch code:', e);
    }
    
    // Get related nodes based on LOD level for context
    const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
    const relatedNodeIds = connectedEdges.map(e => e.source === node.id ? e.target : e.source);
    const relatedNodes = nodes.filter(n => relatedNodeIds.includes(n.id));
    
    if (relatedNodes.length > 0 && lod >= 2) {
      relatedContext = '\n## Related Components\n';
      for (const rn of relatedNodes.slice(0, 5)) {
        try {
          const res = await fetch(`/api/code?nodeId=${rn.id}`);
          const data = await res.json();
          if (data.code) {
            // Include abbreviated context for related nodes
            relatedContext += `\n### ${data.name} (${data.filePath})\n\`\`\`javascript\n${data.code.slice(0, 1500)}${data.code.length > 1500 ? '\n// ... truncated' : ''}\n\`\`\`\n`;
          }
        } catch (e) {
          // Ignore
        }
      }
    }
    
    // Build breadcrumb context
    const pathContext = breadcrumbs.map(b => b.label).join(' → ');
    
    // Build the prompt
    const prompt = `# Code Change Request

## Navigation Context
**Path:** ${pathContext}
**LOD Level:** ${lod} (${LOD_LABELS[lod]?.name} - ${LOD_LABELS[lod]?.desc})

## Target Component
**Name:** ${node.data?.label}
**Type:** ${node.type}
${node.data?.description ? `**Description:** ${node.data.description}` : ''}

## Change Request
${changeRequest}

## Current Code
${codeContext || 'No code available for this node type.'}
${relatedContext}

## Instructions
Please implement the requested changes to the target component. Consider:
1. The component's role within the ${LOD_LABELS[lod]?.name} level
2. Connections to related components shown above
3. Maintain consistency with existing code style
4. Provide complete, working code

Return the modified code with clear explanations of what was changed and why.`;

    setGeneratedPrompt(prompt);
    setShowPromptModal(true);
  }, [changeRequest, edges, nodes, lod, breadcrumbs]);

  // Generate prompt from annotations (legacy)
  const handleGeneratePrompt = useCallback(async () => {
    // Find all annotation nodes
    const annotations = nodes.filter(n => n.type === 'annotation' && n.data.text);
    
    if (annotations.length === 0) {
      alert('Add at least one annotation with a change request first.');
      return;
    }
    
    // Build context from connected nodes
    const changeRequests = [];
    
    for (const ann of annotations) {
      // Find edges from this annotation
      const connectedEdges = edges.filter(e => e.source === ann.id || e.target === ann.id);
      const connectedNodeIds = connectedEdges.map(e => e.source === ann.id ? e.target : e.source);
      const connectedNodes = nodes.filter(n => connectedNodeIds.includes(n.id));
      
      // Get code for connected nodes
      let codeContext = '';
      for (const node of connectedNodes) {
        try {
          const res = await fetch(`/api/code?nodeId=${node.id}`);
          const data = await res.json();
          if (data.code) {
            codeContext += `\n### ${data.name} (${data.filePath})\n\`\`\`\n${data.code.slice(0, 3000)}\n\`\`\`\n`;
          }
        } catch (e) {
          // Ignore errors
        }
      }
      
      changeRequests.push({
        request: ann.data.text,
        targets: connectedNodes.map(n => n.data.label).join(', ') || 'General',
        code: codeContext,
      });
    }
    
    // Format the prompt
    const prompt = `# Code Change Request

## Context
Analyzing codebase at LOD ${lod} (${LOD_LABELS[lod]?.name})

## Change Requests

${changeRequests.map((cr, i) => `### Request ${i + 1}: ${cr.targets}
**Change:** ${cr.request}
${cr.code}
`).join('\n')}

## Instructions
Please implement the requested changes. Provide complete, working code that addresses each change request.`;

    // Show the prompt in a modal or copy to clipboard
    setGeneratedPrompt(prompt);
    setShowPromptModal(true);
  }, [nodes, edges, lod]);

  // Handle connection
  const onConnect = useCallback((params) => {
    setEdges(eds => addEdge({
      ...params,
      type: 'smoothstep',
      animated: true,
    }, eds));
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div className="toolbar">
        <h1>📐 Code Canvas</h1>
        
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="Path to analyze..."
          style={{ width: '200px' }}
        />
        
        {/* Analysis Mode Toggle */}
        <div className="mode-toggle" style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#1e1e3f', borderRadius: '8px', padding: '4px' }}>
          <button 
            onClick={() => setAnalysisMode('semantic')}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              background: analysisMode === 'semantic' ? '#4f46e5' : 'transparent',
              color: analysisMode === 'semantic' ? 'white' : '#888',
            }}
          >
            🔬 Semantic
          </button>
          <button 
            onClick={() => setAnalysisMode('llm')}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              background: analysisMode === 'llm' ? '#4f46e5' : 'transparent',
              color: analysisMode === 'llm' ? 'white' : '#888',
            }}
          >
            🧠 LLM {agentConnected && '●'}
          </button>
        </div>
        
        <button onClick={handleAnalyze} disabled={loading}>
          {loading ? '⏳ Analyzing...' : '🔍 Analyze'}
        </button>
        
        {analyzed && (
          <>
            <div className="lod-indicator">
              <span className="lod-badge">LOD {lod}</span>
              <span className="lod-name">{LOD_LABELS[lod]?.name}</span>
            </div>
            
            <button 
              onClick={handleZoomOut} 
              disabled={breadcrumbs.length <= 1}
              className="secondary"
            >
              ⬆️ Zoom Out
            </button>
            
            {showCode && (
              <button onClick={() => setShowCode(false)} className="secondary">
                📊 Show Diagram
              </button>
            )}
            
{/* Annotation moved to sidebar */}
          </>
        )}
        
        <button 
          className="secondary" 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{ marginLeft: 'auto' }}
        >
          {sidebarOpen ? '✕' : '📝'} Panel
        </button>
      </div>

      {/* Breadcrumbs */}
      {analyzed && breadcrumbs.length > 0 && (
        <div className="breadcrumbs">
          {breadcrumbs.map((crumb, i) => (
            <span key={i}>
              <button 
                onClick={() => handleBreadcrumbClick(i)}
                className={i === breadcrumbs.length - 1 ? 'active' : ''}
              >
                {crumb.label}
              </button>
              {i < breadcrumbs.length - 1 && <span className="separator">›</span>}
            </span>
          ))}
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex' }}>
        {/* Canvas or Code view */}
        {showCode ? (
          <div className="code-view">
            <div className="code-header">
              <button 
                onClick={() => setShowCode(false)} 
                style={{
                  background: '#4f46e5',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginRight: '15px',
                  fontSize: '14px',
                }}
              >
                ← Back to Diagram
              </button>
              <span className="code-filename">{code.name}</span>
              <span className="code-path">{code.filePath}</span>
            </div>
            <pre className="code-content">
              <code>{code.code}</code>
            </pre>
          </div>
        ) : (
          <div className="canvas-container">
            {!analyzed ? (
              <div className="empty-state">
                <h2>📐 Code Canvas</h2>
                <p>Visualize your codebase architecture</p>
                <p style={{ color: '#666', fontSize: '14px', marginTop: '20px' }}>
                  Enter a path and click Analyze to begin
                </p>
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onNodeDoubleClick={handleNodeDoubleClick}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.2}
                maxZoom={2}
              >
                <Background color="#2a2a4a" gap={20} />
                <Controls />
              </ReactFlow>
            )}
          </div>
        )}

        {/* Sidebar */}
        <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <h2>Details</h2>
          
          {selectedNode ? (
            <div className="sidebar-section">
              <h3>{selectedNode.data?.label}</h3>
              <p className="node-type">Type: {selectedNode.type}</p>
              
              {selectedNode.data?.description && (
                <p className="node-desc">{selectedNode.data.description}</p>
              )}
              
              {selectedNode.data?.tech && selectedNode.data.tech.length > 0 && (
                <div className="tech-tags">
                  {selectedNode.data.tech.map((t, i) => (
                    <span key={i} className="tech-tag">{t}</span>
                  ))}
                </div>
              )}
              
              {selectedNode.data?.methods && (
                <div className="methods-list">
                  <h4>Methods ({selectedNode.data.methods.length})</h4>
                  <ul>
                    {selectedNode.data.methods.slice(0, 10).map((m, i) => (
                      <li key={i}>{m}()</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {selectedNode.data?.hasChildren !== false && lod > 0 && (
                <button onClick={() => handleNodeDoubleClick(null, selectedNode)}>
                  🔍 Zoom In
                </button>
              )}
              
              {(selectedNode.type === 'class' || selectedNode.type === 'classDetail') && (
                <button onClick={handleViewCode} className="secondary">
                  📄 View Code
                </button>
              )}
              
              {/* Change Request Section */}
              <div className="change-request-section">
                <h4>💬 Change Request</h4>
                <textarea
                  value={changeRequest}
                  onChange={(e) => setChangeRequest(e.target.value)}
                  placeholder="Describe what changes you want to make to this component..."
                  rows={4}
                />
                <button 
                  onClick={() => handleGeneratePromptForNode(selectedNode)}
                  disabled={!changeRequest.trim()}
                  style={{ background: '#22c55e', marginTop: '10px' }}
                >
                  🚀 Generate Prompt
                </button>
              </div>
            </div>
          ) : (
            <p className="no-selection">Click a node to see details</p>
          )}
          
          <div className="sidebar-section">
            <h3>LOD Guide</h3>
            <ul className="lod-guide">
              {Object.entries(LOD_LABELS).reverse().map(([l, info]) => (
                <li key={l} className={parseInt(l) === lod ? 'active' : ''}>
                  <strong>LOD {l}</strong>: {info.name}
                  <span>{info.desc}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="sidebar-section">
            <h3>Navigation</h3>
            <ul className="nav-tips">
              <li>🖱️ <strong>Double-click</strong> to zoom into a node</li>
              <li>⬆️ <strong>Zoom Out</strong> button to go back</li>
              <li>🔗 <strong>Drag</strong> between handles to connect</li>
              <li>📄 <strong>View Code</strong> on classes</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="status-bar">
        <div className="status-item">
          <span className={`status-dot ${analyzed ? '' : 'disconnected'}`}></span>
          {analyzed ? 'Analyzed' : 'Not analyzed'}
        </div>
        <div className="status-item">
          LOD: {LOD_LABELS[lod]?.name}
        </div>
        <div className="status-item">
          Nodes: {nodes.length}
        </div>
        {focusedNode && (
          <div className="status-item">
            Focus: {focusedNode}
          </div>
        )}
      </div>

      {loading && (
        <div className="loading">
          <div className="loading-spinner"></div>
        </div>
      )}

      {/* Notification toast */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          <span>{notification.message}</span>
          {notification.action === 'refresh' && (
            <button onClick={() => window.location.reload()}>
              🔄 Refresh
            </button>
          )}
          <button onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      {/* Prompt Modal */}
      {showPromptModal && (
        <div className="modal-overlay" onClick={() => setShowPromptModal(false)}>
          <div className="prompt-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🚀 Generated Prompt</h2>
              <button onClick={() => setShowPromptModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <textarea 
                value={generatedPrompt}
                readOnly
                rows={20}
              />
            </div>
            <div className="modal-actions">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(generatedPrompt);
                  alert('Copied to clipboard!');
                }}
                className="primary"
              >
                📋 Copy to Clipboard
              </button>
              <button 
                onClick={async () => {
                  // Send to backend for processing
                  try {
                    const res = await fetch('/api/process-prompt', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ prompt: generatedPrompt }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      alert('Prompt sent for processing! Check your agent for results.');
                    }
                  } catch (e) {
                    console.error(e);
                    alert('Copy the prompt and paste it to your AI assistant.');
                  }
                  setShowPromptModal(false);
                }}
                className="secondary"
              >
                🤖 Send to Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
