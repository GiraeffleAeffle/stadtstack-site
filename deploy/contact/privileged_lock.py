"""Nested helper ownership checks; only session.py acquires/releases the Lease."""
import importlib.util
from pathlib import Path

def load_session():
    spec = importlib.util.spec_from_file_location(
        'stadtstack_session', '/Users/max/.cache/cluster-ops/governance/session.py')
    session = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(session)
    return session


class PrivilegedLock:
    def __init__(self, path, *, runner=False):
        self.session = load_session()
        self.path = Path(path)
        if self.path != self.session.MAC / 'privileged-session.lock':
            raise self.session.Refused('Noncanonical helper lock')
        self.owner = None
        self.directory = None

    def acquire(self):
        self.owner = self.session.assert_delegated()
        self.directory = self.session.Directory(self.path, self.owner)
        info = self.path.lstat()
        self.directory.identity = (info.st_dev, info.st_ino)
        self.check()

    def check(self):
        if self.owner is None or self.session.assert_delegated() != self.owner:
            raise self.session.Refused('Nested helper owner differs')
        self.directory.check()

    def release(self):
        # The outer supervisor alone restores the viewer and releases both locks.
        self.check()
