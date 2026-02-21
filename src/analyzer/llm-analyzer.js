/**
 * LLM-based Code Analyzer
 * Uses AI to understand codebase architecture
 * 
 * Supports two modes:
 * - Direct API: Configure provider (Anthropic, OpenAI, Google, Ollama)
 * - Agent Relay: Connect your coding agent via WebSocket
 */

const fs = require('fs');
const path = require('path');

const SKIP_DIRS = ['node_modules', '.git', 'dist', 'build', '__pycache__', '.next', 'coverage', '.cache', 'venv', 'env', '.venv', '.idea'];
const KEY_FILES = ['README.md', 'readme.md', 'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'requirements.txt', 'setup.py', 'docker-compose.yml', 'Dockerfile'];
const CODE_PATTERNS = /\.(js|jsx|ts|tsx|py|go|java|rs|rb|html|vue|svelte)$/;

class LLMAnalyzer {
  constructor(rootPath, options = {}) {
    this.rootPath = rootPath;
    this.options = options;
    this.provider = options.provider || 'relay'; // 'anthropic', 'openai', 'google', 'ollama', 'relay'
    this.apiKey = options.apiKey || null;
    this.baseUrl = options.baseUrl || null; // For Ollama or custom endpoints
    this.relayCallback = options.relayCallback || null; // For WebSocket relay mode
    
    this.files = [];
    this.fileTree = '';
    this.keyFileContents = {};
    this.analysis = null;
  }

  // Scan directory and build file tree
  scanDirectory(dir = this.rootPath, depth = 0) {
    if (!fs.existsSync(dir)) return '';
    
    let tree = '';
    const indent = '  '.repeat(depth);
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (SKIP_DIRS.includes(entry.name)) continue;
      
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(this.rootPath, fullPath);
      
      if (entry.isDirectory()) {
        tree += `${indent}📁 ${entry.name}/\n`;
        tree += this.scanDirectory(fullPath, depth + 1);
      } else if (entry.isFile()) {
        tree += `${indent}📄 ${entry.name}\n`;
        
        // Track code files
        if (CODE_PATTERNS.test(entry.name)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          this.files.push({
            path: relativePath,
            name: entry.name,
            size: content.length,
            lines: content.split('\n').length,
            content: content,
          });
        }
        
        // Read key files
        if (KEY_FILES.includes(entry.name)) {
          try {
            this.keyFileContents[relativePath] = fs.readFileSync(fullPath, 'utf8').slice(0, 5000);
          } catch (e) {}
        }
      }
    }
    
    return tree;
  }

  // Find entry point files
  findEntryPoints() {
    const entryPatterns = [
      /^(index|main|app|server)\.(js|ts|jsx|tsx|py)$/,
      /^(App|Main)\.(jsx|tsx|vue|svelte)$/,
    ];
    
    return this.files.filter(f => 
      entryPatterns.some(p => p.test(f.name))
    ).slice(0, 5);
  }

  // Build the initial prompt for architecture inference
  buildArchitecturePrompt() {
    const entryPoints = this.findEntryPoints();
    const entryContents = entryPoints.map(f => 
      `### ${f.path}\n\`\`\`\n${f.content.slice(0, 3000)}\n\`\`\``
    ).join('\n\n');

    const keyFiles = Object.entries(this.keyFileContents)
      .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
      .join('\n\n');

    return `You are analyzing a codebase to understand its architecture.

## File Tree
\`\`\`
${this.fileTree.slice(0, 4000)}
\`\`\`

## Key Files
${keyFiles}

## Entry Points
${entryContents}

## Task
Analyze this codebase and return a JSON architecture description:

\`\`\`json
{
  "name": "Project name",
  "description": "Brief description of what this project does",
  "pattern": "Architecture pattern (e.g., MVC, microservices, monolith, etc.)",
  "components": [
    {
      "id": "unique_id",
      "name": "Component Name",
      "type": "ui|api|data|integration|realtime|core|config|test",
      "description": "What this component does",
      "files": ["list", "of", "file", "paths"],
      "technologies": ["React", "Express", etc.],
      "dependencies": ["other_component_ids"]
    }
  ],
  "relationships": [
    {
      "from": "component_id",
      "to": "component_id", 
      "type": "uses|extends|contains|calls",
      "description": "Optional description"
    }
  ],
  "uncertainAreas": [
    {
      "component": "component_id or area name",
      "reason": "Why you're uncertain",
      "filesNeeded": ["files", "to", "read", "for", "clarity"]
    }
  ]
}
\`\`\`

Be thorough but concise. Focus on the actual architecture, not folder structure.
Return ONLY the JSON, no other text.`;
  }

  // Build follow-up prompt for uncertain areas
  buildDeepdivePrompt(uncertainArea, fileContents) {
    return `You previously analyzed a codebase and were uncertain about: "${uncertainArea.reason}"

Here are the files you requested:

${Object.entries(fileContents).map(([path, content]) => 
  `### ${path}\n\`\`\`\n${content.slice(0, 4000)}\n\`\`\``
).join('\n\n')}

Based on this additional context, provide an updated analysis for this component:

\`\`\`json
{
  "id": "${uncertainArea.component}",
  "name": "Updated name if needed",
  "type": "ui|api|data|integration|realtime|core|config|test",
  "description": "Updated description",
  "files": ["updated", "file", "list"],
  "technologies": ["updated", "tech", "list"],
  "subcomponents": [
    {
      "id": "sub_id",
      "name": "Sub-component name",
      "description": "What it does",
      "files": ["files"]
    }
  ]
}
\`\`\`

Return ONLY the JSON.`;
  }

  // Call LLM based on configured provider
  async callLLM(prompt) {
    switch (this.provider) {
      case 'anthropic':
        return this.callAnthropic(prompt);
      case 'openai':
        return this.callOpenAI(prompt);
      case 'google':
        return this.callGoogle(prompt);
      case 'ollama':
        return this.callOllama(prompt);
      case 'relay':
        return this.callRelay(prompt);
      default:
        throw new Error(`Unknown provider: ${this.provider}`);
    }
  }

  // Anthropic Claude API
  async callAnthropic(prompt) {
    if (!this.apiKey) throw new Error('Anthropic API key required');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.content[0].text;
  }

  // OpenAI API
  async callOpenAI(prompt) {
    if (!this.apiKey) throw new Error('OpenAI API key required');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8000,
      }),
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content;
  }

  // Google Gemini API
  async callGoogle(prompt) {
    if (!this.apiKey) throw new Error('Google API key required');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );
    
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.candidates[0].content.parts[0].text;
  }

  // Ollama (local)
  async callOllama(prompt) {
    const baseUrl = this.baseUrl || 'http://localhost:11434';
    const model = this.options.model || 'llama3';
    
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
      }),
    });
    
    const data = await response.json();
    return data.response;
  }

  // WebSocket Relay - sends to connected coding agent
  async callRelay(prompt) {
    if (!this.relayCallback) {
      throw new Error('No agent connected. Connect your coding agent via WebSocket first.');
    }
    
    // Send prompt and wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Agent response timeout (60s)'));
      }, 60000);
      
      this.relayCallback(prompt, (response, error) => {
        clearTimeout(timeout);
        if (error) reject(new Error(error));
        else resolve(response);
      });
    });
  }

  // Parse JSON from LLM response (handles markdown code blocks)
  parseJSON(response) {
    // Try to extract JSON from markdown code block
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : response;
    
    try {
      return JSON.parse(jsonStr.trim());
    } catch (e) {
      console.error('Failed to parse LLM response as JSON:', e);
      console.error('Response was:', response.slice(0, 500));
      throw new Error('Invalid JSON response from LLM');
    }
  }

  // Main analysis function
  async analyze() {
    console.log(`🔍 LLM Analysis of: ${this.rootPath}`);
    console.log(`   Provider: ${this.provider}`);
    
    // Phase 1: Quick scan
    console.log('📁 Phase 1: Scanning directory structure...');
    this.fileTree = this.scanDirectory();
    console.log(`   Found ${this.files.length} code files`);
    
    // Phase 2: Initial architecture inference
    console.log('🤖 Phase 2: Inferring architecture...');
    const prompt = this.buildArchitecturePrompt();
    const response = await this.callLLM(prompt);
    this.analysis = this.parseJSON(response);
    console.log(`   Identified ${this.analysis.components?.length || 0} components`);
    
    // Phase 3: Deep dive on uncertain areas
    if (this.analysis.uncertainAreas?.length > 0) {
      console.log('🔬 Phase 3: Deep diving uncertain areas...');
      
      for (const area of this.analysis.uncertainAreas.slice(0, 3)) {
        console.log(`   Analyzing: ${area.component}`);
        
        // Read requested files
        const fileContents = {};
        for (const filePath of (area.filesNeeded || []).slice(0, 5)) {
          const file = this.files.find(f => f.path === filePath || f.path.includes(filePath));
          if (file) {
            fileContents[file.path] = file.content;
          }
        }
        
        if (Object.keys(fileContents).length > 0) {
          const deepDivePrompt = this.buildDeepdivePrompt(area, fileContents);
          const deepDiveResponse = await this.callLLM(deepDivePrompt);
          
          try {
            const updatedComponent = this.parseJSON(deepDiveResponse);
            // Merge updated component back into analysis
            const idx = this.analysis.components.findIndex(c => c.id === area.component);
            if (idx >= 0) {
              this.analysis.components[idx] = { ...this.analysis.components[idx], ...updatedComponent };
            } else {
              this.analysis.components.push(updatedComponent);
            }
          } catch (e) {
            console.log(`   Warning: Could not parse deep dive response for ${area.component}`);
          }
        }
      }
    }
    
    console.log('✅ Analysis complete!');
    return this.analysis;
  }

  // Convert analysis to React Flow nodes/edges format
  toFlowFormat(lod = 4) {
    if (!this.analysis) throw new Error('No analysis available. Run analyze() first.');
    
    const nodes = [];
    const edges = [];
    
    const typeIcons = {
      ui: '🖥️',
      api: '⚡',
      data: '🗄️',
      integration: '🌐',
      realtime: '🔄',
      core: '⚙️',
      config: '📝',
      test: '🧪',
    };
    
    const typeColors = {
      ui: 'ui',
      api: 'api',
      data: 'data',
      integration: 'integration',
      realtime: 'realtime',
      core: 'core',
      config: 'core',
      test: 'core',
    };
    
    // LOD 4: High-level components
    if (lod === 4) {
      // Group components by type for grouping
      const groups = {};
      for (const comp of this.analysis.components) {
        const group = this.getGroupForType(comp.type);
        if (!groups[group]) groups[group] = [];
        groups[group].push(comp);
      }
      
      // Create group nodes and component nodes
      let groupX = 50;
      for (const [groupName, components] of Object.entries(groups)) {
        const groupId = `group_${groupName}`;
        const cols = Math.min(components.length, 2);
        const rows = Math.ceil(components.length / cols);
        const width = cols * 340 + 60;
        const height = rows * 280 + 80;
        
        nodes.push({
          id: groupId,
          type: 'group',
          position: { x: groupX, y: 50 },
          data: {
            groupType: groupName,
            label: this.capitalizeFirst(groupName),
            width,
            height,
          },
          style: { width, height },
        });
        
        components.forEach((comp, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          
          nodes.push({
            id: comp.id,
            type: 'architecture',
            parentNode: groupId,
            extent: 'parent',
            position: { x: 30 + col * 340, y: 50 + row * 280 },
            data: {
              label: comp.name,
              compType: typeColors[comp.type] || 'core',
              description: comp.description,
              icon: typeIcons[comp.type] || '📦',
              tech: comp.technologies || [],
              capabilities: [],
              fileCount: comp.files?.length || 0,
              hasChildren: true,
            },
          });
        });
        
        groupX += width + 50;
      }
      
      // Add relationships
      for (const rel of (this.analysis.relationships || [])) {
        edges.push({
          id: `edge_${rel.from}_${rel.to}`,
          source: rel.from,
          target: rel.to,
          label: rel.type,
          type: 'smoothstep',
          animated: rel.type === 'calls',
        });
      }
    }
    
    return { nodes, edges, analysis: this.analysis };
  }
  
  getGroupForType(type) {
    const mapping = {
      ui: 'frontend',
      realtime: 'frontend',
      api: 'backend',
      core: 'backend',
      data: 'backend',
      integration: 'external',
      config: 'backend',
      test: 'backend',
    };
    return mapping[type] || 'backend';
  }
  
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

module.exports = { LLMAnalyzer };
