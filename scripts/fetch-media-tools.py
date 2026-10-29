"""Restore the pinned macOS arm64 tools; no downloads occur at app runtime."""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
base = root / 'apps/desktop/src-tauri/binaries'
manifest = json.loads((base / 'manifest.json').read_text())
for entry in manifest['files']:
    destination = base / 'macos-arm64' / entry['name']
    if destination.exists() and hashlib.sha256(destination.read_bytes()).hexdigest() == entry['binarySha256']:
        print(f"Verified: {entry['name']}")
        continue
    data = subprocess.check_output(['curl', '-fLsS', '--max-time', '180', entry['url']])
    if hashlib.sha256(data).hexdigest() != entry['archiveSha256']:
        raise RuntimeError(f"Archive checksum mismatch: {entry['name']}")
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        name = next(name for name in archive.namelist() if Path(name).name == entry['name'])
        binary = archive.read(name)
    if hashlib.sha256(binary).hexdigest() != entry['binarySha256']:
        raise RuntimeError(f"Binary checksum mismatch: {entry['name']}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(binary)
    destination.chmod(0o755)
    print(f"Restored: {entry['name']}")
