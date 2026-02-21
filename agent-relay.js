#!/usr/bin/env node
/**
 * Code Canvas Agent Relay
 * 
 * This script connects your coding agent (Claude Code, Cursor, Codex, etc.)
 * to Code Canvas, allowing it to use your agent's LLM for architecture analysis.
 * 
 * Usage:
 *   node agent-relay.js [code-canvas-url]
 * 
 * Example:
 *   node agent-relay.js ws://localhost:3002
 *   node agent-relay.js ws://192.168.1.100:3002
 * 
 * Once connected, Code Canvas will send prompts through this relay.
 * Your coding agent should process the prompts and respond.
 */

const WebSocket = require('ws');
const readline = require('readline');

const CODE_CANVAS_URL = process.argv[2] || 'ws://localhost:3002';
const AGENT_ID = process.env.AGENT_ID || `agent_${Date.now()}`;

console.log('🎨 Code Canvas Agent Relay');
console.log('==========================\n');
console.log(`Connecting to: ${CODE_CANVAS_URL}`);
console.log(`Agent ID: ${AGENT_ID}\n`);

let ws;
let pendingPrompt = null;

function connect() {
  ws = new WebSocket(CODE_CANVAS_URL);

  ws.on('open', () => {
    console.log('✅ Connected to Code Canvas\n');
    
    // Register as agent
    ws.send(JSON.stringify({
      type: 'agent_register',
      agentId: AGENT_ID,
    }));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'agent_registered') {
        console.log(`✅ Registered as: ${msg.agentId}`);
        console.log('\n📡 Waiting for prompts from Code Canvas...\n');
        console.log('─'.repeat(50));
      }
      
      if (msg.type === 'prompt_request') {
        pendingPrompt = msg;
        console.log(`\n🤖 PROMPT REQUEST (ID: ${msg.promptId})`);
        console.log('─'.repeat(50));
        console.log(msg.prompt);
        console.log('─'.repeat(50));
        console.log('\n📝 Process this prompt with your LLM, then paste the response.');
        console.log('   Type "DONE" on a new line when finished.\n');
      }
    } catch (e) {
      console.error('Parse error:', e);
    }
  });

  ws.on('close', () => {
    console.log('\n❌ Disconnected from Code Canvas');
    console.log('   Reconnecting in 3 seconds...\n');
    setTimeout(connect, 3000);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
}

// Read response from stdin
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let responseBuffer = '';
let collectingResponse = false;

rl.on('line', (line) => {
  if (!pendingPrompt) {
    if (line.trim()) {
      console.log('⚠️  No pending prompt. Wait for a prompt from Code Canvas.');
    }
    return;
  }
  
  if (line.trim() === 'DONE') {
    // Send response
    ws.send(JSON.stringify({
      type: 'agent_response',
      promptId: pendingPrompt.promptId,
      response: responseBuffer.trim(),
    }));
    
    console.log('\n✅ Response sent to Code Canvas\n');
    console.log('─'.repeat(50));
    console.log('📡 Waiting for next prompt...\n');
    
    pendingPrompt = null;
    responseBuffer = '';
    collectingResponse = false;
  } else {
    responseBuffer += line + '\n';
    collectingResponse = true;
  }
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Disconnecting...');
  if (ws) ws.close();
  process.exit(0);
});

// Start connection
connect();

console.log('\n💡 Tip: Keep this terminal open while using Code Canvas.');
console.log('   When a prompt appears, send it to your LLM and paste the response.\n');
