import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from 'reactflow';

export type GraphCompilabilityStatus =
  | 'compilable_anchor'
  | 'seeded_but_not_runnable'
  | 'composition_not_yet_compilable'
  | 'invalid_graph';

export interface GraphSnapshot {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
}

export interface GraphCompilabilityAssessment {
  status: GraphCompilabilityStatus;
  reasons: string[];
  canRunSimulation: boolean;
  isExactSeedMatch: boolean;
  matchedPatternId: string | null;
}

type AssessArgsObject = {
  topology?: string | null;
  selectedTopology?: string | null;
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
  seedGraph?: GraphSnapshot | null;
  seedSnapshot?: GraphSnapshot | null;
  currentGraph?: GraphSnapshot | null;
  workingGraph?: GraphSnapshot | null;
};

function normalizeSnapshot(snapshot: GraphSnapshot | null | undefined): string {
  if (!snapshot) {
    return '';
  }

  const nodes = (snapshot.nodes || [])
    .map((node) => ({
      id: String(node.id),
      type: String(node.type || 'default'),
      position: {
        x: Number(node.position && node.position.x ? node.position.x : 0),
        y: Number(node.position && node.position.y ? node.position.y : 0),
      },
      data: node.data || {},
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const edges = (snapshot.edges || [])
    .map((edge) => ({
      id: String(edge.id),
      source: String(edge.source),
      target: String(edge.target),
      sourceHandle: edge.sourceHandle == null ? null : String(edge.sourceHandle),
      targetHandle: edge.targetHandle == null ? null : String(edge.targetHandle),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return JSON.stringify({ nodes, edges });
}

function hasNodeType(nodes: ReactFlowNode[], wantedType: string): boolean {
  for (let i = 0; i < nodes.length; i += 1) {
    const data = (nodes[i] && nodes[i].data) || {};
    if (data.type === wantedType) {
      return true;
    }
  }
  return false;
}

function countNodeType(nodes: ReactFlowNode[], wantedType: string): number {
  let count = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    const data = (nodes[i] && nodes[i].data) || {};
    if (data.type === wantedType) {
      count += 1;
    }
  }
  return count;
}

function determineTopology(args: AssessArgsObject): string {
  return String(args.topology || args.selectedTopology || 'closed_box');
}

function assessFromNormalizedArgs(args: AssessArgsObject): GraphCompilabilityAssessment {
  const topology = determineTopology(args);
  const nodes = args.nodes || [];
  const edges = args.edges || [];
  const seedGraph = args.seedGraph || args.seedSnapshot || null;
  const currentGraph = args.currentGraph || args.workingGraph || { nodes, edges };

  if (nodes.length === 0) {
    return {
      status: 'invalid_graph',
      reasons: ['graph is empty'],
      canRunSimulation: false,
      isExactSeedMatch: false,
      matchedPatternId: null,
    };
  }

  const hasDriver = hasNodeType(nodes, 'driver');
  const hasVolume = hasNodeType(nodes, 'volume');
  const hasRadiator = hasNodeType(nodes, 'radiator');
  const hasDuct = hasNodeType(nodes, 'duct');

  if (!hasDriver) {
    return {
      status: 'invalid_graph',
      reasons: ['missing required driver primitive'],
      canRunSimulation: false,
      isExactSeedMatch: false,
      matchedPatternId: null,
    };
  }

  if (topology === 'closed_box') {
    if (!hasVolume || !hasRadiator) {
      return {
        status: 'invalid_graph',
        reasons: ['closed box anchor requires driver, volume, and radiator primitives'],
        canRunSimulation: false,
        isExactSeedMatch: false,
        matchedPatternId: 'closed_box_anchor',
      };
    }

    if (hasDuct) {
      return {
        status: 'composition_not_yet_compilable',
        reasons: ['structural edits introduced a duct outside the validated closed-box anchor'],
        canRunSimulation: false,
        isExactSeedMatch: false,
        matchedPatternId: 'closed_box_anchor',
      };
    }

    const exactClosedBoxCounts =
      countNodeType(nodes, 'driver') === 1 &&
      countNodeType(nodes, 'volume') === 1 &&
      countNodeType(nodes, 'radiator') === 1 &&
      nodes.length === 3 &&
      edges.length === 2;

    const isExactSeedMatch = normalizeSnapshot(seedGraph) !== '' && normalizeSnapshot(seedGraph) === normalizeSnapshot(currentGraph);

    if (exactClosedBoxCounts && isExactSeedMatch) {
      return {
        status: 'compilable_anchor',
        reasons: ['matches validated Closed Box anchor'],
        canRunSimulation: true,
        isExactSeedMatch: true,
        matchedPatternId: 'closed_box_anchor',
      };
    }

    return {
      status: 'composition_not_yet_compilable',
      reasons: ['structural edits moved graph beyond the exact validated Closed Box anchor'],
      canRunSimulation: false,
      isExactSeedMatch: false,
      matchedPatternId: 'closed_box_anchor',
    };
  }

  if (topology === 'bass_reflex') {
    return {
      status: 'seeded_but_not_runnable',
      reasons: ['seeded Bass Reflex path remains gated in the current truthful line'],
      canRunSimulation: false,
      isExactSeedMatch: normalizeSnapshot(seedGraph) !== '' && normalizeSnapshot(seedGraph) === normalizeSnapshot(currentGraph),
      matchedPatternId: 'bass_reflex_seed',
    };
  }

  if (topology === 'transmission_line' || topology === 'horn') {
    return {
      status: 'seeded_but_not_runnable',
      reasons: ['selected topology is seed-only and not runnable in the current truthful line'],
      canRunSimulation: false,
      isExactSeedMatch: normalizeSnapshot(seedGraph) !== '' && normalizeSnapshot(seedGraph) === normalizeSnapshot(currentGraph),
      matchedPatternId: topology + '_seed',
    };
  }

  return {
    status: 'composition_not_yet_compilable',
    reasons: ['current graph is outside the bounded compiler support line'],
    canRunSimulation: false,
    isExactSeedMatch: false,
    matchedPatternId: null,
  };
}

export function assessGraphCompilability(args: AssessArgsObject): GraphCompilabilityAssessment;
export function assessGraphCompilability(
  topology: string | null | undefined,
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[],
  seedGraph?: GraphSnapshot | null,
  currentGraph?: GraphSnapshot | null,
): GraphCompilabilityAssessment;
export function assessGraphCompilability(
  arg1: AssessArgsObject | string | null | undefined,
  arg2?: ReactFlowNode[],
  arg3?: ReactFlowEdge[],
  arg4?: GraphSnapshot | null,
  arg5?: GraphSnapshot | null,
): GraphCompilabilityAssessment {
  if (typeof arg1 === 'object' && arg1 !== null && 'nodes' in arg1) {
    return assessFromNormalizedArgs(arg1 as AssessArgsObject);
  }

  return assessFromNormalizedArgs({
    topology: (arg1 as string | null | undefined) || 'closed_box',
    nodes: arg2 || [],
    edges: arg3 || [],
    seedGraph: arg4 || null,
    currentGraph: arg5 || null,
  });
}
