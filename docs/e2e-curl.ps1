param(
  [string]$BaseUrl = "http://localhost:3000",
  [bool]$AssertMode = $true
)

$ErrorActionPreference = "Stop"

function Invoke-Api {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Url,
    [hashtable]$Headers,
    [object]$Body
  )

  $invokeParams = @{
    Method = $Method
    Uri = $Url
    Headers = $Headers
    ErrorAction = "Stop"
    UseBasicParsing = $true
  }

  if ($null -ne $Body) {
    $invokeParams["ContentType"] = "application/json"
    $invokeParams["Body"] = ($Body | ConvertTo-Json -Depth 10)
  }

  try {
    $response = Invoke-WebRequest @invokeParams
    return [pscustomobject]@{
      StatusCode = [int]$response.StatusCode
      Body = if ([string]::IsNullOrWhiteSpace($response.Content)) { $null } else { $response.Content | ConvertFrom-Json }
      Raw = $response.Content
    }
  } catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $statusCode = [int]$_.Exception.Response.StatusCode
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $raw = $reader.ReadToEnd()
      $reader.Close()

      return [pscustomobject]@{
        StatusCode = $statusCode
        Body = if ([string]::IsNullOrWhiteSpace($raw)) { $null } else { $raw | ConvertFrom-Json }
        Raw = $raw
      }
    }

    throw
  }
}

function Assert-Status {
  param(
    [Parameter(Mandatory = $true)][string]$Step,
    [Parameter(Mandatory = $true)][int]$Actual,
    [Parameter(Mandatory = $true)][int]$Expected
  )

  if (-not $AssertMode) {
    return
  }

  if ($Actual -ne $Expected) {
    throw "$Step failed. Expected HTTP $Expected but got $Actual"
  }
}

Write-Host "1) Login as risk officer"
$login = Invoke-Api -Method "POST" -Url "$BaseUrl/api/v1/auth/login" -Body @{
  username = "risk"
  password = "Risk#12345"
}
$login | Format-List

if ($login.StatusCode -ne 200) {
  throw "Login failed. StatusCode=$($login.StatusCode)"
}

Assert-Status -Step "Login" -Actual $login.StatusCode -Expected 200

$accessToken = $login.Body.accessToken
$refreshToken = $login.Body.refreshToken
$authHeaders = @{ Authorization = "Bearer $accessToken" }
$runSuffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$idempotencyKey = "demo-key-$runSuffix"

Write-Host "2) Create transaction first time (expect 201)"
$firstCreate = Invoke-Api -Method "POST" -Url "$BaseUrl/api/v1/transactions" -Headers ($authHeaders + @{ "idempotency-key" = $idempotencyKey }) -Body @{
  userId = "u-001"
  amount = 149.99
  currency = "USD"
  occurredAt = "2026-04-01T10:00:00.000Z"
}
$firstCreate | Format-List
Assert-Status -Step "First create" -Actual $firstCreate.StatusCode -Expected 201

Write-Host "3) Replay same idempotency key + payload (expect 200)"
$replay = Invoke-Api -Method "POST" -Url "$BaseUrl/api/v1/transactions" -Headers ($authHeaders + @{ "idempotency-key" = $idempotencyKey }) -Body @{
  userId = "u-001"
  amount = 149.99
  currency = "USD"
  occurredAt = "2026-04-01T10:00:00.000Z"
}
$replay | Format-List
Assert-Status -Step "Replay create" -Actual $replay.StatusCode -Expected 200

Write-Host "4) Same idempotency key + different payload (expect 409)"
$conflict = Invoke-Api -Method "POST" -Url "$BaseUrl/api/v1/transactions" -Headers ($authHeaders + @{ "idempotency-key" = $idempotencyKey }) -Body @{
  userId = "u-001"
  amount = 999.99
  currency = "USD"
  occurredAt = "2026-04-01T10:00:00.000Z"
}
$conflict | Format-List
Assert-Status -Step "Conflict create" -Actual $conflict.StatusCode -Expected 409

Write-Host "5) Refresh token rotation"
$refresh = Invoke-Api -Method "POST" -Url "$BaseUrl/api/v1/auth/refresh" -Body @{
  refreshToken = $refreshToken
}
$refresh | Format-List
Assert-Status -Step "Refresh token" -Actual $refresh.StatusCode -Expected 200

Write-Host "6) Reuse old refresh token (expect 401)"
$reuse = Invoke-Api -Method "POST" -Url "$BaseUrl/api/v1/auth/refresh" -Body @{
  refreshToken = $refreshToken
}
$reuse | Format-List
Assert-Status -Step "Reuse old refresh token" -Actual $reuse.StatusCode -Expected 401

Write-Host "7) Health checks"
$live = Invoke-Api -Method "GET" -Url "$BaseUrl/health/live"
$ready = Invoke-Api -Method "GET" -Url "$BaseUrl/health/ready"
$live | Format-List
$ready | Format-List

Assert-Status -Step "Health live" -Actual $live.StatusCode -Expected 200
Assert-Status -Step "Health ready" -Actual $ready.StatusCode -Expected 200

if ($AssertMode) {
  if ($ready.Body -eq $null -or $ready.Body.status -ne "ready") {
    throw "Ready body does not report ready status"
  }

  if (-not $ready.Body.checks.database -or -not $ready.Body.checks.redis) {
    throw "Ready checks indicate dependency failure"
  }
}

Write-Host "E2E scenario completed"
