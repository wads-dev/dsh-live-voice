# Google Meet with local Attendee: quickstart

Bring participant-labelled meeting audio into the DSH composer, then review it before sending. This is experimental Google Meet input, not assistant voice playback into the call.

**Unreleased prerequisite:** use a Live Voice source checkout that includes this integration, built and installed in your DSH profile. Do not assume the current npm stable package or a default-branch clone contains it. See [local plugin build/link instructions](../DEVELOPMENT.md#installation-and-local-development-links). The commands below target **Apple Silicon/ARM64, Docker on the same computer as DSH**, and the fork’s FakeCloud development stack—not a production or remote-Docker deployment.

## 1. Clone the compatible Attendee fork

From that Live Voice checkout’s root, with Git and Docker Compose available:

```sh
export DSH_LIVE_VOICE_DEPLOY="$(pwd)/packages/live-voice/deploy/attendee"
test -f "$DSH_LIVE_VOICE_DEPLOY/compose.dsh-audio.yaml"
git clone --branch feat/arm64-fakecloud-local-dev https://github.com/victorwads/attendee.git
cd attendee
git checkout --detach 110f13cbaad729766c650ba644cb98098896b779
```

This pins the public fork revision containing the ARM64/FakeCloud files; it is not an upstream merged-release claim.

## 2. Prepare and start our Compose combination

The fork’s [ARM64/FakeCloud setup guide](https://github.com/victorwads/attendee/blob/110f13cbaad729766c650ba644cb98098896b779/docs/local-arm64.md#start-on-apple-silicon) is the reference for its development prerequisites. Keep all four Compose files below: the last is Live Voice’s audio bridge and local TLS setup.

```sh
dc() {
  docker compose -f dev.docker-compose.yaml -f compose.arm64.yaml \
    -f compose.fakecloud.yaml -f "$DSH_LIVE_VOICE_DEPLOY/compose.dsh-audio.yaml" "$@"
}
dc config --quiet
dc build attendee-app-local
if [ ! -e .env ]; then
  (umask 077; set -C; dc run --rm --no-deps attendee-app-local python init_env.py > .env)
fi
dc up -d postgres redis fakecloud
dc run --rm --no-deps attendee-app-local python scripts/init_local_s3.py
dc run --rm --no-deps attendee-app-local python manage.py migrate
dc up -d --no-build
dc ps
```

Keep the generated `.env`: it contains secrets. Do not commit it, paste it into chat, or regenerate it over an existing installation. FakeCloud avoids needing AWS credentials for this local stack. The build creates the `attendee-local:arm64` image reused by the bridge.

## 3. Obtain a project API key

Open [local Attendee](http://localhost:8000), register a local account and complete the development email-confirmation flow described by the fork (the confirmation email is available in app logs). Create a project key under **API Keys**. Do not paste the key or account-confirmation links into chat or public logs.

**Local development only:** Attendee’s base Compose publishes port 8000 beyond loopback by default. Restrict access with your Docker/network/firewall setup; do not expose this stack to the Internet. Our audio bridge binds ports 18765/18766 to loopback—never forward them. Recreating workers interrupts active bots, so apply setup outside meetings.

## 4. Connect from DSH

1. Restart the DSH host normally after installing/building server changes, then refresh its existing authenticated page. A browser refresh alone does not reload server code.
2. In **Settings → Live Voice → Speech recognition**, select **Whisper HTTP**, **Qwen HTTP**, or a downloaded browser-local model. Native browser SpeechRecognition cannot consume the meeting PCM.
3. In **Conversation → Meeting mode**, set **Default bot name**. Under **Connection settings**, use `http://localhost:8000` as the local API origin. Leave the advanced receiver URL and existing bot ID empty for a new guided meeting; Compose handles WSS/TLS automatically.
4. In advanced **Connection settings**, enter the key and choose **Save API key** once. Saving never starts reception or creates a bot. Replace/remove only through explicit Settings actions; the password stays empty when configured. Storage is a plaintext host file with mode 0600, not OS-encrypted storage, shared by its authenticated browsers; metadata never returns the secret.

## 5. Join, review and leave

Obtain participants’ consent first. Open **Meeting mode → Join Google Meet · experimental**, paste the URL and click **Connect** (or Enter). Only URL and Connect appear here, using the saved Settings name/key to prepare reception and request entry in one explicit action. There is no name override, credential field or local configuration dialog. Missing configuration points to Settings; the organizer may need to admit the bot.

Participant names appear beside their waves as PCM arrives. Review the labelled draft and keep delivery in **Manual** mode if you do not want automatic submission. Changing conversations stops reception; closing a panel does not. If creation times out, inspect Attendee before retrying—an uncertain request may already have created a bot.

Use the single **Disconnect meeting** action: it immediately stops local reception/control and restores URL + Connect, without a discard step or confirmation. Remote departure is attempted with a short timeout; if it cannot be confirmed, a nonblocking warning asks you to check the meeting. The local reset is not proof that the remote bot has ended, and the warning does not prevent reconnecting. Released/expired legacy state uses the same action to reset locally.

**Limits:** upstream overlapping voices are not guaranteed to be isolated; sparse capture bursts are not a continuous meeting archive. Retention and browser storage limits apply. For connection troubleshooting, security, ownership/expiry and validation limits, read the [technical Attendee guide](ATTENDEE.md).
