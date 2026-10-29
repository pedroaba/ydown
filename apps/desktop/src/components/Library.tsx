import { useState } from 'react';
import { useLibrary, useMusic, usePlayer } from '@ydown/hooks';
import { Button, IconButton, TrackArtwork, TrackItem, Dialog, Input } from '@ydown/ui-desktop';
import { ChevronRight, Clock3, Heart, Music2, Pencil, Play, Trash2 } from 'lucide-react';

export function Library({
  view,
  query,
  onClear,
  onAdd,
  onDeleted,
}: {
  view: string;
  query: string;
  onClear: () => void;
  onAdd: () => void;
  onDeleted: () => void;
}) {
  const [tab, setTab] = useState('Todas');
  const [rename, setRename] = useState(false);
  const [name, setName] = useState('');
  const {
    data,
    tracks,
    selectedPlaylist: playlist,
    availableTracks,
    status,
    saving,
    error,
    favorite,
    retry,
    playlist: edit,
  } = useLibrary(query, 'title', view === 'favorites', view);
  const runtime = useMusic();
  const player = usePlayer();
  const title = view === 'favorites' ? 'Suas favoritas' : (playlist?.name ?? 'Sua biblioteca');
  const recent = data.tracks.slice(0, 4);
  const play = (id: string) =>
    void runtime.playTrack(
      id,
      tracks.map((t) => t.id),
    );
  const groups = [...new Set(tracks.map((t) => (tab === 'Álbuns' ? t.album : t.artist)))];
  return (
    <>
      <div className="hero">
        <h1>{title}</h1>
        <p className="muted">
          {playlist
            ? `${tracks.length} músicas · Feita por você`
            : view === 'favorites'
              ? 'As músicas que ficam com você.'
              : 'Sua música, no seu ritmo.'}
        </p>
        {playlist && (
          <div className="playlist-actions">
            <Button
              variant="ghost"
              onClick={() => {
                setName(playlist.name);
                setRename(true);
              }}
            >
              <Pencil size={15} />
              Renomear
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await runtime.deletePlaylist(playlist.id);
                if (!runtime.library.getSnapshot().error) onDeleted();
              }}
            >
              <Trash2 size={15} />
              Excluir playlist
            </Button>
          </div>
        )}
      </div>
      <nav className="library-tabs" aria-label="Visualização da biblioteca">
        {['Todas', 'Recentes', 'Álbuns', 'Artistas'].map((item) => (
          <button
            key={item}
            className={tab === item ? 'active' : ''}
            aria-pressed={tab === item}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      {error && (
        <div role="alert" className="error">
          {error}
          <Button disabled={saving} onClick={() => void retry()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {status === 'loading' ? (
        <p className="empty" role="status">
          Carregando biblioteca…
        </p>
      ) : status === 'error' ? null : tracks.length ? (
        <>
          {view === 'library' && !query && tab === 'Todas' && (
            <section className="recent-section">
              <div className="section-heading">
                <h2>Da sua biblioteca</h2>
                <Button variant="ghost" onClick={() => setTab('Recentes')}>
                  Ver todas
                  <ChevronRight size={17} />
                </Button>
              </div>
              <div className="recent-grid">
                {recent.map((track) => (
                  <article className="recent-card" key={track.id}>
                    <button
                      className="cover-button"
                      aria-label={`Reproduzir ${track.title}`}
                      onClick={() => play(track.id)}
                    >
                      <TrackArtwork track={track} size="large" />
                      <span className="cover-play">
                        <Play fill="currentColor" size={22} />
                      </span>
                    </button>
                    <div className="recent-info">
                      <div>
                        <strong>{track.title}</strong>
                        <p className="muted">{track.artist}</p>
                      </div>
                      <IconButton
                        label={`Adicionar ${track.title} à fila`}
                        onClick={() => runtime.enqueue(track.id)}
                      >
                        <PlusQueue />
                      </IconButton>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          {tab === 'Álbuns' || tab === 'Artistas' ? (
            <div className="group-grid">
              {groups.map((group) => {
                const items = tracks.filter(
                  (t) => (tab === 'Álbuns' ? t.album : t.artist) === group,
                );
                return (
                  <article className="group-card" key={group}>
                    <TrackArtwork track={items[0]} size="large" />
                    <h2>{group}</h2>
                    <p className="muted">{items.length} músicas</p>
                    <Button
                      onClick={() =>
                        void runtime.playTrack(
                          items[0].id,
                          items.map((t) => t.id),
                        )
                      }
                    >
                      <Play size={16} />
                      Reproduzir
                    </Button>
                  </article>
                );
              })}
            </div>
          ) : (
            <section className="all-tracks">
              <div className="section-heading">
                <h2>{tab === 'Recentes' ? 'Adicionadas recentemente' : 'Todas as músicas'}</h2>
                <Button variant="ghost" onClick={() => play(tracks[0].id)} disabled={player.busy}>
                  <Play size={15} />
                  Reproduzir tudo
                </Button>
              </div>
              <div className="track-row table-heading" aria-hidden="true">
                <span className="track-index">#</span>
                <span>Título</span>
                <span className="track-artist-column">Artista</span>
                <span className="track-album">Álbum</span>
                <span className="duration">
                  <Clock3 size={15} />
                  Duração
                </span>
                <Heart size={15} />
              </div>
              <div role="list" aria-label={title}>
                {(tab === 'Recentes'
                  ? [...tracks].sort((a, b) => data.tracks.indexOf(b) - data.tracks.indexOf(a))
                  : tracks
                ).map((track, index) => (
                  <div key={track.id}>
                    <TrackItem
                      track={track}
                      index={index}
                      active={player.currentId === track.id}
                      favorite={data.favoriteIds.includes(track.id)}
                      disabled={saving}
                      onPlay={() => play(track.id)}
                      onFavorite={() => void favorite(track.id)}
                      onEnqueue={() => runtime.enqueue(track.id)}
                    />
                    {playlist && (
                      <Button
                        className="remove-playlist"
                        variant="ghost"
                        disabled={saving}
                        onClick={() => void edit(playlist.id, track.id, 'remove')}
                      >
                        Remover da playlist
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="empty-panel">
          <Music2 size={32} />
          <h2>{query ? 'Nenhuma música encontrada' : 'Sua próxima música começa aqui'}</h2>
          <p>
            {query
              ? 'Tente outro título, artista ou álbum.'
              : view === 'favorites'
                ? 'Marque o coração de uma música para encontrá-la aqui.'
                : 'Adicione músicas à sua biblioteca para começar.'}
          </p>
          {query ? (
            <Button onClick={onClear}>Limpar busca</Button>
          ) : (
            !playlist && view !== 'favorites' && <Button onClick={onAdd}>Adicionar música</Button>
          )}
        </div>
      )}
      {playlist && (
        <section className="playlist-add">
          <h2>Adicionar à playlist</h2>
          {availableTracks.map((t) => (
            <Button
              key={t.id}
              disabled={saving}
              onClick={() => void edit(playlist.id, t.id, 'add')}
            >
              {t.title}
              <span>+</span>
            </Button>
          ))}
          {!availableTracks.length && (
            <p className="muted">Todas as músicas da biblioteca já estão nesta playlist.</p>
          )}
        </section>
      )}
      <Dialog
        open={rename}
        onOpenChange={setRename}
        title="Renomear playlist"
        description="Escolha um novo nome."
      >
        <form
          className="playlist-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (playlist && name.trim()) {
              await runtime.renamePlaylist(playlist.id, name);
              if (!runtime.library.getSnapshot().error) setRename(false);
            }
          }}
        >
          <Input
            label="Nome da playlist"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
          <Button variant="primary" disabled={!name.trim() || saving}>
            Salvar nome
          </Button>
        </form>
      </Dialog>
    </>
  );
}
function PlusQueue() {
  return (
    <span aria-hidden="true" className="queue-plus">
      +
    </span>
  );
}
