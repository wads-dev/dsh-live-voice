[![npm version](https://img.shields.io/npm/v/dsh-live-voice?logo=npm&label=npm&color=brightgreen)](https://www.npmjs.com/package/dsh-live-voice)
[![Tested DSH](https://img.shields.io/badge/Tested_DSH-v0.2.1--rc.2-5c5cff?logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-rc.2)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

# DSH Live Voice - Você e sua equipe

[English](README.md) | **Português (Brasil)** | [简体中文](README.zh-CN.md)

Esta é a versão em português. O [README em inglês](README.md) é a referência principal do projeto.

**Converse com seu assistente de IA, ouça as respostas e leve o contexto das reuniões para a conversa — sem precisar voltar ao teclado a todo momento.**

O DSH Live Voice é um plugin de voz para o DeepSeek Harness (DSH), com prioridade para processamento local, reconhecimento de fala (STT), síntese de voz (TTS) e transcrição de reuniões em tempo real.

![Conversa no DSH Live Voice com legendas da fala do assistente, controles de reprodução e reconhecimento de voz ativo](https://github.com/user-attachments/assets/6c6f8b2c-a7ff-4478-ad97-882617fff8ea)

_Fale com seu assistente, ouça as respostas e controle a conversa sem voltar ao teclado._

_Feito no Brasil 🇧🇷 e testado diariamente com português brasileiro no macOS._

---

## ⚡ Comece aqui

**Testado com o DeepSeek Harness v0.2.1-rc.2.**

Instale o pacote já compilado do npm no perfil web do DSH (sem precisar compilar o código):

```sh
npx dsh plugin add --profile web dsh-live-voice
```

Na próxima inicialização do DSH, abra **Configurações → Live Voice**.

Interface traduzida: 🇺🇸 inglês · 🇧🇷 português brasileiro · 🇪🇸 espanhol · 🇫🇷 francês · 🇮🇳 hindi · 🇨🇳 chinês. Isso se refere à interface, não aos idiomas de reconhecimento ou síntese de voz.

## O que você pode fazer?

- **Trabalhar por voz:** dite um pedido, discuta código ou documentos e ouça a resposta do assistente sem perder o foco no trabalho.
- **Trazer seu assistente de IA para a reunião:** capture a discussão, revise a transcrição e peça ajuda para comparar propostas ou resumir decisões. Capturar o áudio e compartilhar a voz do assistente exigem configurações separadas; não é uma integração nativa com Meet ou Teams.
- **Manter o controle:** revise antes de enviar, escolha envio manual ou automático e pause, retome ou pare as respostas faladas. Veja os controles de escuta e interrupção no [guia de conversa](docs/CONFIGURATION.md) (em inglês).
- **Escolher como usar a voz:** use mecanismos locais quando houver suporte ou configure um serviço HTTP. Priorizar voz local não significa que o DSH ou seu provedor de IA funcionem totalmente offline.

---

## ✨ Recursos em resumo

- 🎙️ **Ditado por voz:** acrescenta a fala reconhecida ao fim da mensagem, sem substituir suas edições manuais.
- 👐 **Conversa sem teclado:** mantém o diálogo por voz ativo entre sessões de chat.
- ❓ **Perguntas estruturadas por voz:** lê as perguntas do DSH e envia sua resposta falada.
- ⌨️ **Pressione para falar, opcional:** habilite nas configurações, segure `Control` em qualquer lugar da página e solte para colocar a mensagem na fila após o atraso de envio configurado. Desativado por padrão.
- 🎧 **Comportamento adequado à saída de áudio:** escuta controlada ao usar alto-falantes e interrupção com microfone aberto ao usar fones.
- 🗣️ **Comandos falados:** controle envio, silêncio, limpeza e interrupção da leitura com suas frases configuradas.
- ⭐ **Barra de fala dedicada:** acompanhe legendas aproximadas com rolagem e destaque, navegue entre trechos e pause, retome ou pare a leitura. O contador mostra o trecho atual e o total. As legendas mostram o texto enviado à síntese, sem prometer sincronização palavra por palavra.
- 🔊 **Volume da fala:** salve um volume de reprodução de silencioso ao máximo nas configurações de fala para Browser, Say e Qwen, sem alterar o microfone.
- 🧹 **Leitura adaptada ao Markdown:** remove formatação, anuncia links sem ler URLs inteiras, encurta caminhos e referências de linha, lê listas de tarefas e tabelas e substitui blocos longos de código por um aviso traduzido. Preserva avisos personalizados.
- ⚡ **Ritmo ajustável:** envio automático após 600 ms, 800 ms ou 1–6 segundos (4 segundos por padrão); resposta do assistente após 600 ms, 1,5, 2, 3, 4 ou 5 segundos (1,5 segundo por padrão). Reconhecimento e síntese ainda contribuem para a latência.
- 🛠️ **Live Voice Debugger opcional:** instale `dsh-live-voice-debugger` separadamente para inspecionar estado e filas na aba Developer das configurações. O plugin principal funciona sem ele.
- 💻 **Reconhecimento neste navegador:** baixe os modelos multilíngues Whisper Tiny, Base, Small q4 (302 MB), Medium (684 MB) ou Large v3 Turbo (762 MB), sem exigir f16 em Reconhecimento de voz, ou escolha Qwen3-ASR com WebGPU. Os modelos têm controles explícitos de download, cancelamento, progresso e remoção. Whisper também oferece a opção WebAssembly na CPU. Nessas opções o áudio fica no navegador; o download inicial dos modelos exige internet. Veja a [configuração dos modelos](docs/BROWSER-ASR.md) (em inglês).
- 📝 **Contexto da transcrição:** descreva opcionalmente seu vocabulário ou perfil de fala em Reconhecimento de fala → Configurações de conexão para Whisper HTTP e Qwen HTTP. O campo começa vazio; o exemplo em inglês é apenas um placeholder. O suporte depende do servidor, e o contexto não restringe idiomas.
- 🗣️ **Vozes de referência com Chatterbox:** escolha uma gravação autorizada de um serviço MLX local instalado separadamente nas configurações de fala. Reutiliza reprodução, pausa/retomada e saída existentes; a síntese entrega arquivos completos, sem streaming. Veja a [configuração do Chatterbox](docs/CHATTERBOX.md) (em inglês).
- 🏠 **Opções de voz locais:** use mecanismos como Qwen ou Whisper quando houver suporte. Reconhecimento do navegador e serviços HTTP configurados têm seus próprios requisitos de processamento; nem toda configuração mantém o áudio na sua máquina.
- 🌐 **Seu assistente de voz do DSH, até pelo celular:** acesse seu DSH pela rede de casa ou mesmo estando fora de casa e continue falando com ele (STT) e ouvindo as respostas (TTS) pelo navegador do celular. Com os mecanismos executados no host, o processamento de voz fica no computador do DSH, enquanto o celular captura sua fala e reproduz as respostas — sem precisar instalar modelos locais no telefone. _Eu uso Cloudflare Tunnel com autenticação para acessar meu DSH fora de casa._ Use HTTPS e acesso autenticado; a captura do microfone depende do suporte e da permissão do navegador, inclusive na rede de casa.

## 🧑‍💻 Modo reunião — Transcrição de reuniões em tempo real e perguntas à IA

Mantenha uma transcrição editável enquanto a reunião acontece e faça perguntas ao assistente do DSH sobre a discussão, sem precisar recontar tudo depois. Use em revisões de código, discussões de projeto ou na análise conjunta de uma planilha.

### Da conversa à resposta

1. Selecione o reconhecimento **Browser** quando o navegador suportar faixas de áudio compartilhado, ou use **Qwen HTTP** / **Whisper HTTP**. O suporte do Browser é verificado ao iniciar e nunca troca silenciosamente para o microfone; processamento local e pacotes de idioma continuam sujeitos aos requisitos do navegador.
2. Clique no botão **Modo reunião** ao lado do microfone do campo de mensagem, escolha **Compartilhar áudio de uma aba** e habilite o áudio na janela de compartilhamento do navegador. O clique direito abre as mesmas ações; abrir o menu não inicia nada. Ative também seu microfone para incluir suas próprias falas.
3. Revise a transcrição, acrescente uma pergunta e envie o contexto relevante ao DSH. Por exemplo: _“Quais decisões tomamos até agora?”_, _“Ajude a responder este ponto”_ ou _“Compare esta proposta com o código do projeto.”_ A resposta depende da transcrição enviada e do código, planilha ou documentos disponibilizados ao agente.
4. Leia ou ouça a resposta enquanto a reunião continua. Para os outros participantes ouvirem, configure separadamente o aplicativo de reunião para compartilhar o áudio de reprodução do assistente.

### Você controla o que é capturado e enviado

- O áudio compartilhado e o microfone têm controles separados e podem ser desligados independentemente. Comandos de voz e respostas faladas continuam disponíveis.
- Com as duas fontes ativas, mudanças de fonte introduzem `Me:` ou `Them:`; trechos consecutivos seguem na mesma linha; pausas mais longas configuradas iniciam novos parágrafos. Personalize os nomes do microfone e do áudio compartilhado em **Configurações do Live Voice → Conversa → Modo reunião** (padrões: `Me` / `Them`). Os nomes são salvos ao sair do campo; vazio restaura o padrão, com máximo de 80 caracteres em uma linha. As mudanças valem para novos blocos, sem reescrever o texto existente. Essas marcações distinguem **fontes de áudio, não cada participante da reunião**.
- O botão de relógio **Timestamp**, desativado por padrão, pode acrescentar `[YYYY/MM/DD HH:MM:SS]` aos novos blocos de fonte. Usa a hora local do início do trecho, não a conclusão do reconhecimento, e não reescreve texto anterior.
- As barras do microfone e do áudio compartilhado são espelhadas: o ícone inicial alterna **Ouvindo / Ignorando**, com controles independentes de comandos exatos, timestamps e Manual / Fila / Guiar. Ambas têm a mesma contagem regressiva e cancelamento. Ignorar não encerra a captura; pare o compartilhamento em **Modo reunião → Parar compartilhamento de áudio** no campo de mensagem. O atalho existente de áudio compartilhado continua iniciando ou parando a captura diretamente. Comandos habilitados e envio automático seguem os controles de cada fonte; revise os comandos antes de habilitá-los para participantes.

A disponibilidade de áudio depende do navegador, sistema operacional e superfície compartilhada. **Não é uma integração nativa com Google Meet ou Teams.** Capturar a reunião e compartilhar a voz do assistente de volta para a chamada exigem configurações separadas. Use fones para reduzir realimentação de áudio e obtenha o consentimento adequado dos participantes antes de capturar uma reunião. A transcrição e as respostas da IA têm latência de processamento: “tempo real” não significa instantâneo nem precisão garantida.

### Entrada experimental do Attendee local

Clique normalmente ou com o botão direito em **Modo reunião** ao lado do campo de mensagem e escolha **Entrar no Google Meet · experimental**. No menu ficam apenas a URL do Meet e **Conectar** (ou Enter), preparando a recepção e solicitando entrada com nome e chave salvos. Configure nome do bot, origem da API e chave apenas em Configurações, depois escolha **Salvar chave de API** uma vez; salvar nunca inicia recepção nem cria bot. A chave ela é salva no host para a origem exata da API e reutilizada após reabrir ou reiniciar, sem devolver o segredo ao navegador. O campo de senha fica vazio quando configurado; digitar outra chave e escolher Substituir chave de API a substitui, enquanto deixá-lo vazio nunca a apaga. Use Remover explicitamente para apagar a chave salva sem encerrar o controle atual do bot. O armazenamento é um arquivo de texto simples no host com permissão 0600, sem criptografia do sistema, compartilhado pelos navegadores autenticados desse host. Somente a ação explícita URL/Conectar inicia a recepção e cria o bot. **Configurações do Live Voice → Conversa → Modo reunião** contém a configuração da conexão e o **Nome padrão do bot**, inclusive desconectado. O campo de mensagem não tem outro nome por reunião, credenciais ou diálogo de configuração. Os nomes dos participantes ficam visíveis à esquerda das waves de áudio, com o nome completo disponível quando truncado. Veja os participantes e edite apelidos locais à conexão no painel do campo de mensagem; o PCM identificado por participante usa barras separadas e pipelines VAD/STT independentes. Os apelidos valem para novos blocos da transcrição e novos snapshots de metadados de captura, sem reescrever gravações anteriores. Um único **Desconectar** encerra imediatamente a recepção e o controle locais e volta para URL + Conectar, sem confirmação. A saída remota é tentada com prazo curto; se não for confirmada, fica um aviso não bloqueante e você pode conectar novamente. O mesmo botão limpa estados legados descartados/expirados. A ponte de áudio incluída no Compose gerencia WSS e confiança local sem proxy separado no host; WSS direto continua como opção avançada. Exige API Attendee local e STT HTTP ou local no navegador. Não garante vozes sobrepostas isoladas no Meet; streams esparsos são salvos em trechos de captura, não como gravação contínua da reunião. Comece pelo [guia rápido do Google Meet](docs/GOOGLE-MEET.md); veja [configuração, segurança e limites de validação](docs/ATTENDEE.md) para os detalhes técnicos (em inglês).

## Sessões de áudio recuperáveis

Com Qwen ou Whisper, a gravação vem ativada por padrão para guardar áudio comprimido localmente, incluindo silêncio, independentemente da transcrição. Você pode desativá-la em **Reconhecimento de voz → Gravação**. Escolha a quantidade a reter (padrão: uma), qualidade e margens de transcrição. No Attendee, a quantidade significa os N grupos de reunião com atividade de captura mais recente, mantendo todas as capturas de participantes e trechos enquanto o grupo for retido. Gravações ativas, escritas pendentes e estrelas protegem o grupo inteiro, sem ocupar a quantidade comum. Uma pausa silenciosa não encerra a chamada nem reserva uma vaga permanente: uma reunião mais nova pode expirar um grupo antigo silencioso; retomar não recupera o histórico expirado. Gravações legadas de microfone e áudio compartilhado continuam mantendo N capturas por tipo de fonte. A quota ou remoção de armazenamento pelo navegador pode limitar a disponibilidade, inclusive de conteúdo retido ou marcado com estrela. O debugger opcional separa microfone e áudio compartilhado e permite ver pinos, ouvir fala ou silêncio, conferir resultados/erros, nomear sessões marcadas com estrela, inspecionar eventos de reprodução do assistente e captura com seus horários reais, ampliar um recorte da linha do tempo, pesquisar segmentos transcritos, consultar o tamanho dos áudios por sessão e no total em MB, baixar um único segmento de fala/silêncio em WAV, retranscrever falas de sessões encerradas com as configurações atuais do Qwen HTTP ou Whisper HTTP preservando tentativas anteriores (sem alterar o compositor), exportar uma sessão completa ou excluir uma sessão encerrada. Clicar numa faixa da linha do tempo carrega aquele recorte exato de fala/silêncio no player; o zoom continua independente. Novas tentativas HTTP incluem medidas de bytes, amostras, duração do WAV e status da resposta sem outra cópia do áudio; descrevem o corpo preparado para o DSH, não comprovam processamento integral pelo modelo.

É necessário suporte a WebCodecs Opus; a gravação persistente também exige IndexedDB e Web Locks. O salvamento incremental não garante proteção contra queda de energia, limpeza do storage ou perda das últimas amostras ainda não salvas. As gravações pertencem ao perfil do navegador e à origem exata, incluindo a porta. Opus tem perdas; obtenha consentimento antes de gravar outras pessoas. Você pode desativar a gravação nas Configurações; isso não exclui gravações salvas. Browser SpeechRecognition não utiliza este pipeline.

## Servidores HTTP compatíveis

Veja os [contratos HTTP dos mecanismos](docs/HTTP-ENGINES.md) (em inglês) para as rotas e os payloads de envio e resposta esperados pelos adaptadores TTS e STT.

## Documentação

Os guias técnicos abaixo estão em inglês:

- [Configuração e fluxo de conversa](docs/CONFIGURATION.md) — configurações, alto-falantes versus fones, pausas e serviços externos.
- [Escolha de mecanismo de reconhecimento](docs/CHOOSING-AN-ENGINE.md) — comparação entre navegador, Qwen3 ASR e Whisper, requisitos de RAM e compatibilidade.
- [A história do projeto](HISTORY.md) — a motivação humana por trás da coordenação entre escutar e falar.
- [Novidades por versão](CHANGELOG.md) — histórico principal em inglês.

---

## Organização do workspace (contribuidores)

Este monorepo pnpm contém dois plugins instaláveis de forma independente:

- `packages/live-voice`: plugin principal, com código, testes e manifesto próprios.
- `packages/live-voice-debugger`: debugger opcional, com código, testes e manifesto próprios.

Execute `pnpm install --frozen-lockfile`, depois `pnpm build` ou `pnpm test` na raiz. Para compilar apenas um plugin, use `pnpm --filter dsh-live-voice build` ou `pnpm --filter dsh-live-voice-debugger build`. A documentação da raiz cobre ambos. O changelog em inglês da raiz é o histórico principal. Os READMEs dos pacotes apontam para esse histórico. Os diretórios gerados `packages/*/lib/` são ignorados e nunca entram no Git, nem nas releases. Para usar o plugin, instale os pacotes já compilados do npm, não diretamente do Git. Contribuidores precisam compilar antes de vincular um diretório local de pacote ao DSH; veja o [guia de desenvolvimento](DEVELOPMENT.md) (em inglês).

## 🤝 Agradecimentos e comunidade

Escutar e falar devem funcionar juntos. Muito obrigado a [GooDAnDReaDY](https://github.com/GooDAnDReaDY) pelo [dsh-voice](https://github.com/GooDAnDReaDY/dsh-voice) e a [Alan2Z](https://github.com/Alan2Z) pelo [dsh-speak](https://github.com/Alan2Z/dsh-speak), que inspiraram este coordenador unificado. [Leia a história completa](HISTORY.md).

Uso o DSH Live Voice por pelo menos 8 horas todos os dias. Feedback, ideias e contribuições são bem-vindos:

- [Abra uma issue](https://github.com/victorwads/dsh-live-voice/issues)
- [Envie um pull request](https://github.com/victorwads/dsh-live-voice/pulls)

---

real-time meeting transcription, live meeting transcription, AI questions during meetings, meeting assistant, meeting Q&A, shared audio capture, speech-to-text, text-to-speech, local-first voice assistant, DeepSeek Harness plugin.
transcrição de reuniões em tempo real, transcrição ao vivo, perguntas à IA durante reuniões, assistente de reuniões, perguntas e respostas sobre reuniões, captura de áudio compartilhado, reconhecimento de fala, síntese de voz, assistente de voz com prioridade local, plugin para DeepSeek Harness.
实时会议转写、实时语音转文字、会议中向 AI 提问、AI 会议助手、会议问答、共享音频采集、语音识别、语音合成、本地优先语音助手、DeepSeek Harness 插件。

Licença [Apache-2.0](LICENSE)
