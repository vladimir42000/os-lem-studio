"""Exercise the running Studio in Chromium; save and check the downloaded CSV."""
import argparse
import csv
from pathlib import Path
import shutil
import struct

from playwright.sync_api import sync_playwright


def read_rows(path):
    with path.open() as stream:
        return [{k: float(v) for k, v in row.items()} for row in csv.DictReader(stream)]


def impedance(row):
    return complex(row["Ze_real_ohm"], row["Ze_imag_ohm"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("freecad", type=Path, help="AuSolveris examples/freecad directory")
    parser.add_argument("output", type=Path, help="directory for browser downloads")
    parser.add_argument("--url", default="http://localhost:5173")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    fixture = args.freecad / "conical-fixture"
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=shutil.which("chromium"))
        page = browser.new_page()
        page.set_default_timeout(310_000)
        page.goto(args.url)
        page.get_by_role("button", name="FreeCAD horn").click()
        air = page.get_by_label("Air-volume STL")
        page.get_by_label("Driver JSON").set_input_files(args.freecad / "illustrative-driver.json")
        run = page.get_by_role("button", name="Run horn sweep")
        confirm = page.get_by_role("checkbox", name="I confirm")
        air.set_input_files(fixture / "printable-wall.stl")
        confirm.check()
        run.click()
        alert = page.locator(".cad-horn [role=alert]")
        alert.wait_for()
        assert "boundary loop" in alert.inner_text()
        print(alert.inner_text(), flush=True)

        def download(stl, filename):
            air.set_input_files(stl)
            confirm.check()
            run.click()
            page.get_by_role("heading", name="Predicted response").wait_for()
            with page.expect_download() as pending:
                page.get_by_role("link", name="Download sweep CSV").click()
            dest = args.output / filename
            pending.value.save_as(dest)
            return read_rows(dest)

        air_path = fixture / "air-volume.stl"
        rows = download(air_path, "freecad-horn.csv")
        reference = read_rows(fixture / "predicted-1v.csv")
        assert [r["Hz"] for r in rows] == [125, 250, 500, 750, 1000, 1500]
        assert all(r["voltage_V_rms"] == r["distance_m"] == 1 for r in rows)
        pairs = list(zip(rows, reference, strict=True))
        dz = max(abs(impedance(a) - impedance(b)) for a, b in pairs)
        dspl = max(abs(a["SPL_dB"] - b["SPL_dB"]) for a, b in pairs)
        print(f"Reference download: max |ΔZ| = {dz:g} ohm, max |ΔSPL| = {dspl:g} dB", flush=True)
        assert dz <= 1e-6 and dspl <= 1e-5

        # Halve X and Y of every vertex in the binary fixture, preserving its caps.
        data = bytearray(air_path.read_bytes())
        for start in range(84, len(data), 50):
            for vertex in (12, 24, 36):
                offset = start + vertex
                x, y = struct.unpack_from("<ff", data, offset)
                struct.pack_into("<ff", data, offset, x / 2, y / 2)
        changed = download(dict(name="narrow.stl", mimeType="application/octet-stream",
                                buffer=bytes(data)), "narrow-horn.csv")
        for cap in ("throat_m2", "mouth_m2"):
            assert abs(changed[0][cap] / rows[0][cap] - 0.25) < 1e-8
        assert abs(impedance(changed[0]) - impedance(rows[0])) > 1e-4
        print("Replacement STL: both port areas quartered; electrical response changed.")
        browser.close()


if __name__ == "__main__":
    main()
