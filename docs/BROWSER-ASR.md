# Browser-local speech recognition

Select **Whisper · Browser** or **Qwen · Browser** in Speech recognition. Whisper · Browser and Whisper small q4 are marked recommended; small is the model default for new or missing model preferences. Browser SpeechRecognition remains the default engine, and valid saved engine/model choices are preserved. Select a model, confirm its download, then load it. Selection never downloads weights automatically. Download progress includes all pinned files; cancelling preserves completed files for retry. Remove affects only this plugin's model cache, never recordings.

Speech PCM is processed in a dedicated worker on the browser device. It is not uploaded to an HTTP transcription service. Initial downloads contact Hugging Face and disclose ordinary network metadata; DSH and its AI provider retain their own connectivity requirements. The browser runtime is packaged with the plugin and served through authenticated, versioned, same-origin routes.

## Models and devices

| Model | Download | Runtime | License |
| --- | ---: | --- | --- |
| Whisper Tiny | 122 MB | WebGPU or explicit WebAssembly CPU | MIT |
| Whisper Base | 209 MB | WebGPU or explicit WebAssembly CPU | MIT |
| Whisper small q4 | 302 MB | WebGPU or explicit WebAssembly CPU | MIT |
| Whisper medium q4 | 684 MB | WebGPU or explicit WebAssembly CPU | MIT |
| Whisper large v3 turbo q4 | 762 MB | WebGPU or explicit WebAssembly CPU | MIT |
| Qwen3-ASR 0.6B q4 | 1.30 GB | WebGPU only | Apache-2.0 |

Sizes are decimal, exclude runtime assets, and do not estimate GPU/RAM requirements. Models are browser-profile/site-specific and browser caches can be evicted. Clearing site data loses model files and potentially recordings. GPU support is checked by requesting a real adapter; operating-system identity is not a capability. GPU speed and transcription quality vary. Whisper Tiny/Base use an FP32 encoder and q4 decoder; Small, Medium and Large v3 Turbo use q4 graphs with FP32 activations; Qwen uses documented layout-v2 FP32/q4 graphs and int8 embedding rows. No offered Whisper model requires `shader-f16`. Large v3 Turbo uses the larger non-f16 q4 artifacts instead of the previous q4/fp16 variant. Switching from the older variant requires explicitly downloading the new files; cached q4/fp16 graphs are never mistaken for the new download. Remove model clears both variants from this plugin’s cache. WASM is an explicit Whisper option, not an automatic fallback; Qwen has no CPU or HTTP fallback.

All Whisper selections are multilingual models, not `.en` variants. Automatic language performs a constrained language-token detection pass before explicitly generating with `task: "transcribe"`; it never defaults silently to English. A selected language such as Portuguese is passed explicitly, independently of UI locale.

Microphone and meeting audio reuse the existing recording-owned capture, VAD pins, range queue, transcript audit, and stop/cancellation lifecycle. Inference is serialized across sources and segments are bounded below 30 seconds. Stop terminates cancelled worker work; no partial late transcript is inserted. Word-aligned timestamps are not claimed.

## Retry saved speech

In the optional debugger’s **Recordings** tab, finish capture and choose **Transcribe again** on a saved speech segment. The retry uses the current engine, model, language and WebGPU/WASM selection, not the recording’s original recognition settings. Download the selected **Whisper · Browser** or **Qwen · Browser** model in Speech recognition settings first. Archive retries use only cached model files: they never download missing weights or silently fall back to HTTP. Missing models or unsupported runtimes report an error; check the selected engine/model and browser capabilities before retrying. Long saved segments are processed in bounded 25-second windows with 1.6 seconds of shared boundary context so no audio tail is discarded. Boundary words may repeat; the retry does not infer word alignment or silently remove repeated speech.

**Qwen HTTP** and **Whisper HTTP** remain supported. Native **Browser SpeechRecognition** can process existing saved segments only when safe external-audio-track support is verified, respecting local/remote-processing policy and language-pack requirements. Unsupported external audio fails explicitly and never falls back to the microphone. This does not add recording to native Browser live capture: original live speech is still not saved. Retries include at least 800 ms of available boundary context, preserve earlier attempts, and never edit the composer or execute voice commands.

## Runtime diagnostics

The optional debugger adds a **Runtimes** tab once a model load has been attempted, including loading, failed and released models. It displays the pinned model/revision, encoder/decoder precision, requested WebGPU/WASM provider, worker liveness, runtime versions and identity, load round-trip/worker timings, last inference duration, audio duration and processing/audio ratio, queues, completed/failed counts, and the last 100 content-free lifecycle events. WebGPU initialization is not per-operator GPU profiling.

Memory values are deliberately scoped: complete download and cached-file byte counts are storage, not RAM; accounted PCM covers only queued/active input buffers, not internal tensors or all copies. Optional page JavaScript heap is non-standard/page-wide and excludes full workers/WASM/GPU memory. Actual model RAM and VRAM remain unavailable, rather than being guessed from download size. Reading diagnostics never downloads models or initializes workers. No audio, transcript or free-form exception is retained in runtime events.

## Updating browser runtimes

The worker URL includes a runtime identity derived from the protocol and pinned model catalog. Every worker reply must match that identity. Old workers now report an outdated runtime rather than claiming a supported model is incompatible. Packaged worker/runtime responses use `private, no-store` because development builds can change under the same package version. Model downloads remain separately cached and do not need to be repeated to fix a worker mismatch. If the updated frontend detects an outdated worker, refresh the page; if the server still serves old assets, load the updated Live Voice backend in DSH before retrying. Never disable authentication or delete all browser data as a workaround.

## Provenance and implementation

Whisper uses [Transformers.js 4.3.1](https://github.com/huggingface/transformers.js/tree/4.3.1) (Apache-2.0), [OpenAI Whisper](https://github.com/openai/whisper/blob/main/LICENSE) (MIT), and pinned [onnx-community models](https://huggingface.co/onnx-community), including [multilingual medium](https://huggingface.co/onnx-community/whisper-medium_timestamped/tree/9fe933aaa6b0244316eb961f36d33dfedf0c0b0c) and [large v3 turbo](https://huggingface.co/onnx-community/whisper-large-v3-turbo/tree/360ebcde2559d60bb474678be3c1de9ef347d01a). The medium repository includes timestamp-capable graphs, but this adapter explicitly disables timestamps and uses the original multilingual model, not an English-only or language-fine-tuned variant. Qwen uses [the Apache-2.0 layout-v2 model](https://huggingface.co/jiangzhuo9357/Qwen3-ASR-0.6B-ONNX/tree/4a01b95fafe2c9e3af77e33c18bbb7de349c62f6), with an independently implemented log-mel/prompt/embedding/decoder adapter. Stock Transformers.js does **not** provide a Qwen3-ASR model class. No Sokuji AGPL implementation code is included.

Both ASR runtimes use [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) (MIT), pinned to 1.31.0-dev.20260914-8d85527a0; a separate npm alias prevents changing the existing Silero VAD runtime. Exact repositories, revisions, filenames and byte counts are allowlisted in the model catalog. The inference worker is cache-only: it does not fetch missing model files or upload audio. Runtime cancellation terminates the worker because ONNX inference itself does not expose reliable in-flight abort.

## Validation boundaries

Actual Chrome 155 on an Apple Metal 3 adapter accepted the pinned Whisper Tiny model with both WASM and WebGPU, and Qwen 0.6B with WebGPU using the public 11-second JFK sample. Explicit downloads, cached page reload, and inference with no external model/audio requests were checked in isolated browser harnesses. The Qwen download failed with a CacheStorage internal error in an incognito context but succeeded in an isolated normal disk-backed profile. Use a normal browser profile for large models; available quota does not guarantee private-mode blob storage will succeed. A separate synthetic Portuguese sample was also transcribed in Portuguese by Tiny on WASM and WebGPU, and by Large v3 Turbo on WebGPU, with both Automatic and explicit pt-BR language. The non-f16 small (302 MB), medium and large v3 turbo q4 variants also passed Portuguese Automatic and pt-BR transcription in actual Chrome WebGPU. Medium additionally passed through the actual authenticated GUI assets on port 3081 without intercepted runtime routes. Their separate CPU/WASM attempts did not complete within the test window and were stopped; a working or practical CPU fallback for these large models is not established. These are one-device, known-sample checks—not universal hardware, accuracy, performance or physical-microphone acceptance.

CPU/fake-ORT tests validate Qwen preprocessing, graph contracts, prompts, bounded decode, and disposal. They are not GPU quality or performance acceptance. Browser acceptance results must separately identify actual downloads, cache reuse, runtime initialization, known-audio transcription, GPU capability and hardware/runtime limitations. Physical microphone and authenticated plugin-manager installation require separate testing.
