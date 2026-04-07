import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from 'reactflow';
import {
  assessPrimitiveConstraints,
  type PrimitiveConstraintAssessment,
  type PrimitiveSupportEntry,
  type TopologyId,
} from './graphPrimitiveConstraints';
import {
  BASS_REFLEX_SEEDED_PATTERN,
  CLOSED_BOX_ANCHOR_PATTERN,
} from './graphPatterns';

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
  primitiveConstraintValid: boolean;
  primitiveSupport: PrimitiveSupportEntry[];
  matchedPatternId: string | null;
  matchedPatternLabel: string | null;
}

type AssessArgsObject = {
  topology?: TopologyId | string | null;
  selectedTopology?: TopologyId | string | null;
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

function normalizeTopology(topology: TopologyId | string | null | undefined): TopologyId {
  const raw = String(topology || 'closed_box');
  if (raw === 'bass_reflex' || raw === 'transmission_line' || raw === 'horn') {
    return raw;
  }
  return 'closed_box';
}

function isExactSeedMatch(
  seedGraph: GraphSnapshot | null | undefined,
  currentGraph: GraphSnapshot | null | undefined,
): boolean {
  const seed = normalizeSnapshot(seedGraph);
  if (!seed) {
    return false;
  }
  return seed === normalizeSnapshot(currentGraph);
}

function buildAssessment(
  status: GraphCompilabilityStatus,
  reasons: string[],
  canRunSimulation: boolean,
  primitiveAssessment: PrimitiveConstraintAssessment,
  exactSeedMatch: boolean,
): GraphCompilabilityAssessment {
  return {
    status,
    reasons,
    canRunSimulation,
    isExactSeedMatch: exactSeedMatch,
    primitiveConstraintValid: primitiveAssessment.isValid,
    primitiveSupport: primitiveAssessment.primitiveSupport,
    matchedPatternId: primitiveAssessment.matchedPattern?.id ?? null,
    matchedPatternLabel: primitiveAssessment.matchedPattern?.label ?? null,
  };
}

function assessFromNormalizedArgs(args: AssessArgsObject): GraphCompilabilityAssessment {
  const topology = normalizeTopology(args.topology || args.selectedTopology);
  const nodes = args.nodes || [];
  const edges = args.edges || [];
  const seedGraph = args.seedGraph || args.seedSnapshot || null;
  const currentGraph = args.currentGraph || args.workingGraph || { nodes, edges };

  const primitiveAssessment = assessPrimitiveConstraints(topology, nodes, edges);

  if (!primitiveAssessment.isValid) {
    return buildAssessment(
      'invalid_graph',
      primitiveAssessment.reasons,
      false,
      primitiveAssessment,
      false,
    );
  }

  const exactSeedMatch = isExactSeedMatch(seedGraph, currentGraph);
  const matchedPattern = primitiveAssessment.matchedPattern;

  if (matchedPattern?.id === CLOSED_BOX_ANCHOR_PATTERN.id) {
    if (topology === 'closed_box' && exactSeedMatch) {
      return buildAssessment(
        'compilable_anchor',
        ['matches validated Closed Box anchor'],
        true,
        primitiveAssessment,
        true,
      );
    }

    return buildAssessment(
      'composition_not_yet_compilable',
      ['structural edits moved graph beyond the exact validated Closed Box anchor'],
      false,
      primitiveAssessment,
      false,
    );
  }

  if (matchedPattern?.id === BASS_REFLEX_SEEDED_PATTERN.id) {
    if (topology === 'bass_reflex' && exactSeedMatch) {
      return buildAssessment(
        'seeded_but_not_runnable',
        ['seeded Bass Reflex path still gated in this line'],
        false,
        primitiveAssessment,
        true,
      );
    }

    return buildAssessment(
      'composition_not_yet_compilable',
      ['Bass Reflex edits moved graph beyond the current seeded/gated support line'],
      false,
      primitiveAssessment,
      false,
    );
  }

  if ((topology === 'transmission_line' || topology === 'horn') && exactSeedMatch) {
    return buildAssessment(
      'seeded_but_not_runnable',
      [`${topology.replace(/_/g, ' ')} remains seed-only and non-runnable in this line`],
      false,
      primitiveAssessment,
      true,
    );
  }

  return buildAssessment(
    'composition_not_yet_compilable',
    ['structural edits moved graph beyond current compiler support'],
    false,
    primitiveAssessment,
    false,
  );
}

export function assessGraphCompilability(args: AssessArgsObject): GraphCompilabilityAssessment;
export function assessGraphCompilability(
  topology: TopologyId | string | null | undefined,
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[],
  seedGraph?: GraphSnapshot | null,
  currentGraph?: GraphSnapshot | null,
): GraphCompilabilityAssessment;
export function assessGraphCompilability(
  arg1: AssessArgsObject | TopologyId | string | null | undefined,
  arg2?: ReactFlowNode[],
  arg3?: ReactFlowEdge[],
  arg4?: GraphSnapshot | null,
  arg5?: GraphSnapshot | null,
): GraphCompilabilityAssessment {
  if (typeof arg1 === 'object' && arg1 !== null && 'nodes' in arg1) {
    return assessFromNormalizedArgs(arg1 as AssessArgsObject);
  }

  return assessFromNormalizedArgs({
    topology: arg1 as TopologyId | string | null | undefined,
    nodes: arg2 || [],
    edges: arg3 || [],
    seedGraph: arg4 || null,
    currentGraph: arg5 || null,
  });
}

export default assessGraphCompilability;
