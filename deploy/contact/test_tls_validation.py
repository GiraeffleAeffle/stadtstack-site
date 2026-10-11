"""Local real-X509 public-certificate tests; no cluster or production private keys."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import release

HOST = 'contact-test.example.invalid'


class TLSValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.directory.cleanup)
        root = Path(cls.directory.name)
        key = root / 'ephemeral-test.key'
        valid = root / 'valid.crt'
        near_expiry = root / 'near-expiry.crt'
        # Private material is synthetic, silent, owner-only and removed with the fixture.
        subprocess.run(['openssl', 'req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256',
                        '-noenc', '-subj', '/CN=' + HOST, '-addext', 'subjectAltName=DNS:' + HOST,
                        '-days', '2', '-keyout', str(key), '-out', str(valid)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        key.chmod(0o600)
        expires = (datetime.now(timezone.utc) + timedelta(hours=1)).strftime('%Y%m%d%H%M%SZ')
        subprocess.run(['openssl', 'x509', '-in', str(valid), '-key', str(key), '-not_after', expires,
                        '-out', str(near_expiry)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        cls.valid = valid.read_bytes()
        cls.near_expiry = near_expiry.read_bytes()
        key.unlink()

    def test_matching_public_certificate_checks_expiry_and_hostname_separately(self):
        with patch.object(release, 'run', wraps=release.run) as observed:
            release.verify_tls_leaf(self.valid, HOST)
        self.assertEqual(observed.call_count, 2)
        commands = [call.args[0] for call in observed.call_args_list]
        self.assertIn('-checkend', commands[0])
        self.assertNotIn('-checkhost', commands[0])
        self.assertIn('-checkhost', commands[1])
        self.assertNotIn('-checkend', commands[1])

    def test_wrong_hostname_is_rejected(self):
        with self.assertRaises(release.Refusal):
            release.verify_tls_leaf(self.valid, 'different.example.invalid')

    def test_less_than_24_hours_validity_is_rejected(self):
        with self.assertRaises(release.Refusal):
            release.verify_tls_leaf(self.near_expiry, HOST)
