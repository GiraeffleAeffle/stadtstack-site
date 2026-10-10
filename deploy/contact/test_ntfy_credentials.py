"""Local-only tests; mock Keychain/kubectl, never open a privileged session.

Run explicitly after the main agent finishes integration:
  python3 -m unittest discover -s deploy/contact -p 'test_ntfy_credentials.py'
Requires the owner-reviewed Python bcrypt dependency. No live ntfy test is made.
"""
import base64
from contextlib import redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import Mock, patch

import bcrypt

DIRECTORY = Path(__file__).resolve().parent
sys.path.insert(0, str(DIRECTORY))
SPEC = importlib.util.spec_from_file_location("ntfy_credentials", DIRECTORY / "ntfy-credentials.py")
credentials = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(credentials)


class InboxCustodyTests(unittest.TestCase):
    def test_new_random_custody_precedes_private_secret_write(self):
        release = credentials.release
        custody = Mock()
        custody.read.side_effect = [None, None]
        calls = []
        def kc(*args, **kwargs):
            calls.append((args, kwargs))
            return 0, b""
        output = io.StringIO()
        with patch.object(release, "Keychain", return_value=custody), patch.object(release, "confirm"), redirect_stdout(output):
            release.bootstrap_inbox(kc, Mock(), "approved-context")
        self.assertEqual(custody.create.call_count, 2)
        manifest = json.loads(calls[-1][1]["data"])
        fields = manifest["stringData"]
        self.assertEqual(len(base64.b64decode(fields["CONTACT_ENCRYPTION_KEY"])), 32)
        self.assertGreaterEqual(len(fields["CONTACT_ADMIN_TOKEN"]), 32)
        self.assertTrue(calls[-1][1]["private"])
        for value in fields.values():
            self.assertNotIn(value, output.getvalue())
            self.assertNotIn(value, repr(calls[-1][0]))

    def test_existing_without_custody_never_replaces(self):
        release = credentials.release
        custody = Mock()
        custody.read.side_effect = [None, None]
        kc = Mock(return_value=(0, b"secret/stadtstack-contact-inbox"))
        with patch.object(release, "Keychain", return_value=custody), patch.object(release, "confirm"):
            with self.assertRaises(release.Refusal):
                release.bootstrap_inbox(kc, Mock(), "approved-context")
        custody.create.assert_not_called()
        self.assertEqual(kc.call_count, 1)

    def test_refusal_precedes_custody(self):
        release = credentials.release
        with patch.object(release, "Keychain") as custody, patch.object(release, "confirm", side_effect=release.Refusal("refused")):
            with self.assertRaises(release.Refusal):
                release.bootstrap_inbox(Mock(return_value=(0, b"")), Mock(), "approved-context")
        custody.assert_not_called()


class CredentialTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.owner = credentials.new_credential(bcrypt, owner=True)
        cls.publisher = credentials.new_credential(bcrypt, owner=False)

    def test_real_hash_password_and_token_formats(self):
        credentials.validate_credential(self.owner, bcrypt, owner=True)
        credentials.validate_credential(self.publisher, bcrypt, owner=False)
        self.assertTrue(bcrypt.checkpw(self.owner["password"].encode(), self.owner["hash"].encode()))
        self.assertNotIn("password", self.publisher)
        for _ in range(100):
            self.assertRegex(credentials.new_token(), r"^tk_[A-Za-z0-9]{29}$")
        self.assertNotEqual(self.owner["token"], self.publisher["token"])

    def test_only_exact_topic_least_privilege_regular_users(self):
        fields = credentials.secret_fields(self.owner, self.publisher)
        self.assertEqual(set(fields), {"NTFY_AUTH_USERS", "NTFY_AUTH_ACCESS", "NTFY_AUTH_TOKENS"})
        self.assertEqual(fields["NTFY_AUTH_ACCESS"], "owner:contact:ro,contact:contact:wo")
        self.assertEqual(fields["NTFY_AUTH_USERS"],
                         f'owner:{self.owner["hash"]}:user,contact:{self.publisher["hash"]}:user')
        self.assertNotIn(":admin", fields["NTFY_AUTH_USERS"])
        self.assertEqual(fields["NTFY_AUTH_TOKENS"],
                         f'owner:{self.owner["token"]}:owner,contact:{self.publisher["token"]}:contact')

    def test_inbox_patch_preserves_keys_and_metadata(self):
        secret = {"metadata": {"resourceVersion": "42", "labels": {"keep": "yes"}},
                  "data": {"CONTACT_ENCRYPTION_KEY": "unchanged-key", "CONTACT_ADMIN_TOKEN": "unchanged-admin",
                           "OTHER": "keep"}}
        operations = credentials.inbox_patch("42", self.publisher["token"])
        self.assertEqual(operations[0], {"op": "test", "path": "/metadata/resourceVersion", "value": "42"})
        self.assertEqual(operations[1]["path"], "/data/NTFY_TOKEN")
        secret["data"]["NTFY_TOKEN"] = operations[1]["value"]
        self.assertEqual(secret["data"]["CONTACT_ENCRYPTION_KEY"], "unchanged-key")
        self.assertEqual(secret["data"]["CONTACT_ADMIN_TOKEN"], "unchanged-admin")
        self.assertEqual(secret["data"]["OTHER"], "keep")
        self.assertEqual(secret["metadata"], {"resourceVersion": "42", "labels": {"keep": "yes"}})
        self.assertEqual(base64.b64decode(secret["data"]["NTFY_TOKEN"]).decode(), self.publisher["token"])
        with self.assertRaises(credentials.release.Refusal):
            credentials.inbox_patch("", self.publisher["token"])

    def test_publisher_existing_equal_is_noop(self):
        encoded = base64.b64encode(self.publisher["token"].encode()).decode()
        self.assertEqual(credentials.inbox_patch("42", self.publisher["token"], encoded), [])

    def test_publisher_existing_different_refuses(self):
        with self.assertRaises(credentials.release.Refusal):
            credentials.inbox_patch("42", self.publisher["token"], base64.b64encode(b"unknown-token").decode())

    def test_corrupt_custody_is_refused(self):
        for field, value in (("token", "tk_" + "a" * 64), ("hash", "$2b$12$fake"),
                             ("password", "mismatched-password"), ("endpoint", "https://ntfy.sh"),
                             ("topic", "*"), ("version", 2)):
            with self.subTest(field=field):
                with self.assertRaises(credentials.release.Refusal):
                    credentials.validate_credential({**self.owner, field: value}, bcrypt, owner=True)

    def cluster(self, *, existing=None, ready=b"42", publisher_token=""):
        writes = []

        def kc(*arguments, capture=False, **kwargs):
            if capture:
                if credentials.release.SECRET in arguments:
                    return ready + b"\n" + publisher_token.encode()
                return json.dumps(existing).encode() if existing is not None else b""
            if "get" in arguments:
                return 0, ready
            writes.append((arguments, kwargs))
            return 0, b""

        return kc, writes

    def custody(self, *, owner=None, publisher=None):
        keychain = Mock()
        keychain.read.side_effect = [owner, publisher]
        return keychain

    def auth_secret(self):
        return {"type": "Opaque", "data": {key: base64.b64encode(value.encode()).decode()
                for key, value in credentials.secret_fields(self.owner, self.publisher).items()}}

    def test_confirmation_precedes_keychain_access_and_writes(self):
        kc, writes = self.cluster()
        keychain = self.custody()
        with patch.object(credentials.release, "confirm", side_effect=credentials.release.Refusal("refused")):
            with self.assertRaises(credentials.release.Refusal):
                credentials.bootstrap(kc, Mock(), keychain, bcrypt, "approved-context")
        keychain.read.assert_not_called()
        keychain.create.assert_not_called()
        self.assertEqual(writes, [])

    def test_missing_inbox_refuses_before_custody_or_confirmation(self):
        kc, writes = self.cluster(ready=b"")
        keychain = self.custody()
        with patch.object(credentials.release, "confirm") as confirm:
            with self.assertRaises(credentials.release.Refusal):
                credentials.bootstrap(kc, Mock(), keychain, bcrypt, "approved-context")
        confirm.assert_not_called()
        keychain.read.assert_not_called()
        self.assertEqual(writes, [])

    def test_fresh_bootstrap_creates_secrets_privately(self):
        kc, writes = self.cluster()
        keychain = self.custody()
        output = io.StringIO()
        with patch.object(credentials.release, "confirm") as confirm, redirect_stdout(output):
            credentials.bootstrap(kc, Mock(), keychain, bcrypt, "approved-context")
        confirm.assert_called_once_with("bootstrap ntfy Keychain and secrets stadtstack-contact approved-context")
        self.assertEqual(keychain.create.call_count, 2)
        owner = keychain.create.call_args_list[0].args[2]
        publisher = keychain.create.call_args_list[1].args[2]
        self.assertEqual(keychain.create.call_args_list[0].args[:2], (credentials.OWNER_SERVICE, "owner"))
        self.assertEqual(keychain.create.call_args_list[1].args[:2], (credentials.PUBLISHER_SERVICE, "contact"))
        self.assertEqual(len(writes), 2)
        manifest = json.loads(writes[0][1]["data"])
        self.assertEqual(manifest["metadata"], {"name": "stadtstack-contact-ntfy", "namespace": "stadtstack-contact"})
        self.assertEqual(manifest["stringData"], credentials.secret_fields(owner, publisher))
        self.assertEqual(json.loads(writes[1][1]["data"]), credentials.inbox_patch("42", publisher["token"]))
        for _, kwargs in writes:
            self.assertIs(kwargs["private"], True)
        for secret in (owner["password"], owner["token"], publisher["token"], owner["hash"], publisher["hash"]):
            self.assertNotIn(secret, output.getvalue())

    def test_exact_existing_custody_resumes_without_rotation(self):
        kc, writes = self.cluster(existing=self.auth_secret(), publisher_token=base64.b64encode(self.publisher["token"].encode()).decode())
        keychain = self.custody(owner=self.owner, publisher=self.publisher)
        with patch.object(credentials.release, "confirm"), redirect_stdout(io.StringIO()):
            credentials.bootstrap(kc, Mock(), keychain, bcrypt, "approved-context")
        keychain.create.assert_not_called()
        self.assertEqual(writes, [])

    def test_unknown_existing_publisher_token_refuses_without_cluster_writes(self):
        kc, writes = self.cluster(existing=self.auth_secret(), publisher_token=base64.b64encode(b"unknown-token").decode())
        keychain = self.custody(owner=self.owner, publisher=self.publisher)
        with patch.object(credentials.release, "confirm"):
            with self.assertRaises(credentials.release.Refusal):
                credentials.bootstrap(kc, Mock(), keychain, bcrypt, "approved-context")
        keychain.create.assert_not_called()
        self.assertEqual(writes, [])

    def test_existing_secret_without_custody_is_never_replaced(self):
        kc, writes = self.cluster(existing=self.auth_secret())
        keychain = self.custody()
        with patch.object(credentials.release, "confirm"):
            with self.assertRaises(credentials.release.Refusal):
                credentials.bootstrap(kc, Mock(), keychain, bcrypt, "approved-context")
        keychain.create.assert_not_called()
        self.assertEqual(writes, [])

    def test_mismatching_existing_secret_is_never_replaced(self):
        secret = self.auth_secret()
        secret["data"]["NTFY_AUTH_ACCESS"] = base64.b64encode(b"owner:*:rw").decode()
        kc, writes = self.cluster(existing=secret)
        keychain = self.custody(owner=self.owner, publisher=self.publisher)
        with patch.object(credentials.release, "confirm"):
            with self.assertRaises(credentials.release.Refusal):
                credentials.bootstrap(kc, Mock(), keychain, bcrypt, "approved-context")
        self.assertEqual(writes, [])

    def test_partial_keychain_setup_reuses_owner(self):
        kc, writes = self.cluster()
        keychain = self.custody(owner=self.owner)
        with patch.object(credentials.release, "confirm"), redirect_stdout(io.StringIO()):
            credentials.bootstrap(kc, Mock(), keychain, bcrypt, "approved-context")
        keychain.create.assert_called_once()
        self.assertEqual(keychain.create.call_args.args[:2], (credentials.PUBLISHER_SERVICE, "contact"))
        self.assertIn(self.owner["hash"], json.loads(writes[0][1]["data"])["stringData"]["NTFY_AUTH_USERS"])

    def test_private_read_errors_do_not_include_secret_response(self):
        response = subprocess.CompletedProcess(["kubectl"], 1, stdout=b"secret-response", stderr=b"secret-error")
        with patch.object(credentials.subprocess, "run", return_value=response) as run:
            with self.assertRaises(credentials.release.Refusal) as caught:
                credentials.private_capture(["kubectl"])
        self.assertNotIn("secret-response", str(caught.exception))
        self.assertNotIn("secret-error", str(caught.exception))
        self.assertEqual(run.call_args.kwargs["stderr"], subprocess.DEVNULL)


if __name__ == "__main__":
    unittest.main()
