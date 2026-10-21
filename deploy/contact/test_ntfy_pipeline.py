"""Local pipeline-only tests; no real Keychain, SSH, cluster or publication."""
import base64
import copy
import getpass
import hmac
import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import bcrypt

DIRECTORY = Path(__file__).resolve().parent
sys.path.insert(0, str(DIRECTORY))


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, DIRECTORY / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


pipeline = load('test_pipeline_module', 'ntfy-pipeline.py')
credentials = load('test_pipeline_credentials', 'ntfy-credentials.py')
TOKEN = 'tk_' + 'A' * 29  # Synthetic local test token; never a real credential.


class PipelineConfigTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.owner = credentials.new_credential(bcrypt, owner=True)
        cls.contact = credentials.new_credential(bcrypt, owner=False)
        cls.publisher = credentials.new_credential(bcrypt, owner=False, topic='pipeline')
        cls.publisher['username'] = 'pipeline-publisher'
        cls.base = credentials.secret_fields(cls.owner, cls.contact)
        cls.expected = pipeline.desired_fields(cls.base, cls.publisher)

    def setUp(self):
        environment = patch.dict(os.environ, {'KUBECTL': 'synthetic-kubectl'})
        environment.start()
        self.addCleanup(environment.stop)

    def secret(self):
        return {'type': 'Opaque', 'metadata': {'uid': 'preserved-uid', 'resourceVersion': '42',
                'name': pipeline.SECRET, 'namespace': pipeline.NAMESPACE, 'labels': {'keep': 'yes'}},
                'data': {**{key: base64.b64encode(value.encode()).decode() for key, value in self.base.items()},
                         'OTHER': 'unchanged-extra'}}

    def test_contact_constructor_default_is_unchanged(self):
        self.assertEqual(self.owner['topic'], 'contact')
        self.assertEqual(self.contact['topic'], 'contact')
        credentials.validate_credential(self.owner, bcrypt, owner=True)
        credentials.validate_credential(self.contact, bcrypt, owner=False)

    def test_explicit_pipeline_custody_validates_only_pipeline(self):
        credentials.validate_credential(self.publisher, bcrypt, owner=False, topic='pipeline')
        with self.assertRaises(credentials.release.Refusal):
            credentials.validate_credential(self.publisher, bcrypt, owner=False)
        self.assertNotIn('password', self.publisher)

    def test_only_exact_pipeline_access_is_added(self):
        self.assertEqual(self.expected['NTFY_AUTH_ACCESS'],
                         'owner:contact:ro,contact:contact:wo,owner:pipeline:ro,pipeline-publisher:pipeline:wo')
        self.assertNotIn('*', self.expected['NTFY_AUTH_ACCESS'])
        self.assertTrue(self.expected['NTFY_AUTH_USERS'].endswith(':user'))
        for key in self.base:
            self.assertTrue(self.expected[key].startswith(self.base[key] + ','))

    def test_patch_is_uid_rv_and_value_bound_to_three_keys_only(self):
        operations = pipeline.patch_secret(self.secret(), self.expected)
        self.assertEqual(operations[:2], [
            {'op': 'test', 'path': '/metadata/uid', 'value': 'preserved-uid'},
            {'op': 'test', 'path': '/metadata/resourceVersion', 'value': '42'}])
        self.assertEqual({item['path'] for item in operations if item['op'] == 'replace'},
                         {'/data/NTFY_AUTH_USERS', '/data/NTFY_AUTH_ACCESS', '/data/NTFY_AUTH_TOKENS'})
        self.assertEqual(sum(item['op'] == 'replace' for item in operations), 3)
        self.assertFalse(any('CONTACT_' in item['path'] for item in operations))

    def test_admission_preserves_unknown_data_and_metadata(self):
        original = self.secret()
        admitted = copy.deepcopy(original)
        admitted['data'].update({key: base64.b64encode(value.encode()).decode() for key, value in self.expected.items()})
        admitted['metadata']['resourceVersion'] = '43'
        pipeline.verify_secret(admitted, original, self.expected)
        self.assertEqual(admitted['data']['OTHER'], 'unchanged-extra')

    def test_admission_rejects_any_unapproved_change(self):
        original = self.secret()
        for mutation in ('uid', 'extra', 'labels'):
            admitted = copy.deepcopy(original)
            admitted['data'].update({key: base64.b64encode(value.encode()).decode() for key, value in self.expected.items()})
            if mutation == 'uid':
                admitted['metadata']['uid'] = 'foreign-uid'
            elif mutation == 'extra':
                admitted['data']['OTHER'] = 'changed'
            else:
                admitted['metadata']['labels'] = {'changed': 'yes'}
            with self.subTest(mutation=mutation), self.assertRaises(pipeline.Refusal):
                pipeline.verify_secret(admitted, original, self.expected)

    def test_private_failure_does_not_disclose_response(self):
        op = pipeline.Operator(Mock(), 'synthetic-context')
        response = subprocess.CompletedProcess(['kubectl'], 1, stdout=TOKEN.encode(), stderr=TOKEN.encode())
        with patch.object(pipeline.subprocess, 'run', return_value=response), self.assertRaises(pipeline.Refusal) as failure:
            op.command(['kubectl'])
        self.assertNotIn(TOKEN, str(failure.exception))

    def test_transfer_uses_stdin_and_strict_existing_alias(self):
        op = pipeline.Operator(Mock(), 'synthetic-context')
        receipt = {'path': pipeline.REMOTE_PATH, 'owner': 'max', 'mode': '0600', 'custodyMatched': True}
        with patch.object(op, 'command', return_value=json.dumps(receipt).encode()) as command:
            self.assertEqual(op.transfer(TOKEN), receipt)
        arguments = command.call_args.args[0]
        self.assertIn('codex-workstation', arguments)
        self.assertIn('StrictHostKeyChecking=yes', arguments)
        self.assertIn('BatchMode=yes', arguments)
        self.assertNotIn(TOKEN, repr(arguments))
        self.assertTrue(hmac.compare_digest(command.call_args.kwargs['data'], (TOKEN + '\n').encode()))

    def test_actual_image_drift_is_not_retried_as_readiness(self):
        op = pipeline.Operator(Mock(), 'synthetic-context')
        bad = {'metadata': {'uid': 'pod'}, 'spec': {'containers': [{'image': 'foreign-image'}]},
               'status': {'phase': 'Running', 'containerStatuses': [{'ready': True}]}}
        with patch.object(op, 'kc', return_value=json.dumps({'items': [bad]}).encode()), self.assertRaises(pipeline.Refusal):
            op.ntfy_pod(waiting=True)

    def test_existing_publish_attempt_refuses_before_keychain_or_cluster(self):
        with tempfile.TemporaryDirectory() as directory:
            attempted = Path(directory) / 'attempt.json'
            attempted.write_text('{}')
            with patch.object(pipeline, 'ATTEMPT', attempted), patch.object(pipeline, 'load_approval', return_value={}), \
                    patch.object(pipeline.sys, 'flags', SimpleNamespace(isolated=True)), \
                    patch.dict(os.environ, {'PIPELINE_OPERATION': 'release'}), self.assertRaises(pipeline.Refusal):
                pipeline.main()

    def test_pod_and_running_image_must_resolve_to_exact_deployment(self):
        op = pipeline.Operator(Mock(), 'synthetic-context')
        op.deployment_uid = 'deployment-uid'
        pod = {'metadata': {'uid': 'pod-uid', 'name': 'ntfy-pod', 'ownerReferences': [
            {'controller': True, 'apiVersion': 'apps/v1', 'kind': 'ReplicaSet', 'name': 'ntfy-rs', 'uid': 'rs-uid'}]},
            'spec': {'containers': [{'name': 'ntfy', 'image': pipeline.IMAGE}]},
            'status': {'phase': 'Running', 'containerStatuses': [
                {'name': 'ntfy', 'ready': True, 'imageID': 'docker.io/binwiederhier/ntfy@' + sorted(pipeline.RUNTIME_DIGESTS)[0]}]}}
        replica = {'metadata': {'uid': 'rs-uid', 'ownerReferences': [
            {'controller': True, 'kind': 'Deployment', 'name': 'stadtstack-contact-ntfy', 'uid': 'deployment-uid'}]}}
        with patch.object(op, 'kc', return_value=json.dumps({'items': [pod]}).encode()), \
                patch.object(op, 'get', return_value=replica):
            self.assertEqual(op.ntfy_pod()['metadata']['uid'], 'pod-uid')
        for mutation in ('sidecar', 'unowned', 'replica-uid', 'deployment-uid', 'runtime-digest'):
            changed = copy.deepcopy(pod)
            changed_replica = copy.deepcopy(replica)
            if mutation == 'sidecar':
                changed['spec']['containers'].append({'name': 'unapproved', 'image': pipeline.IMAGE})
            elif mutation == 'unowned':
                changed['metadata']['ownerReferences'] = []
            elif mutation == 'replica-uid':
                changed_replica['metadata']['uid'] = 'foreign-rs'
            elif mutation == 'deployment-uid':
                changed_replica['metadata']['ownerReferences'][0]['uid'] = 'foreign-deployment'
            else:
                changed['status']['containerStatuses'][0]['imageID'] = 'sha256:' + '0' * 64
            with self.subTest(mutation=mutation), patch.object(op, 'kc', return_value=json.dumps({'items': [changed]}).encode()), \
                    patch.object(op, 'get', return_value=changed_replica), self.assertRaises(pipeline.Refusal):
                op.ntfy_pod(waiting=True)


class RestartMarkerTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.base = Path(self.directory.name)
        for name, value in (('BASE', self.base), ('RESTART', self.base / 'restart.json'),
                            ('RECONCILIATION', self.base / 'reconciliation.json')):
            substitution = patch.object(pipeline, name, value)
            substitution.start()
            self.addCleanup(substitution.stop)
        self.contact = {'metadata': {'uid': 'contact-uid'}, 'spec': {'unchanged': True}}
        self.ntfy = {'metadata': {'uid': 'ntfy-uid'}}
        self.secret = {'metadata': {'uid': 'secret-uid', 'resourceVersion': '43'}}
        self.approval = {'sourceCommit': 'a' * 40}
        self.marker = {'sourceCommit': 'a' * 40, 'namespace': pipeline.NAMESPACE, 'dryRunPassed': True,
                       'ntfyDeploymentUID': 'ntfy-uid', 'secretUID': 'secret-uid', 'secretResourceVersion': '43',
                       'oldPodName': 'old-pod', 'oldPodUID': 'old-uid',
                       'contactFingerprint': pipeline.contact_fingerprint(self.contact),
                       'inboxUIDAndResourceVersion': ['inbox-uid', '42']}

    def test_restart_marker_is_private_durable_and_never_overwritten(self):
        pipeline.record_restart_marker(self.marker)
        self.assertEqual(stat.S_IMODE(pipeline.RESTART.stat().st_mode), 0o600)
        self.assertEqual(pipeline.read_restart_marker(self.approval), self.marker)
        with self.assertRaises(FileExistsError):
            pipeline.record_restart_marker(self.marker)

    def test_reconciliation_performs_only_reads_and_never_delete_or_publish(self):
        op = Mock()
        op.kc.return_value = b''
        op.ntfy_pod.return_value = {'metadata': {'uid': 'replacement-uid'}}
        pipeline.reconcile_restart(op, self.approval, self.marker, self.contact, ['inbox-uid', '42', 'not-exported'],
                                   self.ntfy, self.secret)
        report = json.loads(pipeline.RECONCILIATION.read_text())
        self.assertEqual(report['phase'], 'restart-reconciled-read-only')
        self.assertFalse(report['mutationPerformed'])
        self.assertEqual(report['testPublicationAttempts'], 0)
        self.assertTrue(all(call.args[0] == 'get' for call in op.kc.call_args_list))
        op.request.assert_not_called()
        op.transfer.assert_not_called()

    def test_old_uid_still_present_refuses_without_second_delete(self):
        op = Mock()
        op.kc.return_value = json.dumps({'metadata': {'uid': 'old-uid'}}).encode()
        with self.assertRaises(pipeline.Refusal):
            pipeline.reconcile_restart(op, self.approval, self.marker, self.contact, ['inbox-uid', '42', 'not-exported'],
                                       self.ntfy, self.secret)
        op.ntfy_pod.assert_not_called()
        self.assertTrue(all(call.args[0] == 'get' for call in op.kc.call_args_list))


class ReceiverTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.home = Path(self.directory.name)
        self.target = self.home / '.config/stadtstack/ntfy/pipeline-publisher.token'
        # Replace only fixed identity/home literals for an isolated local fixture.
        self.program = pipeline.REMOTE_RECEIVER.replace('/home/max', str(self.home))
        self.program = self.program.replace('Path.home()', 'Path(' + repr(str(self.home)) + ')')
        self.program = self.program.replace("pwd.getpwuid(uid).pw_name!='max'",
                                            'pwd.getpwuid(uid).pw_name!=' + repr(getpass.getuser()))

    def receive(self, token=TOKEN):
        result = subprocess.run([sys.executable, '-I', '-S', '-c', self.program], input=(token + '\n').encode(),
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
        self.assertNotIn(TOKEN.encode(), result.stdout)
        self.assertNotIn(TOKEN.encode(), result.stderr)
        return result

    def test_new_file_is_owner_only_and_contains_exact_custody(self):
        result = self.receive()
        self.assertEqual(result.returncode, 0)
        self.assertEqual(stat.S_IMODE(self.target.stat().st_mode), 0o600)
        self.assertTrue(hmac.compare_digest(self.target.read_bytes().strip(), TOKEN.encode()))

    def test_equal_existing_file_is_idempotent(self):
        self.assertEqual(self.receive().returncode, 0)
        inode = self.target.stat().st_ino
        self.assertEqual(self.receive().returncode, 0)
        self.assertEqual(self.target.stat().st_ino, inode)

    def test_unknown_existing_token_is_not_overwritten(self):
        self.assertEqual(self.receive().returncode, 0)
        self.assertEqual(self.receive('tk_' + 'B' * 29).returncode, 45)
        self.assertTrue(hmac.compare_digest(self.target.read_bytes().strip(), TOKEN.encode()))

    def test_insecure_existing_mode_refuses(self):
        self.assertEqual(self.receive().returncode, 0)
        self.target.chmod(0o644)
        self.assertEqual(self.receive().returncode, 44)

    def test_symlink_destination_refuses(self):
        self.target.parent.mkdir(parents=True)
        outside = self.home / 'outside'
        outside.write_bytes(b'untouched')
        self.target.symlink_to(outside)
        self.assertEqual(self.receive().returncode, 44)
        self.assertEqual(outside.read_bytes(), b'untouched')

    def test_group_writable_parent_refuses(self):
        self.target.parent.mkdir(parents=True)
        self.target.parent.chmod(0o770)
        self.assertEqual(self.receive().returncode, 43)
