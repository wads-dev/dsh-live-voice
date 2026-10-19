"""Disposable cross-runtime fixture. Fake API admission, real relay/TLS/PCM."""
import asyncio
import json
from pathlib import Path
import ssl
import tempfile
from threading import Thread
from http.server import ThreadingHTTPServer
import audio_bridge as bridge
from websockets.asyncio.server import serve
from websockets.asyncio.client import connect


async def main():
    with tempfile.TemporaryDirectory() as directory:
        bridge.PUBLIC = Path(directory) / "public"
        bridge.PRIVATE = Path(directory) / "private"
        bridge.provision()
        bridge.authorized = lambda header: header == "Token cross-runtime-test-key"
        tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        tls.load_cert_chain(bridge.PUBLIC / "server.pem", bridge.PRIVATE / "server.key")
        client_tls = ssl.create_default_context(cafile=str(bridge.PUBLIC / "ca-bundle.pem"))
        relay = bridge.Relay()
        descriptor = ThreadingHTTPServer(("0.0.0.0", 18766), bridge.Descriptor)
        Thread(target=descriptor.serve_forever, daemon=True).start()
        async with serve(relay.handler, "0.0.0.0", 18765, ssl=tls, process_request=relay.process_request,
                         max_size=bridge.MAX_MESSAGE, max_queue=16, compression=None):
            print("fixture-ready", flush=True)
            for _ in range(2000):
                if relay.lease:
                    break
                await asyncio.sleep(0.01)
            if not relay.lease:
                raise RuntimeError("receiver deadline exceeded")
            token = relay.lease["token"]
            async with connect("wss://localhost:18765/ingest?token=" + token, ssl=client_tls) as producer:
                for uuid in ["device/python-one", "device/python-two"]:
                    await producer.send(json.dumps({"trigger":"realtime_audio.per_participant","bot_id":"bot_CrossRuntime","data":{"participant_uuid":uuid,"chunk":"AID/fw==","sample_rate":16000,"timestamp_ms":1000}}))
                await asyncio.wait_for(producer.wait_closed(), 15)
            print("producer-revoked", flush=True)
            descriptor.shutdown()
            descriptor.server_close()


if __name__ == "__main__":
    asyncio.run(main())
