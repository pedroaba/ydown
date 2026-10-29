# Build local de FFmpeg e FFprobe

O manifesto usa `schemaVersion: 3` e `mode: local-build`. Os executáveis são copiados do build feito no SSD externo, sem baixar arquivos da rede e sem usar binários do Homebrew ou de fornecedores de builds.

## Origem

- FFmpeg / FFprobe **9.0.2**, macOS Apple Silicon (`aarch64-apple-darwin`).
- Repositório oficial: `https://git.ffmpeg.org/ffmpeg.git`, tag `n9.0.2`, commit `946fcce07b6dcd0331c8cc609192aeff5e1924f8`.
- x264 oficial: `https://code.videolan.org/videolan/x264.git`, commit `0480cb05fa188d37ae87e8f4fd8f1aea3711f7ee`.
- FFprobe faz parte do mesmo repositório FFmpeg.
- `localBuild.baseDir.env` identifica a variável de ambiente `LOCAL_MEDIA_BASE_DIR`.
- Fontes: `$LOCAL_MEDIA_BASE_DIR/ffmpeg` e `$LOCAL_MEDIA_BASE_DIR/x264`.
- Build e validação: `$LOCAL_MEDIA_BASE_DIR/ffmpeg-builds/`.
- Executáveis: `$LOCAL_MEDIA_BASE_DIR/ffmpeg-builds/ffmpeg-9.0.2-macos-arm64/install/bin/`.

Todos os caminhos do manifesto são relativos ao baseDir, incluindo `sourceDirectory`, `binDirectory`, `buildScript` e `validationScript`. A configuração é específica da máquina, sem alterar o manifesto. Use uma pasta absoluta.

## Preparação

Na raiz do projeto, configure `.env.local` usando `.env.example` como modelo. Esse arquivo é ignorado pelo Git. Exemplo para o SSD desta máquina:

```dotenv
LOCAL_MEDIA_BASE_DIR="/Volumes/SSDSamsung/www"
```

Também é possível exportar a variável no terminal; o ambiente tem precedência sobre `.env.local`. O script só lê a variável indicada, sem executar o conteúdo do arquivo nem expandir comandos shell.

```sh
pnpm run media:prepare
# ou, para usar outro diretório com os mesmos hashes:
python3 scripts/fetch-media-tools.py --source-dir /caminho/do/build/install/bin
```

O script mantém `fetch-media-tools.py` como nome por compatibilidade, mas somente verifica/copia arquivos locais. As duas origens necessárias são verificadas antes de qualquer substituição. Cada cópia é escrita em um temporário, conferida por SHA-256 e movida atomicamente para o destino, com permissão de execução.

Os campos `binarySha256` e `bytes` fixam os artefatos aceitos. O script não recalcula a confiança de um binário diferente nem altera o manifesto automaticamente. Depois de uma recompilação intencional, valide os novos artefatos antes de atualizar os hashes. Hashes detectam diferenças de conteúdo; isoladamente, não comprovam ausência de malware.

`pnpm run desktop` e o bundle executam a preparação automaticamente. Se as cópias locais já forem válidas, o SSD pode estar desconectado. Se faltarem ou estiverem alteradas, o script exige a variável configurada e a origem local válida, encerrando com erro caso não as encontre. `--source-dir` continua disponível para indicar diretamente o diretório dos binários, sem precisar de baseDir. Não há fallback para download.

O Tauri incorpora os executáveis em `Contents/Resources/binaries/macos-arm64/`. O Rust usa caminhos internos do aplicativo; o `.app` pronto não requer SSD, PATH, Python, yt-dlp ou Homebrew. Os executáveis continuam ignorados pelo Git.

## Configuração e licença

x264 e bibliotecas FFmpeg foram ligados estaticamente. A detecção automática de bibliotecas externas foi desabilitada. As dependências dinâmicas foram conferidas: apenas frameworks e bibliotecas do macOS. O deployment target é macOS 12.0, mas o teste de execução foi realizado no Mac atual.

O build inclui libx264, AAC, AudioToolbox, VideoToolbox e os codecs internos do FFmpeg. Não inclui bibliotecas externas como libdav1d/libvpx/libopus; não equivale a todos os recursos do fornecedor anterior.

Com libx264, o build informa **GPL versão 2 ou posterior**. O aviso gerado pelo executável está em `FFMPEG-LICENSE.txt`, e o texto GPL v2 está em `GPL-2.0.txt`. Fontes e licenças completas estão nos repositórios no SSD. Hospedagem para distribuição, assinatura/notarização e atendimento das licenças do pacote distribuído ficam para a etapa de publicação de executáveis.

Mobile e binários para outros sistemas/arquiteturas permanecem fora desta alteração.
