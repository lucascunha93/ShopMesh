# ShopMesh no Kubernetes

Manifests Kustomize para um cluster local (Minikube ou Kind).

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

## Passo a passo (Minikube)

```powershell
minikube start --memory 6144 --cpus 4
minikube addons enable ingress

# 1. Imagens: gera e carrega shopmesh/<serviço>:latest no cluster
.\scripts\build-images.ps1 -Load minikube        # ou -Load kind

# 2. Segredos (arquivo ignorado pelo Git)
Copy-Item k8s/base/secrets.env.example k8s/base/secrets.env   # troque os valores

# 3. Aplicação (escolha uma)
kubectl apply -k k8s/base
kubectl apply -k k8s/overlays/observability

kubectl -n shopmesh get pods -w
```

Adicione ao arquivo `hosts` o IP do Ingress (`minikube ip`, ou `127.0.0.1` com `minikube tunnel`):

```
<ip> shopmesh.local admin.shopmesh.local api.shopmesh.local
```

Depois acesse http://shopmesh.local (loja) e http://admin.shopmesh.local (painel).

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
- **Notifications** roda com uma réplica, porque o feed fica em memória.
- O dashboard do Grafana em `observability/grafana/` é cópia de
  `infra/observability/grafana/dashboards/`: o Kustomize não lê arquivos fora da própria
  pasta. Mantenha as duas cópias iguais.

## Remover

```powershell
kubectl delete -k k8s/overlays/observability   # ou k8s/base
kubectl delete pvc -n shopmesh --all           # apaga os dados persistidos
```
