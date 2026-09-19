# Fahrzeugakte

Eine Web-App zur Verwaltung mehrerer Fahrzeuge: Garage, Logbuch, Dokumente und
Teile. Kein Build-Schritt, keine Abhängigkeiten, kein Server, kein Konto.

## Deine Daten bleiben bei dir

Die App lädt **nichts** hoch. Alle Fahrzeugdaten, Fotos und Dokumente liegen
ausschließlich im Speicher deines Browsers auf deinem Gerät. In diesem
Repository liegt nur der Programmcode.

Daraus folgen zwei Dinge:

- Die Daten sind **nicht** zwischen Geräten synchronisiert. Was du auf dem Handy
  erfasst, steht nicht auf dem Laptop.
- Es gibt **kein** automatisches Backup. Löschst du die Website-Daten im Browser
  oder deinstallierst die App vom Homescreen, sind die Einträge weg. Nutze
  regelmäßig die Sicherung (siehe unten).

Niemals Fotos, Fahrzeugpapiere oder Rechnungen ins Repository committen.

## Funktionen

- **Garage** – Übersicht aller Fahrzeuge als Karten, mit Warnbanner für
  abgelaufenen oder bald fälligen TÜV.
- **Fahrzeugkarte** – Titelbild, Kennzeichen, Kilometerstand, Leistung, Hubraum,
  Baujahr, Kraftstoff, TÜV-Datum und eine Kostenübersicht.
- **Logbuch** – Reparaturen, Wartungen und Umbauten mit Datum, Kilometerstand,
  Kategorie und Kosten.
- **Dokumente** – Fahrzeugpapiere, TÜV-Berichte, Versicherung und Rechnungen als
  Foto (Kamera-Scan) oder PDF, nach Kategorie gruppiert.
- **Teile** – gekaufte Teile mit Kategorie, Status (verbaut / auf Lager /
  bestellt), Preis, Händler und Teilenummer.
- **TÜV-Erinnerung** – Export eines `.ics`-Termins mit Erinnerungen 30 und
  7 Tage vor Ablauf.
- **Offline** – als Homescreen-App ohne Netz nutzbar.

## Speicherung

Die App sucht sich beim Start das beste verfügbare Backend:

| Reihenfolge | Backend | Wann |
| --- | --- | --- |
| 1 | `window.storage` | Claude-Artifact-Umgebung |
| 2 | IndexedDB | normaler Browser (der Regelfall) |
| 3 | `localStorage` | Notnagel, wenn IndexedDB blockiert ist |
| 4 | Arbeitsspeicher | letzter Ausweg, Daten gehen beim Schließen verloren |

Läuft die App im Arbeitsspeicher, weist sie im Interface ausdrücklich darauf hin.

IndexedDB statt `localStorage`, weil Bilder als Data-URL dessen ~5-MB-Grenze
schnell sprengen. Bilder werden vor dem Speichern auf max. 1200 px (Titelbild)
bzw. 1600 px (Dokumente) verkleinert und als JPEG abgelegt; PDFs sind auf
3,5 MB begrenzt. Zusätzlich fragt die App per `navigator.storage.persist()` eine
dauerhafte Ablage an, damit der Browser die Akte bei Platzmangel nicht räumt.

## Sicherung

In der Garage liegen unten zwei Schaltflächen:

- **Sicherung speichern** – schreibt die komplette Akte in eine Datei
  `fahrzeugakte-sicherung-JJJJ-MM-TT.json`. Darin stecken alle Fahrzeuge,
  Logbuch-Einträge, Teile, Dokumente **und** die Bilder selbst (als Data-URL
  eingebettet). Die Datei ist damit alles, was du zum Wiederherstellen brauchst.
- **Sicherung einlesen** – zeigt erst, was in der Datei steckt, und fragt dann:
  - *Zusammenführen* behält die vorhandenen Fahrzeuge und überschreibt nur die,
    deren Kennung auch in der Sicherung vorkommt. Es entstehen keine Duplikate.
  - *Alles ersetzen* verwirft zuerst die gesamte Garage. Diese Schaltfläche
    fragt zur Sicherheit ein zweites Mal nach.

Weil die Bilder mitgeschrieben werden, kann die Datei groß werden — bei vielen
eingescannten Dokumenten schnell etliche MB. Das ist gewollt: eine Sicherung
ohne Bilder wäre nur eine halbe Sicherung.

Das ist zugleich der einzige Weg, die Akte von einem Gerät auf ein anderes zu
bringen, denn es gibt keine Synchronisation.

## Lokal ausprobieren

Die Datei direkt per Doppelklick zu öffnen (`file://`) funktioniert, aber ohne
Service Worker. Besser ein kleiner Server:

```sh
python3 -m http.server 8765
# dann http://localhost:8765/ aufrufen
```

## Aufbau

| Datei | Zweck |
| --- | --- |
| `index.html` | die gesamte App: Markup, Styles und Logik |
| `manifest.webmanifest` | Name, Farben und Icons der installierbaren App |
| `sw.js` | Service Worker für den Offline-Betrieb |
| `icons/` | App-Icons (192, 512 und Apple-Touch-Icon) |
| `.github/workflows/checks.yml` | prüft bei jedem Pull Request Syntax und Dateien |

### Nach jeder Änderung an der App

In `sw.js` die Konstante `CACHE` hochzählen (`fahrzeugakte-v1` →
`fahrzeugakte-v2`). Sonst liefert der Service Worker bei manchen Aufrufen
weiterhin die alte Fassung aus dem Cache aus.

## Einrichtung auf GitHub

Einmalig im Repository unter **Settings** zu erledigen:

1. **Default-Branch** – `General` → `Default branch` → auf `main` umstellen.
2. **GitHub Pages** – `Pages` → Source `Deploy from a branch`, Branch `main`,
   Ordner `/ (root)`. Nach ein bis zwei Minuten liegt die App unter
   `https://maddin2012.github.io/CarCollection/`.
3. **Ruleset** – `Rules` → `Rulesets` → `New branch ruleset`:
   - Name z. B. `main schützen`, Enforcement status `Active`
   - Target branches → `Include default branch`
   - Haken bei `Restrict deletions`, `Block force pushes` und
     `Require a pull request before merging` (Required approvals: 0)
   - Haken bei `Require status checks to pass` → `Syntax und Dateien prüfen`
     hinzufügen (erscheint in der Liste, sobald der Workflow einmal gelaufen ist)
4. **Aufräumen** – `General` → `Features`: Wikis, Projects und ggf. Issues
   abschalten, wenn du sie nicht brauchst.
5. **Push protection** – `Advanced Security` → `Push protection` aktivieren.

## Auf dem iPhone installieren

Pages-URL in **Safari** öffnen (nicht Chrome) → Teilen-Symbol → *Zum Home-Bildschirm*.
Danach startet die Fahrzeugakte im Vollbild und funktioniert offline.
