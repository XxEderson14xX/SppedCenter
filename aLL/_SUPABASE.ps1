# ==============================================================================
# SCRIPT DE RESPALDO INTEGRAL SUPABASE - SPEEDCENTER
# Documento de referencia: Guía técnica de respaldo de Supabase
# ==============================================================================

param (
    [string]$ProjectRef   = "cawevglxeaogyokpxovo",
    [string]$HostName     = "aws-0-us-west-2.pooler.supabase.com",
    [string]$DbUser       = "postgres.cawevglxeaogyokpxovo",
    [string]$DbName       = "postgres",
    [int]$Port            = 5432,
    [string]$TargetFolder = "C:\Users\Ernesto Castillo\SPEEDCENTER"
)

$ErrorActionPreference = "Stop"

Clear-Host
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESPALDO INTEGRAL SUPABASE (SPEEDCENTER)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Host DB:   $HostName"
Write-Host "Proyecto:  $ProjectRef"
Write-Host "Destino:   $TargetFolder`n"

if (-not (Test-Path -Path $TargetFolder)) {
    New-Item -ItemType Directory -Path $TargetFolder -Force | Out-Null
}

# 1. Contraseña de PostgreSQL
$SecurePass = Read-Host -Prompt "Introduce la contraseña de PostgreSQL" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePass)
$env:PGPASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# 2. Clave Service Role (para descargas físicas de Storage)
Write-Host "`n(Opcional) Pega tu 'service_role key' de Supabase para descargar archivos de Storage." -ForegroundColor Gray
$ServiceKey = Read-Host -Prompt "Service Role Key (presiona Enter para omitir Storage)"

# Estructura de directorios acorde a la Guía Técnica
$Timestamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$BackupDirName = "SUPABASE_BACKUP_$Timestamp"
$BackupDir = Join-Path -Path $TargetFolder -ChildPath $BackupDirName
$DbDir      = Join-Path -Path $BackupDir -ChildPath "01_DATABASE"
$StorageDir = Join-Path -Path $BackupDir -ChildPath "02_STORAGE"

New-Item -ItemType Directory -Path $DbDir -Force | Out-Null
New-Item -ItemType Directory -Path $StorageDir -Force | Out-Null

# Función auxiliar para descargar objetos de Storage mediante API REST
function Download-SupabaseStorageFolder {
    param (
        [string]$Bucket,
        [string]$RemotePath,
        [string]$LocalPath,
        [hashtable]$Headers
    )

    if (-not (Test-Path -Path $LocalPath)) {
        New-Item -ItemType Directory -Path $LocalPath -Force | Out-Null
    }

    $ListUrl = "https://$ProjectRef.supabase.co/storage/v1/object/list/$Bucket"
    $Body = @{
        prefix = $RemotePath
        limit  = 100
        offset = 0
    } | ConvertTo-Json

    try {
        $Objects = Invoke-RestMethod -Uri $ListUrl -Method Post -Headers $Headers -Body $Body -ContentType "application/json"
        
        foreach ($Obj in $Objects) {
            if ($Obj.id -eq $null) {
                # Subcarpeta
                $SubRemote = if ([string]::IsNullOrEmpty($RemotePath)) { $Obj.name } else { "$RemotePath/$($Obj.name)" }
                $SubLocal  = Join-Path -Path $LocalPath -ChildPath $Obj.name
                Download-SupabaseStorageFolder -Bucket $Bucket -RemotePath $SubRemote -LocalPath $SubLocal -Headers $Headers
            } else {
                # Archivo
                $FilePath = if ([string]::IsNullOrEmpty($RemotePath)) { $Obj.name } else { "$RemotePath/$($Obj.name)" }
                $FileUrl  = "https://$ProjectRef.supabase.co/storage/v1/object/$Bucket/$FilePath"
                $OutFile  = Join-Path -Path $LocalPath -ChildPath $Obj.name

                Invoke-RestMethod -Uri $FileUrl -Method Get -Headers $Headers -OutFile $OutFile
                Write-Host "  ✔ Archivo descargado: $Bucket/$FilePath" -ForegroundColor Green
            }
        }
    } catch {
        Write-Host "  ⚠️ No se pudieron listar u obtener objetos en $Bucket/$RemotePath" -ForegroundColor Yellow
    }
}

try {
    # -------------------------------------------------------------------------
    # 1. EXPORTACIÓN DE BASE DE DATOS (roles.sql, schema.sql, data.sql)
    # -------------------------------------------------------------------------
    Write-Host "`n[1/3] Exportando Base de Datos PostgreSQL..." -ForegroundColor Yellow

    # Desactivar detención por advertencias de stderr en pg_dump
    $PreviousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    Write-Host "  -> Exportando Roles y Permisos (roles.sql)..." -ForegroundColor Gray
    & pg_dumpall -h $HostName -p $Port -U $DbUser --roles-only -f "$DbDir\roles.sql" 2>&1 | Out-Null

    Write-Host "  -> Exportando Esquema (schema.sql)..." -ForegroundColor Gray
    & pg_dump -h $HostName -p $Port -U $DbUser -d $DbName --schema-only --quote-all-identifiers -f "$DbDir\schema.sql" 2>&1 | Out-Null

    Write-Host "  -> Exportando Registros (data.sql)..." -ForegroundColor Gray
    & pg_dump -h $HostName -p $Port -U $DbUser -d $DbName --data-only --disable-triggers -f "$DbDir\data.sql" 2>&1 | Out-Null

    # Restaurar preferencia de errores estricta
    $ErrorActionPreference = $PreviousErrorPreference

    # Validación de generación de archivos
    if ((-not (Test-Path "$DbDir\schema.sql")) -or ((Get-Item "$DbDir\schema.sql").Length -eq 0)) {
        throw "El archivo schema.sql no se generó correctamente. Revisa que la contraseña sea correcta."
    }
    if ((-not (Test-Path "$DbDir\data.sql")) -or ((Get-Item "$DbDir\data.sql").Length -eq 0)) {
        throw "El archivo data.sql no se generó correctamente."
    }

    # -------------------------------------------------------------------------
    # 2. EXPORTACIÓN DE STORAGE
    # -------------------------------------------------------------------------
    Write-Host "`n[2/3] Procesando Supabase Storage..." -ForegroundColor Yellow

    if (-not [string]::IsNullOrWhiteSpace($ServiceKey)) {
        $ApiHeaders = @{
            "apikey"        = $ServiceKey
            "Authorization" = "Bearer $ServiceKey"
        }

        $BucketsUrl = "https://$ProjectRef.supabase.co/storage/v1/bucket"
        $Buckets = Invoke-RestMethod -Uri $BucketsUrl -Method Get -Headers $ApiHeaders

        if ($Buckets.Count -gt 0) {
            foreach ($B in $Buckets) {
                Write-Host "  -> Descargando Bucket: $($B.name)" -ForegroundColor Cyan
                $BucketDir = Join-Path -Path $StorageDir -ChildPath $B.name
                Download-SupabaseStorageFolder -Bucket $B.name -RemotePath "" -LocalPath $BucketDir -Headers $ApiHeaders
            }
        } else {
            Write-Host "  ℹ️ No hay buckets de Storage creados en este proyecto." -ForegroundColor Gray
        }
    } else {
        Write-Host "  ℹ️ Service Role Key no proporcionada. La estructura de Storage queda registrada únicamente en la base de datos." -ForegroundColor Gray
    }

    # -------------------------------------------------------------------------
    # 3. COMPRESIÓN ZIP Y LIMPIEZA DE SESIÓN
    # -------------------------------------------------------------------------
    Write-Host "`n[3/3] Comprimiendo el respaldo completo..." -ForegroundColor Yellow
    $ZipPath = Join-Path -Path $TargetFolder -ChildPath "$BackupDirName.zip"
    Compress-Archive -Path "$BackupDir\*" -DestinationPath $ZipPath -Force

    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "✔ RESPALDO EXITOSO: $ZipPath" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Carpeta: $BackupDir" -ForegroundColor White

} catch {
    Write-Host "`n❌ Error durante el respaldo: $_" -ForegroundColor Red
} finally {
    # Seguridad: Eliminar PGPASSWORD de la sesión[cite: 1]
    $env:PGPASSWORD = $null
    if ($BSTR) { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR) }
}