param(
    [switch]$Push,
    [ValidateNotNullOrEmpty()]
    [string]$Message = 'Aggiorna Casa3D'
)

$ErrorActionPreference = 'Stop'

function Invoke-GitChecked {
    param([string[]]$GitArguments)
    & git @GitArguments
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArguments -join ' ') fallito (exit code $LASTEXITCODE)."
    }
}

Push-Location $PSScriptRoot
try {
    if ($Push) {
        Invoke-GitChecked -GitArguments @('fetch', 'origin', 'main')
        Invoke-GitChecked -GitArguments @('merge-base', '--is-ancestor', 'origin/main', 'HEAD')
        # Non includere nel commit file gia preparati per altri lavori.
        Invoke-GitChecked -GitArguments @('diff', '--cached', '--quiet')
    }

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
    if ($Push) {
        Invoke-GitChecked -GitArguments @('add', '--', '.', '../BUILD_LOCAL.md')
        & git diff --cached --quiet
        $diffExit = $LASTEXITCODE
        if ($diffExit -eq 1) {
            Invoke-GitChecked -GitArguments @(
                'commit', '-m', $Message,
                '-m', 'Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>'
            )
        } elseif ($diffExit -ne 0) {
            throw "Controllo modifiche Git fallito (exit code $diffExit)."
        }
        Invoke-GitChecked -GitArguments @('push', 'origin', 'HEAD:main')
        Write-Host "Push su GitHub main completato."
    } else {
        Write-Host "Solo build. Per commit e push su main: .\casa3d\deploy.ps1 -Push"
    }
} finally {
    Pop-Location
}
