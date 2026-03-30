import { CanvasNode, CanvasEdge } from './types';

export function buildModelDict(nodes: CanvasNode[], edges: CanvasEdge[]) {
  // Initialize the model exactly as defined in closed_box_minimal.yaml
  const modelDict: any = {
    meta: {
      name: "studio_simulation",
      radiation_space: "2pi"
    },
    driver: null,
    elements: [],
    observations: []
  };

  nodes.forEach(n => {
    const d = n.data;

    if (d.type === 'driver') {
      // Mapping to strict Contract v1 fields
      modelDict.driver = {
        id: "drv1",
        model: "ts_classic",
        Re: `${d.Re || 5.8} ohm`,
        Le: `${d.Le || 0.35} mH`,
        Fs: "34 Hz",
        Qes: 0.42,
        Qms: 4.1,
        Vas: "55 l",
        Sd: `${d.Sd || 132} cm2`,
        node_front: "front",
        node_rear: "rear"
      };

      // Add Impedance observation as per YAML
      modelDict.observations.push({
        id: "zin",
        type: "input_impedance",
        target: "drv1"
      });
    } 
    
    else if (d.type === 'volume') {
      modelDict.elements.push({
        id: "rear_box",
        type: "volume",
        node: "rear",
        value: `${d.Vb || 18} l`
      });
    } 
    
    else if (d.type === 'radiator') {
      modelDict.elements.push({
        id: "front_rad",
        type: "radiator",
        node: "front",
        model: "infinite_baffle_piston",
        area: `${d.Sd || 132} cm2`
      });

      // Add SPL observation as per YAML
      modelDict.observations.push({
        id: "spl_front",
        type: "spl",
        target: "front_rad",
        distance: "1 m"
      });
    }
  });

  return modelDict;
}
