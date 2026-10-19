import type { LiveVoiceTranslation } from './base.js';

const fr: LiveVoiceTranslation = {
  'dsh-live-voice.commons.connection.contactingHost': 'Connexion à l’hôte DSH…',
  'dsh-live-voice.commons.connection.endpoint': 'URL du point d’accès',
  'dsh-live-voice.commons.connection.healthEndpoint': 'URL ou chemin de vérification de l’état',
  'dsh-live-voice.commons.connection.reload': 'Recharger les paramètres enregistrés',
  'dsh-live-voice.commons.connection.test': 'Tester la connexion',
  'dsh-live-voice.commons.connection.timeout': 'Délai d’expiration des requêtes (ms)',
  'dsh-live-voice.commons.connection.title': 'Paramètres de connexion',
  'dsh-live-voice.commons.connection.unsaved': 'Modifications non enregistrées',
  'dsh-live-voice.commons.controls.title': 'Contrôles vocaux',
  'dsh-live-voice.commons.conversation.end': 'Terminer la conversation vocale',
  'dsh-live-voice.commons.conversation.idle': 'Conversation inactive',
  'dsh-live-voice.commons.conversation.start': 'Démarrer une conversation vocale',
  'dsh-live-voice.commons.delivery.queueBadge': 'FILE',
  'dsh-live-voice.commons.device.numberedLabel': '{device} {number}',
  'dsh-live-voice.commons.dismiss': 'Fermer',
  'dsh-live-voice.commons.dismissError': 'Masquer l’erreur vocale',
  'dsh-live-voice.commons.engine.failure': '{engine} : {reason}',
  'dsh-live-voice.commons.input.ignoring': 'entrée ignorée',
  'dsh-live-voice.commons.input.ignoringBadge': 'ENTRÉE IGNORÉE',
  'dsh-live-voice.commons.input.listening': 'à l’écoute',
  'dsh-live-voice.commons.input.listeningBadge': 'À L’ÉCOUTE',
  'dsh-live-voice.commons.manual': 'manuel',
  'dsh-live-voice.commons.milliseconds': '{milliseconds} ms',
  'dsh-live-voice.commons.off': 'désactivé',
  'dsh-live-voice.commons.on': 'activé',
  'dsh-live-voice.commons.pluginName': 'Voix en direct',
  'dsh-live-voice.commons.queue': 'file d’attente',
  'dsh-live-voice.commons.repository.starLabel': 'Soutenez-nous avec une étoile sur GitHub',
  'dsh-live-voice.commons.repository.starLink':
    'Attribuer une étoile à DSH Voix en direct sur GitHub',
  'dsh-live-voice.commons.second': '1 seconde',
  'dsh-live-voice.commons.seconds': '{seconds} secondes',
  'dsh-live-voice.commons.send': 'ENVOYER',
  'dsh-live-voice.commons.status.ready': 'Fonctions vocales prêtes',
  'dsh-live-voice.commons.systemDefault': 'Valeur par défaut du système',
  'dsh-live-voice.commons.toggle.offBadge': 'DÉSACTIVÉ',
  'dsh-live-voice.commons.unknownLanguage': 'langue inconnue',
  'dsh-live-voice.commons.update.busy':
    'Arrêtez la capture et la lecture vocales avant la mise à jour.',
  'dsh-live-voice.commons.update.cancel': 'Annuler',
  'dsh-live-voice.commons.update.confirm':
    'Installer Voix en direct {version} dans ce profil DSH ? Le téléchargement nécessite le réseau. Redémarrez DSH ensuite si demandé ; rien ne redémarre automatiquement.',
  'dsh-live-voice.commons.update.current':
    'Cette version est déjà installée. Redémarrez DSH pour l’utiliser.',
  'dsh-live-voice.commons.update.delayed':
    'La version demandée n’est pas encore disponible pour ce profil. La publication ou le minimumReleaseAge de pnpm peut la retarder. Patientez puis consultez le gestionnaire DSH ; aucune règle de sécurité n’a été contournée.',
  'dsh-live-voice.commons.update.done':
    'Voix en direct {version} installé. Rechargez la page quand vous le souhaitez.',
  'dsh-live-voice.commons.update.failed':
    'Échec de mise à jour. La version n’est peut-être pas encore sur npm. Consultez le gestionnaire de plugins DSH.',
  'dsh-live-voice.commons.update.incompatible':
    'Cette version est incompatible avec le DSH en cours. Consultez le gestionnaire de plugins et utilisez des versions compatibles de DSH et du plugin ; aucune dérogation n’a été accordée.',
  'dsh-live-voice.commons.update.installing': 'Mise à jour…',
  'dsh-live-voice.commons.update.label': 'Mise à jour disponible',
  'dsh-live-voice.commons.update.link':
    'Mise à jour disponible : {version}. Ouvrir la page de cette version',
  'dsh-live-voice.commons.update.local':
    'Installation locale, Git ou personnalisée. Utilisez la méthode d’installation d’origine.',
  'dsh-live-voice.commons.update.now': 'Mettre à jour',
  'dsh-live-voice.commons.update.restart':
    'Voix en direct {version} installé. Redémarrez DSH quand vous le souhaitez, puis rechargez cette page.',
  'dsh-live-voice.commons.update.scripts':
    'Les scripts nécessitent une autorisation. Vérifiez-les dans le gestionnaire DSH ; aucun script n’a été autorisé ici.',
  'dsh-live-voice.commons.update.unavailable':
    'Mise à jour indisponible pour ce profil ou cette version de DSH. Utilisez le gestionnaire de plugins.',
  'dsh-live-voice.commons.update.uncertain':
    'Résultat d’installation inconnu. Consultez le gestionnaire DSH avant de réessayer.',
  'dsh-live-voice.commons.update.version': 'Mise à jour disponible : {version}',
  'dsh-live-voice.commons.version.compatibility': 'Compatible avec DSH v{version}',
  'dsh-live-voice.commons.version.compatibilityLink':
    'Compatible avec DSH v{version}. Ouvrir la page de cette version',
  'dsh-live-voice.commons.version.label': 'DSH Voix en direct v{version}',
  'dsh-live-voice.commons.version.link':
    'DSH Voix en direct v{version}. Ouvrir la liste des versions',
  'dsh-live-voice.commons.version.title': 'Informations de version',
  'dsh-live-voice.debugger.applied':
    'Le débogueur {version} est installé et DSH l’a appliqué. En attente de l’enregistrement des diagnostics sur cette page. S’ils restent indisponibles, consultez le gestionnaire de plugins DSH ; rien ne se recharge automatiquement.',
  'dsh-live-voice.debugger.busy':
    'Arrêtez la capture vocale, la transcription et la lecture avant l’installation.',
  'dsh-live-voice.debugger.close': 'Fermer',
  'dsh-live-voice.debugger.confirm':
    'Installer dsh-live-voice-debugger {version} et l’activer dans ce profil DSH ? Le téléchargement depuis le registre de paquets nécessite un accès réseau. Redémarrez DSH uniquement si le gestionnaire le demande. Aucun redémarrage ni rechargement automatique. Ne modifiez pas cette dépendance depuis un autre gestionnaire ou CLI pendant l’installation.',
  'dsh-live-voice.debugger.description':
    'Les diagnostics et la gestion des sessions enregistrées nécessitent le plugin facultatif dsh-live-voice-debugger. Il permet d’inspecter l’état et les files, de parcourir les enregistrements, d’écouter l’audio, de consulter les transcriptions et erreurs, d’exporter les sessions et de supprimer les enregistrements terminés. Voix en direct et l’enregistrement fonctionnent sans lui.',
  'dsh-live-voice.debugger.failed':
    'L’installation a échoué ou a été annulée. Consultez le gestionnaire de plugins DSH avant de continuer ; aucune nouvelle tentative ne sera lancée ici.',
  'dsh-live-voice.debugger.installNow': 'Installer maintenant',
  'dsh-live-voice.debugger.installed':
    'Le débogueur est déjà installé, mais indisponible sur cette page. Vérifiez son activation et les erreurs de chargement dans le gestionnaire de plugins DSH. Redémarrez DSH uniquement sur demande ; cette boîte de dialogue ne le réinstallera pas.',
  'dsh-live-voice.debugger.installing': 'Vérification ou installation du débogueur…',
  'dsh-live-voice.debugger.label': 'Diagnostics',
  'dsh-live-voice.debugger.local':
    'Une dépendance locale, Git ou personnalisée du débogueur existe déjà. Gérez-la avec sa méthode d’installation d’origine ; elle ne sera pas remplacée ici.',
  'dsh-live-voice.debugger.ready':
    'Les diagnostics sont prêts. Fermez cette boîte de dialogue et cliquez sur Diagnostics pour ouvrir le débogueur.',
  'dsh-live-voice.debugger.restart':
    'Le débogueur {version} est installé. Le gestionnaire DSH exige un redémarrage. Redémarrez DSH lorsque vous êtes prêt, puis rechargez cette page. Rien ne redémarre automatiquement.',
  'dsh-live-voice.debugger.scripts':
    'Les scripts du paquet nécessitent une approbation. Examinez-les dans le gestionnaire de plugins DSH ; aucun script n’a été approuvé et aucune nouvelle tentative ne sera lancée ici.',
  'dsh-live-voice.debugger.title': 'Diagnostics et sessions enregistrées',
  'dsh-live-voice.debugger.unavailable':
    'L’installation est indisponible pour ce profil ou cette version de DSH. Utilisez le gestionnaire de plugins DSH.',
  'dsh-live-voice.debugger.uncertain':
    'Le résultat de l’installation est inconnu. Consultez le gestionnaire de plugins DSH avant de continuer ; aucune nouvelle tentative ne sera lancée ici.',
  'dsh-live-voice.meeting.actions': 'Actions de réunion',
  'dsh-live-voice.meeting.attendee.admissionUnknown':
    'L’admission dans la réunion n’est pas confirmée.',
  'dsh-live-voice.meeting.attendee.advanced': 'Connexion avancée',
  'dsh-live-voice.meeting.attendee.aliasHelp':
    'Les alias concernent uniquement cette connexion et le texte futur. Ils ne modifient pas les noms dans la réunion.',
  'dsh-live-voice.meeting.attendee.apiKey': "Clé API",
  'dsh-live-voice.meeting.attendee.apiUrl': 'URL API Attendee locale',
  'dsh-live-voice.meeting.attendee.automaticReceiver': 'Récepteur détecté par DSH',
  'dsh-live-voice.meeting.attendee.botId': 'ID du bot (facultatif ; lie le premier)',
  'dsh-live-voice.meeting.attendee.botName': 'Nom du bot dans la réunion',
  'dsh-live-voice.meeting.attendee.configureConnection': 'Configurer la connexion Attendee',
  'dsh-live-voice.meeting.attendee.confirmRelease': 'Abandonner le contrôle sans quitter',
  'dsh-live-voice.meeting.attendee.connected': 'Connecté à Attendee',
  'dsh-live-voice.meeting.attendee.connecting': 'Ouverture du récepteur…',
  'dsh-live-voice.meeting.attendee.connection': 'Paramètres de connexion',
  'dsh-live-voice.meeting.attendee.controlExpired':
    'Le contrôle du bot a expiré. Il peut encore être dans la réunion ; vérifiez Attendee.',
  'dsh-live-voice.meeting.attendee.controlReleased':
    'Contrôle abandonné, sans demande de départ. Vérifiez le bot dans Attendee.',
  'dsh-live-voice.meeting.attendee.controlUnavailable':
    'Contrôle du bot indisponible. L’état de la réunion est inconnu ; vérifiez Attendee.',
  'dsh-live-voice.meeting.attendee.controlUnknown':
    'État du bot inconnu. Vérifiez Attendee avant de créer un autre bot.',
  'dsh-live-voice.meeting.attendee.copy': 'Copier',
  'dsh-live-voice.meeting.attendee.credentialCancel': "Annuler",
  'dsh-live-voice.meeting.attendee.credentialChecking': "Vérification de la clé API enregistrée",
  'dsh-live-voice.meeting.attendee.credentialHelp': "Connecter enregistre la clé saisie pour cette origine API et la réutilise ensuite. L’hôte la stocke en clair dans un fichier 0600, sans chiffrement du système. Elle est partagée par les navigateurs authentifiés de cet hôte et jamais renvoyée au navigateur. La supprimer ne termine pas le contrôle actuel du bot.",
  'dsh-live-voice.meeting.attendee.credentialInvalid': "Le stockage des clés est invalide. Réparez ou supprimez le fichier des identifiants du serveur avant de réessayer.",
  'dsh-live-voice.meeting.attendee.credentialMissing': "Aucune clé API pour cette origine. Saisissez-la une fois puis connectez-vous.",
  'dsh-live-voice.meeting.attendee.credentialNotSaved': "Clé API non configurée sur cet hôte",
  'dsh-live-voice.meeting.attendee.credentialRemove': "Supprimer la clé API enregistrée",
  'dsh-live-voice.meeting.attendee.credentialRemoveConfirm': "Supprimer la clé enregistrée",
  'dsh-live-voice.meeting.attendee.credentialRemoveWarning': "Supprimer la clé de cette origine ? La réception et le contrôle actuels gardent leur identifiant ; cela ne demande pas le départ.",
  'dsh-live-voice.meeting.attendee.credentialSaved': "Clé API configurée sur cet hôte",
  'dsh-live-voice.meeting.attendee.credentialUnavailable': "Le stockage des clés est indisponible. Vérifiez les permissions de l’hôte et réessayez.",
  'dsh-live-voice.meeting.attendee.currentBot': 'Dernier bot connu',
  'dsh-live-voice.meeting.attendee.defaultBotName': 'Nom du bot par défaut',
  'dsh-live-voice.meeting.attendee.departureRequested':
    'Départ demandé ; le retrait de la réunion n’est pas confirmé.',
  'dsh-live-voice.meeting.attendee.failed':
    'Récepteur arrêté. Vérifiez TLS, identifiants, participants, limites et moteur de reconnaissance avant de reconnecter.',
  'dsh-live-voice.meeting.attendee.help':
    'Connectez Attendee local, collez le lien, choisissez le nom du bot et demandez à rejoindre. Les personnes apparaissent ici avec des barres audio indépendantes. Nécessite STT HTTP ou local dans le navigateur, pas la reconnaissance native. La clé n’est pas enregistrée. Les réglages de stockage audio restent applicables.',
  'dsh-live-voice.meeting.attendee.ingressUrl': 'URL WSS de confiance du récepteur',
  'dsh-live-voice.meeting.attendee.invalidMeeting': 'Saisissez un lien Google Meet valide.',
  'dsh-live-voice.meeting.attendee.join': 'Rejoindre la réunion',
  'dsh-live-voice.meeting.attendee.joinFailed':
    'Le résultat peut être inconnu. Vérifiez Attendee avant de reconnecter ou de créer un autre bot.',
  'dsh-live-voice.meeting.attendee.joinHelp':
    'Crée un bot avec le nom et la destination audio choisis. L’organisateur peut devoir l’admettre. Déconnecter DSH ne retire pas le bot : utilisez Quitter la réunion.',
  'dsh-live-voice.meeting.attendee.joining': 'Demande d’entrée…',
  'dsh-live-voice.meeting.attendee.leave': 'Quitter la réunion',
  'dsh-live-voice.meeting.attendee.leaveFailed':
    'Impossible de confirmer la demande de départ. Le bot peut rester ; réessayez Quitter la réunion ou vérifiez Attendee.',
  'dsh-live-voice.meeting.attendee.leaving': 'Demande de départ…',
  'dsh-live-voice.meeting.attendee.meetingUrl': 'Lien Google Meet',
  'dsh-live-voice.meeting.attendee.noParticipants': 'En attente de détection des participants',
  'dsh-live-voice.meeting.attendee.participant': 'Participant {number}',
  'dsh-live-voice.meeting.attendee.participants': 'Personnes dans la réunion',
  'dsh-live-voice.meeting.attendee.receiverInactive': 'Récepteur audio déconnecté',
  'dsh-live-voice.meeting.attendee.receiverUrl': 'URL du récepteur (secrète)',
  'dsh-live-voice.meeting.attendee.recognitionRequired':
    'Choisissez Whisper HTTP, Qwen HTTP ou un modèle STT local au navigateur dans les paramètres avant de connecter.',
  'dsh-live-voice.meeting.attendee.relayUnavailable':
    'La passerelle audio Compose est indisponible. Démarrez Attendee avec le complément audio DSH, puis reconnectez.',
  'dsh-live-voice.meeting.attendee.releaseControl': 'Abandonner le contrôle du bot…',
  'dsh-live-voice.meeting.attendee.releaseWarning':
    'Abandonner le contrôle ne retire pas le bot de la réunion. L’action Quitter ne sera plus disponible ici. Continuez uniquement après vérification dans Attendee.',
  'dsh-live-voice.meeting.attendee.settingsHelp':
    "Configurez ici l’origine API locale. Saisissez la clé du projet une fois puis connectez-vous ; les prochaines connexions réutilisent la clé enregistrée sur l’hôte pour cette origine. Rejoignez la réunion depuis le champ de message.",
  'dsh-live-voice.meeting.attendee.start': 'Connecter à Attendee',
  'dsh-live-voice.meeting.attendee.stop': 'Déconnecter d’Attendee',
  'dsh-live-voice.meeting.attendee.title': 'Audio par personne (Attendee · expérimental)',
  'dsh-live-voice.meeting.attendee.tlsNeeded':
    'DSH n’a pas encore de récepteur WSS de confiance. Configurez HTTPS ou un proxy WSS de confiance dans la connexion avancée avant de rejoindre.',
  'dsh-live-voice.meeting.attendee.waiting':
    'Récepteur ouvert ; configurez un nouveau bot avec cette URL.',
  'dsh-live-voice.meeting.browserLocalUnavailable':
    'La reconnaissance locale du navigateur est indisponible pour cette langue. Installez son pack linguistique ou désactivez explicitement le traitement uniquement local dans les paramètres pour autoriser le service du navigateur.',
  'dsh-live-voice.meeting.browserSharedUnsupported':
    'Ce navigateur ne peut pas reconnaître l’audio partagé en toute sécurité. Choisissez Qwen ou Whisper HTTP pour l’audio partagé.',
  'dsh-live-voice.meeting.failed': 'Échec de reconnaissance.',
  'dsh-live-voice.meeting.help':
    'Sources indépendantes ; envoyez les transcriptions manuellement depuis l’éditeur.',
  'dsh-live-voice.meeting.inactive': 'Inactif',
  'dsh-live-voice.meeting.joinMeet': 'Rejoindre Google Meet · expérimental',
  'dsh-live-voice.meeting.listening': 'Écoute',
  'dsh-live-voice.meeting.microphone': 'Microphone',
  'dsh-live-voice.meeting.noAudio':
    'Aucun audio partagé. Activez l’audio dans la fenêtre de partage.',
  'dsh-live-voice.meeting.processing': 'Transcription…',
  'dsh-live-voice.meeting.shareTab': 'Partager l’audio d’un onglet',
  'dsh-live-voice.meeting.shared': 'Audio partagé',
  'dsh-live-voice.meeting.start': 'Démarrer la source',
  'dsh-live-voice.meeting.startShared': 'Démarrer le partage audio',
  'dsh-live-voice.meeting.starting': 'Démarrage…',
  'dsh-live-voice.meeting.stop': 'Arrêter la source',
  'dsh-live-voice.meeting.stopShared': 'Arrêter le partage audio',
  'dsh-live-voice.meeting.timestamps': 'Horodatage des transcriptions',
  'dsh-live-voice.meeting.timestampsBadge': 'Horodatage',
  'dsh-live-voice.meeting.title': 'Mode réunion',
  'dsh-live-voice.meeting.unavailable': 'Reconnaissance indisponible.',
  'dsh-live-voice.recognition.autoSend.countdownHelp':
    'Le compte à rebours démarre après la reconnaissance définitive d’une phrase. Toute nouvelle parole ou modification l’annule.',
  'dsh-live-voice.recognition.browser.autoInstallPack':
    'Installer automatiquement ce pack linguistique du navigateur si nécessaire',
  'dsh-live-voice.recognition.browser.help':
    'Utilise l’API SpeechRecognition du navigateur. Il s’agit de l’option par défaut.',
  'dsh-live-voice.recognition.browser.label': 'SpeechRecognition du navigateur · Option par défaut',
  'dsh-live-voice.recognition.browser.localProcessing':
    'Effectuer la reconnaissance localement sur cet appareil',
  'dsh-live-voice.recognition.browser.microphoneHelp':
    'SpeechRecognition peut utiliser le microphone par défaut du navigateur ou du système plutôt que celui sélectionné ici.',
  'dsh-live-voice.recognition.browser.remoteServiceWarning':
    'La reconnaissance via le service du navigateur est activée. Le navigateur peut envoyer le son du microphone à son service de reconnaissance.',
  'dsh-live-voice.recognition.commands.addPhrase': 'Ajouter une phrase…',
  'dsh-live-voice.recognition.commands.clear': 'Vider la zone de rédaction',
  'dsh-live-voice.recognition.commands.enabled':
    'Activer les commandes vocales par correspondance exacte',
  'dsh-live-voice.recognition.commands.end': 'Terminer la conversation',
  'dsh-live-voice.recognition.commands.mute':
    'Suspendre la saisie vocale dans la zone de rédaction',
  'dsh-live-voice.recognition.commands.queue': 'Mettre en file d’attente',
  'dsh-live-voice.recognition.commands.removePhrase': 'Supprimer la phrase',
  'dsh-live-voice.recognition.commands.resume':
    'Reprendre la saisie vocale dans la zone de rédaction',
  'dsh-live-voice.recognition.commands.send': 'Envoyer à l’agent en cours d’exécution',
  'dsh-live-voice.recognition.commands.stopSpeech': 'Arrêter la lecture vocale de l’assistant',
  'dsh-live-voice.recognition.commands.title': 'Commandes vocales',
  'dsh-live-voice.recognition.context.hint':
    'Contexte et vocabulaire facultatifs envoyés comme prompt au service vocal HTTP sélectionné avec chaque segment audio. Enregistré à la sortie du champ. La prise en charge dépend du serveur ; ne limite pas les langues et ne garantit pas le suivi des consignes. Laissez vide pour ne pas envoyer de contexte.',
  'dsh-live-voice.recognition.context.label': 'Contexte de transcription',
  'dsh-live-voice.recognition.context.placeholder':
    'Native Brazilian Portuguese speaker who frequently uses technical terms in English.',
  'dsh-live-voice.recognition.dictation.cancel': 'Annuler la dictée',
  'dsh-live-voice.recognition.engine.label': 'Moteur de reconnaissance',
  'dsh-live-voice.recognition.headphoneMode.help':
    'Le microphone reste ouvert pendant la lecture. La parole reconnue sans écho peut la mettre en pause après le délai configuré ; elle reprend lorsque le microphone et le son partagé restent silencieux pendant ce délai. Une pause manuelle nécessite Reprendre.',
  'dsh-live-voice.recognition.headphoneMode.label': 'Casque — microphone ouvert',
  'dsh-live-voice.recognition.holdToTalk.enabled': 'Maintenir pour parler',
  'dsh-live-voice.recognition.holdToTalk.help':
    'Lorsqu’une zone de rédaction est ouverte, maintenez le raccourci configuré n’importe où sur la page pour capturer votre voix. Relâchez-le pour traiter la transcription en attente, attendre le délai d’envoi configuré, mettre le message en file d’attente et arrêter la capture vocale. Appuyez sur Échap pendant le maintien pour annuler.',
  'dsh-live-voice.recognition.language.automatic': 'Automatique — détecter la langue',
  'dsh-live-voice.recognition.language.label': 'Langue de reconnaissance',
  'dsh-live-voice.recognition.language.options.chinese': 'Chinois (mandarin)',
  'dsh-live-voice.recognition.language.options.french': 'Français',
  'dsh-live-voice.recognition.language.options.spanish': 'Espagnol',
  'dsh-live-voice.recognition.local.cancel': 'Annuler',
  'dsh-live-voice.recognition.local.confirm': 'Confirmer',
  'dsh-live-voice.recognition.local.confirmDownload':
    'Télécharger {model} ? Environ {size} seront stockés dans ce navigateur.',
  'dsh-live-voice.recognition.local.confirmRemove':
    'Supprimer {model} de ce navigateur ? Les enregistrements sont conservés.',
  'dsh-live-voice.recognition.local.confirmTitle':
    'Confirmer la modification du stockage des modèles',
  'dsh-live-voice.recognition.local.device': 'Environnement d’exécution',
  'dsh-live-voice.recognition.local.deviceHelp':
    'WebGPU nécessite un adaptateur GPU fonctionnel. Whisper propose une option explicite sur processeur avec WebAssembly, plus lente ; Qwen nécessite WebGPU. Aucun basculement automatique vers un autre environnement d’exécution ou vers HTTP.',
  'dsh-live-voice.recognition.local.download': 'Télécharger le modèle',
  'dsh-live-voice.recognition.local.error.cancelled':
    'Opération annulée. Téléchargez ou chargez le modèle lorsque vous souhaitez continuer.',
  'dsh-live-voice.recognition.local.error.download_failed':
    'Le téléchargement du modèle a échoué. Vérifiez votre connexion à Hugging Face et réessayez.',
  'dsh-live-voice.recognition.local.error.f16_unavailable':
    'Ce modèle nécessite WebGPU avec shader-f16. Choisissez un autre modèle Whisper ou un navigateur/appareil compatible.',
  'dsh-live-voice.recognition.local.error.failed':
    'L’opération sur le modèle a échoué. Vérifiez le stockage du navigateur et rechargez le modèle.',
  'dsh-live-voice.recognition.local.error.gpu_unavailable':
    'WebGPU est indisponible. Utilisez un navigateur avec un adaptateur GPU fonctionnel ou sélectionnez explicitement Whisper avec WebAssembly sur processeur.',
  'dsh-live-voice.recognition.local.error.inference_failed':
    'La transcription a échoué. Rechargez le modèle, puis réessayez avec un extrait audio plus court.',
  'dsh-live-voice.recognition.local.error.invalid_audio':
    'Cet audio ne peut pas être transcrit. Enregistrez un nouvel extrait et réessayez.',
  'dsh-live-voice.recognition.local.error.invalid_model':
    'Ce modèle n’est pas pris en charge. Sélectionnez un modèle dans la liste.',
  'dsh-live-voice.recognition.local.error.model_busy':
    'Le modèle est occupé. Attendez la fin de l’opération en cours et réessayez.',
  'dsh-live-voice.recognition.local.error.model_missing':
    'Des fichiers du modèle sont manquants ou ont été évincés du cache. Téléchargez à nouveau le modèle.',
  'dsh-live-voice.recognition.local.error.runtime_outdated':
    'Le navigateur a chargé un runtime vocal plus ancien que ces paramètres. Rechargez cette page pour charger le worker à jour. Si le problème persiste, rechargez le backend Voix en direct à jour dans DSH ; inutile de retélécharger le modèle.',
  'dsh-live-voice.recognition.local.error.runtime_unavailable':
    'L’environnement d’exécution du modèle est indisponible. Actualisez la page, vérifiez la compatibilité du navigateur et rechargez le modèle.',
  'dsh-live-voice.recognition.local.error.storage_full':
    'Le stockage du navigateur est plein. Libérez de l’espace ou supprimez les modèles inutilisés, puis réessayez.',
  'dsh-live-voice.recognition.local.error.storage_unavailable':
    'Le stockage du navigateur est indisponible. Autorisez le stockage du site dans un profil de navigation normal et réessayez.',
  'dsh-live-voice.recognition.local.help': 'À propos des modèles du navigateur',
  'dsh-live-voice.recognition.local.load': 'Charger le modèle',
  'dsh-live-voice.recognition.local.model': 'Modèle',
  'dsh-live-voice.recognition.local.modelCard': 'Détails du modèle',
  'dsh-live-voice.recognition.local.phase.absent':
    'Téléchargez votre premier modèle pour commencer la transcription locale.',
  'dsh-live-voice.recognition.local.phase.checking': 'Vérification des fichiers du modèle…',
  'dsh-live-voice.recognition.local.phase.downloaded':
    'Modèle téléchargé. Chargez-le pour commencer la transcription.',
  'dsh-live-voice.recognition.local.phase.downloading': 'Téléchargement du modèle…',
  'dsh-live-voice.recognition.local.phase.error':
    'Le modèle nécessite votre attention. Suivez les indications de l’erreur et réessayez.',
  'dsh-live-voice.recognition.local.phase.loading': 'Chargement du modèle…',
  'dsh-live-voice.recognition.local.phase.ready': 'Modèle prêt pour la transcription locale.',
  'dsh-live-voice.recognition.local.privacy':
    'Les téléchargements de modèles contactent Hugging Face. La parole est traitée dans ce navigateur et n’est pas envoyée à un service de transcription HTTP. L’application nécessite toujours DSH.',
  'dsh-live-voice.recognition.local.progress': 'Progression du téléchargement du modèle',
  'dsh-live-voice.recognition.local.qwenLabel': 'Qwen · Navigateur',
  'dsh-live-voice.recognition.local.recommended': 'recommandé',
  'dsh-live-voice.recognition.local.reload': 'Charger à nouveau',
  'dsh-live-voice.recognition.local.remove': 'Supprimer le modèle',
  'dsh-live-voice.recognition.local.space': 'Stockage disponible dans le navigateur : {size}',
  'dsh-live-voice.recognition.local.storageHelp':
    'Les modèles sont stockés dans ce profil de navigateur ; les caches peuvent être évincés. Les estimations d’espace disque excluent les ressources d’exécution et la consommation supplémentaire de GPU/RAM. La suppression concerne les fichiers du modèle, pas les sessions enregistrées.',
  'dsh-live-voice.recognition.local.title': 'Modèles du navigateur',
  'dsh-live-voice.recognition.local.whisperLabel': 'Whisper · Navigateur (recommandé)',
  'dsh-live-voice.recognition.manualSend.help':
    'Le texte reconnu reste dans la zone de rédaction jusqu’à ce que vous utilisiez le bouton d’envoi habituel de DSH.',
  'dsh-live-voice.recognition.maxUtterance.help':
    'Si vous parlez sans pause, un nouveau segment de transcription commence après cette durée. Valeur par défaut : 60 secondes.',
  'dsh-live-voice.recognition.maxUtterance.label': 'Durée maximale de parole continue (secondes)',
  'dsh-live-voice.recognition.microphone.checking':
    'Vérification de la disponibilité du microphone',
  'dsh-live-voice.recognition.microphone.device': 'Périphérique d’entrée',
  'dsh-live-voice.recognition.microphone.failure': 'Microphone : {reason}',
  'dsh-live-voice.recognition.microphone.ignore':
    'Ignorer la saisie vocale dans la zone de rédaction',
  'dsh-live-voice.recognition.microphone.inputStatus':
    'Entrée audio : {state}. Ignorer écarte la dictée, pas la capture : les interruptions vocales restent actives ; les commandes configurées fonctionnent si elles sont activées. Arrêtez la capture avec le bouton de la source dans le champ du message.',
  'dsh-live-voice.recognition.microphone.label': 'Microphone',
  'dsh-live-voice.recognition.microphone.permissionHelp':
    'L’autorisation d’utiliser le microphone ne sera demandée que lorsque vous démarrerez une dictée ou une conversation vocale.',
  'dsh-live-voice.recognition.microphone.resume': 'Reprendre l’écoute',
  'dsh-live-voice.recognition.microphone.starting': 'Démarrage du microphone',
  'dsh-live-voice.recognition.microphone.takeControl': 'Prendre le contrôle du microphone',
  'dsh-live-voice.recognition.minimumWords.enabled':
    'Ignorer les segments définitifs de transcription trop courts',
  'dsh-live-voice.recognition.minimumWords.help':
    'Les segments définitifs contenant moins de mots sont ignorés avant d’atteindre la zone de rédaction ou l’envoi automatique.',
  'dsh-live-voice.recognition.minimumWords.label': 'Nombre minimal de mots par segment définitif',
  'dsh-live-voice.recognition.mode.label': 'Mode d’écoute',
  'dsh-live-voice.recognition.planned.parakeet': 'NVIDIA Parakeet — Bientôt disponible',
  'dsh-live-voice.recognition.planned.sherpa': 'sherpa-onnx en continu — Bientôt disponible',
  'dsh-live-voice.recognition.planned.vote': 'Bientôt disponible — votez dans les tickets du dépôt',
  'dsh-live-voice.recognition.planned.voxtral': 'Voxtral Realtime — Bientôt disponible',
  'dsh-live-voice.recognition.planned.webGpu':
    'Inférence WebGPU dans le navigateur — Bientôt disponible',
  'dsh-live-voice.recognition.presets.custom.description':
    'Choisissez des pauses indépendantes pour les segments et les paragraphes.',
  'dsh-live-voice.recognition.presets.custom.label': 'Personnalisée',
  'dsh-live-voice.recognition.presets.long.description':
    'Attend pendant les pauses de réflexion plus longues.',
  'dsh-live-voice.recognition.presets.long.label': 'Longue',
  'dsh-live-voice.recognition.presets.natural.description':
    'Autorise des pauses normales entre les phrases.',
  'dsh-live-voice.recognition.presets.natural.label': 'Naturelle',
  'dsh-live-voice.recognition.presets.short.description':
    'Transcrit rapidement après une courte pause.',
  'dsh-live-voice.recognition.presets.short.label': 'Courte',
  'dsh-live-voice.recognition.providerSettings.help':
    'Les paramètres du fournisseur dépendent du moteur de reconnaissance sélectionné.',
  'dsh-live-voice.recognition.qwen.captureHelp':
    'Le son est découpé en énoncés complets au format WAV, puis envoyé via DSH avec authentification au modèle Qwen3 ASR exécuté localement sur l’hôte.',
  'dsh-live-voice.recognition.qwen.connectionSuccess':
    'Connexion réussie. Qwen ASR et TTS sont tous deux chargés. Les modifications non enregistrées n’ont pas été appliquées.',
  'dsh-live-voice.recognition.qwen.endpointHelp':
    'API HTTP à l’URL configurée sur l’hôte DSH (par défaut : http://127.0.0.1:8080/inference). Le son passe par la route de transcription authentifiée de l’hôte DSH.',
  'dsh-live-voice.recognition.qwen.hostHelp':
    'Paramètres communs à tout l’hôte pour le serveur Qwen3 ASR + TTS. Saisissez une URL de base HTTP ou HTTPS accessible depuis l’hôte DSH. Le navigateur y accède via les routes authentifiées de DSH.',
  'dsh-live-voice.recognition.qwen.label': 'Qwen3 ASR · API HTTP',
  'dsh-live-voice.recognition.silenceDetection.chunkPause':
    'Avant transcription : {milliseconds} ms',
  'dsh-live-voice.recognition.silenceDetection.customHelp':
    'Saisissez un entier de 100 à 10 000 ms. Enregistré en quittant le champ. Les pauses courtes peuvent couper la parole ; la reconnaissance ajoute sa propre latence.',
  'dsh-live-voice.recognition.silenceDetection.customLabel': 'Pause de segment (millisecondes)',
  'dsh-live-voice.recognition.silenceDetection.customParagraphHelp':
    'Silence avant un nouveau paragraphe dans le texte dicté (100–30 000 ms, nombres entiers). Enregistré en quittant le champ ; indépendant de la pause de segment et de l’envoi du message.',
  'dsh-live-voice.recognition.silenceDetection.customParagraphLabel':
    'Pause de paragraphe (millisecondes)',
  'dsh-live-voice.recognition.silenceDetection.detector.energy': 'Énergie audio',
  'dsh-live-voice.recognition.silenceDetection.detector.label': 'Détecteur vocal',
  'dsh-live-voice.recognition.silenceDetection.detector.silero':
    'Silero — expérimental (par défaut)',
  'dsh-live-voice.recognition.silenceDetection.duration':
    'Avant transcription : {milliseconds} ms · Nouveau paragraphe : {paragraphMilliseconds} ms',
  'dsh-live-voice.recognition.silenceDetection.help':
    'Détermine la durée de pause nécessaire avant que la parole capturée soit envoyée pour reconnaissance.',
  'dsh-live-voice.recognition.silenceDetection.label': 'Détection du silence et paragraphes',
  'dsh-live-voice.recognition.silenceDetection.minimumSpeech.help':
    'Durée minimale de parole détectée pour accepter une plage (50–2 000 ms). Les sons plus courts sont ignorés.',
  'dsh-live-voice.recognition.silenceDetection.minimumSpeech.label':
    'Parole minimale (millisecondes)',
  'dsh-live-voice.recognition.silenceDetection.paragraphPause':
    'Nouveau paragraphe : {milliseconds} ms',
  'dsh-live-voice.recognition.silenceDetection.pauseLabel': 'Pauses de segment et de paragraphe',
  'dsh-live-voice.recognition.silenceDetection.threshold.help':
    'Seuil d’activité vocale (0,05–0,95). Une valeur basse détecte les voix faibles, mais peut accepter plus de bruit.',
  'dsh-live-voice.recognition.silenceDetection.threshold.label': 'Seuil d’activité vocale',
  'dsh-live-voice.recognition.silenceDetection.title':
    'Paramètres de détection du silence et des paragraphes',
  'dsh-live-voice.recognition.silero.error.failed':
    'La détection vocale Silero a échoué. Sélectionnez Énergie audio dans les paramètres ou réessayez la capture.',
  'dsh-live-voice.recognition.silero.error.overloaded':
    'La détection vocale Silero est surchargée. Redémarrez la capture ou sélectionnez Énergie audio dans les paramètres.',
  'dsh-live-voice.recognition.silero.error.unavailable':
    'La détection vocale Silero est indisponible. Sélectionnez Énergie audio dans les paramètres ou réessayez la capture.',
  'dsh-live-voice.recognition.speakerMode.help':
    'La lecture libère le microphone pour réduire le retour des haut-parleurs. Prendre le microphone interrompt manuellement ; les participants reconnus sans écho dans le son partagé peuvent mettre la lecture en pause, puis elle reprend après un silence stable.',
  'dsh-live-voice.recognition.speakerMode.label': 'Haut-parleurs — écoute contrôlée',
  'dsh-live-voice.recognition.status.answer': 'Reconnaissance de la réponse',
  'dsh-live-voice.recognition.status.awaitingAnswer': 'Écoute de votre réponse',
  'dsh-live-voice.recognition.status.listening': 'Écoute',
  'dsh-live-voice.recognition.status.listeningProcessing': 'Écoute et transcription',
  'dsh-live-voice.recognition.status.processing': 'Transcription',
  'dsh-live-voice.recognition.status.unavailable': 'Reconnaissance vocale indisponible',
  'dsh-live-voice.recognition.status.waiting': 'En attente',
  'dsh-live-voice.recognition.status.waitingCommand': 'En attente de commande',
  'dsh-live-voice.recognition.voiceCommands.help':
    'Séparez les expressions par des virgules. La comparaison ignore la casse, les accents, la ponctuation et les espaces superflus. Le segment définitif entier doit correspondre.',
  'dsh-live-voice.recognition.whisper.captureHelp':
    'Le son est découpé en énoncés complets au format WAV, transmis via DSH avec authentification, puis traité par le serveur HTTP whisper.cpp sur l’interface de bouclage.',
  'dsh-live-voice.recognition.whisper.connectionSuccess':
    'Connexion réussie. Le point d’accès de vérification de l’état a répondu ; la transcription n’a pas été testée. Les modifications non enregistrées n’ont pas été appliquées.',
  'dsh-live-voice.recognition.whisper.endpointHelp':
    'API HTTP à l’URL de base configurée (par défaut : http://127.0.0.1:8080/). Compatible avec POST /v1/audio/transcriptions.',
  'dsh-live-voice.recognition.whisper.healthFailed':
    'La vérification de l’état de Whisper a échoué.',
  'dsh-live-voice.recognition.whisper.label': 'Whisper · API HTTP',
  'dsh-live-voice.recognition.whisper.requestFailed':
    'La requête relative aux paramètres de Whisper a échoué.',
  'dsh-live-voice.recognition.whisper.restartRequired':
    'Les routes de configuration de Whisper ne sont pas chargées. Un redémarrage normal du serveur DSH est nécessaire pour charger les routes mises à jour du plugin ; actualiser cette page ne suffit pas.',
  'dsh-live-voice.recognition.whisper.save': 'Enregistrer les paramètres de Whisper',
  'dsh-live-voice.recognition.whisper.saved':
    'Enregistré sur l’hôte DSH. Les requêtes de transcription actives sur l’hôte ont été annulées.',
  'dsh-live-voice.recognition.whisper.signInRequired':
    'Connectez-vous à DSH pour gérer les paramètres de Whisper.',
  'dsh-live-voice.recording.bitrate.help':
    'Débit cible du son compressé. Une valeur élevée utilise plus de stockage local.',
  'dsh-live-voice.recording.bitrate.label': 'Débit d’enregistrement',
  'dsh-live-voice.recording.bitrate.option': '{bitrate} kbit/s',
  'dsh-live-voice.recording.browserUnsupported':
    'La reconnaissance du navigateur ne prend pas en charge les enregistrements récupérables ni la transcription de plages enregistrées. Choisissez Qwen ou Whisper HTTP.',
  'dsh-live-voice.recording.durabilityWarning':
    'Le stockage local peut être saturé ou effacé ; la récupération n’est pas garantie. Si l’enregistrement échoue, la capture s’arrête pour éviter une perte de données silencieuse.',
  'dsh-live-voice.recording.enabled.help':
    'Activé par défaut. Désactivez pour ne pas sauvegarder localement le son récupérable pendant la capture.',
  'dsh-live-voice.recording.enabled.label': 'Sauvegarder des enregistrements récupérables',
  'dsh-live-voice.recording.error.failed':
    'L’enregistrement n’a pas pu être sauvegardé. La capture s’est arrêtée pour éviter une perte de données silencieuse.',
  'dsh-live-voice.recording.keepPrevious.help':
    "Conservez de 1 à 100 captures ordinaires par type de source ; Attendee conserve N groupes de réunion, les plus récents par activité de capture, avec tous les participants et toutes les rafales tant que le groupe est conservé. Écritures actives, écritures en attente et favoris protègent tout le groupe sans occuper de place ordinaire. Le silence ne signifie pas fin d’appel ni place réservée : une réunion plus récente peut faire expirer un ancien groupe silencieux. Les enregistrements microphone/audio partagé antérieurs gardent N captures par type. Le quota ou l’éviction du stockage navigateur peut limiter leur disponibilité.",
  'dsh-live-voice.recording.keepPrevious.label': 'Enregistrements conservés par type de source',
  'dsh-live-voice.recording.managementHelp':
    'La gestion des sessions enregistrées — navigation, écoute, consultation des transcriptions, export et suppression — nécessite le plugin facultatif dsh-live-voice-debugger. Utilisez Diagnostics ci-dessous pour l’installer. L’enregistrement lui-même ne nécessite pas le débogueur.',
  'dsh-live-voice.recording.paddingHelp':
    'Inclut de 0 à 2 000 ms avant et après la parole détectée lors de la transcription d’une plage enregistrée.',
  'dsh-live-voice.recording.postRoll.label': 'Son après la parole (millisecondes)',
  'dsh-live-voice.recording.preRoll.label': 'Son avant la parole (millisecondes)',
  'dsh-live-voice.recording.privacyWarning':
    'Le son, y compris les silences et les bruits de fond, est stocké localement dans ce profil de navigateur et ce site, avec compression avec perte. Obtenez le consentement avant d’enregistrer d’autres personnes. Désactiver cette option ne supprime pas les enregistrements sauvegardés.',
  'dsh-live-voice.recording.status.saved': 'Audio enregistré jusqu’à {time}',
  'dsh-live-voice.recording.title': 'Enregistrements récupérables',
  'dsh-live-voice.settings.autoSend.cancel': 'Annuler l’envoi automatique',
  'dsh-live-voice.settings.autoSend.countdown': 'Envoi dans {remaining}',
  'dsh-live-voice.settings.autoSend.delay': 'Envoyer après le silence',
  'dsh-live-voice.settings.close': 'Fermer les paramètres vocaux',
  'dsh-live-voice.settings.delivery.dshEnterHelp':
    'Voix en direct utilise votre réponse pour choisir la bonne action pour Réorienter et File d’attente. Cela ne modifie pas les paramètres de DSH ; indiquez le comportement actuel et mettez cette réponse à jour s’il change.',
  'dsh-live-voice.settings.delivery.dshEnterQuestion':
    'Dans votre DSH, que fait Entrée lorsque l’agent est occupé ?',
  'dsh-live-voice.settings.delivery.dshEnterQueue': 'Place le message dans la file d’attente',
  'dsh-live-voice.settings.delivery.dshEnterSteer': 'Envoie le message pour réorienter l’agent',
  'dsh-live-voice.settings.delivery.label': 'Mode d’envoi',
  'dsh-live-voice.settings.delivery.manualLabel': 'Désactivé — vérifier et envoyer manuellement',
  'dsh-live-voice.settings.delivery.queueLabel':
    'File d’attente — ajout automatique après un silence',
  'dsh-live-voice.settings.delivery.status': 'Envoi automatique : {mode}',
  'dsh-live-voice.settings.delivery.steerDescription': 'envoyer à l’agent en cours d’exécution',
  'dsh-live-voice.settings.delivery.steerLabel':
    'Réorienter — envoyer automatiquement à l’agent en cours d’exécution',
  'dsh-live-voice.settings.delivery.toggle': 'Mode d’envoi automatique',
  'dsh-live-voice.settings.engine.refresh': 'Actualiser les moteurs disponibles',
  'dsh-live-voice.settings.filters.title': 'Filtrage',
  'dsh-live-voice.settings.general.title': 'Général',
  'dsh-live-voice.settings.layout.delivery': 'Envoi des messages',
  'dsh-live-voice.settings.layout.diagnostics': 'Diagnostic',
  'dsh-live-voice.settings.layout.listening': 'Écoute et interruptions',
  'dsh-live-voice.settings.layout.playback': 'Lecture et sortie',
  'dsh-live-voice.settings.layout.shortcut': 'Raccourcis',
  'dsh-live-voice.settings.layout.transcription': 'Transcription vocale',
  'dsh-live-voice.settings.layout.voice': 'Voix et moteur',
  'dsh-live-voice.settings.persistence.loadError':
    'Impossible de charger les paramètres Voix en direct depuis le serveur. Rechargez pour réessayer.',
  'dsh-live-voice.settings.persistence.saveError':
    'Impossible de sauvegarder les paramètres Voix en direct sur le serveur. Réessayez.',
  'dsh-live-voice.settings.shortcuts.assistantSpeech':
    'Activer/désactiver la voix automatique de l’assistant',
  'dsh-live-voice.settings.shortcuts.clear': 'Effacer',
  'dsh-live-voice.settings.shortcuts.conflict':
    'Ce raccourci est déjà attribué à une autre action.',
  'dsh-live-voice.settings.shortcuts.edit': 'Cliquer pour remplacer',
  'dsh-live-voice.settings.shortcuts.help':
    'Cliquez sur un raccourci, appuyez sur les nouvelles touches ensemble, puis relâchez pour enregistrer. Ctrl, Maj, Alt et Command fonctionnent seuls ou combinés, avec ou sans lettre. Échap annule ; Tab quitte le champ. Les raccourcis du navigateur ou du système peuvent être prioritaires.',
  'dsh-live-voice.settings.shortcuts.meeting': 'Activer/désactiver le partage de réunion',
  'dsh-live-voice.settings.shortcuts.microphone': 'Activer/désactiver le microphone',
  'dsh-live-voice.settings.shortcuts.record': 'Cliquer pour définir',
  'dsh-live-voice.settings.shortcuts.recording':
    'Appuyez sur un raccourci… Relâchez pour enregistrer. Échap annule.',
  'dsh-live-voice.settings.sourceNames.help':
    'Lorsque les deux sources capturent, ces noms identifient les nouveaux blocs de transcription, pas les participants individuels. Enregistrés en quittant le champ ; vide rétablit Me / Them. Maximum 80 caractères. Le texte existant reste inchangé.',
  'dsh-live-voice.settings.sourceNames.microphone': 'Nom de la source microphone',
  'dsh-live-voice.settings.sourceNames.shared': 'Nom de la source audio partagé',
  'dsh-live-voice.settings.sourceNames.title': 'Noms des sources de réunion',
  'dsh-live-voice.settings.tabs.conversation': 'Conversation',
  'dsh-live-voice.settings.tabs.recognition': 'Reconnaissance vocale',
  'dsh-live-voice.settings.tabs.speak': 'Synthèse vocale',
  'dsh-live-voice.settings.title': 'Paramètres de Voix en direct',
  'dsh-live-voice.settings.whisper.hostHelp':
    'Paramètres communs à tout l’hôte. Seules les URL HTTP sans authentification sur l’interface de bouclage (localhost, 127.0.0.1, [::1]) sont autorisées. Le bouclage désigne l’hôte DSH, pas ce navigateur. Toutes les vérifications d’état et requêtes audio passent par le serveur avec authentification.',
  'dsh-live-voice.speak.agentContext.enabled': 'Activer le contexte vocal de l’agent',
  'dsh-live-voice.speak.agentContext.enabledHelp':
    'Lorsqu’il est activé, le contexte ci-dessous indique à l’agent que ses réponses seront lues à voix haute.',
  'dsh-live-voice.speak.agentContext.help':
    'Cette instruction en anglais est envoyée à l’agent seulement pendant une conversation vocale active avec la parole automatique de l’assistant activée.',
  'dsh-live-voice.speak.agentContext.label': 'Contexte vocal de l’agent',
  'dsh-live-voice.speak.agentContext.restore': 'Restaurer la valeur par défaut',
  'dsh-live-voice.speak.autoPlayback.disable': 'Désactiver la lecture automatique de l’assistant',
  'dsh-live-voice.speak.autoPlayback.enable': 'Activer la lecture automatique de l’assistant',
  'dsh-live-voice.speak.autoPlayback.enabled':
    'Lire automatiquement les nouveaux messages de l’assistant',
  'dsh-live-voice.speak.autoPlayback.help':
    'Les nouveaux messages de l’assistant sont lus automatiquement, même avec le microphone désactivé. La lecture attend pendant que vous parlez.',
  'dsh-live-voice.speak.autoPlayback.label': 'Lecture automatique de l’assistant',
  'dsh-live-voice.speak.autoPlayback.nextMode':
    'Mode suivant : {mode}. Faites un clic droit pour choisir le périphérique audio.',
  'dsh-live-voice.speak.autoPlayback.remainingOne':
    'Lecture automatique de l’assistant : {state} — {count} segment vocal restant',
  'dsh-live-voice.speak.autoPlayback.remainingOther':
    'Lecture automatique de l’assistant : {state} — {count} segments vocaux restants',
  'dsh-live-voice.speak.autoPlayback.status': 'Lecture automatique de l’assistant : {state}',
  'dsh-live-voice.speak.browser.automaticVoice': 'Voix locale automatique',
  'dsh-live-voice.speak.browser.defaultVoice': 'par défaut',
  'dsh-live-voice.speak.browser.label': 'Synthèse vocale du navigateur · son sur cet appareil',
  'dsh-live-voice.speak.browser.name': 'Synthèse vocale du navigateur',
  'dsh-live-voice.speak.browser.outputHelp':
    'La synthèse vocale du navigateur peut ignorer le périphérique de sortie sélectionné ; cette API du navigateur utilise normalement celui défini par défaut sur le système.',
  'dsh-live-voice.speak.browser.voice': 'Voix locale du navigateur',
  'dsh-live-voice.speak.captions.approximate': 'Sous-titres vocaux approximatifs',
  'dsh-live-voice.speak.captions.loading': 'Préparation de l’audio vocal',
  'dsh-live-voice.speak.captions.position': 'Segment vocal {index} sur {total}',
  'dsh-live-voice.speak.captions.progress': 'Progression vocale approximative',
  'dsh-live-voice.speak.captions.title': 'Voix et sous-titres en direct',
  'dsh-live-voice.speak.engine.label': 'Moteur de synthèse vocale',
  'dsh-live-voice.speak.engine.playbackHelp':
    'Qwen et macOS say synthétisent sur l’hôte DSH ; l’audio AAC/M4A compact est lu dans ce navigateur. La synthèse vocale du navigateur est générée et lue sur cet appareil.',
  'dsh-live-voice.speak.filters.code.enabled':
    'Filtrer les blocs de code Markdown avant la lecture vocale',
  'dsh-live-voice.speak.filters.code.maxLines': 'Nombre maximal de lignes des blocs de code à lire',
  'dsh-live-voice.speak.filters.code.notice': 'Consultez le code dans notre conversation',
  'dsh-live-voice.speak.filters.code.replacement':
    'Phrase de remplacement pour les blocs de code plus longs',
  'dsh-live-voice.speak.interruption.disabledHelp':
    'L’envoi d’un autre message n’arrête pas la lecture vocale de l’assistant que vous écoutez déjà.',
  'dsh-live-voice.speak.interruption.enabled':
    'Arrêter la lecture vocale de l’assistant lorsque j’envoie un message',
  'dsh-live-voice.speak.interruption.enabledHelp':
    'L’envoi d’un nouveau message utilisateur, y compris à l’agent en cours d’exécution, arrête la lecture vocale de l’assistant, qu’elle soit en cours ou en pause.',
  'dsh-live-voice.speak.macos.label': 'macOS say · son sur l’hôte',
  'dsh-live-voice.speak.macos.name': 'macOS say',
  'dsh-live-voice.speak.macos.voice': 'Voix de macOS say',
  'dsh-live-voice.speak.macos.voiceHelp':
    'Saisissez le nom exact de la voix utilisé par say -v. Laissez vide pour utiliser la voix par défaut de macOS. Listez les voix de l’hôte dans Terminal avec say -v "?".',
  'dsh-live-voice.speak.output.checking': 'Vérification de la sortie vocale…',
  'dsh-live-voice.speak.output.device': 'Périphérique de sortie',
  'dsh-live-voice.speak.output.fallbackName': 'Sortie audio',
  'dsh-live-voice.speak.output.stopTest': 'Arrêter le test vocal',
  'dsh-live-voice.speak.output.test': 'Tester la sortie vocale sélectionnée',
  'dsh-live-voice.speak.output.testPhrase':
    'DSH Voix en direct. La sortie vocale sélectionnée fonctionne.',
  'dsh-live-voice.speak.output.testing': 'Test vocal en cours…',
  'dsh-live-voice.speak.playback.message': 'Lire le message à voix haute',
  'dsh-live-voice.speak.playback.next': 'Passer au segment vocal suivant',
  'dsh-live-voice.speak.playback.pause': 'Mettre la lecture en pause',
  'dsh-live-voice.speak.playback.previous': 'Segment vocal précédent',
  'dsh-live-voice.speak.playback.resume': 'Reprendre la lecture',
  'dsh-live-voice.speak.playback.stop': 'Arrêter la lecture',
  'dsh-live-voice.speak.playback.stopAll': 'Arrêter toute lecture',
  'dsh-live-voice.speak.qwen.connection': 'Connexion au serveur Qwen',
  'dsh-live-voice.speak.qwen.endpoint': 'URL de base de l’API Qwen',
  'dsh-live-voice.speak.qwen.healthFailed': 'La vérification de l’état de Qwen a échoué.',
  'dsh-live-voice.speak.qwen.label': 'Qwen3 TTS · serveur MLX local',
  'dsh-live-voice.speak.qwen.name': 'Qwen3 local',
  'dsh-live-voice.speak.qwen.requestFailed': 'La requête relative aux paramètres de Qwen a échoué.',
  'dsh-live-voice.speak.qwen.restartRequired':
    'Les routes de configuration de Qwen ne sont pas chargées. Un redémarrage normal du serveur DSH est nécessaire pour charger les routes mises à jour du plugin ; actualiser cette page ne suffit pas.',
  'dsh-live-voice.speak.qwen.save': 'Enregistrer les paramètres de Qwen',
  'dsh-live-voice.speak.qwen.saved':
    'Enregistré sur l’hôte DSH. Les requêtes Qwen actives ont été annulées.',
  'dsh-live-voice.speak.qwen.signInRequired':
    'Connectez-vous à DSH pour gérer les paramètres de Qwen.',
  'dsh-live-voice.speak.qwen.test': 'Tester le serveur Qwen',
  'dsh-live-voice.speak.qwen.voice': 'Voix Qwen',
  'dsh-live-voice.speak.qwen.voiceHelp':
    'Aiden est utilisé par défaut. Ces voix prédéfinies ne sont pas des voix natives du portugais brésilien.',
  'dsh-live-voice.speak.qwen.voices.aiden': 'Aiden — homme, anglais américain',
  'dsh-live-voice.speak.qwen.voices.dylan': 'Dylan — homme, chinois de Pékin',
  'dsh-live-voice.speak.qwen.voices.eric': 'Eric — homme, chinois du Sichuan',
  'dsh-live-voice.speak.qwen.voices.onoAnna': 'Ono Anna — femme, japonais',
  'dsh-live-voice.speak.qwen.voices.ryan': 'Ryan — homme, anglais',
  'dsh-live-voice.speak.qwen.voices.serena': 'Serena — femme, chinois',
  'dsh-live-voice.speak.qwen.voices.sohee': 'Sohee — femme, coréen',
  'dsh-live-voice.speak.qwen.voices.uncleFu': 'Uncle Fu — homme, chinois',
  'dsh-live-voice.speak.qwen.voices.vivian': 'Vivian — femme, chinois',
  'dsh-live-voice.speak.rate.help': 'Vitesse relative : 1 correspond à la vitesse normale.',
  'dsh-live-voice.speak.rate.label': 'Débit de parole',
  'dsh-live-voice.speak.responseDelay.help':
    'Après que vous avez cessé de parler, la lecture automatique de l’assistant attend cette durée de silence continu. Si vous reparlez, l’attente recommence.',
  'dsh-live-voice.speak.responseDelay.label': 'Délai de réponse de l’assistant',
  'dsh-live-voice.speak.responseDelay.oneAndHalf': '1,5 seconde',
  'dsh-live-voice.speak.segmentGap.help':
    'Attend ce nombre de millisecondes entre des segments vocaux consécutifs. La valeur par défaut est 400 ms.',
  'dsh-live-voice.speak.segmentGap.label': 'Pause entre les segments vocaux',
  'dsh-live-voice.speak.status.paused': 'Lecture en pause',
  'dsh-live-voice.speak.status.playing': 'Lecture en cours',
  'dsh-live-voice.speak.volume.help':
    'Lecture vocale uniquement : 0% est silencieux ; 100% est le volume maximal (par défaut). Le microphone reste inchangé. Dans Browser, les changements prennent effet au segment suivant.',
  'dsh-live-voice.speak.volume.label': 'Volume de la voix',
};

export default Object.freeze(fr);
