import { useEffect, useRef, useState } from 'react';
import { useMusic } from '@ydown/hooks';
import type { AcquisitionJob, MediaKind, MediaPreview } from '@ydown/contracts';
import { Button, Dialog, Input } from '@ydown/ui-desktop';
import { Download, Link, Music2, Video, RotateCcw, X } from 'lucide-react';
import { formatBytes, formatDuration } from '@ydown/utils';
import { native, youtube } from '../adapters/native';

export function AddYouTube({
  open,
  onOpenChange,
  onQueued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQueued: (job: AcquisitionJob) => void;
}) {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<MediaPreview | null>(null);
  const [kind, setKind] = useState<MediaKind>('audio');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  async function inspect() {
    const id = ++request.current;
    setBusy(true);
    setError('');
    setPreview(null);
    try {
      const data = await youtube.preview(url);
      if (id === request.current) setPreview(data);
    } catch (err) {
      if (id === request.current) setError(String(err));
    } finally {
      if (id === request.current) setBusy(false);
    }
  }
  async function download() {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      const job = await youtube.enqueue(preview.url, kind);
      if (job.status === 'failed' || job.status === 'cancelled') await youtube.retry(job.id);
      onQueued(job);
      onOpenChange(false);
      setUrl('');
      setPreview(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
      title="Adicionar do YouTube"
      description="Cole o link de uma música ou vídeo para salvar neste computador e reproduzir offline."
    >
      <form
        className="youtube-form"
        onSubmit={(e) => {
          e.preventDefault();
          void inspect();
        }}
      >
        <p className="field-label">Link do YouTube</p>
        <div className="youtube-url">
          <Link size={18} />
          <Input
            id="youtube-url"
            autoFocus
            label="Link do YouTube"
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            disabled={busy}
            onChange={(e) => {
              ++request.current;
              setUrl(e.target.value);
              setPreview(null);
              setError('');
            }}
          />
        </div>
        <Button type="submit" disabled={busy || !url.trim() || !native}>
          {busy ? 'Consultando…' : 'Buscar vídeo'}
        </Button>
      </form>
      {!native && (
        <p className="muted dialog-note">Abra a janela desktop do LOCAL para baixar do YouTube.</p>
      )}
      {preview && (
        <div className="youtube-preview">
          <img src={preview.thumbnail} alt="" />
          <div>
            <strong>{preview.title}</strong>
            <p className="muted">
              {preview.artist} · {formatDuration(preview.duration)}
            </p>
          </div>
        </div>
      )}
      <fieldset className="format-picker" disabled={busy}>
        <legend>Salvar como</legend>
        <label className={kind === 'audio' ? 'selected' : ''}>
          <input
            type="radio"
            name="media-kind"
            value="audio"
            checked={kind === 'audio'}
            onChange={() => setKind('audio')}
          />
          <Music2 size={20} />
          <span>
            Áudio<small>M4A · música offline</small>
          </span>
        </label>
        <label className={kind === 'video' ? 'selected' : ''}>
          <input
            type="radio"
            name="media-kind"
            value="video"
            checked={kind === 'video'}
            onChange={() => setKind('video')}
          />
          <Video size={20} />
          <span>
            Vídeo<small>MP4 · até 1080p</small>
          </span>
        </label>
      </fieldset>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <Button
        className="download-submit"
        variant="primary"
        disabled={!preview || busy || !native}
        onClick={() => void download()}
      >
        <Download size={18} />
        {busy && preview ? 'Adicionando à fila…' : 'Baixar do YouTube'}
      </Button>
      <p className="muted dialog-note">
        Baixe apenas conteúdo que você tem autorização para salvar.
      </p>
    </Dialog>
  );
}
export function useYouTubeDownloads() {
  const runtime = useMusic();
  const [jobs, setJobs] = useState<AcquisitionJob[]>([]);
  const [error, setError] = useState('');
  const completed = useRef(new Set<string>());
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await youtube.list();
        if (stopped) return;
        setJobs(next);
        setError('');
        const fresh = next.filter((j) => j.status === 'completed' && !completed.current.has(j.id));
        if (fresh.length && !runtime.library.getSnapshot().saving) {
          await runtime.initialize();
          if (runtime.library.getSnapshot().status === 'ready')
            fresh.forEach((j) => completed.current.add(j.id));
        }
      } catch (err) {
        if (!stopped) setError(String(err));
      } finally {
        if (!stopped) timer = setTimeout(() => void poll(), 900);
      }
    }
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [runtime]);
  return { jobs, error };
}
const statuses: Record<AcquisitionJob['status'], string> = {
  queued: 'Na fila',
  downloading: 'Baixando',
  processing: 'Processando e validando',
  completed: 'Disponível offline',
  failed: 'Falha no download',
  cancelled: 'Cancelado',
};
export function Downloads({
  jobs,
  error,
  onAdd,
}: {
  jobs: AcquisitionJob[];
  error: string;
  onAdd: () => void;
}) {
  const [actionError, setActionError] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  async function action(job: AcquisitionJob, retry: boolean) {
    setPending(job.id);
    setActionError('');
    try {
      if (retry) await youtube.retry(job.id);
      else await youtube.cancel(job.id);
    } catch (err) {
      setActionError(String(err));
    } finally {
      setPending(null);
    }
  }
  return (
    <section>
      <div className="hero">
        <h1>Downloads</h1>
        <p className="muted">Do YouTube para a sua biblioteca.</p>
      </div>
      {(error || actionError) && (
        <p className="error" role="alert">
          {error || actionError}
        </p>
      )}
      {!jobs.length ? (
        <div className="empty-panel">
          <Download size={32} />
          <h2>Seu próximo download começa aqui</h2>
          <p>Cole um link do YouTube para salvar áudio ou vídeo e reproduzir offline.</p>
          <Button onClick={onAdd}>
            <Link size={18} />
            Adicionar link
          </Button>
        </div>
      ) : (
        <div className="downloads-list">
          {[...jobs].reverse().map((job) => {
            const active = ['queued', 'downloading', 'processing'].includes(job.status);
            const percent = job.total
              ? Math.min(100, Math.floor((job.received / job.total) * 100))
              : null;
            return (
              <article className="download-job" key={job.id}>
                <div className="download-kind">{job.kind === 'audio' ? <Music2 /> : <Video />}</div>
                <div className="download-details">
                  <strong>{job.title}</strong>
                  <p className="muted">
                    {statuses[job.status]} · {job.kind === 'audio' ? 'Áudio M4A' : 'Vídeo MP4'}
                    {job.status === 'downloading' &&
                      ` · ${formatBytes(job.received)}${job.total ? ` de ${formatBytes(job.total)} (${percent}%)` : ''}`}
                  </p>
                  {job.status === 'downloading' && (
                    <progress
                      aria-label={`Download de ${job.title}`}
                      max={job.total || undefined}
                      value={job.total ? job.received : undefined}
                    />
                  )}
                  {job.status === 'processing' && (
                    <p className="muted">
                      Finalizando o arquivo. Ele aparecerá na biblioteca após a validação.
                    </p>
                  )}
                  {job.error && (
                    <p className="error" role="alert">
                      {job.error}
                    </p>
                  )}
                </div>
                {active ? (
                  <Button
                    aria-label={`Cancelar download de ${job.title}`}
                    disabled={pending === job.id}
                    onClick={() => void action(job, false)}
                  >
                    <X size={17} />
                    Cancelar
                  </Button>
                ) : ['failed', 'cancelled'].includes(job.status) ? (
                  <Button disabled={pending === job.id} onClick={() => void action(job, true)}>
                    <RotateCcw size={16} />
                    Tentar novamente
                  </Button>
                ) : (
                  <span className="download-complete">Concluído</span>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
