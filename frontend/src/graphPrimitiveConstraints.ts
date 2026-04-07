import type { CanvasEdge, CanvasNode } from './types';

export type TopologyId = 'closed_box' | 'bass_reflex' | 'transmission_line' | 'horn';
export type PrimitiveType = 'driver' | 'volume' | 'radiator' | 'duct';
export type PrimitiveSupportStatus =
  | 'validated_runnable_anchor'
  | 'seeded_gated'
  | 'unsupported_current_line';

export interface SeedGraphSnapshot {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export interface PrimitiveConstraintInput {
  topology: TopologyId;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  seedGraph: SeedGraphSnapshot;
}

export interface PrimitiveConstraintAssessment {
  primitiveStatuses: Record<PrimitiveType, PrimitiveSupportStatus>;
  errors: string[];
  warnings: string[];
  flags: {
    emptyGraph: boolean;
    hasUnsupportedPrimitive: boolean;
    hasClosedBoxCoreMotif: boolean;
    exactClosedBoxAnchor: boolean;
    hasBassReflexCoreMotif: boolean;
    exactBassReflexSeed: boolean;
  };
}

const PRIMITIVE_TYPES: PrimitiveType[] = ['driver', 'volume', 'radiator', 'duct'];

function nodeTypeCount(nodes: CanvasNode[], nodeType: PrimitiveType): number {
  return nodes.filter((node) => node.data?.type === nodeType).length;
}

function firstNode(nodes: CanvasNode[], predicate: (node: CanvasNode) => boolean): CanvasNode | null {
  return nodes.find(predicate) ?? null;
}

function hasEdge(edges: CanvasEdge[], source: string, target: string): boolean {
  return edges.some((edge) => edge.source === source && edge.target === target);
}

function structuralSignature(nodes: CanvasNode[], edges: CanvasEdge[]): string {
  const nodeSig = nodes
    .map((node) => `${String(node.data?.type ?? 'unknown')}:${String(node.id)}`)
    .sort()
    .join('|');
  const edgeSig = edges
    .map((edge) => `${String(edge.source)}->${String(edge.target)}`)
    .sort()
    .join('|');
  return `${nodeSig}::${edgeSig}`;
}

function primitiveStatusesForTopology(topology: TopologyId): Record<PrimitiveType, PrimitiveSupportStatus> {
  if (topology === 'closed_box') {
    return {
      driver: 'validated_runnable_anchor',
      volume: 'validated_runnable_anchor',
      radiator: 'validated_runnable_anchor',
      duct: 'unsupported_current_line',
    };
  }

  if (topology === 'bass_reflex') {
    return {
      driver: 'seeded_gated',
      volume: 'seeded_gated',
      radiator: 'seeded_gated',
      duct: 'seeded_gated',
    };
  }

  return {
    driver: 'unsupported_current_line',
    volume: 'unsupported_current_line',
    radiator: 'unsupported_current_line',
    duct: 'unsupported_current_line',
  };
}

function findUnsupportedNodeTypes(nodes: CanvasNode[]): string[] {
  const supported = new Set<string>(PRIMITIVE_TYPES);
  const seen = new Set<string>();

  nodes.forEach((node) => {
    const value = String(node.data?.type ?? '').trim();
    if (!value || supported.has(value)) {
      return;
    }
    seen.add(value);
  });

  return Array.from(seen).sort();
}

export function assessPrimitiveConstraints(input: PrimitiveConstraintInput): PrimitiveConstraintAssessment {
  const { topology, nodes, edges, seedGraph } = input;
  const primitiveStatuses = primitiveStatusesForTopology(topology);
  const errors: string[] = [];
  const warnings: string[] = [];
  const flags = {
    emptyGraph: nodes.length === 0,
    hasUnsupportedPrimitive: false,
    hasClosedBoxCoreMotif: false,
    exactClosedBoxAnchor: false,
    hasBassReflexCoreMotif: false,
    exactBassReflexSeed: false,
  };

  if (flags.emptyGraph) {
    errors.push('Working graph is empty.');
  }

  const unsupportedNodeTypes = findUnsupportedNodeTypes(nodes);
  if (unsupportedNodeTypes.length > 0) {
    flags.hasUnsupportedPrimitive = true;
    errors.push(
      `Unsupported node type combination in the current truthful line: ${unsupportedNodeTypes.join(', ')}.`,
    );
  }

  const driverCount = nodeTypeCount(nodes, 'driver');
  const volumeCount = nodeTypeCount(nodes, 'volume');
  const radiatorCount = nodeTypeCount(nodes, 'radiator');
  const ductCount = nodeTypeCount(nodes, 'duct');

  const driver = firstNode(nodes, (node) => node.data?.type === 'driver');
  const volume =
    firstNode(nodes, (node) => node.id === 'node_volume_1') ??
    firstNode(nodes, (node) => node.data?.type === 'volume');
  const radiator =
    firstNode(nodes, (node) => node.id === 'node_radiator_1') ??
    firstNode(nodes, (node) => node.data?.type === 'radiator');
  const duct =
    firstNode(nodes, (node) => node.id === 'node_port_1') ??
    firstNode(nodes, (node) => node.data?.type === 'duct');

  if (topology === 'closed_box') {
    if (driverCount !== 1) {
      errors.push('Closed Box anchor requires exactly one driver primitive.');
    }
    if (volumeCount < 1) {
      errors.push('Closed Box anchor requires at least one volume primitive.');
    }
    if (radiatorCount < 1) {
      errors.push('Closed Box anchor requires at least one radiator primitive.');
    }
    if (ductCount > 0) {
      errors.push('Closed Box anchor does not allow duct primitives in the current truthful line.');
    }

    if (driver && volume && radiator) {
      const hasCoreConnections = hasEdge(edges, driver.id, volume.id) && hasEdge(edges, driver.id, radiator.id);
      flags.hasClosedBoxCoreMotif = hasCoreConnections;
      flags.exactClosedBoxAnchor =
        hasCoreConnections &&
        driverCount === 1 &&
        volumeCount === 1 &&
        radiatorCount === 1 &&
        ductCount === 0 &&
        nodes.length === 3 &&
        edges.length === 2;

      if (!hasCoreConnections) {
        errors.push('Closed Box anchor is missing required driver→volume and/or driver→radiator connection.');
      } else if (!flags.exactClosedBoxAnchor) {
        warnings.push('Closed Box core motif is present, but extra nodes or edges move the graph beyond the validated anchor.');
      }
    }
  }

  if (topology === 'bass_reflex') {
    if (driverCount !== 1) {
      errors.push('Seeded Bass Reflex path requires exactly one driver primitive.');
    }
    if (volumeCount < 1) {
      errors.push('Seeded Bass Reflex path requires at least one volume primitive.');
    }
    if (radiatorCount < 1) {
      errors.push('Seeded Bass Reflex path requires at least one radiator primitive.');
    }
    if (ductCount < 1) {
      errors.push('Seeded Bass Reflex path requires at least one duct primitive.');
    }

    if (driver && volume && radiator && duct) {
      const hasCoreConnections =
        hasEdge(edges, driver.id, volume.id) &&
        hasEdge(edges, driver.id, radiator.id) &&
        hasEdge(edges, volume.id, duct.id);
      flags.hasBassReflexCoreMotif = hasCoreConnections;
      flags.exactBassReflexSeed =
        hasCoreConnections &&
        structuralSignature(nodes, edges) === structuralSignature(seedGraph.nodes, seedGraph.edges);

      if (!hasCoreConnections) {
        errors.push('Seeded Bass Reflex path is missing required driver→volume, driver→radiator, and/or volume→duct connection.');
      } else if (!flags.exactBassReflexSeed) {
        warnings.push('Bass Reflex core motif is present, but the working graph has diverged from the seeded/gated template.');
      }
    }
  }

  if (topology === 'transmission_line') {
    warnings.push('Transmission Line remains seed-only and not compilable in the current truthful line.');
  }

  if (topology === 'horn') {
    warnings.push('Horn remains seed-only and not compilable in the current truthful line.');
  }

  return {
    primitiveStatuses,
    errors,
    warnings,
    flags,
  };
}
