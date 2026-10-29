"""Prepare FFmpeg/FFprobe from a pinned local build. Never downloads executables."""
import argparse
import hashlib
import json
import os
import re
import shlex
from pathlib import Path
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'apps/desktop/src-tauri/binaries'


def matches(path, entry):
    if not path.is_file() or path.stat().st_size != entry['bytes']:
        return False
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest() == entry['binarySha256']


def resolve_source_dir(local_build):
    name = local_build['baseDir']['env']
    if not isinstance(name, str) or not re.fullmatch(r'[A-Z_][A-Z0-9_]*', name):
        raise ValueError('Invalid baseDir environment variable name.')
    configured = os.environ.get(name)
    # Only read this variable from .env.local; never execute/source shell code.
    env_file = ROOT / '.env.local'
    if configured is None and env_file.is_file():
        for line in env_file.read_text().splitlines():
            key, separator, value = line.strip().removeprefix('export ').partition('=')
            if separator and key.strip() == name:
                values = shlex.split(value.strip(), comments=True)
                if len(values) != 1:
                    raise ValueError(f'Use one value for {name}; quote paths containing spaces.')
                configured = values[0]
    if not configured or not configured.strip():
        raise ValueError(f'Configure {name} in the environment or .env.local before preparing the local build.')
    base = Path(configured).expanduser()
    if not base.is_absolute():
        raise ValueError(f'{name} must be an absolute directory.')
    relative = Path(local_build['binDirectory'])
    if relative.is_absolute():
        raise ValueError('binDirectory must be relative to baseDir.')
    source = (base / relative).resolve()
    try:
        source.relative_to(base.resolve())
    except ValueError:
        raise ValueError('binDirectory must remain inside baseDir.') from None
    return source


def prepare_tools(manifest_path, destination_dir, source_dir=None):
    manifest = json.loads(Path(manifest_path).read_text())
    if manifest.get('schemaVersion') != 3 or manifest.get('mode') != 'local-build':
        raise ValueError('Expected a local-build manifest (schemaVersion 3).')
    entries = manifest['files']
    if len(entries) != 2 or {entry['name'] for entry in entries} != {'ffmpeg', 'ffprobe'}:
        raise ValueError('The manifest must contain exactly ffmpeg and ffprobe.')
    for entry in entries:
        checksum = entry['binarySha256']
        if len(checksum) != 64 or any(c not in '0123456789abcdef' for c in checksum):
            raise ValueError(f"Invalid SHA-256: {entry['name']}")
        if not isinstance(entry['bytes'], int) or entry['bytes'] <= 0:
            raise ValueError(f"Invalid file size: {entry['name']}")
    source_dir = Path(source_dir).expanduser() if source_dir is not None else None
    destination_dir = Path(destination_dir)
    pending = []
    messages = []
    # Validate every required source before replacing any existing executable.
    for entry in entries:
        destination = destination_dir / entry['name']
        if not destination.is_symlink() and matches(destination, entry):
            destination.chmod(0o755)
            messages.append(f"Verified local build: {entry['name']}")
            continue
        if source_dir is None:
            source_dir = resolve_source_dir(manifest['localBuild'])
        source = source_dir / entry['name']
        if not source.is_file():
            raise FileNotFoundError(
                f"Local build not found: {source}. Check LOCAL_MEDIA_BASE_DIR or pass --source-dir. "
                'No network fallback is configured.'
            )
        if not matches(source, entry):
            raise ValueError(f"Local build size/SHA-256 mismatch: {source}. Nothing was copied.")
        pending.append((source, destination, entry))
    if pending:
        destination_dir.mkdir(parents=True, exist_ok=True)
    for source, destination, entry in pending:
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=destination_dir, prefix=f'.{entry["name"]}-', delete=False) as stream:
                temporary = Path(stream.name)
                with source.open('rb') as original:
                    shutil.copyfileobj(original, stream, length=1024 * 1024)
                stream.flush()
                os.fsync(stream.fileno())
            if not matches(temporary, entry):
                raise ValueError(f"Copied file checksum mismatch: {entry['name']}")
            temporary.chmod(0o755)
            os.replace(temporary, destination)
            messages.append(f"Prepared local build: {entry['name']}")
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
    return messages


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, help='Override the local directory containing both pinned executables.')
    args = parser.parse_args()
    try:
        for message in prepare_tools(BASE / 'manifest.json', BASE / 'macos-arm64', args.source_dir):
            print(message)
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(1, f'Media tools preparation failed: {error}\n')


if __name__ == '__main__':
    main()
