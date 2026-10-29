import { useEffect, useRef, useState } from 'react';
import { useLibrary, useMusic, usePlayer, usePlayerProgress } from '@ydown/hooks';
import {
  Button,
  Dialog,
  FavoriteButton,
  IconButton,
  PlaybackControls,
  PlayerProgress,
  TrackArtwork,
} from '@ydown/ui-desktop';
import { audioSource } from '../adapters/native';
import { ListMusic, Repeat, Shuffle, Volume2, VolumeX, Video, X } from 'lucide-react';
function ConnectedProgress() {
  const { position, duration, seek } = usePlayerProgress();
  return (
    <PlayerProgress position={position} duration={duration} onSeek={(value) => void seek(value)} />
  );
}
export function Player() {
  const runtime = useMusic();
  const state = usePlayer();
  const { data, saving, favorite } = useLibrary();
  const [watching, setWatching] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const track = data.tracks.find((t) => t.id === state.currentId);
  const controls = (
    <PlaybackControls
      playing={state.playing}
      busy={state.busy || !track}
      canPrevious={state.canPrevious || state.repeat === 'all' || state.shuffle}
      canNext={state.canNext || state.repeat === 'all' || state.shuffle}
      onToggle={() => void runtime.togglePlayback()}
      onPrevious={() => void runtime.previous()}
      onNext={() => void runtime.next()}
    />
  );
  return (
    <>
      <footer className="player-bar" aria-label="Player">
        <div className="player-metadata">
          {track ? (
            <>
              <TrackArtwork track={track} />
              <div>
                <strong>{track.title}</strong>
                <div className="muted">{track.artist}</div>
              </div>
              <FavoriteButton
                favorite={data.favoriteIds.includes(track.id)}
                disabled={saving}
                onToggle={() => void favorite(track.id)}
              />
            </>
          ) : (
            <span className="muted">Escolha uma faixa para ouvir</span>
          )}
        </div>
        <div className="player-center">
          <div className="playback-controls player-transport">
            <IconButton
              label="Modo aleatório"
              className={`mode-button ${state.shuffle ? 'is-active' : ''}`}
              aria-pressed={state.shuffle}
              onClick={runtime.toggleShuffle}
            >
              <Shuffle size={19} />
            </IconButton>
            {controls}
            <IconButton
              label={`Repetição: ${state.repeat === 'off' ? 'desligada' : state.repeat === 'all' ? 'todas' : 'uma faixa'}`}
              className={`mode-button ${state.repeat !== 'off' ? 'is-active' : ''}`}
              onClick={runtime.cycleRepeat}
            >
              <Repeat size={19} />
              {state.repeat === 'one' && <span className="repeat-one">1</span>}
            </IconButton>
          </div>
          <ConnectedProgress />
        </div>
        <div className="player-actions">
          {track?.mediaKind === 'video' && (
            <IconButton
              label="Assistir ao vídeo"
              onClick={async () => {
                if (state.playing) await runtime.togglePlayback();
                setWatching(true);
              }}
            >
              <Video size={19} />
            </IconButton>
          )}
          <IconButton label="Abrir fila de reprodução" onClick={() => setExpanded(true)}>
            <ListMusic size={20} />
          </IconButton>
          <IconButton
            label={state.volume === 0 ? 'Ativar som' : 'Silenciar'}
            onClick={() => void runtime.setVolume(state.volume === 0 ? 1 : 0)}
          >
            {state.volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </IconButton>
          <input
            className="volume-slider"
            aria-label="Volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={state.volume}
            onChange={(e) => void runtime.setVolume(Number(e.target.value))}
          />
        </div>
      </footer>
      {watching && track && (
        <VideoViewer source={track.source} title={track.title} onClose={() => setWatching(false)} />
      )}
      {state.error && (
        <div
          role="alert"
          className="error surface"
          style={{ position: 'fixed', bottom: 120, right: 20, zIndex: 20 }}
        >
          {state.error}
        </div>
      )}
      <Dialog
        open={expanded}
        onOpenChange={setExpanded}
        title="Agora tocando"
        description="Sua música, no seu tempo."
      >
        {track ? (
          <>
            <TrackArtwork track={track} size="large" />
            <div className="full-player-title">
              <h2>{track.title}</h2>
              <p className="muted">
                {track.artist} · {track.album}
              </p>
            </div>
            <ConnectedProgress />
            {controls}
          </>
        ) : (
          <p className="empty">Reproduza uma faixa da biblioteca.</p>
        )}
        <section className="queue">
          <h2>Fila de reprodução</h2>
          {state.queue.length === 0 && <p className="empty">Sua fila está vazia.</p>}
          {state.queue.map((id, i) => {
            const item = data.tracks.find((t) => t.id === id);
            return (
              item && (
                <div className="queue-row" key={id}>
                  <Button
                    variant="ghost"
                    onClick={() => void runtime.playTrack(id)}
                    aria-current={id === state.currentId ? 'true' : undefined}
                  >
                    {item.title}
                  </Button>
                  <IconButton
                    label={`Remover ${item.title} da fila`}
                    disabled={id === state.currentId}
                    onClick={() => runtime.removeFromQueue(i)}
                  >
                    <X size={16} />
                  </IconButton>
                </div>
              )
            );
          })}
        </section>
      </Dialog>
    </>
  );
}

function VideoViewer({
  source,
  title,
  onClose,
}: {
  source: string;
  title: string;
  onClose: () => void;
}) {
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');
  const runtime = useMusic();
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let active = true;
    void audioSource(source)
      .then((value) => {
        if (active) setSrc(value);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, [source]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          if (video.current) void runtime.seek(video.current.currentTime);
          onClose();
        }
      }}
      title={title}
      description="Vídeo salvo neste computador."
    >
      {src && (
        <video
          ref={video}
          className="local-video"
          src={src}
          controls
          playsInline
          onLoadedMetadata={() => {
            if (video.current) video.current.currentTime = runtime.progress.getSnapshot().position;
          }}
          onError={() => setError('Não foi possível abrir este vídeo. Baixe-o novamente.')}
        />
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
