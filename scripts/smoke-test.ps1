param(
    [string]$GatewayUrl = 'http://localhost:3000',
    # Administrador inicial criado pelo Auth Service a partir de ADMIN_EMAIL/ADMIN_PASSWORD.
    [string]$AdminEmail = $(if ($env:SHOPMESH_ADMIN_EMAIL) { $env:SHOPMESH_ADMIN_EMAIL } else { 'admin@shopmesh.local' }),
    [string]$AdminPassword = $(if ($env:SHOPMESH_ADMIN_PASSWORD) { $env:SHOPMESH_ADMIN_PASSWORD } else { 'change-me-admin-password' })
)

$ErrorActionPreference = 'Stop'

$script:passed = 0
$script:failed = 0

function Write-Check {
    param(
        [string]$Name,
        [bool]$Success,
        [string]$Expected,
        [string]$Actual
    )

    if ($Success) {
        $script:passed++
        Write-Host "PASS: $Name"
    }
    else {
        $script:failed++
        Write-Host "FAIL: $Name - esperado: $Expected; obtido: $Actual"
    }
}

function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Url,
        [object]$Body,
        [string]$Token
    )

    $headers = @{}
    if (-not [string]::IsNullOrWhiteSpace($Token)) {
        $headers.Authorization = "Bearer $Token"
    }

    $requestParameters = @{
        Method      = $Method
        Uri         = $Url
        Headers     = $headers
        TimeoutSec  = 15
        ErrorAction = 'Stop'
    }

    if ($null -ne $Body) {
        $requestParameters.ContentType = 'application/json'
        $requestParameters.Body = ConvertTo-Json -InputObject $Body -Depth 10
    }

    try {
        $data = Invoke-RestMethod @requestParameters
        return [PSCustomObject]@{
            Success    = $true
            StatusCode = '2xx'
            Data       = $data
        }
    }
    catch {
        $statusCode = 0
        $response = $_.Exception.Response
        if ($null -ne $response) {
            try {
                $statusCode = [int]$response.StatusCode
            }
            catch {
                $statusCode = 0
            }
        }

        return [PSCustomObject]@{
            Success    = $false
            StatusCode = $statusCode
            Data       = $null
        }
    }
}

function Get-JsonProperty {
    param(
        [object]$InputObject,
        [string]$Name
    )

    if ($null -eq $InputObject) {
        return $null
    }

    $property = $InputObject.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }

    return $property.Value
}

function Wait-ForOrderStatus {
    param(
        [string]$OrderId,
        [string]$ExpectedStatus,
        [string]$Scenario
    )

    $orderUrl = "$($GatewayUrl.TrimEnd('/'))/api/orders/orders/$OrderId"
    $deadline = (Get-Date).AddSeconds(20)
    $obtainedStatus = 'PENDING (aguardando evento)'
    $lastOrder = $null

    do {
        $response = Invoke-ApiRequest -Method 'Get' -Url $orderUrl -Token $script:token
        if ($response.Success) {
            $lastOrder = $response.Data
            $status = Get-JsonProperty -InputObject $lastOrder -Name 'status'
            if (-not [string]::IsNullOrWhiteSpace([string]$status)) {
                $obtainedStatus = [string]$status
            }

            if ($obtainedStatus -ne 'PENDING') {
                break
            }
        }
        else {
            $obtainedStatus = "HTTP $($response.StatusCode)"
        }

        if ((Get-Date) -lt $deadline) {
            Start-Sleep -Seconds 1
        }
    } while ((Get-Date) -lt $deadline)

    Write-Check -Name "${Scenario}: status do pedido" `
        -Success ($obtainedStatus -eq $ExpectedStatus) `
        -Expected $ExpectedStatus `
        -Actual $obtainedStatus

    return $lastOrder
}

function Get-OrderId {
    param([object]$OrderResponse)

    $id = Get-JsonProperty -InputObject $OrderResponse -Name 'id'
    if ([string]::IsNullOrWhiteSpace([string]$id)) {
        $id = Get-JsonProperty -InputObject $OrderResponse -Name 'orderId'
    }
    return [string]$id
}

$baseUrl = $GatewayUrl.TrimEnd('/')

Write-Host 'Etapa 0: verificando saude via Gateway...'
$healthChecks = @(
    [PSCustomObject]@{ Name = 'Gateway'; Path = '/health'; ExpectedService = 'api-gateway' },
    [PSCustomObject]@{ Name = 'Auth Service'; Path = '/api/auth/health'; ExpectedService = 'auth-service' },
    [PSCustomObject]@{ Name = 'Catalog Service'; Path = '/api/catalog/health'; ExpectedService = 'catalog-service' },
    [PSCustomObject]@{ Name = 'Orders Service'; Path = '/api/orders/health'; ExpectedService = 'orders-service' },
    [PSCustomObject]@{ Name = 'Payments Service'; Path = '/api/payments/health'; ExpectedService = 'payments-service' },
    [PSCustomObject]@{ Name = 'Notifications Service'; Path = '/api/notifications/health'; ExpectedService = 'notifications-service' }
)

foreach ($healthCheck in $healthChecks) {
    $response = Invoke-ApiRequest -Method 'Get' -Url "$baseUrl$($healthCheck.Path)"
    $service = Get-JsonProperty -InputObject $response.Data -Name 'service'
    $status = Get-JsonProperty -InputObject $response.Data -Name 'status'
    $healthy = $response.Success -and $status -eq 'ok' -and $service -eq $healthCheck.ExpectedService

    Write-Check -Name "saude: $($healthCheck.Name)" `
        -Success $healthy `
        -Expected "HTTP 200, status=ok, service=$($healthCheck.ExpectedService)" `
        -Actual "HTTP $($response.StatusCode), status=$status, service=$service"

    if (-not $healthy) {
        Write-Host "Smoke test encerrado: $($healthCheck.Name) esta fora ou nao saudavel; nenhuma outra etapa foi executada."
        Write-Host "Resumo: $script:passed PASS, $script:failed FAIL."
        exit 1
    }
}

Write-Host 'Etapa 1: registrando usuario descartavel...'
$uniqueSuffix = '{0}-{1}' -f (Get-Date -Format 'yyyyMMddHHmmssfff'), ([guid]::NewGuid().ToString('N').Substring(0, 8))
$email = "smoke-$uniqueSuffix@example.com"
$password = "Smoke!$([guid]::NewGuid().ToString('N'))"
$registration = @{
    name     = 'ShopMesh Smoke Test'
    email    = $email
    password = $password
}
$registrationResponse = Invoke-ApiRequest `
    -Method 'Post' `
    -Url "$baseUrl/api/auth/register" `
    -Body $registration
$script:token = Get-JsonProperty -InputObject $registrationResponse.Data -Name 'token'
$registrationStatus = if ($registrationResponse.Success) { 'HTTP 200/201' } else { "HTTP $($registrationResponse.StatusCode)" }
$registrationValid = $registrationResponse.Success -and -not [string]::IsNullOrWhiteSpace([string]$script:token)
Write-Check -Name 'registro de usuario via Gateway' `
    -Success $registrationValid `
    -Expected 'HTTP 201 com token' `
    -Actual $registrationStatus

if (-not $registrationValid) {
    Write-Host 'Resumo: nenhuma verificacao funcional executada apos falha no registro.'
    Write-Host "Resumo: $script:passed PASS, $script:failed FAIL."
    exit 1
}

Write-Host 'Etapa 2: autenticando administrador...'
$adminLoginResponse = Invoke-ApiRequest `
    -Method 'Post' `
    -Url "$baseUrl/api/auth/login" `
    -Body @{ email = $AdminEmail; password = $AdminPassword }
$adminUser = Get-JsonProperty -InputObject $adminLoginResponse.Data -Name 'user'
$adminRole = Get-JsonProperty -InputObject $adminUser -Name 'role'
$script:adminToken = Get-JsonProperty -InputObject $adminLoginResponse.Data -Name 'token'
$adminValid = $adminLoginResponse.Success -and $adminRole -eq 'ADMIN'
Write-Check -Name 'login do administrador via Gateway' `
    -Success $adminValid `
    -Expected "HTTP 200 com role=ADMIN para $AdminEmail" `
    -Actual "HTTP $($adminLoginResponse.StatusCode), role=$adminRole"

if (-not $adminValid) {
    Write-Host 'Configure ADMIN_EMAIL/ADMIN_PASSWORD no Auth Service e informe -AdminEmail/-AdminPassword.'
    Write-Host "Resumo: $script:passed PASS, $script:failed FAIL."
    exit 1
}

$customerProductResponse = Invoke-ApiRequest `
    -Method 'Post' `
    -Url "$baseUrl/api/catalog/products" `
    -Body @{ name = 'Produto nao autorizado'; price = 1 } `
    -Token $script:token
Write-Check -Name 'cliente nao pode criar produto' `
    -Success ($customerProductResponse.StatusCode -eq 403) `
    -Expected 'HTTP 403' `
    -Actual "HTTP $($customerProductResponse.StatusCode)"

Write-Host 'Etapa 3: criando produto via Gateway...'
$productName = "ShopMesh smoke $uniqueSuffix"
$productRequest = @{
    name        = $productName
    description = 'Produto criado pelo smoke test automatizado.'
    category    = 'smoke-test'
    price       = 349.90
    stock       = 100
}
$productResponse = Invoke-ApiRequest `
    -Method 'Post' `
    -Url "$baseUrl/api/catalog/products" `
    -Body $productRequest `
    -Token $script:adminToken
$product =Get-JsonProperty -InputObject $productResponse.Data -Name 'product'
if ($null -ne $product) {
    $productId = Get-JsonProperty -InputObject $product -Name '_id'
    if ([string]::IsNullOrWhiteSpace([string]$productId)) {
        $productId = Get-JsonProperty -InputObject $product -Name 'id'
    }
}
$productId = [string]$productId
$productPrice = Get-JsonProperty -InputObject $product -Name 'price'
$productStock = Get-JsonProperty -InputObject $product -Name 'stock'
$productValid = $productResponse.Success `
    -and -not [string]::IsNullOrWhiteSpace([string]$productId) `
    -and [decimal]$productPrice -eq [decimal]349.90 `
    -and [int]$productStock -eq 100
Write-Check -Name 'criacao do produto via Gateway' `
    -Success $productValid `
    -Expected 'produto criado com preco 349.90 e estoque 100' `
    -Actual "HTTP $($productResponse.StatusCode), id=$productId, preco=$productPrice, estoque=$productStock"

if (-not $productValid) {
    Write-Host 'Resumo: cenarios de pedido nao executados apos falha na criacao do produto.'
    Write-Host "Resumo: $script:passed PASS, $script:failed FAIL."
    exit 1
}

$scenarios = @(
    [PSCustomObject]@{
        Name = 'Cenario A (aprovado)'
        Quantity = 2
        ExpectedAmount = [decimal]699.80
        ExpectedOrderStatus = 'CONFIRMED'
        ExpectedPaymentStatus = 'APPROVED'
        ExpectedReasonPattern = $null
    },
    [PSCustomObject]@{
        Name = 'Cenario B (rejeitado)'
        Quantity = 20
        ExpectedAmount = [decimal]6998.00
        ExpectedOrderStatus = 'CANCELLED'
        ExpectedPaymentStatus = 'REJECTED'
        ExpectedReasonPattern = 'Limite de aprova'
    },
    [PSCustomObject]@{
        # Estoque disponivel apos o Cenario A: 100 - 2 = 98 unidades.
        Name = 'Cenario C (estoque insuficiente)'
        Quantity = 500
        ExpectedAmount = [decimal]174950.00
        ExpectedOrderStatus = 'CANCELLED'
        ExpectedPaymentStatus = 'NONE'
        ExpectedReasonPattern = 'Estoque insuficiente'
    }
)

foreach ($scenario in $scenarios) {
    Write-Host "$($scenario.Name): criando pedido via Gateway..."
    $orderRequest = @{
        items = @(
            @{
                productId = [string]$productId
                quantity  = $scenario.Quantity
            }
        )
    }
    $orderResponse = Invoke-ApiRequest `
        -Method 'Post' `
        -Url "$baseUrl/api/orders/orders" `
        -Body $orderRequest `
        -Token $script:token
    $orderId = Get-OrderId -OrderResponse $orderResponse.Data
    $createdAmount = Get-JsonProperty -InputObject $orderResponse.Data -Name 'totalAmount'
    $orderCreated = $orderResponse.Success -and -not [string]::IsNullOrWhiteSpace($orderId)
    $amountMatches = $orderCreated -and [decimal]$createdAmount -eq $scenario.ExpectedAmount

    Write-Check -Name "$($scenario.Name): criacao do pedido" `
        -Success $orderCreated `
        -Expected 'HTTP 201 com ID do pedido' `
        -Actual "HTTP $($orderResponse.StatusCode), id=$orderId"
    Write-Check -Name "$($scenario.Name): total do pedido" `
        -Success $amountMatches `
        -Expected ([string]$scenario.ExpectedAmount) `
        -Actual ([string]$createdAmount)

    if (-not $orderCreated) {
        continue
    }

    $order = Wait-ForOrderStatus `
        -OrderId $orderId `
        -ExpectedStatus $scenario.ExpectedOrderStatus `
        -Scenario $scenario.Name

    if ($scenario.ExpectedOrderStatus -eq 'CANCELLED') {
        $statusReason = Get-JsonProperty -InputObject $order -Name 'statusReason'
        $hasStatusReason = -not [string]::IsNullOrWhiteSpace([string]$statusReason)
        if ($hasStatusReason -and $null -ne $scenario.ExpectedReasonPattern) {
            $hasStatusReason = ([string]$statusReason) -match $scenario.ExpectedReasonPattern
        }
        Write-Check -Name "$($scenario.Name): motivo no pedido" `
            -Success $hasStatusReason `
            -Expected "statusReason contendo '$($scenario.ExpectedReasonPattern)'" `
            -Actual $(if ($hasStatusReason) { [string]$statusReason } else { '<vazio>' })
    }

    $paymentUrl = "$baseUrl/api/payments/payments/order/$orderId"
    $paymentResponse = Invoke-ApiRequest -Method 'Get' -Url $paymentUrl -Token $script:token
    if ($scenario.ExpectedPaymentStatus -eq 'NONE') {
        # Estoque rejeitado: a Saga termina antes da cobranca.
        Write-Check -Name "$($scenario.Name): nenhum pagamento criado" `
            -Success ($paymentResponse.StatusCode -eq 404) `
            -Expected 'HTTP 404' `
            -Actual "HTTP $($paymentResponse.StatusCode)"
        continue
    }

    $paymentStatus =Get-JsonProperty -InputObject $paymentResponse.Data -Name 'status'
    $paymentStatusMatches = $paymentResponse.Success -and $paymentStatus -eq $scenario.ExpectedPaymentStatus
    Write-Check -Name "$($scenario.Name): status do pagamento" `
        -Success $paymentStatusMatches `
        -Expected $scenario.ExpectedPaymentStatus `
        -Actual "HTTP $($paymentResponse.StatusCode), status=$paymentStatus"

    if ($scenario.ExpectedPaymentStatus -eq 'REJECTED') {
        $paymentReason = Get-JsonProperty -InputObject $paymentResponse.Data -Name 'reason'
        $hasPaymentReason = -not [string]::IsNullOrWhiteSpace([string]$paymentReason)
        Write-Check -Name "$($scenario.Name): motivo do pagamento" `
            -Success $hasPaymentReason `
            -Expected 'reason preenchido' `
            -Actual $(if ($hasPaymentReason) { [string]$paymentReason } else { '<vazio>' })
    }
}

Write-Host 'Etapa final: conferindo estoque do produto...'
# A efetiva 2 unidades; B libera a propria reserva; C nao reserva nada.
$expectedStock = 98
$stockDeadline = (Get-Date).AddSeconds(20)
do {
    $finalProductResponse = Invoke-ApiRequest -Method 'Get' -Url "$baseUrl/api/catalog/products/$productId"
    $finalProduct = Get-JsonProperty -InputObject $finalProductResponse.Data -Name 'product'
    $finalStock = Get-JsonProperty -InputObject $finalProduct -Name 'stock'
    $finalReserved = Get-JsonProperty -InputObject $finalProduct -Name 'reserved'
    $stockSettled = $finalProductResponse.Success -and [int]$finalStock -eq $expectedStock -and [int]$finalReserved -eq 0
    if (-not $stockSettled) {
        Start-Sleep -Seconds 1
    }
} while (-not $stockSettled -and (Get-Date) -lt $stockDeadline)
Write-Check -Name 'estoque final do produto' `
    -Success $stockSettled `
    -Expected "stock=$expectedStock, reserved=0" `
    -Actual "HTTP $($finalProductResponse.StatusCode), stock=$finalStock, reserved=$finalReserved"

Write-Host 'Etapa final: conferindo notificacoes do usuario...'
# Esperado: 3 pedidos recebidos, 1 confirmado, 1 pagamento recusado e 1 cancelado por estoque.
$expectedTypes = @('ORDER_RECEIVED', 'ORDER_CONFIRMED', 'PAYMENT_REJECTED', 'ORDER_CANCELLED')
$notificationsDeadline = (Get-Date).AddSeconds(20)
do {
    $notificationsResponse = Invoke-ApiRequest `
        -Method 'Get' `
        -Url "$baseUrl/api/notifications/notifications/me?limit=50" `
        -Token $script:token
    $notificationItems = @(Get-JsonProperty -InputObject $notificationsResponse.Data -Name 'items')
    $receivedTypes = @($notificationItems | ForEach-Object { Get-JsonProperty -InputObject $_ -Name 'type' } | Sort-Object -Unique)
    $missingTypes = @($expectedTypes | Where-Object { $receivedTypes -notcontains $_ })
    $notificationsReady = $notificationsResponse.Success -and $missingTypes.Count -eq 0 -and $notificationItems.Count -ge 6
    if (-not $notificationsReady) {
        Start-Sleep -Seconds 1
    }
} while (-not $notificationsReady -and (Get-Date) -lt $notificationsDeadline)
Write-Check -Name 'notificacoes do usuario' `
    -Success $notificationsReady `
    -Expected "6 notificacoes com tipos $($expectedTypes -join ', ')" `
    -Actual "HTTP $($notificationsResponse.StatusCode), $($notificationItems.Count) notificacoes, tipos: $($receivedTypes -join ', ')"

Write-Host 'Carrinho no servidor: salvando, lendo e limpando...'
$cartUrl = "$baseUrl/api/orders/cart"
$cartItems = @(@{
        productId = $productId
        name      = 'Produto do smoke test'
        price     = 349.90
        category  = 'smoke-test'
        quantity  = 3
    })
$cartSave = Invoke-ApiRequest -Method 'Put' -Url $cartUrl -Body @{ items = $cartItems } -Token $script:token
Write-Check -Name 'carrinho: salvar' -Success $cartSave.Success -Expected 'HTTP 2xx' -Actual "HTTP $($cartSave.StatusCode)"

$cartRead = Invoke-ApiRequest -Method 'Get' -Url $cartUrl -Token $script:token
$savedItems = @(Get-JsonProperty -InputObject $cartRead.Data -Name 'items')
$savedQuantity = if ($savedItems.Count -gt 0) { [int](Get-JsonProperty -InputObject $savedItems[0] -Name 'quantity') } else { 0 }
Write-Check -Name 'carrinho: ler' `
    -Success ($cartRead.Success -and $savedItems.Count -eq 1 -and $savedQuantity -eq 3) `
    -Expected '1 item com quantidade 3' `
    -Actual "HTTP $($cartRead.StatusCode), $($savedItems.Count) item(ns), quantidade $savedQuantity"

$cartAnonymous = Invoke-ApiRequest -Method 'Get' -Url $cartUrl
Write-Check -Name 'carrinho: exige autenticacao' `
    -Success ($cartAnonymous.StatusCode -eq 401) `
    -Expected 'HTTP 401' `
    -Actual "HTTP $($cartAnonymous.StatusCode)"

$cartDelete = Invoke-ApiRequest -Method 'Delete' -Url $cartUrl -Token $script:token
$cartAfter = Invoke-ApiRequest -Method 'Get' -Url $cartUrl -Token $script:token
$remainingItems = @(Get-JsonProperty -InputObject $cartAfter.Data -Name 'items')
Write-Check -Name 'carrinho: limpar' `
    -Success ($cartDelete.Success -and $cartAfter.Success -and $remainingItems.Count -eq 0) `
    -Expected 'carrinho vazio' `
    -Actual "HTTP $($cartAfter.StatusCode), $($remainingItems.Count) item(ns)"

Write-Host ''
Write-Host "Resumo do smoke test: $script:passed PASS, $script:failed FAIL."
if ($script:failed -gt 0) {
    exit 1
}

exit 0
