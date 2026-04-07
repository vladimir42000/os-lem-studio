import type { CanvasEdge, CanvasNode } from './types';

type TopologyId = 'closed_box' | 'bass_reflex' | 'transmission_line' | 'horn';

export type GraphCompilabilityStatus =
  | 'compilable_anchor'
  | 'seeded_but_not_runnable'
  | 'composition_not_yet_compilable'
  | 'invalid_graph';

export interface GraphCompilabilityAssessment {
  status: GraphCompilabilityStatus;
  reasons: string[];
}

export interface GraphCompilabilityInput {
  topology: TopologyId;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  seedGraph: {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
  };
}

function nodeTypeCount(nodes: CanvasNode[], nodeType: string): number {
  return nodes.filter((node) => node.data?.type === nodeType).length;
}

function hasEdge(edges: CanvasEdge[], source: string, target: string): boolean {
  return edges.some((edge) => edge.source === source && edge.target === target);
}

function structuralSignature(nodes: CanvasNode[], edges: CanvasEdge[]): string {
  const nodeSig = nodes
    .map((node) => `${node.data?.type ?? 'unknown'}:${node.id}`)
    .sort()
    .join('|');
  const edgeSig = edges
    .map((edge) => `${edge.source}->${edge.target}`)
    .sort()
    .join('|');
  return `${nodeSig}::${edgeSig}`;
}

function invalid(reasons: string[]): GraphCompilabilityAssessment {
  return { status: 'invalid_graph', reasons };
}

function seeded(reasons: string[]): GraphCompilabilityAssessment {
  return { status: 'seeded_but_not_runnable', reasons };
}

function composition(reasons: string[]): GraphCompilabilityAssessment {
  return { status: 'composition_not_yet_compilable', reasons };
}

function compilable(reasons: string[]): GraphCompilabilityAssessment {
  return { status: 'compilable_anchor', reasons };
}

function assessClosedBox(nodes: CanvasNode[], edges: CanvasEdge[]): GraphCompilabilityAssessment {
  const driverCount = nodeTypeCount(nodes, 'driver');
  const volumeCount = nodeTypeCount(nodes, 'volume');
  const radiatorCount = nodeTypeCount(nodes, 'radiator');
  const ductCount = nodeTypeCount(nodes, 'duct');

  if (driverCount !== 1 || volumeCount < 1 || radiatorCount < 1) {
    return invalid(['Missing required driver/volume/radiator motif for the validated Closed Box anchor.']);
  }

  if (ductCount > 0) {
    return composition(['Unsupported node type combination for the Closed Box anchor: duct/vent path present.']);
  }

  const driver = nodes.find((node) => node.data?.type === 'driver');
  const volume = nodes.find((node) => node.id === 'node_volume_1') ?? nodes.find((node) => node.data?.type === 'volume');
  const radiator =
    nodes.find((node) => node.id === 'node_radiator_1') ??
    nodes.find((node) => node.data?.type === 'radiator');

  if (!driver || !volume || !radiator) {
    return invalid(['Closed Box anchor nodes are incomplete in the current working graph.']);
  }

  const hasAnchorEdges = hasEdge(edges, driver.id, volume.id) && hasEdge(edges, driver.id, radiator.id);
  const exactClosedBoxMotif = nodes.length === 3 && edges.length === 2 && hasAnchorEdges;

  if (exactClosedBoxMotif) {
    return compilable(['Matches validated Closed Box anchor motif.']);
  }

  if (hasAnchorEdges) {
    return composition([
      'Structural edits moved the graph beyond the exact validated Closed Box anchor even though the core motif remains visible.',
    ]);
  }

  return composition(['Structural edits moved graph beyond current compiler support for the Closed Box anchor.']);
}

function assessBassReflex(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  seedGraph: { nodes: CanvasNode[]; edges: CanvasEdge[] },
): GraphCompilabilityAssessment {
  const driverCount = nodeTypeCount(nodes, 'driver');
  const volumeCount = nodeTypeCount(nodes, 'volume');
  const radiatorCount = nodeTypeCount(nodes, 'radiator');
  const ductCount = nodeTypeCount(nodes, 'duct');

  if (driverCount !== 1 || volumeCount < 1 || radiatorCount < 1 || ductCount < 1) {
    return invalid(['Missing required driver/volume/radiator/duct motif for the seeded Bass Reflex path.']);
  }

  const matchesSeed = structuralSignature(nodes, edges) === structuralSignature(seedGraph.nodes, seedGraph.edges);
  if (matchesSeed) {
    return seeded([
      'Seeded Bass Reflex path still gated in this line.',
      'Combined first-class Bass Reflex system SPL path is not yet validated.',
    ]);
  }

  return composition([
    'Structural edits moved graph beyond current compiler support for the seeded Bass Reflex path.',
  ]);
}

export function assessGraphCompilability(
  input: GraphCompilabilityInput,
): GraphCompilabilityAssessment {
  const { topology, nodes, edges, seedGraph } = input;

  if (nodes.length === 0) {
    return invalid(['Working graph is empty.']);
  }

  if (topology === 'closed_box') {
    return assessClosedBox(nodes, edges);
  }

  if (topology === 'bass_reflex') {
    return assessBassReflex(nodes, edges, seedGraph);
  }

  if (topology === 'transmission_line') {
    return seeded(['Seeded Transmission Line path is not runnable in the current Studio line.']);
  }

  return seeded(['Seeded Horn path is not runnable in the current Studio line.']);
}
