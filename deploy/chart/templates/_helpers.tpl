{{- define "stadtstack.image" -}}
{{- if not (regexMatch "^sha256:[a-f0-9]{64}$" .Values.image.digest) -}}
{{- fail "image.digest must be sha256: followed by 64 lowercase hex characters; set the reviewed image digest in deploy/values/stadtstack.eu.yaml" -}}
{{- end -}}
{{- printf "%s@%s" .Values.image.repository .Values.image.digest -}}
{{- end -}}

{{- define "stadtstack.labels" -}}
app.kubernetes.io/name: stadtstack-site
app.kubernetes.io/instance: {{ .Release.Name | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service | quote }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | quote }}
{{- end -}}

{{- define "stadtstack.selector" -}}
app.kubernetes.io/name: stadtstack-site
app.kubernetes.io/instance: {{ .Release.Name | quote }}
{{- end -}}
