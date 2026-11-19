# Helper for deploy-staging.bat / deploy-prod.bat: edits Code.js flags safely.
# - Writes UTF-8 WITHOUT BOM (Windows PowerShell 5.1 "Set-Content -Encoding UTF8" adds a BOM).
# - Logic lives here instead of an inline "powershell -Command" in the .bat, because cmd.exe
#   treats ^ as an escape character and silently broke the regex [^'] used for DEV_VERSION_NOTE.
# - Keep this file ASCII-only: PowerShell 5.1 misreads non-ASCII .ps1 files saved without a BOM.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File update-codejs.ps1 -DevEnv true -UpdateNote
#   powershell -NoProfile -ExecutionPolicy Bypass -File update-codejs.ps1 -DevEnv false
# The note text is read from the DEPLOY_DESC environment variable (set by the .bat).

param(
    [Parameter(Mandatory = $true)][ValidateSet('true', 'false')][string]$DevEnv,
    [switch]$UpdateNote
)

$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot 'Code.js'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$c = [System.IO.File]::ReadAllText($path, $utf8NoBom)
$c = $c.TrimStart([char]0xFEFF)

$c = $c -replace 'const IS_DEV_ENV = (true|false);', "const IS_DEV_ENV = $DevEnv;"

if ($UpdateNote) {
    $desc = ($env:DEPLOY_DESC -replace "'", '').Trim()
    $dt = Get-Date -Format 'yyyy/MM/dd HH:mm'
    # "v2.2.2 summary" -> "v2.2.2 (yyyy/MM/dd HH:mm - summary)", matching the rule in .agents/rules/dev-workflow.md
    if ($desc -match '^(v\d+(?:\.\d+)*)\s+(.+)$') {
        $note = "$($Matches[1]) ($dt " + [char]0x2014 + " $($Matches[2]))"
    } else {
        $note = "($dt) " + [char]0x2014 + " $desc"
    }
    $before = $c
    $c = [regex]::Replace($c, "const DEV_VERSION_NOTE = '[^']*';", { param($m) "const DEV_VERSION_NOTE = '$note';" })
    if ($c -eq $before -and $c -notmatch [regex]::Escape("const DEV_VERSION_NOTE = '$note';")) {
        Write-Warning 'DEV_VERSION_NOTE line not found in Code.js; note not updated.'
    }
}

[System.IO.File]::WriteAllText($path, $c, $utf8NoBom)
