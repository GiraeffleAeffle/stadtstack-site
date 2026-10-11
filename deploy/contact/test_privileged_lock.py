"""Nested-helper contract; no live API, credentials or installed paths touched."""
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from privileged_lock import PrivilegedLock


class PrivilegedLockTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.path = self.base / 'privileged-session.lock'
        self.path.mkdir(mode=0o700)
        self.owner = 'mac-' + 'a' * 48
        (self.path / 'owner').write_text(self.owner + '\n')
        self.directory = Mock()
        self.session = SimpleNamespace(MAC=self.base, Refused=RuntimeError,
                                       assert_delegated=Mock(return_value=self.owner),
                                       Directory=Mock(return_value=self.directory))
        patcher = patch('privileged_lock.load_session', return_value=self.session)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_both_runners_and_helpers_only_delegate(self):
        for runner in (False, True):
            lock = PrivilegedLock(self.path, runner=runner)
            lock.acquire()
            lock.check()
            lock.release()
            self.assertEqual((self.path / 'owner').read_text(), self.owner + '\n')
        self.directory.acquire.assert_not_called()
        self.directory.release.assert_not_called()

    def test_missing_global_delegation_refuses(self):
        self.session.assert_delegated.side_effect = RuntimeError('Lease not held')
        with self.assertRaises(RuntimeError):
            PrivilegedLock(self.path, runner=True).acquire()

    def test_changed_global_owner_refuses_cleanup(self):
        lock = PrivilegedLock(self.path)
        lock.acquire()
        self.session.assert_delegated.return_value = 'vm-' + 'b' * 48
        with self.assertRaises(RuntimeError):
            lock.release()
        self.assertTrue(self.path.exists())

    def test_changed_directory_refuses(self):
        lock = PrivilegedLock(self.path)
        lock.acquire()
        self.directory.check.side_effect = RuntimeError('Owner inode changed')
        with self.assertRaises(RuntimeError):
            lock.check()

    def test_noncanonical_path_refuses(self):
        with self.assertRaises(RuntimeError):
            PrivilegedLock(self.base / 'another-lock')


if __name__ == '__main__':
    unittest.main()
