# Visual Rule Builder - New Implementation Plan

## Overview

Build a new visual rule builder from scratch. This will be a node-based interface where users drag and drop nodes to create feed assignment rules.

## Architecture Decision

### Frontend Stack
- **Framework**: React (modern, component-based)
- **Node Editor**: React Flow (industry standard for node-based UIs)
- **Styling**: Tailwind CSS (modern, utility-first)
- **State Management**: React hooks (useState, useReducer)
- **API**: REST API to save/load rules

### Backend Integration
- Visual editor saves rules as JSONB to `feeds.assignment_rules`
- Rule evaluation engine reads this JSONB
- Two-way sync: load existing rules, edit, save

## MVP Features (Phase 1)

### Core Functionality
1. **Node Types**
   - START node (entry point)
   - END node (output)
   - Logic nodes: AND, OR
   - Condition nodes: Text, Language, Post Type, Like Count, Author, Media Type

2. **Basic Operations**
   - Drag nodes from sidebar
   - Connect nodes with edges
   - Configure node parameters
   - Save/load rules

3. **Rule Structure**
   - Simple: START → Conditions → Logic → END
   - Groups: Multiple condition groups with OR logic
   - Each group: AND logic (all conditions must match)

### JSON Output Format

```json
{
  "logic": "OR",
  "groups": [
    {
      "logic": "AND",
      "conditions": [
        {
          "type": "text",
          "operator": "contains",
          "value": "urbanism"
        },
        {
          "type": "like_count",
          "operator": ">=",
          "value": 100
        }
      ]
    },
    {
      "logic": "AND",
      "conditions": [
        {
          "type": "author",
          "operator": "in_list",
          "value": "list-uuid-123"
        }
      ]
    }
  ]
}
```

## UI Design

### Layout
```
┌─────────────────────────────────────────────────────────┐
│  Header: Feed Name | Save | Preview                     │
├──────────┬──────────────────────────────────────────────┤
│          │                                               │
│ Sidebar  │          Canvas (Node Editor)                │
│          │                                               │
│ - Logic  │  [START] → [Text] → [AND] → [END]           │
│ - Cond.  │                                               │
│ - etc.   │                                               │
│          │                                               │
└──────────┴──────────────────────────────────────────────┘
```

### Node Types

**START Node**
- Green color
- Single output port
- No configuration

**END Node**
- Green color
- Single input port
- Shows preview of matching posts count

**AND/OR Logic Nodes**
- Red color
- Multiple input ports (conditions)
- Single output port
- Toggle between AND/OR

**Condition Nodes**
- Gray color
- Single input port (from START or logic)
- Single output port (to logic or END)
- Configurable: field, operator, value

## Implementation Steps

### Phase 1: Basic Editor
1. Set up React + React Flow project
2. Create canvas with START and END nodes
3. Add sidebar with node types
4. Implement drag-and-drop
5. Implement node connections
6. Basic node configuration UI

### Phase 2: Rule Logic
1. Implement AND/OR logic nodes
2. Support multiple condition groups
3. Visual grouping of conditions
4. Rule validation

### Phase 3: Save/Load
1. API endpoint to save rules
2. API endpoint to load rules
3. Convert visual graph to JSON
4. Convert JSON to visual graph
5. Preview matching posts count

### Phase 4: Advanced Features (Future)
- Scoring nodes
- Module integration
- Sorting configuration
- Injection modules

## File Structure

```
services/visual-editor/
├── package.json
├── vite.config.js (or similar)
├── index.html
├── src/
│   ├── App.jsx
│   ├── components/
│   │   ├── Canvas.jsx
│   │   ├── Sidebar.jsx
│   │   ├── NodeTypes.jsx
│   │   └── NodeConfig.jsx
│   ├── nodes/
│   │   ├── StartNode.jsx
│   │   ├── EndNode.jsx
│   │   ├── LogicNode.jsx
│   │   └── ConditionNode.jsx
│   ├── utils/
│   │   ├── graphToJson.js
│   │   ├── jsonToGraph.js
│   │   └── validation.js
│   └── api/
│       └── rules.js
└── public/
```

## Technology Choices

### React Flow
- Industry standard (used by n8n, Zapier, etc.)
- Handles node positioning, connections, zooming
- Customizable node types
- Built-in edge routing

### Why Not Use Legacy Code?
- Legacy was incomplete mockup
- Not production-ready
- Different architecture needs
- Clean slate = better design

## Next Steps

1. Set up React project structure
2. Install React Flow
3. Create basic canvas with START/END nodes
4. Add sidebar with node types
5. Implement drag-and-drop
6. Test basic flow
