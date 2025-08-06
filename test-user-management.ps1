# Edufam User Management & File Upload Test
Write-Host "👥 Testing Edufam User Management & File Upload API" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Wait for server to start
Write-Host "⏳ Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Test 1: Health Check
Write-Host "1️⃣ Testing Health Check..." -ForegroundColor Green
try {
    $health = Invoke-RestMethod -Uri "http://localhost:5000/health" -Method GET
    Write-Host "✅ Health Check: OK" -ForegroundColor Green
    Write-Host "   Database: $($health.database)" -ForegroundColor Gray
    Write-Host "   Security: $($health.security.rateLimit)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health Check Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: Login to get access token
Write-Host "2️⃣ Testing Login..." -ForegroundColor Green
try {
    $loginBody = @{
        email = "admin@edufam.com"
        password = "TempAdmin123!"
        userType = "admin_user"
    } | ConvertTo-Json

    $login = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    
    if ($login.success) {
        Write-Host "✅ Login Successful!" -ForegroundColor Green
        $accessToken = $login.data.tokens.accessToken
        Write-Host "   Access Token: $($accessToken.Substring(0, 20))..." -ForegroundColor Gray
    } else {
        Write-Host "❌ Login Failed: $($login.error.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Login Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 3: Get current user profile
Write-Host "3️⃣ Testing Get Current User Profile..." -ForegroundColor Green
try {
    $headers = @{
        Authorization = "Bearer $accessToken"
    }
    
    $profile = Invoke-RestMethod -Uri "http://localhost:5000/api/users/profile" -Method GET -Headers $headers
    
    if ($profile.success) {
        Write-Host "✅ Get Profile Successful!" -ForegroundColor Green
        Write-Host "   User: $($profile.data.user.email)" -ForegroundColor Gray
        Write-Host "   Role: $($profile.data.user.role)" -ForegroundColor Gray
        Write-Host "   Name: $($profile.data.user.firstName) $($profile.data.user.lastName)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Get Profile Failed: $($profile.error.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Get Profile Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 4: Update user profile
Write-Host "4️⃣ Testing Update User Profile..." -ForegroundColor Green
try {
    $updateBody = @{
        firstName = "Updated"
        lastName = "Admin"
        phone = "+254712345678"
    } | ConvertTo-Json
    
    $update = Invoke-RestMethod -Uri "http://localhost:5000/api/users/profile" -Method PUT -Body $updateBody -ContentType "application/json" -Headers $headers
    
    if ($update.success) {
        Write-Host "✅ Update Profile Successful!" -ForegroundColor Green
        Write-Host "   Message: $($update.message)" -ForegroundColor Gray
        Write-Host "   Updated Name: $($update.data.user.firstName) $($update.data.user.lastName)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Update Profile Failed: $($update.error.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Update Profile Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 5: Get user sessions
Write-Host "5️⃣ Testing Get User Sessions..." -ForegroundColor Green
try {
    $sessions = Invoke-RestMethod -Uri "http://localhost:5000/api/users/sessions" -Method GET -Headers $headers
    
    if ($sessions.success) {
        Write-Host "✅ Get Sessions Successful!" -ForegroundColor Green
        Write-Host "   Active Sessions: $($sessions.data.sessions.Count)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Get Sessions Failed: $($sessions.error.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Get Sessions Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 6: Get all users (admin only)
Write-Host "6️⃣ Testing Get All Users..." -ForegroundColor Green
try {
    $users = Invoke-RestMethod -Uri "http://localhost:5000/api/users" -Method GET -Headers $headers
    
    if ($users.success) {
        Write-Host "✅ Get All Users Successful!" -ForegroundColor Green
        Write-Host "   Total Users: $($users.data.pagination.total)" -ForegroundColor Gray
        Write-Host "   Users in Page: $($users.data.users.Count)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Get All Users Failed: $($users.error.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Get All Users Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 7: Get user statistics
Write-Host "7️⃣ Testing Get User Statistics..." -ForegroundColor Green
try {
    $stats = Invoke-RestMethod -Uri "http://localhost:5000/api/users/stats" -Method GET -Headers $headers
    
    if ($stats.success) {
        Write-Host "✅ Get User Stats Successful!" -ForegroundColor Green
        Write-Host "   Total Users: $($stats.data.totalUsers)" -ForegroundColor Gray
        Write-Host "   Active Users: $($stats.data.activeUsers)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Get User Stats Failed: $($stats.error.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Get User Stats Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 8: Get upload statistics
Write-Host "8️⃣ Testing Get Upload Statistics..." -ForegroundColor Green
try {
    $uploadStats = Invoke-RestMethod -Uri "http://localhost:5000/api/upload/stats" -Method GET -Headers $headers
    
    if ($uploadStats.success) {
        Write-Host "✅ Get Upload Stats Successful!" -ForegroundColor Green
        Write-Host "   Total Files: $($uploadStats.data.total_files)" -ForegroundColor Gray
        Write-Host "   Profile Pictures: $($uploadStats.data.profile_pictures)" -ForegroundColor Gray
        Write-Host "   Documents: $($uploadStats.data.documents)" -ForegroundColor Gray
    } else {
        Write-Host "❌ Get Upload Stats Failed: $($uploadStats.error.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Get Upload Stats Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎉 User Management & File Upload API Tests Complete!" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan 