#!/usr/bin/env bash
# Run only through the owner's bounded parent wrapper, from its committed deploy snapshot.
set -euo pipefail
for override in HELM_KUBEAPISERVER HELM_KUBECAFILE HELM_KUBETOKEN \
  HELM_KUBEASUSER HELM_KUBEASGROUPS HELM_KUBEINSECURE_SKIP_TLS_VERIFY HELM_KUBETLS_SERVER_NAME; do
  if [[ "${!override+x}" == x ]]; then
    printf 'Refusing connection override %s; unset it before running.\n' "$override" >&2
    exit 1
  fi
done
usage() { printf 'Usage: deploy/apply.sh [--diff-only | --namespace]\n' >&2; }
mode=release
case "$#:${1:-}" in
  0:) ;;
  1:--diff-only) mode=diff ;;
  1:--namespace) mode=namespace ;;
  *) usage; exit 2 ;;
esac
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"
KUBECTL="${KUBECTL:-kubectl}"
NAMESPACE=stadtstack-site
for binary in helmfile helm "$KUBECTL"; do
  command -v "$binary" >/dev/null || { printf 'Required binary missing: %s\n' "$binary" >&2; exit 1; }
done
if ! [[ "$(helm plugin list)" =~ (^|$'\n')diff[[:space:]] ]]; then
  printf 'The Helm diff plugin is required.\n' >&2
  exit 1
fi
# Offline digest gate precedes every cluster access, including namespace creation.
helmfile -f helmfile.yaml template >/dev/null
context="$("$KUBECTL" config current-context)"
[[ -n "$context" ]] || { printf 'No current kube context.\n' >&2; exit 1; }
for override in HELM_KUBECONTEXT HELMFILE_KUBE_CONTEXT; do
  if [[ -n "${!override:-}" && "${!override}" != "$context" ]]; then
    printf '%s disagrees with kubectl context %s; unset it or switch contexts.\n' "$override" "$context" >&2
    exit 1
  fi
done
kc() { "$KUBECTL" --context "$context" "$@"; }
hf() { helmfile --kube-context "$context" -f helmfile.yaml "$@"; }
server="$(kc config view --minify -o jsonpath='{.clusters[0].cluster.server}')"
expected_uid=7bc769bc-e860-4d54-a0d5-d426f3a52420
actual_uid="$(kc get namespace kube-system -o jsonpath='{.metadata.uid}')"
[[ "$actual_uid" == "$expected_uid" ]] || {
  printf 'Wrong cluster: kube-system UID does not match the reviewed Talos cluster (context %s).\n' "$context" >&2
  exit 1
}
printf 'Cluster: context %s, API %s, kube-system UID verified.\n' "$context" "$server"
confirm() {
  printf 'Target: context %s, API %s, namespace %s.\n' "$context" "$server" "$NAMESPACE" >/dev/tty
  printf 'Type exactly "%s" to continue: ' "$1" >/dev/tty
  local answer
  IFS= read -r answer </dev/tty
  [[ "$answer" == "$1" ]] || { printf 'Confirmation did not match; nothing changed.\n' >&2; exit 1; }
}
preview_namespace() {
  local status=0
  kc diff --server-side --field-manager=stadtstack-site-apply -f namespace.yaml || status=$?
  (( status <= 1 )) || { printf 'Namespace preview failed (exit %s); nothing changed.\n' "$status" >&2; exit 1; }
}
preview_namespace
if [[ "$mode" == namespace ]]; then
  confirm "apply namespace $NAMESPACE"
  kc apply --server-side --field-manager=stadtstack-site-apply -f namespace.yaml
  exit 0
fi
# helm-diff detailed exit codes: 0 is unchanged, 2 is a successful change preview.
status=0
hf diff --detailed-exitcode || status=$?
[[ "$status" == 0 || "$status" == 2 ]] || { printf 'Release preview failed (exit %s); nothing changed.\n' "$status" >&2; exit 1; }
[[ "$mode" != diff ]] || exit 0
confirm "apply $NAMESPACE"
kc apply --server-side --field-manager=stadtstack-site-apply -f namespace.yaml
hf apply
kc -n "$NAMESPACE" rollout status deployment/stadtstack-site --timeout=180s
# Certificate readiness is reported separately: rollout does not prove public HTTPS.
for certificate in stadtstack-site-tls stadtstack-roebel-redirect-tls; do
  if ! kc -n "$NAMESPACE" wait --for=condition=Ready "certificate/$certificate" --timeout=180s; then
    printf 'Certificate %s is not Ready; inspect issuance before declaring the site live.\n' "$certificate" >&2
    exit 1
  fi
done
