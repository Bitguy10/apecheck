# ─────────────────────────────────────────────────────────────
# ApeCheck — placeholder asset generator (Windows / System.Drawing)
#
# Produces the PNGs referenced by app.json:
#   assets/icon.png             1024x1024  app icon (full-bleed dark)
#   assets/adaptive-icon.png    1024x1024  Android foreground (transparent)
#   assets/splash.png           1284x1284  splash mark + wordmark
#   assets/notification-icon.png  96x96    white silhouette (Android tints it)
#   assets/favicon.png           48x48     web favicon
#
# These are intentionally simple, on-brand placeholders (the ApeCheck risk gauge:
# red -> amber -> green arc with a needle pointing at "safe"). Replace with real
# artwork before store submission. Re-run:  powershell -File scripts/generate-icons.ps1
# ─────────────────────────────────────────────────────────────

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$assets = Join-Path $PSScriptRoot '..\assets'
if (-not (Test-Path $assets)) { New-Item -ItemType Directory -Path $assets | Out-Null }

# Brand palette
$JUNGLE = [System.Drawing.ColorTranslator]::FromHtml('#0D0F0C')
$PANEL  = [System.Drawing.ColorTranslator]::FromHtml('#141A10')
$RED    = [System.Drawing.ColorTranslator]::FromHtml('#FF3B5C')
$AMBER  = [System.Drawing.ColorTranslator]::FromHtml('#FFB020')
$GREEN  = [System.Drawing.ColorTranslator]::FromHtml('#14F195')
$BANANA = [System.Drawing.ColorTranslator]::FromHtml('#FFE14D')
$WHITE  = [System.Drawing.Color]::White

function New-RoundedPath([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

# Draws the gauge mark (arc + needle) centered in a size x size box, scaled by $scale (0..1 of box).
function Draw-Gauge([System.Drawing.Graphics]$g, [single]$size, [System.Drawing.Color]$mono, [bool]$useMono) {
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  $r  = $size * 0.34
  $cx = $size / 2.0
  $cy = $size * 0.60           # flat baseline of the semicircle
  $box = New-Object System.Drawing.RectangleF(($cx - $r), ($cy - $r), ($r * 2), ($r * 2))
  $thick = $size * 0.075

  # Track (dark) behind the colored arc
  $trackPen = New-Object System.Drawing.Pen($PANEL, ($thick * 1.25))
  $trackPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $trackPen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawArc($trackPen, $box, 180, 180)

  if ($useMono) {
    $pen = New-Object System.Drawing.Pen($mono, $thick)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawArc($pen, $box, 180, 180)
  } else {
    # Three risk segments: red (left/high-risk) -> amber -> green (right/safe)
    $segs = @(@(180, $RED), @(240, $AMBER), @(300, $GREEN))
    foreach ($s in $segs) {
      $pen = New-Object System.Drawing.Pen($s[1], $thick)
      $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
      $pen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
      $g.DrawArc($pen, $box, [single]$s[0], 62)
      $pen.Dispose()
    }
  }

  # Needle pointing up-right toward the green ("safe") zone
  $needleColor = if ($useMono) { $mono } else { $GREEN }
  $ang = 33.0 * [Math]::PI / 180.0                # above horizontal, to the right
  $len = $r * 0.86
  $nx = $cx + $len * [Math]::Cos($ang)
  $ny = $cy - $len * [Math]::Sin($ang)
  $nPen = New-Object System.Drawing.Pen($needleColor, ($size * 0.028))
  $nPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $nPen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($nPen, $cx, $cy, [single]$nx, [single]$ny)

  # Hub
  $hubR = $size * 0.045
  $hubBrush = New-Object System.Drawing.SolidBrush($needleColor)
  $g.FillEllipse($hubBrush, ($cx - $hubR), ($cy - $hubR), ($hubR * 2), ($hubR * 2))

  $trackPen.Dispose(); $nPen.Dispose(); $hubBrush.Dispose()
}

function Draw-CenteredText([System.Drawing.Graphics]$g, [string]$text, [System.Drawing.Font]$font, [System.Drawing.Color]$color, [single]$cx, [single]$cy) {
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $brush = New-Object System.Drawing.SolidBrush($color)
  $g.DrawString($text, $font, $brush, (New-Object System.Drawing.PointF($cx, $cy)), $sf)
  $brush.Dispose(); $sf.Dispose()
}

function Save-Png([System.Drawing.Bitmap]$bmp, [string]$name) {
  $path = Join-Path $assets $name
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "  wrote $name  ($($bmp.Width)x$($bmp.Height))"
}

# ── icon.png (full-bleed dark, rounded is handled by the OS mask) ────────────
$icon = New-Object System.Drawing.Bitmap(1024, 1024)
$g = [System.Drawing.Graphics]::FromImage($icon)
$g.Clear($JUNGLE)
Draw-Gauge $g 1024 $GREEN $false
$fontBig = New-Object System.Drawing.Font('Segoe UI', 92, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
Draw-CenteredText $g 'ApeCheck' $fontBig $WHITE 512 760
$fontSub = New-Object System.Drawing.Font('Consolas', 34, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
Draw-CenteredText $g 'scan before you ape' $fontSub $GREEN 512 830
$g.Dispose()
Save-Png $icon 'icon.png'
$icon.Dispose()

# ── adaptive-icon.png (transparent foreground; Android applies bg + mask) ────
# app.json sets adaptiveIcon.backgroundColor, so foreground is just the mark.
$adaptive = New-Object System.Drawing.Bitmap(1024, 1024)
$g = [System.Drawing.Graphics]::FromImage($adaptive)
$g.Clear([System.Drawing.Color]::Transparent)
# Android crops ~25% around the safe zone; draw the mark smaller & centered.
$g.TranslateTransform(160, 120)
$g.ScaleTransform(0.68, 0.68)
Draw-Gauge $g 1024 $GREEN $false
Draw-CenteredText $g 'ApeCheck' $fontBig $WHITE 512 760
$g.Dispose()
Save-Png $adaptive 'adaptive-icon.png'
$adaptive.Dispose()

# ── splash.png (dark bg + big mark + wordmark) ──────────────────────────────
$splash = New-Object System.Drawing.Bitmap(1284, 1284)
$g = [System.Drawing.Graphics]::FromImage($splash)
$g.Clear($JUNGLE)
$g.TranslateTransform(292, 210)
Draw-Gauge $g 700 $GREEN $false
$g.ResetTransform()
$fontWord = New-Object System.Drawing.Font('Segoe UI', 120, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
Draw-CenteredText $g 'ApeCheck' $fontWord $WHITE 642 920
$fontTag = New-Object System.Drawing.Font('Consolas', 40, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
Draw-CenteredText $g "don't get rugged." $fontTag $GREEN 642 1010
$g.Dispose()
Save-Png $splash 'splash.png'
$splash.Dispose()

# ── notification-icon.png (96x96, white on transparent; Android tints) ──────
$notif = New-Object System.Drawing.Bitmap(96, 96)
$g = [System.Drawing.Graphics]::FromImage($notif)
$g.Clear([System.Drawing.Color]::Transparent)
Draw-Gauge $g 96 $WHITE $true
$g.Dispose()
Save-Png $notif 'notification-icon.png'
$notif.Dispose()

# ── favicon.png (48x48 for web) ─────────────────────────────────────────────
$fav = New-Object System.Drawing.Bitmap(48, 48)
$g = [System.Drawing.Graphics]::FromImage($fav)
$g.Clear($JUNGLE)
Draw-Gauge $g 48 $GREEN $false
$g.Dispose()
Save-Png $fav 'favicon.png'
$fav.Dispose()

$fontBig.Dispose(); $fontSub.Dispose(); $fontWord.Dispose(); $fontTag.Dispose()
Write-Host 'Done. Placeholder assets generated in apps/mobile/assets/.'
