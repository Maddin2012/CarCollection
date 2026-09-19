# Fahrzeugakte

Eine Single-File-Web-App (`index.html`) zur Verwaltung mehrerer Fahrzeuge –
ohne Build-Schritt, ohne Abhängigkeiten. Einfach die Datei im Browser öffnen.

## Funktionen

- **Garage** – Übersicht aller Fahrzeuge als Karten, inklusive Warnbanner für
  abgelaufenen oder bald fälligen TÜV.
- **Fahrzeugkarte** – Titelbild, Kennzeichen, Kilometerstand, Leistung, Hubraum,
  Baujahr, Kraftstoff, TÜV-Datum sowie eine Kostenübersicht.
- **Logbuch** – Reparaturen, Wartungen und Umbauten mit Datum, Kilometerstand,
  Kategorie und Kosten.
- **Dokumente** – Fahrzeugpapiere, TÜV-Berichte, Versicherung und Rechnungen als
  Foto (Kamera-Scan) oder PDF, nach Kategorie gruppiert.
- **Teile** – gekaufte Teile mit Kategorie, Status (verbaut / auf Lager /
  bestellt), Preis, Händler und Teilenummer.
- **TÜV-Erinnerung** – Export eines `.ics`-Termins mit Erinnerungen 30 und
  7 Tage vor Ablauf.

## Speicherung

Die Daten liegen in `window.storage`, sofern die Umgebung diese API bereitstellt.
Bilder werden vor dem Speichern auf max. 1200 px (Titelbild) bzw. 1600 px
(Dokumente) verkleinert und als JPEG abgelegt; PDFs sind auf 3,5 MB begrenzt.
Steht keine Storage-API zur Verfügung, läuft die App im Arbeitsspeicher und
weist im Interface darauf hin, dass die Daten beim Schließen verloren gehen.
