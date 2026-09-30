# Stadtstack site: bounded release for owner review

Released on 30 September 2026 through the owner's wrapper `infra/hetzner-talos/scripts/apply-live-stadtstack-site.sh` (in `strausberg-zk-residency`): namespace, then Helm revision 1 with image `sha256:3904a89a…`; both certificates became Ready and the public checks passed (apex 200, www and roebel 301, fonts and the 3D model load). DNS for `stadtstack.eu`, `www` and `roebel` points at the cluster ingress `77.42.11.9`. The public origin is `https://stadtstack.eu`; `www.stadtstack.eu` reaches the same site, and the separate `roebel.stadtstack.eu` Ingress reaches the image's nginx redirect. nginx configuration is baked into the Docker image from `deploy/nginx.conf`, not mounted from a ConfigMap.

## Digest gate and safe release

`image.digest` in `values/stadtstack.eu.yaml` must be a reviewed public `ghcr.io/giraeffleaeffle/stadtstack-site` digest (exactly 64 lowercase hex characters after `sha256:`); an empty digest blocks rendering and every script mode. Build a new image by pushing an `image-*` tag, pin the printed digest here and commit before releasing. No tags, pull secrets or private configuration are needed.

The owner's external parent wrapper must export the **committed** `deploy/` snapshot, supply `KUBECTL` and `KUBECONFIG` for its bounded session, and run this script inside that snapshot. Do not substitute an uncommitted working tree. The wrapper is maintained outside this site repository; its session safeguards remain the owner's responsibility.

The script's exact interface is:

```text
deploy/apply.sh [--diff-only | --namespace]
```

No argument means release. There is no `--release`, secret mode or network-test mode. First render locally, review the digest and host configuration, then use the owner wrapper for `--namespace` if needed, `--diff-only` to review, and no argument to release. Every mode renders offline first and checks kube-system UID `7bc769bc-e860-4d54-a0d5-d426f3a52420`. The selected context is bound to all cluster calls. Helm connection overrides are refused even when exported empty; conflicting context overrides are refused. `KUBECONFIG` is inherited unchanged from the parent.

`--diff-only` makes no writes. Namespace previews accept kubectl diff exits 0/1; release previews accept Helm detailed diff exits 0/2. Other errors stop before writes. Namespace creation asks for exactly `apply namespace stadtstack-site`; release asks for exactly `apply stadtstack-site`, through the controlling terminal. Namespace labels are managed outside Helm and survive uninstall. The release applies the namespace, then uses atomic Helm defaults (cleanupOnFail, historyMax 10, timeout 600, wait and waitForJobs; createNamespace false), waits for rollout and checks both certificates. Rollout alone does not prove public availability.

Prerequisites: Bash, kubectl (or `KUBECTL`), Helm, helmfile and the Helm diff plugin. The parent session must be authorized by the owner. DNS, public package access and certificate issuance must be checked by the owner; none is asserted here.

## Workload and network boundaries

Two replicas serve port 8080, with `/healthz` readiness/liveness probes. Each runs as uid/gid 101 with RuntimeDefault seccomp, read-only root filesystem, all capabilities dropped, no privilege escalation and no service-account token. Only `/tmp` is writable: memory emptyDir capped at 32 MiB. Resources request 50m CPU/32 MiB and limit 500m/128 MiB; these are starting values, not load-tested sizing.

HAProxy Ingresses request `letsencrypt-prod` certificates `stadtstack-site-tls` (apex and www) and `stadtstack-roebel-redirect-tls` (Roebel), with HTTPS redirect enabled. All three names reach the same Service; the baked nginx host handling performs the Roebel redirect.

NetworkPolicy denies all ingress and egress by default. Only the explicitly enumerated reference `ingress.haproxySources` CIDRs may reach site TCP 8080 or HTTP-01 solver TCP 8089. There is no blanket namespace allowance and no allowed egress, including DNS. The browser's bundled assets do not require pod egress. NetworkPolicy enforcement and the actual HAProxy source addresses must be verified by the owner; offline rendering cannot prove them.

`npm run build` hashes each exact inline Next hydration script in the static export and generates `.next/export-nginx.conf` from `deploy/nginx.conf`. The Docker image copies that generated config. Scripts are limited to same-origin files and those hashes (no script `unsafe-inline`/`unsafe-eval`); inline styles remain permitted for the interactive model's dynamic positioning. Do not run the template config directly: its script-hash placeholder is intentionally filled only after an export. The runtime routes `/healthz` on any Host, redirects www to the apex and Röbel to its staging pilot, returns 404 for other hosts, and caches `/_next/static/` for one year.

## Review and rollback

For an offline chart smoke, pass a dummy digest to `helm template stadtstack-site deploy/chart --namespace stadtstack-site --set image.digest=sha256:<64 lowercase hex characters>`. Never release that dummy image. Rendering with the committed empty digest must fail clearly.

After an authorized release, check rollout, both certificate Ready conditions, public HTTPS, bundled font/model loading and the Roebel redirect. A successful script does not replace browser verification. Use Helm history and an explicitly reviewed `helm rollback stadtstack-site <revision> -n stadtstack-site` through the owner's bounded context for rollback; restore the corresponding digest in committed values before a subsequent release. Helm uninstall removes release resources, not the external namespace; DNS changes and namespace deletion are separate owner decisions.
