# Docs assets

## Screenshots

PNG files under `screenshots/` are embedded in the root README for Level 2 judges.

Regenerate (WSL + Windows Chrome + Vite on `:3000`):

```bash
# terminal 1
npm run dev

# terminal 2 — start headless Chrome with CDP, then:
cp docs/capture-screenshots.ps1 /mnt/c/Users/Public/tally-shots/
"/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" \
  --headless=new --disable-gpu --remote-debugging-port=9222 \
  --user-data-dir="C:\\Users\\Public\\tally-chrome-profile" \
  --window-size=1440,1100 "http://127.0.0.1:3000/" &
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\\Users\\Public\\tally-shots\\capture-screenshots.ps1"
cp /mnt/c/Users/Public/tally-shots/0*.png docs/screenshots/
```
