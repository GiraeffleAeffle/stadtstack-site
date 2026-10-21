"""Offline object/admission tests; no cluster or provider access."""
import copy
import importlib.util
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location('ntfy_dns_tls', Path(__file__).with_name('ntfy-dns-tls.py'))
dns = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(dns)


class AdmissionTests(unittest.TestCase):
    def test_both_exact_namespace_certificate_hosts_are_planned(self):
        objects = dns.manifests(['10.42.0.10/32'])
        certificates = [item for item in objects if item['kind'] == 'Certificate']
        self.assertEqual({item['metadata']['name']: item['spec']['dnsNames'] for item in certificates},
                         {'stadtstack-contact-ntfy-tls': ['ntfy.stadtstack.eu'],
                          'stadtstack-contact-tls': ['stadtstack.eu']})
        self.assertTrue(all(item['metadata']['namespace'] == 'stadtstack-contact' for item in objects))

    def test_exact_admission_allows_server_metadata_only(self):
        expected = dns.manifests(['10.42.0.10/32'])[0]
        actual = copy.deepcopy(expected)
        actual['metadata'].update(uid='server-uid', resourceVersion='42', generation=1)
        dns.approved_object(actual, expected)

    def test_mutated_policy_spec_refuses(self):
        expected = dns.manifests(['10.42.0.10/32'])[1]
        actual = copy.deepcopy(expected)
        actual['spec']['ingress'][0]['from'][0]['ipBlock']['cidr'] = '0.0.0.0/0'
        with self.assertRaises(dns.Refusal):
            dns.approved_object(actual, expected)

    def test_mutated_policy_ownership_refuses(self):
        expected = dns.manifests(['10.42.0.10/32'])[0]
        actual = copy.deepcopy(expected)
        actual['metadata']['annotations']['meta.helm.sh/release-name'] = 'other'
        with self.assertRaises(dns.Refusal):
            dns.approved_object(actual, expected)

    def test_mutated_certificate_host_refuses(self):
        expected = dns.manifests(['10.42.0.10/32'])[2]
        actual = copy.deepcopy(expected)
        actual['spec']['dnsNames'] = ['unexpected.stadtstack.eu']
        with self.assertRaises(dns.Refusal):
            dns.approved_object(actual, expected)
