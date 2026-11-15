export type Sensitivity = { mode: 'relative' | 'absolute'; step: number };
export type PadSettings = { x: string; y: string; sensitivity: Record<string,Sensitivity> };
export const emptyPad = (): PadSettings => ({ x:'', y:'', sensitivity:{} });
export function defaultSensitivity(value:number): Sensitivity { return value>0 ? {mode:'relative',step:2} : {mode:'absolute',step:.01}; }
export function dragValue(start:number, pixels:number, span:number, sensitivity:Sensitivity, allowZero:boolean):number {
  const value=sensitivity.mode==='relative' ? start*Math.pow(sensitivity.step,pixels/Math.max(1,span)) : start+pixels*sensitivity.step;
  return Math.max(allowZero?0:1e-9,Math.min(1e12,Number.isFinite(value)?value:1e12));
}
