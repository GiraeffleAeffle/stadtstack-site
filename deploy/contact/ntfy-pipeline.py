#!/usr/bin/env python3
"""Add one pipeline-only ntfy publisher; preserve contact and never print credentials."""
import base64
import datetime
import hashlib
import hmac
import importlib.util
import json
import os
from pathlib import Path
import re
import resource
import shlex
import signal
import stat
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
BASE = Path('/Users/max/.cache/cluster-ops')
NAMESPACE = 'stadtstack-contact'
SECRET = 'stadtstack-contact-ntfy'
USER = 'pipeline-publisher'
TOPIC = 'pipeline'
ENDPOINT = 'https://ntfy.stadtstack.eu'
KEYCHAIN_SERVICE = 'org.stadtstack.ntfy.pipeline-publisher'
IMAGE = 'docker.io/binwiederhier/ntfy@sha256:4c599cf0818965782f93f652bd843e92714992e84d6b88ad17713dc0951cda1f'
# Each accepted runtime digest is cryptographically resolved from the pinned official index.
RUNTIME_DIGESTS = {
    'sha256:4c599cf0818965782f93f652bd843e92714992e84d6b88ad17713dc0951cda1f',
    'sha256:2384ab26a175f11c90244236e4a1bea7c12ba81273a9c3364461d739a15ad882',
    'sha256:2a9ce4a61de215b23367af546f72e2f2a42cd0ba3573408cc0006f7096b4b6f1',
}
CLUSTER_UID = '7bc769bc-e860-4d54-a0d5-d426f3a52420'
GENERIC_TEST = 'Stadtstack Pipeline: Testbenachrichtigung'
REMOTE_PATH = '/home/max/.config/stadtstack/ntfy/pipeline-publisher.token'
ATTEMPT = BASE / 'ntfy-pipeline-test-attempt.json'
RESULT = BASE / 'ntfy-pipeline-release-result.json'
RESTART = BASE / 'ntfy-pipeline-restart-attempt.json'
RECONCILIATION = BASE / 'ntfy-pipeline-restart-reconciliation.json'


class Refusal(Exception):
    pass


def require(condition, message):
    if not condition:
        raise Refusal(message)


def desired_fields(base, pipeline):
    """Append only pipeline identity/ACL/token; every contact string remains intact."""
    return {
        'NTFY_AUTH_USERS': base['NTFY_AUTH_USERS'] + f',{USER}:{pipeline["hash"]}:user',
        'NTFY_AUTH_ACCESS': base['NTFY_AUTH_ACCESS'] + f',owner:{TOPIC}:ro,{USER}:{TOPIC}:wo',
        'NTFY_AUTH_TOKENS': base['NTFY_AUTH_TOKENS'] + f',{USER}:{pipeline["token"]}:{USER}',
    }


def patch_secret(secret, expected):
    operations = [
        {'op': 'test', 'path': '/metadata/uid', 'value': secret['metadata']['uid']},
        {'op': 'test', 'path': '/metadata/resourceVersion', 'value': secret['metadata']['resourceVersion']},
    ]
    for key, value in expected.items():
        require(key in secret['data'], 'Required existing ntfy auth key is absent.')
        operations.append({'op': 'test', 'path': '/data/' + key, 'value': secret['data'][key]})
        operations.append({'op': 'replace', 'path': '/data/' + key,
                           'value': base64.b64encode(value.encode()).decode()})
    return operations


def verify_secret(actual, original, expected):
    data = dict(original['data'])
    data.update({key: base64.b64encode(value.encode()).decode() for key, value in expected.items()})
    require(actual.get('type') == 'Opaque' and actual['metadata']['uid'] == original['metadata']['uid'] and
            actual['metadata']['name'] == SECRET and actual['metadata']['namespace'] == NAMESPACE and
            actual.get('data') == data and
            actual['metadata'].get('labels', {}) == original['metadata'].get('labels', {}) and
            actual['metadata'].get('annotations', {}) == original['metadata'].get('annotations', {}),
            'Admitted/readback Secret changed outside the three approved auth fields.')


REMOTE_RECEIVER = r'''
import hmac,json,os,re,stat,sys
from pathlib import Path
import pwd
uid=os.getuid()
if pwd.getpwuid(uid).pw_name!='max' or Path.home()!=Path('/home/max'): raise SystemExit(41)
token=sys.stdin.buffer.read(128).rstrip(b'\n')
if re.fullmatch(rb'tk_[A-Za-z0-9]{29}',token) is None: raise SystemExit(42)
parent=Path('/home/max')
for part in ('.config','stadtstack','ntfy'):
    parent=parent/part
    try: parent.mkdir(mode=0o700)
    except FileExistsError: pass
    info=parent.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid!=uid or info.st_mode&0o022: raise SystemExit(43)
path=parent/'pipeline-publisher.token'
try:
    info=path.lstat()
except FileNotFoundError:
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'wb') as output:
        output.write(token+b'\n'); output.flush(); os.fsync(output.fileno())
else:
    if not stat.S_ISREG(info.st_mode) or info.st_uid!=uid or info.st_nlink!=1 or stat.S_IMODE(info.st_mode)!=0o600: raise SystemExit(44)
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    with os.fdopen(fd,'rb') as existing:
        if not hmac.compare_digest(existing.read(128).rstrip(b'\n'),token): raise SystemExit(45)
fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
with os.fdopen(fd,'rb') as stored:
    info=os.fstat(stored.fileno())
    if info.st_uid!=uid or stat.S_IMODE(info.st_mode)!=0o600 or not hmac.compare_digest(stored.read(128).rstrip(b'\n'),token): raise SystemExit(46)
print(json.dumps({'path':str(path),'owner':'max','mode':'0600','custodyMatched':True}))
'''


class Operator:
    def __init__(self, lock, context):
        self.lock = lock
        self.context = context
        self.kubectl = os.environ['KUBECTL']
        self.deployment_uid = None
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *args):
                return None
        self.http = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def command(self, args, *, data=None):
        self.lock.check()
        environment = os.environ.copy()
        for key in ('HCLOUD_TOKEN', 'CONTACT_ENCRYPTION_KEY', 'CONTACT_ADMIN_TOKEN', 'NTFY_TOKEN'):
            environment.pop(key, None)
        result = subprocess.run(args, input=data, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                env=environment, check=False)
        require(result.returncode == 0, 'Protected bounded operation failed; no credential diagnostics retained.')
        return result.stdout

    def kc(self, *args, data=None):
        return self.command([self.kubectl, '--context', self.context, '-n', NAMESPACE, *args], data=data)

    def get(self, kind, name):
        return json.loads(self.kc('get', kind, name, '-o', 'json'))

    def inbox_identity(self):
        # Do not read encryption or admin values; only required-key presence and publisher token.
        value = self.kc('get', 'secret', 'stadtstack-contact-inbox', '-o',
                       'go-template={{if index .data "CONTACT_ENCRYPTION_KEY"}}{{if index .data "CONTACT_ADMIN_TOKEN"}}{{printf "%s\\n%s\\n%s" .metadata.uid .metadata.resourceVersion (index .data "NTFY_TOKEN")}}{{end}}{{end}}').decode().split('\n')
        require(len(value) == 3 and all(value), 'Existing contact key/admin/publisher readiness is absent.')
        return value

    def ntfy_pod(self, *, waiting=False):
        items = json.loads(self.kc('get', 'pods', '-l', 'app=stadtstack-contact-ntfy', '-o', 'json'))['items']
        active = [item for item in items if not item['metadata'].get('deletionTimestamp')]
        require(len(active) <= 1, 'Unexpected additional ntfy pod; no further operation authorized.')
        if active:
            pod = active[0]
            require(isinstance(pod['metadata'].get('uid'), str) and pod['metadata']['uid'],
                    'ntfy pod UID is absent.')
            containers = pod['spec'].get('containers', [])
            require(len(containers) == 1 and containers[0].get('name') == 'ntfy' and containers[0].get('image') == IMAGE,
                    'Live ntfy container layout or image drifted.')
            owners = [item for item in pod['metadata'].get('ownerReferences', []) if item.get('controller')]
            require(len(owners) == 1 and owners[0].get('kind') == 'ReplicaSet' and owners[0].get('apiVersion') == 'apps/v1',
                    'ntfy pod is not controlled by exactly one ReplicaSet.')
            replica = self.get('replicaset', owners[0]['name'])
            require(replica['metadata']['uid'] == owners[0]['uid'], 'ntfy pod ReplicaSet identity drifted.')
            controllers = [item for item in replica['metadata'].get('ownerReferences', []) if item.get('controller')]
            require(self.deployment_uid and len(controllers) == 1 and controllers[0].get('kind') == 'Deployment' and
                    controllers[0].get('name') == 'stadtstack-contact-ntfy' and controllers[0].get('uid') == self.deployment_uid,
                    'ntfy pod ownership does not resolve to the exact approved Deployment.')
            statuses = pod['status'].get('containerStatuses', [])
            if statuses:
                require(len(statuses) == 1 and statuses[0].get('name') == 'ntfy', 'ntfy running container identity drifted.')
                if statuses[0].get('imageID'):
                    digest = re.search(r'sha256:[a-f0-9]{64}$', statuses[0]['imageID'])
                    require(digest and digest.group() in RUNTIME_DIGESTS,
                            'Running ntfy content digest differs from the pinned official image.')
                else:
                    require(waiting and not statuses[0].get('ready'),
                            'Ready ntfy container has no immutable running image identity.')
        ready = bool(active and active[0]['status'].get('phase') == 'Running' and
                     active[0]['status'].get('containerStatuses') and
                     all(item.get('ready') for item in active[0]['status']['containerStatuses']))
        if waiting and not ready:
            return None
        require(ready, 'Exactly one ready ntfy pod is required.')
        return active[0]

    def request(self, path, token=None, *, data=None):
        self.lock.check()
        headers = {} if token is None else {'Authorization': 'Bearer ' + token}
        if data is not None:
            headers['Content-Type'] = 'text/plain; charset=utf-8'
        request = urllib.request.Request(ENDPOINT + path, headers=headers, data=data,
                                         method='GET' if data is None else 'POST')
        try:
            with self.http.open(request, timeout=15) as response:
                return response.status, response.read(131072)
        except urllib.error.HTTPError as error:
            return error.code, b''

    def transfer(self, token):
        data = self.command(['/usr/bin/ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
                             'codex-workstation', '/usr/bin/python3 -I -S -c ' + shlex.quote(REMOTE_RECEIVER)],
                            data=(token + '\n').encode())
        receipt = json.loads(data)
        require(receipt == {'path': REMOTE_PATH, 'owner': 'max', 'mode': '0600', 'custodyMatched': True},
                'Remote token custody did not match exact owner/path/mode.')
        return receipt


def contact_fingerprint(deployment):
    value = {'uid': deployment['metadata']['uid'], 'spec': deployment['spec']}
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def sync_marker_directory():
    fd = os.open(BASE, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def read_restart_marker(approval):
    info = RESTART.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == os.getuid() and info.st_nlink == 1 and
            stat.S_IMODE(info.st_mode) == 0o600, 'Unsafe durable restart marker; owner review required.')
    marker = json.loads(RESTART.read_text())
    require(marker.get('sourceCommit') == approval['sourceCommit'] and marker.get('namespace') == NAMESPACE and
            marker.get('dryRunPassed') is True, 'Restart marker differs from this release authority.')
    return marker


def record_restart_marker(marker):
    with os.fdopen(os.open(RESTART, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600), 'w') as output:
        output.write(json.dumps(marker, indent=2) + '\n')
        output.flush()
        os.fsync(output.fileno())
    sync_marker_directory()


def reconcile_restart(op, approval, marker, contact, inbox, ntfy, secret):
    require(marker['ntfyDeploymentUID'] == ntfy['metadata']['uid'] and
            marker['secretUID'] == secret['metadata']['uid'] and
            marker['secretResourceVersion'] == secret['metadata']['resourceVersion'] and
            marker['contactFingerprint'] == contact_fingerprint(contact) and
            marker['inboxUIDAndResourceVersion'] == inbox[:2],
            'Restart reconciliation state drifted; no mutation or second delete authorized.')
    old = op.kc('get', 'pod', marker['oldPodName'], '--ignore-not-found', '-o', 'json')
    require(not old.strip() or json.loads(old)['metadata']['uid'] != marker['oldPodUID'],
            'Original ntfy pod remains or deletion outcome is ambiguous; owner review required.')
    replacement = op.ntfy_pod()
    require(replacement['metadata']['uid'] != marker['oldPodUID'],
            'No distinct exact Ready replacement; no second deletion authorized.')
    report = {'version': 1, 'sourceCommit': approval['sourceCommit'], 'phase': 'restart-reconciled-read-only',
              'restartAlreadyPerformed': True, 'oldPodUID': marker['oldPodUID'],
              'newPodUID': replacement['metadata']['uid'], 'ntfyDeploymentUID': ntfy['metadata']['uid'],
              'contactStateUnchanged': True, 'testPublicationAttempts': 0, 'mutationPerformed': False,
              'viewerRestored': False, 'lockReleased': False}
    with os.fdopen(os.open(RECONCILIATION, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600), 'w') as output:
        output.write(json.dumps(report, indent=2) + '\n')
    print('PIPELINE_RESTART_RECONCILED_READ_ONLY ' + str(RECONCILIATION), flush=True)


def load_approval():
    path = BASE / 'ntfy-pipeline-approval.json'
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == os.getuid() and info.st_nlink == 1 and
            stat.S_IMODE(info.st_mode) == 0o600, 'Main approval must be a protected regular file.')
    approval = json.loads(path.read_text())
    require(approval.get('version') == 1 and approval.get('approvedBy') == 'Main' and
            approval.get('go') == 'ntfy-pipeline-topic-release-v1' and
            approval.get('scope') == {'namespace': NAMESPACE, 'topic': TOPIC, 'publisher': USER,
                                     'ownerAccess': 'read-only', 'publisherAccess': 'write-only',
                                     'remoteAlias': 'codex-workstation', 'remoteUser': 'max',
                                     'remotePath': REMOTE_PATH, 'remoteMode': '0600',
                                     'testBody': GENERIC_TEST, 'maximumTestPublications': 1,
                                     'restart': 'ntfy-only-one-UID-bound-pod', 'contactUnchanged': True} and
            approval.get('ntfyImage') == IMAGE and
            approval.get('cluster') == {'server': 'https://10.255.240.11:6443', 'kubeSystemUID': CLUSTER_UID,
                                        'nodeNames': ['stadtstack-talos-cp-1', 'stadtstack-talos-cp-2', 'stadtstack-talos-cp-3']},
            'Exact pipeline-only owner approval is absent.')
    result = subprocess.run(['/opt/homebrew/bin/git', '-C', str(ROOT), 'rev-parse', 'HEAD'], stdout=subprocess.PIPE,
                            stderr=subprocess.DEVNULL, check=False)
    require(result.returncode == 0 and result.stdout.decode().strip() == approval['sourceCommit'],
            'Operator source differs from approved committed source.')
    for args in (['status', '--porcelain', '--untracked-files=no'],
                 ['ls-files', '--others', '--exclude-standard', '--', 'deploy/contact']):
        result = subprocess.run(['/opt/homebrew/bin/git', '-C', str(ROOT), *args], stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, check=False)
        require(result.returncode == 0 and not result.stdout.strip(), 'Operator source is dirty or has untracked helper inputs.')
    return approval


def main():
    require(sys.flags.isolated and os.environ.get('PIPELINE_OPERATION') == 'release',
            'Only the isolated approved pipeline release operation is allowed.')
    approval = load_approval()
    require(not ATTEMPT.is_symlink() and (not ATTEMPT.exists() or RESTART.exists()),
            'A pipeline test attempt already exists; only restart reconciliation may proceed, never publication retry.')
    from privileged_lock import PrivilegedLock
    lock = PrivilegedLock(BASE / 'privileged-session.lock')
    lock.acquire()  # Delegation only; standalone mutation always refuses.
    context = os.environ['PIPELINE_CONTEXT']
    op = Operator(lock, context)
    try:
        config = json.loads(op.command([op.kubectl, 'config', 'view', '--minify', '-o', 'json']))
        require(len(config['clusters']) == 1 and config['clusters'][0]['cluster']['server'] == approval['cluster']['server'] and
                not config['clusters'][0]['cluster'].get('insecure-skip-tls-verify') and
                all(not user.get('user', {}).get('exec') and not user.get('user', {}).get('auth-provider') for user in config.get('users', [])),
                'Generated cluster API/TLS/credential-plugin identity drifted.')
        require(op.kc('get', 'namespace', 'kube-system', '-o', 'jsonpath={.metadata.uid}').decode() == CLUSTER_UID,
                'Wrong cluster kube-system identity.')
        nodes = json.loads(op.command([op.kubectl, '--context', context, 'get', 'nodes', '-o', 'json']))['items']
        require(sorted(item['metadata']['name'] for item in nodes) == approval['cluster']['nodeNames'], 'Node inventory drifted.')
        namespace = op.get('namespace', NAMESPACE)
        require(all(namespace['metadata'].get('labels', {}).get('pod-security.kubernetes.io/' + gate) == 'restricted'
                    for gate in ('enforce', 'audit', 'warn')), 'Restricted namespace is required.')
        contact_before = op.get('deployment', 'stadtstack-contact')
        inbox_before = op.inbox_identity()
        ntfy_before = op.get('deployment', 'stadtstack-contact-ntfy')
        op.deployment_uid = ntfy_before['metadata']['uid']
        container = ntfy_before['spec']['template']['spec']['containers'][0]
        require(len(ntfy_before['spec']['template']['spec']['containers']) == 1 and container['image'] == IMAGE and
                {item['name']: item.get('valueFrom', {}).get('secretKeyRef') for item in container['env']} ==
                {key: {'name': SECRET, 'key': key} for key in ('NTFY_AUTH_USERS', 'NTFY_AUTH_ACCESS', 'NTFY_AUTH_TOKENS')},
                'Existing ntfy image/auth environment differs from reviewed layout.')
        cm_before = op.get('configmap', SECRET)
        require('auth-default-access: "deny-all"' in cm_before['data']['server.yml'] and
                'enable-signup: false' in cm_before['data']['server.yml'], 'ntfy deny-all/signup configuration drifted.')
        secret = op.get('secret', SECRET)
        require(secret.get('type') == 'Opaque', 'Existing ntfy auth Secret must be Opaque.')
        if RESTART.exists() or RESTART.is_symlink():
            reconcile_restart(op, approval, read_restart_marker(approval), contact_before, inbox_before, ntfy_before, secret)
            return  # Reconciliation is read-only; never retry mutation/publication automatically.
        selected_pod = op.ntfy_pod()  # Bind ownership/content before any custody, transfer or auth mutation.
        spec = importlib.util.spec_from_file_location('pipeline_ntfy_credentials', Path(__file__).with_name('ntfy-credentials.py'))
        credentials = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(credentials)
        from keychain import Keychain
        import bcrypt
        lock.check()
        keychain = Keychain()
        lock.check()
        owner = keychain.read(credentials.OWNER_SERVICE, 'owner')
        lock.check()
        contact = keychain.read(credentials.PUBLISHER_SERVICE, 'contact')
        credentials.validate_credential(owner, bcrypt, owner=True)
        credentials.validate_credential(contact, bcrypt, owner=False)
        require(hmac.compare_digest(inbox_before[2], base64.b64encode(contact['token'].encode()).decode()),
                'Contact publisher token differs from its existing custody.')
        base = credentials.secret_fields(owner, contact)
        decoded = {key: base64.b64decode(secret['data'][key], validate=True).decode() for key in base}
        lock.check()
        pipeline = keychain.read(KEYCHAIN_SERVICE, USER)
        if pipeline is None:
            require(decoded == base, 'Existing extended ntfy state has no matching pipeline custody; no replacement allowed.')
        else:
            credentials.validate_credential(pipeline, bcrypt, owner=False, topic=TOPIC)
            require(pipeline.get('username') == USER and decoded in (base, desired_fields(base, pipeline)),
                    'Pipeline custody/ACL state differs; no automatic rotation allowed.')
        import release
        release.confirm(f'add ntfy pipeline owner read publisher write {NAMESPACE} {context} codex-workstation')
        if pipeline is None:
            lock.check()
            pipeline = credentials.new_credential(bcrypt, owner=False, topic=TOPIC)
            pipeline['username'] = USER
            keychain.create(KEYCHAIN_SERVICE, USER, pipeline)
        expected = desired_fields(base, pipeline)
        patch = patch_secret(secret, expected)
        if decoded != expected:
            admitted = json.loads(op.kc('patch', 'secret', SECRET, '--type=json', '--patch-file=/dev/stdin',
                                      '--dry-run=server', '-o', 'json', data=json.dumps(patch).encode()))
            verify_secret(admitted, secret, expected)
            print(json.dumps({'secretAdmission': 'exact approved three-field extension', 'contactCredentialStringsPreserved': True,
                              'newUser': USER, 'newACL': ['owner:pipeline:ro', 'pipeline-publisher:pipeline:wo']}), flush=True)
        transfer = op.transfer(pipeline['token'])
        if decoded != expected:
            written = json.loads(op.kc('patch', 'secret', SECRET, '--type=json', '--patch-file=/dev/stdin',
                                     '-o', 'json', data=json.dumps(patch).encode()))
            verify_secret(written, secret, expected)
        verify_secret(op.get('secret', SECRET), secret, expected)
        pod = op.ntfy_pod()
        require(pod['metadata']['uid'] == selected_pod['metadata']['uid'],
                'ntfy pod changed after preflight; no restart authorized.')
        deletion = {'apiVersion': 'v1', 'kind': 'DeleteOptions', 'preconditions': {'uid': pod['metadata']['uid']}}
        dry_delete = dict(deletion, dryRun=['All'])
        uri = '/api/v1/namespaces/' + NAMESPACE + '/pods/' + pod['metadata']['name']
        op.kc('delete', '--raw', uri, '-f', '-', data=json.dumps(dry_delete).encode())
        require(op.ntfy_pod()['metadata']['uid'] == pod['metadata']['uid'], 'ntfy pod changed after restart preview.')
        print(json.dumps({'restartOnly': 'ntfy', 'podUID': pod['metadata']['uid'], 'contactRestarted': False}), flush=True)
        marker_secret = op.get('secret', SECRET)
        verify_secret(marker_secret, secret, expected)
        restart_marker = {'version': 1, 'sourceCommit': approval['sourceCommit'], 'namespace': NAMESPACE,
                          'secretUID': marker_secret['metadata']['uid'],
                          'secretResourceVersion': marker_secret['metadata']['resourceVersion'],
                          'ntfyDeploymentUID': ntfy_before['metadata']['uid'],
                          'oldPodName': pod['metadata']['name'], 'oldPodUID': pod['metadata']['uid'],
                          'oldReplicaSetUID': [item for item in pod['metadata']['ownerReferences'] if item.get('controller')][0]['uid'],
                          'dryRunPassed': True, 'contactFingerprint': contact_fingerprint(contact_before),
                          'inboxUIDAndResourceVersion': inbox_before[:2]}
        lock.check()
        record_restart_marker(restart_marker)
        op.kc('delete', '--raw', uri, '-f', '-', data=json.dumps(deletion).encode())
        deadline = time.monotonic() + 180
        while True:
            replacement = op.ntfy_pod(waiting=True)
            if replacement is not None and replacement['metadata']['uid'] != pod['metadata']['uid']:
                break
            require(time.monotonic() < deadline, 'Controlled ntfy restart did not become ready; no publish attempted.')
            time.sleep(0.5)
        contact_after = op.get('deployment', 'stadtstack-contact')
        require(contact_after['metadata']['uid'] == contact_before['metadata']['uid'] and
                contact_after['spec'] == contact_before['spec'] and op.inbox_identity() == inbox_before and
                op.get('deployment', 'stadtstack-contact-ntfy')['spec'] == ntfy_before['spec'] and
                op.get('configmap', SECRET)['data'] == cm_before['data'], 'Contact or ntfy deployment/config drifted outside approved Secret-only change.')
        acl = {}
        for label, path, token, status in (
                ('owner-contact-read', '/contact/json?poll=1', owner['token'], 200),
                ('owner-pipeline-read', '/pipeline/json?poll=1', owner['token'], 200),
                ('anonymous-pipeline-read', '/pipeline/json?poll=1', None, 403),
                ('pipeline-publisher-read', '/pipeline/json?poll=1', pipeline['token'], 403),
                ('pipeline-publisher-contact-read', '/contact/json?poll=1', pipeline['token'], 403),
                ('contact-publisher-pipeline-read', '/pipeline/json?poll=1', contact['token'], 403)):
            observed, _ = op.request(path, token)
            require(observed == status, 'Authenticated topic ACL acceptance failed: ' + label)
            acl[label] = observed
        attempt = {'attemptedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'topic': TOPIC,
                   'body': GENERIC_TEST, 'sourceCommit': approval['sourceCommit'], 'maximumPublications': 1}
        lock.check()
        fd = os.open(ATTEMPT, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'w') as marker:
            marker.write(json.dumps(attempt, indent=2) + '\n')
            marker.flush()
            os.fsync(marker.fileno())
        sync_marker_directory()
        status, body = op.request('/pipeline', pipeline['token'], data=GENERIC_TEST.encode())
        require(status == 200, 'Single pipeline publication was not acknowledged; never retry blindly.')
        acknowledgement = json.loads(body)
        require(acknowledgement.get('topic') == TOPIC and acknowledgement.get('message') == GENERIC_TEST and
                isinstance(acknowledgement.get('id'), str) and acknowledgement['id'] and
                isinstance(acknowledgement.get('time'), int), 'Publication acknowledgement differs from exact generic topic/body.')
        status, stream = op.request('/pipeline/json?poll=1&since=' + str(acknowledgement['time']), owner['token'])
        events = [json.loads(line) for line in stream.splitlines() if line]
        require(status == 200 and any(item.get('id') == acknowledgement['id'] and item.get('message') == GENERIC_TEST
                                      for item in events), 'Owner did not read the single acknowledged pipeline event.')
        final_secret = op.get('secret', SECRET)
        verify_secret(final_secret, secret, expected)
        require(op.inbox_identity() == inbox_before, 'Contact inbox Secret changed during final acceptance.')
        result = {'version': 1, 'sourceCommit': approval['sourceCommit'], 'topic': TOPIC, 'endpoint': ENDPOINT + '/pipeline',
                  'publisher': USER, 'ownerReadOnly': True, 'publisherWriteOnly': True, 'defaultDenyAll': True,
                  'contactDeploymentAndCredentialStateUnchanged': True, 'ntfyImage': IMAGE,
                  'ntfySecretUID': final_secret['metadata']['uid'], 'ntfySecretResourceVersion': final_secret['metadata']['resourceVersion'],
                  'oldNtfyPodUID': pod['metadata']['uid'], 'newNtfyPodUID': replacement['metadata']['uid'],
                  'keychainService': KEYCHAIN_SERVICE, 'remoteCustody': transfer, 'acl': acl,
                  'singleGenericTestAcknowledgement': acknowledgement, 'singleGenericTestOwnerReadObserved': True,
                  'testPublicationAttempts': 1, 'completedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  'viewerRestored': False, 'lockReleased': False}
        with os.fdopen(os.open(RESULT, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600), 'w') as output:
            output.write(json.dumps(result, indent=2) + '\n')
        print('PIPELINE_RELEASE_COMPLETE ' + str(RESULT), flush=True)
    finally:
        lock.release()  # Delegated no-op; only runner restores viewer and releases lock.


if __name__ == '__main__':
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    def interrupted(signum, frame):
        raise KeyboardInterrupt
    for signum in (signal.SIGTERM, signal.SIGHUP):
        signal.signal(signum, interrupted)
    try:
        main()
    except Refusal as error:
        print('Pipeline release refused: ' + str(error), file=sys.stderr)
        raise SystemExit(1)
    except (OSError, ValueError, KeyError, TypeError, urllib.error.URLError, KeyboardInterrupt):
        print('Pipeline release failed/interrupted; protected diagnostics suppressed; do not retry publication.', file=sys.stderr)
        raise SystemExit(1)
