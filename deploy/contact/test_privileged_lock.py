"""Local temporary-directory tests only; no real shared lock or session."""
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from privileged_lock import PrivilegedLock


class PrivilegedLockTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "lock"

    def test_standalone_acquires_and_releases_only_its_directory(self):
        with patch.dict(os.environ, {}, clear=True):
            lock = PrivilegedLock(self.path)
            lock.acquire()
            lock.check()
            self.assertTrue((self.path / "owner").is_file())
            lock.release()
            self.assertFalse(self.path.exists())

    def prepare_runner(self):
        owner = "contact-runner-" + "a" * 32
        self.path.mkdir(mode=0o700)
        (self.path / "owner").write_text(owner + "\n")
        (self.path / "owner").chmod(0o600)
        return owner

    def test_exact_delegation_never_releases_runner_lock(self):
        owner = self.prepare_runner()
        with patch.dict(os.environ, {"STADTSTACK_PRIVILEGED_LOCK_OWNER": owner}, clear=True):
            lock = PrivilegedLock(self.path)
            lock.acquire()
            lock.check()
            lock.release()
        self.assertEqual((self.path / "owner").read_text(), owner + "\n")

    def test_foreign_delegation_refuses_without_mutation(self):
        owner = self.prepare_runner()
        with patch.dict(os.environ, {"STADTSTACK_PRIVILEGED_LOCK_OWNER": "foreign-runner-" + "b" * 32}, clear=True):
            with self.assertRaises(ValueError):
                PrivilegedLock(self.path).acquire()
        self.assertEqual((self.path / "owner").read_text(), owner + "\n")

    def test_existing_without_delegation_refuses(self):
        self.prepare_runner()
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(FileExistsError):
                PrivilegedLock(self.path).acquire()

    def test_changed_owner_refuses_operation_and_cleanup(self):
        with patch.dict(os.environ, {}, clear=True):
            lock = PrivilegedLock(self.path)
            lock.acquire()
            (self.path / "owner").write_text("someone-else\n")
            with self.assertRaises(ValueError):
                lock.check()
            with self.assertRaises(ValueError):
                lock.release()
        self.assertTrue(self.path.exists())

    def test_owner_symlink_is_refused(self):
        owner = self.prepare_runner()
        (self.path / "owner").unlink()
        target = Path(self.temp.name) / "foreign"
        target.write_text(owner + "\n")
        target.chmod(0o600)
        (self.path / "owner").symlink_to(target)
        with patch.dict(os.environ, {"STADTSTACK_PRIVILEGED_LOCK_OWNER": owner}, clear=True):
            with self.assertRaises(ValueError):
                PrivilegedLock(self.path).acquire()
