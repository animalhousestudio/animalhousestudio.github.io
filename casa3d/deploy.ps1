$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    $indexPath = Join-Path $PSScriptRoot 'index.html'
    $previousIndex = [System.IO.File]::ReadAllBytes($indexPath)
    try {
        # Vite deve compilare il template, non l'HTML della build precedente.
        Copy-Item index.template.html index.html -Force
        npm.cmd run build -- --base=/casa3d/
        if ($LASTEXITCODE -ne 0) {
            throw "Build Vite fallita (exit code $LASTEXITCODE). Nessuna build pubblicata."
        }

        New-Item -ItemType Directory -Path assets -Force | Out-Null
        foreach ($asset in Get-ChildItem dist\assets -File) {
            $destination = Join-Path 'assets' $asset.Name
            # Non riscrivere asset invariati, che Windows potrebbe tenere aperti.
            if ((Test-Path $destination) -and
                (Get-FileHash $asset.FullName).Hash -eq (Get-FileHash $destination).Hash) {
                continue
            }
            Copy-Item $asset.FullName $destination -Force
        }
        Copy-Item dist\index.html index.html -Force
    } catch {
        [System.IO.File]::WriteAllBytes($indexPath, $previousIndex)
        throw
    }

    Write-Host ""
    Write-Host "Build locale pronta in casa3d/index.html e casa3d/assets/."
    Write-Host "Nessun commit o push eseguito. Istruzioni: BUILD_LOCAL.md nella root del repository."
} finally {
    Pop-Location
}
