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
  const response = await fetchImpl(backendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model_dict: canonicalModel,
      frequencies_hz: frequenciesHz,
      experimental_mode: false,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`Thin runner backend error: ${JSON.stringify(payload)}`);
  }

  if (payload?.status !== 'success' || !payload?.data) {
    throw new Error(`Thin runner unexpected response: ${JSON.stringify(payload)}`);
  }

  return payload.data as ThinRunnerResponse;
}
