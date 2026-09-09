$uri = "http://localhost:8000/api/v1/predict"

$success = 0
$errors = 0

for ($i = 1; $i -le 100; $i++) {

    $amount = Get-Random -Minimum 10 -Maximum 2000
    $hour = Get-Random -Minimum 0 -Maximum 24

    $deviceRisk = [math]::Round((Get-Random -Minimum 0 -Maximum 100) / 100, 2)
    $ipRisk = [math]::Round((Get-Random -Minimum 0 -Maximum 100) / 100, 2)

    $transactionTypes = @(
        "purchase",
        "purchase",
        "purchase",
        "withdrawal",
        "transfer"
    )

    $merchantCategories = @(
        "electronics",
        "grocery",
        "restaurant",
        "travel",
        "clothing",
        "online"
    )

    $countries = @(
        "US",
        "US",
        "US",
        "UK",
        "CA",
        "IN"
    )

    $body = @{
        transaction_id     = "TXN-{0:D6}" -f $i
        user_id            = "USER-{0:D6}" -f (Get-Random -Minimum 1 -Maximum 50)
        amount             = [double]$amount
        transaction_type   = $transactionTypes | Get-Random
        merchant_category  = $merchantCategories | Get-Random
        country            = $countries | Get-Random
        hour               = $hour
        device_risk_score  = $deviceRisk
        ip_risk_score      = $ipRisk
    } | ConvertTo-Json

    try {

        $response = Invoke-RestMethod `
            -Uri $uri `
            -Method Post `
            -ContentType "application/json" `
            -Body $body

        $success++

        Write-Host "[$i/100] OK - Fraud=$($response.is_fraud) Probability=$($response.fraud_probability)"

    }
    catch {

        $errors++

        Write-Host "[$i/100] ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }

    Start-Sleep -Milliseconds 100
}

Write-Host ""
Write-Host "================================"
Write-Host "100 Prediction Test Complete"
Write-Host "================================"
Write-Host "Successful: $success"
Write-Host "Errors:     $errors"
