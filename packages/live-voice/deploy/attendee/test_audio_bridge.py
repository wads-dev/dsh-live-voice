"""Isolated integration checks; never starts a bot or contacts a meeting."""
import asyncio
import importlib.util
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import urllib.request
from pathlib import Path
import ssl
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("audio_bridge", Path(__file__).with_name("audio_bridge.py"))
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class RelayTest(unittest.IsolatedAsyncioTestCase):
    async def test_api_admission_is_bounded_without_queueing_extra_auth_requests(self):
        from types import SimpleNamespace
        from threading import Event, Lock
        gate = Event()
        lock = Lock()
        started = []
        def slow_auth(_):
            with lock:
                started.append(True)
            gate.wait(timeout=2)
            return True
        relay = bridge.Relay()
        connection = SimpleNamespace(respond=lambda status, body: status)
        request = SimpleNamespace(path="/v1/receive", headers={"Authorization": "Token test-only-key"})
        with patch.object(bridge, "authorized", slow_auth):
            tasks = [asyncio.create_task(relay.process_request(connection, request)) for _ in range(4)]
            try:
                for _ in range(100):
                    if len(started) == 4:
                        break
                    await asyncio.sleep(0.005)
                self.assertEqual(len(started), 4)
                self.assertEqual(await relay.process_request(connection, request), bridge.HTTPStatus.SERVICE_UNAVAILABLE)
                self.assertEqual(len(started), 4)
            finally:
                gate.set()
                await asyncio.gather(*tasks)

    async def test_real_tls_audio_ownership_and_revocation(self):
        from websockets.asyncio.server import serve
        from websockets.asyncio.client import connect
        from websockets.exceptions import InvalidStatus
        with tempfile.TemporaryDirectory() as directory:
            bridge.PUBLIC = Path(directory) / "public"
            bridge.PRIVATE = Path(directory) / "private"
            bridge.provision()
            first = (bridge.PUBLIC / "server.pem").read_bytes()
            (bridge.PUBLIC / "ca-bundle.pem").unlink()
            bridge.provision()
            self.assertIn(first, (bridge.PUBLIC / "ca-bundle.pem").read_bytes())
            self.assertEqual(first, (bridge.PUBLIC / "server.pem").read_bytes())
            self.assertEqual((bridge.PRIVATE / "server.key").stat().st_mode & 0o777, 0o600)
            server_tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            server_tls.load_cert_chain(bridge.PUBLIC / "server.pem", bridge.PRIVATE / "server.key")
            client_tls = ssl.create_default_context(cafile=str(bridge.PUBLIC / "ca-bundle.pem"))
            relay = bridge.Relay()
            with patch.object(bridge, "authorized", lambda value: value == "Token test-only-key"):
                async with serve(relay.handler, "127.0.0.1", 0, ssl=server_tls, process_request=relay.process_request,
                                 max_size=bridge.MAX_MESSAGE, max_queue=16, compression=None) as server:
                    origin = "wss://127.0.0.1:" + str(server.sockets[0].getsockname()[1])
                    loop = asyncio.get_running_loop()
                    original_handler = loop.get_exception_handler()
                    def expected_tls_reset(loop, context):
                        if isinstance(context.get("exception"), ConnectionResetError):
                            return
                        if original_handler:
                            original_handler(loop, context)
                        else:
                            loop.default_exception_handler(context)
                    loop.set_exception_handler(expected_tls_reset)
                    self.addCleanup(loop.set_exception_handler, original_handler)
                    with self.assertRaises(ssl.SSLCertVerificationError):
                        async with connect(origin + "/v1/receive"):
                            self.fail("Untrusted certificate admitted")
                    for path, headers in [("/v1/receive", {}), ("/v1/receive", {"Authorization": "Token test-only-key", "Origin": "https://foreign.example"}), ("/ingest?token=bad", {}), ("/ingest?token=%C3%A9", {})]:
                        with self.assertRaises(InvalidStatus):
                            async with connect(origin + path, ssl=client_tls, additional_headers=headers):
                                self.fail("Unauthorized peer admitted")
                    async with connect(origin + "/v1/receive", ssl=client_tls, additional_headers={"Authorization": "Token test-only-key"}) as consumer:
                        ready = json.loads(await consumer.recv())
                        self.assertEqual(ready["type"], "ready")
                        token = ready["ingestUrl"].split("token=")[1]
                        self.assertEqual(len(token), 64)
                        async with connect(origin + "/ingest?token=" + token, ssl=client_tls) as producer:
                            packet = json.dumps({"trigger": "realtime_audio.per_participant", "bot_id": "bot_Test", "data": {"participant_uuid": "device/1", "chunk": "AAAAAA==", "timestamp_ms": 1000, "sample_rate": 16000}})
                            await producer.send(packet)
                            self.assertEqual(await consumer.recv(), packet)
                            with self.assertRaises(InvalidStatus):
                                async with connect(origin + "/ingest?token=" + token, ssl=client_tls):
                                    self.fail("Second producer admitted")
                            await consumer.close()
                            await asyncio.wait_for(producer.wait_closed(), 2)
                    await asyncio.sleep(0)
                    with self.assertRaises(InvalidStatus):
                        async with connect(origin + "/ingest?token=" + token, ssl=client_tls):
                            self.fail("Expired token admitted")
                    for payload in [b"binary-is-not-audio-json", "x" * (bridge.MAX_MESSAGE + 1)]:
                        async with connect(origin + "/v1/receive", ssl=client_tls, additional_headers={"Authorization": "Token test-only-key"}) as consumer:
                            ready = json.loads(await consumer.recv())
                            token = ready["ingestUrl"].split("token=")[1]
                            async with connect(origin + "/ingest?token=" + token, ssl=client_tls) as producer:
                                await producer.send(payload)
                                await asyncio.wait_for(consumer.wait_closed(), 2)
                                self.assertEqual(consumer.close_code, 1008)
                                await asyncio.wait_for(producer.wait_closed(), 2)
                        await asyncio.sleep(0)
                    async with connect(origin + "/v1/receive", ssl=client_tls, additional_headers={"Authorization": "Token test-only-key"}) as consumer:
                        await consumer.recv()
                        await consumer.send("unsolicited-write")
                        await asyncio.wait_for(consumer.wait_closed(), 2)
                        self.assertEqual(consumer.close_code, 1008)
            self.assertIsNone(relay.lease)


class AuthenticationTest(unittest.TestCase):
    def test_real_http_auth_rejects_bad_keys_redirects_and_malformed_headers(self):
        calls = []
        class Api(BaseHTTPRequestHandler):
            def do_GET(self):
                calls.append((self.path, self.headers.get("Authorization")))
                if self.headers.get("Host") != "localhost:8000":
                    self.send_response(400)
                    self.end_headers()
                    return
                if self.path == "/redirect-target":
                    self.send_response(200)
                elif self.headers.get("Authorization") == "Token redirect-key":
                    self.send_response(302)
                    self.send_header("Location", "/redirect-target")
                elif self.headers.get("Authorization") == "Token valid-test-key":
                    self.send_response(200)
                else:
                    self.send_response(401)
                self.end_headers()
            def log_message(self, *_):
                pass
        api = ThreadingHTTPServer(("127.0.0.1", 0), Api)
        thread = Thread(target=api.serve_forever, daemon=True)
        thread.start()
        real_request = urllib.request.Request
        def route_request(url, **kwargs):
            self.assertEqual(url, "http://attendee-app-local:8000/api/v1/bots?limit=1")
            return real_request("http://127.0.0.1:" + str(api.server_port) + "/api/v1/bots?limit=1", **kwargs)
        try:
            with patch.dict("os.environ", {"http_proxy": "http://127.0.0.1:1", "HTTP_PROXY": "http://127.0.0.1:1", "no_proxy": "", "NO_PROXY": ""}), patch.object(bridge.urllib.request, "Request", route_request):
                self.assertTrue(bridge.authorized("Token valid-test-key"))
                self.assertFalse(bridge.authorized("Token invalid-key"))
                self.assertFalse(bridge.authorized("Token redirect-key"))
                count = len(calls)
                for header in [None, "", "Bearer valid-test-key", "Token x\r\nHost: evil", "Token nonascii-é", "Token " + "x" * 520]:
                    self.assertFalse(bridge.authorized(header))
                self.assertEqual(len(calls), count)
                self.assertEqual(len(calls), 3, "Redirect must not leak the key to a follow-up request")
        finally:
            api.shutdown()
            api.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
