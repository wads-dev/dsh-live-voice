import type { LiveVoiceTranslation } from './base.js';

const ptBR: LiveVoiceTranslation = {
  'dsh-live-voice.commons.connection.contactingHost': 'Conectando ao host DSH…',
  'dsh-live-voice.commons.connection.endpoint': 'URL do endpoint',
  'dsh-live-voice.commons.connection.healthEndpoint':
    'URL ou caminho de verificação de integridade',
  'dsh-live-voice.commons.connection.reload': 'Recarregar configurações salvas',
  'dsh-live-voice.commons.connection.test': 'Testar conexão',
  'dsh-live-voice.commons.connection.timeout': 'Tempo limite da requisição (ms)',
  'dsh-live-voice.commons.connection.title': 'Configurações de conexão',
  'dsh-live-voice.commons.connection.unsaved': 'Alterações não salvas',
  'dsh-live-voice.commons.controls.title': 'Controles de voz',
  'dsh-live-voice.commons.conversation.end': 'Encerrar conversa por voz',
  'dsh-live-voice.commons.conversation.idle': 'Conversa inativa',
  'dsh-live-voice.commons.conversation.start': 'Iniciar conversa por voz',
  'dsh-live-voice.commons.delivery.queueBadge': 'FILA',
  'dsh-live-voice.commons.device.numberedLabel': '{device} {number}',
  'dsh-live-voice.commons.dismiss': 'Dispensar',
  'dsh-live-voice.commons.dismissError': 'Dispensar erro de voz',
  'dsh-live-voice.commons.engine.failure': '{engine}: {reason}',
  'dsh-live-voice.commons.input.ignoring': 'ignorando',
  'dsh-live-voice.commons.input.ignoringBadge': 'IGNORANDO',
  'dsh-live-voice.commons.input.listening': 'escutando',
  'dsh-live-voice.commons.input.listeningBadge': 'ESCUTANDO',
  'dsh-live-voice.commons.manual': 'manual',
  'dsh-live-voice.commons.milliseconds': '{milliseconds} ms',
  'dsh-live-voice.commons.off': 'desativado',
  'dsh-live-voice.commons.on': 'ativada',
  'dsh-live-voice.commons.pluginName': 'Voz ao Vivo',
  'dsh-live-voice.commons.queue': 'fila',
  'dsh-live-voice.commons.repository.starLabel': 'Dê uma estrela no GitHub',
  'dsh-live-voice.commons.repository.starLink': 'Dar estrela à DSH Voz ao Vivo no GitHub',
  'dsh-live-voice.commons.second': '1 segundo',
  'dsh-live-voice.commons.seconds': '{seconds} segundos',
  'dsh-live-voice.commons.send': 'ENVIAR',
  'dsh-live-voice.commons.status.ready': 'Voz pronta',
  'dsh-live-voice.commons.systemDefault': 'Padrão do sistema',
  'dsh-live-voice.commons.toggle.offBadge': 'DESATIVADO',
  'dsh-live-voice.commons.unknownLanguage': 'idioma desconhecido',
  'dsh-live-voice.commons.update.busy': 'Pare a captura de voz e a reprodução antes de atualizar.',
  'dsh-live-voice.commons.update.cancel': 'Cancelar',
  'dsh-live-voice.commons.update.confirm':
    'Instalar Voz ao Vivo {version} neste perfil do DSH? O download precisa de rede. Reinicie o DSH depois, se solicitado; nada reinicia automaticamente.',
  'dsh-live-voice.commons.update.current':
    'Esta versão já está instalada. Reinicie o DSH para utilizá-la.',
  'dsh-live-voice.commons.update.delayed':
    'A versão solicitada ainda não está disponível para este perfil. A publicação pode estar em andamento ou aguardando o minimumReleaseAge do pnpm. Aguarde e consulte o gerenciador de plugins do DSH; nenhuma política de segurança foi ignorada.',
  'dsh-live-voice.commons.update.done':
    'Voz ao Vivo {version} instalado. Recarregue a página quando quiser.',
  'dsh-live-voice.commons.update.failed':
    'Falha na atualização. A versão pode ainda não estar no npm. Verifique o gerenciador de plugins do DSH.',
  'dsh-live-voice.commons.update.incompatible':
    'Esta versão é incompatível com o DSH em execução. Consulte o gerenciador de plugins e use versões compatíveis do DSH e do plugin; nenhuma exceção de compatibilidade foi concedida.',
  'dsh-live-voice.commons.update.installing': 'Atualizando…',
  'dsh-live-voice.commons.update.label': 'Atualização disponível',
  'dsh-live-voice.commons.update.link': 'Atualização disponível: {version}. Abrir lançamento',
  'dsh-live-voice.commons.update.local':
    'Esta é uma instalação local, Git ou personalizada. Atualize pelo método de instalação original.',
  'dsh-live-voice.commons.update.now': 'Atualizar agora',
  'dsh-live-voice.commons.update.restart':
    'Voz ao Vivo {version} instalado. Reinicie o DSH quando quiser e depois recarregue esta página.',
  'dsh-live-voice.commons.update.scripts':
    'Scripts de pacotes precisam de aprovação. Revise no gerenciador de plugins do DSH; nenhum script foi aprovado aqui.',
  'dsh-live-voice.commons.update.unavailable':
    'Atualização indisponível neste perfil ou versão do DSH. Use o gerenciador de plugins do DSH.',
  'dsh-live-voice.commons.update.uncertain':
    'O resultado da instalação é desconhecido. Verifique o gerenciador de plugins do DSH antes de tentar novamente.',
  'dsh-live-voice.commons.update.version': 'Atualização disponível: {version}',
  'dsh-live-voice.commons.version.compatibility': 'Compatível com DSH v{version}',
  'dsh-live-voice.commons.version.compatibilityLink':
    'Compatível com DSH v{version}. Abrir lançamento',
  'dsh-live-voice.commons.version.label': 'DSH Voz ao Vivo v{version}',
  'dsh-live-voice.commons.version.link': 'DSH Voz ao Vivo v{version}. Abrir versões',
  'dsh-live-voice.commons.version.title': 'Informações da versão',
  'dsh-live-voice.debugger.applied':
    'O depurador {version} foi instalado e aplicado pelo DSH. Aguardando o registro dos diagnósticos nesta página. Se continuarem indisponíveis, verifique o gerenciador de plugins do DSH; nada é recarregado automaticamente.',
  'dsh-live-voice.debugger.busy':
    'Pare a captura de voz, a transcrição e a reprodução antes de instalar.',
  'dsh-live-voice.debugger.close': 'Fechar',
  'dsh-live-voice.debugger.confirm':
    'Instalar dsh-live-voice-debugger {version} e ativá-lo neste perfil do DSH? O download do registro de pacotes exige acesso à rede. Reinicie o DSH somente se o gerenciador solicitar. Nada reinicia ou recarrega automaticamente. Não altere esta dependência por outro gerenciador ou CLI durante a instalação.',
  'dsh-live-voice.debugger.description':
    'Os diagnósticos e o gerenciamento de sessões gravadas exigem o plugin opcional dsh-live-voice-debugger. Ele permite inspecionar o estado e as filas, navegar pelas gravações, ouvir o áudio, revisar transcrições e erros, exportar sessões e excluir gravações finalizadas. O Voz ao Vivo e a gravação funcionam sem ele.',
  'dsh-live-voice.debugger.failed':
    'A instalação falhou ou foi cancelada. Verifique o gerenciador de plugins do DSH antes de continuar; não haverá nova tentativa por aqui.',
  'dsh-live-voice.debugger.installNow': 'Instalar agora',
  'dsh-live-voice.debugger.installed':
    'O depurador já está instalado, mas não está disponível nesta página. Verifique a ativação e os erros de carregamento no gerenciador de plugins do DSH. Reinicie o DSH somente se solicitado; este diálogo não o reinstalará.',
  'dsh-live-voice.debugger.installing': 'Verificando ou instalando o depurador…',
  'dsh-live-voice.debugger.label': 'Diagnósticos',
  'dsh-live-voice.debugger.local':
    'Já existe uma dependência local, Git ou personalizada do depurador. Gerencie-a pelo método original de instalação; ela não será substituída aqui.',
  'dsh-live-voice.debugger.ready':
    'Os diagnósticos estão prontos. Feche este diálogo e clique em Diagnósticos para abrir o depurador.',
  'dsh-live-voice.debugger.restart':
    'O depurador {version} foi instalado. O gerenciador do DSH exige uma reinicialização. Reinicie o DSH quando estiver pronto e recarregue esta página. Nada reinicia automaticamente.',
  'dsh-live-voice.debugger.scripts':
    'Os scripts do pacote precisam de aprovação. Revise-os no gerenciador de plugins do DSH; nenhum script foi aprovado e não haverá nova tentativa de instalação aqui.',
  'dsh-live-voice.debugger.title': 'Diagnósticos e sessões gravadas',
  'dsh-live-voice.debugger.unavailable':
    'A instalação não está disponível para este perfil ou versão do DSH. Use o gerenciador de plugins do DSH.',
  'dsh-live-voice.debugger.uncertain':
    'O resultado da instalação é desconhecido. Verifique o gerenciador de plugins do DSH antes de continuar; não haverá nova tentativa por aqui.',
  'dsh-live-voice.meeting.actions': 'Ações da reunião',
  'dsh-live-voice.meeting.attendee.admissionUnknown': 'A admissão na reunião não está confirmada.',
  'dsh-live-voice.meeting.attendee.advanced': 'Conexão avançada',
  'dsh-live-voice.meeting.attendee.aliasHelp':
    'Os apelidos valem somente nesta conexão e nos próximos textos transcritos. Não alteram os nomes na reunião.',
  'dsh-live-voice.meeting.attendee.apiKey': "Chave de API",
  'dsh-live-voice.meeting.attendee.apiUrl': 'URL da API Attendee local',
  'dsh-live-voice.meeting.attendee.automaticReceiver': 'Receptor detectado pelo DSH',
  'dsh-live-voice.meeting.attendee.botId': 'ID do bot (opcional; vincula o primeiro bot)',
  'dsh-live-voice.meeting.attendee.botName': 'Nome do bot na reunião',
  'dsh-live-voice.meeting.attendee.configureConnection': 'Configurar conexão do Attendee',
  'dsh-live-voice.meeting.attendee.confirmRelease': 'Descartar controle sem sair',
  'dsh-live-voice.meeting.attendee.connected': 'Conectado ao Attendee',
  'dsh-live-voice.meeting.attendee.connecting': 'Abrindo receptor…',
  'dsh-live-voice.meeting.attendee.connection': 'Configurações de conexão',
  'dsh-live-voice.meeting.attendee.controlExpired':
    'O controle do bot expirou. Ele pode continuar na reunião; verifique no Attendee.',
  'dsh-live-voice.meeting.attendee.controlReleased':
    'Controle descartado, sem solicitar saída. Confira o bot no Attendee.',
  'dsh-live-voice.meeting.attendee.controlUnavailable':
    'Controle do bot indisponível. O estado da reunião é desconhecido; verifique no Attendee.',
  'dsh-live-voice.meeting.attendee.controlUnknown':
    'Estado do bot desconhecido. Verifique no Attendee antes de criar outro bot.',
  'dsh-live-voice.meeting.attendee.copy': 'Copiar',
  'dsh-live-voice.meeting.attendee.credentialCancel': "Cancelar",
  'dsh-live-voice.meeting.attendee.credentialChecking': "Verificando chave de API salva",
  'dsh-live-voice.meeting.attendee.credentialHelp': "Conectar salva a chave digitada para esta origem da API e a reutiliza depois. O host a armazena em texto simples num arquivo 0600, sem criptografia do sistema. Ela é compartilhada pelos navegadores autenticados deste host e nunca retorna ao navegador. Removê-la não encerra o controle atual do bot.",
  'dsh-live-voice.meeting.attendee.credentialInvalid': "O armazenamento de chaves é inválido. Repare ou remova o arquivo de credenciais do host antes de tentar novamente.",
  'dsh-live-voice.meeting.attendee.credentialMissing': "Nenhuma chave de API está configurada para esta origem. Digite-a uma vez e conecte.",
  'dsh-live-voice.meeting.attendee.credentialNotSaved': "Chave de API não configurada neste host",
  'dsh-live-voice.meeting.attendee.credentialRemove': "Remover chave de API salva",
  'dsh-live-voice.meeting.attendee.credentialRemoveConfirm': "Remover chave salva",
  'dsh-live-voice.meeting.attendee.credentialRemoveWarning': "Remover a chave salva desta origem? A recepção e o controle do bot atuais mantêm a credencial em uso; isso não solicita saída.",
  'dsh-live-voice.meeting.attendee.credentialSaved': "Chave de API configurada neste host",
  'dsh-live-voice.meeting.attendee.credentialUnavailable': "O armazenamento de chaves está indisponível. Verifique as permissões do host e tente novamente.",
  'dsh-live-voice.meeting.attendee.currentBot': 'Último bot conhecido',
  'dsh-live-voice.meeting.attendee.defaultBotName': 'Nome padrão do bot',
  'dsh-live-voice.meeting.attendee.departureRequested':
    'Saída solicitada; a remoção da reunião não está confirmada.',
  'dsh-live-voice.meeting.attendee.failed':
    'Receptor interrompido. Verifique TLS, credenciais, participantes, limites e motor de reconhecimento antes de reconectar.',
  'dsh-live-voice.meeting.attendee.help':
    'Conecte ao Attendee local, cole o link da reunião, escolha o nome do bot e solicite a entrada. Os participantes aparecem aqui com barras de áudio independentes. Exige STT HTTP ou local no navegador, não reconhecimento nativo. A chave não é salva. A gravação segue suas configurações.',
  'dsh-live-voice.meeting.attendee.ingressUrl': 'URL WSS confiável do receptor',
  'dsh-live-voice.meeting.attendee.invalidMeeting': 'Informe um link válido do Google Meet.',
  'dsh-live-voice.meeting.attendee.join': 'Entrar na reunião',
  'dsh-live-voice.meeting.attendee.joinFailed':
    'O resultado da entrada pode ser desconhecido. Confira no Attendee antes de reconectar ou criar outro bot.',
  'dsh-live-voice.meeting.attendee.joinHelp':
    'Cria um bot com o nome escolhido e o destino de áudio. O organizador pode precisar admitir o bot. Desconectar o DSH não retira o bot: use Sair da reunião.',
  'dsh-live-voice.meeting.attendee.joining': 'Solicitando entrada…',
  'dsh-live-voice.meeting.attendee.leave': 'Sair da reunião',
  'dsh-live-voice.meeting.attendee.leaveFailed':
    'Não foi possível confirmar a solicitação de saída. O bot pode permanecer; tente Sair da reunião novamente ou confira no Attendee.',
  'dsh-live-voice.meeting.attendee.leaving': 'Solicitando saída…',
  'dsh-live-voice.meeting.attendee.meetingUrl': 'Link do Google Meet',
  'dsh-live-voice.meeting.attendee.noParticipants': 'Aguardando identificação dos participantes',
  'dsh-live-voice.meeting.attendee.participant': 'Participante {number}',
  'dsh-live-voice.meeting.attendee.participants': 'Participantes da reunião',
  'dsh-live-voice.meeting.attendee.receiverInactive': 'Receptor de áudio desconectado',
  'dsh-live-voice.meeting.attendee.receiverUrl': 'URL do receptor (secreta)',
  'dsh-live-voice.meeting.attendee.recognitionRequired':
    'Escolha Whisper HTTP, Qwen HTTP ou um modelo STT local no navegador nas Configurações antes de conectar.',
  'dsh-live-voice.meeting.attendee.relayUnavailable':
    'A ponte de áudio do Compose está indisponível. Suba o Attendee com o complemento de áudio DSH e conecte novamente.',
  'dsh-live-voice.meeting.attendee.releaseControl': 'Descartar controle do bot…',
  'dsh-live-voice.meeting.attendee.releaseWarning':
    'Descartar o controle não retira o bot da reunião. Você perderá a ação Sair por aqui. Continue somente após conferir no Attendee.',
  'dsh-live-voice.meeting.attendee.settingsHelp':
    "Configure aqui a origem local da API. Digite a chave do projeto uma vez e conecte; as próximas conexões reutilizam a chave salva no host para essa origem. Use o campo de mensagem para entrar na reunião.",
  'dsh-live-voice.meeting.attendee.start': 'Conectar ao Attendee',
  'dsh-live-voice.meeting.attendee.stop': 'Desconectar do Attendee',
  'dsh-live-voice.meeting.attendee.title': 'Áudio por participante (Attendee · experimental)',
  'dsh-live-voice.meeting.attendee.tlsNeeded':
    'O DSH ainda não tem receptor WSS confiável. Configure HTTPS ou um proxy WSS confiável na conexão avançada antes de entrar.',
  'dsh-live-voice.meeting.attendee.waiting':
    'Receptor aberto; configure um novo bot com a URL abaixo.',
  'dsh-live-voice.meeting.browserLocalUnavailable':
    'O reconhecimento local do navegador está indisponível para este idioma. Instale o pacote de idioma ou desative explicitamente o processamento somente local nas Configurações para permitir o serviço do navegador.',
  'dsh-live-voice.meeting.browserSharedUnsupported':
    'Este navegador não pode reconhecer áudio compartilhado com segurança. Escolha Qwen ou Whisper HTTP para áudio compartilhado.',
  'dsh-live-voice.meeting.failed': 'Falha no reconhecimento.',
  'dsh-live-voice.meeting.help':
    'Fontes independentes; as transcrições ficam no composer até você enviá-las manualmente.',
  'dsh-live-voice.meeting.inactive': 'Inativo',
  'dsh-live-voice.meeting.joinMeet': 'Entrar no Google Meet · experimental',
  'dsh-live-voice.meeting.listening': 'Ouvindo',
  'dsh-live-voice.meeting.microphone': 'Microfone',
  'dsh-live-voice.meeting.noAudio':
    'Nenhum áudio foi compartilhado. Ative o áudio na janela de compartilhamento.',
  'dsh-live-voice.meeting.processing': 'Transcrevendo…',
  'dsh-live-voice.meeting.shareTab': 'Compartilhar áudio de uma aba',
  'dsh-live-voice.meeting.shared': 'Áudio compartilhado',
  'dsh-live-voice.meeting.start': 'Iniciar fonte',
  'dsh-live-voice.meeting.startShared': 'Iniciar compartilhamento de áudio',
  'dsh-live-voice.meeting.starting': 'Iniciando…',
  'dsh-live-voice.meeting.stop': 'Parar fonte',
  'dsh-live-voice.meeting.stopShared': 'Parar compartilhamento de áudio',
  'dsh-live-voice.meeting.timestamps': 'Horário das transcrições',
  'dsh-live-voice.meeting.timestampsBadge': 'Timestamp',
  'dsh-live-voice.meeting.title': 'Modo reunião',
  'dsh-live-voice.meeting.unavailable': 'Reconhecimento indisponível.',
  'dsh-live-voice.recognition.autoSend.countdownHelp':
    'A contagem regressiva inicia após a frase final reconhecida. Nova fala ou edições cancelam o envio.',
  'dsh-live-voice.recognition.browser.autoInstallPack':
    'Instalar automaticamente este pacote de idioma do navegador quando necessário',
  'dsh-live-voice.recognition.browser.help':
    'Usa a API SpeechRecognition do navegador. Esta é a opção padrão.',
  'dsh-live-voice.recognition.browser.label': 'SpeechRecognition do navegador · Opção padrão',
  'dsh-live-voice.recognition.browser.localProcessing':
    'Processar reconhecimento localmente neste dispositivo',
  'dsh-live-voice.recognition.browser.microphoneHelp':
    'O SpeechRecognition do navegador pode usar o microfone padrão do sistema ou do navegador em vez desta seleção.',
  'dsh-live-voice.recognition.browser.remoteServiceWarning':
    'O reconhecimento pelo serviço do navegador está ativado. O navegador pode enviar o áudio do microfone para o serviço remoto.',
  'dsh-live-voice.recognition.commands.addPhrase': 'Adicionar frase…',
  'dsh-live-voice.recognition.commands.clear': 'Limpar editor de mensagens',
  'dsh-live-voice.recognition.commands.enabled': 'Ativar comandos de voz exatos',
  'dsh-live-voice.recognition.commands.end': 'Encerrar conversa',
  'dsh-live-voice.recognition.commands.mute': 'Silenciar entrada do editor de mensagens',
  'dsh-live-voice.recognition.commands.queue': 'Adicionar à fila',
  'dsh-live-voice.recognition.commands.removePhrase': 'Remover frase',
  'dsh-live-voice.recognition.commands.resume': 'Retomar entrada do editor de mensagens',
  'dsh-live-voice.recognition.commands.send': 'Enviar ao agente em execução',
  'dsh-live-voice.recognition.commands.stopSpeech': 'Parar fala do assistente',
  'dsh-live-voice.recognition.commands.title': 'Comandos de voz',
  'dsh-live-voice.recognition.context.hint':
    'Contexto e vocabulário opcionais enviados como prompt ao serviço HTTP de voz selecionado, junto com cada trecho de áudio. Salvo ao sair do campo. O suporte depende do servidor; não restringe idiomas nem garante que instruções sejam seguidas. Deixe vazio para não enviar contexto.',
  'dsh-live-voice.recognition.context.label': 'Contexto da transcrição',
  'dsh-live-voice.recognition.context.placeholder':
    'Native Brazilian Portuguese speaker who frequently uses technical terms in English.',
  'dsh-live-voice.recognition.dictation.cancel': 'Cancelar ditado',
  'dsh-live-voice.recognition.engine.label': 'Mecanismo de reconhecimento',
  'dsh-live-voice.recognition.headphoneMode.help':
    'O microfone fica aberto durante a reprodução. Fala reconhecida sem eco pode pausar após o atraso configurado; a reprodução retoma quando microfone e áudio compartilhado da reunião ficam em silêncio por esse intervalo. Pausa manual exige Retomar.',
  'dsh-live-voice.recognition.headphoneMode.label': 'Fones de ouvido — microfone aberto',
  'dsh-live-voice.recognition.holdToTalk.enabled': 'Segure para falar',
  'dsh-live-voice.recognition.holdToTalk.help':
    'Com o editor aberto, segure o atalho configurado em qualquer lugar da página para capturar a fala. Solte para concluir as transcrições pendentes, aguardar o atraso configurado, enfileirar a mensagem e encerrar a captura. Pressione Escape enquanto segura para cancelar.',
  'dsh-live-voice.recognition.language.automatic': 'Automático — detectar idioma',
  'dsh-live-voice.recognition.language.label': 'Idioma de reconhecimento',
  'dsh-live-voice.recognition.language.options.chinese': 'Chinês (mandarim)',
  'dsh-live-voice.recognition.language.options.french': 'Francês',
  'dsh-live-voice.recognition.language.options.spanish': 'Espanhol',
  'dsh-live-voice.recognition.local.cancel': 'Cancelar',
  'dsh-live-voice.recognition.local.confirm': 'Confirmar',
  'dsh-live-voice.recognition.local.confirmDownload':
    'Baixar {model}? Aproximadamente {size} serão armazenados neste navegador.',
  'dsh-live-voice.recognition.local.confirmRemove':
    'Remover {model} deste navegador? As gravações serão preservadas.',
  'dsh-live-voice.recognition.local.confirmTitle':
    'Confirmar alteração no armazenamento de modelos',
  'dsh-live-voice.recognition.local.device': 'Ambiente de execução',
  'dsh-live-voice.recognition.local.deviceHelp':
    'WebGPU exige um adaptador de GPU funcional. O Whisper oferece uma opção explícita de CPU com WebAssembly, mais lenta; o Qwen exige WebGPU. Não há troca automática de ambiente de execução nem alternativa automática por HTTP.',
  'dsh-live-voice.recognition.local.download': 'Baixar modelo',
  'dsh-live-voice.recognition.local.error.cancelled':
    'Operação cancelada. Baixe ou carregue o modelo quando quiser continuar.',
  'dsh-live-voice.recognition.local.error.download_failed':
    'Não foi possível baixar o modelo. Verifique sua conexão com o Hugging Face e tente novamente.',
  'dsh-live-voice.recognition.local.error.f16_unavailable':
    'Este modelo exige WebGPU com suporte a shader-f16. Escolha outro modelo Whisper ou um navegador/dispositivo compatível.',
  'dsh-live-voice.recognition.local.error.failed':
    'A operação do modelo falhou. Verifique o armazenamento do navegador e carregue o modelo novamente.',
  'dsh-live-voice.recognition.local.error.gpu_unavailable':
    'WebGPU indisponível. Use um navegador com adaptador de GPU funcional ou selecione explicitamente o Whisper com CPU WebAssembly.',
  'dsh-live-voice.recognition.local.error.inference_failed':
    'A transcrição falhou. Carregue o modelo novamente e tente com um trecho de áudio mais curto.',
  'dsh-live-voice.recognition.local.error.invalid_audio':
    'Não é possível transcrever este áudio. Grave um novo trecho e tente novamente.',
  'dsh-live-voice.recognition.local.error.invalid_model':
    'Este modelo não é compatível. Selecione um modelo da lista.',
  'dsh-live-voice.recognition.local.error.model_busy':
    'O modelo está ocupado. Aguarde a operação atual terminar e tente novamente.',
  'dsh-live-voice.recognition.local.error.model_missing':
    'Arquivos do modelo estão ausentes ou foram removidos do cache. Baixe o modelo novamente.',
  'dsh-live-voice.recognition.local.error.runtime_outdated':
    'O navegador carregou um runtime de voz mais antigo que estas configurações. Recarregue esta página para carregar o worker atualizado. Se persistir, recarregue o backend atualizado do Voz ao Vivo no DSH; não é necessário baixar o modelo novamente.',
  'dsh-live-voice.recognition.local.error.runtime_unavailable':
    'O ambiente de execução do modelo está indisponível. Atualize a página, verifique a compatibilidade do navegador e carregue o modelo novamente.',
  'dsh-live-voice.recognition.local.error.storage_full':
    'O armazenamento do navegador está cheio. Libere espaço ou remova modelos sem uso e tente novamente.',
  'dsh-live-voice.recognition.local.error.storage_unavailable':
    'O armazenamento do navegador está indisponível. Permita o armazenamento do site em um perfil normal do navegador e tente novamente.',
  'dsh-live-voice.recognition.local.help': 'Sobre os modelos do navegador',
  'dsh-live-voice.recognition.local.load': 'Carregar modelo',
  'dsh-live-voice.recognition.local.model': 'Modelo',
  'dsh-live-voice.recognition.local.modelCard': 'Detalhes do modelo',
  'dsh-live-voice.recognition.local.phase.absent':
    'Baixe seu primeiro modelo para começar a transcrição local.',
  'dsh-live-voice.recognition.local.phase.checking': 'Verificando arquivos do modelo…',
  'dsh-live-voice.recognition.local.phase.downloaded':
    'Modelo baixado. Carregue-o para começar a transcrever.',
  'dsh-live-voice.recognition.local.phase.downloading': 'Baixando modelo…',
  'dsh-live-voice.recognition.local.phase.error':
    'O modelo precisa de atenção. Siga as orientações do erro e tente novamente.',
  'dsh-live-voice.recognition.local.phase.loading': 'Carregando modelo…',
  'dsh-live-voice.recognition.local.phase.ready': 'Modelo pronto para transcrição local.',
  'dsh-live-voice.recognition.local.privacy':
    'Os downloads de modelos se conectam ao Hugging Face. A fala é processada neste navegador, sem envio a um serviço de transcrição HTTP. O aplicativo ainda exige o DSH.',
  'dsh-live-voice.recognition.local.progress': 'Progresso do download do modelo',
  'dsh-live-voice.recognition.local.qwenLabel': 'Qwen · Navegador',
  'dsh-live-voice.recognition.local.recommended': 'recomendado',
  'dsh-live-voice.recognition.local.reload': 'Carregar novamente',
  'dsh-live-voice.recognition.local.remove': 'Remover modelo',
  'dsh-live-voice.recognition.local.space': 'Armazenamento disponível no navegador: {size}',
  'dsh-live-voice.recognition.local.storageHelp':
    'Os modelos são armazenados neste perfil do navegador; os caches podem ser removidos. As estimativas de disco não incluem os arquivos do ambiente de execução nem o uso adicional de GPU/RAM. Remover afeta os arquivos do modelo, não as sessões gravadas.',
  'dsh-live-voice.recognition.local.title': 'Modelos do navegador',
  'dsh-live-voice.recognition.local.whisperLabel': 'Whisper · Navegador (recomendado)',
  'dsh-live-voice.recognition.manualSend.help':
    'O texto reconhecido permanece no editor até que você use o botão normal de envio do DSH.',
  'dsh-live-voice.recognition.maxUtterance.help':
    'Se a fala nunca pausar, inicia um novo trecho de transcrição após esta duração. Padrão: 60 segundos.',
  'dsh-live-voice.recognition.maxUtterance.label': 'Fala contínua máxima (segundos)',
  'dsh-live-voice.recognition.microphone.checking': 'Verificando disponibilidade do microfone',
  'dsh-live-voice.recognition.microphone.device': 'Dispositivo de entrada',
  'dsh-live-voice.recognition.microphone.failure': 'Microfone: {reason}',
  'dsh-live-voice.recognition.microphone.ignore': 'Ignorar entrada do editor de mensagens',
  'dsh-live-voice.recognition.microphone.inputStatus':
    'Entrada de áudio: {state}. Ignorar descarta o ditado, não a captura: a interrupção por fala continua ativa; comandos configurados funcionam quando habilitados. Encerre a captura pelo botão da fonte no campo de mensagem.',
  'dsh-live-voice.recognition.microphone.label': 'Microfone',
  'dsh-live-voice.recognition.microphone.permissionHelp':
    'A permissão do microfone será solicitada apenas quando você iniciar a ditado ou uma conversa por voz.',
  'dsh-live-voice.recognition.microphone.resume': 'Retomar escuta',
  'dsh-live-voice.recognition.microphone.starting': 'Iniciando microfone',
  'dsh-live-voice.recognition.microphone.takeControl': 'Assumir microfone',
  'dsh-live-voice.recognition.minimumWords.enabled': 'Ignorar trechos curtos de transcrição final',
  'dsh-live-voice.recognition.minimumWords.help':
    'Trechos finais com menos palavras são ignorados antes de chegarem ao editor ou ao envio automático.',
  'dsh-live-voice.recognition.minimumWords.label': 'Mínimo de palavras por trecho final',
  'dsh-live-voice.recognition.mode.label': 'Modo de escuta',
  'dsh-live-voice.recognition.planned.parakeet': 'NVIDIA Parakeet — Em breve',
  'dsh-live-voice.recognition.planned.sherpa': 'sherpa-onnx Streaming — Em breve',
  'dsh-live-voice.recognition.planned.vote': 'Em breve — vote nas issues do repositório',
  'dsh-live-voice.recognition.planned.voxtral': 'Voxtral Realtime — Em breve',
  'dsh-live-voice.recognition.planned.webGpu': 'Inferência WebGPU no navegador — Em breve',
  'dsh-live-voice.recognition.presets.custom.description':
    'Escolha pausas independentes para trechos e parágrafos.',
  'dsh-live-voice.recognition.presets.custom.label': 'Personalizada',
  'dsh-live-voice.recognition.presets.long.description':
    'Aguarda durante pausas de pensamento mais longas.',
  'dsh-live-voice.recognition.presets.long.label': 'Longa',
  'dsh-live-voice.recognition.presets.natural.description': 'Permite pausas normais entre frases.',
  'dsh-live-voice.recognition.presets.natural.label': 'Natural',
  'dsh-live-voice.recognition.presets.short.description':
    'Transcreve rapidamente após uma pausa curta.',
  'dsh-live-voice.recognition.presets.short.label': 'Curta',
  'dsh-live-voice.recognition.providerSettings.help':
    'As configurações do provedor mudam com o mecanismo de reconhecimento selecionado.',
  'dsh-live-voice.recognition.qwen.captureHelp':
    'O áudio é segmentado em trechos completos de fala em WAV e enviado pelo DSH autenticado para o modelo Qwen3 ASR local do host.',
  'dsh-live-voice.recognition.qwen.connectionSuccess':
    'Conexão bem-sucedida. O Qwen ASR e TTS estão carregados. Edições não salvas não foram aplicadas.',
  'dsh-live-voice.recognition.qwen.endpointHelp':
    'API HTTP na URL configurada do host DSH (padrão: http://127.0.0.1:8080/inference). O áudio usa a rota de transcrição autenticada do host DSH.',
  'dsh-live-voice.recognition.qwen.hostHelp':
    'Configurações de todo o host para o servidor Qwen3 ASR + TTS. Insira qualquer URL base HTTP ou HTTPS acessível a partir do host DSH. O navegador acessa através de rotas autenticadas do DSH.',
  'dsh-live-voice.recognition.qwen.label': 'Qwen3 ASR · API HTTP',
  'dsh-live-voice.recognition.silenceDetection.chunkPause':
    'Antes de transcrever: {milliseconds} ms',
  'dsh-live-voice.recognition.silenceDetection.customHelp':
    'Insira um número inteiro de 100 a 10.000 ms. Salvo ao sair do campo. Pausas curtas podem dividir a fala; o reconhecimento acrescenta sua própria latência.',
  'dsh-live-voice.recognition.silenceDetection.customLabel': 'Pausa do trecho (milissegundos)',
  'dsh-live-voice.recognition.silenceDetection.customParagraphHelp':
    'Silêncio antes de um novo parágrafo no texto ditado (100–30.000 ms, números inteiros). Salvo ao sair do campo; independente da pausa do trecho e do envio da mensagem.',
  'dsh-live-voice.recognition.silenceDetection.customParagraphLabel':
    'Pausa de parágrafo (milissegundos)',
  'dsh-live-voice.recognition.silenceDetection.detector.energy': 'Energia do áudio',
  'dsh-live-voice.recognition.silenceDetection.detector.label': 'Detector de voz',
  'dsh-live-voice.recognition.silenceDetection.detector.silero': 'Silero — experimental (padrão)',
  'dsh-live-voice.recognition.silenceDetection.duration':
    'Antes de transcrever: {milliseconds} ms · Novo parágrafo: {paragraphMilliseconds} ms',
  'dsh-live-voice.recognition.silenceDetection.help':
    'Controla a duração mínima da pausa antes de enviar a fala capturada para reconhecimento.',
  'dsh-live-voice.recognition.silenceDetection.label': 'Detecção de silêncio e parágrafos',
  'dsh-live-voice.recognition.silenceDetection.minimumSpeech.help':
    'Fala mínima detectada antes de aceitar um intervalo (50–2.000 ms). Sons mais curtos são ignorados.',
  'dsh-live-voice.recognition.silenceDetection.minimumSpeech.label': 'Fala mínima (milissegundos)',
  'dsh-live-voice.recognition.silenceDetection.paragraphPause': 'Novo parágrafo: {milliseconds} ms',
  'dsh-live-voice.recognition.silenceDetection.pauseLabel': 'Pausas de trecho e parágrafo',
  'dsh-live-voice.recognition.silenceDetection.threshold.help':
    'Limiar de atividade de voz (0,05–0,95). Valores menores detectam falas mais baixas, mas podem aceitar mais ruído.',
  'dsh-live-voice.recognition.silenceDetection.threshold.label': 'Limiar de atividade de voz',
  'dsh-live-voice.recognition.silenceDetection.title':
    'Configurações de detecção de silêncio e parágrafos',
  'dsh-live-voice.recognition.silero.error.failed':
    'A detecção de voz Silero falhou. Selecione Energia do áudio nas configurações ou tente iniciar a captura novamente.',
  'dsh-live-voice.recognition.silero.error.overloaded':
    'A detecção de voz Silero está sobrecarregada. Reinicie a captura ou selecione Energia do áudio nas configurações.',
  'dsh-live-voice.recognition.silero.error.unavailable':
    'A detecção de voz Silero está indisponível. Selecione Energia do áudio nas configurações ou tente iniciar a captura novamente.',
  'dsh-live-voice.recognition.speakerMode.help':
    'A reprodução libera o microfone para reduzir o retorno dos alto-falantes. Assumir microfone interrompe manualmente; participantes reconhecidos sem eco no áudio compartilhado podem pausar a reprodução, que retoma após silêncio estável.',
  'dsh-live-voice.recognition.speakerMode.label': 'Alto-falantes — escuta controlada',
  'dsh-live-voice.recognition.status.answer': 'Reconhecendo resposta',
  'dsh-live-voice.recognition.status.awaitingAnswer': 'Ouvindo sua resposta',
  'dsh-live-voice.recognition.status.listening': 'Ouvindo',
  'dsh-live-voice.recognition.status.listeningProcessing': 'Ouvindo e transcrevendo',
  'dsh-live-voice.recognition.status.processing': 'Transcrevendo',
  'dsh-live-voice.recognition.status.unavailable': 'Reconhecimento de voz indisponível',
  'dsh-live-voice.recognition.status.waiting': 'Aguardando',
  'dsh-live-voice.recognition.status.waitingCommand': 'Esperando comando',
  'dsh-live-voice.recognition.voiceCommands.help':
    'Separe as frases por vírgulas. A correspondência ignora maiúsculas, acentos, pontuação e espaços extras. Todo o trecho final deve coincidir.',
  'dsh-live-voice.recognition.whisper.captureHelp':
    'O áudio é segmentado em trechos completos de fala em WAV, enviado através do DSH autenticado e processado pelo whisper.cpp HTTP em loopback.',
  'dsh-live-voice.recognition.whisper.connectionSuccess':
    'Conexão bem-sucedida. O endpoint de verificação respondeu; a transcrição não foi testada. Edições não salvas não foram aplicadas.',
  'dsh-live-voice.recognition.whisper.endpointHelp':
    'API HTTP na URL base configurada (padrão: http://127.0.0.1:8080/). Compatível com POST /v1/audio/transcriptions.',
  'dsh-live-voice.recognition.whisper.healthFailed':
    'Falha na verificação de integridade do Whisper.',
  'dsh-live-voice.recognition.whisper.label': 'Whisper · API HTTP',
  'dsh-live-voice.recognition.whisper.requestFailed':
    'Falha na requisição de configurações do Whisper.',
  'dsh-live-voice.recognition.whisper.restartRequired':
    'As rotas de configuração do Whisper não estão carregadas. É necessário reiniciar o servidor DSH normalmente para carregar rotas atualizadas do plugin; atualizar apenas esta página não é suficiente.',
  'dsh-live-voice.recognition.whisper.save': 'Salvar configurações do Whisper',
  'dsh-live-voice.recognition.whisper.saved':
    'Salvo no host DSH. Requisições ativas de transcrição do host foram canceladas.',
  'dsh-live-voice.recognition.whisper.signInRequired':
    'Faça login no DSH para gerenciar as configurações do Whisper.',
  'dsh-live-voice.recording.bitrate.help':
    'Taxa de bits desejada para o áudio comprimido. Valores maiores usam mais armazenamento local.',
  'dsh-live-voice.recording.bitrate.label': 'Taxa de bits da gravação',
  'dsh-live-voice.recording.bitrate.option': '{bitrate} kbit/s',
  'dsh-live-voice.recording.browserUnsupported':
    'O reconhecimento do navegador não oferece gravações recuperáveis nem transcrição de intervalos de áudio salvos. Selecione Qwen ou Whisper HTTP.',
  'dsh-live-voice.recording.durabilityWarning':
    'O armazenamento local pode ficar cheio ou ser apagado; a recuperação não é garantida. Se o salvamento falhar, a captura para para evitar perda silenciosa de dados.',
  'dsh-live-voice.recording.enabled.help':
    'Ativado por padrão. Desative se não quiser salvar áudio recuperável localmente durante a captura.',
  'dsh-live-voice.recording.enabled.label': 'Salvar gravações recuperáveis',
  'dsh-live-voice.recording.error.failed':
    'Não foi possível salvar a gravação. A captura foi interrompida para evitar perda silenciosa de dados.',
  'dsh-live-voice.recording.keepPrevious.help':
    "Mantenha de 1 a 100 capturas comuns por tipo de fonte; no Attendee, N grupos de reunião mais recentes pela atividade de captura, com todos os participantes e trechos enquanto o grupo for retido. Gravações ativas, escritas pendentes e estrelas protegem o grupo inteiro sem ocupar a quantidade comum. Silêncio entre trechos não significa fim da chamada nem reserva uma vaga: uma reunião mais nova pode expirar um grupo antigo silencioso. Microfone e áudio compartilhado legados mantêm N capturas por tipo. A quota ou remoção de armazenamento pelo navegador ainda pode limitar a disponibilidade.",
  'dsh-live-voice.recording.keepPrevious.label': 'Gravações mantidas por tipo de fonte',
  'dsh-live-voice.recording.managementHelp':
    'O gerenciamento das sessões salvas — navegação, reprodução, revisão de transcrições, exportação e exclusão — exige o plugin opcional dsh-live-voice-debugger. Use Diagnósticos abaixo para instalá-lo. A gravação em si não exige o depurador.',
  'dsh-live-voice.recording.paddingHelp':
    'Inclui de 0 a 2.000 ms antes e depois da fala detectada ao transcrever um intervalo de áudio salvo.',
  'dsh-live-voice.recording.postRoll.label': 'Áudio após a fala (milissegundos)',
  'dsh-live-voice.recording.preRoll.label': 'Áudio antes da fala (milissegundos)',
  'dsh-live-voice.recording.privacyWarning':
    'O áudio, incluindo silêncio e sons de fundo, fica salvo localmente neste perfil do navegador e site, com compressão com perdas. Obtenha consentimento antes de gravar outras pessoas. Desativar esta opção não exclui gravações salvas.',
  'dsh-live-voice.recording.status.saved': 'Áudio salvo até {time}',
  'dsh-live-voice.recording.title': 'Gravações recuperáveis',
  'dsh-live-voice.settings.autoSend.cancel': 'Cancelar envio automático',
  'dsh-live-voice.settings.autoSend.countdown': 'Enviando em {remaining}',
  'dsh-live-voice.settings.autoSend.delay': 'Enviar após o silêncio',
  'dsh-live-voice.settings.close': 'Fechar configurações de voz',
  'dsh-live-voice.settings.delivery.dshEnterHelp':
    'A Voz ao Vivo usa sua resposta para escolher a ação correta ao enviar como Steer ou colocar na Fila. Isto não altera as configurações do DSH; informe o comportamento que você já usa nele e atualize esta resposta se ele mudar.',
  'dsh-live-voice.settings.delivery.dshEnterQuestion':
    'No seu DSH, quando o agente está ocupado, o Enter faz o quê?',
  'dsh-live-voice.settings.delivery.dshEnterQueue': 'Coloca a mensagem na fila',
  'dsh-live-voice.settings.delivery.dshEnterSteer': 'Envia a mensagem como steer',
  'dsh-live-voice.settings.delivery.label': 'Modo de envio',
  'dsh-live-voice.settings.delivery.manualLabel': 'Desativado — revisar e enviar manualmente',
  'dsh-live-voice.settings.delivery.queueLabel': 'Fila — adicionar automaticamente após o silêncio',
  'dsh-live-voice.settings.delivery.status': 'Entrega automática: {mode}',
  'dsh-live-voice.settings.delivery.steerDescription': 'enviar ao agente em execução',
  'dsh-live-voice.settings.delivery.steerLabel':
    'Enviar — encaminhar automaticamente ao agente em execução',
  'dsh-live-voice.settings.delivery.toggle': 'Modo de entrega automática',
  'dsh-live-voice.settings.engine.refresh': 'Atualizar mecanismos disponíveis',
  'dsh-live-voice.settings.filters.title': 'Filtragem',
  'dsh-live-voice.settings.general.title': 'Gerais',
  'dsh-live-voice.settings.layout.delivery': 'Envio de mensagens',
  'dsh-live-voice.settings.layout.diagnostics': 'Diagnóstico',
  'dsh-live-voice.settings.layout.listening': 'Escuta e interrupções',
  'dsh-live-voice.settings.layout.playback': 'Reprodução e saída',
  'dsh-live-voice.settings.layout.shortcut': 'Atalhos',
  'dsh-live-voice.settings.layout.transcription': 'Transcrição',
  'dsh-live-voice.settings.layout.voice': 'Voz e mecanismo',
  'dsh-live-voice.settings.persistence.loadError':
    'Não foi possível carregar as configurações da Voz ao Vivo do servidor. Recarregue para tentar novamente.',
  'dsh-live-voice.settings.persistence.saveError':
    'Não foi possível salvar as configurações da Voz ao Vivo no servidor. Tente novamente.',
  'dsh-live-voice.settings.shortcuts.assistantSpeech':
    'Ligar/desligar fala automática do assistente',
  'dsh-live-voice.settings.shortcuts.clear': 'Limpar',
  'dsh-live-voice.settings.shortcuts.conflict': 'Este atalho já está atribuído a outra ação.',
  'dsh-live-voice.settings.shortcuts.edit': 'Clique para substituir',
  'dsh-live-voice.settings.shortcuts.help':
    'Clique no atalho, pressione as novas teclas juntas e solte para salvar. Ctrl, Shift, Alt e Command funcionam sozinhos ou combinados, com ou sem uma letra. Escape cancela; Tab sai do campo. Atalhos do navegador ou do sistema podem ter prioridade.',
  'dsh-live-voice.settings.shortcuts.meeting': 'Ligar/desligar compartilhamento de reunião',
  'dsh-live-voice.settings.shortcuts.microphone': 'Ligar/desligar microfone',
  'dsh-live-voice.settings.shortcuts.record': 'Clique para definir',
  'dsh-live-voice.settings.shortcuts.recording':
    'Pressione um atalho… Solte para salvar. Escape cancela.',
  'dsh-live-voice.settings.sourceNames.help':
    'Quando as duas fontes capturam, estes nomes identificam novos blocos da transcrição, não participantes individuais. Salvos ao sair do campo; vazio restaura Me / Them. Máximo de 80 caracteres. O texto existente não muda.',
  'dsh-live-voice.settings.sourceNames.microphone': 'Nome da fonte do microfone',
  'dsh-live-voice.settings.sourceNames.shared': 'Nome da fonte do áudio compartilhado',
  'dsh-live-voice.settings.sourceNames.title': 'Nomes das fontes da reunião',
  'dsh-live-voice.settings.tabs.conversation': 'Conversa',
  'dsh-live-voice.settings.tabs.recognition': 'Reconhecimento de voz',
  'dsh-live-voice.settings.tabs.speak': 'Fala',
  'dsh-live-voice.settings.title': 'Configurações da Voz ao Vivo',
  'dsh-live-voice.settings.whisper.hostHelp':
    'Configurações para todo o host. Apenas URLs HTTP loopback não autenticadas (localhost, 127.0.0.1, [::1]) são permitidas. Loopback refere-se ao host DSH, não a este navegador. Todas as verificações de integridade e requisições de áudio passam pelo backend autenticado.',
  'dsh-live-voice.speak.agentContext.enabled': 'Ativar contexto de voz do agente',
  'dsh-live-voice.speak.agentContext.enabledHelp':
    'Quando ativado, o contexto abaixo informa ao agente que suas respostas serão faladas em voz alta.',
  'dsh-live-voice.speak.agentContext.help':
    'Esta instrução em inglês é enviada ao agente somente durante uma conversa por voz ativa com fala automática do assistente ativada.',
  'dsh-live-voice.speak.agentContext.label': 'Contexto de voz do agente',
  'dsh-live-voice.speak.agentContext.restore': 'Restaurar padrão',
  'dsh-live-voice.speak.autoPlayback.disable': 'Desativar fala automática da IA',
  'dsh-live-voice.speak.autoPlayback.enable': 'Ativar fala automática da IA',
  'dsh-live-voice.speak.autoPlayback.enabled':
    'Falar automaticamente novas mensagens do assistente',
  'dsh-live-voice.speak.autoPlayback.help':
    'Novas mensagens do assistente são faladas automaticamente, mesmo com o microfone desligado. A reprodução aguarda enquanto você fala.',
  'dsh-live-voice.speak.autoPlayback.label': 'Fala automática do assistente',
  'dsh-live-voice.speak.autoPlayback.nextMode':
    'Próximo modo: {mode}. Clique com o botão direito para escolher o dispositivo de áudio.',
  'dsh-live-voice.speak.autoPlayback.remainingOne':
    'Fala automática do assistente: {state} — resta {count} segmento de fala',
  'dsh-live-voice.speak.autoPlayback.remainingOther':
    'Fala automática do assistente: {state} — restam {count} segmentos de fala',
  'dsh-live-voice.speak.autoPlayback.status': 'Fala automática do assistente: {state}',
  'dsh-live-voice.speak.browser.automaticVoice': 'Voz local automática',
  'dsh-live-voice.speak.browser.defaultVoice': 'padrão',
  'dsh-live-voice.speak.browser.label': 'Fala do navegador · áudio neste dispositivo',
  'dsh-live-voice.speak.browser.name': 'Fala do navegador',
  'dsh-live-voice.speak.browser.outputHelp':
    'A síntese de fala do navegador pode ignorar o dispositivo de saída selecionado; esta API normalmente segue o padrão do sistema.',
  'dsh-live-voice.speak.browser.voice': 'Voz local do navegador',
  'dsh-live-voice.speak.captions.approximate': 'Legendas aproximadas da fala',
  'dsh-live-voice.speak.captions.loading': 'Preparando áudio da fala',
  'dsh-live-voice.speak.captions.position': 'Trecho de fala {index} de {total}',
  'dsh-live-voice.speak.captions.progress': 'Progresso aproximado da fala',
  'dsh-live-voice.speak.captions.title': 'Fala e legendas ao vivo',
  'dsh-live-voice.speak.engine.label': 'Mecanismo de fala',
  'dsh-live-voice.speak.engine.playbackHelp':
    'Qwen e macOS say sintetizam no host do DSH; o áudio AAC/M4A compacto é reproduzido neste navegador. A fala do navegador é sintetizada e reproduzida neste dispositivo.',
  'dsh-live-voice.speak.filters.code.enabled': 'Filtrar blocos de código Markdown antes de falar',
  'dsh-live-voice.speak.filters.code.maxLines':
    'Ler blocos de código até esta quantidade de linhas',
  'dsh-live-voice.speak.filters.code.notice': 'Veja o código na nossa conversa',
  'dsh-live-voice.speak.filters.code.replacement': 'Frase substituta para blocos de código maiores',
  'dsh-live-voice.speak.interruption.disabledHelp':
    'Enviar outra mensagem não interrompe o áudio do assistente que você já está ouvindo.',
  'dsh-live-voice.speak.interruption.enabled':
    'Parar fala do assistente quando eu enviar uma mensagem',
  'dsh-live-voice.speak.interruption.enabledHelp':
    'Enviar ou direcionar uma nova mensagem interrompe a fala atual ou pausada do assistente.',
  'dsh-live-voice.speak.macos.label': 'macOS say · áudio no host',
  'dsh-live-voice.speak.macos.name': 'macOS say',
  'dsh-live-voice.speak.macos.voice': 'Voz do macOS say',
  'dsh-live-voice.speak.macos.voiceHelp':
    'Informe o nome exato da voz usado por say -v. Deixe vazio para usar a voz padrão do macOS. Liste as vozes do host no Terminal com say -v "?".',
  'dsh-live-voice.speak.output.checking': 'Verificando saída de fala…',
  'dsh-live-voice.speak.output.device': 'Dispositivo de saída',
  'dsh-live-voice.speak.output.fallbackName': 'Saída de áudio',
  'dsh-live-voice.speak.output.stopTest': 'Parar teste de fala',
  'dsh-live-voice.speak.output.test': 'Testar saída de fala selecionada',
  'dsh-live-voice.speak.output.testPhrase':
    'DSH Voz ao Vivo. A saída de fala selecionada está funcionando.',
  'dsh-live-voice.speak.output.testing': 'Testando fala…',
  'dsh-live-voice.speak.playback.message': 'Falar mensagem',
  'dsh-live-voice.speak.playback.next': 'Pular para o próximo trecho de fala',
  'dsh-live-voice.speak.playback.pause': 'Pausar fala',
  'dsh-live-voice.speak.playback.previous': 'Voltar ao trecho de fala anterior',
  'dsh-live-voice.speak.playback.resume': 'Retomar fala',
  'dsh-live-voice.speak.playback.stop': 'Parar de falar',
  'dsh-live-voice.speak.playback.stopAll': 'Parar toda a fala',
  'dsh-live-voice.speak.qwen.connection': 'Conexão com servidor Qwen',
  'dsh-live-voice.speak.qwen.endpoint': 'URL base da API Qwen',
  'dsh-live-voice.speak.qwen.healthFailed': 'Falha na verificação de integridade do Qwen.',
  'dsh-live-voice.speak.qwen.label': 'Qwen3 TTS · servidor MLX local',
  'dsh-live-voice.speak.qwen.name': 'Qwen3 local',
  'dsh-live-voice.speak.qwen.requestFailed': 'Falha na requisição de configurações do Qwen.',
  'dsh-live-voice.speak.qwen.restartRequired':
    'As rotas de configuração do Qwen não estão carregadas. É necessário reiniciar o servidor DSH normalmente para carregar rotas atualizadas do plugin; atualizar apenas esta página não é suficiente.',
  'dsh-live-voice.speak.qwen.save': 'Salvar configurações do Qwen',
  'dsh-live-voice.speak.qwen.saved':
    'Salvo no host DSH. Requisições ativas do Qwen foram canceladas.',
  'dsh-live-voice.speak.qwen.signInRequired':
    'Faça login no DSH para gerenciar as configurações do Qwen.',
  'dsh-live-voice.speak.qwen.test': 'Testar servidor Qwen',
  'dsh-live-voice.speak.qwen.voice': 'Voz Qwen',
  'dsh-live-voice.speak.qwen.voiceHelp':
    'Aiden é usado por padrão. Estas vozes predefinidas não são vozes nativas em Português do Brasil.',
  'dsh-live-voice.speak.qwen.voices.aiden': 'Aiden — masculino, inglês americano',
  'dsh-live-voice.speak.qwen.voices.dylan': 'Dylan — masculino, chinês de Pequim',
  'dsh-live-voice.speak.qwen.voices.eric': 'Eric — masculino, chinês de Sichuan',
  'dsh-live-voice.speak.qwen.voices.onoAnna': 'Ono Anna — feminino, japonês',
  'dsh-live-voice.speak.qwen.voices.ryan': 'Ryan — masculino, inglês',
  'dsh-live-voice.speak.qwen.voices.serena': 'Serena — feminino, chinês',
  'dsh-live-voice.speak.qwen.voices.sohee': 'Sohee — feminino, coreano',
  'dsh-live-voice.speak.qwen.voices.uncleFu': 'Uncle Fu — masculino, chinês',
  'dsh-live-voice.speak.qwen.voices.vivian': 'Vivian — feminino, chinês',
  'dsh-live-voice.speak.rate.help': 'A velocidade relativa 1 é normal.',
  'dsh-live-voice.speak.rate.label': 'Velocidade da fala',
  'dsh-live-voice.speak.responseDelay.help':
    'Depois que você parar de falar, a reprodução automática do assistente aguardará esse tempo de silêncio contínuo. Falar novamente reinicia a contagem.',
  'dsh-live-voice.speak.responseDelay.label': 'Atraso da resposta do assistente',
  'dsh-live-voice.speak.responseDelay.oneAndHalf': '1,5 segundo',
  'dsh-live-voice.speak.segmentGap.help':
    'Aguarde esta quantidade de milissegundos entre trechos falados consecutivos. O padrão é 400 ms.',
  'dsh-live-voice.speak.segmentGap.label': 'Pausa entre trechos de fala',
  'dsh-live-voice.speak.status.paused': 'Fala pausada',
  'dsh-live-voice.speak.status.playing': 'Falando',
  'dsh-live-voice.speak.volume.help':
    'Somente reprodução da fala: 0% é silencioso; 100% é o volume máximo (padrão). O microfone não é alterado. No Browser, mudanças valem a partir do próximo trecho.',
  'dsh-live-voice.speak.volume.label': 'Volume da fala',
};

export default Object.freeze(ptBR);
