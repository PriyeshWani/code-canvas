/**
 * Semantic Code Analyzer
 * Derives architectural understanding from code - not just folder mapping
 */

const fs = require('fs');
const path = require('path');

const SKIP_DIRS = ['node_modules', '.git', 'dist', 'build', '__pycache__', '.next', 'coverage', '.cache', 'venv', 'env', '.venv'];
const CODE_PATTERNS = /\.(js|jsx|ts|tsx|py|go|java|rs|rb|html|htm|vue|svelte)$/;

class SemanticAnalyzer {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.files = [];
    this.nodeId = 0;
    
    // Semantic structure - not folder-based
    this.architecture = {
      components: [],      // LOD4: High-level system parts
      subSystems: [],      // LOD3: Sub-systems within components
      classes: [],         // LOD2: Classes with relationships
      classDetails: [],    // LOD1: Class internals
      codeSnippets: {},    // LOD0: Actual code
    };
    
    this.relationships = [];  // Connections between nodes at any level
  }

  genId(prefix = 'node') {
    return `${prefix}_${++this.nodeId}`;
  }

  // Scan all source files
  scanFiles(dir = this.rootPath) {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !SKIP_DIRS.includes(entry.name)) {
        this.scanFiles(fullPath);
      } else if (entry.isFile() && CODE_PATTERNS.test(entry.name)) {
        this.files.push({
          path: fullPath,
          relativePath: path.relative(this.rootPath, fullPath),
          name: entry.name,
          content: fs.readFileSync(fullPath, 'utf8'),
        });
      }
    }
  }

  // Main analysis entry point
  analyze() {
    console.log(`Semantic analysis of: ${this.rootPath}`);
    this.scanFiles();
    console.log(`Found ${this.files.length} source files`);
    
    this.deriveArchitecture();
    this.deriveSubSystems();
    this.extractClasses();
    this.findRelationships();
    
    return {
      architecture: this.architecture,
      relationships: this.relationships,
      fileCount: this.files.length,
    };
  }

  // LOD4: Derive high-level architectural components
  deriveArchitecture() {
    const components = new Map();
    
    for (const file of this.files) {
      const analysis = this.analyzeFileSemantics(file);
      
      // Categorize into architectural components based on what the code DOES
      for (const role of analysis.roles) {
        if (!components.has(role.type)) {
          components.set(role.type, {
            id: this.genId('arch'),
            type: role.type,
            name: role.name,
            description: role.description,
            icon: role.icon,
            files: [],
            tech: new Set(),
            capabilities: new Set(),
          });
        }
        
        const comp = components.get(role.type);
        comp.files.push(file.relativePath);
        role.tech.forEach(t => comp.tech.add(t));
        role.capabilities.forEach(c => comp.capabilities.add(c));
      }
    }
    
    // Convert to array and clean up Sets
    this.architecture.components = Array.from(components.values()).map(c => ({
      ...c,
      tech: Array.from(c.tech),
      capabilities: Array.from(c.capabilities),
    }));
  }

  // Analyze what a file DOES, not where it IS
  analyzeFileSemantics(file) {
    const content = file.content;
    const roles = [];
    
    // Detect UI/Frontend
    if (this.isUserInterface(content, file.name)) {
      roles.push({
        type: 'ui',
        name: 'User Interface',
        description: 'Handles user interactions and display',
        icon: '🖥️',
        tech: this.detectUITech(content),
        capabilities: this.detectUICapabilities(content),
      });
    }
    
    // Detect API/Server
    if (this.isAPIServer(content, file.name)) {
      roles.push({
        type: 'api',
        name: 'API Layer',
        description: 'Handles HTTP requests and business logic',
        icon: '⚡',
        tech: this.detectServerTech(content),
        capabilities: this.extractEndpoints(content),
      });
    }
    
    // Detect Data Layer
    if (this.isDataLayer(content)) {
      roles.push({
        type: 'data',
        name: 'Data Layer',
        description: 'Manages data persistence and retrieval',
        icon: '🗄️',
        tech: this.detectDataTech(content),
        capabilities: this.detectDataOps(content),
      });
    }
    
    // Detect External Integrations
    if (this.isExternalIntegration(content)) {
      roles.push({
        type: 'integration',
        name: 'External Services',
        description: 'Connects to third-party APIs and services',
        icon: '🌐',
        tech: this.detectIntegrationTech(content),
        capabilities: this.detectIntegrations(content),
      });
    }
    
    // Detect Real-time/Event System
    if (this.isRealtimeSystem(content)) {
      roles.push({
        type: 'realtime',
        name: 'Real-time Layer',
        description: 'Handles WebSockets and live updates',
        icon: '🔄',
        tech: this.detectRealtimeTech(content),
        capabilities: ['live-updates', 'bidirectional-comm'],
      });
    }
    
    // Detect Business Logic/Core
    if (this.isBusinessLogic(content, file.name) && roles.length === 0) {
      roles.push({
        type: 'core',
        name: 'Core Logic',
        description: 'Business rules and core algorithms',
        icon: '⚙️',
        tech: [],
        capabilities: this.detectCoreCapabilities(content),
      });
    }
    
    return { roles };
  }

  // Detection methods - support JS, Python, HTML
  isUserInterface(content, fileName) {
    // JavaScript/TypeScript UI
    const jsUI = content.includes('React') || content.includes('useState') ||
           content.includes('createElement') || content.includes('render') ||
           content.includes('document.') || content.includes('DOM') ||
           fileName.endsWith('.jsx') || fileName.endsWith('.tsx') ||
           content.includes('Vue') || content.includes('template:');
    
    // HTML files
    const htmlUI = fileName.endsWith('.html') || fileName.endsWith('.htm');
    
    // Python UI (Tkinter, PyQt, Flask templates)
    const pythonUI = content.includes('tkinter') || content.includes('PyQt') ||
           content.includes('render_template') || content.includes('Jinja');
    
    return jsUI || htmlUI || pythonUI;
  }

  isAPIServer(content, fileName) {
    // JavaScript servers
    const jsServer = content.includes('createServer') || content.includes('app.listen') ||
           content.includes('express()') || content.includes('router.') ||
           content.includes('app.get(') || content.includes('app.post(') ||
           fileName === 'server.js' || fileName === 'app.js';
    
    // Python servers (Flask, FastAPI, Django)
    const pythonServer = content.includes('@app.route') || content.includes('FastAPI') ||
           content.includes('from flask') || content.includes('from fastapi') ||
           content.includes('from django') || content.includes('urlpatterns') ||
           content.includes('APIRouter') || content.includes('@router.');
    
    return jsServer || pythonServer;
  }

  isDataLayer(content) {
    // JavaScript ORMs
    const jsDbKeywords = ['mongoose', 'sequelize', 'prisma', 'knex', 'typeorm'];
    const hasJsDb = jsDbKeywords.some(k => 
      content.includes(`require('${k}')`) || 
      content.includes(`require("${k}")`) ||
      content.includes(`from '${k}'`) ||
      content.includes(`from "${k}"`)
    );
    
    // Python ORMs (SQLAlchemy, Django ORM, Peewee)
    const pythonDbPatterns = [
      'from sqlalchemy', 'import sqlalchemy',
      'from django.db', 'models.Model',
      'from peewee', 'from tortoise',
      'Base.metadata', 'db.session',
    ];
    const hasPythonDb = pythonDbPatterns.some(p => content.includes(p));
    
    const hasSqlQueries = /\b(SELECT|INSERT|UPDATE|DELETE)\s+/i.test(content) && 
                          content.length < 5000;
    
    const hasSchemaDefinition = content.includes('.Schema(') || 
                                 content.includes('defineModel') ||
                                 content.includes('@Entity') ||
                                 content.includes('class Meta:');
    
    return hasJsDb || hasPythonDb || hasSqlQueries || hasSchemaDefinition;
  }

  isExternalIntegration(content) {
    // JavaScript HTTP clients
    const jsHttp = (content.includes('fetch(') && content.includes('http')) ||
           content.includes('axios') || content.includes('request(') ||
           content.includes('https.get') || content.includes('http.get');
    
    // Python HTTP clients
    const pythonHttp = content.includes('import requests') || 
           content.includes('from requests') ||
           content.includes('httpx') || content.includes('aiohttp') ||
           content.includes('urllib.request');
    
    return jsHttp || pythonHttp;
  }

  isRealtimeSystem(content) {
    return content.includes('WebSocket') || content.includes('socket.io') ||
           content.includes('ws.on(') || content.includes('io.emit');
  }

  isBusinessLogic(content, fileName) {
    return content.includes('class ') || content.includes('function ') ||
           content.includes('export ') || content.includes('module.exports');
  }

  // Tech detection
  detectUITech(content) {
    const tech = [];
    if (content.includes('React') || content.includes('useState')) tech.push('React');
    if (content.includes('Vue')) tech.push('Vue');
    if (content.includes('reactflow') || content.includes('ReactFlow')) tech.push('React Flow');
    if (content.includes('canvas') || content.includes('Canvas')) tech.push('Canvas');
    if (content.includes('three') || content.includes('THREE')) tech.push('Three.js');
    return tech;
  }

  detectServerTech(content) {
    const tech = [];
    if (content.includes('express')) tech.push('Express');
    if (content.includes('fastify')) tech.push('Fastify');
    if (content.includes('http.createServer')) tech.push('Node HTTP');
    if (content.includes('FastAPI')) tech.push('FastAPI');
    if (content.includes('Flask')) tech.push('Flask');
    return tech;
  }

  detectDataTech(content) {
    const tech = [];
    if (content.includes('mongoose') || content.includes('mongodb')) tech.push('MongoDB');
    if (content.includes('postgres') || content.includes('pg.')) tech.push('PostgreSQL');
    if (content.includes('redis')) tech.push('Redis');
    if (content.includes('sqlite')) tech.push('SQLite');
    if (content.includes('fs.write') || content.includes('fs.read')) tech.push('File System');
    return tech;
  }

  detectIntegrationTech(content) {
    const tech = [];
    if (content.includes('fetch')) tech.push('Fetch API');
    if (content.includes('axios')) tech.push('Axios');
    return tech;
  }

  detectRealtimeTech(content) {
    const tech = [];
    if (content.includes('WebSocket') || content.includes("require('ws')")) tech.push('WebSocket');
    if (content.includes('socket.io')) tech.push('Socket.io');
    return tech;
  }

  // Capability detection
  detectUICapabilities(content) {
    const caps = [];
    if (content.includes('onClick') || content.includes('onSubmit')) caps.push('user-input');
    if (content.includes('useState') || content.includes('state')) caps.push('state-management');
    if (content.includes('fetch(') || content.includes('axios')) caps.push('api-calls');
    if (content.includes('Canvas') || content.includes('svg')) caps.push('graphics');
    return caps;
  }

  extractEndpoints(content) {
    const endpoints = [];
    const patterns = [
      /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
      /['"`](\/api\/[^'"`]+)['"`]/gi,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const endpoint = match[2] || match[1];
        if (endpoint.startsWith('/')) endpoints.push(endpoint);
      }
    }
    
    return [...new Set(endpoints)].slice(0, 10);
  }

  detectDataOps(content) {
    const ops = [];
    if (content.includes('.find(') || content.includes('SELECT')) ops.push('read');
    if (content.includes('.save(') || content.includes('.create(') || content.includes('INSERT')) ops.push('write');
    if (content.includes('.update(') || content.includes('UPDATE')) ops.push('update');
    if (content.includes('.delete(') || content.includes('DELETE')) ops.push('delete');
    return ops;
  }

  detectIntegrations(content) {
    const integrations = [];
    if (content.includes('openai')) integrations.push('OpenAI');
    if (content.includes('stripe')) integrations.push('Stripe');
    if (content.includes('twilio')) integrations.push('Twilio');
    if (content.includes('aws') || content.includes('s3')) integrations.push('AWS');
    if (content.includes('rss') || content.includes('xml')) integrations.push('RSS');
    return integrations;
  }

  detectCoreCapabilities(content) {
    const caps = [];
    if (content.includes('parse') || content.includes('Parse')) caps.push('parsing');
    if (content.includes('transform') || content.includes('convert')) caps.push('transformation');
    if (content.includes('validate') || content.includes('Validate')) caps.push('validation');
    if (content.includes('calculate') || content.includes('compute')) caps.push('computation');
    return caps;
  }

  // LOD3: Derive sub-systems for each architectural component
  deriveSubSystems() {
    for (const component of this.architecture.components) {
      const subSystems = this.analyzeComponentSubSystems(component);
      
      for (const sub of subSystems) {
        sub.parentId = component.id;
        this.architecture.subSystems.push(sub);
        
        // Add relationship
        this.relationships.push({
          id: this.genId('rel'),
          source: component.id,
          target: sub.id,
          type: 'contains',
          lod: 3,
        });
      }
    }
  }

  analyzeComponentSubSystems(component) {
    const subSystems = [];
    const filesByPurpose = new Map();
    
    for (const filePath of component.files) {
      const file = this.files.find(f => f.relativePath === filePath);
      if (!file) continue;
      
      const purpose = this.deriveFilePurpose(file, component.type);
      
      if (!filesByPurpose.has(purpose.type)) {
        filesByPurpose.set(purpose.type, {
          id: this.genId('sub'),
          type: purpose.type,
          name: purpose.name,
          description: purpose.description,
          icon: purpose.icon,
          files: [],
          features: new Set(),
          exports: [],
        });
      }
      
      const sub = filesByPurpose.get(purpose.type);
      sub.files.push(filePath);
      
      // Extract features/exports from this file
      const features = this.extractFileFeatures(file);
      features.forEach(f => sub.features.add(f));
    }
    
    // Convert Sets to arrays and limit
    return Array.from(filesByPurpose.values()).map(sub => ({
      ...sub,
      features: Array.from(sub.features).slice(0, 8),
    }));
  }
  
  extractFileFeatures(file) {
    const features = [];
    const content = file.content;
    let match;
    
    // Extract React component names (prioritize these)
    const compRegex = /(?:export\s+)?(?:default\s+)?function\s+([A-Z][a-zA-Z]+)\s*\(/g;
    while ((match = compRegex.exec(content)) !== null) {
      if (match[1].length > 2) features.push(`<${match[1]}/>`);
    }
    
    // Extract class names (only if no components found)
    if (features.length === 0) {
      const classRegex = /class\s+([A-Z][a-zA-Z]+)/g;
      while ((match = classRegex.exec(content)) !== null) {
        features.push(match[1]);
      }
    }
    
    // Extract API endpoints
    const endpointRegex = /\.(get|post|put|delete)\s*\(\s*['"`](\/[^'"`]{1,30})['"`]/gi;
    while ((match = endpointRegex.exec(content)) !== null) {
      features.push(`${match[1].toUpperCase()} ${match[2]}`);
    }
    
    // If still nothing, extract main exports
    if (features.length === 0) {
      const exportRegex = /module\.exports\s*=\s*\{\s*([^}]+)\}/;
      match = exportRegex.exec(content);
      if (match) {
        const exports = match[1].split(',').map(e => e.trim().split(':')[0].trim());
        features.push(...exports.filter(e => e && !e.includes('(') && e.length > 1).slice(0, 3));
      }
    }
    
    return [...new Set(features)].slice(0, 6);
  }

  deriveFilePurpose(file, parentType) {
    const content = file.content;
    const name = file.name.toLowerCase();
    const pathLower = file.relativePath.toLowerCase();
    
    // UI sub-systems
    if (parentType === 'ui') {
      if (pathLower.includes('component') || name.endsWith('node.jsx') || name.endsWith('node.tsx')) {
        return { type: 'components', name: 'Components', description: 'Reusable UI components', icon: '🧩' };
      }
      if (name.includes('app.') || name === 'main.jsx' || name === 'main.tsx') {
        return { type: 'app-shell', name: 'App Shell', description: 'Main application structure', icon: '🏠' };
      }
      if (pathLower.includes('hook') || (content.includes('useState') && content.includes('export const use'))) {
        return { type: 'hooks', name: 'Hooks', description: 'State and logic hooks', icon: '🪝' };
      }
      if (pathLower.includes('page') || pathLower.includes('view') || pathLower.includes('screen')) {
        return { type: 'views', name: 'Views', description: 'Page views and layouts', icon: '📄' };
      }
      if (name.includes('style') || name.endsWith('.css')) {
        return { type: 'styles', name: 'Styles', description: 'CSS and styling', icon: '🎨' };
      }
      return { type: 'ui-logic', name: 'UI Logic', description: 'UI-related utilities', icon: '🖼️' };
    }
    
    // API sub-systems
    if (parentType === 'api') {
      if (content.includes('router') || pathLower.includes('route')) {
        return { type: 'routes', name: 'Routes', description: 'API route handlers', icon: '🛤️' };
      }
      if (pathLower.includes('middleware')) {
        return { type: 'middleware', name: 'Middleware', description: 'Request processing middleware', icon: '🔗' };
      }
      if (name === 'server.js' || name === 'app.js' || content.includes('listen(')) {
        return { type: 'server', name: 'Server', description: 'Server setup and config', icon: '🖥️' };
      }
      if (pathLower.includes('controller')) {
        return { type: 'controllers', name: 'Controllers', description: 'Request controllers', icon: '🎮' };
      }
      return { type: 'api-handlers', name: 'API Handlers', description: 'Request processing', icon: '📬' };
    }
    
    // Data layer sub-systems
    if (parentType === 'data') {
      if (pathLower.includes('model') || content.includes('Schema')) {
        return { type: 'models', name: 'Models', description: 'Data models and schemas', icon: '📋' };
      }
      if (pathLower.includes('repo') || pathLower.includes('dao')) {
        return { type: 'repositories', name: 'Repositories', description: 'Data access layer', icon: '🗃️' };
      }
      return { type: 'data-access', name: 'Data Access', description: 'Database operations', icon: '💾' };
    }
    
    // Integration sub-systems
    if (parentType === 'integration') {
      if (content.includes('rss') || content.includes('xml') || content.includes('feed')) {
        return { type: 'feeds', name: 'Feed Parsers', description: 'RSS/XML feed processing', icon: '📡' };
      }
      if (content.includes('fetch') || content.includes('axios') || content.includes('http')) {
        return { type: 'http-clients', name: 'HTTP Clients', description: 'External API clients', icon: '🔌' };
      }
      return { type: 'integrations', name: 'Integrations', description: 'Third-party integrations', icon: '🔗' };
    }
    
    // Realtime sub-systems
    if (parentType === 'realtime') {
      if (content.includes('WebSocket') || content.includes('ws.')) {
        return { type: 'websocket', name: 'WebSocket', description: 'WebSocket handlers', icon: '🔄' };
      }
      return { type: 'events', name: 'Events', description: 'Event handling', icon: '📢' };
    }
    
    // Core/Logic sub-systems
    if (parentType === 'core') {
      if (pathLower.includes('util') || pathLower.includes('helper')) {
        return { type: 'utilities', name: 'Utilities', description: 'Helper functions', icon: '🔧' };
      }
      if (pathLower.includes('config')) {
        return { type: 'config', name: 'Configuration', description: 'App configuration', icon: '⚙️' };
      }
      if (content.includes('class ') && content.includes('constructor')) {
        return { type: 'services', name: 'Services', description: 'Business logic services', icon: '🏢' };
      }
      return { type: 'core-logic', name: 'Core Logic', description: 'Business rules', icon: '🧠' };
    }
    
    // Default based on file analysis
    if (content.includes('class ')) {
      return { type: 'classes', name: 'Classes', description: 'Class definitions', icon: '🏛️' };
    }
    if (content.includes('export function') || content.includes('module.exports')) {
      return { type: 'modules', name: 'Modules', description: 'Exported modules', icon: '📦' };
    }
    
    return { type: 'other', name: 'Other', description: 'Other source files', icon: '📄' };
  }

  // Extract top-level functions from a file (for non-class files)
  extractFunctions(content) {
    const functions = [];
    
    // Match function declarations: function name(...) or async function name(...)
    const funcDeclRegex = /(?:async\s+)?function\s+(\w+)\s*\(/g;
    let match;
    while ((match = funcDeclRegex.exec(content)) !== null) {
      if (!functions.includes(match[1])) functions.push(match[1]);
    }
    
    // Match arrow functions assigned to const/let/var: const name = (...) => or async (...) =>
    const arrowRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
    while ((match = arrowRegex.exec(content)) !== null) {
      if (!functions.includes(match[1])) functions.push(match[1]);
    }
    
    // Match module.exports functions
    const exportsRegex = /(?:module\.)?exports\.(\w+)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>)/g;
    while ((match = exportsRegex.exec(content)) !== null) {
      if (!functions.includes(match[1])) functions.push(match[1]);
    }
    
    // Python: def function_name(
    const pythonFuncRegex = /^def\s+(\w+)\s*\(/gm;
    while ((match = pythonFuncRegex.exec(content)) !== null) {
      if (!functions.includes(match[1])) functions.push(match[1]);
    }
    
    return functions.slice(0, 30);  // Limit to 30 functions
  }

  // LOD2: Extract classes and their relationships
  extractClasses() {
    for (const file of this.files) {
      const classes = this.parseClasses(file);
      
      for (const cls of classes) {
        cls.filePath = file.relativePath;
        this.architecture.classes.push(cls);
        
        // Store code snippet for LOD0
        this.architecture.codeSnippets[cls.id] = cls.code;
        
        // Find parent sub-system
        const parent = this.findParentSubSystem(file.relativePath);
        if (parent) {
          this.relationships.push({
            id: this.genId('rel'),
            source: parent.id,
            target: cls.id,
            type: 'contains',
            lod: 2,
          });
        }
      }
    }
    
    // Find class relationships (imports, extends, uses)
    this.findClassRelationships();
  }

  parseClasses(file) {
    const ext = path.extname(file.name).toLowerCase();
    
    // Route to language-specific parser
    if (ext === '.py') {
      return this.parsePythonFile(file);
    } else if (ext === '.html' || ext === '.htm') {
      return this.parseHTMLFile(file);
    } else if (ext === '.vue' || ext === '.svelte') {
      return this.parseSFCFile(file);
    }
    
    // JavaScript/TypeScript parsing
    const classes = [];
    const content = file.content;
    
    // ES6 Classes - find class definitions
    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/g;
    let match;
    const classPositions = [];
    
    while ((match = classRegex.exec(content)) !== null) {
      classPositions.push({
        name: match[1],
        extends: match[2],
        start: match.index,
      });
    }
    
    // For each class, extract methods by looking for method patterns
    for (let i = 0; i < classPositions.length; i++) {
      const cls = classPositions[i];
      const nextClassStart = classPositions[i + 1]?.start || content.length;
      
      // Get code between this class and the next (or end of file)
      const classSection = content.slice(cls.start, Math.min(nextClassStart, cls.start + 30000));
      
      // Extract methods - look for method definitions
      const methods = [];
      const methodPatterns = [
        /^\s{2,}(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/gm,  // instance methods
        /^\s{2,}(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/gm,  // static methods
      ];
      
      for (const pattern of methodPatterns) {
        let m;
        while ((m = pattern.exec(classSection)) !== null) {
          const name = m[1];
          if (!['if', 'for', 'while', 'switch', 'class', 'function', 'return', 'new'].includes(name)) {
            if (!methods.includes(name)) methods.push(name);
          }
        }
      }
      
      // Extract properties - look for this.x = assignments
      const properties = [];
      const propPattern = /this\.(\w+)\s*=/g;
      let pm;
      while ((pm = propPattern.exec(classSection)) !== null) {
        if (!properties.includes(pm[1])) properties.push(pm[1]);
      }
      
      console.log(`  Class ${cls.name}: ${methods.length} methods, ${properties.length} props`);
      
      classes.push({
        id: this.genId('class'),
        name: cls.name,
        type: 'class',
        extends: cls.extends,
        methods: methods.slice(0, 30),
        properties: properties.slice(0, 20),
        code: classSection.slice(0, 50000),  // Allow up to 50KB per class
      });
    }
    
    // React Function Components
    const funcCompRegex = /(?:export\s+)?(?:default\s+)?function\s+([A-Z]\w+)\s*\(/g;
    while ((match = funcCompRegex.exec(content)) !== null) {
      const funcName = match[1];
      const startPos = match.index;
      
      // Extract function body
      let braceCount = 0;
      let endPos = startPos;
      let started = false;
      
      for (let i = startPos; i < Math.min(content.length, startPos + 20000); i++) {
        if (content[i] === '{') {
          braceCount++;
          started = true;
        } else if (content[i] === '}') {
          braceCount--;
          if (started && braceCount === 0) {
            endPos = i + 1;
            break;
          }
        }
      }
      
      const funcCode = content.slice(startPos, endPos);
      const hooks = this.extractHooks(funcCode);
      
      classes.push({
        id: this.genId('class'),
        name: funcName,
        type: 'component',
        methods: ['render'],
        properties: hooks,
        code: funcCode.slice(0, 50000),  // Allow up to 50KB per component
      });
    }
    
    return classes;
  }

  extractMethods(classCode) {
    const methods = [];
    const methodRegex = /(?:async\s+)?(?:static\s+)?(\w+)\s*\([^)]*\)\s*\{/g;
    let match;
    
    while ((match = methodRegex.exec(classCode)) !== null) {
      const name = match[1];
      if (!['if', 'for', 'while', 'switch', 'class', 'function'].includes(name)) {
        methods.push(name);
      }
    }
    
    return [...new Set(methods)];
  }

  extractProperties(classCode) {
    const props = [];
    const propRegex = /this\.(\w+)\s*=/g;
    let match;
    
    while ((match = propRegex.exec(classCode)) !== null) {
      props.push(match[1]);
    }
    
    return [...new Set(props)];
  }

  extractHooks(content) {
    const hooks = [];
    const hookRegex = /use(\w+)\s*\(/g;
    let match;
    
    while ((match = hookRegex.exec(content)) !== null) {
      hooks.push(`use${match[1]}`);
    }
    
    return [...new Set(hooks)].slice(0, 10);
  }

  extractFunctionBody(content, startIndex) {
    let braceCount = 0;
    let started = false;
    let endPos = startIndex;
    
    for (let i = startIndex; i < content.length && i < startIndex + 5000; i++) {
      if (content[i] === '{') {
        braceCount++;
        started = true;
      } else if (content[i] === '}') {
        braceCount--;
        if (started && braceCount === 0) {
          endPos = i + 1;
          break;
        }
      }
    }
    
    return content.slice(startIndex, endPos);
  }

  // ==================== PYTHON PARSER ====================
  parsePythonFile(file) {
    const classes = [];
    const content = file.content;
    
    // Find Python classes
    const classRegex = /^class\s+(\w+)(?:\s*\(([^)]*)\))?\s*:/gm;
    let match;
    const classPositions = [];
    
    while ((match = classRegex.exec(content)) !== null) {
      classPositions.push({
        name: match[1],
        extends: match[2]?.split(',')[0]?.trim() || null,
        start: match.index,
      });
    }
    
    // Extract methods and properties for each class
    for (let i = 0; i < classPositions.length; i++) {
      const cls = classPositions[i];
      const nextClassStart = classPositions[i + 1]?.start || content.length;
      const classSection = content.slice(cls.start, Math.min(nextClassStart, cls.start + 30000));
      
      // Find methods (def statements with self parameter)
      const methods = [];
      const methodRegex = /^\s{4}(?:async\s+)?def\s+(\w+)\s*\(/gm;
      let m;
      while ((m = methodRegex.exec(classSection)) !== null) {
        methods.push(m[1]);
      }
      
      // Find properties (self.xxx assignments in __init__)
      const properties = [];
      const propRegex = /self\.(\w+)\s*=/g;
      while ((m = propRegex.exec(classSection)) !== null) {
        if (!properties.includes(m[1])) properties.push(m[1]);
      }
      
      console.log(`  Python class ${cls.name}: ${methods.length} methods, ${properties.length} props`);
      
      classes.push({
        id: this.genId('class'),
        name: cls.name,
        type: 'class',
        language: 'python',
        extends: cls.extends,
        methods: methods.slice(0, 30),
        properties: properties.slice(0, 20),
        code: classSection.slice(0, 50000),
      });
    }
    
    // Also find standalone functions
    const funcRegex = /^(?:async\s+)?def\s+(\w+)\s*\([^)]*\)\s*(?:->.*?)?\s*:/gm;
    const classNames = classPositions.map(c => c.name);
    const foundFuncs = new Set();
    
    while ((match = funcRegex.exec(content)) !== null) {
      const funcName = match[1];
      // Check if this is a method inside a class (indented) or standalone
      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const indent = match.index - lineStart;
      
      if (indent === 0 && !foundFuncs.has(funcName)) {
        foundFuncs.add(funcName);
        const funcCode = this.extractPythonFunctionBody(content, match.index);
        
        classes.push({
          id: this.genId('class'),
          name: funcName,
          type: 'function',
          language: 'python',
          methods: [],
          properties: [],
          code: funcCode.slice(0, 20000),
        });
      }
    }
    
    return classes;
  }
  
  extractPythonFunctionBody(content, startIndex) {
    // Find function body by tracking indentation
    const lines = content.slice(startIndex).split('\n');
    const defLine = lines[0];
    let bodyLines = [defLine];
    
    // Get base indentation of def
    const baseIndent = defLine.match(/^\s*/)[0].length;
    
    for (let i = 1; i < lines.length && i < 200; i++) {
      const line = lines[i];
      const lineIndent = line.match(/^\s*/)[0].length;
      
      // Empty lines or comments continue
      if (line.trim() === '' || line.trim().startsWith('#')) {
        bodyLines.push(line);
        continue;
      }
      
      // If line has greater indentation, it's part of the function
      if (lineIndent > baseIndent) {
        bodyLines.push(line);
      } else {
        break;
      }
    }
    
    return bodyLines.join('\n');
  }

  // ==================== HTML PARSER ====================
  parseHTMLFile(file) {
    const classes = [];
    const content = file.content;
    const fileName = file.name.replace(/\.(html|htm)$/, '');
    
    // Extract embedded scripts
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptContent = '';
    let match;
    
    while ((match = scriptRegex.exec(content)) !== null) {
      scriptContent += match[1] + '\n';
    }
    
    // Extract embedded styles
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let styleContent = '';
    
    while ((match = styleRegex.exec(content)) !== null) {
      styleContent += match[1] + '\n';
    }
    
    // Analyze the HTML structure
    const features = [];
    
    // Detect canvas (likely a game)
    if (/<canvas/i.test(content)) features.push('Canvas');
    
    // Detect forms
    if (/<form/i.test(content)) features.push('Forms');
    
    // Detect major sections
    if (/<header/i.test(content)) features.push('Header');
    if (/<nav/i.test(content)) features.push('Navigation');
    if (/<main/i.test(content)) features.push('Main Content');
    if (/<footer/i.test(content)) features.push('Footer');
    
    // Detect framework hints
    if (/ng-app|ng-controller/i.test(content)) features.push('Angular');
    if (/data-reactroot|__NEXT_DATA__/i.test(content)) features.push('React');
    if (/v-if|v-for|v-model/i.test(content)) features.push('Vue');
    
    // Create main component for the HTML file
    classes.push({
      id: this.genId('class'),
      name: fileName,
      type: 'html',
      language: 'html',
      methods: features,
      properties: [],
      code: content.slice(0, 50000),
    });
    
    // If there's significant JS, also extract functions from it
    if (scriptContent.length > 100) {
      const funcRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/g;
      const functions = [];
      
      while ((match = funcRegex.exec(scriptContent)) !== null) {
        const name = match[1] || match[2];
        if (name && !functions.includes(name)) {
          functions.push(name);
        }
      }
      
      if (functions.length > 0) {
        classes.push({
          id: this.genId('class'),
          name: `${fileName} (Scripts)`,
          type: 'module',
          language: 'javascript',
          methods: functions.slice(0, 30),
          properties: [],
          code: scriptContent.slice(0, 30000),
        });
      }
    }
    
    console.log(`  HTML file ${fileName}: ${features.length} features, ${scriptContent.length} bytes JS`);
    
    return classes;
  }

  // ==================== VUE/SVELTE SFC PARSER ====================
  parseSFCFile(file) {
    const classes = [];
    const content = file.content;
    const fileName = file.name.replace(/\.(vue|svelte)$/, '');
    const ext = path.extname(file.name).toLowerCase();
    
    // Extract template
    const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/i);
    const template = templateMatch ? templateMatch[1] : '';
    
    // Extract script
    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    const script = scriptMatch ? scriptMatch[1] : '';
    
    // Extract style
    const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const style = styleMatch ? styleMatch[1] : '';
    
    // Find component methods/properties from script
    const methods = [];
    const properties = [];
    
    // Vue 3 composition API
    const compositionFuncs = script.match(/(?:const|let)\s+(\w+)\s*=\s*(?:ref|reactive|computed)/g) || [];
    compositionFuncs.forEach(m => {
      const name = m.match(/(?:const|let)\s+(\w+)/)?.[1];
      if (name) properties.push(name);
    });
    
    // Function definitions
    const funcMatches = script.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\()/g) || [];
    funcMatches.forEach(m => {
      const name = m.match(/(?:function\s+|const\s+)(\w+)/)?.[1];
      if (name && !['ref', 'reactive', 'computed', 'watch'].includes(name)) {
        methods.push(name);
      }
    });
    
    classes.push({
      id: this.genId('class'),
      name: fileName,
      type: 'component',
      language: ext.slice(1),
      methods: methods.slice(0, 30),
      properties: properties.slice(0, 20),
      code: content.slice(0, 50000),
    });
    
    console.log(`  ${ext.slice(1).toUpperCase()} component ${fileName}: ${methods.length} methods, ${properties.length} props`);
    
    return classes;
  }

  findParentSubSystem(filePath) {
    for (const sub of this.architecture.subSystems) {
      if (sub.files.includes(filePath)) {
        return sub;
      }
    }
    return null;
  }

  findClassRelationships() {
    for (const cls of this.architecture.classes) {
      // Find extends relationship
      if (cls.extends) {
        const parent = this.architecture.classes.find(c => c.name === cls.extends);
        if (parent) {
          this.relationships.push({
            id: this.genId('rel'),
            source: cls.id,
            target: parent.id,
            type: 'extends',
            lod: 2,
          });
        }
      }
      
      // Find usage relationships based on code
      const file = this.files.find(f => f.relativePath === cls.filePath);
      if (file) {
        for (const otherCls of this.architecture.classes) {
          if (otherCls.id !== cls.id) {
            // Check if this class uses the other class
            if (file.content.includes(`new ${otherCls.name}`) ||
                file.content.includes(`${otherCls.name}.`) ||
                file.content.includes(`<${otherCls.name}`)) {
              this.relationships.push({
                id: this.genId('rel'),
                source: cls.id,
                target: otherCls.id,
                type: 'uses',
                lod: 2,
              });
            }
          }
        }
      }
    }
  }

  findRelationships() {
    // Find component-to-component relationships
    for (const comp of this.architecture.components) {
      for (const otherComp of this.architecture.components) {
        if (comp.id === otherComp.id) continue;
        
        // Check if files in comp reference files in otherComp
        const hasConnection = this.checkComponentConnection(comp, otherComp);
        
        if (hasConnection) {
          this.relationships.push({
            id: this.genId('rel'),
            source: comp.id,
            target: otherComp.id,
            type: hasConnection.type,
            label: hasConnection.label,
            lod: 4,
          });
        }
      }
    }
  }

  checkComponentConnection(compA, compB) {
    // UI → API
    if (compA.type === 'ui' && compB.type === 'api') {
      return { type: 'calls', label: 'HTTP/REST' };
    }
    
    // UI → Realtime
    if (compA.type === 'ui' && compB.type === 'realtime') {
      return { type: 'connects', label: 'WebSocket' };
    }
    
    // API → Data
    if (compA.type === 'api' && compB.type === 'data') {
      return { type: 'queries', label: 'Read/Write' };
    }
    
    // API → Integration
    if (compA.type === 'api' && compB.type === 'integration') {
      return { type: 'calls', label: 'External API' };
    }
    
    // Core → Data
    if (compA.type === 'core' && compB.type === 'data') {
      return { type: 'uses', label: 'Data Access' };
    }
    
    return null;
  }

  // Get nodes for a specific LOD level and optional parent
  getNodesForLOD(lod, parentId = null) {
    const nodes = [];
    const edges = [];
    
    if (lod === 4) {
      // Group definitions: which component types belong to which group
      const groupMapping = {
        ui: 'frontend',
        realtime: 'frontend',
        api: 'backend',
        core: 'backend',
        data: 'backend',
        integration: 'external',
      };
      
      const groupConfig = {
        frontend: { label: 'Frontend', width: 700, height: 380 },
        backend: { label: 'Backend', width: 720, height: 600 },
        external: { label: 'External', width: 360, height: 340 },
      };
      
      // Track which groups we actually need
      const usedGroups = new Set();
      const componentsByGroup = { frontend: [], backend: [], external: [] };
      
      // Categorize components
      for (const c of this.architecture.components) {
        const group = groupMapping[c.type] || 'backend';
        usedGroups.add(group);
        componentsByGroup[group].push(c);
      }
      
      // Calculate group positions and sizes
      const groupPositions = {
        frontend: { x: 50, y: 50 },
        external: { x: 800, y: 50 },
        backend: { x: 425, y: 450 },
      };
      
      // Create group nodes first (they need to come before children)
      for (const groupType of usedGroups) {
        const config = groupConfig[groupType];
        const pos = groupPositions[groupType];
        
        // Adjust size based on number of components
        const componentCount = componentsByGroup[groupType].length;
        const cols = Math.min(componentCount, 2);
        const rows = Math.ceil(componentCount / 2);
        const adjustedWidth = Math.max(config.width, cols * 340 + 60);
        const adjustedHeight = Math.max(config.height, rows * 280 + 80);
        
        nodes.push({
          id: `group_${groupType}`,
          type: 'group',
          position: pos,
          data: {
            groupType,
            label: config.label,
            width: adjustedWidth,
            height: adjustedHeight,
          },
          style: {
            width: adjustedWidth,
            height: adjustedHeight,
          },
        });
      }
      
      // Create component nodes within groups
      for (const groupType of usedGroups) {
        const components = componentsByGroup[groupType];
        const cols = Math.min(components.length, 2);
        
        components.forEach((c, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          
          nodes.push({
            id: c.id,
            type: 'architecture',
            parentNode: `group_${groupType}`,
            extent: 'parent',
            position: {
              x: 30 + col * 340,
              y: 50 + row * 280,
            },
            data: {
              label: c.name,
              compType: c.type,
              description: c.description,
              icon: c.icon,
              tech: c.tech,
              capabilities: c.capabilities,
              fileCount: c.files.length,
              hasChildren: this.architecture.subSystems.some(s => s.parentId === c.id),
            },
          });
        });
      }
      
      // Add edges between groups
      edges.push(...this.relationships.filter(r => r.lod === 4).map(r => ({
        id: r.id,
        source: r.source,
        target: r.target,
        label: r.label,
        type: 'smoothstep',
        animated: true,
      })));
    }
    
    else if (lod === 3) {
      // Sub-systems - either all or filtered by parent
      const subs = parentId 
        ? this.architecture.subSystems.filter(s => s.parentId === parentId)
        : this.architecture.subSystems;
      
      // Add parent node for context if filtering (positioned at top-left)
      if (parentId) {
        const parent = this.architecture.components.find(c => c.id === parentId);
        if (parent) {
          nodes.push({
            id: parent.id,
            type: 'architecture',
            position: { x: 50, y: 50 },
            data: { 
              label: parent.name,
              compType: parent.type,
              description: parent.description,
              icon: parent.icon,
              tech: parent.tech,
              capabilities: parent.capabilities,
              fileCount: parent.files.length,
              isContext: true,
              hasChildren: false,
            },
          });
        }
      }
      
      // Create a group container for sub-systems
      const cols = Math.min(subs.length, 3);
      const rows = Math.ceil(subs.length / cols);
      const groupWidth = cols * 280 + 60;
      const groupHeight = rows * 240 + 80;
      
      nodes.push({
        id: 'group_subsystems',
        type: 'group',
        position: { x: 400, y: 30 },
        data: {
          groupType: 'backend',  // Use backend style (green) for sub-systems
          label: 'Sub-systems',
          width: groupWidth,
          height: groupHeight,
        },
        style: {
          width: groupWidth,
          height: groupHeight,
        },
      });
      
      // Position sub-systems within the group
      subs.forEach((s, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        
        nodes.push({
          id: s.id,
          type: 'subsystem',
          parentNode: 'group_subsystems',
          extent: 'parent',
          position: {
            x: 30 + col * 280,
            y: 50 + row * 240,
          },
          data: {
            label: s.name,
            description: s.description,
            icon: s.icon,
            fileCount: s.files.length,
            parentId: s.parentId,
            features: s.features || [],
            hasChildren: s.files.length > 0,
          },
        });
      });
    }
    
    else if (lod === 2) {
      // Classes - filtered by parent sub-system
      let classes = this.architecture.classes;
      let parentSubSystem = null;
      
      if (parentId) {
        parentSubSystem = this.architecture.subSystems.find(s => s.id === parentId);
        if (parentSubSystem) {
          classes = classes.filter(c => parentSubSystem.files.includes(c.filePath));
        }
      }
      
      // If no classes found but we have files, create file nodes with function extraction
      if (classes.length === 0 && parentSubSystem && parentSubSystem.files.length > 0) {
        for (const filePath of parentSubSystem.files) {
          const file = this.files.find(f => f.relativePath === filePath);
          if (file) {
            // Extract functions from file
            const functions = this.extractFunctions(file.content);
            const fileName = path.basename(filePath);
            const parentDir = path.dirname(filePath).split('/').pop() || '';
            
            // Use parent dir + filename for better labeling
            const label = parentDir ? `${parentDir}/${fileName}` : fileName;
            
            classes.push({
              id: `file_${filePath.replace(/[^a-z0-9]/gi, '_')}`,
              name: label,
              type: 'module',
              methods: functions,
              properties: [],
              filePath: filePath,
            });
            
            // Store the file content for LOD0
            this.architecture.codeSnippets[`file_${filePath.replace(/[^a-z0-9]/gi, '_')}`] = file.content;
          }
        }
      }
      
      // Create group for classes/modules
      const cols = Math.min(classes.length, 3);
      const rows = Math.ceil(classes.length / cols);
      const groupWidth = cols * 280 + 60;
      const groupHeight = rows * 200 + 80;
      
      if (classes.length > 0) {
        nodes.push({
          id: 'group_classes',
          type: 'group',
          position: { x: 50, y: 50 },
          data: {
            groupType: 'frontend',  // Purple for classes
            label: 'Modules & Classes',
            width: groupWidth,
            height: groupHeight,
          },
          style: {
            width: groupWidth,
            height: groupHeight,
          },
        });
      }
      
      // Position class nodes within group
      classes.forEach((c, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        
        nodes.push({
          id: c.id,
          type: 'class',
          parentNode: classes.length > 0 ? 'group_classes' : undefined,
          extent: classes.length > 0 ? 'parent' : undefined,
          position: {
            x: 30 + col * 280,
            y: 50 + row * 200,
          },
          data: {
            label: c.name,
            classType: c.type,
            extends: c.extends,
            methodCount: c.methods?.length || 0,
            propertyCount: c.properties?.length || 0,
            methods: (c.methods || []).slice(0, 5),
            hasChildren: true,
            filePath: c.filePath,
          },
        });
      });
      
      // Add class relationships
      edges.push(...this.relationships.filter(r => 
        r.lod === 2 && 
        nodes.some(n => n.id === r.source) &&
        nodes.some(n => n.id === r.target)
      ).map(r => ({
        id: r.id,
        source: r.source,
        target: r.target,
        label: r.type,
        type: 'smoothstep',
        animated: r.type === 'uses',
        style: r.type === 'extends' ? { strokeWidth: 2 } : {},
      })));
    }
    
    else if (lod === 1) {
      // Class details - specific class
      let cls = parentId 
        ? this.architecture.classes.find(c => c.id === parentId)
        : this.architecture.classes[0];
      
      // If not found in classes, check if it's a file node (created on-the-fly in LOD2)
      if (!cls && parentId && this.architecture.codeSnippets[parentId]) {
        const code = this.architecture.codeSnippets[parentId];
        const functions = this.extractFunctions(code);
        
        // Extract only exports and UPPER_CASE constants (not local vars or imports)
        const properties = [];
        
        // module.exports.X or exports.X (that aren't functions)
        const exportPattern = /(?:module\.)?exports\.(\w+)\s*=\s*(?!function|async|\()/g;
        let match;
        while ((match = exportPattern.exec(code)) !== null) {
          if (!properties.includes(match[1]) && !functions.includes(match[1])) {
            properties.push(match[1]);
          }
        }
        
        // UPPER_CASE constants (likely config values)
        const constPattern = /const\s+([A-Z][A-Z0-9_]+)\s*=/g;
        while ((match = constPattern.exec(code)) !== null) {
          if (!properties.includes(match[1])) {
            properties.push(match[1]);
          }
        }
        
        cls = {
          id: parentId,
          name: parentId.replace(/^file_/, '').replace(/_/g, '/'),
          type: 'module',
          methods: functions,
          properties: properties.slice(0, 10),
        };
      }
      
      if (cls) {
        // Add class node
        nodes.push({
          id: cls.id,
          type: 'classDetail',
          position: { x: 50, y: 150 },
          data: {
            label: cls.name,
            classType: cls.type,
            extends: cls.extends,
            methods: cls.methods,
            properties: cls.properties,
          },
        });
        
        // Add method nodes in a grouped layout
        const methodCols = Math.min(cls.methods.length, 4);
        cls.methods.forEach((method, i) => {
          const col = i % methodCols;
          const row = Math.floor(i / methodCols);
          const methodId = `${cls.id}_method_${i}`;
          nodes.push({
            id: methodId,
            type: 'method',
            position: {
              x: 350 + col * 180,
              y: 80 + row * 70,
            },
            data: { label: method },
          });
          edges.push({
            id: `edge_${methodId}`,
            source: cls.id,
            target: methodId,
            type: 'smoothstep',
          });
        });
        
        // Add property nodes below methods
        const propStartY = 80 + Math.ceil(cls.methods.length / Math.max(methodCols, 1)) * 70 + 40;
        const propCols = Math.min(cls.properties.length, 4);
        cls.properties.forEach((prop, i) => {
          const col = i % propCols;
          const row = Math.floor(i / propCols);
          const propId = `${cls.id}_prop_${i}`;
          nodes.push({
            id: propId,
            type: 'property',
            position: {
              x: 350 + col * 180,
              y: propStartY + row * 60,
            },
            data: { label: prop },
          });
          edges.push({
            id: `edge_${propId}`,
            source: cls.id,
            target: propId,
            type: 'smoothstep',
            style: { strokeDasharray: '5,5' },
          });
        });
      }
    }
    
    else if (lod === 0) {
      // Code view - return code for class or method
      
      // Check if parent is a class
      let cls = parentId 
        ? this.architecture.classes.find(c => c.id === parentId)
        : null;
      
      if (cls) {
        return {
          nodes: [],
          edges: [],
          code: this.architecture.codeSnippets[cls.id] || cls.code || '',
          className: cls.name,
          filePath: cls.filePath,
        };
      }
      
      // Check if parent is a method - parse class ID from method ID format: class_XX_method_YY
      if (parentId && parentId.includes('_method_')) {
        const classId = parentId.split('_method_')[0];
        const methodIndex = parseInt(parentId.split('_method_')[1]);
        
        // Check classes first
        const c = this.architecture.classes.find(cls => cls.id === classId);
        if (c) {
          const methodName = c.methods?.[methodIndex] || '';
          const classCode = this.architecture.codeSnippets[c.id] || c.code || '';
          return {
            nodes: [],
            edges: [],
            code: classCode,
            className: methodName ? `${c.name}.${methodName}()` : c.name,
            filePath: c.filePath,
          };
        }
        
        // Check if it's a file node
        const fileCode = this.architecture.codeSnippets[classId];
        if (fileCode) {
          const fileName = classId.replace('file_', '').replace(/_/g, '/');
          return {
            nodes: [],
            edges: [],
            code: fileCode,
            className: fileName,
            filePath: fileName,
          };
        }
      }
      
      // Check if parent is a property - parse class ID from prop ID format: class_XX_prop_YY
      if (parentId && parentId.includes('_prop_')) {
        const classId = parentId.split('_prop_')[0];
        
        // Check classes first
        const c = this.architecture.classes.find(cls => cls.id === classId);
        if (c) {
          const classCode = this.architecture.codeSnippets[c.id] || c.code || '';
          return {
            nodes: [],
            edges: [],
            code: classCode,
            className: c.name,
            filePath: c.filePath,
          };
        }
        
        // Check if it's a file node
        const fileCode = this.architecture.codeSnippets[classId];
        if (fileCode) {
          const fileName = classId.replace('file_', '').replace(/_/g, '/');
          return {
            nodes: [],
            edges: [],
            code: fileCode,
            className: fileName,
            filePath: fileName,
          };
        }
      }
      
      // Check if parent is a file node (file_xxx)
      if (parentId && parentId.startsWith('file_')) {
        const code = this.architecture.codeSnippets[parentId];
        if (code) {
          // Extract filename from the ID
          const fileName = parentId.replace('file_', '').replace(/_/g, '/').split('/').pop();
          return {
            nodes: [],
            edges: [],
            code: code,
            className: fileName || 'File',
            filePath: parentId.replace('file_', '').replace(/_/g, '/'),
          };
        }
      }
      
      // Fallback - try to find class by substring match
      if (parentId) {
        const c = this.architecture.classes.find(cls => 
          parentId.includes(cls.id) || cls.id.includes(parentId)
        );
        if (c) {
          return {
            nodes: [],
            edges: [],
            code: this.architecture.codeSnippets[c.id] || c.code || '',
            className: c.name,
            filePath: c.filePath,
          };
        }
        
        // Also check codeSnippets directly
        const directCode = this.architecture.codeSnippets[parentId];
        if (directCode) {
          return {
            nodes: [],
            edges: [],
            code: directCode,
            className: parentId,
            filePath: '',
          };
        }
      }
      
      return { nodes: [], edges: [], code: null, className: null, filePath: null };
    }
    
    return { nodes, edges };
  }

  // Get code for a specific node
  getCode(nodeId) {
    const cls = this.architecture.classes.find(c => c.id === nodeId);
    if (cls) {
      return {
        code: this.architecture.codeSnippets[nodeId],
        name: cls.name,
        filePath: cls.filePath,
      };
    }
    return null;
  }
}

module.exports = { SemanticAnalyzer };
