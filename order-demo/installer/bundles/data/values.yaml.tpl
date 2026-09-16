{{- $data := required "Order Data product" .Installer.Products.Order_Data -}}
{{- $ns := default .Installer.Namespace $data.Namespace -}}
{{- $queueName := default "orders" (index $data.Properties "queueName") -}}
{{- $dbName := default "orders" (index $data.Properties "databaseName") -}}
pgsqlService:
  instances:
    - name: orders
      enabled: true
      namespace: {{ $ns | quote }}
      dbname: {{ $dbName | quote }}
rabbitmq:
  enabled: true
  namespace: {{ $ns | quote }}
  queueName: {{ $queueName | quote }}
