const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3002');

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'agent_register', agentId: 'clawd-auto' }));
  console.log('✅ Auto-relay connected!');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'prompt_request') {
    const p = msg.prompt;
    console.log('📝 Processing prompt...');
    let r;
    if (p.includes('architecture')) {
      r = { name:'Clawd Workspace', description:'AI workspace with games and tools', pattern:'Microservices', components:[
        {id:'config',name:'AI Config',type:'config',description:'Clawd settings',files:['AGENTS.md','SOUL.md'],technologies:['Markdown'],dependencies:[]},
        {id:'dashboard',name:'Prototyping Lab',type:'ui',description:'Dashboard with games',files:['dashboard/index.html'],technologies:['HTML','Node.js'],dependencies:['news']},
        {id:'games',name:'Games',type:'ui',description:'Box Runner, Snake, Tetris',files:['dashboard/box-runner/index.html'],technologies:['Three.js','Canvas'],dependencies:[]},
        {id:'canvas_ui',name:'Code Canvas UI',type:'ui',description:'Architecture explorer',files:['services/code-canvas/frontend/src/App.jsx'],technologies:['React','React Flow'],dependencies:['canvas_api']},
        {id:'canvas_api',name:'Code Canvas API',type:'api',description:'Analysis server',files:['services/code-canvas/src/api/server.js'],technologies:['Node.js','WebSocket'],dependencies:[]},
        {id:'news',name:'News Service',type:'integration',description:'RSS aggregator',files:['services/news-service/server.js'],technologies:['Node.js'],dependencies:[]}
      ], relationships:[{from:'canvas_ui',to:'canvas_api',type:'calls'},{from:'dashboard',to:'news',type:'calls'}], uncertainAreas:[]};
    } else if (p.includes('sub-systems')) {
      r = { subSystems:[{id:'ss_ui',name:'UI Components',description:'React Flow nodes',files:['components/'],features:['nodes','edges']},{id:'ss_state',name:'State Management',description:'React hooks',files:['App.jsx'],features:['useState']},{id:'ss_api',name:'API Client',description:'Fetch calls',files:['App.jsx'],features:['REST']}]};
    } else if (p.includes('classes')) {
      r = { classes:[{id:'cls_app',name:'App',type:'component',description:'Main app',file:'App.jsx',methods:['fetchNodes','handleAnalyze','handleZoomOut'],properties:['nodes','edges','lod']},{id:'cls_arch',name:'ArchitectureNode',type:'component',description:'Architecture node',file:'ArchitectureNode.jsx',methods:['render'],properties:['data']}], relationships:[{from:'cls_app',to:'cls_arch',type:'uses'}]};
    } else if (p.includes('methods')) {
      r = { methods:[{name:'fetchNodes',description:'Fetch nodes for LOD',params:['lodLevel','parentId'],returns:'Promise'},{name:'handleAnalyze',description:'Run analysis',params:[],returns:'Promise'},{name:'handleZoomOut',description:'Go up one level',params:[],returns:'void'}], properties:[{name:'nodes',description:'Flow nodes',type:'array'},{name:'edges',description:'Flow edges',type:'array'},{name:'lod',description:'Current LOD',type:'number'}]};
    } else { r = {message:'Analyzed'}; }
    ws.send(JSON.stringify({type:'agent_response',promptId:msg.promptId,response:JSON.stringify(r)}));
    console.log('✅ Response sent!');
  }
});

ws.on('close', () => { console.log('Disconnected'); });
ws.on('error', e => console.error('Error:', e.message));

setInterval(() => {}, 60000);
