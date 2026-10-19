import type { LiveVoiceTranslation } from './base.js';

const es: LiveVoiceTranslation = {
  'dsh-live-voice.commons.connection.contactingHost': 'Conectando con el host de DSH…',
  'dsh-live-voice.commons.connection.endpoint': 'URL del punto de acceso',
  'dsh-live-voice.commons.connection.healthEndpoint': 'URL o ruta de comprobación de estado',
  'dsh-live-voice.commons.connection.reload': 'Volver a cargar la configuración guardada',
  'dsh-live-voice.commons.connection.test': 'Probar conexión',
  'dsh-live-voice.commons.connection.timeout': 'Tiempo de espera de las solicitudes (ms)',
  'dsh-live-voice.commons.connection.title': 'Configuración de conexión',
  'dsh-live-voice.commons.connection.unsaved': 'Cambios sin guardar',
  'dsh-live-voice.commons.controls.title': 'Controles de voz',
  'dsh-live-voice.commons.conversation.end': 'Terminar conversación por voz',
  'dsh-live-voice.commons.conversation.idle': 'Conversación inactiva',
  'dsh-live-voice.commons.conversation.start': 'Iniciar conversación por voz',
  'dsh-live-voice.commons.delivery.queueBadge': 'COLA',
  'dsh-live-voice.commons.device.numberedLabel': '{device} {number}',
  'dsh-live-voice.commons.dismiss': 'Descartar',
  'dsh-live-voice.commons.dismissError': 'Descartar error de voz',
  'dsh-live-voice.commons.engine.failure': '{engine}: {reason}',
  'dsh-live-voice.commons.input.ignoring': 'ignorando',
  'dsh-live-voice.commons.input.ignoringBadge': 'IGNORANDO',
  'dsh-live-voice.commons.input.listening': 'escuchando',
  'dsh-live-voice.commons.input.listeningBadge': 'ESCUCHANDO',
  'dsh-live-voice.commons.manual': 'manual',
  'dsh-live-voice.commons.milliseconds': '{milliseconds} ms',
  'dsh-live-voice.commons.off': 'desactivado',
  'dsh-live-voice.commons.on': 'activado',
  'dsh-live-voice.commons.pluginName': 'Voz en vivo',
  'dsh-live-voice.commons.queue': 'cola',
  'dsh-live-voice.commons.repository.starLabel': 'Danos una estrella en GitHub',
  'dsh-live-voice.commons.repository.starLink': 'Dar una estrella a DSH Voz en vivo en GitHub',
  'dsh-live-voice.commons.second': '1 segundo',
  'dsh-live-voice.commons.seconds': '{seconds} segundos',
  'dsh-live-voice.commons.send': 'ENVIAR',
  'dsh-live-voice.commons.status.ready': 'Funciones de voz listas',
  'dsh-live-voice.commons.systemDefault': 'Predeterminado del sistema',
  'dsh-live-voice.commons.toggle.offBadge': 'DESACTIVADO',
  'dsh-live-voice.commons.unknownLanguage': 'idioma desconocido',
  'dsh-live-voice.commons.update.busy':
    'Detén la captura y reproducción de voz antes de actualizar.',
  'dsh-live-voice.commons.update.cancel': 'Cancelar',
  'dsh-live-voice.commons.update.confirm':
    '¿Instalar Voz en vivo {version} en este perfil de DSH? La descarga requiere red. Reinicia DSH después si se solicita; nada se reinicia automáticamente.',
  'dsh-live-voice.commons.update.current':
    'Esta versión ya está instalada. Reinicia DSH para usarla.',
  'dsh-live-voice.commons.update.delayed':
    'La versión solicitada aún no está disponible para este perfil. Puede estar publicándose o esperando el minimumReleaseAge de pnpm. Espera y consulta el gestor de plugins de DSH; no se omitió ninguna política de seguridad.',
  'dsh-live-voice.commons.update.done':
    'Voz en vivo {version} instalado. Recarga la página cuando quieras.',
  'dsh-live-voice.commons.update.failed':
    'La actualización falló. Puede que la versión aún no esté en npm. Revisa el gestor de plugins de DSH.',
  'dsh-live-voice.commons.update.incompatible':
    'Esta versión es incompatible con el DSH en ejecución. Consulta el gestor de plugins y usa versiones compatibles de DSH y del plugin; no se concedió ninguna excepción.',
  'dsh-live-voice.commons.update.installing': 'Actualizando…',
  'dsh-live-voice.commons.update.label': 'Actualización disponible',
  'dsh-live-voice.commons.update.link':
    'Actualización disponible: {version}. Abrir la página de esta versión',
  'dsh-live-voice.commons.update.local':
    'Instalación local, Git o personalizada. Actualiza con el método de instalación original.',
  'dsh-live-voice.commons.update.now': 'Actualizar ahora',
  'dsh-live-voice.commons.update.restart':
    'Voz en vivo {version} instalado. Reinicia DSH cuando quieras y luego recarga esta página.',
  'dsh-live-voice.commons.update.scripts':
    'Los scripts necesitan aprobación. Revísalos en el gestor de plugins de DSH; aquí no se aprobó ninguno.',
  'dsh-live-voice.commons.update.unavailable':
    'Actualización no disponible para este perfil o versión de DSH. Usa el gestor de plugins.',
  'dsh-live-voice.commons.update.uncertain':
    'Resultado de instalación desconocido. Revisa el gestor de plugins de DSH antes de reintentar.',
  'dsh-live-voice.commons.update.version': 'Actualización disponible: {version}',
  'dsh-live-voice.commons.version.compatibility': 'Compatible con DSH v{version}',
  'dsh-live-voice.commons.version.compatibilityLink':
    'Compatible con DSH v{version}. Abrir la página de esta versión',
  'dsh-live-voice.commons.version.label': 'DSH Voz en vivo v{version}',
  'dsh-live-voice.commons.version.link': 'DSH Voz en vivo v{version}. Abrir la lista de versiones',
  'dsh-live-voice.commons.version.title': 'Información de versión',
  'dsh-live-voice.debugger.applied':
    'El depurador {version} se instaló y DSH lo aplicó. Esperando a que los diagnósticos se registren en esta página. Si no aparecen, revisa el gestor de plugins de DSH; nada se recarga automáticamente.',
  'dsh-live-voice.debugger.busy':
    'Detén la captura de voz, la transcripción y la reproducción antes de instalar.',
  'dsh-live-voice.debugger.close': 'Cerrar',
  'dsh-live-voice.debugger.confirm':
    '¿Instalar dsh-live-voice-debugger {version} y activarlo en este perfil de DSH? La descarga desde el registro de paquetes requiere conexión a la red. Reinicia DSH solo si el gestor lo solicita. Nada se reinicia ni se recarga automáticamente. No cambies esta dependencia desde otro gestor o CLI durante la instalación.',
  'dsh-live-voice.debugger.description':
    'Los diagnósticos y la gestión de sesiones grabadas requieren el plugin opcional dsh-live-voice-debugger. Permite inspeccionar el estado y las colas, explorar grabaciones, reproducir audio, revisar transcripciones y errores, exportar sesiones y borrar grabaciones finalizadas. Voz en vivo y la grabación funcionan sin él.',
  'dsh-live-voice.debugger.failed':
    'La instalación falló o se canceló. Revisa el gestor de plugins de DSH antes de continuar; no se reintentará desde aquí.',
  'dsh-live-voice.debugger.installNow': 'Instalar ahora',
  'dsh-live-voice.debugger.installed':
    'El depurador ya está instalado, pero no está disponible en esta página. Revisa su activación y los errores de carga en el gestor de plugins de DSH. Reinicia DSH solo si se solicita; este diálogo no lo reinstalará.',
  'dsh-live-voice.debugger.installing': 'Comprobando o instalando el depurador…',
  'dsh-live-voice.debugger.label': 'Diagnósticos',
  'dsh-live-voice.debugger.local':
    'Ya existe una dependencia local, Git o personalizada del depurador. Adminístrala con su método de instalación original; no se sustituirá aquí.',
  'dsh-live-voice.debugger.ready':
    'Los diagnósticos están listos. Cierra este diálogo y pulsa Diagnósticos para abrir el depurador.',
  'dsh-live-voice.debugger.restart':
    'El depurador {version} se instaló. El gestor de DSH requiere un reinicio. Reinicia DSH cuando puedas y después recarga esta página. Nada se reinicia automáticamente.',
  'dsh-live-voice.debugger.scripts':
    'Los scripts del paquete requieren aprobación. Revísalos en el gestor de plugins de DSH; no se aprobó ningún script ni se reintentará la instalación aquí.',
  'dsh-live-voice.debugger.title': 'Diagnósticos y sesiones grabadas',
  'dsh-live-voice.debugger.unavailable':
    'La instalación no está disponible para este perfil o versión de DSH. Usa el gestor de plugins de DSH.',
  'dsh-live-voice.debugger.uncertain':
    'El resultado de la instalación es desconocido. Revisa el gestor de plugins de DSH antes de continuar; no se reintentará desde aquí.',
  'dsh-live-voice.meeting.actions': 'Acciones de reunión',
  'dsh-live-voice.meeting.attendee.admissionUnknown':
    'La admisión en la reunión no está confirmada.',
  'dsh-live-voice.meeting.attendee.advanced': 'Conexión avanzada',
  'dsh-live-voice.meeting.attendee.aliasHelp':
    'Los alias solo se aplican a esta conexión y al texto futuro. No cambian los nombres en la reunión.',
  'dsh-live-voice.meeting.attendee.apiKey': "Clave API",
  'dsh-live-voice.meeting.attendee.apiUrl': 'URL de la API Attendee local',
  'dsh-live-voice.meeting.attendee.automaticReceiver': 'Receptor detectado por DSH',
  'dsh-live-voice.meeting.attendee.botId': 'ID del bot (opcional; vincula el primero)',
  'dsh-live-voice.meeting.attendee.botName': 'Nombre del bot en la reunión',
  'dsh-live-voice.meeting.attendee.configureConnection': 'Configurar conexión de Attendee',
  'dsh-live-voice.meeting.attendee.confirmRelease': 'Descartar control sin salir',
  'dsh-live-voice.meeting.attendee.connected': 'Conectado a Attendee',
  'dsh-live-voice.meeting.attendee.connecting': 'Abriendo receptor…',
  'dsh-live-voice.meeting.attendee.connection': 'Configuración de conexión',
  'dsh-live-voice.meeting.attendee.controlExpired':
    'El control del bot caducó. Puede seguir en la reunión; revise Attendee.',
  'dsh-live-voice.meeting.attendee.controlReleased':
    'Control descartado, sin solicitar salida. Revise el bot en Attendee.',
  'dsh-live-voice.meeting.attendee.controlUnavailable':
    'Control del bot no disponible. El estado de la reunión es desconocido; revise Attendee.',
  'dsh-live-voice.meeting.attendee.controlUnknown':
    'Estado del bot desconocido. Revise Attendee antes de crear otro bot.',
  'dsh-live-voice.meeting.attendee.copy': 'Copiar',
  'dsh-live-voice.meeting.attendee.credentialCancel': "Cancelar",
  'dsh-live-voice.meeting.attendee.credentialChecking': "Comprobando clave API guardada",
  'dsh-live-voice.meeting.attendee.credentialHelp': "Conectar guarda la clave escrita para este origen API y la reutiliza después. El host la almacena en texto plano en un archivo 0600, sin cifrado del sistema. La comparten los navegadores autenticados de este host y nunca se devuelve al navegador. Eliminarla no termina el control actual del bot.",
  'dsh-live-voice.meeting.attendee.credentialInvalid': "El almacenamiento de claves no es válido. Repare o elimine el archivo de credenciales del host antes de reintentar.",
  'dsh-live-voice.meeting.attendee.credentialMissing': "No hay clave API para este origen. Escríbala una vez y conecte.",
  'dsh-live-voice.meeting.attendee.credentialNotSaved': "Clave API no configurada en este host",
  'dsh-live-voice.meeting.attendee.credentialRemove': "Eliminar clave API guardada",
  'dsh-live-voice.meeting.attendee.credentialRemoveConfirm': "Eliminar clave guardada",
  'dsh-live-voice.meeting.attendee.credentialRemoveWarning': "¿Eliminar la clave guardada de este origen? La recepción y el control actuales conservan su credencial; esto no solicita la salida.",
  'dsh-live-voice.meeting.attendee.credentialSaved': "Clave API configurada en este host",
  'dsh-live-voice.meeting.attendee.credentialUnavailable': "El almacenamiento de claves no está disponible. Revise los permisos del host y reintente.",
  'dsh-live-voice.meeting.attendee.currentBot': 'Último bot conocido',
  'dsh-live-voice.meeting.attendee.defaultBotName': 'Nombre predeterminado del bot',
  'dsh-live-voice.meeting.attendee.departureRequested':
    'Salida solicitada; no se confirmó la retirada de la reunión.',
  'dsh-live-voice.meeting.attendee.failed':
    'Receptor detenido. Revise TLS, credenciales, participantes, límites y motor de reconocimiento antes de reconectar.',
  'dsh-live-voice.meeting.attendee.help':
    'Conecte Attendee local, pegue el enlace, elija el nombre del bot y solicite entrada. Los participantes aparecen aquí con barras independientes. Requiere STT HTTP o local en el navegador, no reconocimiento nativo. La clave no se guarda. La grabación sigue sus ajustes.',
  'dsh-live-voice.meeting.attendee.ingressUrl': 'URL WSS confiable del receptor',
  'dsh-live-voice.meeting.attendee.invalidMeeting': 'Introduzca un enlace válido de Google Meet.',
  'dsh-live-voice.meeting.attendee.join': 'Entrar en la reunión',
  'dsh-live-voice.meeting.attendee.joinFailed':
    'El resultado puede ser desconocido. Revise Attendee antes de reconectar o crear otro bot.',
  'dsh-live-voice.meeting.attendee.joinHelp':
    'Crea un bot con el nombre y destino de audio elegidos. El organizador puede tener que admitirlo. Desconectar DSH no retira el bot: use Salir de la reunión.',
  'dsh-live-voice.meeting.attendee.joining': 'Solicitando entrada…',
  'dsh-live-voice.meeting.attendee.leave': 'Salir de la reunión',
  'dsh-live-voice.meeting.attendee.leaveFailed':
    'No se pudo confirmar la salida. El bot puede seguir; reintente Salir de la reunión o revise Attendee.',
  'dsh-live-voice.meeting.attendee.leaving': 'Solicitando salida…',
  'dsh-live-voice.meeting.attendee.meetingUrl': 'Enlace de Google Meet',
  'dsh-live-voice.meeting.attendee.noParticipants': 'Esperando identificar participantes',
  'dsh-live-voice.meeting.attendee.participant': 'Participante {number}',
  'dsh-live-voice.meeting.attendee.participants': 'Participantes de la reunión',
  'dsh-live-voice.meeting.attendee.receiverInactive': 'Receptor de audio desconectado',
  'dsh-live-voice.meeting.attendee.receiverUrl': 'URL del receptor (secreta)',
  'dsh-live-voice.meeting.attendee.recognitionRequired':
    'Elija Whisper HTTP, Qwen HTTP o un modelo STT local del navegador en Ajustes antes de conectar.',
  'dsh-live-voice.meeting.attendee.relayUnavailable':
    'La conexión de audio de Compose no está disponible. Inicie Attendee con el complemento de audio DSH y vuelva a conectar.',
  'dsh-live-voice.meeting.attendee.releaseControl': 'Descartar control del bot…',
  'dsh-live-voice.meeting.attendee.releaseWarning':
    'Descartar el control no retira el bot de la reunión. Perderá la acción Salir aquí. Continúe solo tras revisar Attendee.',
  'dsh-live-voice.meeting.attendee.settingsHelp':
    "Configure aquí el origen local de la API. Escriba la clave del proyecto una vez y conecte; las próximas conexiones reutilizan la clave guardada en el host para ese origen. Use el campo de mensaje para entrar a una reunión.",
  'dsh-live-voice.meeting.attendee.start': 'Conectar a Attendee',
  'dsh-live-voice.meeting.attendee.stop': 'Desconectar de Attendee',
  'dsh-live-voice.meeting.attendee.title': 'Audio por participante (Attendee · experimental)',
  'dsh-live-voice.meeting.attendee.tlsNeeded':
    'DSH todavía no tiene un receptor WSS confiable. Configure HTTPS o un proxy WSS confiable en conexión avanzada antes de entrar.',
  'dsh-live-voice.meeting.attendee.waiting':
    'Receptor abierto; configure un bot nuevo con la URL siguiente.',
  'dsh-live-voice.meeting.browserLocalUnavailable':
    'El reconocimiento local del navegador no está disponible para este idioma. Instala su paquete de idioma o desactiva explícitamente el procesamiento solo local en Ajustes para permitir el servicio del navegador.',
  'dsh-live-voice.meeting.browserSharedUnsupported':
    'Este navegador no puede reconocer audio compartido de forma segura. Elige Qwen o Whisper HTTP para el audio compartido.',
  'dsh-live-voice.meeting.failed': 'Error de reconocimiento.',
  'dsh-live-voice.meeting.help':
    'Fuentes independientes; envía las transcripciones manualmente desde el editor.',
  'dsh-live-voice.meeting.inactive': 'Inactivo',
  'dsh-live-voice.meeting.joinMeet': 'Entrar en Google Meet · experimental',
  'dsh-live-voice.meeting.listening': 'Escuchando',
  'dsh-live-voice.meeting.microphone': 'Micrófono',
  'dsh-live-voice.meeting.noAudio': 'No se compartió audio. Activa el audio en el diálogo.',
  'dsh-live-voice.meeting.processing': 'Transcribiendo…',
  'dsh-live-voice.meeting.shareTab': 'Compartir audio de una pestaña',
  'dsh-live-voice.meeting.shared': 'Audio compartido',
  'dsh-live-voice.meeting.start': 'Iniciar fuente',
  'dsh-live-voice.meeting.startShared': 'Iniciar audio compartido',
  'dsh-live-voice.meeting.starting': 'Iniciando…',
  'dsh-live-voice.meeting.stop': 'Detener fuente',
  'dsh-live-voice.meeting.stopShared': 'Detener audio compartido',
  'dsh-live-voice.meeting.timestamps': 'Marcas de tiempo de transcripción',
  'dsh-live-voice.meeting.timestampsBadge': 'Tiempo',
  'dsh-live-voice.meeting.title': 'Modo reunión',
  'dsh-live-voice.meeting.unavailable': 'Reconocimiento no disponible.',
  'dsh-live-voice.recognition.autoSend.countdownHelp':
    'La cuenta atrás comienza tras el reconocimiento definitivo de una frase. Hablar de nuevo o editar el texto la cancela.',
  'dsh-live-voice.recognition.browser.autoInstallPack':
    'Instalar automáticamente este paquete de idioma del navegador cuando sea necesario',
  'dsh-live-voice.recognition.browser.help':
    'Utiliza la API SpeechRecognition del navegador. Esta es la opción predeterminada.',
  'dsh-live-voice.recognition.browser.label':
    'SpeechRecognition del navegador · Opción predeterminada',
  'dsh-live-voice.recognition.browser.localProcessing':
    'Procesar el reconocimiento localmente en este dispositivo',
  'dsh-live-voice.recognition.browser.microphoneHelp':
    'SpeechRecognition puede utilizar el micrófono predeterminado del navegador o del sistema en lugar del seleccionado aquí.',
  'dsh-live-voice.recognition.browser.remoteServiceWarning':
    'El reconocimiento mediante el servicio del navegador está activado. El navegador puede enviar el audio del micrófono a su servicio de reconocimiento.',
  'dsh-live-voice.recognition.commands.addPhrase': 'Añadir frase…',
  'dsh-live-voice.recognition.commands.clear': 'Vaciar el cuadro de mensaje',
  'dsh-live-voice.recognition.commands.enabled': 'Activar comandos de voz con coincidencia exacta',
  'dsh-live-voice.recognition.commands.end': 'Finalizar conversación',
  'dsh-live-voice.recognition.commands.mute': 'Suspender la entrada de voz en el cuadro de mensaje',
  'dsh-live-voice.recognition.commands.queue': 'Añadir a la cola',
  'dsh-live-voice.recognition.commands.removePhrase': 'Eliminar frase',
  'dsh-live-voice.recognition.commands.resume':
    'Reanudar la entrada de voz en el cuadro de mensaje',
  'dsh-live-voice.recognition.commands.send': 'Enviar al agente en ejecución',
  'dsh-live-voice.recognition.commands.stopSpeech': 'Detener la lectura en voz alta del asistente',
  'dsh-live-voice.recognition.commands.title': 'Comandos de voz',
  'dsh-live-voice.recognition.context.hint':
    'Contexto y vocabulario opcionales enviados como prompt al servicio HTTP de voz seleccionado con cada segmento de audio. Se guarda al salir del campo. La compatibilidad depende del servidor; no restringe idiomas ni garantiza el seguimiento de instrucciones. Déjalo vacío para no enviar contexto.',
  'dsh-live-voice.recognition.context.label': 'Contexto de transcripción',
  'dsh-live-voice.recognition.context.placeholder':
    'Native Brazilian Portuguese speaker who frequently uses technical terms in English.',
  'dsh-live-voice.recognition.dictation.cancel': 'Cancelar dictado',
  'dsh-live-voice.recognition.engine.label': 'Motor de reconocimiento',
  'dsh-live-voice.recognition.headphoneMode.help':
    'El micrófono sigue abierto durante la reproducción. El habla reconocida sin eco puede pausarla tras el retraso configurado; se reanuda cuando el micrófono y el audio compartido guardan silencio durante ese intervalo. La pausa manual requiere Reanudar.',
  'dsh-live-voice.recognition.headphoneMode.label': 'Auriculares — micrófono abierto',
  'dsh-live-voice.recognition.holdToTalk.enabled': 'Mantener pulsado para hablar',
  'dsh-live-voice.recognition.holdToTalk.help':
    'Con un cuadro de mensaje abierto, mantén pulsado el atajo configurado en cualquier parte de la página para capturar tu voz. Al soltarlo, se procesa la transcripción pendiente, se espera el retraso de envío configurado, se añade el mensaje a la cola y se cierra la captura de voz. Pulsa Escape mientras lo mantienes pulsado para cancelar.',
  'dsh-live-voice.recognition.language.automatic': 'Automático — detectar idioma',
  'dsh-live-voice.recognition.language.label': 'Idioma de reconocimiento',
  'dsh-live-voice.recognition.language.options.chinese': 'Chino (mandarín)',
  'dsh-live-voice.recognition.language.options.french': 'Francés',
  'dsh-live-voice.recognition.language.options.spanish': 'Español',
  'dsh-live-voice.recognition.local.cancel': 'Cancelar',
  'dsh-live-voice.recognition.local.confirm': 'Confirmar',
  'dsh-live-voice.recognition.local.confirmDownload':
    '¿Descargar {model}? Se almacenarán aproximadamente {size} en este navegador.',
  'dsh-live-voice.recognition.local.confirmRemove':
    '¿Eliminar {model} de este navegador? Las grabaciones se conservan.',
  'dsh-live-voice.recognition.local.confirmTitle':
    'Confirmar cambio en el almacenamiento de modelos',
  'dsh-live-voice.recognition.local.device': 'Entorno de ejecución',
  'dsh-live-voice.recognition.local.deviceHelp':
    'WebGPU requiere un adaptador de GPU funcional. Whisper ofrece una opción explícita de CPU con WebAssembly, más lenta; Qwen requiere WebGPU. No se cambia automáticamente de entorno de ejecución ni a HTTP.',
  'dsh-live-voice.recognition.local.download': 'Descargar modelo',
  'dsh-live-voice.recognition.local.error.cancelled':
    'Operación cancelada. Descarga o carga el modelo cuando quieras continuar.',
  'dsh-live-voice.recognition.local.error.download_failed':
    'No se pudo descargar el modelo. Comprueba tu conexión con Hugging Face e inténtalo de nuevo.',
  'dsh-live-voice.recognition.local.error.f16_unavailable':
    'Este modelo requiere WebGPU con soporte para shader-f16. Elige otro modelo Whisper o un navegador/dispositivo compatible.',
  'dsh-live-voice.recognition.local.error.failed':
    'La operación del modelo falló. Comprueba el almacenamiento del navegador y vuelve a cargar el modelo.',
  'dsh-live-voice.recognition.local.error.gpu_unavailable':
    'WebGPU no está disponible. Usa un navegador con un adaptador de GPU funcional o selecciona explícitamente Whisper con CPU WebAssembly.',
  'dsh-live-voice.recognition.local.error.inference_failed':
    'La transcripción falló. Vuelve a cargar el modelo e inténtalo con un fragmento de audio más corto.',
  'dsh-live-voice.recognition.local.error.invalid_audio':
    'No se puede transcribir este audio. Graba un nuevo fragmento e inténtalo de nuevo.',
  'dsh-live-voice.recognition.local.error.invalid_model':
    'Este modelo no es compatible. Selecciona un modelo de la lista.',
  'dsh-live-voice.recognition.local.error.model_busy':
    'El modelo está ocupado. Espera a que termine la operación actual e inténtalo de nuevo.',
  'dsh-live-voice.recognition.local.error.model_missing':
    'Faltan archivos del modelo o se han eliminado de la caché. Vuelve a descargar el modelo.',
  'dsh-live-voice.recognition.local.error.runtime_outdated':
    'El navegador cargó un runtime de voz anterior a esta configuración. Recarga esta página para cargar el worker actualizado. Si persiste, recarga el backend actualizado de Voz en vivo en DSH; no hace falta descargar el modelo otra vez.',
  'dsh-live-voice.recognition.local.error.runtime_unavailable':
    'El entorno de ejecución del modelo no está disponible. Actualiza la página, comprueba la compatibilidad del navegador y vuelve a cargar el modelo.',
  'dsh-live-voice.recognition.local.error.storage_full':
    'El almacenamiento del navegador está lleno. Libera espacio o elimina modelos que no uses e inténtalo de nuevo.',
  'dsh-live-voice.recognition.local.error.storage_unavailable':
    'El almacenamiento del navegador no está disponible. Permite el almacenamiento del sitio en un perfil normal del navegador e inténtalo de nuevo.',
  'dsh-live-voice.recognition.local.help': 'Acerca de los modelos del navegador',
  'dsh-live-voice.recognition.local.load': 'Cargar modelo',
  'dsh-live-voice.recognition.local.model': 'Modelo',
  'dsh-live-voice.recognition.local.modelCard': 'Detalles del modelo',
  'dsh-live-voice.recognition.local.phase.absent':
    'Descarga tu primer modelo para comenzar la transcripción local.',
  'dsh-live-voice.recognition.local.phase.checking': 'Comprobando archivos del modelo…',
  'dsh-live-voice.recognition.local.phase.downloaded':
    'Modelo descargado. Cárgalo para comenzar a transcribir.',
  'dsh-live-voice.recognition.local.phase.downloading': 'Descargando modelo…',
  'dsh-live-voice.recognition.local.phase.error':
    'El modelo requiere atención. Sigue las indicaciones del error e inténtalo de nuevo.',
  'dsh-live-voice.recognition.local.phase.loading': 'Cargando modelo…',
  'dsh-live-voice.recognition.local.phase.ready': 'Modelo listo para la transcripción local.',
  'dsh-live-voice.recognition.local.privacy':
    'Las descargas de modelos se conectan a Hugging Face. La voz se procesa en este navegador y no se envía a un servicio de transcripción HTTP. La aplicación sigue necesitando DSH.',
  'dsh-live-voice.recognition.local.progress': 'Progreso de descarga del modelo',
  'dsh-live-voice.recognition.local.qwenLabel': 'Qwen · Navegador',
  'dsh-live-voice.recognition.local.recommended': 'recomendado',
  'dsh-live-voice.recognition.local.reload': 'Volver a cargar',
  'dsh-live-voice.recognition.local.remove': 'Eliminar modelo',
  'dsh-live-voice.recognition.local.space': 'Almacenamiento disponible en el navegador: {size}',
  'dsh-live-voice.recognition.local.storageHelp':
    'Los modelos se guardan en este perfil del navegador; la caché puede eliminarse. Las estimaciones de disco no incluyen los recursos del entorno de ejecución ni el uso adicional de GPU/RAM. Eliminar afecta a los archivos del modelo, no a las sesiones grabadas.',
  'dsh-live-voice.recognition.local.title': 'Modelos del navegador',
  'dsh-live-voice.recognition.local.whisperLabel': 'Whisper · Navegador (recomendado)',
  'dsh-live-voice.recognition.manualSend.help':
    'El texto reconocido permanece en el cuadro de mensaje hasta que utilices el botón de envío habitual de DSH.',
  'dsh-live-voice.recognition.maxUtterance.help':
    'Si hablas sin hacer pausas, se inicia un nuevo fragmento de transcripción tras este intervalo. Valor predeterminado: 60 segundos.',
  'dsh-live-voice.recognition.maxUtterance.label': 'Duración máxima del habla continua (segundos)',
  'dsh-live-voice.recognition.microphone.checking': 'Comprobando la disponibilidad del micrófono',
  'dsh-live-voice.recognition.microphone.device': 'Dispositivo de entrada',
  'dsh-live-voice.recognition.microphone.failure': 'Micrófono: {reason}',
  'dsh-live-voice.recognition.microphone.ignore':
    'Ignorar la entrada de voz en el cuadro de mensaje',
  'dsh-live-voice.recognition.microphone.inputStatus':
    'Entrada de audio: {state}. Ignorar descarta el dictado, no la captura: la interrupción por voz sigue activa; los comandos configurados funcionan si están habilitados. Detén la captura con el botón de la fuente en el campo de mensaje.',
  'dsh-live-voice.recognition.microphone.label': 'Micrófono',
  'dsh-live-voice.recognition.microphone.permissionHelp':
    'Solo se solicitará permiso para usar el micrófono cuando inicies un dictado o una conversación por voz.',
  'dsh-live-voice.recognition.microphone.resume': 'Reanudar escucha',
  'dsh-live-voice.recognition.microphone.starting': 'Iniciando micrófono',
  'dsh-live-voice.recognition.microphone.takeControl': 'Tomar el control del micrófono',
  'dsh-live-voice.recognition.minimumWords.enabled':
    'Ignorar los fragmentos definitivos de transcripción demasiado cortos',
  'dsh-live-voice.recognition.minimumWords.help':
    'Los fragmentos definitivos con menos palabras se descartan antes de llegar al cuadro de mensaje o al envío automático.',
  'dsh-live-voice.recognition.minimumWords.label': 'Mínimo de palabras por fragmento definitivo',
  'dsh-live-voice.recognition.mode.label': 'Modo de escucha',
  'dsh-live-voice.recognition.planned.parakeet': 'NVIDIA Parakeet — Próximamente',
  'dsh-live-voice.recognition.planned.sherpa': 'sherpa-onnx en continuo — Próximamente',
  'dsh-live-voice.recognition.planned.vote':
    'Próximamente — vota en las incidencias del repositorio',
  'dsh-live-voice.recognition.planned.voxtral': 'Voxtral Realtime — Próximamente',
  'dsh-live-voice.recognition.planned.webGpu': 'Inferencia WebGPU en el navegador — Próximamente',
  'dsh-live-voice.recognition.presets.custom.description':
    'Elige pausas independientes para fragmentos y párrafos.',
  'dsh-live-voice.recognition.presets.custom.label': 'Personalizada',
  'dsh-live-voice.recognition.presets.long.description':
    'Espera durante pausas de reflexión más largas.',
  'dsh-live-voice.recognition.presets.long.label': 'Larga',
  'dsh-live-voice.recognition.presets.natural.description': 'Permite pausas normales entre frases.',
  'dsh-live-voice.recognition.presets.natural.label': 'Natural',
  'dsh-live-voice.recognition.presets.short.description':
    'Transcribe rápidamente después de una pausa corta.',
  'dsh-live-voice.recognition.presets.short.label': 'Corta',
  'dsh-live-voice.recognition.providerSettings.help':
    'La configuración del proveedor cambia según el motor de reconocimiento seleccionado.',
  'dsh-live-voice.recognition.qwen.captureHelp':
    'El audio se divide en enunciados completos en formato WAV y se envía a través de DSH con autenticación al modelo Qwen3 ASR ejecutado localmente en el host.',
  'dsh-live-voice.recognition.qwen.connectionSuccess':
    'Conexión correcta. Qwen ASR y TTS están cargados. Los cambios sin guardar no se han aplicado.',
  'dsh-live-voice.recognition.qwen.endpointHelp':
    'API HTTP en la URL configurada en el host de DSH (predeterminada: http://127.0.0.1:8080/inference). El audio utiliza la ruta de transcripción autenticada del host de DSH.',
  'dsh-live-voice.recognition.qwen.hostHelp':
    'Configuración para todo el host del servidor Qwen3 ASR + TTS. Introduce una URL base HTTP o HTTPS accesible desde el host de DSH. El navegador accede a ella mediante las rutas autenticadas de DSH.',
  'dsh-live-voice.recognition.qwen.label': 'Qwen3 ASR · API HTTP',
  'dsh-live-voice.recognition.silenceDetection.chunkPause':
    'Antes de transcribir: {milliseconds} ms',
  'dsh-live-voice.recognition.silenceDetection.customHelp':
    'Introduce un número entero de 100 a 10.000 ms. Se guarda al salir del campo. Las pausas cortas pueden dividir el habla; el reconocimiento añade su propia latencia.',
  'dsh-live-voice.recognition.silenceDetection.customLabel': 'Pausa del fragmento (milisegundos)',
  'dsh-live-voice.recognition.silenceDetection.customParagraphHelp':
    'Silencio antes de un nuevo párrafo en el texto dictado (100–30.000 ms, números enteros). Se guarda al salir del campo; independiente de la pausa del fragmento y del envío del mensaje.',
  'dsh-live-voice.recognition.silenceDetection.customParagraphLabel':
    'Pausa de párrafo (milisegundos)',
  'dsh-live-voice.recognition.silenceDetection.detector.energy': 'Energía del audio',
  'dsh-live-voice.recognition.silenceDetection.detector.label': 'Detector de voz',
  'dsh-live-voice.recognition.silenceDetection.detector.silero':
    'Silero — experimental (predeterminado)',
  'dsh-live-voice.recognition.silenceDetection.duration':
    'Antes de transcribir: {milliseconds} ms · Nuevo párrafo: {paragraphMilliseconds} ms',
  'dsh-live-voice.recognition.silenceDetection.help':
    'Determina cuánto debe durar una pausa antes de enviar la voz capturada para su reconocimiento.',
  'dsh-live-voice.recognition.silenceDetection.label': 'Detección de silencio y párrafos',
  'dsh-live-voice.recognition.silenceDetection.minimumSpeech.help':
    'Voz mínima detectada antes de aceptar un intervalo (50–2.000 ms). Se ignoran los sonidos más cortos.',
  'dsh-live-voice.recognition.silenceDetection.minimumSpeech.label': 'Voz mínima (milisegundos)',
  'dsh-live-voice.recognition.silenceDetection.paragraphPause': 'Nuevo párrafo: {milliseconds} ms',
  'dsh-live-voice.recognition.silenceDetection.pauseLabel': 'Pausas de fragmento y párrafo',
  'dsh-live-voice.recognition.silenceDetection.threshold.help':
    'Umbral de actividad de voz (0,05–0,95). Los valores bajos detectan voces más suaves, pero pueden aceptar más ruido.',
  'dsh-live-voice.recognition.silenceDetection.threshold.label': 'Umbral de actividad de voz',
  'dsh-live-voice.recognition.silenceDetection.title':
    'Configuración de detección de silencio y párrafos',
  'dsh-live-voice.recognition.silero.error.failed':
    'La detección de voz Silero falló. Selecciona Energía del audio en la configuración o vuelve a intentar la captura.',
  'dsh-live-voice.recognition.silero.error.overloaded':
    'La detección de voz Silero está sobrecargada. Reinicia la captura o selecciona Energía del audio en la configuración.',
  'dsh-live-voice.recognition.silero.error.unavailable':
    'La detección de voz Silero no está disponible. Selecciona Energía del audio en la configuración o vuelve a intentar la captura.',
  'dsh-live-voice.recognition.speakerMode.help':
    'La reproducción libera el micrófono para reducir el retorno de los altavoces. Tomar micrófono interrumpe manualmente; participantes reconocidos sin eco en el audio compartido pueden pausar la reproducción, que se reanuda tras silencio estable.',
  'dsh-live-voice.recognition.speakerMode.label': 'Altavoces — escucha controlada',
  'dsh-live-voice.recognition.status.answer': 'Reconociendo respuesta',
  'dsh-live-voice.recognition.status.awaitingAnswer': 'Escuchando tu respuesta',
  'dsh-live-voice.recognition.status.listening': 'Escuchando',
  'dsh-live-voice.recognition.status.listeningProcessing': 'Escuchando y transcribiendo',
  'dsh-live-voice.recognition.status.processing': 'Transcribiendo',
  'dsh-live-voice.recognition.status.unavailable': 'Reconocimiento de voz no disponible',
  'dsh-live-voice.recognition.status.waiting': 'Esperando',
  'dsh-live-voice.recognition.status.waitingCommand': 'Esperando comando',
  'dsh-live-voice.recognition.voiceCommands.help':
    'Separa las frases con comas. La comparación ignora mayúsculas, acentos, puntuación y espacios adicionales. Debe coincidir todo el fragmento definitivo.',
  'dsh-live-voice.recognition.whisper.captureHelp':
    'El audio se divide en enunciados completos en formato WAV, se envía a través de DSH con autenticación y se procesa mediante el servidor HTTP de whisper.cpp en la interfaz de bucle local.',
  'dsh-live-voice.recognition.whisper.connectionSuccess':
    'Conexión correcta. El punto de acceso de comprobación de estado ha respondido; no se ha probado la transcripción. Los cambios sin guardar no se han aplicado.',
  'dsh-live-voice.recognition.whisper.endpointHelp':
    'API HTTP en la URL base configurada (predeterminada: http://127.0.0.1:8080/). Compatible con POST /v1/audio/transcriptions.',
  'dsh-live-voice.recognition.whisper.healthFailed':
    'Ha fallado la comprobación de estado de Whisper.',
  'dsh-live-voice.recognition.whisper.label': 'Whisper · API HTTP',
  'dsh-live-voice.recognition.whisper.requestFailed':
    'Ha fallado la solicitud de configuración de Whisper.',
  'dsh-live-voice.recognition.whisper.restartRequired':
    'Las rutas de configuración de Whisper no están cargadas. Es necesario reiniciar normalmente el servidor DSH para cargar las rutas actualizadas del complemento; no basta con actualizar esta página.',
  'dsh-live-voice.recognition.whisper.save': 'Guardar la configuración de Whisper',
  'dsh-live-voice.recognition.whisper.saved':
    'Guardado en el host de DSH. Se han cancelado las solicitudes de transcripción activas del host.',
  'dsh-live-voice.recognition.whisper.signInRequired':
    'Inicia sesión en DSH para gestionar la configuración de Whisper.',
  'dsh-live-voice.recording.bitrate.help':
    'Tasa de bits objetivo del audio comprimido. Los valores altos usan más almacenamiento local.',
  'dsh-live-voice.recording.bitrate.label': 'Tasa de bits de grabación',
  'dsh-live-voice.recording.bitrate.option': '{bitrate} kb/s',
  'dsh-live-voice.recording.browserUnsupported':
    'El reconocimiento del navegador no admite grabaciones recuperables ni transcripción de intervalos guardados. Elige Qwen o Whisper HTTP.',
  'dsh-live-voice.recording.durabilityWarning':
    'El almacenamiento local puede llenarse o borrarse; la recuperación no está garantizada. Si falla el guardado, la captura se detiene para evitar pérdidas de datos inadvertidas.',
  'dsh-live-voice.recording.enabled.help':
    'Activado por defecto. Desactívalo si no quieres guardar audio recuperable localmente durante la captura.',
  'dsh-live-voice.recording.enabled.label': 'Guardar grabaciones recuperables',
  'dsh-live-voice.recording.error.failed':
    'No se pudo guardar la grabación. Se detuvo la captura para evitar pérdidas de datos inadvertidas.',
  'dsh-live-voice.recording.keepPrevious.help':
    "Conserve de 1 a 100 capturas ordinarias por tipo de fuente; Attendee conserva N grupos de reunión, los más recientes por actividad de captura, con todos sus participantes y ráfagas mientras se retenga el grupo. Escritores activos, escrituras pendientes y estrellas protegen todo el grupo sin consumir una plaza ordinaria. El silencio no indica fin de llamada ni reserva una plaza: una reunión más reciente puede caducar un grupo antiguo silencioso. Las grabaciones anteriores de micrófono/audio compartido conservan N capturas por tipo. La cuota o eliminación de almacenamiento del navegador puede limitar la disponibilidad.",
  'dsh-live-voice.recording.keepPrevious.label': 'Grabaciones conservadas por tipo de fuente',
  'dsh-live-voice.recording.managementHelp':
    'Para gestionar sesiones guardadas —explorarlas, reproducirlas, revisar transcripciones, exportarlas y borrarlas— se requiere el plugin opcional dsh-live-voice-debugger. Usa Diagnósticos abajo para instalarlo. La grabación no requiere el depurador.',
  'dsh-live-voice.recording.paddingHelp':
    'Incluye de 0 a 2.000 ms antes y después de la voz detectada al transcribir un intervalo de audio guardado.',
  'dsh-live-voice.recording.postRoll.label': 'Audio después de la voz (milisegundos)',
  'dsh-live-voice.recording.preRoll.label': 'Audio antes de la voz (milisegundos)',
  'dsh-live-voice.recording.privacyWarning':
    'El audio, incluidos el silencio y los sonidos de fondo, se guarda localmente en este perfil del navegador y sitio, con compresión con pérdida. Obtén consentimiento antes de grabar a otras personas. Desactivar esto no borra las grabaciones guardadas.',
  'dsh-live-voice.recording.status.saved': 'Audio guardado hasta {time}',
  'dsh-live-voice.recording.title': 'Grabaciones recuperables',
  'dsh-live-voice.settings.autoSend.cancel': 'Cancelar envío automático',
  'dsh-live-voice.settings.autoSend.countdown': 'Enviando en {remaining}',
  'dsh-live-voice.settings.autoSend.delay': 'Enviar después del silencio',
  'dsh-live-voice.settings.close': 'Cerrar configuración de voz',
  'dsh-live-voice.settings.delivery.dshEnterHelp':
    'Voz en vivo usa tu respuesta para elegir la acción correcta para Redirigir y Cola. Esto no cambia la configuración de DSH; indica el comportamiento que ya usas y actualiza esta respuesta si cambia.',
  'dsh-live-voice.settings.delivery.dshEnterQuestion':
    'En tu DSH, ¿qué hace Enter cuando el agente está ocupado?',
  'dsh-live-voice.settings.delivery.dshEnterQueue': 'Añade el mensaje a la cola',
  'dsh-live-voice.settings.delivery.dshEnterSteer': 'Envía el mensaje para redirigir al agente',
  'dsh-live-voice.settings.delivery.label': 'Modo de envío',
  'dsh-live-voice.settings.delivery.manualLabel': 'Desactivado — revisar y enviar manualmente',
  'dsh-live-voice.settings.delivery.queueLabel': 'Cola — añadir automáticamente tras un silencio',
  'dsh-live-voice.settings.delivery.status': 'Envío automático: {mode}',
  'dsh-live-voice.settings.delivery.steerDescription': 'enviar al agente en ejecución',
  'dsh-live-voice.settings.delivery.steerLabel':
    'Redirigir — enviar automáticamente al agente en ejecución',
  'dsh-live-voice.settings.delivery.toggle': 'Modo de envío automático',
  'dsh-live-voice.settings.engine.refresh': 'Actualizar los motores disponibles',
  'dsh-live-voice.settings.filters.title': 'Filtrado',
  'dsh-live-voice.settings.general.title': 'General',
  'dsh-live-voice.settings.layout.delivery': 'Envío de mensajes',
  'dsh-live-voice.settings.layout.diagnostics': 'Diagnóstico',
  'dsh-live-voice.settings.layout.listening': 'Escucha e interrupciones',
  'dsh-live-voice.settings.layout.playback': 'Reproducción y salida',
  'dsh-live-voice.settings.layout.shortcut': 'Atajos',
  'dsh-live-voice.settings.layout.transcription': 'Transcripción',
  'dsh-live-voice.settings.layout.voice': 'Voz y motor',
  'dsh-live-voice.settings.persistence.loadError':
    'No se pudieron cargar los ajustes de Voz en vivo del servidor. Recarga para volver a intentarlo.',
  'dsh-live-voice.settings.persistence.saveError':
    'No se pudieron guardar los ajustes de Voz en vivo en el servidor. Inténtalo de nuevo.',
  'dsh-live-voice.settings.shortcuts.assistantSpeech':
    'Activar/desactivar voz automática del asistente',
  'dsh-live-voice.settings.shortcuts.clear': 'Borrar',
  'dsh-live-voice.settings.shortcuts.conflict': 'Este atajo ya está asignado a otra acción.',
  'dsh-live-voice.settings.shortcuts.edit': 'Haz clic para reemplazar',
  'dsh-live-voice.settings.shortcuts.help':
    'Haz clic en un atajo, pulsa las nuevas teclas juntas y suéltalas para guardar. Ctrl, Shift, Alt y Command funcionan solos o combinados, con o sin una letra. Escape cancela; Tab sale del campo. Los atajos del navegador o del sistema pueden tener prioridad.',
  'dsh-live-voice.settings.shortcuts.meeting': 'Activar/desactivar audio compartido de reunión',
  'dsh-live-voice.settings.shortcuts.microphone': 'Activar/desactivar micrófono',
  'dsh-live-voice.settings.shortcuts.record': 'Haz clic para definir',
  'dsh-live-voice.settings.shortcuts.recording':
    'Pulsa un atajo… Suelta para guardar. Escape cancela.',
  'dsh-live-voice.settings.sourceNames.help':
    'Cuando ambas fuentes capturan, estos nombres etiquetan nuevos bloques de transcripción, no participantes individuales. Se guardan al salir del campo; vacío restaura Me / Them. Máximo 80 caracteres. El texto existente no cambia.',
  'dsh-live-voice.settings.sourceNames.microphone': 'Nombre de la fuente del micrófono',
  'dsh-live-voice.settings.sourceNames.shared': 'Nombre de la fuente del audio compartido',
  'dsh-live-voice.settings.sourceNames.title': 'Nombres de fuentes de la reunión',
  'dsh-live-voice.settings.tabs.conversation': 'Conversación',
  'dsh-live-voice.settings.tabs.recognition': 'Reconocimiento de voz',
  'dsh-live-voice.settings.tabs.speak': 'Síntesis de voz',
  'dsh-live-voice.settings.title': 'Configuración de Voz en vivo',
  'dsh-live-voice.settings.whisper.hostHelp':
    'Configuración para todo el host. Solo se permiten URL HTTP sin autenticación en la interfaz de bucle local (localhost, 127.0.0.1, [::1]). El bucle local se refiere al host de DSH, no a este navegador. Todas las comprobaciones de estado y solicitudes de audio pasan por el servidor con autenticación.',
  'dsh-live-voice.speak.agentContext.enabled': 'Activar el contexto de voz del agente',
  'dsh-live-voice.speak.agentContext.enabledHelp':
    'Cuando está activado, el contexto siguiente informa al agente que sus respuestas se leerán en voz alta.',
  'dsh-live-voice.speak.agentContext.help':
    'Esta instrucción en inglés se envía al agente solo durante una conversación de voz activa con habla automática del asistente activada.',
  'dsh-live-voice.speak.agentContext.label': 'Contexto de voz del agente',
  'dsh-live-voice.speak.agentContext.restore': 'Restaurar predeterminado',
  'dsh-live-voice.speak.autoPlayback.disable': 'Desactivar voz automática del asistente',
  'dsh-live-voice.speak.autoPlayback.enable': 'Activar voz automática del asistente',
  'dsh-live-voice.speak.autoPlayback.enabled':
    'Leer automáticamente los nuevos mensajes del asistente en voz alta',
  'dsh-live-voice.speak.autoPlayback.help':
    'Los nuevos mensajes del asistente se leen automáticamente, incluso con el micrófono apagado. La reproducción espera mientras hablas.',
  'dsh-live-voice.speak.autoPlayback.label': 'Lectura automática del asistente',
  'dsh-live-voice.speak.autoPlayback.nextMode':
    'Siguiente modo: {mode}. Haz clic derecho para elegir el dispositivo de audio.',
  'dsh-live-voice.speak.autoPlayback.remainingOne':
    'Lectura automática del asistente: {state} — queda {count} segmento de voz',
  'dsh-live-voice.speak.autoPlayback.remainingOther':
    'Lectura automática del asistente: {state} — quedan {count} segmentos de voz',
  'dsh-live-voice.speak.autoPlayback.status': 'Lectura automática del asistente: {state}',
  'dsh-live-voice.speak.browser.automaticVoice': 'Voz local automática',
  'dsh-live-voice.speak.browser.defaultVoice': 'predeterminada',
  'dsh-live-voice.speak.browser.label': 'Síntesis de voz del navegador · audio en este dispositivo',
  'dsh-live-voice.speak.browser.name': 'Síntesis de voz del navegador',
  'dsh-live-voice.speak.browser.outputHelp':
    'La síntesis de voz del navegador puede ignorar el dispositivo de salida seleccionado; esta API del navegador normalmente utiliza el predeterminado del sistema.',
  'dsh-live-voice.speak.browser.voice': 'Voz local del navegador',
  'dsh-live-voice.speak.captions.approximate': 'Subtítulos de voz aproximados',
  'dsh-live-voice.speak.captions.loading': 'Preparando audio de voz',
  'dsh-live-voice.speak.captions.position': 'Fragmento de voz {index} de {total}',
  'dsh-live-voice.speak.captions.progress': 'Progreso aproximado de voz',
  'dsh-live-voice.speak.captions.title': 'Voz y subtítulos en vivo',
  'dsh-live-voice.speak.engine.label': 'Motor de síntesis de voz',
  'dsh-live-voice.speak.engine.playbackHelp':
    'Qwen y macOS say sintetizan en el host de DSH; el audio AAC/M4A compacto se reproduce en este navegador. La voz del navegador se sintetiza y reproduce en este dispositivo.',
  'dsh-live-voice.speak.filters.code.enabled':
    'Filtrar los bloques de código Markdown antes de leer en voz alta',
  'dsh-live-voice.speak.filters.code.maxLines':
    'Máximo de líneas de los bloques de código que se leerán',
  'dsh-live-voice.speak.filters.code.notice': 'Mira el código en nuestra conversación',
  'dsh-live-voice.speak.filters.code.replacement':
    'Frase de reemplazo para los bloques de código más largos',
  'dsh-live-voice.speak.interruption.disabledHelp':
    'Enviar otro mensaje no detiene el audio del asistente que ya estás escuchando.',
  'dsh-live-voice.speak.interruption.enabled':
    'Detener la lectura en voz alta del asistente cuando envíe un mensaje',
  'dsh-live-voice.speak.interruption.enabledHelp':
    'Enviar un nuevo mensaje de usuario, incluso al agente en ejecución, detiene la lectura en voz alta del asistente, tanto si está reproduciéndose como si está en pausa.',
  'dsh-live-voice.speak.macos.label': 'macOS say · audio en el host',
  'dsh-live-voice.speak.macos.name': 'macOS say',
  'dsh-live-voice.speak.macos.voice': 'Voz de macOS say',
  'dsh-live-voice.speak.macos.voiceHelp':
    'Introduce el nombre exacto de la voz usado por say -v. Déjalo vacío para usar la voz predeterminada de macOS. Lista las voces del host en Terminal con say -v "?".',
  'dsh-live-voice.speak.output.checking': 'Comprobando la salida de voz…',
  'dsh-live-voice.speak.output.device': 'Dispositivo de salida',
  'dsh-live-voice.speak.output.fallbackName': 'Salida de audio',
  'dsh-live-voice.speak.output.stopTest': 'Detener la prueba de voz',
  'dsh-live-voice.speak.output.test': 'Probar la salida de voz seleccionada',
  'dsh-live-voice.speak.output.testPhrase':
    'DSH Voz en vivo. La salida de voz seleccionada funciona.',
  'dsh-live-voice.speak.output.testing': 'Probando la voz…',
  'dsh-live-voice.speak.playback.message': 'Leer el mensaje en voz alta',
  'dsh-live-voice.speak.playback.next': 'Saltar al siguiente segmento de voz',
  'dsh-live-voice.speak.playback.pause': 'Pausar la lectura en voz alta',
  'dsh-live-voice.speak.playback.previous': 'Fragmento de voz anterior',
  'dsh-live-voice.speak.playback.resume': 'Reanudar la lectura en voz alta',
  'dsh-live-voice.speak.playback.stop': 'Detener la lectura en voz alta',
  'dsh-live-voice.speak.playback.stopAll': 'Detener toda la lectura en voz alta',
  'dsh-live-voice.speak.qwen.connection': 'Conexión al servidor Qwen',
  'dsh-live-voice.speak.qwen.endpoint': 'URL base de la API de Qwen',
  'dsh-live-voice.speak.qwen.healthFailed': 'Ha fallado la comprobación de estado de Qwen.',
  'dsh-live-voice.speak.qwen.label': 'Qwen3 TTS · servidor MLX local',
  'dsh-live-voice.speak.qwen.name': 'Qwen3 local',
  'dsh-live-voice.speak.qwen.requestFailed': 'Ha fallado la solicitud de configuración de Qwen.',
  'dsh-live-voice.speak.qwen.restartRequired':
    'Las rutas de configuración de Qwen no están cargadas. Es necesario reiniciar normalmente el servidor DSH para cargar las rutas actualizadas del complemento; no basta con actualizar esta página.',
  'dsh-live-voice.speak.qwen.save': 'Guardar la configuración de Qwen',
  'dsh-live-voice.speak.qwen.saved':
    'Guardado en el host de DSH. Se han cancelado las solicitudes activas de Qwen.',
  'dsh-live-voice.speak.qwen.signInRequired':
    'Inicia sesión en DSH para gestionar la configuración de Qwen.',
  'dsh-live-voice.speak.qwen.test': 'Probar el servidor Qwen',
  'dsh-live-voice.speak.qwen.voice': 'Voz de Qwen',
  'dsh-live-voice.speak.qwen.voiceHelp':
    'Aiden se utiliza de forma predeterminada. Estas voces predefinidas no son voces nativas de portugués brasileño.',
  'dsh-live-voice.speak.qwen.voices.aiden': 'Aiden — masculino, inglés estadounidense',
  'dsh-live-voice.speak.qwen.voices.dylan': 'Dylan — masculino, chino de Pekín',
  'dsh-live-voice.speak.qwen.voices.eric': 'Eric — masculino, chino de Sichuan',
  'dsh-live-voice.speak.qwen.voices.onoAnna': 'Ono Anna — femenino, japonés',
  'dsh-live-voice.speak.qwen.voices.ryan': 'Ryan — masculino, inglés',
  'dsh-live-voice.speak.qwen.voices.serena': 'Serena — femenino, chino',
  'dsh-live-voice.speak.qwen.voices.sohee': 'Sohee — femenino, coreano',
  'dsh-live-voice.speak.qwen.voices.uncleFu': 'Uncle Fu — masculino, chino',
  'dsh-live-voice.speak.qwen.voices.vivian': 'Vivian — femenino, chino',
  'dsh-live-voice.speak.rate.help': 'Velocidad relativa: 1 es la velocidad normal.',
  'dsh-live-voice.speak.rate.label': 'Velocidad de habla',
  'dsh-live-voice.speak.responseDelay.help':
    'Cuando dejas de hablar, la reproducción automática del asistente espera este intervalo de silencio continuo. Si vuelves a hablar, la espera se reinicia.',
  'dsh-live-voice.speak.responseDelay.label': 'Demora de respuesta del asistente',
  'dsh-live-voice.speak.responseDelay.oneAndHalf': '1,5 segundos',
  'dsh-live-voice.speak.segmentGap.help':
    'Espera esta cantidad de milisegundos entre segmentos hablados consecutivos. El valor predeterminado es 400 ms.',
  'dsh-live-voice.speak.segmentGap.label': 'Pausa entre segmentos de voz',
  'dsh-live-voice.speak.status.paused': 'Lectura en pausa',
  'dsh-live-voice.speak.status.playing': 'Hablando',
  'dsh-live-voice.speak.volume.help':
    'Solo reproducción de voz: 0% es silencio; 100% es el volumen máximo (predeterminado). El micrófono no cambia. En Browser, los cambios se aplican desde el siguiente segmento.',
  'dsh-live-voice.speak.volume.label': 'Volumen de voz',
};

export default Object.freeze(es);
