import type { CanvasEdge, CanvasNode } from './types';
import {
  assessPrimitiveConstraints,
  type PrimitiveConstraintInput,
  type PrimitiveSupportStatus,
  type TopologyId,
} from './graphPrimitiveConstraints';

export type GraphCompilabilityStatus =
  | 'compilable_anchor'
  | 'seeded_but_not_runnable'
  | 'composition_not_yet_compilable'
  | 'invalid_graph';

export interface GraphCompilabilityAssessment {
  status: GraphCompilabilityStatus;
  reasons: string[];
  primitiveStatuses: Record<'driver' | 'volume' | 'radiator' | 'duct', PrimitiveSupportStatus>;
}

export interface GraphCompilabilityInput extends PrimitiveConstraintInput {
  topology: TopologyId;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

function invalid(
  reasons: string[],
  primitiveStatuses: GraphCompilabilityAssessment['primitiveStatuses'],
): GraphCompilabilityAssessment {
  return { status: 'invalid_graph', reasons, primitiveStatuses };
}

function seeded(
  reasons: string[],
  primitiveStatuses: GraphCompilabilityAssessment['primitiveStatuses'],
): GraphCompilabilityAssessment {
  return { status: 'seeded_but_not_runnable', reasons, primitiveStatuses };
}

function composition(
  reasons: string[],
  primitiveStatuses: GraphCompilabilityAssessment['primitiveStatuses'],
): GraphCompilabilityAssessment {
  return { status: 'composition_not_yet_compilable', reasons, primitiveStatuses };
}

function compilable(
  reasons: string[],
  primitiveStatuses: GraphCompilabilityAssessment['primitiveStatuses'],
): GraphCompilabilityAssessment {
  return { status: 'compilable_anchor', reasons, primitiveStatuses };
}

export function assessGraphCompilability(
  input: GraphCompilabilityInput,
): GraphCompilabilityAssessment {
  const { topology } = input;
  const constraintAssessment = assessPrimitiveConstraints(input);
  const { primitiveStatuses, errors, warnings, flags } = constraintAssessment;

  if (errors.length > 0) {
    return invalid([...errors, ...warnings], primitiveStatuses);
  }

  if (topology === 'closed_box') {
    if (flags.exactClosedBoxAnchor) {
      return compilable(['Matches validated Closed Box anchor motif.', ...warnings], primitiveStatuses);
    }

    if (flags.hasClosedBoxCoreMotif) {
      return composition(
        ['Structural edits moved the graph beyond the exact validated Closed Box anchor.', ...warnings],
        primitiveStatuses,
      );
    }

    return invalid(
      ['Missing required driver/volume/radiator motif or connections for the Closed Box anchor.', ...warnings],
      primitiveStatuses,
    );
  }

  if (topology === 'bass_reflex') {
    if (flags.exactBassReflexSeed) {
      return seeded(
        [
          'Seeded Bass Reflex path remains gated in the current truthful line.',
          'Combined first-class Bass Reflex system SPL path is not yet validated.',
          ...warnings,
        ],
        primitiveStatuses,
      );
    }

    if (flags.hasBassReflexCoreMotif) {
      return composition(
        ['Bass Reflex core motif is present, but the graph has moved beyond the current seeded/gated compiler truth.', ...warnings],
        primitiveStatuses,
      );
    }

    return invalid(
      ['Missing required driver/volume/radiator/duct motif or connections for the seeded Bass Reflex path.', ...warnings],
      primitiveStatuses,
    );
  }

  if (topology === 'transmission_line') {
    return seeded(['Seeded Transmission Line path is not runnable in the current truthful line.', ...warnings], primitiveStatuses);
  }

  return seeded(['Seeded Horn path is not runnable in the current truthful line.', ...warnings], primitiveStatuses);
}
