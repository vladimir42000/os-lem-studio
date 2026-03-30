export type ElementType = "driver" | "volume" | "duct" | "waveguide_1d" | "radiator";

export interface CanvasNode {
  id: string;
  type: ElementType | "default";
  position: { x: number, y: number };
  data: any;
}

export interface CanvasEdge {
  id: string;
  source: string;
  sourceHandle?: string | null;
  target: string;
  targetHandle?: string | null;
}
