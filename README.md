# 🎨 Code Canvas

Visual code architecture explorer with semantic analysis and LOD (Level of Detail) zoom.

![Code Canvas](https://img.shields.io/badge/React-Flow-blue) ![Node.js](https://img.shields.io/badge/Node.js-22+-green) ![License](https://img.shields.io/badge/License-MIT-yellow)

## What is Code Canvas?

Code Canvas analyzes your codebase and visualizes it as an interactive architecture diagram. Instead of showing folder structures, it understands what your code *does* and groups it semantically:

- **User Interface** — React, Vue, Three.js, Canvas components
- **API Layer** — Express, FastAPI, Flask routes
- **Data Layer** — Database models, ORMs
- **External Services** — Third-party API integrations
- **Real-time** — WebSocket handlers
- **Core Logic** — Business rules and algorithms

## Features

- 🔍 **LOD Zoom** — Drill down from architecture → sub-systems → classes → methods → code
- 🎯 **Semantic Grouping** — Components grouped by function, not folder
- 📊 **Interactive Diagrams** — Pan, zoom, drag nodes with React Flow
- 🔗 **Relationship Mapping** — See how components connect
- 📝 **Change Requests** — Generate prompts for code modifications
- 🌐 **Multi-language** — Supports JavaScript, TypeScript, Python, HTML

## Prerequisites

- Node.js 18+ (recommended: 22+)
- npm or pnpm

## Quick Start

### Option 1: Run with Docker

```bash
# Clone the repo
git clone https://github.com/PriyeshWani/code-canvas.git
cd code-canvas

# Build and run
docker build -t code-canvas .
docker run -p 3002:3002 -v /path/to/your/code:/workspace code-canvas
```

Open http://localhost:3002

### Option 2: Run Locally

```bash
# Clone the repo
git clone https://github.com/PriyeshWani/code-canvas.git
cd code-canvas

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install

# Build frontend
npm run build
cd ..

# Start the server
node src/api/server.js
```

Open http://localhost:3002

### Option 3: Development Mode

```bash
# Terminal 1: Backend
npm install
node src/api/server.js

# Terminal 2: Frontend (with hot reload)
cd frontend
npm install
npm run dev
```

Frontend dev server runs on http://localhost:5173 (proxies API to :3002)

## Usage

1. **Enter Path** — Type the path to analyze (default: `/workspace` in Docker, or any local path)
2. **Click Analyze** — Semantic analysis runs and builds the architecture view
3. **Explore LODs:**
   - **LOD 4** — High-level architecture (UI, API, Data layers)
   - **LOD 3** — Sub-systems within each layer
   - **LOD 2** — Classes and modules
   - **LOD 1** — Methods and properties
   - **LOD 0** — Source code view
4. **Double-click** any node to zoom in
5. **Click** a node to see details in the sidebar
6. **Use breadcrumbs** to navigate back

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3002` | Server port |

### Docker Volume Mounts

Mount your codebase to `/workspace`:

```bash
docker run -p 3002:3002 \
  -v $(pwd)/my-project:/workspace:ro \
  code-canvas
```

The `:ro` flag mounts read-only (recommended for safety).

### Analyzing Different Paths

You can analyze any path accessible to the server. In the UI, enter the full path in the input field before clicking "Analyze".

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/analyze` | POST | Analyze a codebase path |
| `/api/nodes` | GET | Get nodes for current LOD |
| `/api/code` | GET | Get source code for a node |
| `/api/zoom-in` | POST | Zoom into a node |
| `/api/zoom-out` | POST | Zoom out one level |

## Project Structure

```
code-canvas/
├── src/
│   ├── api/
│   │   └── server.js       # Express server + WebSocket
│   └── analyzer/
│       ├── index.js        # Basic analyzer
│       └── semantic.js     # Semantic code analysis
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main React app
│   │   ├── components/     # React Flow node components
│   │   └── styles.css      # Styling
│   └── vite.config.js      # Vite config
├── Dockerfile              # Multi-stage Docker build
└── package.json
```

## Supported Languages

| Language | Classes | Functions | Imports |
|----------|---------|-----------|---------|
| JavaScript/TypeScript | ✅ | ✅ | ✅ |
| Python | ✅ | ✅ | ✅ |
| HTML | ✅ (scripts) | ✅ | — |
| Vue/Svelte | ✅ | ✅ | ✅ |

## Contributing

PRs welcome! Some ideas:
- Add more language parsers (Go, Rust, Java)
- Improve relationship detection
- Add code editing capabilities
- Export diagrams as images

## License

MIT

---

Built with ❤️ using React Flow, Node.js, and semantic code analysis.
