import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from django.test import SimpleTestCase, override_settings
from py_vapid import Vapid

from notifications.push import vapid_key


def keys():
    key = ec.generate_private_key(ec.SECP256R1())
    pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()
    der = key.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    return pem, base64.urlsafe_b64encode(der).decode().rstrip("=")


class VapidKeyTests(SimpleTestCase):
    """pywebpush solo lee la clave en base64; en PEM fallaba sin avisar al enviar el push."""

    def sign(self, value):
        vapid = value if isinstance(value, Vapid) else Vapid.from_string(private_key=value)
        return vapid.sign({"sub": "mailto:equipo@localizat.test", "aud": "https://fcm.googleapis.com"})

    def test_accepts_pem_and_base64_keys(self):
        pem, b64 = keys()
        for key in (pem, b64):
            with self.subTest(formato="PEM" if "BEGIN" in key else "base64"), override_settings(VAPID_PRIVATE_KEY=key):
                self.assertIn("Authorization", self.sign(vapid_key()))
