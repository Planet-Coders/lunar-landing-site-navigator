#!/usr/bin/env python3
"""Refresh checked-in NASA reference data. Requires Python GDAL and NumPy.

Run with /usr/bin/python3 scripts/refresh-nasa-data.py on the cloud image.
Downloads use inherited HTTPS proxy/CA verification. No runtime GDAL is needed.
"""
import hashlib
import json
import math
from pathlib import Path
import tempfile
import urllib.request

import numpy as np
from osgeo import gdal

ROOT = Path(__file__).resolve().parents[1]
RADIUS_M = 1737400
REGIONS = [
    ("shackleton-rim", "Shackleton Rim", "Site04"),
    ("connecting-ridge", "Connecting Ridge", "Site01"),
    ("connecting-ridge-ext", "Connecting Ridge Extension", "SL3"),
    ("malapert-massif", "Malapert Massif", "Site23"),
    ("leibnitz-beta", "Leibnitz Beta Plateau", "Site20v2"),
    ("de-gerlache-rim-1", "de Gerlache Rim (Site11)", "Site11"),
    ("de-gerlache-rim-2", "de Gerlache Rim (SL2)", "SL2"),
    ("de-gerlache-kocher", "de Gerlache–Kocher Massif", "Site42"),
    ("faustini-rim", "Faustini Rim A", "LM7"),
    ("haworth", "Haworth", "Haworth"),
    ("nobile-rim", "Nobile Rim 1", "Site06"),
    ("amundsen-rim", "Amundsen Rim", "DM1"),
    ("cabeus-exterior", "Cabeus Exterior Wall 1", "NPA"),
]
BASE = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp"
SVS = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720"


def main():
    gdal.UseExceptions()
    for key, value in {
        "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
        "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif,.TIF",
        "GDAL_HTTP_TIMEOUT": "30",
    }.items():
        gdal.SetConfigOption(key, value)
    data_dir = ROOT / "data"
    assets = ROOT / "public/data"
    data_dir.mkdir(exist_ok=True)
    assets.mkdir(parents=True, exist_ok=True)
    sites = []
    for site_id, name, product in REGIONS:
        url = f"{BASE}/{product}/{product}_final_adj_5mpp_surf.tif"
        # Download first: some origin servers reject GDAL's multipart range reads.
        with urllib.request.urlopen(url, timeout=60) as response:
            raw = response.read()
        local = "/vsimem/reference-site.tif"
        gdal.FileFromMemBuffer(local, raw)
        ds = gdal.Open(local)
        gt = ds.GetGeoTransform()
        if gt[1] != 5 or gt[5] != -5 or ds.GetSpatialRef().GetSemiMajor() != RADIUS_M:
            raise ValueError(f"Unexpected grid/reference sphere: {url}")
        col, row = ds.RasterXSize // 2, ds.RasterYSize // 2
        x, y = gt[0] + (col + 0.5) * gt[1], gt[3] + (row + 0.5) * gt[5]
        elevation = float(ds.ReadAsArray(col, row, 1, 1)[0, 0])
        if not math.isfinite(elevation):
            raise ValueError(f"No elevation at center pixel: {url}")
        latitude = -90 + math.degrees(2 * math.atan(math.hypot(x, y) / (2 * RADIUS_M)))
        longitude = math.degrees(math.atan2(x, y)) % 360
        sites.append({
            "id": site_id, "name": name, "latitude": latitude,
            "longitude": longitude, "altitude": elevation,
            "region": f"NASA LOLA {product}",
            "description": f"Reference point at the center pixel of NASA LOLA {product}, not an official landing location. Geometric visibility only.",
            "provenance": {
                "agency": "NASA GSFC / LRO LOLA", "product": product,
                "sourceSha256": hashlib.sha256(raw).hexdigest(),
                "url": url, "documentation": "https://pgda.gsfc.nasa.gov/products/78",
                "citation": "https://doi.org/10.1016/j.pss.2020.105119",
                "frame": "MOON_ME_DE421", "referenceRadiusM": RADIUS_M,
                "verticalDatum": "meters above the 1737400 m reference sphere",
                "selection": "center pixel (floor(width/2), floor(height/2)), zero instrument height",
                "pixel": [col, row], "gridSize": [ds.RasterXSize, ds.RasterYSize],
                "eastingM": x, "northingM": y, "pixelScaleM": 5,
            },
        })
        ds = None
        gdal.Unlink(local)
        print(product, latitude, longitude, elevation, flush=True)
    (data_dir / "sites.json").write_text(json.dumps(sites, indent=2) + "\n")

    manifest = {"documentation": "https://svs.gsfc.nasa.gov/4720/", "maps": []}
    with tempfile.TemporaryDirectory() as tmp:
        for source, output in [("lroc_color_poles_2k.tif", "moon-color.png"), ("ldem_4.tif", "moon-height.png")]:
            url = f"{SVS}/{source}"
            with urllib.request.urlopen(url, timeout=60) as response:
                raw = response.read()
            path = Path(tmp) / source
            path.write_bytes(raw)
            ds = gdal.Open(str(path))
            record = {"url": url, "sourceSha256": hashlib.sha256(raw).hexdigest(), "file": f"/data/{output}", "longitudeAtLeftEdge": -180, "longitudeAtCenter": 0}
            if "height" in output:
                # SVS float TIFF pixels are kilometers above the 1737.4 km sphere.
                heights = ds.ReadAsArray().astype(float)
                if not np.isfinite(heights).all():
                    raise ValueError("Missing NASA map elevation")
                lo, hi = float(heights.min()), float(heights.max())
                # Preserve NASA's half-meter elevations for arbitrary-location
                # queries. This 0.25-degree grid is coarse, not a local DEM.
                grid = np.rint(heights * 2000).astype("<i2").tobytes()
                (data_dir / "moon-elevation.bin").write_bytes(grid)
                record.update({"width": ds.RasterXSize, "height": ds.RasterYSize,
                    "gridSha256": hashlib.sha256(grid).hexdigest(),
                    "pixelScaleDeg": 0.25, "gridUnits": "signed little-endian int16, 0.5 m above 1737400 m sphere"})
                image = gdal.GetDriverByName("MEM").Create("", ds.RasterXSize, ds.RasterYSize, 1, gdal.GDT_Byte)
                image.GetRasterBand(1).WriteArray(np.rint((heights - lo) / (hi - lo) * 255).astype(np.uint8))
                gdal.GetDriverByName("PNG").CreateCopy(str(assets / output), image)
                record.update({"minHeightKm": lo, "maxHeightKm": hi, "usage": "display bump map only; not used for local visibility"})
            else:
                gdal.Translate(str(assets / output), ds, format="PNG")
                (assets / (output + ".aux.xml")).unlink(missing_ok=True)
                record["usage"] = "2019 NASA SVS adaptation of LROC WAC Hapke-normalized mosaic"
            record["sha256"] = hashlib.sha256((assets / output).read_bytes()).hexdigest()
            manifest["maps"].append(record)
    (data_dir / "moon-maps.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
