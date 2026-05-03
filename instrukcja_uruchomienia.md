# Instrukcja Uruchomienia Monopoly (Cloudflare Tunnel)

Aby uruchomić grę z dostępem przez internet, wykonaj następujące kroki lub poproś mnie o ich wykonanie:

## 1. Serwery Lokalne
- **Backend:** `node server.js` (w folderze `backend`)
- **Frontend:** `npm run dev -- --host` (w folderze `frontend`)

## 2. Tunele Cloudflare
Należy uruchomić dwa tunele, aby wystawić porty do sieci:
- **Backend:** `npx cloudflared tunnel --url http://localhost:3001`
- **Frontend:** `npx cloudflared tunnel --url http://localhost:5173`

## 3. Aktualizacja Adresów (WAŻNE)
Po uruchomieniu tuneli, Cloudflare wygeneruje losowe adresy `xxxx.trycloudflare.com`. Należy:
1. Skopiować adres backendu i wkleić go do pliku `frontend/src/App.jsx` w linii z `io(...)`.
2. Upewnić się, że w `frontend/vite.config.js` w sekcji `allowedHosts` znajduje się wpis `'.trycloudflare.com'`.

## 4. Restart Frontendu
Po zmianie adresu w `App.jsx`, należy zrestartować proces `npm run dev`, aby zmiany weszły w życie.

---
*Instrukcja przygotowana przez Twojego asystenta AI.*
