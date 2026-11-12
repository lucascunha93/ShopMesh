<#
.SYNOPSIS
    Gera as imagens Docker do ShopMesh e, opcionalmente, carrega no cluster local.

.EXAMPLE
    .\scripts\build-images.ps1                    # apenas docker build
    .\scripts\build-images.ps1 -Load minikube     # build + minikube image load
    .\scripts\build-images.ps1 -Load kind         # build + kind load docker-image
#>
param(
    [ValidateSet('none', 'minikube', 'kind')]
    [string]$Load = 'none',
    [string]$Tag = 'latest',
    [string]$KindCluster = 'kind'
)

# Os comandos nativos escrevem progresso em stderr; o sucesso é verificado por $LASTEXITCODE.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot

# Nome da imagem -> pasta com o Dockerfile.
$images = [ordered]@{
    'auth-service'          = 'services/auth-service'
    'catalog-service'       = 'services/catalog-service'
    'orders-service'        = 'services/orders-service'
    'payments-service'      = 'services/payments-service'
    'notifications-service' = 'services/notifications-service'
    'api-gateway'           = 'gateway'
    'storefront'            = 'apps/storefront'
    'admin'                 = 'apps/admin'
}

foreach ($entry in $images.GetEnumerator()) {
    $image = "shopmesh/$($entry.Key):$Tag"
    $context = Join-Path $root $entry.Value
    Write-Host "==> docker build $image"
    docker build -t $image $context
    if ($LASTEXITCODE -ne 0) { throw "Falha ao gerar $image" }

    switch ($Load) {
        'minikube' {
            Write-Host "    minikube image load $image"
            minikube image load $image
        }
        'kind' {
            Write-Host "    kind load docker-image $image"
            kind load docker-image $image --name $KindCluster
        }
    }
    if ($LASTEXITCODE -ne 0) { throw "Falha ao carregar $image no cluster" }
}

Write-Host "Imagens prontas com a tag '$Tag'."
