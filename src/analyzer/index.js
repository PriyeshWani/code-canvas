/**
 * Code Analyzer - Extracts structure from codebases
 * Supports: JavaScript, TypeScript, Python
 */

const fs = require('fs');
const path = require('path');

// File patterns to analyze
const PATTERNS = {
  js: /\.(js|jsx|mjs)$/,
  ts: /\.(ts|tsx)$/,
  py: /\.py$/,
};

// Patterns to skip
const SKIP_DIRS = ['node_modules', '.git', 'dist', 'build', '__pycache__', '.next', 'coverage'];

class CodeAnalyzer {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.files = [];
    this.structure = {
      packages: [],    // L1: High-level packages/services
      modules: [],     // L2: Files/modules
      classes: [],     // L3: Classes/interfaces
      functions: [],   // L4: Functions/methods
      connections: [], // Dependencies between nodes
    };
    this.nodeId = 0;
  }

  /**
   * Generate unique node ID
   */
  genId() {
    return `node_${++this.nodeId}`;
  }

  /**
   * Scan directory for source files
   */
  scanDirectory(dir = this.rootPath) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.includes(entry.name)) {
          this.scanDirectory(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = Object.entries(PATTERNS).find(([_, pattern]) => pattern.test(entry.name));
        if (ext) {
          this.files.push({
            path: fullPath,
            relativePath: path.relative(this.rootPath, fullPath),
            language: ext[0],
          });
        }
      }
    }
    
    return this.files;
  }

  /**
   * Parse JavaScript/TypeScript file
   */
  parseJSFile(file) {
    const content = fs.readFileSync(file.path, 'utf8');
    const result = {
      imports: [],
      exports: [],
      classes: [],
      functions: [],
    };

    // Extract imports
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*,?\s*)*from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      result.imports.push(match[1]);
    }

    // Extract require statements
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      result.imports.push(match[1]);
    }

    // Extract classes
    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?/g;
    while ((match = classRegex.exec(content)) !== null) {
      const classInfo = { name: match[1], extends: match[2] || null, methods: [] };
      
      // Find methods in this class (simplified)
      const classStart = match.index;
      const methodRegex = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/g;
      methodRegex.lastIndex = classStart;
      
      let methodMatch;
      let braceCount = 0;
      let inClass = false;
      
      for (let i = classStart; i < content.length && i < classStart + 5000; i++) {
        if (content[i] === '{') {
          if (!inClass) inClass = true;
          braceCount++;
        } else if (content[i] === '}') {
          braceCount--;
          if (braceCount === 0 && inClass) break;
        }
      }
      
      const classContent = content.slice(classStart, classStart + 5000);
      const methodInClassRegex = /(?:async\s+)?(?:static\s+)?(\w+)\s*\([^)]*\)\s*\{/g;
      while ((methodMatch = methodInClassRegex.exec(classContent)) !== null) {
        if (methodMatch[1] !== 'class' && methodMatch[1] !== 'if' && methodMatch[1] !== 'for' && methodMatch[1] !== 'while') {
          classInfo.methods.push(methodMatch[1]);
        }
      }
      
      result.classes.push(classInfo);
    }

    // Extract standalone functions
    const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g;
    while ((match = funcRegex.exec(content)) !== null) {
      result.functions.push(match[1]);
    }

    // Extract arrow function exports
    const arrowExportRegex = /export\s+(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
    while ((match = arrowExportRegex.exec(content)) !== null) {
      result.functions.push(match[1]);
    }

    // Extract exports
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var)?\s*(\w+)/g;
    while ((match = exportRegex.exec(content)) !== null) {
      result.exports.push(match[1]);
    }

    return result;
  }

  /**
   * Parse Python file
   */
  parsePyFile(file) {
    const content = fs.readFileSync(file.path, 'utf8');
    const result = {
      imports: [],
      exports: [],
      classes: [],
      functions: [],
    };

    // Extract imports
    const importRegex = /(?:from\s+(\S+)\s+)?import\s+([^#\n]+)/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      result.imports.push(match[1] || match[2].trim());
    }

    // Extract classes
    const classRegex = /class\s+(\w+)(?:\(([^)]*)\))?:/g;
    while ((match = classRegex.exec(content)) !== null) {
      const classInfo = { name: match[1], extends: match[2] || null, methods: [] };
      
      // Find methods (def inside class - simplified)
      const classStart = match.index;
      const indent = content.slice(0, classStart).split('\n').pop().length;
      const lines = content.slice(classStart).split('\n');
      
      for (const line of lines.slice(1)) {
        const lineIndent = line.match(/^\s*/)[0].length;
        if (lineIndent <= indent && line.trim()) break;
        
        const methodMatch = line.match(/def\s+(\w+)\s*\(/);
        if (methodMatch) {
          classInfo.methods.push(methodMatch[1]);
        }
      }
      
      result.classes.push(classInfo);
    }

    // Extract standalone functions
    const funcRegex = /^def\s+(\w+)\s*\(/gm;
    while ((match = funcRegex.exec(content)) !== null) {
      result.functions.push(match[1]);
    }

    return result;
  }

  /**
   * Build structure from parsed files
   */
  buildStructure() {
    // Group files by directory for packages
    const packages = new Map();
    
    for (const file of this.files) {
      const parts = file.relativePath.split(path.sep);
      const pkg = parts.length > 1 ? parts[0] : 'root';
      
      if (!packages.has(pkg)) {
        packages.set(pkg, {
          id: this.genId(),
          name: pkg,
          type: 'package',
          lod: 1,
          files: [],
        });
      }
      
      // Parse file
      let parsed;
      if (file.language === 'py') {
        parsed = this.parsePyFile(file);
      } else {
        parsed = this.parseJSFile(file);
      }
      
      // Create module node
      const moduleNode = {
        id: this.genId(),
        name: path.basename(file.relativePath),
        path: file.relativePath,
        type: 'module',
        lod: 2,
        parentId: packages.get(pkg).id,
        imports: parsed.imports,
        exports: parsed.exports,
      };
      
      this.structure.modules.push(moduleNode);
      packages.get(pkg).files.push(moduleNode.id);
      
      // Create class nodes
      for (const cls of parsed.classes) {
        const classNode = {
          id: this.genId(),
          name: cls.name,
          type: 'class',
          lod: 3,
          parentId: moduleNode.id,
          extends: cls.extends,
          methods: cls.methods,
        };
        this.structure.classes.push(classNode);
        
        // Create function nodes for methods
        for (const method of cls.methods) {
          this.structure.functions.push({
            id: this.genId(),
            name: method,
            type: 'method',
            lod: 4,
            parentId: classNode.id,
          });
        }
      }
      
      // Create function nodes for standalone functions
      for (const func of parsed.functions) {
        this.structure.functions.push({
          id: this.genId(),
          name: func,
          type: 'function',
          lod: 4,
          parentId: moduleNode.id,
        });
      }
    }
    
    this.structure.packages = Array.from(packages.values());
    
    // Build connections based on imports
    this.buildConnections();
    
    return this.structure;
  }

  /**
   * Build connections between nodes based on imports
   */
  buildConnections() {
    for (const module of this.structure.modules) {
      for (const imp of module.imports) {
        // Find target module
        const target = this.structure.modules.find(m => {
          const impNormalized = imp.replace(/^[./]+/, '').replace(/\.[jt]sx?$/, '');
          const pathNormalized = m.path.replace(/\.[jt]sx?$/, '');
          return pathNormalized.includes(impNormalized) || impNormalized.includes(pathNormalized);
        });
        
        if (target) {
          this.structure.connections.push({
            id: this.genId(),
            source: module.id,
            target: target.id,
            type: 'import',
            lod: 2,
          });
        }
      }
    }
  }

  /**
   * Run full analysis
   */
  analyze() {
    console.log(`Analyzing: ${this.rootPath}`);
    this.scanDirectory();
    console.log(`Found ${this.files.length} source files`);
    this.buildStructure();
    console.log(`Built structure: ${this.structure.packages.length} packages, ${this.structure.modules.length} modules, ${this.structure.classes.length} classes`);
    return this.structure;
  }

  /**
   * Get nodes for a specific LOD level
   */
  getNodesForLOD(lod) {
    const nodes = [];
    const edges = [];
    
    if (lod >= 1) {
      nodes.push(...this.structure.packages.map(p => ({
        id: p.id,
        type: 'package',
        data: { label: p.name, nodeType: 'package' },
        position: { x: 0, y: 0 }, // Will be calculated by layout
      })));
    }
    
    if (lod >= 2) {
      nodes.push(...this.structure.modules.map(m => ({
        id: m.id,
        type: 'module',
        data: { label: m.name, nodeType: 'module', path: m.path },
        position: { x: 0, y: 0 },
        parentNode: m.parentId,
      })));
      
      edges.push(...this.structure.connections.filter(c => c.lod <= lod).map(c => ({
        id: c.id,
        source: c.source,
        target: c.target,
        type: 'smoothstep',
        animated: true,
      })));
    }
    
    if (lod >= 3) {
      nodes.push(...this.structure.classes.map(c => ({
        id: c.id,
        type: 'class',
        data: { label: c.name, nodeType: 'class', methods: c.methods, extends: c.extends },
        position: { x: 0, y: 0 },
        parentNode: c.parentId,
      })));
    }
    
    if (lod >= 4) {
      nodes.push(...this.structure.functions.map(f => ({
        id: f.id,
        type: 'function',
        data: { label: f.name, nodeType: f.type },
        position: { x: 0, y: 0 },
        parentNode: f.parentId,
      })));
    }
    
    return { nodes, edges };
  }

  /**
   * Generate high-level architecture (LOD 0)
   * Derives system components from code patterns
   */
  generateArchitecture() {
    const architecture = {
      components: [],
      connections: [],
    };
    
    const components = new Map(); // type -> component
    
    // Analyze each file to detect architectural patterns
    for (const file of this.files) {
      const content = fs.readFileSync(file.path, 'utf8');
      const fileName = path.basename(file.path).toLowerCase();
      const dirName = path.dirname(file.relativePath).toLowerCase();
      
      // Detect Frontend
      if (this.detectFrontend(content, fileName, dirName)) {
        if (!components.has('frontend')) {
          components.set('frontend', {
            id: this.genId(),
            type: 'frontend',
            name: 'Frontend',
            icon: '🖥️',
            tech: [],
            files: [],
          });
        }
        const comp = components.get('frontend');
        comp.files.push(file.relativePath);
        if (content.includes('react') || content.includes('React')) comp.tech.push('React');
        if (content.includes('vue') || content.includes('Vue')) comp.tech.push('Vue');
        if (fileName.includes('.html')) comp.tech.push('HTML');
      }
      
      // Detect API/Backend Server
      if (this.detectAPIServer(content, fileName)) {
        if (!components.has('api')) {
          components.set('api', {
            id: this.genId(),
            type: 'api',
            name: 'API Server',
            icon: '⚡',
            tech: [],
            files: [],
            endpoints: [],
          });
        }
        const comp = components.get('api');
        comp.files.push(file.relativePath);
        if (content.includes('express')) comp.tech.push('Express');
        if (content.includes('fastify')) comp.tech.push('Fastify');
        if (content.includes('http.createServer') || content.includes('createServer')) comp.tech.push('Node HTTP');
        
        // Extract endpoints
        const endpointMatches = content.matchAll(/(?:get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi);
        for (const match of endpointMatches) {
          comp.endpoints.push(match[1]);
        }
      }
      
      // Detect Database
      if (this.detectDatabase(content)) {
        if (!components.has('database')) {
          components.set('database', {
            id: this.genId(),
            type: 'database',
            name: 'Database',
            icon: '🗄️',
            tech: [],
            files: [],
          });
        }
        const comp = components.get('database');
        comp.files.push(file.relativePath);
        if (content.includes('mongodb') || content.includes('mongoose')) comp.tech.push('MongoDB');
        if (content.includes('postgres') || content.includes('pg')) comp.tech.push('PostgreSQL');
        if (content.includes('mysql')) comp.tech.push('MySQL');
        if (content.includes('sqlite')) comp.tech.push('SQLite');
        if (content.includes('redis')) comp.tech.push('Redis');
      }
      
      // Detect External APIs
      if (this.detectExternalAPI(content)) {
        if (!components.has('external')) {
          components.set('external', {
            id: this.genId(),
            type: 'external',
            name: 'External Services',
            icon: '🌐',
            tech: [],
            files: [],
            services: [],
          });
        }
        const comp = components.get('external');
        comp.files.push(file.relativePath);
        
        // Detect specific services
        if (content.includes('openai')) comp.services.push('OpenAI');
        if (content.includes('stripe')) comp.services.push('Stripe');
        if (content.includes('aws') || content.includes('s3')) comp.services.push('AWS');
        if (content.includes('firebase')) comp.services.push('Firebase');
        if (content.includes('twilio')) comp.services.push('Twilio');
        if (content.match(/fetch\s*\(\s*['"`]https?:\/\//)) comp.services.push('REST APIs');
        if (content.includes('rss') || content.includes('xml')) comp.services.push('RSS Feeds');
      }
      
      // Detect WebSocket/Realtime
      if (this.detectWebSocket(content)) {
        if (!components.has('realtime')) {
          components.set('realtime', {
            id: this.genId(),
            type: 'realtime',
            name: 'Realtime Layer',
            icon: '🔄',
            tech: [],
            files: [],
          });
        }
        const comp = components.get('realtime');
        comp.files.push(file.relativePath);
        if (content.includes('WebSocket') || content.includes('ws')) comp.tech.push('WebSocket');
        if (content.includes('socket.io')) comp.tech.push('Socket.io');
      }
      
      // Detect File Storage
      if (this.detectFileStorage(content)) {
        if (!components.has('storage')) {
          components.set('storage', {
            id: this.genId(),
            type: 'storage',
            name: 'File Storage',
            icon: '📁',
            tech: [],
            files: [],
          });
        }
        const comp = components.get('storage');
        comp.files.push(file.relativePath);
        if (content.includes('multer')) comp.tech.push('Multer');
        if (content.includes('s3') || content.includes('S3')) comp.tech.push('S3');
        if (content.includes('writeFile') || content.includes('readFile')) comp.tech.push('Local FS');
      }
      
      // Detect Authentication
      if (this.detectAuth(content)) {
        if (!components.has('auth')) {
          components.set('auth', {
            id: this.genId(),
            type: 'auth',
            name: 'Authentication',
            icon: '🔐',
            tech: [],
            files: [],
          });
        }
        const comp = components.get('auth');
        comp.files.push(file.relativePath);
        if (content.includes('jwt') || content.includes('jsonwebtoken')) comp.tech.push('JWT');
        if (content.includes('passport')) comp.tech.push('Passport');
        if (content.includes('oauth')) comp.tech.push('OAuth');
        if (content.includes('bcrypt')) comp.tech.push('bcrypt');
      }
    }
    
    // Deduplicate tech arrays
    for (const comp of components.values()) {
      comp.tech = [...new Set(comp.tech)];
      if (comp.services) comp.services = [...new Set(comp.services)];
      if (comp.endpoints) comp.endpoints = [...new Set(comp.endpoints)].slice(0, 10);
      architecture.components.push(comp);
    }
    
    // Generate connections based on typical patterns
    const compArray = architecture.components;
    const findComp = (type) => compArray.find(c => c.type === type);
    
    const frontend = findComp('frontend');
    const api = findComp('api');
    const database = findComp('database');
    const external = findComp('external');
    const realtime = findComp('realtime');
    const storage = findComp('storage');
    const auth = findComp('auth');
    
    // Frontend → API
    if (frontend && api) {
      architecture.connections.push({
        id: this.genId(),
        source: frontend.id,
        target: api.id,
        label: 'HTTP/REST',
      });
    }
    
    // Frontend → Realtime
    if (frontend && realtime) {
      architecture.connections.push({
        id: this.genId(),
        source: frontend.id,
        target: realtime.id,
        label: 'WebSocket',
      });
    }
    
    // API → Database
    if (api && database) {
      architecture.connections.push({
        id: this.genId(),
        source: api.id,
        target: database.id,
        label: 'Query',
      });
    }
    
    // API → External
    if (api && external) {
      architecture.connections.push({
        id: this.genId(),
        source: api.id,
        target: external.id,
        label: 'API Calls',
      });
    }
    
    // API → Storage
    if (api && storage) {
      architecture.connections.push({
        id: this.genId(),
        source: api.id,
        target: storage.id,
        label: 'Read/Write',
      });
    }
    
    // API → Auth
    if (api && auth) {
      architecture.connections.push({
        id: this.genId(),
        source: api.id,
        target: auth.id,
        label: 'Verify',
      });
    }
    
    // Realtime → API (often shares backend)
    if (realtime && api) {
      architecture.connections.push({
        id: this.genId(),
        source: realtime.id,
        target: api.id,
        label: 'Events',
        style: 'dashed',
      });
    }
    
    return architecture;
  }

  // Detection helpers
  detectFrontend(content, fileName, dirName) {
    return fileName.endsWith('.jsx') || 
           fileName.endsWith('.tsx') ||
           fileName.endsWith('.vue') ||
           dirName.includes('frontend') ||
           dirName.includes('client') ||
           dirName.includes('components') ||
           content.includes('ReactDOM') ||
           content.includes('createRoot') ||
           content.includes('useState') ||
           content.includes('document.getElementById');
  }

  detectAPIServer(content, fileName) {
    return content.includes('createServer') ||
           content.includes('express()') ||
           content.includes('app.listen') ||
           content.includes('server.listen') ||
           content.includes('fastify') ||
           (fileName === 'server.js') ||
           (fileName === 'app.js' && content.includes('listen'));
  }

  detectDatabase(content) {
    return content.includes('mongoose') ||
           content.includes('mongodb') ||
           content.includes('sequelize') ||
           content.includes('knex') ||
           content.includes('prisma') ||
           content.includes('pg.') ||
           content.includes('mysql') ||
           content.includes('sqlite') ||
           content.includes('redis') ||
           content.includes('createConnection');
  }

  detectExternalAPI(content) {
    return content.match(/fetch\s*\(\s*['"`]https?:\/\//) ||
           content.includes('axios') ||
           content.includes('request(') ||
           content.includes('got(') ||
           content.includes('https.get') ||
           content.includes('http.get');
  }

  detectWebSocket(content) {
    return content.includes('WebSocket') ||
           content.includes('WebSocketServer') ||
           content.includes('socket.io') ||
           content.includes("require('ws')") ||
           content.includes('from "ws"');
  }

  detectFileStorage(content) {
    return content.includes('multer') ||
           content.includes('writeFile') ||
           content.includes('createWriteStream') ||
           content.includes('S3Client') ||
           content.includes('putObject') ||
           content.includes('uploadFile');
  }

  detectAuth(content) {
    return content.includes('jwt') ||
           content.includes('jsonwebtoken') ||
           content.includes('passport') ||
           content.includes('authenticate') ||
           content.includes('bcrypt') ||
           content.includes('oauth') ||
           content.includes('session') && content.includes('cookie');
  }
}

module.exports = { CodeAnalyzer };
