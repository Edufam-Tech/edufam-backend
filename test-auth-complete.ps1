# Edufam Authentication API Complete Test
Write-Host "🔐 Testing Edufam Authentication API" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Wait for server to start
Write-Host "⏳ Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Test 1: Health Check
Write-Host "1️⃣ Testing Health Check..." -ForegroundColor Green
try {
    $health = Invoke-RestMethod -Uri "http://localhost:5000/health" -Method GET
    Write-Host "✅ Health Check: OK" -ForegroundColor Green
    Write-Host "   Database: $($health.database.status)" -ForegroundColor Gray
    Write-Host "   Token Cleanup: $($health.tokenCleanup.status)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health Check Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: API Info
Write-Host "2️⃣ Testing API Info..." -ForegroundColor Green
try {
    $apiInfo = Invoke-RestMethod -Uri "http://localhost:5000/api" -Method GET
    Write-Host "✅ API Info: $($apiInfo.name) v$($apiInfo.version)" -ForegroundColor Green
    Write-Host "   Description: $($apiInfo.description)" -ForegroundColor Gray
} catch {
    Write-Host "❌ API Info Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 3: Login
Write-Host "3️⃣ Testing Login..." -ForegroundColor Green
try {
    $loginBody = @{
        email = "admin@edufam.com"
        password = "TempAdmin123!"
        userType = "admin_user"
    } | ConvertTo-Json

    $login = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    
    if ($login.success) {
        Write-Host "✅ Login Successful!" -ForegroundColor Green
        Write-Host "   User: $($login.data.user.email)" -ForegroundColor Gray
        Write-Host "   Role: $($login.data.user.role)" -ForegroundColor Gray
        
        $accessToken = $login.data.tokens.accessToken
        $refreshToken = $login.data.tokens.refreshToken
        
        Write-Host "   Access Token: $($accessToken.Substring(0, 20))..." -ForegroundColor Gray
        Write-Host "   Refresh Token: $($refreshToken.Substring(0, 20))..." -ForegroundColor Gray
    } else {
        Write-Host "❌ Login Failed: $($login.error.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Login Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""

# Test 4: Get Current User (Protected Endpoint)
Write-Host "4️⃣ Testing Protected Endpoint (Get Current User)..." -ForegroundColor Green
try {
    $headers = @{
        Authorization = "Bearer $accessToken"
    }
    
    $me = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/me" -Method GET -Headers $headers
    
    if ($me.success) {
        Write-Host "✅ Get Current User Successful!" -ForegroundColor Green
        Write-Host "   User: $($me.data.user.email)" -ForegroundColor Gray
        Write-Host "   Role: $($me.data.user.role)" -ForegroundColor Gray
        Write-Host "   Active Sessions: $($me.data.sessions.Count)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Get Current User Failed: $($me.error.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Get Current User Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Red
    }
}

Write-Host ""

# Test 5: Refresh Token
Write-Host "5️⃣ Testing Token Refresh..." -ForegroundColor Green
try {
    $refreshBody = @{
        refreshToken = $refreshToken
    } | ConvertTo-Json
    
    $refresh = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/refresh-token" -Method POST -Body $refreshBody -ContentType "application/json"
    
    if ($refresh.success) {
        Write-Host "✅ Token Refresh Successful!" -ForegroundColor Green
        Write-Host "   New Access Token: $($refresh.data.accessToken.Substring(0, 20))..." -ForegroundColor Gray
        $accessToken = $refresh.data.accessToken
    } else {
        Write-Host "❌ Token Refresh Failed: $($refresh.error.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Token Refresh Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 6: Forgot Password
Write-Host "6️⃣ Testing Forgot Password..." -ForegroundColor Green
try {
    $forgotBody = @{
        email = "admin@edufam.com"
    } | ConvertTo-Json
    
    $forgot = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/forgot-password" -Method POST -Body $forgotBody -ContentType "application/json"
    
    if ($forgot.success) {
        Write-Host "✅ Forgot Password Success!" -ForegroundColor Green
        Write-Host "   Message: $($forgot.message)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Forgot Password Failed: $($forgot.error.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Forgot Password Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 7: Logout
Write-Host "7️⃣ Testing Logout..." -ForegroundColor Green
try {
    $logoutBody = @{
        refreshToken = $refreshToken
    } | ConvertTo-Json
    
    $logout = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/logout" -Method POST -Body $logoutBody -ContentType "application/json" -Headers $headers
    
    if ($logout.success) {
        Write-Host "✅ Logout Successful!" -ForegroundColor Green
        Write-Host "   Message: $($logout.message)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Logout Failed: $($logout.error.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Logout Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎉 Authentication API Tests Complete!" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan 