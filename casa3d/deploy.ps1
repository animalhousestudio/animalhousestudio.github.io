# Ripristina l'index.html sorgente (il deploy precedente lo sovrascrive
# con la build compilata, che Vite non puo' piu' usare come entry point)
Copy-Item index.template.html index.html -Force

# Build
npm run build -- --base=/casa3d/

# Copia l'output compilato al posto giusto per GitHub Pages
Copy-Item dist\index.html . -Force
Copy-Item dist\assets\* assets\ -Force

Write-Host ""
Write-Host "Build e copia completate. Ora da root del repo:"
Write-Host "  cd .."
Write-Host "  git add -A"
Write-Host "  git commit -m ""aggiornamento giardino"""
Write-Host "  git push"
