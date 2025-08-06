# Edufam Authentication API Test Script
# Run this script to test the authentication endpoints

Write-Host "🧪 Testing Edufam Authentication API" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

$baseUrl = "http://localhost:5000"

# Test 1: Health Check
Write-Host "`n1️⃣ Testing Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET
    Write-Host "✅ Health Check: $($health.status)" -ForegroundColor Green
    Write-Host "   Database: $($health.database)" -ForegroundColor Cyan
    Write-Host "   Token Cleanup: $($health.security.tokenCleanup)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Health Check Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: API Info
Write-Host "`n2️⃣ Testing API Info..." -ForegroundColor Yellow
try {
    $apiInfo = Invoke-RestMethod -Uri "$baseUrl/api" -Method GET
    Write-Host "✅ API Info: $($apiInfo.name) v$($apiInfo.version)" -ForegroundColor Green
    Write-Host "   Description: $($apiInfo.description)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ API Info Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Login (this will fail without a real user in database)
Write-Host "`n3️⃣ Testing Login..." -ForegroundColor Yellow
$loginBody = @{
    email = "admin@edufam.com"
    password = "TempAdmin123!"
    userType = "admin_user"
} | ConvertTo-Json

try {
    $login = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    Write-Host "✅ Login Successful!" -ForegroundColor Green
    Write-Host "   User: $($login.data.user.email)" -ForegroundColor Cyan
    Write-Host "   Role: $($login.data.user.role)" -ForegroundColor Cyan
    
    # Store tokens for further tests
    $accessToken = $login.data.tokens.accessToken
    $refreshToken = $login.data.tokens.refreshToken
    
    # Test 4: Get Current User (Protected Endpoint)
    Write-Host "`n4️⃣ Testing Protected Endpoint (Get Current User)..." -ForegroundColor Yellow
    $headers = @{
        Authorization = "Bearer $accessToken"
    }
    
    $me = Invoke-RestMethod -Uri "$baseUrl/api/auth/me" -Method GET -Headers $headers
    Write-Host "✅ Protected Endpoint Success!" -ForegroundColor Green
    Write-Host "   User ID: $($me.data.user.id)" -ForegroundColor Cyan
    Write-Host "   Active Sessions: $($me.data.sessions.Count)" -ForegroundColor Cyan
    
    # Test 5: Token Refresh
    Write-Host "`n5️⃣ Testing Token Refresh..." -ForegroundColor Yellow
    $refreshBody = @{
        refreshToken = $refreshToken
    } | ConvertTo-Json
    
    $refresh = Invoke-RestMethod -Uri "$baseUrl/api/auth/refresh-token" -Method POST -Body $refreshBody -ContentType "application/json"
    Write-Host "✅ Token Refresh Success!" -ForegroundColor Green
    Write-Host "   New Access Token: $($refresh.data.tokens.accessToken.Substring(0, 20))..." -ForegroundColor Cyan
    
    # Test 6: Logout
    Write-Host "`n6️⃣ Testing Logout..." -ForegroundColor Yellow
    $logoutBody = @{
        refreshToken = $refreshToken
    } | ConvertTo-Json
    
    $logout = Invoke-RestMethod -Uri "$baseUrl/api/auth/logout" -Method POST -Body $logoutBody -ContentType "application/json" -Headers $headers
    Write-Host "✅ Logout Success!" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Login/Protected Tests Failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   This is expected if no users exist in the database yet" -ForegroundColor Yellow
}

# Test 7: Forgot Password
Write-Host "`n7️⃣ Testing Forgot Password..." -ForegroundColor Yellow
$forgotBody = @{
    email = "admin@edufam.com"
    userType = "admin_user"
} | ConvertTo-Json

try {
    $forgot = Invoke-RestMethod -Uri "$baseUrl/api/auth/forgot-password" -Method POST -Body $forgotBody -ContentType "application/json"
    Write-Host "✅ Forgot Password Success!" -ForegroundColor Green
    Write-Host "   Message: $($forgot.message)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Forgot Password Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 Authentication API Tests Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green 