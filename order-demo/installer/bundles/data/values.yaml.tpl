{{- $data := required "Order Data product" .Installer.Products.Order_Data -}}
{{- $ns := default .Installer.Namespace $data.Namespace -}}
# TODO (workshop): render values for order-postgres and order-rabbitmq.
# Hint: use $ns and $data.Properties for connection strings consumed by producer/consumer bundles.

order-postgres:
  enabled: true
  namespace: {{ $ns }}

order-rabbitmq:
  enabled: true
  namespace: {{ $ns }}
