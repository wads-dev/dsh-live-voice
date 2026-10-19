# Compose-managed Attendee audio

These deployment assets are included in the Live Voice plugin. They complement the existing Attendee development Compose stack; they are not a separate package, host daemon or public proxy.

## Start

Set `DSH_LIVE_VOICE_DEPLOY` to this directory’s absolute path. Append `-f "$DSH_LIVE_VOICE_DEPLOY/compose.dsh-audio.yaml"` to the same Compose command you already use for Attendee, preserving every ARM64/FakeCloud override, then run `up -d`. The default image is `attendee-local:arm64`; set `DSH_ATTENDEE_IMAGE` to a compatible existing Attendee image if needed. The image must include Python, cryptography and websockets 14.1. No new image download is required when that image already exists.

Compose provisions deployment-local TLS material in two named volumes and configures the worker’s `SSL_CERT_FILE`. The private key is mounted only in the initializer/relay, never the worker. A loopback-only descriptor (18766) gives the local plugin the public certificate; the host verifies TLS on its receiving connection (18765). The worker verifies the internal `dsh-audio-bridge` name with the public bundle. This trusts the local machine/Docker environment, not a hostile process that can impersonate loopback services. Never forward these ports. The relay validates the project API key against `attendee-app-local` before providing an ephemeral producer URL. The request uses the fixed `localhost:8000` Host header expected by the upstream development Django configuration, not a caller-controlled host. The loopback ports are 18765/18766, avoiding the memory service’s common 8765 port.

In DSH, connect to Attendee without setting an advanced receiver URL. The plugin discovers the bridge and coordinates its secret URL automatically when creating a bot. Disconnecting DSH only revokes reception; explicitly use Leave meeting for the bot to depart.

## Lifecycle and limits

- No Docker socket, arbitrary proxy destination, DSH credentials or host filesystem is exposed by the relay.
- One consumer and one producer at a time; 128 KB messages, bounded WebSocket queues, no compression or replay. Slow/invalid/disconnected sessions close rather than silently archive/drop audio.
- The certificate lasts 90 days and is reused until near expiry. The initializer renews it on its next execution; recreate the initializer and bridge together for renewal. Mounted public roots are used for new worker TLS connections. Restart dependent workers outside meetings if required. Continuous unattended renewal is not implemented.
- Recreating workers to apply the override interrupts their active bots. Do not apply it during a meeting.
- Stop with the same Compose file set. Removing named volumes deletes TLS material; regenerate it by rerunning the initializer. Do not remove the existing Postgres/FakeCloud volumes.
- This override targets upstream development service names and the same-machine Docker setup. Remote Docker, custom service names and arbitrary bridge ports are not automatically discovered.

## Isolated test

From the plugin checkout, with its compatible Attendee image already built:

```sh
docker run --rm --network none --entrypoint python -v "$PWD/packages/live-voice/deploy/attendee:/dsh:ro" attendee-local:arm64 /dsh/test_audio_bridge.py
```

This checks TLS, certificate/bundle reuse, capability rejection, binary/oversize rejection, receive-only policy, forwarding and revocation in a disposable container. A separate HTTP test exercises the real credential-verification function against a local fixture API, including 401, malformed headers and redirect refusal. The WebSocket test stubs only its API admission callback. It does not start a bot or contact Meet. See the repository Attendee guide for full runtime acceptance limits.

## Cross-runtime verification

From the repository root, run `node scripts/test-attendee-relay.mjs` to connect the actual Node host consumer to the actual Python relay in a disposable container. It publishes random loopback ports, sends PCM from two UUIDs, and checks producer revocation when the receiver closes. Its authentication callback accepts only a fixture key; it never creates a bot, calls Meet, imports host certificates or recreates production services. The runner stops its exact named container on failure and removes it on normal exit. It requires Docker and the existing compatible image, so it is an explicit integration check rather than part of `npm test`.
