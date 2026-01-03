# Änderungen: Unified CLI und Auto-Update

## Übersicht

Diese Updates adressieren die folgenden Anforderungen:

1. ✅ **Kombination von start.sh und CLI** - Beide Skripte wurden in eine einheitliche TypeScript-basierte CLI kombiniert
2. ✅ **Verbessertes CLI-Erlebnis** - Navigation ist jetzt schneller, kein mehrfaches Enter-Drücken mehr zum Beenden
3. ✅ **Build-Fehlerbehandlung** - Bei Build-Fehlern wird abgebrochen und kein Server gestartet
4. ✅ **Auto-Update-Funktion** - Automatische Updates vom main-Branch, ein-/ausschaltbar im Dashboard und CLI
5. ✅ **Automatische Package-Installation** - Beim Hinzufügen von Packages wird automatisch `npm install` ausgeführt

## Neue Dateien

### `src/unified-cli.ts`
Die neue, vereinheitlichte CLI, die alle Funktionen von `start.sh` und `cli.ts` kombiniert:
- Server-Start mit optionaler Auto-Update-Prüfung
- Benutzerverwaltung
- System-Monitoring
- Build-Management
- Auto-Update-Konfiguration
- Netzwerk-Speedtest-Verwaltung

**Vorteile:**
- Einfachere Navigation mit Pfeil- oder Zahlentasten
- Sofortiges Beenden mit der Auswahloption, kein mehrfaches Enter mehr
- Alle Funktionen an einem Ort
- Schnellere Ausführung (keine Shell-Skript-Overhead)

### `src/services/settings.service.ts`
Neuer Service für System-Einstellungen:
- Verwaltet Auto-Update-Einstellung in SQLite-Datenbank
- Stellt sicheren Zugriff auf Konfiguration bereit
- Automatische Initialisierung mit Standardwerten

## Geänderte Dateien

### `start.sh` (Vereinfacht)
- Jetzt nur noch ein einfacher Wrapper, der die unified CLI aufruft
- Baut das Projekt falls nötig
- Startet `node dist/unified-cli.js`

### `package.json`
- `manage` Skript aktualisiert: `tsc && node dist/unified-cli.js`
- Keine Abhängigkeit mehr von Shell-Skripten

### `src/index.ts`
Neue API-Endpunkte hinzugefügt:
- `GET /api/settings` - Aktuelle System-Einstellungen abrufen
- `POST /api/settings/auto-update` - Auto-Update ein-/ausschalten

### Frontend-Änderungen

#### `frontend/src/app/services/api.ts`
Neue Methoden:
- `getSettings()` - Einstellungen vom Server abrufen
- `toggleAutoUpdate(enabled)` - Auto-Update-Status ändern

#### `frontend/src/app/pages/dashboard/dashboard.html`
- Neuer Toggle-Switch für Auto-Update in der System-Info-Karte
- Visuelles Feedback für aktivierte/deaktivierte Auto-Updates

#### `frontend/src/app/pages/dashboard/dashboard.ts`
- `autoUpdateEnabled` Property
- `loadSettings()` Methode
- `toggleAutoUpdate()` Methode

#### `frontend/src/app/pages/dashboard/dashboard.scss`
- Styling für Toggle-Switch
- Responsive Design für mobile Geräte

## Funktionsweise

### Auto-Update-Funktion

1. **Aktivierung:**
   - Im Dashboard: Toggle-Switch in der System-Info-Karte
   - In der CLI: "Build & Update" → "Toggle Auto-Update"

2. **Beim Server-Start:**
   - Wenn aktiviert: Prüft auf neue Commits im main-Branch
   - Bei Updates: Führt `git pull` aus
   - Erkennt Änderungen in `package.json`
   - Führt automatisch `npm install` aus
   - Baut Backend und Frontend neu
   - Bei Build-Fehlern: Bricht ab, Server startet nicht

3. **Manuelle Updates:**
   - Weiterhin möglich über CLI-Menü
   - Option "Pull Updates Only" für Update ohne Server-Start

### Build-Fehlerbehandlung

Alle Build-Schritte prüfen jetzt auf Fehler:
```typescript
if (!(await buildBackend())) {
  process.exit(1);  // Bricht ab, startet keinen Server
}
```

Dies gilt für:
- TypeScript Backend-Build
- Angular Frontend-Build
- npm install Operationen

### CLI-Navigation

**Vorher (start.sh):**
- Menü-Navigation mit Pfeiltasten
- Beim Beenden: 4x Enter drücken nötig
- Getrennte CLIs für verschiedene Aufgaben

**Nachher (unified-cli.ts):**
- Menü-Navigation mit Pfeiltasten oder Zahlentasten (1-9)
- Beim Beenden: 1x Auswahl, 1x Enter
- Alle Funktionen in einem CLI
- Zurück-Navigation in Untermenüs

## Verwendung

### Server starten
```bash
./start.sh
```

Wähle eine Option:
- **🚀 Start Server (with auto-update check)** - Empfohlen
- **▶️ Start Server (skip update check)** - Für schnellen Start
- **👤 User Management** - Benutzer verwalten
- **⚙️ System & Sessions** - System überwachen
- **🌐 Network Speedtest** - Netzwerk-Tests
- **🔧 Build & Update** - Build & Auto-Update verwalten
- **🚪 Exit** - Beenden

### Management CLI direkt starten
```bash
npm run manage
```

### Auto-Update aktivieren

**Via CLI:**
1. `./start.sh` oder `npm run manage`
2. Wähle "🔧 Build & Update"
3. Wähle "🔄 Toggle Auto-Update"
4. Bestätige mit "y"

**Via Dashboard:**
1. Öffne Dashboard im Browser
2. Scrolle zur "System Info" Karte
3. Aktiviere den "🔄 Auto-Update" Toggle-Switch

## Technische Details

### Datenbank

Neue Tabelle `system_settings`:
```sql
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

Standardwert für `autoUpdate`: `false`

### Git-Integration

Der Auto-Update-Prozess:
1. `git fetch origin main`
2. Prüfe Anzahl neuer Commits
3. Bei lokalen Änderungen: Erstelle Backup-Branch
4. `git pull origin main`
5. Zeige Diff-Statistiken an
6. Prüfe auf `package.json` Änderungen
7. Führe `npm install` bei Bedarf aus
8. Baue Backend und Frontend

### Fehlerbehandlung

Alle kritischen Operationen haben Fehlerbehandlung:
- Git-Operationen
- npm-Befehle
- Build-Prozesse
- API-Aufrufe

Bei Fehlern:
- Farbige Konsolenausgabe (rot für Fehler)
- Klare Fehlermeldungen
- Abbruch des Prozesses
- Kein Server-Start bei Build-Fehlern

## Kompatibilität

- ✅ Rückwärtskompatibel mit bestehendem Setup
- ✅ Bestehendes `cli.ts` bleibt funktionsfähig (deprecated)
- ✅ Alle alten API-Endpunkte funktionieren weiterhin
- ✅ Keine Breaking Changes für Frontend
- ✅ start.sh führt weiterhin zum gleichen Ergebnis

## Migration

Keine Migrations-Schritte erforderlich! Das System:
- Erstellt automatisch neue Datenbank-Tabellen
- Initialisiert Einstellungen mit Standardwerten
- Funktioniert sofort nach `git pull`

## Testing

Alle Features wurden getestet:
- ✅ TypeScript-Kompilierung erfolgreich
- ✅ Settings Service funktioniert
- ✅ Unified CLI startet
- ✅ API-Endpunkte verfügbar
- ✅ Frontend-Build erfolgreich

## Bekannte Einschränkungen

- Auto-Update funktioniert nur mit main-Branch
- Erfordert git-Repository (keine ZIP-Downloads)
- Frontend-Build benötigt Node.js und npm im frontend/ Verzeichnis
- speedtest-cli muss manuell installiert werden (wie bisher)

## Zukünftige Verbesserungen

Mögliche Erweiterungen:
- [ ] Update-Zeitplan (cron-ähnlich)
- [ ] Update-Benachrichtigungen im Dashboard
- [ ] Rollback-Funktion bei fehlgeschlagenen Updates
- [ ] Branch-Auswahl für Updates
- [ ] Pre/Post-Update Hooks
