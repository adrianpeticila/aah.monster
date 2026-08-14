# Deploy Fix: aah.monster daemon + mcp — design 1:1 (verificat Cline, 14 aug 2026)
# Agent executor: Antigravity. Single repo scope: /Users/pc/repos/aah.monster

## 0. PRE-DEPLOY — confirmă pe disc
- Backup-uri există: `daemon/index.html.bak` + `mcp/index.html.bak`
- Niciun em-dash: `grep -n '—' daemon/index.html mcp/index.html` → zero
- Stare repo curată (doar daemon/ + mcp/ + sitemap modificate):
  `cd /Users/pc/repos/aah.monster && git status --short`

## 1. COMMIT + PUSH
```
cd /Users/pc/repos/aah.monster
git add daemon/index.html mcp/index.html sitemap.xml
git status                    # confirm: daemon/index.html, mcp/index.html, sitemap.xml (only)
git commit -m "fix(design): rebuild daemon and mcp pages 1:1 with aah.monster visual identity, add Sprite Graffiti + Sono + dark mode + full footer"
git push origin main
```

## 2. VERIFICARE LIVE
https://aah.monster/daemon/   -> sec-words "async positioning engine." + Sprite Graffiti + dark toggle
https://aah.monster/mcp/      -> workbench audit_b2b_positioning + aceleași elemente de design

## 3. RAPORT DE ÎNTOARCERE
- Confirmare commit hash pe origin/main
- Confirmation: HTTP 200 pe ambele URL-uri
- Niciun alt fișier atins (stare `git status` finală curată)
