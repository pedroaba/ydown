# Media tools shipped with LOCAL

These executables are restored into the local project by `scripts/fetch-media-tools.py` and copied into the macOS application resources. They are ignored by Git; this source repository stores the pinned manifest, setup script and license notices instead of executable files. Runtime code resolves them relative to the application bundle; it does not search PATH, Homebrew, Python, Node, Deno or yt-dlp.

- Platform: macOS Apple Silicon (`aarch64-apple-darwin`).
- FFmpeg / FFprobe release: 9.0.2.
- Build provider: https://ffmpeg.martin-riedl.de/
- Immutable archive URLs, archive SHA-256 and binary SHA-256: `manifest.json`.
- Both binaries only link Apple/system libraries; checked with `otool -L`.
- Restore/verify from the repository root: `python3 scripts/fetch-media-tools.py`.

Licenses and notices: `FFMPEG-LICENSE.txt`, `GPL-3.0.txt`. These builds enable GPL components. Build scripts, source dependency references and configuration are published by the provider at https://git.martin-riedl.de/ffmpeg/build-script . The upstream FFmpeg source for this release is https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz . Public redistribution requires reviewing and fulfilling the applicable third-party license requirements; this repository is a local development build, not a signed public distribution.

Windows, Linux and Intel Mac binaries have not been included. Add binaries and checksums for those targets and extend `tool_path` before packaging them. Mobile is unchanged.
