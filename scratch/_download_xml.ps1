$ua = "Mir US Stocks mir-us-stocks@users.noreply.github.com"
$out = "C:\Users\user\OneDrive\바탕 화면\용선우\AI\Mir_US_Stocks\scratch\xml_cache"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$files = @{
  "berkshire.xml" = "https://www.sec.gov/Archives/edgar/data/1067983/000119312526226661/53405.xml"
  "bridgewater.xml" = "https://www.sec.gov/Archives/edgar/data/1350694/000135069426000002/infotable.xml"
  "citadel.xml" = "https://www.sec.gov/Archives/edgar/data/1423053/000110465926062477/infotable.xml"
  "renaissance.xml" = "https://www.sec.gov/Archives/edgar/data/1037389/000103738926000033/renaissance13Fq12026_holding.xml"
  "pershing.xml" = "https://www.sec.gov/Archives/edgar/data/1336528/000117266126002336/infotable.xml"
  "tiger.xml" = "https://www.sec.gov/Archives/edgar/data/1167483/000091957426003362/infotable.xml"
  "baupost.xml" = "https://www.sec.gov/Archives/edgar/data/1061768/000106176826000007/BGLLCQ12026.xml"
  "appaloosa.xml" = "https://www.sec.gov/Archives/edgar/data/1656456/000165645626000002/Form13FInfoTable.xml"
  "duquesne.xml" = "https://www.sec.gov/Archives/edgar/data/1536411/000153641126000004/form13f_20260331.xml"
  "scion.xml" = "https://www.sec.gov/Archives/edgar/data/1649339/000164933925000007/infotable.xml"
}

foreach ($kv in $files.GetEnumerator()) {
  $dest = Join-Path $out $kv.Key
  Write-Host "Downloading $($kv.Key)..."
  curl.exe -s -H "User-Agent: $ua" -H "Accept: text/xml,*/*" -o $dest $kv.Value
  if (Test-Path $dest) {
    $len = (Get-Item $dest).Length
    Write-Host "  saved $len bytes"
  } else {
    Write-Host "  FAILED"
  }
  Start-Sleep -Milliseconds 400
}