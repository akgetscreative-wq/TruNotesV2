# TruNotes AI Setup Script (PowerShell)
# Run this from the project root: .\setup-ai.ps1

Write-Host "🤖 TruNotes AI Setup" -ForegroundColor Cyan
Write-Host "====================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Run this script from the TruNotes project root" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Adding llama.cpp as a Git submodule..." -ForegroundColor Yellow
git submodule add https://github.com/ggerganov/llama.cpp android/llama.cpp

Write-Host "📥 Initializing submodule..." -ForegroundColor Yellow
git submodule update --init --recursive

Write-Host "✏️  Updating CMakeLists.txt to point to llama.cpp..." -ForegroundColor Yellow
$cmakeFile = "android\app\src\main\cpp\CMakeLists.txt"
$content = Get-Content $cmakeFile -Raw
$content = $content -replace 'add_subdirectory\(../../../../../../ build-llama\)', 'add_subdirectory(../../llama.cpp llama-build)'
Set-Content $cmakeFile -Value $content

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. cd android"
Write-Host "2. .\gradlew.bat assembleDebug"
Write-Host "3. Check for successful native library build"
Write-Host ""
Write-Host "If you prefer using npm package instead:" -ForegroundColor Yellow
Write-Host "  npm install llama.rn"
Write-Host "  (Then update the implementation to use llama.rn)"
