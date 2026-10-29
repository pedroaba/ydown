import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest import mock

script = Path(__file__).resolve().parents[1] / 'fetch-media-tools.py'
spec = importlib.util.spec_from_file_location('media_tools', script)
media_tools = importlib.util.module_from_spec(spec)
spec.loader.exec_module(media_tools)


class LocalMediaToolsTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.base = self.root / 'media sources'
        self.source = self.base / 'build/install/bin'
        self.source.mkdir(parents=True)
        environment = mock.patch.dict(os.environ, {'LOCAL_MEDIA_BASE_DIR': str(self.base)})
        environment.start()
        self.addCleanup(environment.stop)
        root = mock.patch.object(media_tools, 'ROOT', self.root)
        root.start()
        self.addCleanup(root.stop)
        self.destination = self.root / 'project'
        entries = []
        for name in ['ffmpeg', 'ffprobe']:
            content = f'local-test-{name}'.encode()
            (self.source / name).write_bytes(content)
            entries.append({'name': name, 'bytes': len(content), 'binarySha256': hashlib.sha256(content).hexdigest()})
        self.manifest = self.root / 'manifest.json'
        self.manifest.write_text(json.dumps({'schemaVersion': 3, 'mode': 'local-build', 'localBuild': {'baseDir': {'env': 'LOCAL_MEDIA_BASE_DIR'}, 'binDirectory': 'build/install/bin'}, 'files': entries}))

    def test_copies_verified_tools_and_reuses_them_without_ssd(self):
        media_tools.prepare_tools(self.manifest, self.destination)
        for name in ['ffmpeg', 'ffprobe']:
            path = self.destination / name
            self.assertEqual(path.read_bytes(), (self.source / name).read_bytes())
            self.assertTrue(path.stat().st_mode & stat.S_IXUSR)
            path.chmod(0o644)
            (self.source / name).unlink()
        os.environ.pop('LOCAL_MEDIA_BASE_DIR', None)
        messages = media_tools.prepare_tools(self.manifest, self.destination)
        self.assertTrue(all(message.startswith('Verified') for message in messages))
        self.assertTrue((self.destination / 'ffmpeg').stat().st_mode & stat.S_IXUSR)

    def test_tampered_source_does_not_replace_existing_tools(self):
        self.destination.mkdir()
        (self.destination / 'ffmpeg').write_bytes(b'previous')
        (self.source / 'ffprobe').write_bytes(b'tampered')
        with self.assertRaisesRegex(ValueError, 'mismatch'):
            media_tools.prepare_tools(self.manifest, self.destination)
        self.assertEqual((self.destination / 'ffmpeg').read_bytes(), b'previous')
        self.assertFalse((self.destination / 'ffprobe').exists())

    def test_missing_source_fails_without_creating_destination(self):
        (self.source / 'ffprobe').unlink()
        with self.assertRaisesRegex(FileNotFoundError, 'No network fallback'):
            media_tools.prepare_tools(self.manifest, self.destination)
        self.assertFalse(self.destination.exists())

    def test_directory_override_still_requires_pinned_hashes(self):
        override = self.root / 'other-build'
        self.source.rename(override)
        media_tools.prepare_tools(self.manifest, self.destination, override)
        self.assertTrue((self.destination / 'ffmpeg').is_file())
        (self.destination / 'ffprobe').unlink()
        (override / 'ffprobe').write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'mismatch'):
            media_tools.prepare_tools(self.manifest, self.destination, override)

    def test_reads_quoted_base_dir_from_local_env_file(self):
        os.environ.pop('LOCAL_MEDIA_BASE_DIR', None)
        (self.root / '.env.local').write_text(f'LOCAL_MEDIA_BASE_DIR="{self.base}" # external disk\n')
        media_tools.prepare_tools(self.manifest, self.destination)
        self.assertTrue((self.destination / 'ffprobe').is_file())

    def test_environment_overrides_local_env_file(self):
        (self.root / '.env.local').write_text('LOCAL_MEDIA_BASE_DIR="/wrong/path"\n')
        media_tools.prepare_tools(self.manifest, self.destination)
        self.assertTrue((self.destination / 'ffmpeg').is_file())

    def test_missing_variable_fails_before_copying(self):
        os.environ.pop('LOCAL_MEDIA_BASE_DIR', None)
        with self.assertRaisesRegex(ValueError, 'Configure LOCAL_MEDIA_BASE_DIR'):
            media_tools.prepare_tools(self.manifest, self.destination)
        self.assertFalse(self.destination.exists())

    def test_manifest_cannot_escape_base_directory(self):
        manifest = json.loads(self.manifest.read_text())
        manifest['localBuild']['binDirectory'] = '../outside'
        self.manifest.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'inside baseDir'):
            media_tools.prepare_tools(self.manifest, self.destination)
        self.assertFalse(self.destination.exists())


if __name__ == '__main__':
    unittest.main()
