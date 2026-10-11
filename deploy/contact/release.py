#!/usr/bin/env python3
"""Owner-gated contact release; never opens a session or sends a test message."""
import argparse
import base64
import datetime
import hashlib
import getpass
import json
import os
from pathlib import Path
import re
import resource
import shutil
import signal
import subprocess
import sys
import urllib.parse
import urllib.request
import secrets
from keychain import Keychain
from privileged_lock import PrivilegedLock

CHART = Path(__file__).resolve().parent
ROOT = CHART.parent.parent
NAMESPACE = "stadtstack-contact"
CLUSTER_UID = "7bc769bc-e860-4d54-a0d5-d426f3a52420"
LOCK = Path("/Users/max/.cache/cluster-ops/privileged-session.lock")
REPOSITORY = "GiraeffleAeffle/stadtstack-site"
IMAGE = "ghcr.io/giraeffleaeffle/stadtstack-contact"
WORKFLOW = ".github/workflows/contact-image.yml"
SECRET = "stadtstack-contact-inbox"
KEY_SERVICE = "org.stadtstack.contact.inbox-key"
ADMIN_SERVICE = "org.stadtstack.contact.admin"


class Refusal(Exception):
    pass


def require(condition, message):
    if not condition:
        raise Refusal(message)


def run(command, *, data=None, accepted=(0,), private=False, cwd=None):
    # Secret operations discard *both* streams, including kubectl error details.
    environment = os.environ.copy()
    for variable in ("CONTACT_ENCRYPTION_KEY", "CONTACT_ADMIN_TOKEN", "HCLOUD_TOKEN"):
        environment.pop(variable, None)
    result = subprocess.run(command, input=data, stdout=subprocess.DEVNULL if private else subprocess.PIPE,
                            stderr=subprocess.DEVNULL if private else subprocess.PIPE,
                            env=environment, cwd=cwd, check=False)
    require(result.returncode in accepted,
            "Private operation failed; no credential output was retained." if private else
            "Command failed: " + " ".join(command) + "\n" + result.stderr.decode(errors="replace"))
    return result.returncode, result.stdout or b""


def verify_tls_leaf(certificate, host):
    # OpenSSL -checkend short-circuits -checkhost; each must run independently.
    run(["openssl", "x509", "-noout", "-checkend", "86400"], data=certificate)
    _, hostname = run(["openssl", "x509", "-noout", "-checkhost", host], data=certificate)
    require(("Hostname " + host + " does match certificate").encode() in hostname,
            "Namespace TLS certificate does not cover " + host)


def text(command, **kwargs):
    return run(command, **kwargs)[1].decode().strip()


def json_command(command):
    return json.loads(text(command))


def timestamp(value, name):
    require(isinstance(value, str), name + " must be an ISO8601 timestamp.")
    try:
        parsed = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
        require(parsed.tzinfo is not None and parsed <= datetime.datetime.now(datetime.timezone.utc),
                name + " must be a non-future timestamp with timezone.")
    except ValueError as error:
        raise Refusal(name + " must be an ISO8601 timestamp.") from error


def validate_evidence(args):
    evidence = json.loads(Path(args.evidence).read_text())
    require(evidence.get("version") == 1, "Evidence version must be 1.")
    require(evidence.get("sourceCommit") == args.source and evidence.get("imageDigest") == args.digest,
            "Evidence must bind the selected source commit and image digest.")
    require(evidence.get("valuesSHA256") == hashlib.sha256(Path(args.values).read_bytes()).hexdigest(),
            "Evidence does not bind this exact non-secret values file.")
    approval = evidence["ownerApproval"]
    require(isinstance(approval.get("owner"), str) and approval["owner"].strip(), "Owner identity is required.")
    timestamp(approval.get("approvedAt"), "ownerApproval.approvedAt")
    for gate in ("deployment", "publication", "legal", "retention", "ingressTLS", "networkEnforcement", "logPrivacy",
                 "persistentStorage", "privateAdminAccess", "keySecretProtectedInput", "ntfyPublicEndpoint",
                 "ntfyDNS", "ntfyTLS", "iosContentfreeRelay", "ntfyAuthACL"):
        require(approval.get(gate) is True, "Explicit owner approval missing: " + gate)
    require(isinstance(approval.get("retentionPolicy"), str) and approval["retentionPolicy"].strip(),
            "The approved retention policy must be recorded, not inferred.")
    cluster = evidence["cluster"]
    require(cluster.get("context") == args.context and cluster.get("namespace") == NAMESPACE and
            cluster.get("kubeSystemUID") == CLUSTER_UID and isinstance(cluster.get("server"), str) and
            cluster["server"].startswith("https://"), "Evidence must approve the exact existing cluster context/API/namespace.")
    inbox = evidence["inbox"]
    for gate in ("privateAccessTested", "persistentRestartTested", "encryptionAtRestTested", "automaticDeletionTested"):
        require(inbox.get(gate) is True, "Real self-hosted inbox evidence missing: " + gate)
    require(inbox.get("retentionDays") == 90 and inbox.get("adminPort") == 8082 and inbox.get("secretName") == SECRET,
            "Inbox evidence must bind the 90-day store, private port8082 and approved key Secret.")
    timestamp(inbox.get("testedAt"), "inbox.testedAt")
    require(isinstance(inbox.get("evidence"), str) and inbox["evidence"].strip(),
            "An owner-reviewed private inbox test evidence reference is required.")
    notification = evidence["notification"]
    for gate in ("realSelfHostedNtfyObserved", "genericNoPII", "authenticatedDenyAll", "ownerReadOnly",
                 "contactPublishOnly", "iosContentfreeRelayConfigured", "relayPayloadInspected", "publicImageVerified"):
        require(notification.get(gate) is True, "Notification evidence missing: " + gate)
    require(notification.get("endpoint") == "https://ntfy.stadtstack.eu" and
            notification.get("upstream") == "https://ntfy.sh" and notification.get("topic") == "contact",
            "Notification evidence must bind the approved endpoint/topic/content-free upstream.")
    require(re.fullmatch(r"sha256:[a-f0-9]{64}", notification.get("ntfyImageDigest", "")) is not None,
            "Notification evidence requires the reviewed public ntfy image digest.")
    timestamp(notification.get("observedAt"), "notification.observedAt")
    require(isinstance(notification.get("evidence"), str) and notification["evidence"].strip(),
            "Real authenticated ntfy stream/ACL evidence and isolated relay-payload evidence references are required.")
    return evidence


def github(args):
    info = json_command(["gh", "api", f"repos/{REPOSITORY}/actions/runs/{args.run_id}"])
    require(info.get("status") == "completed" and info.get("conclusion") == "success" and
            info.get("event") == "push" and info.get("head_sha") == args.source and
            info.get("path") == WORKFLOW and info.get("repository", {}).get("full_name", "").lower() == REPOSITORY.lower(),
            "Workflow run is not the successful pushed contact workflow for this source/repository.")
    tag = info.get("head_branch", "")
    require(re.fullmatch(r"contact-image-[A-Za-z0-9._-]+", tag) is not None,
            "Workflow must have been triggered by a pushed contact-image-* tag, not a manual dispatch.")
    reference = json_command(["gh", "api", f"repos/{REPOSITORY}/git/ref/tags/{urllib.parse.quote(tag, safe='')}"])["object"]
    while reference["type"] == "tag":
        reference = json_command(["gh", "api", f"repos/{REPOSITORY}/git/tags/{reference['sha']}"])["object"]
    require(reference["type"] == "commit" and reference["sha"] == args.source,
            "The pushed workflow tag no longer identifies the approved source.")
    logs = text(["gh", "run", "view", args.run_id, "--repo", REPOSITORY, "--log"])
    digests = set(re.findall(r"DIGEST:\s*(sha256:[a-f0-9]{64})(?:\s|$)", logs))
    require(digests == {args.digest}, "Successful workflow log does not report this exact unique pushed digest.")


def public_image(args):
    # Anonymous GHCR read proves public pullability; no docker credential/config cache.
    scope = "repository:giraeffleaeffle/stadtstack-contact:pull"
    token_url = "https://ghcr.io/token?" + urllib.parse.urlencode({"service": "ghcr.io", "scope": scope})
    with urllib.request.urlopen(token_url, timeout=30) as response:
        token = json.load(response)["token"]
    headers = {"Authorization": "Bearer " + token,
               "Accept": "application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json"}

    def fetch(kind, digest):
        require(re.fullmatch(r"sha256:[a-f0-9]{64}", digest) is not None, "Registry returned an invalid digest.")
        request = urllib.request.Request(f"https://ghcr.io/v2/giraeffleaeffle/stadtstack-contact/{kind}/{digest}", headers=headers)
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read()
        require("sha256:" + hashlib.sha256(raw).hexdigest() == digest, "Public registry content digest mismatch.")
        return json.loads(raw)

    manifest = fetch("manifests", args.digest)
    if "manifests" in manifest:
        matches = [entry for entry in manifest["manifests"] if entry.get("platform", {}).get("os") == "linux"
                   and entry.get("platform", {}).get("architecture") == "amd64"]
        require(len(matches) == 1, "Public image must contain one reviewed linux/amd64 manifest.")
        manifest = fetch("manifests", matches[0]["digest"])
    configuration = fetch("blobs", manifest["config"]["digest"])
    require(configuration.get("os") == "linux" and configuration.get("architecture") == "amd64",
            "Pushed image platform is not linux/amd64.")
    labels = configuration.get("config", {}).get("Labels", {})
    require(labels.get("org.opencontainers.image.revision") == args.source and
            labels.get("org.opencontainers.image.source", "").rstrip("/").lower() == "https://github.com/" + REPOSITORY.lower(),
            "Public image OCI source/revision identity does not match the approved workflow.")


def confirm(phrase):
    try:
        with open("/dev/tty", "r") as reader, open("/dev/tty", "w") as writer:
            writer.write('Type exactly "' + phrase + '" to authorize this write: ')
            writer.flush()
            answer = reader.readline().rstrip("\n")
    except OSError as error:
        raise Refusal("Owner confirmation requires a controlling terminal.") from error
    require(answer == phrase, "Owner confirmation did not match; no write authorized.")


def bootstrap_inbox(kc, owns_lock, context):
    """Resume owner custody without replacing an existing encryption/admin key."""
    _, existing = kc("-n", NAMESPACE, "get", "secret", SECRET, "--ignore-not-found", "-o", "name")
    confirm(f"bootstrap inbox Keychain and secret {NAMESPACE} {context}")
    owns_lock()
    keychain = Keychain()
    account = getpass.getuser()
    key = keychain.read(KEY_SERVICE, account)
    admin = keychain.read(ADMIN_SERVICE, account)
    require(not existing.strip() or (key is not None and admin is not None),
            "Existing inbox Secret lacks owner Keychain custody; refusing replacement.")
    for item, field in ((key, "CONTACT_ENCRYPTION_KEY"), (admin, "CONTACT_ADMIN_TOKEN")):
        require(item is None or (isinstance(item, dict) and item.get("version") == 1 and
                                isinstance(item.get(field), str)), "Invalid owner custody; no replacement authorized.")
    if key is None:
        key = {"version": 1, "CONTACT_ENCRYPTION_KEY": base64.b64encode(secrets.token_bytes(32)).decode()}
        owns_lock()
        keychain.create(KEY_SERVICE, account, key)
    if admin is None:
        admin = {"version": 1, "CONTACT_ADMIN_TOKEN": secrets.token_urlsafe(32)}
        owns_lock()
        keychain.create(ADMIN_SERVICE, account, admin)
    encoded_key = key["CONTACT_ENCRYPTION_KEY"]
    token = admin["CONTACT_ADMIN_TOKEN"]
    decoded = base64.b64decode(encoded_key, validate=True)
    require(len(decoded) == 32 and base64.b64encode(decoded).decode() == encoded_key,
            "Owner custody encryption key is not canonical base64 of 32 bytes.")
    require(len(token) >= 32 and re.search(r"[\s\x00-\x1f\x7f]", token) is None, "Owner custody admin token is invalid.")
    if existing.strip():
        # Protected in-memory comparison only; no Secret value reaches argv/output.
        expected_key = base64.b64encode(encoded_key.encode()).decode()
        expected_admin = base64.b64encode(token.encode()).decode()
        owns_lock()
        environment = os.environ.copy()
        environment.pop("HCLOUD_TOKEN", None)
        command = [os.environ.get("KUBECTL", "kubectl"), "--context", context, "-n", NAMESPACE,
                   "get", "secret", SECRET, "-o", "json"]
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=environment, check=False)
        require(result.returncode == 0, "Protected inbox comparison failed; no credential output retained.")
        current = json.loads(result.stdout)
        require(current.get("type") == "Opaque" and current.get("data", {}).get("CONTACT_ENCRYPTION_KEY") == expected_key and
                current.get("data", {}).get("CONTACT_ADMIN_TOKEN") == expected_admin,
                "Existing inbox Secret differs from custody; refusing replacement.")
    else:
        manifest = {"apiVersion": "v1", "kind": "Secret", "metadata": {"name": SECRET, "namespace": NAMESPACE},
                    "type": "Opaque", "stringData": {"CONTACT_ENCRYPTION_KEY": encoded_key, "CONTACT_ADMIN_TOKEN": token}}
        kc("create", "-f", "-", data=json.dumps(manifest).encode(), private=True)
    print("Inbox key/admin Secret and native Keychain custody matched; no credential output or replacement.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    for mode in ("review", "namespace", "secret", "deploy"):
        modes.add_argument("--" + mode, action="store_true")
    parser.add_argument("--values", required=True, help="reviewed non-secret Helm values YAML")
    parser.add_argument("--digest", required=True, help="immutable workflow-pushed sha256 digest")
    parser.add_argument("--keychain-bootstrap", action="store_true", help="secret mode only: owner-approved random key/admin custody")
    parser.add_argument("--context", help="owner-approved already-selected existing kubectl context")
    parser.add_argument("--source", help="full 40-character workflow source commit")
    parser.add_argument("--run-id", help="successful pushed contact-image-* workflow run ID")
    parser.add_argument("--evidence", help="owner-reviewed version-1 release evidence JSON")
    args = parser.parse_args()
    require(re.fullmatch(r"sha256:[a-f0-9]{64}", args.digest) is not None, "A real immutable sha256 digest is required.")
    require(Path(args.values).is_file(), "Reviewed values file is absent.")
    require(shutil.which("helm"), "Required binary missing: helm")
    values = str(Path(args.values).resolve())
    helm_values = ["--values", values, "--set-string", "image.repository=" + IMAGE,
                   "--set-string", "image.digest=" + args.digest, "--set-string", "secretName=" + SECRET]

    def render():
        return run(["helm", "template", NAMESPACE, str(CHART), "--namespace", NAMESPACE, *helm_values])[1]

    if args.review:
        require(not args.keychain_bootstrap, "--keychain-bootstrap is only for --secret.")
        print("Offline manifest review only: no cluster, protected key input or workflow evidence is checked.", file=sys.stderr)
        sys.stdout.buffer.write(render())
        return
    require(args.keychain_bootstrap == args.secret, "--secret requires --keychain-bootstrap; no other mode accesses custody.")
    for name in ("context", "source", "run_id", "evidence"):
        require(getattr(args, name), "Mutating modes require --" + name.replace("_", "-"))
    require(re.fullmatch(r"[a-f0-9]{40}", args.source) is not None and re.fullmatch(r"[1-9][0-9]*", args.run_id) is not None,
            "Source must be a full lowercase commit SHA and run ID must be numeric.")
    require(not any(name in os.environ for name in ("CONTACT_ENCRYPTION_KEY", "CONTACT_ADMIN_TOKEN")),
            "Do not export key/token material; only hidden owner-protected terminal input may supply it.")
    for variable in ("HELM_KUBEAPISERVER", "HELM_KUBECAFILE", "HELM_KUBETOKEN", "HELM_KUBEASUSER",
                     "HELM_KUBEASGROUPS", "HELM_KUBEINSECURE_SKIP_TLS_VERIFY", "HELM_KUBETLS_SERVER_NAME",
                     "HELM_KUBECONTEXT", "HELMFILE_KUBE_CONTEXT"):
        require(variable not in os.environ, "Refusing connection override " + variable + "; unset it.")
    kubectl = os.environ.get("KUBECTL", "kubectl")
    for binary in (kubectl, "gh", "git", "openssl"):
        require(shutil.which(binary), "Required binary missing: " + binary)
    evidence = validate_evidence(args)
    require(text(["git", "rev-parse", "HEAD"], cwd=ROOT) == args.source,
            "Release must run from the workflow source commit, not a different checkout.")
    require(not text(["git", "status", "--porcelain", "--untracked-files=no"], cwd=ROOT),
            "Tracked release/source files must be committed and clean.")
    require(not text(["git", "ls-files", "--others", "--exclude-standard", "--", "deploy/contact", "contact-service", WORKFLOW], cwd=ROOT),
            "Untracked release/backend/workflow files are not an approved committed snapshot.")
    lock = PrivilegedLock(LOCK)
    lock.acquire()
    owns_lock = lock.check

    def kc(*arguments, **kwargs):
        owns_lock()
        return run([kubectl, "--context", args.context, *arguments], **kwargs)

    try:
        manifest_preview = render()
        expected_ntfy_image = "docker.io/binwiederhier/ntfy@" + evidence["notification"]["ntfyImageDigest"]
        require(('image: "' + expected_ntfy_image + '"').encode() in manifest_preview,
                "Rendered ntfy image must match the reviewed public notification digest and official repository.")
        github(args)
        public_image(args)
        require(text([kubectl, "config", "current-context"]) == args.context,
                "Select the explicitly approved existing context yourself; the script never opens/switches sessions.")
        config = json.loads(kc("config", "view", "--minify", "-o", "json")[1])
        require(all(not entry.get("user", {}).get("exec") and not entry.get("user", {}).get("auth-provider")
                    for entry in config.get("users", [])),
                "Use already-provisioned cluster credentials; automatic exec/auth-provider session opening is forbidden.")
        server = config["clusters"][0]["cluster"]["server"]
        require(server == evidence["cluster"]["server"], "Cluster API does not match owner-approved evidence.")
        uid = kc("get", "namespace", "kube-system", "-o", "jsonpath={.metadata.uid}")[1].decode()
        require(uid == CLUSTER_UID, "Wrong cluster: kube-system UID does not match the reviewed Talos cluster.")
        sys.stdout.buffer.write(manifest_preview)
        sys.stdout.flush()
        print(f"Reviewed target: context {args.context}, API {server}, namespace {NAMESPACE}, image {IMAGE}@{args.digest}.")
        if args.namespace:
            _, preview = kc("diff", "--server-side", "--field-manager=stadtstack-contact-apply",
                            "-f", str(CHART / "namespace.yaml"), accepted=(0, 1))
            sys.stdout.buffer.write(preview)
            sys.stdout.flush()
            confirm(f"create namespace {NAMESPACE} {args.context}")
            owns_lock()
            output = kc("apply", "--server-side", "--field-manager=stadtstack-contact-apply", "-f", str(CHART / "namespace.yaml"))[1]
            sys.stdout.buffer.write(output)
            return
        namespace = json.loads(kc("get", "namespace", NAMESPACE, "-o", "json")[1])
        labels = namespace.get("metadata", {}).get("labels", {})
        require(all(labels.get("pod-security.kubernetes.io/" + gate) == "restricted" and
                    labels.get("pod-security.kubernetes.io/" + gate + "-version") == "v1.36"
                    for gate in ("enforce", "audit", "warn")), "Namespace must have the reviewed restricted Pod Security labels/version.")
        if args.secret:
            bootstrap_inbox(kc, owns_lock, args.context)
            return
        readiness = kc("-n", NAMESPACE, "get", "secret", SECRET, "-o",
                       'go-template={{if index .data "CONTACT_ENCRYPTION_KEY"}}{{if index .data "CONTACT_ADMIN_TOKEN"}}{{if index .data "NTFY_TOKEN"}}ready{{end}}{{end}}{{end}}')[1]
        require(readiness == b"ready", "Inbox key/admin/publisher Secret keys are absent; use governed key and ntfy credential modes.")
        ntfy_readiness = kc("-n", NAMESPACE, "get", "secret", "stadtstack-contact-ntfy", "-o",
                            'go-template={{if index .data "NTFY_AUTH_USERS"}}{{if index .data "NTFY_AUTH_ACCESS"}}{{if index .data "NTFY_AUTH_TOKENS"}}ready{{end}}{{end}}{{end}}')[1]
        require(ntfy_readiness == b"ready", "Authenticated ntfy Secret keys are missing; use governed ntfy credentials helper.")
        for secret_name, host in (("stadtstack-contact-tls", "stadtstack.eu"),
                                  ("stadtstack-contact-ntfy-tls", "ntfy.stadtstack.eu")):
            tls = kc("-n", NAMESPACE, "get", "secret", secret_name, "-o",
                     'go-template={{if eq .type "kubernetes.io/tls"}}{{if index .data "tls.key"}}{{index .data "tls.crt"}}{{end}}{{end}}')[1]
            require(tls.strip(), "Approved namespace-local TLS Secret/certificate/key is missing: " + secret_name)
            certificate = base64.b64decode(tls)
            verify_tls_leaf(certificate, host)
        require(kc("get", "ingressclass", "haproxy", "-o", "jsonpath={.spec.controller}")[1].strip(),
                "Reviewed HAProxy ingress class is absent.")
        require("diff" in text(["helm", "plugin", "list"]).split(), "Helm diff plugin is required for deployment.")
        helm = ["helm", "--kube-context", args.context, "--namespace", NAMESPACE]
        owns_lock()
        _, preview = run([*helm, "diff", "upgrade", NAMESPACE, str(CHART), "--allow-unreleased",
                          "--detailed-exitcode", "--suppress-secrets", *helm_values], accepted=(0, 2))
        sys.stdout.buffer.write(preview)
        sys.stdout.flush()
        confirm(f"deploy {NAMESPACE} {args.context} {args.digest}")
        owns_lock()
        _, output = run([*helm, "upgrade", "--install", NAMESPACE, str(CHART), *helm_values,
                         "--atomic", "--cleanup-on-fail", "--wait", "--wait-for-jobs", "--timeout", "600s", "--history-max", "10"])
        sys.stdout.buffer.write(output)
        _, rollout = kc("-n", NAMESPACE, "rollout", "status", "deployment/stadtstack-contact", "--timeout=180s")
        sys.stdout.buffer.write(rollout)
        _, ntfy_rollout = kc("-n", NAMESPACE, "rollout", "status", "deployment/stadtstack-contact-ntfy", "--timeout=180s")
        sys.stdout.buffer.write(ntfy_rollout)
        print("Rollout completed; public HTTPS/TLS/auth routing, private inbox persistence/deletion and approved iOS delivery still require owner acceptance.")
    finally:
        lock.release()


if __name__ == "__main__":
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    def interrupted(signum, frame):
        raise KeyboardInterrupt

    for signum in (signal.SIGTERM, signal.SIGHUP):
        signal.signal(signum, interrupted)
    try:
        main()
    except KeyboardInterrupt:
        print("Interrupted; no further operations authorized.", file=sys.stderr)
        sys.exit(130)
    except RuntimeError:
        print("Release refused: protected custody operation failed; no credential output retained.", file=sys.stderr)
        sys.exit(1)
    except (Refusal, OSError, ValueError, KeyError, TypeError) as error:
        print("Release refused: " + str(error), file=sys.stderr)
        sys.exit(1)
