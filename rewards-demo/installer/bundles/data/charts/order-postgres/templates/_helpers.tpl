{{/*
Expand the name of the chart.
*/}}
{{- define "order-postgres.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}
