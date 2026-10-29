import { useEffect, useState } from 'react';
import { useLibrary, useMusic } from '@ydown/hooks';
import { Button, Dialog, IconButton, Input } from '@ydown/ui-desktop';
import {
  AudioLines,
  Heart,
  Music2,
  Download,
  Plus,
  Settings,
  HardDrive,
  Search,
  FileAudio,
} from 'lucide-react';
import { formatBytes } from '@ydown/utils';
import { Library } from './components/Library';
import { Player } from './components/Player';
import { AddYouTube, Downloads, useYouTubeDownloads } from './components/YouTube';
import { mediaTools, storageInfo } from './adapters/native';

export function App() {
  const [view, setView] = useState('library');
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  const [storage, setStorage] = useState({ path: '', bytes: 0 });
  const { data, saving } = useLibrary();
  const runtime = useMusic();
  const { jobs, error: downloadError } = useYouTubeDownloads();
  const [tools, setTools] = useState<string[]>([]);
  const [toolError, setToolError] = useState('');
  useEffect(() => {
    void mediaTools()
      .then(setTools)
      .catch((e) => setToolError(String(e)));
  }, []);
  useEffect(() => {
    void storageInfo()
      .then(setStorage)
      .catch(() => {});
  }, [data.tracks]);
  const navigate = (id: string) => {
    setView(id);
    setQuery('');
  };
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <AudioLines className="brand-mark" size={28} />
          <span>LOCAL</span>
        </div>
        <nav className="nav" aria-label="Navegação principal">
          {[
            { id: 'library', title: 'Biblioteca', icon: Music2 },
            { id: 'downloads', title: 'Downloads', icon: Download },
            { id: 'favorites', title: 'Favoritas', icon: Heart },
          ].map(({ id, title, icon: Icon }) => (
            <Button
              key={id}
              variant="ghost"
              className={view === id ? 'selected' : ''}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={22} />
              {title}
            </Button>
          ))}
        </nav>
        <div className="sidebar-playlists">
          <div className="section-heading">
            <span>Playlists</span>
            <IconButton label="Criar playlist" onClick={() => setPlaylistOpen(true)}>
              <Plus size={18} />
            </IconButton>
          </div>
          {data.playlists.map((playlist) => (
            <Button
              key={playlist.id}
              variant="ghost"
              className={`playlist-card ${view === playlist.id ? 'selected' : ''}`}
              aria-current={view === playlist.id ? 'page' : undefined}
              onClick={() => navigate(playlist.id)}
            >
              <span className="playlist-artwork" aria-hidden="true">
                <Music2 size={20} />
              </span>
              <span>{playlist.name}</span>
            </Button>
          ))}
          {!data.playlists.length && (
            <p className="sidebar-hint">Crie uma playlist para reunir suas músicas.</p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="storage">
            <HardDrive size={18} />
            <div>
              <span>{formatBytes(storage.bytes)} usados</span>
              <p className="muted">Armazenamento local</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className={view === 'settings' ? 'selected' : ''}
            onClick={() => navigate('settings')}
          >
            <Settings size={20} />
            Configurações
          </Button>
        </div>
      </aside>
      <main className="main">
        <header className="topline">
          <div className="search">
            <Search size={20} />
            <Input
              label="Buscar na sua biblioteca"
              placeholder="Buscar na sua biblioteca"
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (view === 'settings' || view === 'downloads') setView('library');
              }}
            />
          </div>
          <span className="local-badge">
            <HardDrive size={17} />
            Biblioteca local
          </span>
          <Button
            variant="primary"
            onClick={() => {
              setAddOpen(true);
            }}
          >
            <Plus size={21} />
            Adicionar música
          </Button>
        </header>
        {notice && (
          <div role="status" className="notice">
            {notice}
            <IconButton label="Dispensar aviso" onClick={() => setNotice('')}>
              ×
            </IconButton>
          </div>
        )}
        {view === 'downloads' ? (
          <Downloads jobs={jobs} error={downloadError} onAdd={() => setAddOpen(true)} />
        ) : view === 'settings' ? (
          <section>
            <div className="hero">
              <h1>Configurações</h1>
              <p className="muted">Tudo fica neste computador.</p>
            </div>
            <div className="settings-panel">
              <HardDrive size={24} />
              <div>
                <h2>Armazenamento da biblioteca</h2>
                <p className="muted">
                  {formatBytes(storage.bytes)} em downloads salvos neste computador. O LOCAL mantém
                  suas músicas disponíveis offline.
                </p>
                <code>{storage.path}</code>
              </div>
            </div>
            <div className="settings-panel">
              <FileAudio size={24} />
              <div>
                <h2>Ferramentas incluídas</h2>
                {tools.map((tool) => (
                  <p className="muted tool-version" key={tool}>
                    {tool}
                  </p>
                ))}
                {toolError && (
                  <p className="error" role="alert">
                    {toolError}
                  </p>
                )}
                <p className="muted">
                  Áudio em M4A e vídeo em MP4. Downloads e processamento acontecem no backend Rust.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <Library
            key={view}
            view={view}
            query={query}
            onClear={() => setQuery('')}
            onAdd={() => setAddOpen(true)}
            onDeleted={() => navigate('library')}
          />
        )}
      </main>
      <Player />
      <AddYouTube
        open={addOpen}
        onOpenChange={setAddOpen}
        onQueued={(job) => {
          setView('downloads');
          setNotice(
            job.status === 'completed'
              ? 'Este conteúdo já está na biblioteca.'
              : 'Download adicionado à fila.',
          );
        }}
      />
      <Dialog
        open={playlistOpen}
        onOpenChange={setPlaylistOpen}
        title="Nova playlist"
        description="Um lugar para cada momento."
      >
        <form
          className="playlist-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await runtime.createPlaylist(name);
            if (!runtime.library.getSnapshot().error) {
              setName('');
              setPlaylistOpen(false);
            }
          }}
        >
          <Input
            autoFocus
            label="Nome da playlist"
            placeholder="Nome da playlist"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
          <Button variant="primary" disabled={!name.trim() || saving}>
            Criar playlist
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
