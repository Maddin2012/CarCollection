# Hinweise für Claude

## Grundregel: keine Vermutungen

Behaupte nichts, was du nicht geprüft hast.

- Ein Haken, ein „erledigt" oder ein „funktioniert" bedeutet: **nachgesehen und
  das Ergebnis gesehen**. Nicht „müsste so sein", nicht „wurde mir gesagt".
- „Getestet" heißt: Der Test ist gelaufen und die Ausgabe lag vor. Ein Test,
  den du geschrieben, aber nicht ausgeführt hast, ist kein Beleg.
- Kannst du etwas nicht prüfen — fehlender Zugriff, gesperrtes Netz, nur auf
  dem Gerät des Nutzers sichtbar —, dann **schreibe genau das hin**, statt es
  zu überspringen oder zu beschönigen.
- Im Zweifel erst prüfen, dann antworten.
- Stellst du später fest, dass eine Aussage falsch war, sag es von dir aus.

Diese Regel wiegt schwerer als eine schnelle Antwort.

## Das Projekt

Die Fahrzeugakte ist eine Single-File-Web-App: `index.html` enthält Markup,
Styles und die gesamte Logik. Kein Build, keine Abhängigkeiten, kein Server.
Beschreibung der Funktionen und der Einrichtung steht in `README.md`.

Die App wird über GitHub Pages aus `main` ausgeliefert:
`https://maddin2012.github.io/CarCollection/`

## Feste Punkte

**Daten gehören dem Nutzer und verlassen das Gerät nicht.** Fahrzeugdaten,
Fotos und Dokumente liegen ausschließlich im Browserspeicher. Niemals Fotos,
Fahrzeugpapiere oder Rechnungen ins Repository committen. Keine Funktion
einbauen, die Nutzerdaten irgendwohin überträgt, ohne das vorher zu besprechen.

**Nach jeder Änderung an ausgelieferten Dateien `CACHE` in `sw.js` hochzählen**
(`fahrzeugakte-v3` → `fahrzeugakte-v4`). Sonst liefert der Service Worker bei
manchen Aufrufen weiter die alte Fassung aus dem Cache aus.

**Plattform-Weichen über Funktionsprüfung, nie über die Browserkennung.** Die
App läuft auf Android (Chrome) und iOS (Safari); beide Pfade sind in
`index.html` berücksichtigt und in `README.md` beschrieben.

## Vor jedem Push prüfen

Das läuft auch in der CI (`.github/workflows/checks.yml`, Job
`Syntax und Dateien prüfen`) — aber vorher selbst ausführen, nicht darauf
verlassen:

```sh
sed -n '/^<script>$/,/^<\/script>$/p' index.html | sed '1d;$d' > /tmp/app.js
node --check /tmp/app.js
node --check sw.js
node -e "JSON.parse(require('fs').readFileSync('manifest.webmanifest','utf8'))"
```

Für Änderungen am Verhalten reicht das nicht. Dann die App in einem echten
Browser gegen `python3 -m http.server` fahren und den betroffenen Ablauf
wirklich durchklicken, statt ihn für richtig zu halten.

## Arbeitsweise im Repository

`main` ist durch ein Ruleset geschützt: kein direkter Push, kein Force-Push,
Pull Request mit grüner CI ist Pflicht. Also: Branch anlegen, committen,
pushen, Pull Request öffnen. Der Nutzer merged selbst.

## Sprache

Der Nutzer schreibt Deutsch. Antworten, Commit-Nachrichten, Pull-Request-Texte
und Kommentare im Code ebenfalls auf Deutsch.
