import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from 'reactflow';

export type PrimitiveType = 'driver' | 'volume' | 'radiator' | 'duct';
export type PatternRuntimeClass = 'validated_anchor' | 'seeded_gated';

export interface RequiredConnection {
  sourceType: PrimitiveType;
  targetType: PrimitiveType;
  minCount?: number;
}

export interface GraphPattern {
  id: string;
  label: string;
  runtimeClass: PatternRuntimeClass;
  description: string;
  requiredNodeTypes: PrimitiveType[];
  allowedNodeTypes: PrimitiveType[];
  requiredConnections: RequiredConnection[];
}

export interface GraphPatternMatchResult {
  pattern: GraphPattern;
  matches: boolean;
  reasons: string[];
}

const KNOWN_PRIMITIVE_TYPES: PrimitiveType[] = ['driver', 'volume', 'radiator', 'duct'];

export const CLOSED_BOX_ANCHOR_PATTERN: GraphPattern = {
  id: 'closed_box_anchor',
  label: 'Closed Box Anchor',
  runtimeClass: 'validated_anchor',
  description: 'Validated runnable anchor consisting of driver + rear volume + front radiator.',
  requiredNodeTypes: ['driver', 'volume', 'radiator'],
  allowedNodeTypes: ['driver', 'volume', 'radiator'],
  requiredConnections: [
    { sourceType: 'driver', targetType: 'volume', minCount: 1 },
    { sourceType: 'driver', targetType: 'radiator', minCount: 1 },
  ],
};

export const BASS_REFLEX_SEEDED_PATTERN: GraphPattern = {
  id: 'bass_reflex_seeded',
  label: 'Bass Reflex Seeded Path',
  runtimeClass: 'seeded_gated',
  description: 'Seeded but gated motif consisting of driver + rear volume + front radiator + duct/port path.',
  requiredNodeTypes: ['driver', 'volume', 'radiator', 'duct'],
  allowedNodeTypes: ['driver', 'volume', 'radiator', 'duct'],
  requiredConnections: [
    { sourceType: 'driver', targetType: 'volume', minCount: 1 },
    { sourceType: 'driver', targetType: 'radiator', minCount: 1 },
    { sourceType: 'volume', targetType: 'duct', minCount: 1 },
  ],
};

export const STUDIO_GRAPH_PATTERNS: GraphPattern[] = [
  CLOSED_BOX_ANCHOR_PATTERN,
  BASS_REFLEX_SEEDED_PATTERN,
];

export function getPrimitiveType(node: ReactFlowNode | null | undefined): PrimitiveType | null {
  const rawType = node?.data?.type;
  return KNOWN_PRIMITIVE_TYPES.includes(rawType) ? (rawType as PrimitiveType) : null;
}

export function countPrimitiveTypes(nodes: ReactFlowNode[]): Record<PrimitiveType, number> {
  return nodes.reduce<Record<PrimitiveType, number>>(
    (counts, node) => {
      const primitiveType = getPrimitiveType(node);
      if (primitiveType) {
        counts[primitiveType] += 1;
      }
      return counts;
    },
    { driver: 0, volume: 0, radiator: 0, duct: 0 },
  );
}

function countConnectionsByPrimitiveType(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[],
  sourceType: PrimitiveType,
  targetType: PrimitiveType,
): number {
  const nodeById = new Map(nodes.map((node) => [String(node.id), node] as const));

  return edges.reduce((count, edge) => {
    const sourceNode = nodeById.get(String(edge.source));
    const targetNode = nodeById.get(String(edge.target));

    if (getPrimitiveType(sourceNode) === sourceType && getPrimitiveType(targetNode) === targetType) {
      return count + 1;
    }
    return count;
  }, 0);
}

export function matchGraphPattern(
  pattern: GraphPattern,
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[],
): GraphPatternMatchResult {
  const reasons: string[] = [];
  const primitiveCounts = countPrimitiveTypes(nodes);

  for (const requiredType of pattern.requiredNodeTypes) {
    if (primitiveCounts[requiredType] < 1) {
      reasons.push(`missing required ${requiredType} primitive`);
    }
  }

  const unexpectedTypes = nodes
    .map(getPrimitiveType)
    .filter((primitiveType): primitiveType is PrimitiveType => primitiveType !== null)
    .filter((primitiveType) => !pattern.allowedNodeTypes.includes(primitiveType));

  if (unexpectedTypes.length > 0) {
    reasons.push(`contains primitives outside ${pattern.label} support: ${Array.from(new Set(unexpectedTypes)).join(', ')}`);
  }

  for (const connection of pattern.requiredConnections) {
    const actualCount = countConnectionsByPrimitiveType(
      nodes,
      edges,
      connection.sourceType,
      connection.targetType,
    );
    const minCount = connection.minCount ?? 1;
    if (actualCount < minCount) {
      reasons.push(
        `missing required connection ${connection.sourceType} -> ${connection.targetType}`,
      );
    }
  }

  return {
    pattern,
    matches: reasons.length === 0,
    reasons,
  };
}
