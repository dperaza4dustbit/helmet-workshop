{{- $prod := required "Order Producer product" .Installer.Products.Order_Producer -}}
{{- $ns := default .Installer.Namespace $prod.Namespace -}}
{{- $ingress := default "" .OpenShift.Ingress.Domain -}}
{{- $queueName := default "orders" (index $prod.Properties "queueName") -}}
{{- $image := default "docker.io/library/node:20-alpine" (index $prod.Properties "image") -}}
orderProducer:
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
    hostname: rewards-managers-{{ $ns }}.{{ $ingress }}
    {{- else }}
    hostname: ""
    {{- end }}
