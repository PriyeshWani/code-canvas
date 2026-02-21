/**
 * Code Canvas API Server v2
 * Semantic analysis with gamified LOD zoom
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { SemanticAnalyzer } = require('../analyzer/semantic');
const { LLMAnalyzer } = require('../analyzer/llm-analyzer');

const PORT = process.env.PORT || 3002;
const FRONTEND_DIR = path.join(__dirname, '../../frontend/dist');

// Store
const store = {
  analyzer: null,
  llmAnalyzer: null,
  analysis: null,
  currentLod: 4,
  focusedNode: null,  // For zoom-based navigation
  comments: [],
  customConnections: [],
  analysisMode: 'semantic', // 'semantic' or 'llm'
  llmConfig: {
    provider: 'relay',  // 'anthropic', 'openai', 'google', 'ollama', 'relay'
    apiKey: null,
    baseUrl: null,
    model: null,
  },
};

// Agent relay connections (for Option C)
const agentRelays = new Map(); // ws -> { id, pendingPrompts: Map<promptId, callback> }
let promptIdCounter = 0;

// WebSocket clients
const clients = new Set();

function broadcast(message) {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === 1) client.send(data);
  }
}

// MIME types
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

async function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } 
      catch (e) { resolve({}); }
    });
  });
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // Health check
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', service: 'code-canvas-v2' }));
  }

  // Get/Set LLM config
  if (pathname === '/api/llm/config' && req.method === 'GET') {
    const agents = Array.from(agentRelays.values()).map(a => a.id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      provider: store.llmConfig.provider,
      hasApiKey: !!store.llmConfig.apiKey,
      baseUrl: store.llmConfig.baseUrl,
      model: store.llmConfig.model,
      connectedAgents: agents,
    }));
  }

  if (pathname === '/api/llm/config' && req.method === 'POST') {
    const body = await parseBody(req);
    if (body.provider) store.llmConfig.provider = body.provider;
    if (body.apiKey !== undefined) store.llmConfig.apiKey = body.apiKey;
    if (body.baseUrl !== undefined) store.llmConfig.baseUrl = body.baseUrl;
    if (body.model !== undefined) store.llmConfig.model = body.model;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, provider: store.llmConfig.provider }));
  }

  // LLM-based analysis
  if (pathname === '/api/llm/analyze' && req.method === 'POST') {
    const body = await parseBody(req);
    const targetPath = body.path || '/workspace';
    
    // Check if relay mode and no agent connected
    if (store.llmConfig.provider === 'relay' && agentRelays.size === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ 
        error: 'No agent connected. Connect your coding agent via WebSocket first.',
        hint: 'Use the agent relay script or configure an API provider.',
      }));
    }
    
    try {
      broadcast({ type: 'llm_analysis_started', data: { path: targetPath } });
      
      // Create relay callback if using relay mode
      const relayCallback = store.llmConfig.provider === 'relay' 
        ? (prompt, cb) => sendToRelay(prompt, cb)
        : null;
      
      store.llmAnalyzer = new LLMAnalyzer(targetPath, {
        provider: store.llmConfig.provider,
        apiKey: store.llmConfig.apiKey,
        baseUrl: store.llmConfig.baseUrl,
        model: store.llmConfig.model,
        relayCallback,
      });
      
      const analysis = await store.llmAnalyzer.analyze();
      store.analysis = analysis;
      store.analysisMode = 'llm';
      store.currentLod = 4;
      store.focusedNode = null;
      
      // Also create a semantic analyzer for LOD navigation
      store.analyzer = new SemanticAnalyzer(targetPath);
      store.analyzer.scanFiles();
      
      broadcast({ type: 'llm_analysis_complete', data: { 
        components: analysis.components?.length || 0,
        pattern: analysis.pattern,
      }});
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        mode: 'llm',
        name: analysis.name,
        description: analysis.description,
        pattern: analysis.pattern,
        components: analysis.components?.length || 0,
      }));
    } catch (err) {
      console.error('LLM Analysis error:', err);
      broadcast({ type: 'llm_analysis_error', data: { error: err.message } });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // Get LLM nodes (uses LLM analysis results)
  if (pathname === '/api/llm/nodes' && req.method === 'GET') {
    const lod = parseInt(url.searchParams.get('lod') || '4');
    const parentId = url.searchParams.get('parent') || null;
    
    if (!store.llmAnalyzer) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'No LLM analysis. Call /api/llm/analyze first.' }));
    }
    
    try {
      // For LOD < 4, we need to make additional LLM calls
      const result = await store.llmAnalyzer.getNodesForLOD(lod, parentId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(result));
    } catch (err) {
      console.error('LLM nodes error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // Analyze codebase (semantic)
  if (pathname === '/api/analyze' && req.method === 'POST') {
    const body = await parseBody(req);
    const targetPath = body.path || '/workspace';
    
    try {
      store.analyzer = new SemanticAnalyzer(targetPath);
      store.analysis = store.analyzer.analyze();
      store.currentLod = 4;
      store.focusedNode = null;
      
      broadcast({ type: 'analysis_complete', data: { fileCount: store.analysis.fileCount } });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ 
        success: true,
        fileCount: store.analysis.fileCount,
        components: store.analysis.architecture.components.length,
        classes: store.analysis.architecture.classes.length,
      }));
    } catch (err) {
      console.error('Analysis error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // Get nodes for LOD level (with optional parent for zoom)
  if (pathname === '/api/nodes' && req.method === 'GET') {
    const lod = parseInt(url.searchParams.get('lod') || '4');
    const parentId = url.searchParams.get('parent') || null;
    
    if (!store.analyzer) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'No analysis. Call /api/analyze first.' }));
    }
    
    const result = store.analyzer.getNodesForLOD(lod, parentId);
    store.currentLod = lod;
    store.focusedNode = parentId;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(result));
  }

  // Zoom into a node (go to next LOD level focused on this node)
  if (pathname === '/api/zoom-in' && req.method === 'POST') {
    const body = await parseBody(req);
    const nodeId = body.nodeId;
    
    if (!store.analyzer || store.currentLod <= 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Cannot zoom further' }));
    }
    
    const newLod = store.currentLod - 1;
    const result = store.analyzer.getNodesForLOD(newLod, nodeId);
    store.currentLod = newLod;
    store.focusedNode = nodeId;
    
    broadcast({ type: 'lod_change', data: { lod: newLod, focusedNode: nodeId } });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ...result, lod: newLod }));
  }

  // Zoom out (go to previous LOD level)
  if (pathname === '/api/zoom-out' && req.method === 'POST') {
    if (!store.analyzer || store.currentLod >= 4) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Cannot zoom out further' }));
    }
    
    const newLod = store.currentLod + 1;
    const result = store.analyzer.getNodesForLOD(newLod, null);
    store.currentLod = newLod;
    store.focusedNode = null;
    
    broadcast({ type: 'lod_change', data: { lod: newLod, focusedNode: null } });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ...result, lod: newLod }));
  }

  // Get code for a specific node
  if (pathname === '/api/code' && req.method === 'GET') {
    const nodeId = url.searchParams.get('nodeId');
    
    if (!store.analyzer) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'No analysis' }));
    }
    
    const code = store.analyzer.getCode(nodeId);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(code || { error: 'Code not found' }));
  }

  // Process prompt - send to Clawdbot agent
  if (pathname === '/api/process-prompt' && req.method === 'POST') {
    const body = await parseBody(req);
    const prompt = body.prompt;
    
    if (!prompt) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'No prompt provided' }));
    }
    
    try {
      // Write prompt to shared directory for persistence
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const promptDir = '/app/requests';
      if (!fs.existsSync(promptDir)) fs.mkdirSync(promptDir, { recursive: true });
      const promptFile = path.join(promptDir, `change-request-${timestamp}.md`);
      fs.writeFileSync(promptFile, prompt);
      console.log(`Saved change request to: ${promptFile}`);
      
      // Try to notify Clawdbot gateway
      const gatewayUrl = process.env.CLAWDBOT_GATEWAY || 'http://host.docker.internal:4440';
      const http = require('http');
      
      const notifyData = JSON.stringify({
        type: 'code_canvas_request',
        prompt: prompt,
        file: promptFile,
      });
      
      // Make async request to gateway (don't wait for response)
      const notifyReq = http.request(`${gatewayUrl}/api/wake`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': notifyData.length,
        },
        timeout: 5000,
      }, (notifyRes) => {
        console.log(`Gateway notified: ${notifyRes.statusCode}`);
      });
      
      notifyReq.on('error', (e) => {
        console.log(`Gateway notification failed (will use file): ${e.message}`);
      });
      
      notifyReq.write(notifyData);
      notifyReq.end();
      
      // Broadcast to connected clients that request was submitted
      broadcast({ 
        type: 'request_submitted', 
        data: { 
          message: 'Change request sent to agent!',
          file: promptFile,
          timestamp: new Date().toISOString(),
        }
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ 
        success: true, 
        message: 'Change request submitted',
        file: promptFile,
      }));
    } catch (err) {
      console.error('Process prompt error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // Agent completion notification (called by Clawdbot when done)
  if (pathname === '/api/request-complete' && req.method === 'POST') {
    const body = await parseBody(req);
    
    broadcast({ 
      type: 'request_complete', 
      data: { 
        message: body.message || 'Changes complete! Refresh to see updates.',
        success: body.success !== false,
      }
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  }

  // Get current state
  if (pathname === '/api/state' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      analyzed: !!store.analyzer,
      lod: store.currentLod,
      focusedNode: store.focusedNode,
      fileCount: store.analysis?.fileCount || 0,
    }));
  }

  // Add comment
  if (pathname === '/api/comments' && req.method === 'POST') {
    const body = await parseBody(req);
    const comment = {
      id: `comment_${Date.now()}`,
      nodeId: body.nodeId,
      text: body.text,
      position: body.position || { x: 0, y: 0 },
    };
    store.comments.push(comment);
    broadcast({ type: 'comment_added', data: comment });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(comment));
  }

  // Add custom connection
  if (pathname === '/api/connections' && req.method === 'POST') {
    const body = await parseBody(req);
    const conn = {
      id: `conn_${Date.now()}`,
      source: body.source,
      target: body.target,
      label: body.label || '',
    };
    store.customConnections.push(conn);
    broadcast({ type: 'connection_added', data: conn });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(conn));
  }

  // Generate Claude prompt
  if (pathname === '/api/generate-prompt' && req.method === 'POST') {
    const prompt = generatePrompt();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ prompt }));
  }

  // Serve frontend
  let filePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.join(FRONTEND_DIR, filePath);
  
  try {
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch (e) {}
  
  const absPath = path.join(FRONTEND_DIR, filePath);
  const ext = path.extname(absPath);
  
  fs.readFile(absPath, (err, data) => {
    if (err) {
      fs.readFile(path.join(FRONTEND_DIR, 'index.html'), (err2, data2) => {
        if (err2) {
          res.writeHead(404);
          return res.end('Not found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

function generatePrompt() {
  if (!store.analysis) return 'No analysis available.';
  
  let prompt = `# Code Architecture\n\n`;
  prompt += `## Components\n`;
  
  for (const comp of store.analysis.architecture.components) {
    prompt += `- **${comp.name}** (${comp.icon}): ${comp.description}\n`;
    prompt += `  Tech: ${comp.tech.join(', ')}\n`;
  }
  
  if (store.comments.length > 0) {
    prompt += `\n## Design Notes\n`;
    for (const c of store.comments) {
      prompt += `- ${c.text}\n`;
    }
  }
  
  return prompt;
}

// WebSocket
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  clients.add(ws);
  
  ws.send(JSON.stringify({
    type: 'init',
    data: {
      analyzed: !!store.analyzer,
      lod: store.currentLod,
      focusedNode: store.focusedNode,
      analysisMode: store.analysisMode,
      llmConfig: { provider: store.llmConfig.provider },
    }
  }));
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      // Agent registering as relay
      if (msg.type === 'agent_register') {
        const agentId = msg.agentId || `agent_${Date.now()}`;
        agentRelays.set(ws, { id: agentId, pendingPrompts: new Map() });
        ws.send(JSON.stringify({ type: 'agent_registered', agentId }));
        broadcast({ type: 'agent_connected', agentId });
        console.log(`🤖 Agent connected: ${agentId}`);
      }
      
      // Agent responding to prompt
      if (msg.type === 'agent_response') {
        const relay = agentRelays.get(ws);
        if (relay && relay.pendingPrompts.has(msg.promptId)) {
          const callback = relay.pendingPrompts.get(msg.promptId);
          relay.pendingPrompts.delete(msg.promptId);
          callback(msg.response, msg.error);
        }
      }
    } catch (e) {
      console.error('WebSocket message error:', e);
    }
  });
  
  ws.on('close', () => {
    clients.delete(ws);
    if (agentRelays.has(ws)) {
      const agent = agentRelays.get(ws);
      console.log(`🤖 Agent disconnected: ${agent.id}`);
      broadcast({ type: 'agent_disconnected', agentId: agent.id });
      agentRelays.delete(ws);
    }
  });
});

// Helper: Send prompt to relay agent
function sendToRelay(prompt, callback) {
  const agents = Array.from(agentRelays.entries());
  if (agents.length === 0) {
    callback(null, 'No agent connected');
    return;
  }
  
  const [ws, agent] = agents[0]; // Use first connected agent
  const promptId = `prompt_${++promptIdCounter}`;
  
  agent.pendingPrompts.set(promptId, callback);
  ws.send(JSON.stringify({
    type: 'prompt_request',
    promptId,
    prompt,
  }));
}

server.listen(PORT, () => {
  console.log(`Code Canvas v2 running on http://localhost:${PORT}`);
  console.log(`\nLOD Levels:`);
  console.log(`  4 - Architecture (high-level system view)`);
  console.log(`  3 - Sub-systems (zoom into component)`);
  console.log(`  2 - Classes (with relationships)`);
  console.log(`  1 - Class Details (methods, properties)`);
  console.log(`  0 - Code View`);
  console.log(`\nSemantic Analysis API:`);
  console.log(`  POST /api/analyze      - Analyze codebase (semantic)`);
  console.log(`  GET  /api/nodes?lod=N  - Get nodes for LOD`);
  console.log(`  POST /api/zoom-in      - Zoom into node`);
  console.log(`  POST /api/zoom-out     - Zoom out`);
  console.log(`  GET  /api/code?nodeId  - Get code for node`);
  console.log(`\nLLM Analysis API:`);
  console.log(`  GET  /api/llm/config   - Get LLM config`);
  console.log(`  POST /api/llm/config   - Set LLM provider/key`);
  console.log(`  POST /api/llm/analyze  - Analyze with LLM`);
  console.log(`  GET  /api/llm/nodes    - Get LLM analysis nodes`);
  console.log(`\nAgent Relay (WebSocket):`);
  console.log(`  Connect and send: { type: "agent_register", agentId: "my-agent" }`);
  console.log(`  Respond to prompts: { type: "agent_response", promptId, response }`);
});
