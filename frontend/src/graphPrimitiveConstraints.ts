import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from 'reactflow';
import {
  BASS_REFLEX_SEEDED_PATTERN,
  CLOSED_BOX_ANCHOR_PATTERN,
  type GraphPattern,
  matchGraphPattern,
  getPrimitiveType,
} from './graphPatterns';

export type PrimitiveSupportStatus = 'validated_anchor' | 'seeded_gated' | 'unsupported';
export type SupportedPrimitiveType = 'driver' | 'volume' | 'radiator' | 'duct';
export type TopologyId = 'closed_box' | 'bass_reflex' | 'transmission_line' | 'horn';

export interface PrimitiveSupportEntry {
  primitive: SupportedPrimitiveType;
  status: PrimitiveSupportStatus;
  note: string;
}

export interface PrimitiveConstraintAssessment {
  isValid: boolean;
  reasons: string[];
  matchedPattern: GraphPattern | null;
  primitiveSupport: PrimitiveSupportEntry[];
}

const TOPOLOGY_PRIMITIVE_SUPPORT: Record<TopologyId, PrimitiveSupportEntry[]> = {
  closed_box: [
    { primitive: 'driver', status: 'validated_anchor', note: 'validated in the Closed Box runnable anchor' },
    { primitive: 'volume', status: 'validated_anchor', note: 'validated in the Closed Box runnable anchor' },
    { primitive: 'radiator', status: 'validated_anchor', note: 'validated in the Closed Box runnable anchor' },
    { primitive: 'duct', status: 'unsupported', note: 'not part of the validated Closed Box anchor' },
  ],
  bass_reflex: [
    { primitive: 'driver', status: 'seeded_gated', note: 'seeded/gated in the current Bass Reflex line' },
    { primitive: 'volume', status: 'seeded_gated', note: 'seeded/gated in the current Bass Reflex line' },
    { primitive: 'radiator', status: 'seeded_gated', note: 'seeded/gated in the current Bass Reflex line' },
    { primitive: 'duct', status: 'seeded_gated', note: 'seeded/gated in the current Bass Reflex line' },
  ],
  transmission_line: [
    { primitive: 'driver', status: 'unsupported', note: 'seed-only / non-runnable in this line' },
    { primitive: 'volume', status: 'unsupported', note: 'seed-only / non-runnable in this line' },
    { primitive: 'radiator', status: 'unsupported', note: 'seed-only / non-runnable in this line' },
    { primitive: 'duct', status: 'unsupported', note: 'seed-only / non-runnable in this line' },
  ],
  horn: [
    { primitive: 'driver', status: 'unsupported', note: 'seed-only / non-runnable in this line' },
    { primitive: 'volume', status: 'unsupported', note: 'seed-only / non-runnable in this line' },
    { primitive: 'radiator', status: 'unsupported', note: 'seed-only / non-runnable in this line' },
    { primitive: 'duct', status: 'unsupported', note: 'seed-only / non-runnable in this line' },
  ],
};

function hasDanglingEdges(nodes: ReactFlowNode[], edges: ReactFlowEdge[]): boolean {
  const nodeIds = new Set(nodes.map((node) => String(node.id)));
  return edges.some((edge) => !nodeIds.has(String(edge.source)) || !nodeIds.has(String(edge.target)));
}

function unsupportedNodeTypes(nodes: ReactFlowNode[]): string[] {
  return Array.from(
    new Set(
      nodes
        .filter((node) => getPrimitiveType(node) === null)
        .map((node) => String(node?.data?.type ?? 'unknown')),
    ),
  );
}

export function getPrimitiveSupportForTopology(topology: TopologyId): PrimitiveSupportEntry[] {
  return TOPOLOGY_PRIMITIVE_SUPPORT[topology];
}

export function assessPrimitiveConstraints(
  topology: TopologyId,
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[],
): PrimitiveConstraintAssessment {
  const reasons: string[] = [];
  const primitiveSupport = getPrimitiveSupportForTopology(topology);

  if (nodes.length === 0) {
    return {
      isValid: false,
      reasons: ['graph is empty'],
      matchedPattern: null,
      primitiveSupport,
    };
  }

  if (hasDanglingEdges(nodes, edges)) {
    reasons.push('graph contains edges that reference missing nodes');
  }

  const unknownTypes = unsupportedNodeTypes(nodes);
  if (unknownTypes.length > 0) {
    reasons.push(`unsupported node type combination: ${unknownTypes.join(', ')}`);
  }

  const anchorMatch = matchGraphPattern(CLOSED_BOX_ANCHOR_PATTERN, nodes, edges);
  if (anchorMatch.matches) {
    return {
      isValid: reasons.length === 0,
      reasons,
      matchedPattern: CLOSED_BOX_ANCHOR_PATTERN,
      primitiveSupport,
    };
  }

  const bassReflexMatch = matchGraphPattern(BASS_REFLEX_SEEDED_PATTERN, nodes, edges);
  if (bassReflexMatch.matches) {
    return {
      isValid: reasons.length === 0,
      reasons,
      matchedPattern: BASS_REFLEX_SEEDED_PATTERN,
      primitiveSupport,
    };
  }

  const hasDriver = nodes.some((node) => getPrimitiveType(node) === 'driver');
  const hasVolume = nodes.some((node) => getPrimitiveType(node) === 'volume');
  const hasRadiator = nodes.some((node) => getPrimitiveType(node) === 'radiator');

  if (!hasDriver) reasons.push('missing required driver motif member');
  if (!hasVolume) reasons.push('missing required volume motif member');
  if (!hasRadiator) reasons.push('missing required radiator motif member');

  return {
    isValid: reasons.length === 0,
    reasons,
    matchedPattern: null,
    primitiveSupport,
  };
}
