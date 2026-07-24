/**
 * Initial Canvas State
 * START → Junction → END to signal the flow pattern to users
 */

import { snapToGrid } from './grid'

export const initialNodes = [
  {
    id: 'start',
    type: 'start',
    position: snapToGrid(100, 250),
    data: { label: 'START', containerParent: null },
  },
  {
    id: 'junction-main',
    type: 'junction',
    position: snapToGrid(450, 250),
    data: { label: 'junction', containerParent: null },
  },
  {
    id: 'end',
    type: 'end',
    position: snapToGrid(800, 250),
    data: { label: 'END', containerParent: null },
  },
]

export const initialEdges = [
  {
    id: 'edge-start-junction',
    source: 'start',
    target: 'junction-main',
    sourceHandle: 'output-right',
    targetHandle: 'input-left',
    type: 'ordered',
    style: { stroke: '#51cf66', strokeWidth: 2 },
    data: {},
    markerEnd: { type: 'arrowclosed', color: '#51cf66', width: 20, height: 20 },
  },
  {
    id: 'edge-junction-end',
    source: 'junction-main',
    target: 'end',
    sourceHandle: 'output-right',
    targetHandle: 'input-left',
    type: 'ordered',
    style: { stroke: '#51cf66', strokeWidth: 2 },
    data: {},
    markerEnd: { type: 'arrowclosed', color: '#51cf66', width: 20, height: 20 },
  },
]
