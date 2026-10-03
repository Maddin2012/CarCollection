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
- Der Browser kann die Daten auch **von sich aus** räumen, wenn der Speicher des
  Geräts knapp wird und die Ablage nicht geschützt ist — ohne Rückfrage und ohne
  dass du etwas gelöscht hättest. Die Einstellungen zeigen unter **Speicher**,
  ob der Schutz besteht. Die Sicherung ist dagegen das einzige Mittel.

Niemals Fotos, Fahrzeugpapiere oder Rechnungen ins Repository committen.

## Funktionen

Die untere Leiste führt durch ein geöffnetes Fahrzeug und ist mit
**Cars** (Auto von vorn), **Scheckheft** (Schraubenschlüssel), **Dokumente**
(Blatt) und **Ersatzteile** (Sechskantmutter) beschriftet; die
Kopfzeile nennt denselben Namen. Innerhalb der Ansichten stehen weiter die
Begriffe *Logbuch* und *Teile* — umbenannt sind nur Leiste und Kopfzeile, und
auch dieser Text bleibt bei den gewachsenen Namen.

- **Garage** – Übersicht aller Fahrzeuge als Karten, mit Warnbanner für
  abgelaufenen oder bald fälligen TÜV.
- **Fahrzeugkarte** – Titelbild, Kilometerstand, Baujahr, TÜV-Datum, letzter
  Service, FIN, HSN und TSN sowie eine Kostenübersicht. Die übrigen Felder
  (Leistung, Hubraum, Kraftstoff) bleiben in der Bearbeiten-Maske erfassbar.
- **Logbuch** – Reparaturen, Wartungen und Umbauten mit Datum, Kilometerstand,
  Kategorie und Kosten. Ein Eintrag öffnet zum Lesen, bearbeitet wird über den
  Stift in der Ecke. Belege, Bilder und Ersatzteile lassen sich direkt am
  Eintrag anhängen; die Teile erscheinen dann auch im Reiter Teile.
- **Dokumente** – Fahrzeugpapiere, TÜV-Berichte, Versicherung und Rechnungen als
  Foto oder PDF, nach Kategorie gruppiert. Aufgenommen wird mit der Kamera in
  der App; vor dem Speichern lässt sich zuschneiden, geraderücken, drehen und
  aufhellen. Gespeicherte Bilder öffnen formatfüllend und lassen sich mit zwei
  Fingern vergrößern.
- **Teile** – gekaufte Teile mit Kategorie, Status (verbaut / auf Lager /
  bestellt), Preis, Händler und Teilenummer. Ein Teil öffnet zum Lesen,
  bearbeitet wird über den Stift in der Ecke. Dokumente und Bilder lassen sich
  direkt am Teil anhängen.
- **TÜV-Erinnerung** – Export eines `.ics`-Termins mit Erinnerungen 30 und
  7 Tage vor Ablauf.
- **Blatt wegziehen** – jedes Blatt lässt sich am Griff oben oder an der
  Titelzeile nach unten wegziehen; ab etwa 90 px oder einem kurzen Schlenker
  geht es zu, sonst federt es zurück. Das wirkt wie *Abbrechen*: getippte Werte
  verfallen. Im Blattinneren und auf dem Knopf in der Ecke beginnt kein Zug.
- **Zurück-Geste** – die Zurück-Geste des Handys geht einen Schritt zurück,
  statt die App zu schließen: offenes Sheet oder Vollbild zu, sonst zurück in
  die Garage. Der zuletzt gezeigte Reiter übersteht ein Neuladen.
- **Einstellungen** – hinter dem Zahnrad oben rechts in der Garage: Sicherung
  speichern und einlesen, die laufende Fassung und die Update-Prüfung.
- **Offline** – als Homescreen-App ohne Netz nutzbar.

## Dokumente scannen

Ein abfotografiertes Blatt ist schief, hat den Schreibtisch mit drauf und ist
oft grau statt weiß. Deshalb schiebt sich zwischen Aufnahme und Speichern ein
Zuschnitt — bei jedem Bild, gleich ob es von der Kamera oder aus der Galerie
kommt. Für PDFs gibt es nichts geradezurücken, die gehen unverändert durch.

**Erste Stufe – Aufnehmen.** *Scannen* zeigt das Sucherbild **in der App**: Blatt
ins Bild rücken, auslösen, fertig. Es wird keine fremde Kamera-App geöffnet —
und damit gibt es auch keinen Wechsel, bei dem die Aufnahme verlorengehen kann.
Beim ersten Mal fragt der Browser einmalig nach der Kamera-Erlaubnis.

Fehlt die Erlaubnis, gibt es keine Kamera oder ist sie gerade von einer anderen
App belegt, sagt die App den Grund und bietet den Weg über die Kamera-App des
Geräts als Rückfallebene an. Der Auslöser ist erst dann freigegeben, wenn
wirklich ein Bild läuft — ein Tipp darauf geht nie ins Leere.

Über *Datei wählen* kommt ein schon vorhandenes Bild oder eine PDF herein.

**Zweite Stufe – Zuschneiden.** Vier Griffe liegen auf den Bildkanten; du ziehst
sie auf die Ecken des Blattes. Die App rechnet daraus die perspektivische
Verzerrung heraus und schneidet den Rest weg. Daneben:

- **Drehen** stellt ein quer aufgenommenes Blatt hochkant. Ein schon gesetzter
  Zuschnitt dreht sich mit.
- **Ganzes Bild** setzt die Griffe zurück auf die Kanten.

**Dritte Stufe – Ergebnis.** Hier siehst du, was herauskommt, bevor es
gespeichert wird. Der **Dokument-Modus** macht Graustufen daraus und spreizt den
Kontrast, damit weißes Papier weiß und die Schrift schwarz wird. Abschaltbar —
ein Foto eines Bauteils soll ein Foto bleiben.

Wer nichts ändern will, tippt zweimal auf Übernehmen beziehungsweise Speichern.
Liegen die Griffe unberührt auf den Kanten, wird das Bild gar nicht erst neu
gerechnet; es bliebe sonst ohne Not etwas Schärfe auf der Strecke.

Die Zurück-Geste schließt nur den Zuschnitt. Die Maske darunter bleibt stehen,
samt allem, was du schon hineingeschrieben hast.

Gerechnet wird alles in der App selbst — eine Homographie aus den vier Punkten,
bilinear abgetastet. Keine Zusatzbibliothek, also auch ohne Netz.

## Letzter Service und Titelbild

**Der letzte Service** steht auf der Karte unter dem TÜV-Datum, mit Datum und
Kilometerstand. Er kommt aus zwei Quellen:

- dem jüngsten Logbuch-Eintrag der Art **Wartung** – der Normalfall, denn den
  Service trägst du ohnehin ins Logbuch ein;
- einem Feld **Letzter Service** in der Bearbeiten-Maske, für einen Service aus
  der Zeit vor der App.

**Angezeigt wird das jüngere von beidem.** Das Feld setzt also den Anfangswert
und tritt von selbst zurück, sobald das Logbuch weiter ist – sonst stünde nach
dem nächsten eingetragenen Service weiter der alte Wert auf der Karte, und man
fände den Grund nicht. Eine **Reparatur** ist kein Service und zählt hier nicht
mit, auch wenn sie neuer ist.

**Das Titelbild** wird hinter dem Stift oben rechts geändert, zusammen mit allen
anderen Fahrzeugdaten – es gibt dafür keinen eigenen Knopf mehr auf dem Bild.
Wie bei den Belegen am Logbuch-Eintrag gilt: Gespeichert wird erst beim
Speichern. Brichst du ab, bleibt das alte Bild stehen und im Speicher liegt
nichts Neues. *Entfernen* wirkt ebenso erst beim Speichern.

Durch den Zuschnitt aus dem Abschnitt oben geht das Titelbild bewusst **nicht**:
Ein Autofoto ist kein Dokument, Geraderücken und Dokument-Modus wären hier
verkehrt.

## Ansehen und ändern — überall derselbe Weg

In allen vier Reitern gilt dasselbe: **Antippen heißt ansehen.** Geändert wird
über den **Stift oben rechts in der Ecke** — in der Kopfzeile bei der
Fahrzeugkarte, in der Ecke des Blattes beim Logbuch-Eintrag und beim Teil, in
der Leiste der Vollbildanzeige beim Dokument. Gelöscht wird nur dort, hinter dem
Stift.

| Antippen | zeigt | Stift führt zu |
| --- | --- | --- |
| Fahrzeug | die Karte | Fahrzeugdaten |
| Logbuch-Eintrag | Leseblatt | Eintrag bearbeiten |
| Dokument (Bild) | Vollbild | Dokument bearbeiten |
| Dokument (PDF) | Blatt mit *PDF öffnen* | Dokument bearbeiten |
| Teil | Leseblatt | Teil bearbeiten |

**Ein Dokument ließ sich bis Fassung 14 überhaupt nicht ändern** — Titel,
Kategorie und Datum wurden beim Anlegen gesetzt und waren danach nur noch
löschbar. Seit Fassung 15 gibt es die Maske dafür. Die **Aufnahme selbst** bleibt
darin unberührt: Soll ein anderes Bild hinein, legst du das Dokument neu an.

Beim Dokument weicht die Vollbildanzeige der Maske, statt sich damit zu
stapeln — eine Schicht zur Zeit. Nach Zurück, Speichern oder Löschen landest du
deshalb in der Dokumentenliste und nicht wieder beim Bild.

## Dokumente ansehen und vergrößern

Ein Tipp auf ein Bild-Dokument öffnet es formatfüllend auf dunklem Grund. Weil
in dieser App Fahrzeugscheine und TÜV-Berichte liegen, ist das Vergrößern hier
kein Beiwerk — im Ganzen ist so ein Blatt schlicht nicht zu lesen:

- **Zwei Finger auf- und zuziehen** vergrößert bis zum Sechsfachen. Die Stelle
  zwischen den Fingern bleibt dabei stehen, das Bild wandert also nicht unter
  der Geste weg.
- **Ein Finger schiebt** das vergrößerte Bild. Über den Rand hinaus geht es
  nicht: Sichtbar bleibt immer Bild, nie der leere Grund daneben.
- **Zuziehen** führt zurück auf die Ausgangsgröße und wieder in die Mitte.
- Auf dem Rechner zoomt das **Mausrad** an der Zeigerspitze.

Ein Tipp **neben** das Bild schließt die Anzeige, ein Tipp **auf** das Bild tut
nichts — sonst ginge beim Schieben zu leicht etwas versehentlich zu. Dazu bleibt
der Knopf oben links, die Esc-Taste und die Zurück-Geste.

Vor Fassung 11 stand hier nur `touch-action: pinch-zoom`: Das erlaubt den
Seitenzoom des Browsers, und den gibt es in der installierten App
(`display: standalone`) gar nicht. Ein gespeichertes Dokument ließ sich dort
also nicht vergrößern. Der Zoom ist jetzt eigener Code der App und hängt nicht
mehr daran, wie die App gestartet wurde.

## Logbuch-Eintrag lesen und bearbeiten

Ein Tipp auf einen Eintrag öffnet ihn **zum Lesen**: Art, Kategorie, Datum,
Kilometerstand und Kosten, darunter die Notiz, die angehängten Dokumente und die
verknüpften Teile. Keine Eingabefelder, nichts, was man versehentlich ändert.

Bearbeitet wird über den **Stift in der Ecke des Blattes** – dasselbe Symbol an
derselben Stelle wie bei der Fahrzeugkarte. Die Dokumente im Leseblatt sind
antippbar und öffnen formatfüllend; die Zurück-Geste führt von dort wieder ins
Leseblatt, nicht gleich hinaus. Teile stehen nur als Text da, geändert werden
sie im Reiter Teile.

## Teile am Logbuch-Eintrag

Damit ein Ersatzteil nicht zweimal erfasst werden muss, hat die Maske eines
Logbuch-Eintrags einen Bereich **Teile** mit zwei Wegen:

- **Neues Teil anlegen** – Bezeichnung, Kategorie, Preis und Teilenummer, dann
  *Teil hinzufügen*. Der Status wird *Verbaut*, das Datum übernimmt das des
  Eintrags; Händler und Notiz lassen sich später im Reiter Teile nachtragen.
- **Vorhandenes Teil verknüpfen** – aus der Auswahl, die alle Teile zeigt, die
  noch an keinem Eintrag hängen.

Wie bei den Belegen liegt ein Teil dabei **nur an einer Stelle**, nämlich in der
Teileliste des Fahrzeugs; der Bezug zum Eintrag ist ein Feld daran. Es wird also
nichts doppelt gespeichert und es gibt nichts abzugleichen. Dasselbe Teil
erscheint am Eintrag und im Reiter Teile, dort mit dem Vermerk
*zu: &lt;Titel des Eintrags&gt;*.

Das **×** löst ein Teil nur vom Eintrag. Löschst du einen Eintrag, bleiben seine
Teile erhalten und verlieren nur den Bezug.

### Wie die Kosten gezählt werden

**Ein verknüpftes Teil zählt in den Ausgaben auf der Fahrzeugkarte nicht noch
einmal mit.** Es gelten die Kosten des Logbuch-Eintrags – trage den Teilepreis
also dort mit ein, sonst fehlt er in der Summe. Verliert ein Teil den Bezug
(etwa weil der Eintrag gelöscht wurde), zählt es wieder voll mit.

Die Summe im Reiter **Teile** ist davon unberührt: Sie ist die Summe der dort
angezeigten Teile. Stehen verknüpfte darunter, sagt ein Satz unter der Summe,
warum die beiden Zahlen nicht dasselbe zählen.

## Dokumente und Bilder anhängen

Am **Logbuch-Eintrag** und am **Teil** gibt es denselben Bereich mit zwei
Zeilen:

| | |
| --- | --- |
| **Dokumente** | *Scannen* · *Datei wählen* |
| **Bilder** | *Foto aufnehmen* · *Bild wählen* |

Beides geht durch denselben Zuschnitt — Ecken ziehen, drehen, Dokument-Modus
(der ist standardmäßig aus). Wer nichts ändern will, tippt zweimal weiter.
Unterschiedlich ist allein, **wie der Anhang einsortiert wird**: Ein Dokument
landet unter *Rechnungen*, ein Bild unter der Kategorie **Fotos**.

Bei *Bild wählen* lässt die Dateiauswahl nur Bilder zu; bei *Datei wählen* auch
PDFs.

**Ein Bild ist technisch ein Dokument.** Es liegt in derselben Liste, trägt nur
eine andere Kategorie. Daraus folgt zweierlei: Es erscheint auch im Reiter
Dokumente — dort nach Kategorie gruppiert, also säuberlich getrennt von den
Papieren —, und Sicherung, Wiederherstellung, Löschen und Datenrettung mussten
dafür nichts dazulernen. Ein zweiter Bildspeicher hätte alle vier zusätzlich
bedienen müssen.

In der Liste am Eintrag beziehungsweise am Teil steht je Zeile, was es ist:
**DOK**, **FOTO** oder **PDF**.

Das **×** löst einen Anhang nur vom Eintrag oder Teil. Löschst du einen
**Logbuch-Eintrag** oder ein **Teil**, bleiben seine Anhänge erhalten und
verlieren nur den Bezug.

## Belege am Logbuch-Eintrag

In der Maske eines Logbuch-Eintrags gibt es unten einen Bereich **Dokumente**
mit denselben Knöpfen wie im Reiter Dokumente: *Scannen* oder *Datei wählen*,
beliebig oft. Angehängt wird erst beim Speichern — brichst du ab, bleibt nichts
zurück.

Ein Dokument liegt dabei **nur an einer Stelle**, nämlich in der
Dokumentenliste des Fahrzeugs; der Bezug zum Eintrag ist ein Feld daran. Es
wird also nichts doppelt gespeichert und es gibt nichts abzugleichen: Dieselbe
Rechnung erscheint am Eintrag und im Reiter Dokumente, dort mit dem Vermerk
*zu: &lt;Titel des Eintrags&gt;*.

Der Titel folgt dem Eintrag (bei mehreren durchnummeriert), das Datum ebenso,
die Kategorie ist *Rechnungen*.

Zwei Dinge sind bewusst so entschieden:

- Das **×** in der Liste löst ein Dokument nur vom Eintrag. Gelöscht wird es im
  Reiter Dokumente.
- Löschst du einen **Logbuch-Eintrag**, bleiben seine Dokumente erhalten und
  verlieren nur den Bezug. Eine Rechnung ist auch ohne den Eintrag noch etwas
  wert.

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
3,5 MB begrenzt.

### Angefragt ist nicht gewährt

Die App fragt per `navigator.storage.persist()` eine dauerhafte Ablage an, damit
der Browser die Akte bei Platzmangel nicht räumt. **Gewährt wird sie dadurch
nicht** — das entscheidet der Browser nach eigenen Regeln, und er kann ablehnen.

Bis Fassung 12 hat die App das Ergebnis der Anfrage weggeworfen und in den
Einstellungen trotzdem „Speicher: dauerhaft" angezeigt. Das war keine Aussage
über Dauerhaftigkeit, sondern nur „es ist nicht der Arbeitsspeicher" — es stand
auch dann da, wenn die Akte im Notspeicher lag oder der Browser den Schutz
verweigert hatte.

Seit Fassung 13 stehen in den Einstellungen unter **Speicher** drei ehrliche
Angaben: welche Ablage benutzt wird, ob sie **vor dem Räumen geschützt** ist
(`navigator.storage.persisted()`), und wie viel belegt ist. Ist sie nicht
geschützt, sagt die App das — und weist in der Garage darauf hin, denn dagegen
hilft kein Code, nur eine aktuelle Sicherung.

### Ein Lesefehler ist kein Beweis, dass etwas fehlt

Bis Fassung 12 gab der Speicherzugriff bei jeder Störung `null` zurück. „Lesen
fehlgeschlagen" war damit von „gibt es nicht" nicht zu unterscheiden — und der
Start strich ein Fahrzeug, dessen Datensatz er nicht lesen konnte, aus der
Liste. Beim nächsten Speichern war es daraus dauerhaft verschwunden, obwohl der
Datensatz noch im Speicher lag.

Seit Fassung 13:

- Scheitert das Lesen **eines Fahrzeugs**, bleibt seine Kennung in der Liste.
  In der Garage steht an seiner Stelle eine Kachel *Nicht lesbar*.
- Scheitert das Lesen **der Liste**, gilt die Garage nicht als leer. Die App
  sagt es und **schreibt nichts**, solange der Zustand ungeklärt ist.
- Gestrichen wird nur noch, was nachweislich nicht da ist.

### Datenrettung

In den Einstellungen durchsucht **Datenrettung** beide Speicher — auch den, der
gerade nicht benutzt wird. Das ist der Punkt: Rutscht die App still von
IndexedDB auf den Notspeicher ab, liegen die Daten im anderen und die Garage
sieht leer aus, obwohl alles da ist.

Gefundene Fahrzeuge werden mit Name, Kennzeichen und Anzahlen aufgelistet und
lassen sich in die Garage zurückholen; liegen sie im anderen Speicher, wandern
sie dabei samt Bildern in den benutzten. **Auch ein leeres Ergebnis wird
angezeigt** — dann ist nichts verborgen, sondern wirklich weg, und nur die
Sicherung hilft.

## Sicherung

In den **Einstellungen** (Zahnrad oben rechts in der Garage) liegen zwei
Schaltflächen:

- **Sicherung speichern** – schreibt die komplette Akte in eine Datei
  `carcollection-sicherung-JJJJ-MM-TT.txt`. Darin stecken alle Fahrzeuge,
  Logbuch-Einträge, Teile, Dokumente **und** die Bilder selbst (als Data-URL
  eingebettet). Die Datei ist damit alles, was du zum Wiederherstellen brauchst.
  Der Inhalt ist JSON; die Endung `.txt` hat einen Grund, siehe unten. Ältere
  Sicherungen mit der Endung `.json` lassen sich unverändert weiter einlesen —
  erkannt wird am Inhalt, nicht am Namen.
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

### Wo die Datei landet — und warum sie `.txt` heißt

Beim Speichern öffnet sich auf dem Handy das Teilen-Blatt. Von dort führt der
Weg direkt nach Drive: **Drive wählen → Ordner `Car Collection / Sicherung`**.
So liegt die Sicherung nicht nur auf dem Gerät, auf dem sie entstanden ist.
Nach dem Speichern sagt die App in einer Zeile, welchen Weg sie genommen hat.

**Chrome teilt nur Dateien von einer festen Erlaubnisliste**
(`chrome/browser/webshare/share_service_impl.cc`). Darauf stehen unter anderem
`.txt`, `.csv`, `.pdf` und die gängigen Bild-, Ton- und Videoformate —
**`.json` steht nicht darauf**. Als `.json` kam die Sicherung deshalb nie ins
Teilen-Blatt, sondern immer nur in den Download-Ordner. Genau deshalb heißt sie
jetzt `.txt`; am Inhalt ändert das nichts.

Aus demselben Grund geht der **TÜV-Kalendereintrag** weiterhin in den Download:
`.ics` steht ebenfalls nicht auf der Liste, und eine `.txt` ließe sich nicht in
den Kalender übernehmen. Dort ist der Download der richtige Weg.

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
die App:

| Reihe | Prüft |
| --- | --- |
| `grundfunktionen` | Speicherung in IndexedDB, Überleben von Neuladen und neuem Tab, Manifest, Icons, Service Worker, Offline-Betrieb, Beschriftung der unteren Leiste samt Gleichlauf mit der Kopfzeile, vier eigene Reiter-Symbole, Maße der App-Icons und ihr sicherer Bereich unter der Android-Maske |
| `sicherung` | Export, vollständiges Leeren des Speichers, Wiedereinlesen samt Bildern, Zusammenführen ohne Duplikate, Abweisen fremder Dateien |
| `plattformen` | beide Plattform-Pfade, indem Safaris Eigenheiten im Chromium nachgestellt werden; dazu Chromes Erlaubnisliste fürs Teilen |
| `navigation` | Zurück-Geste über Garage, Fahrzeug, Sheets und Vollbild; kein toter History-Eintrag nach dem Schließen |
| `einstellungen` | Zahnrad, Sicherung von dort, laufende Fassung und Update-Prüfung |
| `logdokumente` | Belege am Logbuch-Eintrag: Anlegen, Bezug, Löschen des Eintrags |
| `scan` | Entzerrung, Dokument-Modus, Drehen und die Abkürzung bei unberührten Ecken — gegen bekannte Vorlagen nachgerechnet |
| `kamera` | Kamerastufe mit vorgespieltem Gerät, Auslöser, Ende des Stroms, Rückfallebenen |
| `vollbild` | Zoom und Schieben mit selbst erzeugten Zeiger-Ereignissen, Grenzen, Einpassen |
| `karte` | letzter Service aus Logbuch und Handfeld, Titelbild in der Maske, Höhe des Bildbereichs |
| `speicher` | gestellte Lesefehler verlieren keine Daten, Datenrettung in beiden Speichern, ehrliche Speicheranzeige, Sicherungsmahnung |
| `logteile` | Leseblatt ohne Eingabefelder, Teile anlegen und verknüpfen, die Kostenregel mit zwei Zahlen nachgerechnet, Zahnrad und Sechskantmutter als eigene Pfade |
| `lesen` | Dokument und Teil nur ansehen, Ändern über den Stift, Bilddatei am Speicher geprüft |
| `anhaenge` | Bild und Dokument am Eintrag und am Teil, Kategorien getrennt, Abbrechen am Speicher geprüft |
| `blatt` | Blatt wegziehen mit selbst erzeugten Zeiger-Ereignissen: Schwelle, Zurückfedern, wo der Zug beginnen darf, und dass danach kein toter History-Eintrag bleibt |

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
| `icons/` | App-Icons (192, 512 und Apple-Touch-Icon) – die Bildmarke des Logos, vom Hintergrund befreit und mittig auf `#10151F` gesetzt |
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
   `https://maddin2012.github.io/Garage/`.
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

### Die Kennung der App

Das Manifest trägt ein ausdrückliches `"id": "/Garage/app"`. Ohne dieses Feld
leitet Chrome die Kennung aus `start_url` ab — eine spätere Änderung daran ließe
die installierte App stillschweigend verwaisen.

**Dieser Wert darf nicht mehr geändert werden.** Chrome hielte die App danach
für eine andere. Eine Prüfung in `grundfunktionen` nagelt ihn deshalb fest.

### Warum die App unter `/Garage/` liegt

Bis zum 03.10.2026 lag sie unter `maddin2012.github.io/CarCollection/`. Dort
meldete Chrome auf dem Pixel „Diese App wurde bereits installiert", obwohl unter
*Einstellungen → Apps* nichts stand — die App war vorher deinstalliert worden,
und Chrome hatte es nicht mitbekommen. Installieren ließ sie sich nicht mehr.

Zwei Versuche, das per Kennung zu lösen, sind gescheitert, und das gehört
festgehalten, damit es niemand ein drittes Mal versucht: Erst kam die Kennung
wegen des Service-Worker-Caches nicht an (siehe unten); dann kam sie nachweislich
an, und Chrome blieb trotzdem dabei. **Chrome hielt die App also nicht an der
Kennung, sondern offenbar am Pfad fest.** Deshalb der Umzug: Das Repository
heißt seitdem `Garage`, die App liegt unter `/Garage/`, wo Chrome nichts
Altes gespeichert hat.

Die alte Adresse führt seitdem ins Leere — GitHub leitet Pages-Seiten nach einer
Umbenennung nicht um.

**Was dabei nicht passiert: Datenverlust.** Der Browserspeicher hängt an der
Herkunft `maddin2012.github.io`, nicht am Pfad und nicht an der Kennung.
Fahrzeuge, Dokumente und Bilder kommen mit an die neue Adresse. Umgekehrt gilt:
Wer die *Website-Daten* in den Chrome-Einstellungen löscht, löscht die Akte —
davor sichern.

**Das Manifest kommt deshalb nie aus dem Cache.** Der Service Worker holt es
wie `version.json` immer vom Netz und greift nur offline auf den Cache zurück.
Lag es wie jede andere Datei im Cache, erreichte eine Änderung daran — neue
Kennung, neuer Name, neue Symbole — das Gerät erst Fassungen später oder gar
nicht. Genau daran scheiterte am 03.10.2026 der erste Versuch, die Kennung zu
setzen: Sie kam auf dem Pixel nie an. Eine Prüfung in `grundfunktionen` stellt
den Fall nach, indem sie den Cache-Eintrag mit einem erfundenen Manifest
überschreibt.

## Plattform-Unterschiede

Beides ist im Code berücksichtigt:

| Thema | Android / Chrome | iOS / Safari |
| --- | --- | --- |
| TÜV-Monat | natives Monatsfeld | zwei Auswahlfelder, weil Safari `input[type=month]` nicht kennt |
| Dateien ausgeben | Teilen-Blatt **nur für erlaubte Typen** (`.txt`, `.pdf`, Bilder …), sonst Download | Teilen-Blatt; `<a download>` kann im Startbildschirm-Modus still scheitern |
| PDF ansehen | Blob-Verweis | Blob-Verweis; `data:`-Verweise öffnet iOS nicht |
| Speicher | IndexedDB, dauerhaft angefragt | IndexedDB; `persist()` fehlt, dafür schützt der Home-Bildschirm |

Die Erkennung läuft über Funktionsprüfung, nicht über die Browserkennung — es
wird also nichts anhand des Gerätenamens geraten.
