param (
    [Parameter(Mandatory=$false, Position=0)]
    [string]$Model
)

if ($Model) {
    $env:MODEL = $Model
    Write-Host "Iniciando test de Ollama para el modelo: $Model" -ForegroundColor Cyan
} else {
    Write-Host "Iniciando test de Ollama para todos los modelos..." -ForegroundColor Cyan
}

try {
    npm run test
}
finally {
    if ($Model) {
        Remove-Item Env:\MODEL -ErrorAction SilentlyContinue
    }
}
