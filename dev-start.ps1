param(
  [switch]$NoOpen,
  [switch]$SeedDemoData
)

function Test-Docker {
  docker info > $null 2>&1
  return $LASTEXITCODE -eq 0
}

if (-not (Test-Docker)) {
  Write-Host "Docker not running. Attempting to start Docker Desktop..."
  $paths = @(
    "C:\Program Files\Docker\Docker\Docker Desktop.exe",
    "C:\Program Files (x86)\Docker\Docker\Docker Desktop.exe"
  )
  $started = $false
  foreach ($p in $paths) {
    if (Test-Path $p) {
      Start-Process -FilePath $p
      $started = $true
      break
    }
  }
  if (-not $started) {
    Write-Host "Docker Desktop executable not found. Please start Docker Desktop manually if it's installed."
  }

  $tries = 0
  while (-not (Test-Docker) -and $tries -lt 60) {
    Start-Sleep -Seconds 2
    $tries++
    Write-Host "Waiting for Docker to become available... ($tries/60)"
  }
  if (-not (Test-Docker)) {
    Write-Error "Docker did not start within timeout. Exiting."
    exit 1
  }
}

Write-Host "Starting services with docker compose..."
docker compose up -d --build

Write-Host "Waiting a few seconds for containers to initialize..."
Start-Sleep -Seconds 5

if ($SeedDemoData) {
  Write-Host "Seeding demo data without deleting existing records..."
  docker compose exec -T backend node src/seed.js
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Demo data seeding failed."
    exit 1
  }
}

if (-not $NoOpen) {
  $url = 'http://localhost:3000'
  Write-Host "Opening frontend in Chrome: $url"
  $chromePaths = @(
    "$Env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$Env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe"
  )
  $launched = $false
  foreach ($cp in $chromePaths) {
    if (Test-Path $cp) {
      Start-Process -FilePath $cp -ArgumentList $url
      $launched = $true
      break
    }
  }
  if (-not $launched) {
    Start-Process $url
  }
}

Write-Host "Done. Frontend: http://localhost:3000, Backend: http://localhost:4000"
