#!/usr/bin/env python3
"""Governed ntfy.stadtstack.eu DNS/TLS; never opens a cluster session.

Use python3 ntfy-dns-tls.py --review --evidence approved.json --values values.yaml
for offline review. --plan reads current DNS/cluster state without changing it;
--dns changes only the approved ntfy A RRSet; --tls bootstraps namespace-local
HTTP01 policies/Certificate; --check reads readiness without sending a message.
Live modes require --context EXISTING_CONTEXT and protected HCLOUD_TOKEN in the
process environment (never argv, file, automatic Secret retrieval or output).
PyYAML, kubectl, dig and openssl are required for live modes.

Evidence extends contact release evidence version 1 with ntfyDNS:
  api: cloud-v1
  zoneId: numeric string
  zoneName: stadtstack.eu
  domainOwner: owner identity (must equal ownerApproval.owner)
  host: ntfy.stadtstack.eu
  ipv4: approved existing public Hetzner LB address (77.42.11.9)
  ttl: integer seconds (60..86400)
  beforeSHA256: --plan's exact approved-host RRSet snapshot hash
  ingressService: {namespace: ingress-system, name: NAME, uid: UID}
  ingressDaemonSet: {namespace: ingress-system, name: haproxy-ingress, uid: UID}
  ingressLoadBalancer: {id: 7223013, name: stadtstack-talos-ingress-lb}
  ingressController: exact IngressClass haproxy spec.controller
  ingressReadinessEvidence: owner-reviewed reference (HTTP80/HTTPS443 source,
    HTTP01 routing and NetworkPolicy enforcement evidence, not a fixture)
Owner approval requires legal, retention, deployment, publication, ingressTLS,
networkEnforcement, ntfyPublicEndpoint, ntfyDNS, ntfyTLS. Sources come from the
SHA256-bound values file ingress.haproxySources, exact /32 or /128 only.
--plan prints DNS fingerprint and exact bounded manifests for owner review;
it does not satisfy the approval gates. Approval and beforeSHA256 are needed
for mutations, not offline review/read-only planning. No legacy API fallback:
a legacy dns.hetzner.com token/zone must be migrated/explicitly re-approved for
Cloud API first; this helper never guesses credentials or silently migrates.

Current API: https://api.hetzner.cloud/v1/zones/{id}/rrsets
Specification: https://docs.hetzner.cloud/reference/cloud#zone-rrsets
Request schema: https://github.com/hetznercloud/hcloud-go/blob/main/hcloud/schema/zone_rrset.go
"""
import argparse
import base64
import datetime
import hashlib
import importlib
import ipaddress
import json
import os
from pathlib import Path
import re
import resource
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from privileged_lock import PrivilegedLock

HOST = "ntfy.stadtstack.eu"
ZONE = "stadtstack.eu"
NAMESPACE = "stadtstack-contact"
CERTIFICATE = "stadtstack-contact-ntfy-tls"
ISSUER = "letsencrypt-prod"
ISSUER_UID = "fd854938-6581-4f1c-8ba2-de722132c8ce"
CLUSTER_UID = "7bc769bc-e860-4d54-a0d5-d426f3a52420"
LOCK = Path("/Users/max/.cache/cluster-ops/privileged-session.lock")
API = "https://api.hetzner.cloud/v1"
ACME = "https://acme-v02.api.letsencrypt.org/directory"


class Refusal(Exception):
    pass


def require(condition, message):
    if not condition:
        raise Refusal(message)


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def run(command, data=None, accepted=(0,)):
    environment = os.environ.copy()
    # Provider credentials must not reach kubectl plugins, helm or child tools.
    environment.pop("HCLOUD_TOKEN", None)
    result = subprocess.run(command, input=data, stdout=subprocess.PIPE,
                            stderr=subprocess.DEVNULL, env=environment, check=False)
    require(result.returncode in accepted, "Required command failed; diagnostics suppressed to protect credentials: " + command[0])
    return result.stdout


def confirm(phrase):
    try:
        with open("/dev/tty", "r") as reader, open("/dev/tty", "w") as writer:
            writer.write("Exact owner confirmation required: " + phrase + "\n> ")
            writer.flush()
            answer = reader.readline().strip()
    except OSError as error:
        raise Refusal("An owner-controlled terminal is required; no write authorized.") from error
    require(answer == phrase, "Owner confirmation did not match; no write authorized.")


def read_evidence(args):
    evidence = json.loads(Path(args.evidence).read_text())
    require(evidence.get("version") == 1, "Evidence version must be 1.")
    require(evidence.get("valuesSHA256") == hashlib.sha256(Path(args.values).read_bytes()).hexdigest(),
            "Evidence must bind this exact non-secret values file.")
    require(re.fullmatch(r"[a-f0-9]{40}", evidence.get("sourceCommit", "")) is not None and
            re.fullmatch(r"sha256:[a-f0-9]{64}", evidence.get("imageDigest", "")) is not None,
            "Evidence requires contact release sourceCommit/imageDigest identity.")
    approval = evidence["ownerApproval"]
    dns = evidence["ntfyDNS"]
    require(isinstance(approval.get("owner"), str) and approval["owner"].strip() and
            dns.get("domainOwner") == approval["owner"], "Exact domain owner identity must match owner approval.")
    require(dns.get("api") == "cloud-v1" and dns.get("zoneName") == ZONE and dns.get("host") == HOST,
            "Only explicitly approved Cloud API stadtstack.eu / ntfy.stadtstack.eu is supported.")
    require(isinstance(dns.get("zoneId"), str) and re.fullmatch(r"[1-9][0-9]*", dns["zoneId"]) is not None,
            "The approved Cloud API numeric zone ID is required; no name discovery/fallback.")
    address = ipaddress.ip_address(dns["ipv4"])
    require(address.version == 4 and address.is_global and str(address) == dns["ipv4"],
            "An exact owner-approved public IPv4 ingress address is required.")
    require(type(dns.get("ttl")) is int and 60 <= dns["ttl"] <= 86400, "Approved TTL must be 60..86400 seconds.")
    service = dns["ingressService"]
    require(service.get("namespace") == "ingress-system" and
            re.fullmatch(r"[a-z0-9][a-z0-9.-]*", service.get("name", "")) is not None and
            isinstance(service.get("uid"), str) and service["uid"], "Exact existing ingress-system Service identity is required.")
    require(isinstance(dns.get("ingressController"), str) and dns["ingressController"] and
            isinstance(dns.get("ingressReadinessEvidence"), str) and dns["ingressReadinessEvidence"].strip(),
            "Reviewed existing ingress controller and real HTTP01/network readiness reference are required.")
    daemonset = dns["ingressDaemonSet"]
    require(daemonset.get("namespace") == "ingress-system" and daemonset.get("name") == "haproxy-ingress" and
            isinstance(daemonset.get("uid"), str) and daemonset["uid"],
            "Exact existing hostNetwork HAProxy DaemonSet identity is required.")
    require(dns.get("ingressLoadBalancer") == {"id": 7223013, "name": "stadtstack-talos-ingress-lb"} and
            dns["ipv4"] == "77.42.11.9", "Only the approved existing public Hetzner ingress LB is supported.")
    cluster = evidence["cluster"]
    require(cluster.get("namespace") == NAMESPACE and cluster.get("kubeSystemUID") == CLUSTER_UID and
            isinstance(cluster.get("context"), str) and cluster["context"] and
            isinstance(cluster.get("server"), str) and cluster["server"].startswith("https://"),
            "Exact existing cluster context/API/UID/namespace evidence is required.")
    if args.dns or args.tls:
        for gate in ("legal", "retention", "deployment", "publication", "ingressTLS", "networkEnforcement",
                     "ntfyPublicEndpoint", "ntfyDNS", "ntfyTLS"):
            require(approval.get(gate) is True, "Explicit owner approval missing: " + gate)
        approved_at = datetime.datetime.fromisoformat(approval["approvedAt"].replace("Z", "+00:00"))
        require(approved_at.tzinfo is not None and approved_at <= datetime.datetime.now(datetime.timezone.utc),
                "ownerApproval.approvedAt must be a past timezone-aware timestamp.")
        require(isinstance(approval.get("retentionPolicy"), str) and approval["retentionPolicy"].strip(),
                "The owner-approved retention policy must be recorded.")
        require(re.fullmatch(r"[a-f0-9]{64}", dns.get("beforeSHA256", "")) is not None,
                "Mutations require --plan's owner-reviewed beforeSHA256.")
    try:
        yaml = importlib.import_module("yaml")
    except ImportError as error:
        raise Refusal("PyYAML is required to parse the reviewed chart values (install in an operator-controlled environment).") from error
    try:
        values = yaml.safe_load(Path(args.values).read_text())
    except yaml.YAMLError as error:
        raise Refusal("Reviewed non-secret values YAML cannot be parsed.") from error
    sources = values["ingress"]["haproxySources"]
    require(isinstance(sources, list) and sources, "Reviewed exact HAProxy source CIDRs are required.")
    for source in sources:
        network = ipaddress.ip_network(source, strict=True)
        require(network.prefixlen == network.max_prefixlen and str(network) == source,
                "HAProxy sources must be canonical exact /32 or /128 addresses, not a namespace/range.")
    require(len(set(sources)) == len(sources), "Duplicate HAProxy source addresses are not approved.")
    return evidence, sources


def manifests(sources):
    # Policies are chart-owned to permit subsequent Helm adoption without force.
    def policy(name, spec):
        return {"apiVersion": "networking.k8s.io/v1", "kind": "NetworkPolicy",
                "metadata": {"name": name, "namespace": NAMESPACE,
                             "labels": {"app.kubernetes.io/managed-by": "Helm"},
                             "annotations": {"meta.helm.sh/release-name": NAMESPACE,
                                             "meta.helm.sh/release-namespace": NAMESPACE}}, "spec": spec}
    deny = policy("default-deny", {"podSelector": {}, "policyTypes": ["Ingress", "Egress"]})
    solver = policy("ntfy-tls-solver-ingress", {
        "podSelector": {"matchLabels": {"acme.cert-manager.io/http01-solver": "true"}},
        "policyTypes": ["Ingress"], "ingress": [{"from": [{"ipBlock": {"cidr": source}} for source in sources],
                                                  "ports": [{"port": 8089, "protocol": "TCP"}]}]})
    def certificate(name, host):
        return {"apiVersion": "cert-manager.io/v1", "kind": "Certificate",
                "metadata": {"name": name, "namespace": NAMESPACE},
                "spec": {"secretName": name, "dnsNames": [host],
                         "issuerRef": {"name": ISSUER, "kind": "ClusterIssuer", "group": "cert-manager.io"},
                         "usages": ["digital signature", "key encipherment"],
                         "privateKey": {"rotationPolicy": "Always"}}}
    return [deny, solver, certificate(CERTIFICATE, HOST), certificate("stadtstack-contact-tls", "stadtstack.eu")]


def approved_object(actual, expected):
    require(actual.get("apiVersion") == expected["apiVersion"] and actual.get("kind") == expected["kind"] and
            actual.get("spec") == expected["spec"] and
            all(actual.get("metadata", {}).get(key) == value for key, value in expected["metadata"].items()),
            "Admitted/readback object differs from approved spec/ownership; stop without further writes.")


class Provider:
    def __init__(self, zone_id, owns_lock):
        token = os.environ.get("HCLOUD_TOKEN", "")
        require(len(token) >= 32 and re.search(r"[\s\x00-\x1f\x7f]", token) is None,
                "Protected process environment HCLOUD_TOKEN is required; never provide it in argv/evidence.")
        self.token = token
        self.zone_id = zone_id
        self.owns_lock = owns_lock
        # Never forward bearer credentials to an HTTP proxy or redirect target.
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *arguments):
                return None
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def request(self, path, payload=None):
        self.owns_lock()
        request = urllib.request.Request(API + path, headers={"Authorization": "Bearer " + self.token,
                                        "Content-Type": "application/json"},
                                        data=None if payload is None else json.dumps(payload).encode(),
                                        method="GET" if payload is None else "POST")
        try:
            with self.opener.open(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            raise Refusal("Cloud DNS API refused request (HTTP " + str(error.code) +
                          "); no credential/body was retained. Confirm token scope and migrated Cloud zone ID.") from None
        except (urllib.error.URLError, TimeoutError) as error:
            raise Refusal("Cloud DNS API connection failed; mutation outcome may be unknown. Re-plan, never blindly retry.") from None

    def snapshot(self):
        zone = self.request("/zones/" + self.zone_id)["zone"]
        require(str(zone["id"]) == self.zone_id and zone["name"] == ZONE and zone.get("mode") == "primary" and
                zone.get("status") == "ok", "Provider zone identity/primary status differs from approved ownership.")
        nameservers = zone.get("authoritative_nameservers", {})
        require(nameservers.get("assigned") and nameservers.get("delegation_status") == "valid" and
                set(nameservers["assigned"]) == set(nameservers.get("delegated", [])),
                "Provider zone delegation is not verified against its assigned authoritative nameservers.")
        rrsets = []
        page = 1
        while page:
            result = self.request(f"/zones/{self.zone_id}/rrsets?name=ntfy&per_page=100&page={page}")
            rrsets.extend(rrset for rrset in result["rrsets"] if rrset["name"] == "ntfy")
            page = result.get("meta", {}).get("pagination", {}).get("next_page")
        rrsets.sort(key=lambda item: item["type"])
        return rrsets, sorted(nameservers["assigned"])

    def action(self, path, payload):
        action = self.request(path, payload)["action"]
        deadline = time.monotonic() + 180
        while action["status"] == "running" and time.monotonic() < deadline:
            time.sleep(2)
            action = self.request("/zones/" + self.zone_id + "/actions/" + str(action["id"]))["action"]
        require(action["status"] == "success",
                "Provider action failed/timed out; re-plan actual records before any retry (no rollback is inferred).")


def a_record(rrsets):
    require(not any(rrset["type"] in ("AAAA", "CNAME", "NS", "DNAME", "HTTPS", "SVCB") for rrset in rrsets),
            "Approved host has a competing IPv6/alias/delegation/service record; owner review is required, no deletion inferred.")
    records = [rrset for rrset in rrsets if rrset["type"] == "A"]
    require(len(records) <= 1, "Provider returned ambiguous A RRSets.")
    return records[0] if records else None


def desired(record, dns):
    return (record is not None and record.get("ttl") == dns["ttl"] and
            [entry["value"] for entry in record.get("records", [])] == [dns["ipv4"]])


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    modes = parser.add_mutually_exclusive_group(required=True)
    for mode in ("review", "plan", "dns", "tls", "check"):
        modes.add_argument("--" + mode, action="store_true")
    parser.add_argument("--evidence", required=True, help="owner-reviewed non-secret version-1 release/DNS evidence JSON")
    parser.add_argument("--values", required=True, help="exact SHA256-bound non-secret contact Helm values")
    parser.add_argument("--context", help="already-selected owner-approved existing kubectl context (live modes)")
    args = parser.parse_args()
    evidence, sources = read_evidence(args)
    dns = evidence["ntfyDNS"]
    objects = manifests(sources)
    if args.review:
        print(json.dumps({"host": HOST, "api": API, "zoneId": dns["zoneId"],
                          "desiredA": {"value": dns["ipv4"], "ttl": dns["ttl"]},
                          "manifests": objects, "liveStateChecked": False}, indent=2))
        return
    require(args.context == evidence["cluster"]["context"], "Live modes require the exact approved --context.")
    require(not any(name.startswith("HELM_KUBE") for name in os.environ), "Unset Helm connection overrides.")
    lock = PrivilegedLock(LOCK)
    lock.acquire()
    owns_lock = lock.check
    kubectl = os.environ.get("KUBECTL", "kubectl")

    def kc(*arguments, data=None, accepted=(0,)):
        owns_lock()
        return run([kubectl, "--context", args.context, *arguments], data=data, accepted=accepted)

    def get(*arguments):
        return json.loads(kc("get", *arguments, "-o", "json"))

    try:
        require(run([kubectl, "config", "current-context"]).decode().strip() == args.context,
                "Select the approved existing context yourself; this helper never switches/opens sessions.")
        config = json.loads(kc("config", "view", "--minify", "-o", "json"))
        require(all(not user.get("user", {}).get("exec") and not user.get("user", {}).get("auth-provider")
                    for user in config.get("users", [])), "Automatic exec/auth-provider session opening is forbidden.")
        require(len(config["clusters"]) == 1 and config["clusters"][0]["cluster"]["server"] == evidence["cluster"]["server"] and
                not config["clusters"][0]["cluster"].get("insecure-skip-tls-verify"), "Cluster API/TLS identity differs from approval.")
        require(get("namespace", "kube-system")["metadata"]["uid"] == CLUSTER_UID, "Wrong cluster kube-system UID.")
        labels = get("namespace", NAMESPACE)["metadata"].get("labels", {})
        require(all(labels.get("pod-security.kubernetes.io/" + gate) == "restricted" and
                    labels.get("pod-security.kubernetes.io/" + gate + "-version") == "v1.36"
                    for gate in ("enforce", "audit", "warn")), "Precreated namespace must have reviewed restricted/v1.36 Pod Security labels.")
        issuer = get("clusterissuer", ISSUER)
        acme = issuer["spec"]["acme"]
        require(issuer["metadata"]["uid"] == ISSUER_UID and acme.get("server") == ACME and
                acme.get("solvers") == [{"http01": {"ingress": {"ingressClassName": "haproxy"}}}] and
                any(condition.get("type") == "Ready" and condition.get("status") == "True"
                    for condition in issuer.get("status", {}).get("conditions", [])),
                "Existing production issuer identity/readiness or exact HAProxy HTTP01 solver changed; no issuer creation/update allowed.")
        require(get("ingressclass", "haproxy")["spec"]["controller"] == dns["ingressController"], "HAProxy ingress class controller differs from approval.")
        service_id = dns["ingressService"]
        service = get("service", service_id["name"], "-n", service_id["namespace"])
        require(service["metadata"]["uid"] == service_id["uid"] and service["spec"]["type"] == "ClusterIP" and
                {80, 443}.issubset({port["port"] for port in service["spec"]["ports"]}) and
                service["spec"].get("selector") == {"app.kubernetes.io/instance": "haproxy-ingress",
                                                   "app.kubernetes.io/name": "haproxy-ingress"},
                "Existing HAProxy ClusterIP Service identity/ports/selector differs from approval.")
        daemonset_id = dns["ingressDaemonSet"]
        daemonset = get("daemonset", daemonset_id["name"], "-n", daemonset_id["namespace"])
        pod_spec = daemonset["spec"]["template"]["spec"]
        status = daemonset.get("status", {})
        require(daemonset["metadata"]["uid"] == daemonset_id["uid"] and pod_spec.get("hostNetwork") is True and
                daemonset["spec"]["selector"]["matchLabels"] == service["spec"]["selector"] and
                status.get("observedGeneration") == daemonset["metadata"]["generation"] and
                status.get("desiredNumberScheduled") == 3 and status.get("numberReady") == 3 and
                status.get("numberAvailable") == 3,
                "Approved existing three-node hostNetwork HAProxy DaemonSet is not current/ready.")
        nodes = get("nodes")["items"]
        require(len(nodes) == 3 and {node["metadata"]["name"] for node in nodes} ==
                {"stadtstack-talos-cp-1", "stadtstack-talos-cp-2", "stadtstack-talos-cp-3"},
                "Approved existing ingress node inventory differs.")
        endpoints = get("endpointslices", "-n", service_id["namespace"], "-l", "kubernetes.io/service-name=" + service_id["name"])
        require(any(endpoint.get("conditions", {}).get("ready") is True for item in endpoints["items"]
                    for endpoint in item.get("endpoints", [])), "Public ingress has no ready EndpointSlice backend.")
        provider = Provider(dns["zoneId"], owns_lock)
        load_balancer = provider.request("/load_balancers/7223013")["load_balancer"]
        require(load_balancer["id"] == 7223013 and load_balancer["name"] == "stadtstack-talos-ingress-lb" and
                load_balancer["public_net"]["ipv4"]["ip"] == dns["ipv4"],
                "Existing Hetzner LB identity/public address differs; no LB creation/update authorized.")
        node_ids = {int(node["spec"]["providerID"].removeprefix("hcloud://")) for node in nodes}
        targets = load_balancer.get("targets", [])
        require(len(targets) == 1 and targets[0].get("type") == "label_selector" and
                targets[0].get("label_selector") == {"selector": "cluster=stadtstack-talos,ingress=public"} and
                targets[0].get("use_private_ip") is True,
                "Existing Hetzner LB selector/private-target contract differs.")
        resolved_targets = targets[0].get("targets", [])
        require(len(resolved_targets) == 3 and all(target.get("type") == "server" and
                target.get("use_private_ip") is True and
                {health["listen_port"]: health["status"] for health in target.get("health_status", [])} ==
                {80: "healthy", 443: "healthy"} for target in resolved_targets) and
                {target["server"]["id"] for target in resolved_targets} == node_ids,
                "Existing Hetzner LB must resolve exactly the three approved private nodes with both ports healthy.")
        services = load_balancer.get("services", [])
        require({item["listen_port"] for item in services} == {80, 443} and all(
                item.get("protocol") == "tcp" and item.get("destination_port") == item["listen_port"] and
                item.get("proxyprotocol") is True for item in services),
                "Existing LB HTTP/HTTPS TCP and PROXY protocol contract differs.")
        before, nameservers = provider.snapshot()
        record = a_record(before)
        plan = {"host": HOST, "zoneId": dns["zoneId"], "beforeSHA256": fingerprint(before),
                "existingHostRRSets": before, "dnsAction": "none" if desired(record, dns) else ("create" if record is None else "replaceA"),
                "desiredA": {"value": dns["ipv4"], "ttl": dns["ttl"]}, "manifests": objects,
                "http01ReadinessEvidence": dns["ingressReadinessEvidence"]}
        print(json.dumps(plan, indent=2), flush=True)
        if args.plan:
            return
        if args.dns:
            if desired(record, dns):
                print("Approved A RRSet already matches; no DNS write.")
                return
            require(fingerprint(before) == dns["beforeSHA256"], "Existing host RRSets differ from owner-reviewed beforeSHA256; re-plan.")
            require(record is None or not record.get("protection", {}).get("change"), "A RRSet is change-protected; never disable protection.")
            confirm(f"change DNS {HOST} {dns['ipv4']} zone {dns['zoneId']} owner {dns['domainOwner']}")
            fresh, _ = provider.snapshot()
            require(fingerprint(fresh) == fingerprint(before), "DNS changed since review; no write authorized.")
            base = "/zones/" + dns["zoneId"] + "/rrsets"
            if record is None:
                provider.action(base, {"name": "ntfy", "type": "A", "ttl": dns["ttl"], "records": [{"value": dns["ipv4"]}]})
            else:
                old_records = record["records"]
                require(len(old_records) == 1, "Replacing a multi-address RRSet requires a separate owner migration plan.")
                if old_records[0]["value"] != dns["ipv4"]:
                    replacement = {"value": dns["ipv4"]}
                    if old_records[0].get("comment"):
                        replacement["comment"] = old_records[0]["comment"]
                    provider.action(base + "/ntfy/A/actions/set_records", {"records": [replacement]})
                if record.get("ttl") != dns["ttl"]:
                    latest, _ = provider.snapshot()
                    expected = json.loads(json.dumps(before))
                    expected_a = a_record(expected)
                    if old_records[0]["value"] != dns["ipv4"]:
                        expected_a["records"] = [replacement]
                    require(fingerprint(latest) == fingerprint(expected),
                            "DNS changed before TTL update; stop and re-plan, no further write authorized.")
                    provider.action(base + "/ntfy/A/actions/change_ttl", {"ttl": dns["ttl"]})
            after, _ = provider.snapshot()
            require(desired(a_record(after), dns), "Provider readback does not match approved A/TTL; stop and review actual state.")
            print("Exact approved ntfy A RRSet verified by provider readback; public propagation/TLS not inferred.")
            return
        require(desired(record, dns), "Approved A RRSet/TTL must exist before TLS issuance/readiness checks.")
        # HTTP01 may not start until every assigned authoritative server agrees.
        for nameserver in nameservers:
            require(re.fullmatch(r"[A-Za-z0-9.-]+", nameserver) is not None, "Invalid provider nameserver identity.")
            answer = run(["dig", "@" + nameserver, HOST, "A", "+short", "+norecurse", "+time=3", "+tries=1"]).decode().split()
            require(answer == [dns["ipv4"]], "Authoritative DNS has not converged to the exact approved ingress address.")
        if args.tls:
            require(fingerprint(before) == dns["beforeSHA256"],
                    "TLS bootstrap requires a newly reviewed current DNS beforeSHA256 (re-plan after a DNS change).")
        if args.tls or args.check:
            # Existing divergent resources are never adopted or overwritten silently.
            missing = []
            for item in objects:
                existing_data = kc("get", item["kind"], item["metadata"]["name"], "-n", NAMESPACE,
                                   "--ignore-not-found", "-o", "json")
                if not existing_data.strip():
                    missing.append(item)
                    continue
                existing = json.loads(existing_data)
                require(all(existing["spec"].get(key) == value for key, value in item["spec"].items()) and
                        set(existing["spec"]) == set(item["spec"]),
                        "Existing " + item["kind"] + "/" + item["metadata"]["name"] + " diverges; a separate reviewed migration is required.")
                if item["kind"] == "NetworkPolicy":
                    require(existing["metadata"].get("labels", {}).get("app.kubernetes.io/managed-by") == "Helm" and
                            all(existing["metadata"].get("annotations", {}).get(key) == value
                                for key, value in item["metadata"]["annotations"].items()),
                            "Existing policy is not owned by this contact chart; no silent ownership adoption.")
            if missing:
                require(args.tls, "Required namespace-local TLS policy/certificate is missing; --check never creates resources.")
                for item in missing:
                    if item["kind"] == "Certificate":
                        existing_secret = kc("get", "secret", item["spec"]["secretName"], "-n", NAMESPACE,
                                             "--ignore-not-found", "-o", "name")
                        require(not existing_secret.strip(),
                                "TLS Secret exists without approved Certificate; no implicit overwrite/adoption authorized.")
                admitted = []
                for item in missing:
                    planned = json.loads(kc("create", "--dry-run=server", "-f", "-", "-o", "json",
                                            data=json.dumps(item).encode()))
                    approved_object(planned, item)
                    admitted.append((item, planned))
                print(json.dumps({"serverAdmissionPlans": [
                    {"kind": item["kind"], "name": item["metadata"]["name"], "before": None,
                     "approvedSpec": item["spec"], "admittedSpec": plan["spec"],
                     "planSHA256": fingerprint({"spec": plan["spec"], "ownership": item["metadata"]})}
                    for item, plan in admitted]}, indent=2), flush=True)
                confirm(f"create TLS {HOST} {NAMESPACE} {args.context} owner {dns['domainOwner']}")
                fresh, _ = provider.snapshot()
                require(desired(a_record(fresh), dns), "DNS changed before TLS issuance; no write authorized.")
                # Ordered create refuses races; compare UID and admitted spec after real admission.
                for item, planned in admitted:
                    created = json.loads(kc("create", "-f", "-", "-o", "json", data=json.dumps(item).encode()))
                    approved_object(created, item)
                    require(created["spec"] == planned["spec"] and created["metadata"].get("uid"),
                            "Actual admission differs from server preview or lacks UID.")
                    observed = get(item["kind"], item["metadata"]["name"], "-n", NAMESPACE)
                    approved_object(observed, item)
                    require(observed["metadata"]["uid"] == created["metadata"]["uid"],
                            "Resource replaced before post-create readback; stop without further writes.")
            if args.tls:
                for item in objects:
                    if item["kind"] == "Certificate":
                        kc("wait", "-n", NAMESPACE, "--for=condition=Ready",
                           "certificate/" + item["metadata"]["name"], "--timeout=300s")
        for item in objects:
            if item["kind"] != "Certificate":
                continue
            certificate_name = item["metadata"]["name"]
            host = item["spec"]["dnsNames"][0]
            cert = get("certificate", certificate_name, "-n", NAMESPACE)
            approved_object(cert, item)
            require(any(condition.get("type") == "Ready" and condition.get("status") == "True" and
                        condition.get("observedGeneration") == cert["metadata"]["generation"]
                        for condition in cert.get("status", {}).get("conditions", [])),
                    "Namespace-local Certificate is not current Ready for approved host/issuer.")
            # Only public leaf and boolean key presence leave kubectl, never tls.key.
            public = kc("get", "secret", certificate_name, "-n", NAMESPACE, "-o",
                        'go-template={{if eq .type "kubernetes.io/tls"}}{{if index .data "tls.key"}}{{index .data "tls.crt"}}{{end}}{{end}}')
            require(public.strip(), "Namespace-local TLS certificate/private-key presence is absent.")
            leaf = base64.b64decode(public, validate=True)
            validity = run(["openssl", "x509", "-noout", "-checkend", "86400", "-checkhost", host], data=leaf)
            require(("Hostname " + host + " does match certificate").encode() in validity,
                    "TLS leaf does not cover the approved host.")
        if args.check:
            ingress = get("ingress", "stadtstack-contact-ntfy", "-n", NAMESPACE)
            expected_rules = [{"host": HOST, "http": {"paths": [{"path": "/", "pathType": "Prefix",
                              "backend": {"service": {"name": "stadtstack-contact-ntfy", "port": {"number": 8080}}}}]}}]
            require(ingress["spec"].get("ingressClassName") == "haproxy" and
                    ingress["spec"].get("rules") == expected_rules and
                    ingress["spec"].get("tls") == [{"secretName": CERTIFICATE, "hosts": [HOST]}],
                    "Public ntfy Ingress host/class/service/TLS contract differs from approved chart.")
            print("Read-only DNS/ingress/namespace certificate readiness checked; no notification, HTTP request or live acceptance inferred.")
        else:
            print("Namespace-local certificate Ready; deploy chart separately. Public ingress and iOS notification acceptance remain owner-gated.")
    finally:
        lock.release()


if __name__ == "__main__":
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    for signum in (signal.SIGTERM, signal.SIGHUP):
        signal.signal(signum, lambda number, frame: (_ for _ in ()).throw(Refusal("Interrupted; no further writes authorized.")))
    try:
        main()
    except (Refusal, OSError, KeyError, ValueError, TypeError, KeyboardInterrupt):
        # Only explicitly authored refusal messages are safe to disclose.
        error = sys.exc_info()[1]
        print("Refused: " + (str(error) if isinstance(error, Refusal) else "Required input/operation failed; credential diagnostics suppressed."), file=sys.stderr)
        sys.exit(1)
