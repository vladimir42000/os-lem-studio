export interface ThinRunnerResponse {
  frequencies_hz: number[];
  series: Record<string, unknown[]>;
  properties: Record<string, unknown>;
  observation_types: Record<string, unknown>;
  warnings: unknown[];
}

export interface ThinRunnerOptions {
  canonicalModel: Record<string, unknown>;
  frequenciesHz: number[];
  backendUrl?: string;
  fetchImpl?: typeof fetch;
}

export async function runSimulationThin({
  canonicalModel,
  frequenciesHz,
  backendUrl = 'http://localhost:8000/api/simulate',
  fetchImpl = fetch,
}: ThinRunnerOptions): Promise<ThinRunnerResponse> {
  let response: Response;
  try {
    response = await fetchImpl(backendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model_dict: canonicalModel,
      frequencies_hz: frequenciesHz,
      experimental_mode: false,
    }),
    });
  } catch {
    throw new Error('Cannot reach the simulation backend. Check that it is running on port 8000.');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Simulation backend returned an invalid response (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(typeof payload?.detail === 'string' ? payload.detail : `Simulation failed (HTTP ${response.status}).`);
  }

  if (payload?.status !== 'success' || !payload?.data) {
    throw new Error(`Thin runner unexpected response: ${JSON.stringify(payload)}`);
  }

  const grid = payload.data.frequencies_hz;
  if (!Array.isArray(grid) || grid.length === 0 || grid.length !== frequenciesHz.length ||
      !grid.every((value: unknown, index: number) => typeof value === 'number' && Number.isFinite(value) && value === frequenciesHz[index])) {
    throw new Error('Simulation backend returned an empty or mismatched frequency grid.');
  }
  return payload.data as ThinRunnerResponse;
}
