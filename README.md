# CarCollection

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
- **Fahrzeugkarte** – Titelbild, Kilometerstand, Baujahr, TÜV-Datum, FIN, HSN
  und TSN sowie eine Kostenübersicht. Die übrigen Felder (Leistung, Hubraum,
  Kraftstoff) bleiben in der Bearbeiten-Maske erfassbar.
- **Logbuch** – Reparaturen, Wartungen und Umbauten mit Datum, Kilometerstand,
  Kategorie und Kosten.
- **Dokumente** – Fahrzeugpapiere, TÜV-Berichte, Versicherung und Rechnungen als
  Foto (Kamera-Scan) oder PDF, nach Kategorie gruppiert.
- **Teile** – gekaufte Teile mit Kategorie, Status (verbaut / auf Lager /
  bestellt), Preis, Händler und Teilenummer.
- **TÜV-Erinnerung** – Export eines `.ics`-Termins mit Erinnerungen 30 und
  7 Tage vor Ablauf.
- **Zurück-Geste** – die Zurück-Geste des Handys geht einen Schritt zurück,
  statt die App zu schließen: offenes Sheet oder Vollbild zu, sonst zurück in
  die Garage. Der zuletzt gezeigte Reiter übersteht ein Neuladen.
- **Einstellungen** – hinter dem Zahnrad oben rechts in der Garage: Sicherung
  speichern und einlesen, die laufende Fassung und die Update-Prüfung.
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

In den **Einstellungen** (Zahnrad oben rechts in der Garage) liegen zwei
Schaltflächen:

- **Sicherung speichern** – schreibt die komplette Akte in eine Datei
  `carcollection-sicherung-JJJJ-MM-TT.json`. Darin stecken alle Fahrzeuge,
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

### Wo die Datei landet

Bietet der Browser das Teilen-Blatt für Dateien an — auf dem Handy ist das der
Normalfall —, öffnet es sich beim Speichern. Von dort führt der Weg direkt nach
Drive: **Drive wählen → Ordner `Car Collection / Sicherung`**. So liegt die
Sicherung nicht nur auf dem Gerät, auf dem sie entstanden ist.

Eine automatische Ablage in Drive ist bewusst nicht eingebaut: Sie ginge aus
einer Web-App auf Android gar nicht (die dafür nötige File System Access API
gibt es nur im Chrome auf dem Rechner), und eine echte Drive-Anbindung würde
Fahrzeugdaten an Google senden. Das widerspräche dem Grundsatz oben.

Auf dem Rechner gibt es kein Teilen-Blatt für Dateien; dort wird wie gewohnt
heruntergeladen.

## Updates

Die Einstellungen zeigen unter **Updates** die laufende Fassung. Beim Start
sieht die App still nach, ob auf dem Server eine neuere ausliegt — sie meldet
sich nur, wenn es etwas gibt, und dann als Hinweis oben in der Garage. Der
Knopf **Nach Updates suchen** macht dieselbe Prüfung auf Verlangen und sagt
auch, wenn alles aktuell ist oder die Verbindung fehlt.

Gefunden wird das über `version.json` im Repository. Die Datei wird bewusst nie
aus dem Cache beantwortet, sonst meldete die App auf ewig die Fassung von
vorgestern. Liegt eine neuere bereit, lädt der Service Worker sie im
Hintergrund; sichtbar wird sie, nachdem die App einmal geschlossen und neu
geöffnet wurde.

## Tests

```sh
npm ci      # einmalig
npm test
```

Die Tests starten einen eigenen Webserver und fahren ein echtes Chromium gegen
die App — drei Reihen:

| Reihe | Prüft |
| --- | --- |
| `grundfunktionen` | Speicherung in IndexedDB, Überleben von Neuladen und neuem Tab, Manifest, Icons, Service Worker, Offline-Betrieb |
| `sicherung` | Export, vollständiges Leeren des Speichers, Wiedereinlesen samt Bildern, Zusammenführen ohne Duplikate, Abweisen fremder Dateien |
| `plattformen` | beide Plattform-Pfade, indem Safaris Eigenheiten im Chromium nachgestellt werden |

Die Plattform-Reihe ersetzt **keinen** Test auf echter Apple-Hardware. Belegt
ist damit, dass die Weichen greifen — nicht, dass Safari sich dahinter
erwartungsgemäß verhält.

Steht ein vorinstalliertes Chromium ausserhalb von Playwrights eigener Ablage,
den Pfad mitgeben: `CHROMIUM_PATH=/pfad/zu/chrome npm test`

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
| `version.json` | die ausgelieferte Fassung, für die Update-Prüfung |
| `icons/` | App-Icons (192, 512 und Apple-Touch-Icon) |
| `tests/` | Browser-Tests, die die App wirklich bedienen |
| `.github/workflows/checks.yml` | prüft bei jedem Pull Request Syntax, Dateien und Verhalten |

### Nach jeder Änderung an der App

Die Fassung an drei Stellen hochzählen — sie müssen dieselbe Zahl tragen:
`CACHE` in `sw.js`, `APP_VERSION` in `index.html` und `version.json`. Bleibt
`CACHE` stehen, liefert der Service Worker bei manchen Aufrufen weiterhin die
alte Fassung aus; bleibt eine der anderen stehen, meldet die App entweder ewig
ein Update oder verschweigt eines. Die CI vergleicht die drei Zahlen.

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

## Auf dem Handy installieren

**Android** (getestet auf Pixel 8 Pro): Pages-URL in Chrome öffnen → Menü →
*App installieren*. Chrome bietet die Installation meist auch von selbst an.

**iPhone / iPad**: Pages-URL in **Safari** öffnen (nicht Chrome, dort fehlt der
Menüpunkt) → Teilen-Symbol → *Zum Home-Bildschirm*.

Auf dem iPhone ist das Hinzufügen zum Home-Bildschirm nicht nur Bequemlichkeit,
sondern Pflicht: Safari räumt den Speicher einer nur im Browser besuchten Seite
nach sieben Tagen ohne Besuch ab. Für Web-Apps auf dem Home-Bildschirm gilt das
nicht. Also installieren — oder regelmäßig sichern.

## Plattform-Unterschiede

Beides ist im Code berücksichtigt:

| Thema | Android / Chrome | iOS / Safari |
| --- | --- | --- |
| TÜV-Monat | natives Monatsfeld | zwei Auswahlfelder, weil Safari `input[type=month]` nicht kennt |
| Dateien ausgeben | Teilen-Blatt, Download als Rückfallebene | Teilen-Blatt; `<a download>` kann im Startbildschirm-Modus still scheitern |
| PDF ansehen | Blob-Verweis | Blob-Verweis; `data:`-Verweise öffnet iOS nicht |
| Speicher | IndexedDB, dauerhaft angefragt | IndexedDB; `persist()` fehlt, dafür schützt der Home-Bildschirm |

Die Erkennung läuft über Funktionsprüfung, nicht über die Browserkennung — es
wird also nichts anhand des Gerätenamens geraten.
