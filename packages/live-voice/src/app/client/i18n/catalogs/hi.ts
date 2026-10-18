import type { LiveVoiceTranslation } from './base.js';

const hi: LiveVoiceTranslation = {
  'dsh-live-voice.commons.connection.contactingHost': 'DSH होस्ट से संपर्क किया जा रहा है…',
  'dsh-live-voice.commons.connection.endpoint': 'एंडपॉइंट URL',
  'dsh-live-voice.commons.connection.healthEndpoint': 'स्वास्थ्य जाँच का URL या पथ',
  'dsh-live-voice.commons.connection.reload': 'सहेजी गई सेटिंग्स फिर लोड करें',
  'dsh-live-voice.commons.connection.test': 'कनेक्शन जाँचें',
  'dsh-live-voice.commons.connection.timeout': 'अनुरोध की समय-सीमा (मिलीसेकंड)',
  'dsh-live-voice.commons.connection.title': 'कनेक्शन सेटिंग्स',
  'dsh-live-voice.commons.connection.unsaved': 'बदलाव अभी सहेजे नहीं गए हैं',
  'dsh-live-voice.commons.controls.title': 'वॉइस नियंत्रण',
  'dsh-live-voice.commons.conversation.end': 'वॉइस बातचीत समाप्त करें',
  'dsh-live-voice.commons.conversation.idle': 'बातचीत निष्क्रिय है',
  'dsh-live-voice.commons.conversation.start': 'वॉइस बातचीत शुरू करें',
  'dsh-live-voice.commons.delivery.queueBadge': 'कतार',
  'dsh-live-voice.commons.device.numberedLabel': '{device} {number}',
  'dsh-live-voice.commons.dismiss': 'हटाएँ',
  'dsh-live-voice.commons.dismissError': 'वॉइस त्रुटि का संदेश हटाएँ',
  'dsh-live-voice.commons.engine.failure': '{engine}: {reason}',
  'dsh-live-voice.commons.input.ignoring': 'अनदेखा किया जा रहा है',
  'dsh-live-voice.commons.input.ignoringBadge': 'अनदेखा किया जा रहा है',
  'dsh-live-voice.commons.input.listening': 'सुना जा रहा है',
  'dsh-live-voice.commons.input.listeningBadge': 'सुना जा रहा है',
  'dsh-live-voice.commons.manual': 'मैन्युअल',
  'dsh-live-voice.commons.milliseconds': '{milliseconds} मिलीसेकंड',
  'dsh-live-voice.commons.off': 'बंद',
  'dsh-live-voice.commons.on': 'चालू',
  'dsh-live-voice.commons.pluginName': 'लाइव वॉइस',
  'dsh-live-voice.commons.queue': 'कतार',
  'dsh-live-voice.commons.repository.starLabel': 'GitHub पर हमें स्टार दें',
  'dsh-live-voice.commons.repository.starLink': 'GitHub पर DSH लाइव वॉइस को स्टार दें',
  'dsh-live-voice.commons.second': '1 सेकंड',
  'dsh-live-voice.commons.seconds': '{seconds} सेकंड',
  'dsh-live-voice.commons.send': 'भेजें',
  'dsh-live-voice.commons.status.ready': 'वॉइस तैयार है',
  'dsh-live-voice.commons.systemDefault': 'सिस्टम डिफ़ॉल्ट',
  'dsh-live-voice.commons.toggle.offBadge': 'बंद',
  'dsh-live-voice.commons.unknownLanguage': 'अज्ञात भाषा',
  'dsh-live-voice.commons.update.busy': 'अपडेट से पहले वॉइस कैप्चर और प्लेबैक रोकें।',
  'dsh-live-voice.commons.update.cancel': 'रद्द करें',
  'dsh-live-voice.commons.update.confirm':
    'इस DSH प्रोफ़ाइल में लाइव वॉइस {version} इंस्टॉल करें? डाउनलोड के लिए नेटवर्क चाहिए। अनुरोध होने पर बाद में DSH पुनः शुरू करें; कुछ भी अपने आप पुनः शुरू नहीं होगा।',
  'dsh-live-voice.commons.update.current':
    'यह संस्करण पहले से इंस्टॉल है। उपयोग के लिए DSH पुनः शुरू करें।',
  'dsh-live-voice.commons.update.delayed':
    'माँगा गया संस्करण अभी इस प्रोफ़ाइल के लिए उपलब्ध नहीं है। प्रकाशन जारी हो सकता है या pnpm का minimumReleaseAge विलंब कर सकता है। प्रतीक्षा करें, फिर DSH प्लगइन प्रबंधक देखें; कोई सुरक्षा नीति नहीं बदली गई।',
  'dsh-live-voice.commons.update.done':
    'लाइव वॉइस {version} इंस्टॉल हो गया। तैयार होने पर पेज रीलोड करें।',
  'dsh-live-voice.commons.update.failed':
    'अपडेट विफल। रिलीज़ अभी npm पर उपलब्ध नहीं हो सकती। DSH प्लगइन प्रबंधक देखें।',
  'dsh-live-voice.commons.update.incompatible':
    'यह रिलीज़ चल रहे DSH संस्करण के साथ संगत नहीं है। DSH प्लगइन प्रबंधक देखें और संगत DSH तथा प्लगइन संस्करण उपयोग करें; कोई संगतता छूट नहीं दी गई।',
  'dsh-live-voice.commons.update.installing': 'अपडेट हो रहा है…',
  'dsh-live-voice.commons.update.label': 'अपडेट उपलब्ध है',
  'dsh-live-voice.commons.update.link': 'अपडेट उपलब्ध है: {version}। रिलीज़ खोलें',
  'dsh-live-voice.commons.update.local':
    'यह स्थानीय, Git या कस्टम इंस्टॉलेशन है। मूल इंस्टॉलेशन विधि से अपडेट करें।',
  'dsh-live-voice.commons.update.now': 'अभी अपडेट करें',
  'dsh-live-voice.commons.update.restart':
    'लाइव वॉइस {version} इंस्टॉल हो गया। तैयार होने पर DSH पुनः शुरू करें, फिर यह पेज रीलोड करें।',
  'dsh-live-voice.commons.update.scripts':
    'पैकेज स्क्रिप्ट को स्वीकृति चाहिए। DSH प्लगइन प्रबंधक में समीक्षा करें; यहाँ कोई स्क्रिप्ट स्वीकृत नहीं हुई।',
  'dsh-live-voice.commons.update.unavailable':
    'इस प्रोफ़ाइल या DSH संस्करण में अपडेट उपलब्ध नहीं है। DSH प्लगइन प्रबंधक उपयोग करें।',
  'dsh-live-voice.commons.update.uncertain':
    'इंस्टॉलेशन का परिणाम अज्ञात है। दोबारा प्रयास से पहले DSH प्लगइन प्रबंधक देखें।',
  'dsh-live-voice.commons.update.version': 'अपडेट उपलब्ध है: {version}',
  'dsh-live-voice.commons.version.compatibility': 'DSH v{version} के साथ संगत',
  'dsh-live-voice.commons.version.compatibilityLink': 'DSH v{version} के साथ संगत। रिलीज़ खोलें',
  'dsh-live-voice.commons.version.label': 'DSH लाइव वॉइस v{version}',
  'dsh-live-voice.commons.version.link': 'DSH लाइव वॉइस v{version}। रिलीज़ सूची खोलें',
  'dsh-live-voice.commons.version.title': 'संस्करण जानकारी',
  'dsh-live-voice.debugger.applied':
    'डीबगर {version} इंस्टॉल हो गया और DSH ने इसे लागू कर दिया। इस पृष्ठ पर डायग्नोस्टिक्स के पंजीकरण की प्रतीक्षा है। उपलब्ध न होने पर DSH प्लगइन प्रबंधक देखें; पृष्ठ अपने आप रीलोड नहीं होगा।',
  'dsh-live-voice.debugger.busy':
    'इंस्टॉल करने से पहले आवाज़ कैप्चर, ट्रांसक्रिप्शन और प्लेबैक रोकें।',
  'dsh-live-voice.debugger.close': 'बंद करें',
  'dsh-live-voice.debugger.confirm':
    'इस DSH प्रोफ़ाइल में dsh-live-voice-debugger {version} इंस्टॉल और सक्रिय करें? पैकेज रजिस्ट्री से डाउनलोड के लिए नेटवर्क चाहिए। केवल प्रबंधक के कहने पर DSH पुनः शुरू करें। कुछ भी अपने आप पुनः शुरू या रीलोड नहीं होगा। इंस्टॉलेशन के दौरान इस निर्भरता को किसी अन्य प्रबंधक या CLI से न बदलें।',
  'dsh-live-voice.debugger.description':
    'डायग्नोस्टिक्स और रिकॉर्ड किए गए सत्रों के प्रबंधन के लिए वैकल्पिक dsh-live-voice-debugger प्लगइन चाहिए। इससे रनटाइम स्थिति और कतारें देख सकते हैं, सहेजी रिकॉर्डिंग ब्राउज़ कर सकते हैं, ऑडियो सुन सकते हैं, ट्रांसक्रिप्शन और त्रुटियाँ देख सकते हैं, सत्र निर्यात और पूरी रिकॉर्डिंग हटा सकते हैं। लाइव वॉइस और रिकॉर्डिंग इसके बिना भी काम करते हैं।',
  'dsh-live-voice.debugger.failed':
    'इंस्टॉलेशन विफल हुआ या रद्द किया गया। आगे बढ़ने से पहले DSH प्लगइन प्रबंधक देखें; यहाँ दोबारा इंस्टॉल करने का प्रयास नहीं होगा।',
  'dsh-live-voice.debugger.installNow': 'अभी इंस्टॉल करें',
  'dsh-live-voice.debugger.installed':
    'डीबगर पहले से इंस्टॉल है, पर इस पृष्ठ पर उपलब्ध नहीं है। DSH प्लगइन प्रबंधक में सक्रियण और लोड त्रुटियाँ देखें। केवल कहे जाने पर DSH पुनः शुरू करें; यह संवाद दोबारा इंस्टॉल नहीं करेगा।',
  'dsh-live-voice.debugger.installing': 'डीबगर की जाँच या इंस्टॉलेशन जारी है…',
  'dsh-live-voice.debugger.label': 'डायग्नोस्टिक्स',
  'dsh-live-voice.debugger.local':
    'डीबगर की स्थानीय, Git या कस्टम निर्भरता पहले से मौजूद है। उसकी मूल इंस्टॉलेशन विधि से प्रबंधन करें; यहाँ उसे बदला नहीं जाएगा।',
  'dsh-live-voice.debugger.ready':
    'डायग्नोस्टिक्स तैयार हैं। संवाद बंद करके डीबगर खोलने के लिए डायग्नोस्टिक्स पर क्लिक करें।',
  'dsh-live-voice.debugger.restart':
    'डीबगर {version} इंस्टॉल हो गया। DSH प्रबंधक को पुनः शुरू करना आवश्यक है। तैयार होने पर DSH पुनः शुरू करें, फिर यह पृष्ठ रीलोड करें। कुछ भी अपने आप पुनः शुरू नहीं होगा।',
  'dsh-live-voice.debugger.scripts':
    'पैकेज स्क्रिप्ट को अनुमति चाहिए। DSH प्लगइन प्रबंधक में समीक्षा करें; यहाँ किसी स्क्रिप्ट को अनुमति नहीं दी गई और इंस्टॉलेशन फिर नहीं होगा।',
  'dsh-live-voice.debugger.title': 'डायग्नोस्टिक्स और रिकॉर्ड किए गए सत्र',
  'dsh-live-voice.debugger.unavailable':
    'इस प्रोफ़ाइल या DSH संस्करण में इंस्टॉलेशन उपलब्ध नहीं है। DSH प्लगइन प्रबंधक का उपयोग करें।',
  'dsh-live-voice.debugger.uncertain':
    'इंस्टॉलेशन का परिणाम अज्ञात है। आगे बढ़ने से पहले DSH प्लगइन प्रबंधक देखें; यहाँ दोबारा प्रयास नहीं होगा।',
  'dsh-live-voice.meeting.browserLocalUnavailable':
    'इस भाषा के लिए ब्राउज़र की स्थानीय पहचान उपलब्ध नहीं है। भाषा पैक इंस्टॉल करें या ब्राउज़र सेवा की अनुमति देने के लिए सेटिंग्स में केवल स्थानीय प्रोसेसिंग स्पष्ट रूप से बंद करें।',
  'dsh-live-voice.meeting.browserSharedUnsupported':
    'यह ब्राउज़र साझा ऑडियो को सुरक्षित रूप से नहीं पहचान सकता। साझा ऑडियो के लिए Qwen या Whisper HTTP चुनें।',
  'dsh-live-voice.meeting.failed': 'पहचान विफल हुई।',
  'dsh-live-voice.meeting.help': 'स्वतंत्र स्रोत; संपादक से लिप्यंतरण स्वयं भेजें।',
  'dsh-live-voice.meeting.inactive': 'निष्क्रिय',
  'dsh-live-voice.meeting.listening': 'सुन रहा है',
  'dsh-live-voice.meeting.microphone': 'माइक्रोफ़ोन',
  'dsh-live-voice.meeting.noAudio': 'कोई ऑडियो साझा नहीं हुआ। साझाकरण संवाद में ऑडियो चालू करें।',
  'dsh-live-voice.meeting.processing': 'लिप्यंतरण…',
  'dsh-live-voice.meeting.shared': 'साझा ऑडियो',
  'dsh-live-voice.meeting.start': 'स्रोत शुरू करें',
  'dsh-live-voice.meeting.startShared': 'ऑडियो साझा करना शुरू करें',
  'dsh-live-voice.meeting.starting': 'शुरू हो रहा है…',
  'dsh-live-voice.meeting.stop': 'स्रोत रोकें',
  'dsh-live-voice.meeting.stopShared': 'ऑडियो साझा करना रोकें',
  'dsh-live-voice.meeting.timestamps': 'लिप्यंतरण समय चिह्न',
  'dsh-live-voice.meeting.timestampsBadge': 'समय',
  'dsh-live-voice.meeting.title': 'बैठक मोड',
  'dsh-live-voice.meeting.unavailable': 'पहचान उपलब्ध नहीं है।',
  'dsh-live-voice.recognition.autoSend.countdownHelp':
    'पहचाने गए वाक्यांश का अंतिम परिणाम मिलने के बाद उलटी गिनती शुरू होती है। दोबारा बोलने या संपादन करने पर यह रद्द हो जाती है।',
  'dsh-live-voice.recognition.browser.autoInstallPack':
    'ज़रूरत पड़ने पर ब्राउज़र का यह भाषा पैक अपने आप इंस्टॉल करें',
  'dsh-live-voice.recognition.browser.help':
    'ब्राउज़र के SpeechRecognition API का उपयोग करता है। यह डिफ़ॉल्ट विकल्प है।',
  'dsh-live-voice.recognition.browser.label': 'ब्राउज़र SpeechRecognition · डिफ़ॉल्ट विकल्प',
  'dsh-live-voice.recognition.browser.localProcessing':
    'वाक् पहचान की प्रोसेसिंग इसी डिवाइस पर स्थानीय रूप से करें',
  'dsh-live-voice.recognition.browser.microphoneHelp':
    'ब्राउज़र का SpeechRecognition यहाँ चुने गए माइक्रोफ़ोन के बजाय ब्राउज़र या सिस्टम के डिफ़ॉल्ट माइक्रोफ़ोन का उपयोग कर सकता है।',
  'dsh-live-voice.recognition.browser.remoteServiceWarning':
    'ब्राउज़र सेवा के ज़रिए वाक् पहचान चालू है। ब्राउज़र माइक्रोफ़ोन का ऑडियो अपनी वाक् पहचान सेवा को भेज सकता है।',
  'dsh-live-voice.recognition.commands.addPhrase': 'वाक्यांश जोड़ें…',
  'dsh-live-voice.recognition.commands.clear': 'संदेश लिखने का बॉक्स खाली करें',
  'dsh-live-voice.recognition.commands.enabled': 'हूबहू मिलान वाले वॉइस कमांड चालू करें',
  'dsh-live-voice.recognition.commands.end': 'बातचीत समाप्त करें',
  'dsh-live-voice.recognition.commands.mute': 'संदेश बॉक्स में वॉइस इनपुट बंद करें',
  'dsh-live-voice.recognition.commands.queue': 'कतार में जोड़ें',
  'dsh-live-voice.recognition.commands.removePhrase': 'वाक्यांश हटाएँ',
  'dsh-live-voice.recognition.commands.resume': 'संदेश बॉक्स में वॉइस इनपुट फिर शुरू करें',
  'dsh-live-voice.recognition.commands.send': 'चल रहे एजेंट को भेजें',
  'dsh-live-voice.recognition.commands.stopSpeech': 'सहायक का वाचन बंद करें',
  'dsh-live-voice.recognition.commands.title': 'वॉइस कमांड',
  'dsh-live-voice.recognition.context.hint':
    'वैकल्पिक संदर्भ और शब्दावली हर ऑडियो खंड के साथ चुनी गई HTTP वाक् सेवा को prompt के रूप में भेजे जाते हैं। फ़ील्ड से बाहर आने पर सहेजा जाता है। समर्थन सर्वर पर निर्भर है; यह भाषाओं को सीमित नहीं करता और निर्देशों के पालन की गारंटी नहीं देता। संदर्भ न भेजने के लिए खाली छोड़ें।',
  'dsh-live-voice.recognition.context.label': 'ट्रांसक्रिप्शन संदर्भ',
  'dsh-live-voice.recognition.context.placeholder':
    'Native Brazilian Portuguese speaker who frequently uses technical terms in English.',
  'dsh-live-voice.recognition.dictation.cancel': 'डिक्टेशन रद्द करें',
  'dsh-live-voice.recognition.engine.label': 'वाक् पहचान इंजन',
  'dsh-live-voice.recognition.headphoneMode.help':
    'प्लेबैक के दौरान माइक्रोफ़ोन चालू रहता है। बिना प्रतिध्वनि की पहचानी गई आवाज़ निर्धारित विलंब के बाद प्लेबैक रोक सकती है; माइक्रोफ़ोन और साझा मीटिंग ऑडियो उतनी देर शांत रहने पर यह फिर चलता है। मैन्युअल विराम के बाद फिर चलाएँ दबाएँ।',
  'dsh-live-voice.recognition.headphoneMode.label': 'हेडफ़ोन — खुला माइक्रोफ़ोन',
  'dsh-live-voice.recognition.holdToTalk.enabled': 'बोलने के लिए दबाए रखें',
  'dsh-live-voice.recognition.holdToTalk.help':
    'संदेश बॉक्स खुला होने पर, पेज पर कहीं भी निर्धारित शॉर्टकट दबाए रखकर आवाज़ रिकॉर्ड करें। छोड़ने पर कतार में मौजूद ट्रांसक्रिप्शन पूरा किया जाता है, तय भेजने के विलंब तक प्रतीक्षा होती है, संदेश कतार में जुड़ता है और आवाज़ रिकॉर्ड करना बंद हो जाता है। रद्द करने के लिए दबाए रखते हुए Escape दबाएँ।',
  'dsh-live-voice.recognition.language.automatic': 'स्वचालित — भाषा पहचानें',
  'dsh-live-voice.recognition.language.label': 'वाक् पहचान की भाषा',
  'dsh-live-voice.recognition.language.options.chinese': 'चीनी (मंदारिन)',
  'dsh-live-voice.recognition.language.options.french': 'फ़्रेंच',
  'dsh-live-voice.recognition.language.options.spanish': 'स्पेनिश',
  'dsh-live-voice.recognition.local.cancel': 'रद्द करें',
  'dsh-live-voice.recognition.local.confirm': 'पुष्टि करें',
  'dsh-live-voice.recognition.local.confirmDownload':
    '{model} डाउनलोड करें? इस ब्राउज़र में लगभग {size} संग्रहित होगा।',
  'dsh-live-voice.recognition.local.confirmRemove':
    'इस ब्राउज़र से {model} हटाएँ? रिकॉर्डिंग सुरक्षित रहेंगी।',
  'dsh-live-voice.recognition.local.confirmTitle': 'मॉडल के संग्रहण में बदलाव की पुष्टि करें',
  'dsh-live-voice.recognition.local.device': 'रनटाइम',
  'dsh-live-voice.recognition.local.deviceHelp':
    'WebGPU के लिए काम करने वाला GPU अडैप्टर ज़रूरी है। Whisper में WebAssembly के साथ CPU पर चलने का स्पष्ट रूप से चुना जाने वाला धीमा विकल्प है; Qwen के लिए WebGPU ज़रूरी है। दूसरे रनटाइम या HTTP पर अपने आप नहीं बदला जाता।',
  'dsh-live-voice.recognition.local.download': 'मॉडल डाउनलोड करें',
  'dsh-live-voice.recognition.local.error.cancelled':
    'कार्रवाई रद्द कर दी गई। जब तैयार हों, मॉडल डाउनलोड या लोड करें।',
  'dsh-live-voice.recognition.local.error.download_failed':
    'मॉडल डाउनलोड नहीं हो सका। Hugging Face से अपना कनेक्शन जाँचें और फिर कोशिश करें।',
  'dsh-live-voice.recognition.local.error.f16_unavailable':
    'इस मॉडल के लिए shader-f16 समर्थन वाला WebGPU आवश्यक है। दूसरा Whisper मॉडल या संगत ब्राउज़र/डिवाइस चुनें।',
  'dsh-live-voice.recognition.local.error.failed':
    'मॉडल की कार्रवाई विफल रही। ब्राउज़र का संग्रहण जाँचें और मॉडल फिर से लोड करें।',
  'dsh-live-voice.recognition.local.error.gpu_unavailable':
    'WebGPU उपलब्ध नहीं है। काम करने वाले GPU अडैप्टर वाला ब्राउज़र इस्तेमाल करें या स्पष्ट रूप से Whisper का WebAssembly CPU विकल्प चुनें।',
  'dsh-live-voice.recognition.local.error.inference_failed':
    'लिप्यंतरण विफल रहा। मॉडल फिर से लोड करें और छोटे ऑडियो अंश के साथ दोबारा कोशिश करें।',
  'dsh-live-voice.recognition.local.error.invalid_audio':
    'इस ऑडियो का लिप्यंतरण नहीं हो सकता। नया ऑडियो अंश रिकॉर्ड करें और फिर कोशिश करें।',
  'dsh-live-voice.recognition.local.error.invalid_model':
    'यह मॉडल समर्थित नहीं है। सूची से कोई मॉडल चुनें।',
  'dsh-live-voice.recognition.local.error.model_busy':
    'मॉडल व्यस्त है। मौजूदा कार्रवाई पूरी होने की प्रतीक्षा करें और फिर कोशिश करें।',
  'dsh-live-voice.recognition.local.error.model_missing':
    'मॉडल की फ़ाइलें गायब हैं या कैश से हटा दी गई हैं। मॉडल दोबारा डाउनलोड करें।',
  'dsh-live-voice.recognition.local.error.runtime_outdated':
    'ब्राउज़र ने इन सेटिंग्स से पुराना वॉइस रनटाइम लोड किया है। नया वर्कर लोड करने के लिए पेज रीलोड करें। समस्या बनी रहे तो DSH में अपडेट किया हुआ लाइव वॉइस बैकएंड रीलोड करें; मॉडल दोबारा डाउनलोड करने की ज़रूरत नहीं है।',
  'dsh-live-voice.recognition.local.error.runtime_unavailable':
    'मॉडल का रनटाइम उपलब्ध नहीं है। पेज रीफ़्रेश करें, ब्राउज़र का समर्थन जाँचें और मॉडल फिर से लोड करें।',
  'dsh-live-voice.recognition.local.error.storage_full':
    'ब्राउज़र का संग्रहण भर गया है। जगह खाली करें या बिना उपयोग वाले मॉडल हटाएँ और फिर कोशिश करें।',
  'dsh-live-voice.recognition.local.error.storage_unavailable':
    'ब्राउज़र का संग्रहण उपलब्ध नहीं है। ब्राउज़र की सामान्य प्रोफ़ाइल में साइट के संग्रहण की अनुमति दें और फिर कोशिश करें।',
  'dsh-live-voice.recognition.local.help': 'ब्राउज़र मॉडल के बारे में',
  'dsh-live-voice.recognition.local.load': 'मॉडल लोड करें',
  'dsh-live-voice.recognition.local.model': 'मॉडल',
  'dsh-live-voice.recognition.local.modelCard': 'मॉडल का विवरण',
  'dsh-live-voice.recognition.local.phase.absent':
    'स्थानीय लिप्यंतरण शुरू करने के लिए अपना पहला मॉडल डाउनलोड करें।',
  'dsh-live-voice.recognition.local.phase.checking': 'मॉडल की फ़ाइलें जाँची जा रही हैं…',
  'dsh-live-voice.recognition.local.phase.downloaded':
    'मॉडल डाउनलोड हो गया। लिप्यंतरण शुरू करने के लिए इसे लोड करें।',
  'dsh-live-voice.recognition.local.phase.downloading': 'मॉडल डाउनलोड हो रहा है…',
  'dsh-live-voice.recognition.local.phase.error':
    'मॉडल पर ध्यान देने की ज़रूरत है। त्रुटि के निर्देशों का पालन करें और फिर कोशिश करें।',
  'dsh-live-voice.recognition.local.phase.loading': 'मॉडल लोड हो रहा है…',
  'dsh-live-voice.recognition.local.phase.ready': 'मॉडल स्थानीय लिप्यंतरण के लिए तैयार है।',
  'dsh-live-voice.recognition.local.privacy':
    'मॉडल डाउनलोड करने पर Hugging Face से संपर्क होता है। वाणी इसी ब्राउज़र में संसाधित होती है, किसी HTTP लिप्यंतरण सेवा को नहीं भेजी जाती। ऐप को अब भी DSH की ज़रूरत है।',
  'dsh-live-voice.recognition.local.progress': 'मॉडल डाउनलोड की प्रगति',
  'dsh-live-voice.recognition.local.qwenLabel': 'Qwen · ब्राउज़र',
  'dsh-live-voice.recognition.local.recommended': 'अनुशंसित',
  'dsh-live-voice.recognition.local.reload': 'फिर से लोड करें',
  'dsh-live-voice.recognition.local.remove': 'मॉडल हटाएँ',
  'dsh-live-voice.recognition.local.space': 'ब्राउज़र में उपलब्ध संग्रहण: {size}',
  'dsh-live-voice.recognition.local.storageHelp':
    'मॉडल इस ब्राउज़र प्रोफ़ाइल में संग्रहित होते हैं; कैश हटाया जा सकता है। डिस्क के अनुमान में रनटाइम की फ़ाइलें और GPU/RAM की अतिरिक्त ज़रूरत शामिल नहीं हैं। हटाने से मॉडल की फ़ाइलें हटती हैं, रिकॉर्ड किए गए सत्र नहीं।',
  'dsh-live-voice.recognition.local.title': 'ब्राउज़र मॉडल',
  'dsh-live-voice.recognition.local.whisperLabel': 'Whisper · ब्राउज़र (अनुशंसित)',
  'dsh-live-voice.recognition.manualSend.help':
    'पहचाना गया पाठ संदेश बॉक्स में तब तक रहता है जब तक आप DSH के सामान्य भेजें बटन का उपयोग नहीं करते।',
  'dsh-live-voice.recognition.maxUtterance.help':
    'यदि बोलना बिना रुके जारी रहे, तो इस अवधि के बाद नया ट्रांसक्रिप्शन खंड शुरू करें। डिफ़ॉल्ट: 60 सेकंड।',
  'dsh-live-voice.recognition.maxUtterance.label': 'लगातार बोलने की अधिकतम अवधि (सेकंड)',
  'dsh-live-voice.recognition.microphone.checking': 'माइक्रोफ़ोन की उपलब्धता जाँची जा रही है',
  'dsh-live-voice.recognition.microphone.device': 'इनपुट डिवाइस',
  'dsh-live-voice.recognition.microphone.failure': 'माइक्रोफ़ोन: {reason}',
  'dsh-live-voice.recognition.microphone.ignore': 'संदेश बॉक्स का वॉइस इनपुट अनदेखा करें',
  'dsh-live-voice.recognition.microphone.inputStatus':
    'ऑडियो इनपुट: {state}। अनदेखा करना डिक्टेशन छोड़ता है, कैप्चर नहीं: बोलकर बाधा डालना सक्रिय रहता है; सक्षम वॉइस कमांड काम करते हैं। संदेश फ़ील्ड में स्रोत बटन से कैप्चर रोकें।',
  'dsh-live-voice.recognition.microphone.label': 'माइक्रोफ़ोन',
  'dsh-live-voice.recognition.microphone.permissionHelp':
    'माइक्रोफ़ोन की अनुमति केवल तभी माँगी जाएगी जब आप डिक्टेशन या वॉइस बातचीत शुरू करेंगे।',
  'dsh-live-voice.recognition.microphone.resume': 'सुनना फिर शुरू करें',
  'dsh-live-voice.recognition.microphone.starting': 'माइक्रोफ़ोन शुरू हो रहा है',
  'dsh-live-voice.recognition.microphone.takeControl': 'माइक्रोफ़ोन का नियंत्रण लें',
  'dsh-live-voice.recognition.minimumWords.enabled': 'छोटे अंतिम ट्रांसक्रिप्शन खंड अनदेखा करें',
  'dsh-live-voice.recognition.minimumWords.help':
    'कम शब्दों वाले अंतिम खंड संदेश बॉक्स या स्वचालित भेजने की प्रक्रिया तक पहुँचने से पहले ही अनदेखे कर दिए जाते हैं।',
  'dsh-live-voice.recognition.minimumWords.label': 'हर अंतिम खंड में न्यूनतम शब्द',
  'dsh-live-voice.recognition.mode.label': 'सुनने का मोड',
  'dsh-live-voice.recognition.planned.parakeet': 'NVIDIA Parakeet — जल्द आ रहा है',
  'dsh-live-voice.recognition.planned.sherpa': 'sherpa-onnx स्ट्रीमिंग — जल्द आ रहा है',
  'dsh-live-voice.recognition.planned.vote': 'जल्द आ रहा है — रिपॉज़िटरी के इश्यू में वोट दें',
  'dsh-live-voice.recognition.planned.voxtral': 'Voxtral Realtime — जल्द आ रहा है',
  'dsh-live-voice.recognition.planned.webGpu': 'ब्राउज़र में WebGPU इन्फ़रेंस — जल्द आ रहा है',
  'dsh-live-voice.recognition.presets.custom.description':
    'खंड और अनुच्छेद के लिए स्वतंत्र विराम चुनें।',
  'dsh-live-voice.recognition.presets.custom.label': 'कस्टम',
  'dsh-live-voice.recognition.presets.long.description':
    'लंबे सोच-विचार वाले विरामों तक प्रतीक्षा करें।',
  'dsh-live-voice.recognition.presets.long.label': 'लंबा',
  'dsh-live-voice.recognition.presets.natural.description':
    'वाक्यांशों के बीच सामान्य विराम की अनुमति दें।',
  'dsh-live-voice.recognition.presets.natural.label': 'स्वाभाविक',
  'dsh-live-voice.recognition.presets.short.description':
    'छोटे विराम के बाद जल्दी ट्रांसक्राइब करें।',
  'dsh-live-voice.recognition.presets.short.label': 'छोटा',
  'dsh-live-voice.recognition.providerSettings.help':
    'प्रदाता की सेटिंग्स चुने गए वाक् पहचान इंजन के अनुसार बदलती हैं।',
  'dsh-live-voice.recognition.qwen.captureHelp':
    'ऑडियो को पूरे कथनों वाले WAV खंडों में बाँटकर, प्रमाणीकृत DSH के ज़रिए होस्ट पर स्थानीय रूप से चल रहे Qwen3 ASR मॉडल को भेजा जाता है।',
  'dsh-live-voice.recognition.qwen.connectionSuccess':
    'कनेक्शन सफल रहा। Qwen ASR और TTS दोनों लोड हैं। बिना सहेजे बदलाव लागू नहीं किए गए हैं।',
  'dsh-live-voice.recognition.qwen.endpointHelp':
    'HTTP API, कॉन्फ़िगर किए गए DSH होस्ट URL पर है (डिफ़ॉल्ट: http://127.0.0.1:8080/inference)। ऑडियो के लिए प्रमाणीकरण वाले DSH होस्ट ट्रांसक्रिप्शन रूट का उपयोग होता है।',
  'dsh-live-voice.recognition.qwen.hostHelp':
    'Qwen3 ASR + TTS सर्वर की पूरे होस्ट पर लागू होने वाली सेटिंग्स। कोई भी HTTP या HTTPS बेस URL दर्ज करें जिस तक DSH होस्ट पहुँच सके। ब्राउज़र प्रमाणीकरण वाले DSH रूटों के ज़रिए इसे एक्सेस करता है।',
  'dsh-live-voice.recognition.qwen.label': 'Qwen3 ASR · HTTP API',
  'dsh-live-voice.recognition.silenceDetection.chunkPause':
    'ट्रांसक्रिप्शन से पहले: {milliseconds} ms',
  'dsh-live-voice.recognition.silenceDetection.customHelp':
    '100 से 10,000 ms तक पूर्णांक दर्ज करें। फ़ील्ड छोड़ने पर सहेजा जाता है। छोटे विराम बोलने को खंडों में बाँट सकते हैं; पहचान में अतिरिक्त समय लगता है।',
  'dsh-live-voice.recognition.silenceDetection.customLabel': 'खंड का विराम (मिलीसेकंड)',
  'dsh-live-voice.recognition.silenceDetection.customParagraphHelp':
    'बोले गए पाठ में नया अनुच्छेद शुरू करने से पहले का मौन (100–30,000 ms, पूर्णांक)। फ़ील्ड छोड़ने पर सहेजा जाता है; खंड के विराम और संदेश भेजने से स्वतंत्र है।',
  'dsh-live-voice.recognition.silenceDetection.customParagraphLabel':
    'अनुच्छेद का विराम (मिलीसेकंड)',
  'dsh-live-voice.recognition.silenceDetection.detector.energy': 'ऑडियो ऊर्जा',
  'dsh-live-voice.recognition.silenceDetection.detector.label': 'आवाज़ का डिटेक्टर',
  'dsh-live-voice.recognition.silenceDetection.detector.silero': 'Silero — प्रयोगात्मक (डिफ़ॉल्ट)',
  'dsh-live-voice.recognition.silenceDetection.duration':
    'ट्रांसक्रिप्शन से पहले: {milliseconds} ms · नया अनुच्छेद: {paragraphMilliseconds} ms',
  'dsh-live-voice.recognition.silenceDetection.help':
    'तय करता है कि रिकॉर्ड की गई आवाज़ को पहचान के लिए भेजने से पहले विराम कितनी देर रहना चाहिए।',
  'dsh-live-voice.recognition.silenceDetection.label': 'मौन का पता लगाना और अनुच्छेद',
  'dsh-live-voice.recognition.silenceDetection.minimumSpeech.help':
    'किसी खंड को स्वीकार करने से पहले न्यूनतम पहचानी गई वाणी (50–2,000 ms)। इससे छोटी ध्वनियाँ अनदेखी होती हैं।',
  'dsh-live-voice.recognition.silenceDetection.minimumSpeech.label': 'न्यूनतम वाणी (मिलीसेकंड)',
  'dsh-live-voice.recognition.silenceDetection.paragraphPause': 'नया अनुच्छेद: {milliseconds} ms',
  'dsh-live-voice.recognition.silenceDetection.pauseLabel': 'खंड और अनुच्छेद के विराम',
  'dsh-live-voice.recognition.silenceDetection.threshold.help':
    'वाणी सक्रियता सीमा (0.05–0.95)। कम मान धीमी वाणी पहचानते हैं, लेकिन अधिक शोर भी स्वीकार कर सकते हैं।',
  'dsh-live-voice.recognition.silenceDetection.threshold.label': 'वाणी सक्रियता सीमा',
  'dsh-live-voice.recognition.silenceDetection.title': 'मौन का पता लगाने और अनुच्छेद की सेटिंग्स',
  'dsh-live-voice.recognition.silero.error.failed':
    'Silero से आवाज़ का पता लगाने में विफलता हुई। सेटिंग्स में ऑडियो ऊर्जा चुनें या कैप्चर फिर से शुरू करने का प्रयास करें।',
  'dsh-live-voice.recognition.silero.error.overloaded':
    'Silero से आवाज़ का पता लगाने पर बहुत अधिक भार है। कैप्चर फिर से शुरू करें या सेटिंग्स में ऑडियो ऊर्जा चुनें।',
  'dsh-live-voice.recognition.silero.error.unavailable':
    'Silero से आवाज़ का पता लगाना उपलब्ध नहीं है। सेटिंग्स में ऑडियो ऊर्जा चुनें या कैप्चर फिर से शुरू करने का प्रयास करें।',
  'dsh-live-voice.recognition.speakerMode.help':
    'प्लेबैक स्पीकर फ़ीडबैक घटाने के लिए माइक्रोफ़ोन छोड़ देता है। माइक्रोफ़ोन लें से मैन्युअल बाधा डालें; साझा मीटिंग ऑडियो में बिना प्रतिध्वनि की पहचानी गई आवाज़ प्लेबैक रोक सकती है और स्थिर मौन के बाद यह फिर चलता है।',
  'dsh-live-voice.recognition.speakerMode.label': 'स्पीकर — नियंत्रित सुनना',
  'dsh-live-voice.recognition.status.answer': 'उत्तर पहचाना जा रहा है',
  'dsh-live-voice.recognition.status.awaitingAnswer': 'आपका उत्तर सुना जा रहा है',
  'dsh-live-voice.recognition.status.listening': 'सुना जा रहा है',
  'dsh-live-voice.recognition.status.listeningProcessing': 'सुनना और लिप्यंतरण जारी है',
  'dsh-live-voice.recognition.status.processing': 'लिप्यंतरण जारी है',
  'dsh-live-voice.recognition.status.unavailable': 'वाक् पहचान उपलब्ध नहीं है',
  'dsh-live-voice.recognition.status.waiting': 'प्रतीक्षा में',
  'dsh-live-voice.recognition.status.waitingCommand': 'कमांड की प्रतीक्षा में',
  'dsh-live-voice.recognition.voiceCommands.help':
    'वाक्यांशों को अल्पविराम से अलग करें। मिलान में बड़े-छोटे अक्षर, उच्चारण चिह्न, विराम चिह्न और अतिरिक्त स्पेस अनदेखे किए जाते हैं। पूरा अंतिम खंड मेल खाना चाहिए।',
  'dsh-live-voice.recognition.whisper.captureHelp':
    'ऑडियो को पूरे कथनों वाले WAV खंडों में बाँटकर प्रमाणीकृत DSH के ज़रिए भेजा जाता है, और लूपबैक पते पर चल रही whisper.cpp HTTP सेवा इसे प्रोसेस करती है।',
  'dsh-live-voice.recognition.whisper.connectionSuccess':
    'कनेक्शन सफल रहा। स्वास्थ्य जाँच एंडपॉइंट ने जवाब दिया; ट्रांसक्रिप्शन की जाँच नहीं की गई। बिना सहेजे बदलाव लागू नहीं किए गए हैं।',
  'dsh-live-voice.recognition.whisper.endpointHelp':
    'HTTP API, कॉन्फ़िगर किए गए बेस URL पर है (डिफ़ॉल्ट: http://127.0.0.1:8080/)। POST /v1/audio/transcriptions के साथ संगत है।',
  'dsh-live-voice.recognition.whisper.healthFailed': 'Whisper की स्वास्थ्य जाँच विफल रही।',
  'dsh-live-voice.recognition.whisper.label': 'Whisper · HTTP API',
  'dsh-live-voice.recognition.whisper.requestFailed': 'Whisper सेटिंग्स का अनुरोध विफल रहा।',
  'dsh-live-voice.recognition.whisper.restartRequired':
    'Whisper सेटिंग्स के रूट लोड नहीं हैं। अपडेट किए गए प्लगइन रूट लोड करने के लिए DSH सर्वर को सामान्य रूप से पुनः शुरू करना होगा; केवल यह पेज रीफ़्रेश करना पर्याप्त नहीं है।',
  'dsh-live-voice.recognition.whisper.save': 'Whisper सेटिंग्स सहेजें',
  'dsh-live-voice.recognition.whisper.saved':
    'DSH होस्ट पर सहेजा गया। होस्ट पर चल रहे ट्रांसक्रिप्शन अनुरोध रद्द कर दिए गए।',
  'dsh-live-voice.recognition.whisper.signInRequired':
    'Whisper सेटिंग्स प्रबंधित करने के लिए DSH में साइन इन करें।',
  'dsh-live-voice.recording.bitrate.help':
    'संपीड़ित ऑडियो की लक्षित बिटरेट। अधिक मान अधिक स्थानीय संग्रहण उपयोग करते हैं।',
  'dsh-live-voice.recording.bitrate.label': 'रिकॉर्डिंग बिटरेट',
  'dsh-live-voice.recording.bitrate.option': '{bitrate} किलोबिट/सेकंड',
  'dsh-live-voice.recording.browserUnsupported':
    'ब्राउज़र पहचान पुनर्प्राप्त करने योग्य रिकॉर्डिंग या सहेजे गए ऑडियो खंडों के ट्रांसक्रिप्शन का समर्थन नहीं करती। Qwen या Whisper HTTP चुनें।',
  'dsh-live-voice.recording.durabilityWarning':
    'स्थानीय संग्रहण भर सकता है या मिटाया जा सकता है; पुनर्प्राप्ति की गारंटी नहीं है। सहेजना विफल होने पर बिना सूचना डेटा खोने से बचाने के लिए कैप्चर रुक जाता है।',
  'dsh-live-voice.recording.enabled.help':
    'डिफ़ॉल्ट रूप से चालू। कैप्चर के दौरान पुनर्प्राप्त करने योग्य ऑडियो स्थानीय रूप से सहेजना नहीं चाहते तो बंद करें।',
  'dsh-live-voice.recording.enabled.label': 'पुनर्प्राप्त करने योग्य रिकॉर्डिंग सहेजें',
  'dsh-live-voice.recording.error.failed':
    'रिकॉर्डिंग सहेजी नहीं जा सकी। बिना सूचना डेटा खोने से बचाने के लिए कैप्चर रोक दिया गया।',
  'dsh-live-voice.recording.keepPrevious.help':
    'प्रति स्रोत प्रकार 1–100 सामान्य पूरी हो चुकी रिकॉर्डिंग रखें: माइक्रोफ़ोन का एक समूह और मीटिंग/साझा ऑडियो का एक समूह। डिफ़ॉल्ट: 1 माइक्रोफ़ोन + 1 मीटिंग। सुरक्षित/तारांकित रिकॉर्डिंग नहीं गिनी जातीं। सक्रिय रिकॉर्डिंग बंद होने तक रहती हैं, फिर इसी कुल सीमा में गिनी जाती हैं; कोई अतिरिक्त पिछली रिकॉर्डिंग नहीं रखी जाती।',
  'dsh-live-voice.recording.keepPrevious.label': 'प्रति स्रोत प्रकार रखी गई रिकॉर्डिंग',
  'dsh-live-voice.recording.managementHelp':
    'सहेजे सत्रों को ब्राउज़ करने, सुनने, ट्रांसक्रिप्शन देखने, निर्यात करने और हटाने के लिए वैकल्पिक dsh-live-voice-debugger प्लगइन चाहिए। नीचे डायग्नोस्टिक्स से इंस्टॉल करें। रिकॉर्डिंग के लिए डीबगर आवश्यक नहीं है।',
  'dsh-live-voice.recording.paddingHelp':
    'सहेजे गए ऑडियो खंड का ट्रांसक्रिप्शन करते समय पहचानी गई वाणी से पहले और बाद में 0–2,000 ms शामिल करें।',
  'dsh-live-voice.recording.postRoll.label': 'वाणी के बाद का ऑडियो (मिलीसेकंड)',
  'dsh-live-voice.recording.preRoll.label': 'वाणी से पहले का ऑडियो (मिलीसेकंड)',
  'dsh-live-voice.recording.privacyWarning':
    'मौन और पृष्ठभूमि की ध्वनि सहित ऑडियो इस ब्राउज़र प्रोफ़ाइल और साइट में स्थानीय रूप से हानिपूर्ण संपीड़न के साथ सहेजा जाता है। दूसरों को रिकॉर्ड करने से पहले सहमति लें। इसे बंद करने से सहेजी गई रिकॉर्डिंग नहीं मिटतीं।',
  'dsh-live-voice.recording.status.saved': 'ऑडियो {time} तक सहेजा गया',
  'dsh-live-voice.recording.title': 'पुनर्प्राप्त करने योग्य रिकॉर्डिंग',
  'dsh-live-voice.settings.autoSend.cancel': 'स्वचालित भेजना रद्द करें',
  'dsh-live-voice.settings.autoSend.countdown': '{remaining} में भेजा जाएगा',
  'dsh-live-voice.settings.autoSend.delay': 'मौन के बाद भेजें',
  'dsh-live-voice.settings.close': 'वॉइस सेटिंग्स बंद करें',
  'dsh-live-voice.settings.delivery.dshEnterHelp':
    'लाइव वॉइस आपके उत्तर से दिशा देने और कतार में डालने की सही क्रिया चुनता है। इससे DSH की सेटिंग नहीं बदलती; अपना वर्तमान DSH व्यवहार बताएं और उसके बदलने पर यह उत्तर अपडेट करें।',
  'dsh-live-voice.settings.delivery.dshEnterQuestion':
    'आपके DSH में, एजेंट व्यस्त होने पर Enter क्या करता है?',
  'dsh-live-voice.settings.delivery.dshEnterQueue': 'संदेश को कतार में डालता है',
  'dsh-live-voice.settings.delivery.dshEnterSteer': 'संदेश से एजेंट को दिशा देता है',
  'dsh-live-voice.settings.delivery.label': 'भेजने का मोड',
  'dsh-live-voice.settings.delivery.manualLabel': 'बंद — समीक्षा करके मैन्युअल रूप से भेजें',
  'dsh-live-voice.settings.delivery.queueLabel': 'कतार — मौन के बाद अपने आप जोड़ें',
  'dsh-live-voice.settings.delivery.status': 'स्वचालित भेजना: {mode}',
  'dsh-live-voice.settings.delivery.steerDescription': 'चल रहे एजेंट को भेजें',
  'dsh-live-voice.settings.delivery.steerLabel': 'दिशा दें — चल रहे एजेंट को अपने आप भेजें',
  'dsh-live-voice.settings.delivery.toggle': 'स्वचालित भेजने का मोड',
  'dsh-live-voice.settings.engine.refresh': 'उपलब्ध इंजन रीफ़्रेश करें',
  'dsh-live-voice.settings.filters.title': 'फ़िल्टरिंग',
  'dsh-live-voice.settings.general.title': 'सामान्य',
  'dsh-live-voice.settings.layout.delivery': 'संदेश भेजना',
  'dsh-live-voice.settings.layout.diagnostics': 'निदान',
  'dsh-live-voice.settings.layout.listening': 'सुनना और व्यवधान',
  'dsh-live-voice.settings.layout.playback': 'प्लेबैक और आउटपुट',
  'dsh-live-voice.settings.layout.shortcut': 'शॉर्टकट',
  'dsh-live-voice.settings.layout.transcription': 'ट्रांसक्रिप्शन',
  'dsh-live-voice.settings.layout.voice': 'आवाज़ और इंजन',
  'dsh-live-voice.settings.persistence.loadError':
    'सर्वर से लाइव वॉइस सेटिंग लोड नहीं हो सकीं। फिर प्रयास करने के लिए पेज रीलोड करें।',
  'dsh-live-voice.settings.persistence.saveError':
    'सर्वर पर लाइव वॉइस सेटिंग सेव नहीं हो सकीं। फिर प्रयास करें।',
  'dsh-live-voice.settings.shortcuts.assistantSpeech': 'सहायक की स्वचालित आवाज़ चालू/बंद करें',
  'dsh-live-voice.settings.shortcuts.clear': 'हटाएँ',
  'dsh-live-voice.settings.shortcuts.conflict':
    'यह शॉर्टकट पहले से किसी अन्य क्रिया को सौंपा गया है।',
  'dsh-live-voice.settings.shortcuts.edit': 'बदलने के लिए क्लिक करें',
  'dsh-live-voice.settings.shortcuts.help':
    'शॉर्टकट पर क्लिक करें, नई कुंजियाँ एक साथ दबाएँ और सहेजने के लिए छोड़ें। Ctrl, Shift, Alt और Command अकेले या संयोजन में, अक्षर के साथ या बिना काम करते हैं। Escape रद्द करता है; Tab फ़ील्ड से बाहर जाता है। ब्राउज़र या सिस्टम शॉर्टकट को प्राथमिकता मिल सकती है।',
  'dsh-live-voice.settings.shortcuts.meeting': 'बैठक साझाकरण चालू/बंद करें',
  'dsh-live-voice.settings.shortcuts.microphone': 'माइक्रोफ़ोन चालू/बंद करें',
  'dsh-live-voice.settings.shortcuts.record': 'सेट करने के लिए क्लिक करें',
  'dsh-live-voice.settings.shortcuts.recording':
    'शॉर्टकट दबाएँ… सहेजने के लिए छोड़ें। Escape रद्द करता है।',
  'dsh-live-voice.settings.sourceNames.help':
    'जब दोनों स्रोत रिकॉर्ड करते हैं, ये नाम नए ट्रांसक्रिप्ट ब्लॉक को चिह्नित करते हैं, अलग-अलग प्रतिभागियों को नहीं। फ़ील्ड छोड़ने पर सहेजे जाते हैं; खाली रखने पर Me / Them वापस आते हैं। अधिकतम 80 अक्षर। मौजूदा पाठ नहीं बदलता।',
  'dsh-live-voice.settings.sourceNames.microphone': 'माइक्रोफ़ोन स्रोत का नाम',
  'dsh-live-voice.settings.sourceNames.shared': 'साझा ऑडियो स्रोत का नाम',
  'dsh-live-voice.settings.sourceNames.title': 'बैठक स्रोतों के नाम',
  'dsh-live-voice.settings.tabs.conversation': 'बातचीत',
  'dsh-live-voice.settings.tabs.recognition': 'वाक् पहचान',
  'dsh-live-voice.settings.tabs.speak': 'वाचन',
  'dsh-live-voice.settings.title': 'लाइव वॉइस सेटिंग्स',
  'dsh-live-voice.settings.whisper.hostHelp':
    'पूरे होस्ट पर लागू होने वाली सेटिंग्स। केवल बिना प्रमाणीकरण वाले लूपबैक HTTP URL (localhost, 127.0.0.1, [::1]) स्वीकार्य हैं। लूपबैक का अर्थ DSH होस्ट है, यह ब्राउज़र नहीं। सभी स्वास्थ्य जाँच और ऑडियो अनुरोध प्रमाणीकरण वाले बैकएंड के ज़रिए चलते हैं।',
  'dsh-live-voice.speak.agentContext.enabled': 'एजेंट वॉइस संदर्भ सक्षम करें',
  'dsh-live-voice.speak.agentContext.enabledHelp':
    'सक्षम होने पर, नीचे दिया गया संदर्भ एजेंट को बताता है कि उसके उत्तर ज़ोर से बोले जाएंगे।',
  'dsh-live-voice.speak.agentContext.help':
    'यह अंग्रेज़ी निर्देश एजेंट को केवल सक्रिय वॉइस बातचीत के दौरान भेजा जाता है, जब सहायक का स्वचालित भाषण सक्षम हो.',
  'dsh-live-voice.speak.agentContext.label': 'एजेंट वॉइस संदर्भ',
  'dsh-live-voice.speak.agentContext.restore': 'डिफ़ॉल्ट बहाल करें',
  'dsh-live-voice.speak.autoPlayback.disable': 'सहायक की स्वचालित आवाज़ बंद करें',
  'dsh-live-voice.speak.autoPlayback.enable': 'सहायक की स्वचालित आवाज़ चालू करें',
  'dsh-live-voice.speak.autoPlayback.enabled': 'सहायक के नए संदेश अपने आप पढ़कर सुनाएँ',
  'dsh-live-voice.speak.autoPlayback.help':
    'सहायक के नए संदेश अपने आप पढ़कर सुनाए जाते हैं, भले ही माइक्रोफ़ोन बंद हो। जब आप बोल रहे हों, तो प्लेबैक प्रतीक्षा करता है।',
  'dsh-live-voice.speak.autoPlayback.label': 'सहायक का स्वचालित वाचन',
  'dsh-live-voice.speak.autoPlayback.nextMode':
    'अगला मोड: {mode}। ऑडियो डिवाइस चुनने के लिए राइट-क्लिक करें।',
  'dsh-live-voice.speak.autoPlayback.remainingOne':
    'सहायक का स्वचालित वाचन: {state} — {count} वाक् खंड शेष है',
  'dsh-live-voice.speak.autoPlayback.remainingOther':
    'सहायक का स्वचालित वाचन: {state} — {count} वाक् खंड शेष हैं',
  'dsh-live-voice.speak.autoPlayback.status': 'सहायक का स्वचालित वाचन: {state}',
  'dsh-live-voice.speak.browser.automaticVoice': 'स्थानीय आवाज़ का स्वचालित चयन',
  'dsh-live-voice.speak.browser.defaultVoice': 'डिफ़ॉल्ट',
  'dsh-live-voice.speak.browser.label': 'ब्राउज़र वाचन · इस डिवाइस पर ऑडियो',
  'dsh-live-voice.speak.browser.name': 'ब्राउज़र वाचन',
  'dsh-live-voice.speak.browser.outputHelp':
    'ब्राउज़र का वाक् संश्लेषण चुने गए आउटपुट डिवाइस को अनदेखा कर सकता है; यह ब्राउज़र API सामान्यतः सिस्टम के डिफ़ॉल्ट का उपयोग करता है।',
  'dsh-live-voice.speak.browser.voice': 'ब्राउज़र की स्थानीय आवाज़',
  'dsh-live-voice.speak.captions.approximate': 'अनुमानित वाणी कैप्शन',
  'dsh-live-voice.speak.captions.loading': 'वाणी ऑडियो तैयार हो रहा है',
  'dsh-live-voice.speak.captions.position': 'वाणी खंड {index} / {total}',
  'dsh-live-voice.speak.captions.progress': 'अनुमानित वाणी प्रगति',
  'dsh-live-voice.speak.captions.title': 'वाणी और लाइव कैप्शन',
  'dsh-live-voice.speak.engine.label': 'वाक् संश्लेषण इंजन',
  'dsh-live-voice.speak.engine.playbackHelp':
    'Qwen और macOS say DSH होस्ट पर आवाज़ बनाते हैं; कॉम्पैक्ट AAC/M4A ऑडियो इस ब्राउज़र में चलता है। ब्राउज़र स्पीच इसी डिवाइस पर बनती और चलती है।',
  'dsh-live-voice.speak.filters.code.enabled':
    'पढ़कर सुनाने से पहले Markdown कोड ब्लॉक फ़िल्टर करें',
  'dsh-live-voice.speak.filters.code.maxLines': 'अधिकतम इतनी पंक्तियों वाले कोड ब्लॉक पढ़ें',
  'dsh-live-voice.speak.filters.code.notice': 'हमारी बातचीत में दिया गया कोड देखें',
  'dsh-live-voice.speak.filters.code.replacement': 'बड़े कोड ब्लॉक की जगह पढ़ा जाने वाला वाक्यांश',
  'dsh-live-voice.speak.interruption.disabledHelp':
    'दूसरा संदेश भेजने से सहायक का वह ऑडियो बंद नहीं होता जिसे आप अभी सुन रहे हैं।',
  'dsh-live-voice.speak.interruption.enabled': 'मेरे संदेश भेजने पर सहायक का वाचन बंद करें',
  'dsh-live-voice.speak.interruption.enabledHelp':
    'नया उपयोगकर्ता संदेश भेजने या उससे चल रहे एजेंट को दिशा देने पर सहायक का चालू या ठहरा हुआ वाचन बंद हो जाता है।',
  'dsh-live-voice.speak.macos.label': 'macOS say · होस्ट पर ऑडियो',
  'dsh-live-voice.speak.macos.name': 'macOS say',
  'dsh-live-voice.speak.macos.voice': 'macOS say की आवाज़',
  'dsh-live-voice.speak.macos.voiceHelp':
    'say -v में इस्तेमाल किया जाने वाला आवाज़ का सटीक नाम दर्ज करें। macOS की डिफ़ॉल्ट आवाज़ के लिए खाली छोड़ें। होस्ट की आवाज़ों की सूची Terminal में say -v "?" से देखें।',
  'dsh-live-voice.speak.output.checking': 'वाक् आउटपुट जाँचा जा रहा है…',
  'dsh-live-voice.speak.output.device': 'आउटपुट डिवाइस',
  'dsh-live-voice.speak.output.fallbackName': 'ऑडियो आउटपुट',
  'dsh-live-voice.speak.output.stopTest': 'वाचन परीक्षण बंद करें',
  'dsh-live-voice.speak.output.test': 'चुने गए वाक् आउटपुट की जाँच करें',
  'dsh-live-voice.speak.output.testPhrase': 'DSH लाइव वॉइस। चुना गया वाक् आउटपुट काम कर रहा है।',
  'dsh-live-voice.speak.output.testing': 'वाचन का परीक्षण हो रहा है…',
  'dsh-live-voice.speak.playback.message': 'संदेश पढ़कर सुनाएँ',
  'dsh-live-voice.speak.playback.next': 'अगले वाणी खंड पर जाएँ',
  'dsh-live-voice.speak.playback.pause': 'वाचन ठहराएँ',
  'dsh-live-voice.speak.playback.previous': 'पिछला वाणी खंड',
  'dsh-live-voice.speak.playback.resume': 'वाचन फिर शुरू करें',
  'dsh-live-voice.speak.playback.stop': 'वाचन बंद करें',
  'dsh-live-voice.speak.playback.stopAll': 'सभी वाचन बंद करें',
  'dsh-live-voice.speak.qwen.connection': 'Qwen सर्वर कनेक्शन',
  'dsh-live-voice.speak.qwen.endpoint': 'Qwen API का बेस URL',
  'dsh-live-voice.speak.qwen.healthFailed': 'Qwen की स्वास्थ्य जाँच विफल रही।',
  'dsh-live-voice.speak.qwen.label': 'Qwen3 TTS · स्थानीय MLX सर्वर',
  'dsh-live-voice.speak.qwen.name': 'स्थानीय Qwen3',
  'dsh-live-voice.speak.qwen.requestFailed': 'Qwen सेटिंग्स का अनुरोध विफल रहा।',
  'dsh-live-voice.speak.qwen.restartRequired':
    'Qwen सेटिंग्स के रूट लोड नहीं हैं। अपडेट किए गए प्लगइन रूट लोड करने के लिए DSH सर्वर को सामान्य रूप से पुनः शुरू करना होगा; केवल यह पेज रीफ़्रेश करना पर्याप्त नहीं है।',
  'dsh-live-voice.speak.qwen.save': 'Qwen सेटिंग्स सहेजें',
  'dsh-live-voice.speak.qwen.saved': 'DSH होस्ट पर सहेजा गया। चल रहे Qwen अनुरोध रद्द कर दिए गए।',
  'dsh-live-voice.speak.qwen.signInRequired':
    'Qwen सेटिंग्स प्रबंधित करने के लिए DSH में साइन इन करें।',
  'dsh-live-voice.speak.qwen.test': 'Qwen सर्वर की जाँच करें',
  'dsh-live-voice.speak.qwen.voice': 'Qwen की आवाज़',
  'dsh-live-voice.speak.qwen.voiceHelp':
    'डिफ़ॉल्ट रूप से Aiden का उपयोग होता है। ये पहले से तय आवाज़ें ब्राज़ीलियाई पुर्तगाली के मूल वक्ताओं की आवाज़ें नहीं हैं।',
  'dsh-live-voice.speak.qwen.voices.aiden': 'Aiden — पुरुष, अमेरिकी अंग्रेज़ी',
  'dsh-live-voice.speak.qwen.voices.dylan': 'Dylan — पुरुष, बीजिंग चीनी',
  'dsh-live-voice.speak.qwen.voices.eric': 'Eric — पुरुष, सिचुआन चीनी',
  'dsh-live-voice.speak.qwen.voices.onoAnna': 'Ono Anna — महिला, जापानी',
  'dsh-live-voice.speak.qwen.voices.ryan': 'Ryan — पुरुष, अंग्रेज़ी',
  'dsh-live-voice.speak.qwen.voices.serena': 'Serena — महिला, चीनी',
  'dsh-live-voice.speak.qwen.voices.sohee': 'Sohee — महिला, कोरियाई',
  'dsh-live-voice.speak.qwen.voices.uncleFu': 'Uncle Fu — पुरुष, चीनी',
  'dsh-live-voice.speak.qwen.voices.vivian': 'Vivian — महिला, चीनी',
  'dsh-live-voice.speak.rate.help': 'सापेक्ष गति: 1 सामान्य है।',
  'dsh-live-voice.speak.rate.label': 'बोलने की गति',
  'dsh-live-voice.speak.responseDelay.help':
    'आपके बोलना बंद करने के बाद सहायक का स्वचालित प्लेबैक इतनी देर तक लगातार मौन रहने की प्रतीक्षा करता है। दोबारा बोलने पर प्रतीक्षा फिर से शुरू होती है।',
  'dsh-live-voice.speak.responseDelay.label': 'सहायक के जवाब का विलंब',
  'dsh-live-voice.speak.responseDelay.oneAndHalf': '1.5 सेकंड',
  'dsh-live-voice.speak.segmentGap.help':
    'लगातार बोले गए हिस्सों के बीच इतने मिलीसेकंड रुकें। डिफ़ॉल्ट 400 ms है।',
  'dsh-live-voice.speak.segmentGap.label': 'बोले गए हिस्सों के बीच विराम',
  'dsh-live-voice.speak.status.paused': 'वाचन ठहरा हुआ है',
  'dsh-live-voice.speak.status.playing': 'पढ़कर सुनाया जा रहा है',
  'dsh-live-voice.speak.volume.help':
    'केवल वाणी प्लेबैक: 0% मौन है; 100% पूर्ण आवाज़ है (डिफ़ॉल्ट)। माइक्रोफ़ोन नहीं बदलता। Browser में बदलाव अगले खंड से लागू होते हैं।',
  'dsh-live-voice.speak.volume.label': 'वाणी की आवाज़ का स्तर',
};

export default Object.freeze(hi);
