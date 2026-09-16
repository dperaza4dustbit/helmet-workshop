{{- $cons := required "Order Consumer product" .Installer.Products.Order_Consumer -}}
{{- $ns := default .Installer.Namespace $cons.Namespace -}}
{{- $ingress := default "" .OpenShift.Ingress.Domain -}}
{{- $queueName := default "orders" (index $cons.Properties "queueName") -}}
{{- $image := default "docker.io/library/node:20-alpine" (index $cons.Properties "image") -}}
orderConsumer:
  enabled: true
  namespace: {{ $ns | quote }}
  image: {{ $image | quote }}
  queueName: {{ $queueName | quote }}
  database:
    secretName: orders-pgsql-user
  rabbitmq:
    secretName: orders-rabbitmq-user
  route:
    {{- if $ingress }}
    hostname: rewards-store-{{ $ns }}.{{ $ingress }}
    {{- else }}
    hostname: ""
    {{- end }}
  managerPortal:
    {{- if $ingress }}
    hostname: rewards-managers-{{ $ns }}.{{ $ingress }}
    {{- else }}
    hostname: ""
    {{- end }}
