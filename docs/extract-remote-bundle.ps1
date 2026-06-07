param(
  [string]$BuildDir = "",
  [string]$BundleName = "remoteScenes"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($BuildDir)) {
  $BuildDir = Join-Path $PSScriptRoot "..\build\bytedance-mini-game"
}

$resolvedBuildDir = (Resolve-Path -LiteralPath $BuildDir).Path
$expectedRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\build")).Path
if (-not $resolvedBuildDir.StartsWith($expectedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "BuildDir is outside expected build root: $resolvedBuildDir"
}

$localBundle = Join-Path $resolvedBuildDir "assets\$BundleName"
$remoteRoot = Join-Path $resolvedBuildDir "remote"
$remoteBundle = Join-Path $remoteRoot $BundleName

if ((-not (Test-Path -LiteralPath $localBundle)) -and (-not (Test-Path -LiteralPath $remoteBundle))) {
  throw "Local bundle not found: $localBundle"
}

if ((Test-Path -LiteralPath $localBundle) -and (Test-Path -LiteralPath $remoteBundle)) {
  Remove-Item -LiteralPath $remoteBundle -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $remoteRoot | Out-Null
if (Test-Path -LiteralPath $localBundle) {
  Move-Item -LiteralPath $localBundle -Destination $remoteBundle
}

$remoteBundleScript = Join-Path $remoteBundle "index.js"
$localBundleScriptDir = Join-Path $resolvedBuildDir "src\bundle-scripts\$BundleName"
$localBundleScript = Join-Path $localBundleScriptDir "index.js"
if (Test-Path -LiteralPath $remoteBundleScript) {
  New-Item -ItemType Directory -Force -Path $localBundleScriptDir | Out-Null
  Copy-Item -LiteralPath $remoteBundleScript -Destination $localBundleScript -Force
}

$gameJsPath = Join-Path $resolvedBuildDir "game.js"
if (Test-Path -LiteralPath $gameJsPath) {
  $gameJs = Get-Content -Raw -LiteralPath $gameJsPath
  $requireLine = "    require('./src/bundle-scripts/$BundleName/index.js');"
  $gameJs = $gameJs.Replace("$requireLine`r`n`r`n", "")
  $gameJs = $gameJs.Replace("$requireLine`n`n", "")
  $marker = '    require("src/system.bundle.js");'
  if ($gameJs.Contains($marker)) {
    $insert = "$marker`r`n`r`n$requireLine"
    $gameJs = $gameJs.Replace($marker, $insert)
    Set-Content -LiteralPath $gameJsPath -Value $gameJs -Encoding UTF8
  }
}

$projectConfigPath = Join-Path $resolvedBuildDir "project.config.json"
if (Test-Path -LiteralPath $projectConfigPath) {
  $projectConfig = Get-Content -Raw -LiteralPath $projectConfigPath | ConvertFrom-Json
  if (-not $projectConfig.PSObject.Properties["packOptions"]) {
    $projectConfig | Add-Member -MemberType NoteProperty -Name "packOptions" -Value ([PSCustomObject]@{ ignore = @() })
  }
  if (-not $projectConfig.packOptions.PSObject.Properties["ignore"]) {
    $projectConfig.packOptions | Add-Member -MemberType NoteProperty -Name "ignore" -Value @()
  }

  $hasRemoteIgnore = @($projectConfig.packOptions.ignore) | Where-Object {
    $_.type -eq "folder" -and $_.value -eq "remote"
  }
  if (-not $hasRemoteIgnore) {
    $projectConfig.packOptions.ignore = @($projectConfig.packOptions.ignore) + @(
      [PSCustomObject]@{ type = "folder"; value = "remote" }
    )
  }

  $projectConfig | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $projectConfigPath -Encoding UTF8
}

$mainPackageBytes = (
  Get-ChildItem -LiteralPath $resolvedBuildDir -Recurse -File |
  Where-Object { $_.FullName -notlike (Join-Path $remoteRoot "*") } |
  Measure-Object Length -Sum
).Sum

$remoteBytes = (
  Get-ChildItem -LiteralPath $remoteBundle -Recurse -File |
  Measure-Object Length -Sum
).Sum

[PSCustomObject]@{
  MainPackageMB = [math]::Round($mainPackageBytes / 1MB, 4)
  RemoteBundleMB = [math]::Round($remoteBytes / 1MB, 4)
  RemoteBundlePath = $remoteBundle
}
