"""Local native-Expect confirmation tests; never credentials, Keychain or cluster."""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import unittest

DIRECTORY = Path(__file__).resolve().parent
sys.path.insert(0, str(DIRECTORY))
import release
SPEC = importlib.util.spec_from_file_location('tty_dns_tls', DIRECTORY / 'ntfy-dns-tls.py')
dns = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(dns)
PHRASE = 'approve only this synthetic local test'


class NativeTTYTests(unittest.TestCase):
    def confirmation(self, module, answer, prompt):
        # Same native controlling-terminal transport as governed release runners.
        script = r'''
set timeout 10
set program {import runpy,sys
from pathlib import Path
sys.path.insert(0,str(Path(sys.argv[1]).parent))
module=runpy.run_path(sys.argv[1])
try:
    module['confirm'](sys.argv[2])
except module['Refusal']:
    sys.exit(19)
}
spawn -noecho $env(TTY_TEST_PYTHON) -I -B -c $program $env(TTY_TEST_MODULE) $env(TTY_TEST_PHRASE)
expect {
    -exact $env(TTY_TEST_PROMPT) {
        send -- "$env(TTY_TEST_ANSWER)\r"
        exp_continue -continue_timer
    }
    eof {
        catch wait result
        exit [lindex $result 3]
    }
    timeout {
        send -- "\003"
        set timeout -1
        expect eof
        catch wait result
        exit 124
    }
}
'''
        environment = dict(os.environ, TTY_TEST_PYTHON=sys.executable, TTY_TEST_MODULE=module.__file__,
                           TTY_TEST_PHRASE=PHRASE, TTY_TEST_ANSWER=answer, TTY_TEST_PROMPT=prompt.decode())
        result = subprocess.run(['/usr/bin/expect', '-c', script], env=environment, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, start_new_session=True, timeout=15, check=False)
        self.assertNotEqual(result.returncode, 124, 'Native confirmation timed out: ' + result.stdout.decode(errors='replace'))
        return result.returncode

    def test_release_accepts_exact_phrase_on_real_controlling_terminal(self):
        self.assertEqual(self.confirmation(release, PHRASE, b'to authorize this write: '), 0)

    def test_release_rejects_different_phrase(self):
        self.assertEqual(self.confirmation(release, 'different phrase', b'to authorize this write: '), 19)

    def test_dns_accepts_exact_phrase_on_real_controlling_terminal(self):
        self.assertEqual(self.confirmation(dns, PHRASE, b'> '), 0)

    def test_dns_rejects_different_phrase(self):
        self.assertEqual(self.confirmation(dns, 'different phrase', b'> '), 19)

    def without_terminal(self, filename):
        program = "import runpy,sys; sys.path.insert(0,sys.argv[1]); module=runpy.run_path(sys.argv[1]+'/'+sys.argv[2]); module['confirm']('synthetic local test')"
        result = subprocess.run([sys.executable, '-I', '-B', '-c', program, str(DIRECTORY), filename],
                                stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                start_new_session=True, timeout=10, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn(b'authorize this write', result.stdout)

    def test_release_has_no_stdin_fallback_without_controlling_terminal(self):
        self.without_terminal('release.py')

    def test_dns_has_no_stdin_fallback_without_controlling_terminal(self):
        self.without_terminal('ntfy-dns-tls.py')
