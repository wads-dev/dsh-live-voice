"""DSH-local audio relay. No shell, generic proxy, recordings, or audio logs."""
import asyncio
import datetime
import hmac
import json
import os
import re
from pathlib import Path
import secrets
import ssl
import urllib.error
import urllib.request
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from urllib.parse import urlsplit, parse_qs
from websockets.exceptions import ConnectionClosed

MAX_MESSAGE = 128000
PUBLIC = Path(os.environ.get("BRIDGE_PUBLIC", "/bridge-public"))
PRIVATE = Path(os.environ.get("BRIDGE_PRIVATE", "/bridge-private"))


def provision():
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID
    import ipaddress
    PUBLIC.mkdir(parents=True, exist_ok=True)
    PRIVATE.mkdir(parents=True, exist_ok=True)
    if (PUBLIC / "server.pem").exists() and (PRIVATE / "server.key").exists():
        try:
            cert = x509.load_pem_x509_certificate((PUBLIC / "server.pem").read_bytes())
            existing_key = serialization.load_pem_private_key((PRIVATE / "server.key").read_bytes(), password=None)
            same_key = existing_key.public_key().public_numbers() == cert.public_key().public_numbers()
            if same_key and cert.not_valid_after_utc > datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2):
                # Repair/rebuild the public bundle if an earlier initializer was interrupted.
                roots = Path("/etc/ssl/certs/ca-certificates.crt").read_bytes()
                (PUBLIC / "ca-bundle.pem").write_bytes(roots + b"\n" + (PUBLIC / "server.pem").read_bytes())
                (PRIVATE / "server.key").chmod(0o600)
                return
        except (ValueError, OSError):
            pass
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "DSH local Attendee audio")])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(x509.random_serial_number()).not_valid_before(now - datetime.timedelta(minutes=5))
            .not_valid_after(now + datetime.timedelta(days=90))
            .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
            .add_extension(x509.SubjectAlternativeName([x509.DNSName("dsh-audio-bridge"), x509.DNSName("localhost"), x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]), critical=False)
            .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
            .sign(key, hashes.SHA256()))
    path = PRIVATE / "server.key"
    path.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    path.chmod(0o600)
    pem = cert.public_bytes(serialization.Encoding.PEM)
    (PUBLIC / "server.pem").write_bytes(pem)
    # Keep public roots for normal Meet HTTPS; add only this deployment's certificate.
    roots = Path("/etc/ssl/certs/ca-certificates.crt").read_bytes()
    (PUBLIC / "ca-bundle.pem").write_bytes(roots + b"\n" + pem)


class Descriptor(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/v1/descriptor":
            self.send_error(404)
            return
        body = json.dumps({"protocol": "dsh-attendee-relay-v1", "certificate": (PUBLIC / "server.pem").read_text()}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def setup(self):
        super().setup()
        self.connection.settimeout(5)

    def log_message(self, *_):
        pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def authorized(header):
    if not header or not re.fullmatch(r"Token [\x21-\x7e]{8,512}", header):
        return False
    request = urllib.request.Request("http://attendee-app-local:8000/api/v1/bots?limit=1", headers={"Authorization": header, "Host": "localhost:8000"})
    try:
        with urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect()).open(request, timeout=5) as response:
            return response.status == 200
    except (OSError, urllib.error.URLError):
        return False


class Relay:
    def __init__(self):
        self.lease = None
        self.lock = asyncio.Lock()
        self.auth_slots = asyncio.Semaphore(4)

    async def process_request(self, connection, request):
        if request.headers.get("Origin"):
            return connection.respond(HTTPStatus.FORBIDDEN, "Forbidden\n")
        path = urlsplit(request.path)
        if path.path == "/v1/receive":
            if self.lease or self.auth_slots.locked():
                return connection.respond(HTTPStatus.SERVICE_UNAVAILABLE, "Busy\n")
            async with self.auth_slots:
                if not await asyncio.to_thread(authorized, request.headers.get("Authorization")):
                    return connection.respond(HTTPStatus.FORBIDDEN, "Forbidden\n")
        elif path.path == "/ingest":
            token = parse_qs(path.query).get("token", [""])[0]
            lease = self.lease
            if not lease or not re.fullmatch(r"[a-f0-9]{64}", token) or not hmac.compare_digest(token, lease["token"]) or lease["producer"]:
                return connection.respond(HTTPStatus.FORBIDDEN, "Forbidden\n")
        else:
            return connection.respond(HTTPStatus.NOT_FOUND, "Not found\n")

    async def handler(self, socket):
        path = urlsplit(socket.request.path)
        if path.path == "/v1/receive":
            async with self.lock:
                if self.lease:
                    await socket.close(1008, "busy")
                    return
                lease = {"consumer": socket, "producer": None, "token": secrets.token_hex(32)}
                self.lease = lease
            try:
                await socket.send(json.dumps({"type": "ready", "ingestUrl": "wss://dsh-audio-bridge:18765/ingest?token=" + lease["token"]}))
                async for _ in socket:
                    # Consumers receive only; unsolicited application writes are invalid.
                    await socket.close(1008, "receive only")
                    break
            except ConnectionClosed:
                pass
            finally:
                if self.lease is lease:
                    self.lease = None
                if lease["producer"]:
                    await lease["producer"].close(1000, "receiver closed")
        else:
            async with self.lock:
                lease = self.lease
                token = parse_qs(path.query).get("token", [""])[0]
                if not lease or lease["producer"] or not re.fullmatch(r"[a-f0-9]{64}", token) or not hmac.compare_digest(token, lease["token"]):
                    await socket.close(1008, "ownership")
                    return
                lease["producer"] = socket
            try:
                async for message in socket:
                    if not isinstance(message, str):
                        raise ValueError("binary")
                    # The plugin performs strict protocol, bot, UUID and PCM validation.
                    await asyncio.wait_for(lease["consumer"].send(message), timeout=5)
            except Exception:
                pass
            finally:
                await lease["consumer"].close(1008, "audio disconnected")


async def run():
    from websockets.asyncio.server import serve
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(PUBLIC / "server.pem", PRIVATE / "server.key")
    relay = Relay()
    descriptor = ThreadingHTTPServer(("0.0.0.0", 18766), Descriptor)
    Thread(target=descriptor.serve_forever, daemon=True).start()
    async with serve(relay.handler, "0.0.0.0", 18765, ssl=context, process_request=relay.process_request,
                     max_size=MAX_MESSAGE, max_queue=16, write_limit=64000, compression=None,
                     open_timeout=8, close_timeout=2, ping_interval=10, ping_timeout=10):
        await asyncio.Future()


if __name__ == "__main__":
    import sys
    if "--init" in sys.argv:
        provision()
    else:
        asyncio.run(run())
