"""Atomic cluster lock, with explicit owner-file-bound runner delegation."""
import os
from pathlib import Path
import re
import secrets
import stat


class PrivilegedLock:
    def __init__(self, path):
        self.path = Path(path)
        self.delegated = False
        self.identity = None
        self.owner = None

    def acquire(self):
        if not self.path.parent.is_dir() or self.path.is_symlink():
            raise ValueError("Shared lock parent missing or lock symlink; no session opened.")
        delegated = os.environ.get("STADTSTACK_PRIVILEGED_LOCK_OWNER")
        if delegated is not None:
            if re.fullmatch(r"[A-Za-z0-9._-]{16,128}", delegated) is None:
                raise ValueError("Invalid delegated runner identity.")
            self.owner = delegated
            self.delegated = True
        else:
            self.path.mkdir(mode=0o700)  # Existing directory always refuses.
            self.owner = "contact-" + secrets.token_hex(24)
            try:
                fd = os.open(self.path / "owner", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(fd, "w") as handle:
                    handle.write(self.owner + "\n")
            except BaseException:
                self.path.rmdir()
                raise
        self.identity = (self.path.stat().st_dev, self.path.stat().st_ino)
        self.check()

    def check(self):
        directory = self.path.lstat()
        owner_path = self.path / "owner"
        owner_stat = owner_path.lstat()
        if (not stat.S_ISDIR(directory.st_mode) or directory.st_uid != os.getuid() or
                directory.st_mode & 0o077 or (directory.st_dev, directory.st_ino) != self.identity or
                not stat.S_ISREG(owner_stat.st_mode) or owner_stat.st_uid != os.getuid() or owner_stat.st_mode & 0o077 or
                owner_path.read_text() != self.owner + "\n"):
            raise ValueError("Shared lock ownership changed; no further operation authorized.")

    def release(self):
        if self.delegated:
            return  # Session runner alone restores viewer/credentials and releases.
        self.check()
        (self.path / "owner").unlink()
        self.path.rmdir()
