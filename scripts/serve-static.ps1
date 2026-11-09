param([int]$Port = 8766)
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../web'))
$rootPrefix = $root + [IO.Path]::DirectorySeparatorChar
$listener = [Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
try {
  $listener.Start()
  Write-Host "온플랜 HTML 버전: http://127.0.0.1:$Port/"
  Write-Host '종료: Ctrl+C. 데이터는 Supabase에 보존됩니다.'
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $relative = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath).TrimStart('/')
      if (!$relative) { $relative = 'index.html' }
      $file = [IO.Path]::GetFullPath((Join-Path $root $relative))
      if (!$file.StartsWith($rootPrefix,[StringComparison]::OrdinalIgnoreCase) -or !(Test-Path -LiteralPath $file -PathType Leaf)) { $context.Response.StatusCode=404; continue }
      $context.Response.Headers.Add('Referrer-Policy','no-referrer')
      $context.Response.Headers.Add('X-Content-Type-Options','nosniff')
      $context.Response.Headers.Add('Cache-Control','no-store')
      $context.Response.ContentType = switch ([IO.Path]::GetExtension($file)) { '.html' {'text/html; charset=utf-8'} '.js' {'text/javascript; charset=utf-8'} '.css' {'text/css; charset=utf-8'} '.ttf' {'font/ttf'} default {'application/octet-stream'} }
      $bytes=[IO.File]::ReadAllBytes($file);$context.Response.ContentLength64=$bytes.Length;$context.Response.OutputStream.Write($bytes,0,$bytes.Length)
    } catch { $context.Response.StatusCode=500 } finally { $context.Response.Close() }
  }
} finally { $listener.Close() }

