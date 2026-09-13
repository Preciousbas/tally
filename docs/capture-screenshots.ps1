# Capture Tally desk screenshots via Chrome CDP (run from WSL via powershell.exe)
$ErrorActionPreference = 'Stop'
$shots = 'C:\Users\Public\tally-shots'
New-Item -ItemType Directory -Force -Path $shots | Out-Null

function Get-Json($url) {
  return (Invoke-WebRequest -UseBasicParsing $url).Content | ConvertFrom-Json
}

$pages = Get-Json 'http://127.0.0.1:9222/json'
$page = $pages | Where-Object { $_.type -eq 'page' -and $_.url -like '*3000*' } | Select-Object -First 1
if (-not $page) { throw 'Tally page not found on CDP' }
$wsUrl = $page.webSocketDebuggerUrl

Add-Type -AssemblyName System.Net.Http
$ws = New-Object System.Net.WebSockets.ClientWebSocket
$ct = [System.Threading.CancellationToken]::None
$uri = [Uri]$wsUrl
$ws.ConnectAsync($uri, $ct).Wait()

$id = 0
function Send-Cdp($method, $params) {
  $script:id++
  $obj = @{ id = $script:id; method = $method }
  if ($null -ne $params) { $obj.params = $params }
  $json = ($obj | ConvertTo-Json -Depth 20 -Compress)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
  $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()

  # Read until matching id
  $buffer = New-Object byte[] 1048576
  while ($true) {
    $ms = New-Object System.IO.MemoryStream
    do {
      $segR = New-Object System.ArraySegment[byte] -ArgumentList @(,$buffer)
      $result = $ws.ReceiveAsync($segR, $ct).Result
      $ms.Write($buffer, 0, $result.Count)
    } while (-not $result.EndOfMessage)
    $text = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
    $resp = $text | ConvertFrom-Json
    if ($resp.id -eq $script:id) { return $resp }
  }
}

function Eval-Js($expression) {
  $r = Send-Cdp 'Runtime.evaluate' @{
    expression = $expression
    awaitPromise = $true
    returnByValue = $true
  }
  if ($r.result.exceptionDetails) {
    throw ($r.result.exceptionDetails | ConvertTo-Json -Depth 5)
  }
  return $r.result.result
}

function Shot($name) {
  $r = Send-Cdp 'Page.captureScreenshot' @{ format = 'png'; fromSurface = $true }
  $bytes = [Convert]::FromBase64String($r.result.data)
  [IO.File]::WriteAllBytes((Join-Path $shots $name), $bytes)
  Write-Host "wrote $name"
}

Send-Cdp 'Page.enable' $null | Out-Null
Send-Cdp 'Runtime.enable' $null | Out-Null
Start-Sleep -Milliseconds 500

Shot '01-connect.png'

Eval-Js @"
(() => {
  const click = (t) => {
    const el = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t);
    if (!el) throw new Error('missing button ' + t);
    el.click();
  };
  click('Local desk');
  const amount = document.querySelector('input[placeholder=\"how much\"]');
  const due = document.querySelector('input[placeholder=\"30\"]');
  const set = (el, v) => {
    const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    d.set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  set(amount, '50');
  set(due, '30');
  return 'ok';
})()
"@ | Out-Null
Start-Sleep -Milliseconds 500
Shot '02-offer.png'

Eval-Js @"
(() => {
  const click = (t) => {
    const el = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t);
    if (!el) throw new Error('missing button ' + t);
    el.click();
  };
  click('Offer');
  return 'offered';
})()
"@ | Out-Null
Start-Sleep -Milliseconds 800
Shot '03-instrument.png'

Eval-Js @"
(async () => {
  const click = (t) => {
    const el = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t);
    if (!el) throw new Error('missing button ' + t);
    el.click();
  };
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  click('Borrower'); await wait(300);
  click('Accept'); await wait(500);
  click('Lender'); await wait(300);
  click('Disburse'); await wait(500);
  click('Borrower'); await wait(300);
  click('Repay'); await wait(500);
  click('Settle'); await wait(700);
  click('Prove standing'); await wait(900);
  click('Verifier'); await wait(400);
  click('Verify access'); await wait(700);
  return document.body.innerText.includes('Pass') ? 'pass' : 'done';
})()
"@ | Out-Null
Start-Sleep -Milliseconds 400
Shot '04-standing.png'

$ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, 'done', $ct).Wait()
Write-Host 'done'
