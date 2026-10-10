#!/usr/bin/env python3
"""Prepare/run the separately owner-approved ntfy credential bootstrap, never a rollout.

Do not run before legal/retention/release approval and shared-lock release. Usage:
  python3 deploy/contact/ntfy-credentials.py --bootstrap --values <reviewed.yaml> \
    --digest sha256:<digest> --source <commit> --run-id <run> \
    --context <already-current-context> --evidence <reviewed.json>

Requires macOS, the release.py tools, and an owner-reviewed installation of Python
bcrypt (real cost-12 hashes; no online hash generator or ntfy CLI secret output).
Creates/resumes credentials, not rotation: mismatching existing ntfy credentials
are refused. Existing inbox encryption/admin keys are never read or replaced.

Owner setup: use Keychain Access GUI, service org.stadtstack.ntfy.owner, account
owner; its protected JSON contains password and token. Enter the password in the
ntfy iOS account GUI with server https://ntfy.stadtstack.eu and username owner,
then subscribe to contact. A token-capable client may use the token instead.
Never retrieve with `security ... -w`, shell substitutions, logs, screenshots,
URLs or clipboard automation. This helper never displays either credential.

Supported v2.29.0 configuration is comma-separated user:hash:user,
user:topic:ro/wo and user:tk_<29 characters>:label. Source references:
https://docs.ntfy.sh/config/#users-via-the-config
https://docs.ntfy.sh/config/#acl-entries-via-the-config
https://docs.ntfy.sh/config/#tokens-via-the-config
https://github.com/binwiederhier/ntfy/blob/v2.29.0/cmd/serve.go
https://github.com/binwiederhier/ntfy/blob/v2.29.0/user/util.go
"""
import argparse
import base64
import hmac
import json
import os
from pathlib import Path
import re
import resource
import secrets
import shutil
import signal
import string
import subprocess
import sys

# Importing the adjacent module does not execute its mutating main().
import release
from keychain import Keychain

NTFY_SECRET = "stadtstack-contact-ntfy"
OWNER_SERVICE = "org.stadtstack.ntfy.owner"
PUBLISHER_SERVICE = "org.stadtstack.ntfy.bootstrap"
ENDPOINT = "https://ntfy.stadtstack.eu"
NTFY_DIGEST = "sha256:4c599cf0818965782f93f652bd843e92714992e84d6b88ad17713dc0951cda1f"
ACCESS = "owner:contact:ro,contact:contact:wo"
require = release.require




def new_token():
    # v2.29.0 ValidToken requires tk_ plus exactly 29 URL-safe characters.
    return "tk_" + "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(29))


def new_credential(bcrypt, *, owner):
    password = secrets.token_urlsafe(32)  # 43 ASCII bytes, below bcrypt's 72-byte boundary
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()
    credential = {"version": 1, "endpoint": ENDPOINT, "topic": "contact", "token": new_token(), "hash": password_hash}
    if owner:
        credential["password"] = password
    return credential


def validate_credential(credential, bcrypt, *, owner):
    require(isinstance(credential, dict) and credential.get("version") == 1 and
            credential.get("endpoint") == ENDPOINT and credential.get("topic") == "contact",
            "Keychain item is not this reviewed credential bundle; no automatic migration/rotation.")
    require(re.fullmatch(r"tk_[-_A-Za-z0-9]{29}", credential.get("token", "")) is not None,
            "Keychain token has an unsupported format.")
    require(re.fullmatch(r"\$2[aby]\$12\$[./A-Za-z0-9]{53}", credential.get("hash", "")) is not None,
            "Keychain password hash must be a real cost-12 bcrypt hash.")
    if owner:
        password = credential.get("password")
        require(isinstance(password, str) and 32 <= len(password.encode()) <= 72 and
                bcrypt.checkpw(password.encode(), credential["hash"].encode()),
                "Owner password does not match the custody hash.")


def secret_fields(owner, publisher):
    return {"NTFY_AUTH_USERS": f'owner:{owner["hash"]}:user,contact:{publisher["hash"]}:user',
            "NTFY_AUTH_ACCESS": ACCESS,
            "NTFY_AUTH_TOKENS": f'owner:{owner["token"]}:owner,contact:{publisher["token"]}:contact'}


def inbox_patch(resource_version, token, existing_token=""):
    # ResourceVersion guards races; a known equal token is a no-op, never rotation.
    require(isinstance(resource_version, str) and resource_version, "Inbox Secret resourceVersion is absent.")
    require(isinstance(existing_token, str), "Existing publisher token must be protected encoded data.")
    encoded = base64.b64encode(token.encode()).decode()
    if existing_token:
        require(hmac.compare_digest(existing_token, encoded), "Existing inbox publisher token differs from custody; refusing replacement.")
        return []
    return [{"op": "test", "path": "/metadata/resourceVersion", "value": resource_version},
            {"op": "add", "path": "/data/NTFY_TOKEN", "value": encoded}]


def private_capture(command):
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False)
    require(result.returncode == 0, "Protected Secret read failed; no response or credential output was displayed.")
    return result.stdout


def bootstrap(kc, owns_lock, keychain, bcrypt, context):
    # Read only namespace key-presence/RV, never encryption key/admin token values.
    readiness = kc("-n", release.NAMESPACE, "get", "secret", release.SECRET, "-o",
                   'go-template={{if index .data "CONTACT_ENCRYPTION_KEY"}}{{if index .data "CONTACT_ADMIN_TOKEN"}}{{.metadata.resourceVersion}}{{end}}{{end}}')[1].decode()
    require(readiness.strip(), "Provision the inbox key/admin Secret first using release.py --secret --keychain-bootstrap.")
    existing = kc("-n", release.NAMESPACE, "get", "secret", NTFY_SECRET, "--ignore-not-found", "-o", "json", capture=True)
    existing = json.loads(existing) if existing.strip() else None
    release.confirm(f"bootstrap ntfy Keychain and secrets {release.NAMESPACE} {context}")
    owns_lock()
    owner = keychain.read(OWNER_SERVICE, "owner")
    publisher = keychain.read(PUBLISHER_SERVICE, "contact")
    require(not existing or (owner is not None and publisher is not None),
            "Existing ntfy Secret lacks matching Keychain custody; refusing credential replacement.")
    for credential, is_owner in ((owner, True), (publisher, False)):
        if credential is not None:
            validate_credential(credential, bcrypt, owner=is_owner)
    if owner is None:
        owner = new_credential(bcrypt, owner=True)
        owns_lock()
        keychain.create(OWNER_SERVICE, "owner", owner)
    if publisher is None:
        publisher = new_credential(bcrypt, owner=False)
        owns_lock()
        keychain.create(PUBLISHER_SERVICE, "contact", publisher)
    protected_publisher = kc("-n", release.NAMESPACE, "get", "secret", release.SECRET, "-o",
                             'go-template={{printf "%s\\n" .metadata.resourceVersion}}{{with index .data "NTFY_TOKEN"}}{{.}}{{end}}',
                             capture=True).decode()
    publisher_state = protected_publisher.split("\n")
    require(len(publisher_state) == 2 and publisher_state[0] == readiness.strip(),
            "Inbox Secret changed during credential review; no further write authorized.")
    publisher_patch = inbox_patch(publisher_state[0], publisher["token"], publisher_state[1])
    fields = secret_fields(owner, publisher)
    if existing:
        require(existing.get("type") == "Opaque" and existing.get("data") ==
                {key: base64.b64encode(value.encode()).decode() for key, value in fields.items()},
                "Existing ntfy Secret does not match custody/least-privilege ACL; refusing rotation.")
    else:
        manifest = {"apiVersion": "v1", "kind": "Secret", "type": "Opaque",
                    "metadata": {"name": NTFY_SECRET, "namespace": release.NAMESPACE}, "stringData": fields}
        kc("create", "-f", "-", data=json.dumps(manifest).encode(), private=True)
    # Add only an absent token. An equal token is a no-op; divergent tokens refused above.
    if publisher_patch:
        kc("-n", release.NAMESPACE, "patch", "secret", release.SECRET, "--type=json", "--patch-file=/dev/stdin",
           data=json.dumps(publisher_patch).encode(), private=True)
    print("ntfy credentials provisioned without credential output; inbox encryption/admin keys unchanged.")
    print("Owner setup: Keychain Access GUI, org.stadtstack.ntfy.owner / owner; server https://ntfy.stadtstack.eu, topic contact.")
    print("No rollout, DNS/TLS mutation, subscription, publication or live ntfy test was performed.")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--bootstrap", action="store_true", required=True)
    for name in ("values", "digest", "context", "source", "run-id", "evidence"):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    require(sys.platform == "darwin", "Run only on the owner's approved macOS workstation.")
    require(re.fullmatch(r"sha256:[a-f0-9]{64}", args.digest) is not None and
            re.fullmatch(r"[a-f0-9]{40}", args.source) is not None and
            re.fullmatch(r"[1-9][0-9]*", args.run_id) is not None, "Invalid digest/source/workflow identity.")
    require(Path(args.values).is_file(), "Reviewed values file is absent.")
    for variable in ("CONTACT_ENCRYPTION_KEY", "CONTACT_ADMIN_TOKEN", "NTFY_TOKEN", "NTFY_PASSWORD",
                     "NTFY_PASSWORD_HASH", "NTFY_AUTH_USERS", "NTFY_AUTH_TOKENS"):
        require(variable not in os.environ, "Unset protected credential environment variables; generated custody only.")
    for variable in ("HELM_KUBEAPISERVER", "HELM_KUBECAFILE", "HELM_KUBETOKEN", "HELM_KUBEASUSER",
                     "HELM_KUBEASGROUPS", "HELM_KUBEINSECURE_SKIP_TLS_VERIFY", "HELM_KUBETLS_SERVER_NAME",
                     "HELM_KUBECONTEXT", "HELMFILE_KUBE_CONTEXT"):
        require(variable not in os.environ, "Refusing Helm connection overrides; unset them.")
    kubectl = os.environ.get("KUBECTL", "kubectl")
    for binary in (kubectl, "helm", "gh", "git"):
        require(shutil.which(binary), "Required binary missing: " + binary)
    try:
        import bcrypt
    except ImportError as error:
        raise release.Refusal("An owner-reviewed local Python bcrypt installation is required; none is installed automatically.") from error
    evidence = release.validate_evidence(args)
    require(evidence["notification"]["ntfyImageDigest"] == NTFY_DIGEST,
            "Bootstrap syntax is reviewed for the exact pinned official ntfy v2.29.0 image only.")
    require(release.text(["git", "rev-parse", "HEAD"], cwd=release.ROOT) == args.source,
            "Bootstrap must run from the approved workflow source commit.")
    require(not release.text(["git", "status", "--porcelain", "--untracked-files=no"], cwd=release.ROOT),
            "Tracked source/release files must be committed and clean.")
    require(not release.text(["git", "ls-files", "--others", "--exclude-standard", "--", "deploy/contact",
                              "contact-service", release.WORKFLOW], cwd=release.ROOT),
            "Untracked release/backend/workflow files are not an approved snapshot.")
    lock = release.PrivilegedLock(release.LOCK)
    lock.acquire()
    owns_lock = lock.check

    def kc(*arguments, capture=False, **kwargs):
        owns_lock()
        command = [kubectl, "--context", args.context, *arguments]
        return private_capture(command) if capture else release.run(command, **kwargs)

    try:
        rendered = release.run(["helm", "template", release.NAMESPACE, str(release.CHART), "--namespace", release.NAMESPACE,
                                "--values", str(Path(args.values).resolve()), "--set-string", "image.repository=" + release.IMAGE,
                                "--set-string", "image.digest=" + args.digest, "--set-string", "secretName=" + release.SECRET])[1]
        require(('image: "docker.io/binwiederhier/ntfy@' + NTFY_DIGEST + '"').encode() in rendered and
                b'auth-default-access: "deny-all"' in rendered, "Rendered ntfy image/deny-all configuration is not approved.")
        release.github(args)
        release.public_image(args)
        require(release.text([kubectl, "config", "current-context"]) == args.context,
                "Select the approved existing context yourself; no sessions are opened or switched.")
        config = json.loads(kc("config", "view", "--minify", "-o", "json")[1])
        require(all(not entry.get("user", {}).get("exec") and not entry.get("user", {}).get("auth-provider")
                    for entry in config.get("users", [])), "Automatic credential-plugin sessions are forbidden.")
        require(config["clusters"][0]["cluster"]["server"] == evidence["cluster"]["server"],
                "Cluster API does not match approved evidence.")
        require(kc("get", "namespace", "kube-system", "-o", "jsonpath={.metadata.uid}")[1].decode() == release.CLUSTER_UID,
                "Wrong cluster identity.")
        namespace = json.loads(kc("get", "namespace", release.NAMESPACE, "-o", "json")[1])
        labels = namespace.get("metadata", {}).get("labels", {})
        require(all(labels.get("pod-security.kubernetes.io/" + gate) == "restricted" and
                    labels.get("pod-security.kubernetes.io/" + gate + "-version") == "v1.36"
                    for gate in ("enforce", "audit", "warn")), "Namespace restricted Pod Security labels/version are required.")
        bootstrap(kc, owns_lock, Keychain(), bcrypt, args.context)
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
        print("Bootstrap interrupted; custody is retained for an explicitly approved resume.", file=sys.stderr)
        sys.exit(130)
    except release.Refusal as error:
        print("Credential bootstrap refused: " + str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        # JSON/library/subprocess exceptions can contain credential fragments. No traceback.
        print("Credential bootstrap failed; no credential detail was displayed. Review prerequisites privately.", file=sys.stderr)
        sys.exit(1)
