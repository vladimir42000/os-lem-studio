import { useEffect, useState, type FormEvent } from 'react'
import ReactECharts from 'echarts-for-react'

function readStl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('Could not read the STL file.'))
    reader.readAsDataURL(file)
  })
}

function HornResults({ csv }: { csv: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const next = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [csv])
  const [header, ...lines] = csv.trim().split(/\r?\n/)
  const fields = header.split(',')
  const rows = lines.map(line => Object.fromEntries(line.split(',').map((v, i) => [fields[i], Number(v)])))
  const chart = (name: string, values: number[]) => ({
    tooltip: { trigger: 'axis' }, grid: { left: 60, right: 65, bottom: 36 },
    xAxis: { type: 'value', name: 'Hz' }, yAxis: { type: 'value', name, scale: true },
    series: [{ name, type: 'line', data: rows.map((r, i) => [r.Hz, values[i]]) }],
  })
  return <section aria-label="Horn results">
    <h3>Predicted response</h3>
    <p>Throat area {(rows[0].throat_m2 * 1e4).toFixed(3)} cm² · Mouth area {(rows[0].mouth_m2 * 1e4).toFixed(3)} cm²</p>
    <ReactECharts option={chart('SPL (dB)', rows.map(r => r.SPL_dB))} />
    <ReactECharts option={chart('|Z| (Ω)', rows.map(r => Math.hypot(r.Ze_real_ohm, r.Ze_imag_ohm)))} />
    <a href={url} download="freecad-horn.csv">Download sweep CSV</a>
    <table><thead><tr>{['Hz', 'Re Z (Ω)', 'Im Z (Ω)', 'SPL (dB)'].map(h => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{[r.Hz, r.Ze_real_ohm, r.Ze_imag_ohm, r.SPL_dB].map((v, j) =>
        <td key={j}>{Number(v.toPrecision(8))}</td>)}</tr>)}</tbody></table>
  </section>
}

export default function FreeCadHorn() {
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [csv, setCsv] = useState('')
  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const frequencies = String(form.get('hz')).trim().split(/[\s,]+/).map(Number)
    setError('')
    setCsv('')
    if (!frequencies.every(f => Number.isFinite(f) && f > 0)) {
      setError('Enter positive frequencies in Hz, separated by spaces or commas.')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('http://localhost:8000/api/freecad/sweep', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          air_stl_base64: await readStl(form.get('air') as File),
          driver_json: await (form.get('driver') as File).text(),
          frequencies_hz: frequencies, units: form.get('units'),
          cell_mm: Number(form.get('cell')), voltage_rms: Number(form.get('voltage')),
          distance_m: Number(form.get('distance')),
        }),
      })
      if (!response.ok) {
        const detail = (await response.json()).detail
        throw new Error(typeof detail === 'string' ? detail : 'Check the sweep settings.')
      }
      setCsv(await response.text())
    } catch (cause) {
      setError(cause instanceof TypeError ? 'Cannot reach the simulation backend on port 8000.' : String(cause))
    } finally {
      setBusy(false)
    }
  }
  return <main className="cad-horn">
    <h2>FreeCAD horn</h2>
    <form onSubmit={run} onChange={() => { setCsv(''); setError('') }}>
      <fieldset disabled={busy}>
        <legend>Air volume and driver</legend>
        <label>Air-volume STL <input required type="file" onChange={() => setConfirmed(false)} name="air" accept=".stl" /></label>
        <label>Driver JSON <input required type="file" name="driver" accept=".json" /></label>
        <label>STL units <select name="units" onChange={() => setConfirmed(false)}><option>mm</option><option>m</option></select></label>
        <p>Export a single closed air volume. Cap both ends with planar faces perpendicular to Z, each with one boundary loop.</p>
        <label><input required type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I confirm the selected units, throat at minimum Z and mouth at maximum Z.</label>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Sweep settings</legend>
        {([['cell', 'Mesh cell (mm)', 6], ['voltage', 'Drive (V RMS)', 1], ['distance', 'On-axis distance from mouth (m)', 1]] as const)
          .map(([name, label, value]) => <label key={name}>{label} <input type="number" required min="0" step="any" name={name} defaultValue={value} /></label>)}
        <label>Frequencies (Hz) <input required name="hz" defaultValue="125 250 500 750 1000 1500" /></label>
      </fieldset>
      <button disabled={busy}>{busy ? 'Calculating horn…' : 'Run horn sweep'}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {csv && <HornResults csv={csv} />}
  </main>
}
