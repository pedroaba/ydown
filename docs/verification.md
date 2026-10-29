# Validação da v0.1.0

Executada em 29/10/2026 no macOS Apple Silicon.

| Verificação                                             | Resultado                                |
| ------------------------------------------------------- | ---------------------------------------- |
| TypeScript estrito, incluindo desktop, mobile e pacotes | Passou                                   |
| Vitest: 19 testes em dois arquivos                      | Passou                                   |
| Testes Rust: três testes                                | Passou                                   |
| Prettier e formatação Rust                              | Passaram                                 |
| Build Vite e bundle Tauri release `.app`                | Gerados                                  |
| Prévia real pelo `rusty_ytdl`                           | Título, canal, duração e capa retornados |
| Download M4A e MP4 pelo backend Rust                    | Concluídos e adicionados após validação  |
| FFmpeg e FFprobe sem ferramentas no PATH                | Executados com `PATH=/nonexistent`       |
| Binários dentro do bundle                               | SHA-256 conferidos com o manifesto       |
| Reprodução de vídeo local                               | Confirmada no aplicativo nativo          |

## Evidência funcional

A prova isolada com `rusty_ytdl` baixou áudio real. Na janela release, o link público `https://www.youtube.com/watch?v=jNQXAC9IVRw` retornou o título **Me at the zoo**, canal **jawed**, com duração de 19 segundos.

O backend concluiu dois jobs, áudio M4A e vídeo MP4. O job de áudio recebeu 255.427 bytes; o de vídeo, 688.508 bytes. O FFprobe validou duração de 19,005542s nos arquivos finalizados. A reprodução do MP4 usou o protocolo asset local, com controles de vídeo e progresso real. Os arquivos de teste foram retirados da biblioteca após a validação.

FFmpeg e FFprobe 9.0.2 foram conferidos por SHA-256. `otool -L` mostrou apenas dependências Apple/sistema. Com um PATH sem ferramentas, FFmpeg gerou um M4A de 0,25s e FFprobe confirmou codec AAC e duração. Os hashes das cópias no bundle coincidiram com o manifesto do projeto.

A versão publicada 0.7.4 do `rusty_ytdl` retornou URLs vazias no teste. A revisão oficial Git fixa `b1c6eb7c83f0d6189f256ed5df50019a5803c734` forneceu URLs utilizáveis e completou os downloads.

## Cobertura automatizada

Os testes TypeScript cobrem busca, favoritos, playlists, persistência, reversão de falhas, navegação e restauração de fila, concorrência de reprodução, repetição, aleatório, deduplicação e isolamento de progresso. Os testes Rust cobrem normalização de links, rejeição de origens/URLs inválidas e interrupção de trabalho pendente por cancelamento.

## Limites da verificação

Cancelamento de um download longo, recuperação após encerramento abrupto, leitor de tela e todos os formatos/vídeos possíveis não foram exercitados manualmente. Windows, Linux, Mac Intel e o aplicativo mobile nativo não foram executados nesta etapa. O sucesso dos vídeos usados nos testes não garante compatibilidade com todos os vídeos do YouTube.

O mobile foi preservado. A checagem TypeScript compartilhada passou, mas a aquisição por link e os executáveis de desktop não foram portados para Android/iOS. O `.app` local não foi preparado como distribuição assinada/notarizada.

## Preparação por build local — 29/10/2026

O manifesto foi alterado para `schemaVersion: 2`, `mode: local-build`, usando os executáveis compilados do FFmpeg oficial `n9.0.2` no SSD externo. As URLs e hashes de arquivos ZIP do fornecedor anterior foram removidos. Os SHA-256 e tamanhos agora correspondem ao build local com libx264.

O script de preparação valida ambas as origens necessárias antes de substituir arquivos, verifica as cópias temporárias e ajusta a permissão de execução. Quatro testes Python passaram: cópia e reutilização sem SSD, rejeição de origem alterada sem sobrescrever as cópias existentes, falha quando a origem está ausente e uso de outro diretório mantendo os hashes fixos.

A preparação real substituiu os executáveis do projeto; uma segunda execução os reconheceu como válidos. O build desktop executa essa preparação automaticamente via `predev`/`prebundle`. A documentação e os avisos de licença foram ajustados ao build GPL v2 ou posterior. Mobile não foi alterado.

## BaseDir configurável por ambiente — 29/10/2026

O manifesto passou a usar `schemaVersion: 3`, `localBuild.baseDir.env: LOCAL_MEDIA_BASE_DIR` e caminhos relativos. O diretório-base é configurado no ambiente ou em `.env.local` ignorado pelo Git, com precedência para o ambiente. `.env.example` documenta a variável sem fixar a máquina. A preparação continua funcionando sem a variável quando os binários copiados já são válidos.

Oito testes Python cobrem cópia/verificação, integridade, arquivos ausentes, override direto, `.env.local` com caminho entre aspas, precedência do ambiente, erro sem configuração e bloqueio de caminhos fora do baseDir.
