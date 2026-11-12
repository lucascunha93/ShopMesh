# ShopMesh no Kubernetes

Manifests Kustomize para um cluster local. Foram validados em um cluster **kind**
(Kubernetes 1.34) com Ingress NGINX; Minikube e o Kubernetes do Docker Desktop também servem.

```
k8s/
├── base/                       # aplicação completa + Postgres, Mongo e Kafka
│   ├── infra/                  # StatefulSets com volumes persistentes
│   ├── apps/                   # Deployments e Services dos serviços e frontends
│   ├── ingress.yaml            # shopmesh.local, admin.shopmesh.local, api.shopmesh.local
│   └── secrets.env.example     # modelo dos segredos (copie para secrets.env)
├── observability/              # Prometheus (descoberta por anotações), Grafana e Jaeger
└── overlays/observability/     # base + observabilidade, com tracing ligado
```

## Passo a passo

### Opção 1 — kind (validada)

Requer Docker e o [kind](https://kind.sigs.k8s.io/) (`winget install Kubernetes.kind`).

```powershell
kind create cluster --config k8s/kind-config.yaml     # cluster "shopmesh" com portas 80/443 expostas
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.13.0/deploy/static/provider/kind/deploy.yaml

# Imagens: gera e carrega shopmesh/<serviço>:latest no cluster
.\scripts\build-images.ps1 -Load kind -KindCluster shopmesh

# Segredos (arquivo ignorado pelo Git)
Copy-Item k8s/base/secrets.env.example k8s/base/secrets.env   # troque os valores

kubectl apply -k k8s/base                              # ou k8s/overlays/observability
kubectl -n shopmesh get pods -w
```

A primeira subida leva alguns minutos (download das imagens de Kafka, Mongo e Postgres) e
alguns serviços reiniciam enquanto o Kafka e os bancos ficam prontos; é esperado.

Para remover o cluster: `kind delete cluster --name shopmesh`.

### Opção 2 — Minikube

```powershell
minikube start --memory 6144 --cpus 4
minikube addons enable ingress
.\scripts\build-images.ps1 -Load minikube
Copy-Item k8s/base/secrets.env.example k8s/base/secrets.env
kubectl apply -k k8s/base
```

### Opção 3 — Kubernetes do Docker Desktop

Habilite em *Settings → Kubernetes*, instale o Ingress NGINX (`provider/cloud/deploy.yaml`) e use
`.\scripts\build-images.ps1` (as imagens locais já ficam visíveis ao cluster).

### Acesso

Adicione ao arquivo `hosts` (`C:\Windows\System32\drivers\etc\hosts`) o IP do Ingress
(`127.0.0.1` no kind e no Docker Desktop; `minikube ip` ou `minikube tunnel` no Minikube):

```
127.0.0.1 shopmesh.local admin.shopmesh.local api.shopmesh.local
```

Depois acesse http://shopmesh.local (loja) e http://admin.shopmesh.local (painel).
Sem mexer no `hosts` dá para testar com `curl -H "Host: shopmesh.local" http://localhost/`.

Para rodar o smoke test contra o cluster, exponha o gateway e use o script normalmente:

```powershell
kubectl -n shopmesh port-forward svc/gateway 3000:3000
.\scripts\smoke-test.ps1
```

Grafana, Prometheus e Jaeger não ficam expostos no Ingress. Use port-forward:

```powershell
kubectl -n shopmesh port-forward svc/grafana 3100:3000
kubectl -n shopmesh port-forward svc/jaeger 16686:16686
kubectl -n shopmesh port-forward svc/prometheus 9090:9090
```

## Decisões

- **Configuração**: `shopmesh-config` (ConfigMap) e `shopmesh-secrets` (Secret) são gerados pelo
  Kustomize com sufixo de hash, então mudar um valor reinicia os pods que o usam.
- **`enableServiceLinks: false`** em todos os pods: sem isso o Kubernetes injeta variáveis como
  `KAFKA_PORT=tcp://...`, que a imagem do Kafka interpretaria como configuração do broker.
- **Migrações**: o Auth Service roda `prisma migrate deploy` em um `initContainer`.
- **Probes**: serviços Java usam `startupProbe` (a JVM demora a subir) e os grupos
  `/actuator/health/liveness|readiness`; os demais usam `/health`.
- **Métricas**: os pods anotados com `prometheus.io/scrape: "true"` são descobertos
  automaticamente; o Prometheus tem só permissão de leitura de pods no namespace.
- **Kafka** roda com `KAFKA_AUTO_CREATE_TOPICS_ENABLE=false`: os tópicos são criados pelos
  próprios serviços (3 partições). Com auto-create, um consumidor que assinasse antes do
  produtor criaria o tópico com 1 partição.
- **Notifications** guarda o feed no MongoDB (`MONGO_URI`, banco `shopmesh_notifications`).
- O dashboard do Grafana em `observability/grafana/` é cópia de
  `infra/observability/grafana/dashboards/`: o Kustomize não lê arquivos fora da própria
  pasta. Mantenha as duas cópias iguais.

## Remover

```powershell
kubectl delete -k k8s/overlays/observability   # ou k8s/base
kubectl delete pvc -n shopmesh --all           # apaga os dados persistidos
```
