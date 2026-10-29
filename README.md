# LOCAL

**Sua música, no seu ritmo.**

Aplicativo desktop para baixar músicas e vídeos do YouTube e reproduzir offline. Construído com **Tauri 2, Rust, React e TypeScript**, com biblioteca local em SQLite e sem servidor remoto, conta ou sincronização.

> **v0.1.0 — primeira versão experimental.** O desktop foi validado em macOS Apple Silicon. O aplicativo Expo existente está preservado, mas não recebe o fluxo de downloads nesta versão.

## Funcionalidades

- Adição por link do YouTube, YouTube Music, Shorts ou `youtu.be`, com prévia de título, canal, duração e capa.
- Download de áudio **M4A/AAC** ou vídeo **MP4/H.264/AAC**, até 1080p.
- Fila persistente com progresso real de bytes, cancelamento e nova tentativa.
- Processamento e validação dos arquivos antes de disponibilizá-los na biblioteca.
- Busca por título, artista e álbum, favoritos e gerenciamento de playlists.
- Player com fila, volume, busca de posição, modo aleatório e repetição.
- Reprodução local de vídeo e restauração pausada da sessão ao reabrir.
- Biblioteca inicialmente vazia, sem músicas ou playlists de demonstração.

A importação de arquivos do computador não faz parte do fluxo atual. Baixe apenas conteúdo que você tem autorização para salvar.

## Como funciona

```mermaid
flowchart LR
  UI[Interface React] --> Rust[Backend Rust / Tauri]
  Rust --> YT[rusty_ytdl]
  YT --> Temp[Download temporário]
  Temp --> FF[FFmpeg + FFprobe]
  FF --> Local[Arquivos locais + SQLite]
  Local --> Player[Player offline]
```

O download acontece no backend Rust usando `rusty_ytdl`. FFmpeg converte os arquivos e FFprobe valida a mídia finalizada. O aplicativo empacotado inclui os dois executáveis e não busca ferramentas no PATH: o usuário final não precisa instalar yt-dlp, Python, Node.js, Deno ou Homebrew.

## Desenvolvimento

### Pré-requisitos

- macOS Apple Silicon para o desktop desta versão.
- Node.js **22.12+** e **pnpm 11.25.0** (versão fixada em `packageManager`).
- Rust estável e Xcode Command Line Tools, conforme os [pré-requisitos do Tauri](https://v2.tauri.app/start/prerequisites/).
- Python 3 para verificar e copiar os binários do build local durante o desenvolvimento.

### Instalação

Use pnpm 11.25.0. Se ainda não estiver disponível, instale essa versão com `npm install --global pnpm@11.25.0` ou pelo seu gerenciador de ferramentas. Evite alternar a instalação do projeto entre npm, Yarn e pnpm.

```sh
git clone https://github.com/pedroaba/ydown.git
cd ydown
cp .env.example .env.local
# Edite LOCAL_MEDIA_BASE_DIR em .env.local para apontar à pasta dos fontes/builds.
pnpm install --frozen-lockfile
pnpm run media:prepare
pnpm run desktop
```

`pnpm run desktop` abre a janela nativa. O primeiro build baixa e compila as dependências Rust. O monorepo usa pnpm Workspaces (`pnpm-workspace.yaml`), com `pnpm-lock.yaml` compartilhado para JavaScript/TypeScript e `Cargo.lock` para Rust. Dependências internas usam `workspace:*`.

Os executáveis de mídia **não são armazenados no histórico Git**. Nesta etapa, o [manifesto](apps/desktop/src-tauri/binaries/manifest.json) usa o modo `local-build`: o script verifica e copia FFmpeg/FFprobe compilados a partir do código oficial. Os caminhos de fontes, scripts e binários no manifesto são relativos ao `baseDir`, obtido pela variável `LOCAL_MEDIA_BASE_DIR`. Não há download pela rede nem fallback para fornecedores externos.

Configure a pasta que contém `ffmpeg/`, `x264/` e `ffmpeg-builds/` em `.env.local` (ignorado pelo Git) ou exporte a variável no terminal. A variável do ambiente tem precedência sobre `.env.local`. Exemplo nesta máquina:

```sh
export LOCAL_MEDIA_BASE_DIR="/Volumes/SSDSamsung/www"
pnpm run media:prepare
```

Em outra máquina, altere somente esse valor. O diretório dos executáveis é resolvido como `$LOCAL_MEDIA_BASE_DIR/ffmpeg-builds/ffmpeg-9.0.2-macos-arm64/install/bin`; não existe caminho absoluto nem fallback de máquina no manifesto.

O SSD é necessário para preparar ou substituir uma cópia ausente/inválida. Quando os executáveis do projeto já correspondem aos hashes fixos, a preparação funciona sem o SSD. `pnpm run desktop` e o comando de bundle fazem essa verificação automaticamente. Para usar outro diretório com os mesmos binários:

```sh
python3 scripts/fetch-media-tools.py --source-dir /caminho/do/build/install/bin
```

O script valida tamanho e SHA-256 dos arquivos de origem antes de substituir qualquer executável. Se a origem estiver ausente ou diferente do manifesto, ele encerra com erro. Os binários copiados são incorporados ao aplicativo; o `.app` pronto não depende do SSD.

### Organização do workspace

`pnpm-workspace.yaml` inclui `apps/*` e `packages/*`. A instalação usa dependências isoladas e um lockfile único. O mobile Expo é mantido no workspace sem mudanças nas telas ou adaptadores. Os hooks `predev` e `prebundle` continuam habilitados para preparar os binários locais antes de iniciar ou empacotar o desktop.

Para adicionar dependências, escolha o pacote que as utiliza:

```sh
pnpm --filter @ydown/desktop add nome-da-dependencia
pnpm --filter @ydown/core add -D nome-da-ferramenta
pnpm add -Dw nome-da-ferramenta-da-raiz
```

Em CI ou numa instalação reproduzível, use `pnpm install --frozen-lockfile`. O script opcional de instalação de `fsevents` é desabilitado explicitamente; os watchers usam as APIs disponíveis do sistema. Não é necessário Turborepo para os comandos e a estrutura atuais.

### Comandos

| Comando                    | Função                                                    |
| -------------------------- | --------------------------------------------------------- |
| `pnpm run desktop`         | Iniciar o aplicativo Tauri em desenvolvimento             |
| `pnpm run desktop:preview` | Servir apenas a interface; download requer a janela Tauri |
| `pnpm run check`           | TypeScript, testes e build da interface                   |
| `pnpm run format:check`    | Conferir formatação                                       |
| `pnpm run desktop:build`   | Gerar os bundles macOS configurados, `.app` e `.dmg`      |
| `pnpm run mobile`          | Iniciar o aplicativo Expo existente                       |

## Gerar o aplicativo macOS

```sh
pnpm run media:prepare
pnpm --filter @ydown/desktop run bundle --bundles app
```

Saída: `apps/desktop/src-tauri/target/release/bundle/macos/LOCAL.app`.

O pacote contém FFmpeg e FFprobe **9.0.2**, para `aarch64-apple-darwin`, compilados localmente do [repositório oficial FFmpeg](https://git.ffmpeg.org/ffmpeg.git), tag `n9.0.2`, com x264 compilado do repositório oficial da VideoLAN. Os fontes, scripts e arquivos de compilação ficam no SSD externo. Os executáveis usam apenas bibliotecas dinâmicas do sistema macOS; a origem, os hashes e a licença GPL v2 ou posterior deste build estão em [binaries/](apps/desktop/src-tauri/binaries/README.md).

O build local cobre o processamento H.264/AAC usado pelo aplicativo. Ele não reproduz todos os codecs externos opcionais do pacote de terceiros anterior. A hospedagem dos executáveis para distribuição pública ficará para uma etapa posterior, com revisão de procedência, integridade e assinatura.

Assinatura e notarização para distribuição pública não estão configuradas. Este repositório publica o código-fonte e os scripts de preparação; não fornece instaladores nem executáveis de terceiros no histórico Git. Antes de distribuir instaladores, revise as licenças dos componentes incluídos. Windows, Linux e Mac Intel exigem binários próprios e configuração de plataforma adicional.

## Uso

1. Abra **Adicionar música** e cole um link HTTPS de vídeo do YouTube.
2. Clique em **Buscar vídeo** e confira a prévia.
3. Escolha **Áudio** ou **Vídeo** e clique em **Baixar do YouTube**.
4. Acompanhe o andamento em **Downloads**.
5. Após finalizar e validar o arquivo, reproduza pela biblioteca. Para vídeos, use **Assistir ao vídeo** no player.

O progresso representa bytes recebidos; processamento e validação aparecem como uma etapa separada. Os jobs são processados um por vez e deduplicados por ID do vídeo e tipo de mídia. Links com parâmetros de playlist são normalizados para o vídeo indicado, sem baixar a playlist inteira.

## Estrutura

```text
apps/
  desktop/              # React, adaptadores e backend Tauri/Rust
  mobile/               # Aplicativo Expo existente
packages/
  core/                 # Entidades e regras de domínio
  contracts/            # Contratos de serviços e aquisição de mídia
  state/                # Estado, casos de uso e persistência por contratos
  hooks/                # Integração React
  design-tokens/        # Tokens visuais
  ui-desktop/           # Componentes DOM/Radix
  ui-mobile/            # Componentes React Native
  utils/                # Utilitários compartilhados
scripts/
  fetch-media-tools.py   # Preparação dos binários de mídia
  tests/                # Testes Python da preparação
  architecture/tests/   # Testes TypeScript das fronteiras entre pacotes

# Os testes de cada pacote ficam em packages/<pacote>/tests/
```

O mobile permanece separado e sem alterações nesta etapa. Seus adaptadores não usam os binários de desktop, e downloads não foram portados para Android/iOS.

## Dados locais

O aplicativo usa o App Data de `com.local.music`. No macOS, a pasta padrão é `~/Library/Application Support/com.local.music/`:

- `library.sqlite3`: documentos de biblioteca/sessão em `app_state` e jobs em `download_jobs`.
- `audio/`: áudio, vídeo e capas finalizados.
- `downloads/`: arquivos temporários de aquisição e processamento.

As referências persistidas são relativas, no formato `local:<id>.<ext>`. O protocolo asset permite acesso somente à pasta de mídia do aplicativo. As capas baixadas são locais; a prévia usa o domínio de imagens do YouTube.

Jobs incompletos são marcados como interrompidos ao reiniciar e podem ser tentados novamente. O player restaura a sessão pausada, sem autoplay. Dados de execução, bancos, backups, mídia baixada, builds e credenciais não pertencem ao repositório e são excluídos pelo `.gitignore`.

## Verificação

```sh
pnpm run check
pnpm run format:check
pnpm run test:media-tools
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --lib
cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml -- --check
```

Há também uma prova de extração e download real, sem adicionar conteúdo à biblioteca:

```sh
cargo run --manifest-path apps/desktop/src-tauri/Cargo.toml \
  --example youtube_probe -- 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
```

`pnpm test` executa as suítes TypeScript e Python. Para testar apenas um módulo:

```sh
pnpm --filter @ydown/core test
pnpm --filter @ydown/state test
pnpm --filter @ydown/utils test
pnpm run test:architecture
pnpm run test:media-tools
```

Os testes de domínio ficam em `packages/core/tests`, os de runtime e persistência em `packages/state/tests`, e os de formatação em `packages/utils/tests`. A verificação do grafo entre pacotes pertence ao módulo de arquitetura em `scripts/architecture/tests`; a preparação Python tem sua própria suíte em `scripts/tests`.

A validação da primeira versão incluiu **19 testes TypeScript**, **três testes Rust**, download real de M4A e MP4 e reprodução do vídeo local pelo aplicativo empacotado. Detalhes e limites estão em [docs/verification.md](docs/verification.md).

## Limitações conhecidas

- O `rusty_ytdl` está fixado na revisão oficial `b1c6eb7c83f0d6189f256ed5df50019a5803c734`. A versão do crates.io não forneceu URLs utilizáveis nos testes; a revisão Git corrigiu esse caso. O pin `idna_adapter=1.2.1` mantém compatibilidade entre as dependências IDNA, Boa e ICU.
- Mudanças do YouTube ou rejeições de rede podem impedir a extração de determinados vídeos. Os erros são mostrados na interface; não há fallback para yt-dlp nem sucesso simulado.
- Live, conteúdo privado ou com restrição de idade e playlists inteiras não são suportados. Não são usados cookies, proxies ou mecanismos para contornar controles de acesso.
- Quotas de disco, retomada de bytes, histórico de reprodução, reordenação manual, mudança de pasta e limpeza geral de arquivos órfãos permanecem pendentes.
- Um encerramento abrupto pode deixar temporários/órfãos e perder aproximadamente os últimos dois segundos de posição do player.
