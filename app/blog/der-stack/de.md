![Das Stadtmodell: vier Ebenen, ein Ort](/blog/der-stack/modell.webp)

**Kurz gesagt:** Stadtstack ist ein unabhängiges Stadtlabor aus Strausberg. Ich teste, wie eine Stadt mit offenen Daten, Beteiligung und digitalen Werkzeugen besser entscheiden kann – auf vier Ebenen: Infrastruktur, Wissen, Entscheidungen, Umsetzung. Manches läuft schon (ein KI-Datenzugang mit Quellen für 319 Gemeinden), vieles ist Prototyp oder Labor-Demo. Dieser Text erzählt, wie es dazu kam, was ich getestet habe und wo die Grenzen sind.

### Wie alles anfing: eine Frage an der Haustür

Im Februar 2026 stand jemand an meiner Tür und fragte, wen ich bei der Bürgermeisterwahl in Strausberg wählen will. Ich wusste es nicht. Ehrlich gesagt kannte ich meine Stadt damals noch nicht besonders gut.

Also habe ich angefangen zu recherchieren: Wer kandidiert, was wollen die Kandidierenden, welche Probleme haben die Menschen hier wirklich? Ich habe viel mit KI recherchiert und mit vielen Menschen gesprochen – mit Kandidierenden, mit Mitgliedern der Stadtverordnetenversammlung, mit Leuten aus der Stadt.

Ein Satz ist mir dabei hängen geblieben: Viele Entscheidungen würden letztlich aus dem Bauch heraus getroffen. Ich verstehe, woher das kommt – die Unterlagen sind verstreut, die Zeit ist knapp, Ehrenamtliche entscheiden nach Feierabend. Aber ich finde: Entscheidungen über unsere Stadt sollten auf Fakten beruhen. Und die Fakten gibt es oft schon – sie sind nur schwer zu finden.

Daraus wurde Stadtstack.

### Warum kleine Städte

Ich lebe in Strausberg. Röbel an der Müritz ist die Stadt, in der ein Freund wohnt. Und ich komme aus Stimpfach, einem Ort, der noch viel kleiner ist. Große Städte haben Datenportale, Digitalabteilungen und Beratungsbudgets. Kleine Städte und Gemeinden haben oft nichts davon – aber dieselben Fragen: Wärmeplanung, Solar und Wind, Wohnen, Schulen, Verkehr, Haushalt. Genau dort will ich ansetzen, und genau dort möchte ich später auch hin.

### Der Weg: von alten Ideen zu einem Stapel

Stadtstack ist nicht am Reißbrett entstanden, sondern aus Experimenten – manche davon älter als das Projekt selbst:

- **ZK Loyalty** stammt ursprünglich von einem Hackathon vor ein paar Jahren: ein Treueprogramm für lokale Läden mit Zero-Knowledge-Technik. Im Stadtkontext bekam es einen neuen Sinn.
- **Die Mietkaution** war ebenfalls eine ältere Idee. In *Ledger of Life* lebt sie in anderer Form weiter.
- **ZK Residency** war die erste App, die ich nach dem Einstieg in Civic Tech gebaut habe: Wie kann man nachweisen, dass man in einer Stadt wohnt, ohne mehr preiszugeben als nötig? Daraus wurde die Beteiligungsseite *Mitmachen*.
- **Die Röbel-App** stammt ursprünglich von einem Freund. Ich habe ihn als einen der Gewinner eines Hackathons kennengelernt; wir haben ähnliche Ziele und haben uns zusammengetan. Ich habe seine App geforkt und daran weitergebaut. Der Ausgangspunkt war eine einfache Beobachtung: Menschen beschweren sich auf Facebook über ihre Stadt – aber bei wem eigentlich? Das löst nichts. Die Idee: ein soziales Netz für die Stadt, in dem man Probleme meldet und die *Stadt-KI* markiert. Sie bereitet daraus einen Vorschlag mit Quellen vor, der an Stadtverordnete und die zuständigen Fachbereiche geht. Die können mit KI-Unterstützung daran arbeiten und den Menschen schneller Rückmeldung geben. Diese Oberfläche soll künftig in *Ledger of Life* und *Mitmachen* aufgehen.
- **3D-Karten und ein Spiel**, gebaut aus OpenStreetMap und anderen offenen Daten, sollen zeigen, was in der Stadt tatsächlich passiert – anschaulich statt in PDF-Anhängen.

Irgendwann wurde klar, dass all diese Oberflächen dasselbe brauchen: verlässliches Wissen über die Stadt. Daraus entstand die Idee eines *Stapels* – eines Stacks – mit vier Ebenen, bei dem die Ergebnisse wieder zurück ins Stadtwissen fließen.

{{timeline}}

{{stack}}

### Ebene 1 · Infrastruktur bereitstellen
*Was trägt und verbindet die Stadt?*

![Ebene 01 im Modell: Infrastruktur](/blog/der-stack/ebene-1.webp)

Alles läuft selbst gehostet: ein eigener Kubernetes-Cluster (Talos) bei Hetzner, ein privates Overlay-Netz (NetBird) und ein Heimserver. Datensouveränität ist für mich kein Schlagwort – wenn Städte ihre Daten und Werkzeuge nicht selbst kontrollieren können, hängt ihre Handlungsfähigkeit an Dritten.

Der zweite Teil dieser Ebene ist **Resilienz**. Was passiert, wenn das Internet ausfällt – bei einem Hochwasser, einem Stromausfall oder einem Angriff auf kritische Infrastruktur? Das ist keine Theorie mehr: Anfang November 2026 fielen nach mutmaßlichen Cyberangriffen in Supermärkten in mehreren europäischen Ländern Kühl- und Gefriertruhen aus ([Reuters](https://www.reuters.com/business/retail-consumer/temperature-soars-swedish-grocery-store-freezers-one-store-blames-hackers-2026-11-02), [BBC](https://www.bbc.co.uk/news/articles/cwy8lm1m59mvo)). Im September wurden 5,8 Terabyte gestohlener Daten der Berliner Verwaltung veröffentlicht, möglicherweise auch Daten zur kritischen Infrastruktur ([ZEIT](https://www.zeit.de/politik/deutschland/2026-09/cyberangriff-berlin-rhysida-hackergruppe-senatsverwaltung-datenleck), [taz](https://taz.de/Fiasko-nach-Hackerangriff-in-Berlin/!6210542)) – Material, das weitere Angriffe erleichtern kann. In der *Offline-Mesh-Stadt* habe ich getestet, wie kleine Nachrichten und Zahlungen über LoRa-Funk und Reticulum von Gerät zu Gerät kommen, ganz ohne Internet. Langfristig denke ich an Mesh-Verbindungen zwischen Städten und an lokale KI, die auch offline hilft.

> **Stand & Grenzen:** Cluster und Netz laufen produktiv für Stadtstack. Das Mesh ist eine Labor-Demo mit einem einzigen Funk-Hop – kein stadtweites Netz, kein einsatzbereites Zahlungssystem. Testeinheiten haben keinen Geldwert.

### Ebene 2 · Wahrnehmen & verstehen
*Was passiert vor Ort, und was bedeutet es?*

![Ebene 02 im Modell: Wissen](/blog/der-stack/ebene-2.webp)
![Stadtkompass: Stadtprofil Strausberg aus der Live-Ebene](/blog/der-stack/stadtkompass.webp)

Das ist inzwischen das Herzstück. Die **Civic-Data-Pipeline** sammelt öffentliche kommunale Quellen – Ratsinformationssysteme, Beschlüsse, Haushalte, das Marktstammdatenregister für Energieanlagen, amtliche Statistik, OpenStreetMap – und bereitet sie so auf, dass Antworten nachvollziehbar bleiben: mit Quelle, Datum und klaren Grenzen.

Darüber liegt ein **MCP-Server**: eine Schnittstelle, über die KI-Werkzeuge diese Daten lesen können. Das MCP ist die gemeinsame Schicht für alles andere – das Spiel, die Stadt-KI, Dashboards – und es macht Städte vergleichbar.

Was ich getestet habe:
- **Große Städte:** 8 Städte mit rund 14.600 Datensätzen aus offenen Schnittstellen (Baustellen, OSM, Ratssysteme).
- **Kleine Städte:** eine geprüfte Wissensschicht für 9 Kleinstädte in 3 Landkreisen in Brandenburg, Schleswig-Holstein und Mecklenburg-Vorpommern.
- **Eine Live-Ebene für alle 319 Gemeinden** dieser drei Kreise: Stammdaten, rund 78.000 Energieanlagen, Ratsdaten – inzwischen für 44 von 319 Gemeinden –, ein „Stadtkompass“ mit sechs Dimensionen und Offline-Stadtpakete.
- **Ein fester Test mit 30 Fragen:** Richtigkeit 60/60, Quellenbelege 46/60, Nützlichkeit erst 13/60.

Die letzte Zahl ist die ehrlichste: Richtige Antworten mit Quellen reichen nicht, wenn sie nicht helfen. Ein erster Neubau der Pipeline ist an einer Architekturgrenze gescheitert, ich habe ihn ohne Veröffentlichung beendet. Der zweite Anlauf geht tiefer: Er soll Beschlüsse, abgewogene Einwendungen, Förderketten und Betreiber zuverlässig erfassen – jede Aussage belegbar bis zum Originaldokument.

> **Stand & Grenzen:** Der MCP-Zugang läuft (nur lesend, persönlicher Token). Die Live-Ebene ist als „strukturierte Quelle, nicht unabhängig geprüft“ gekennzeichnet. Die Nützlichkeit ist die offene Baustelle. Mehr unter [mcp.stadtstack.eu](https://mcp.stadtstack.eu/health).

### Ebene 3 · Beraten & entscheiden
*Was wollen wir tun, und wer entscheidet?*

![Ebene 03 im Modell: Entscheidungen](/blog/der-stack/ebene-3.webp)
![Mitmachen: beratende, anonyme Umfrage mit Passkey](/blog/der-stack/mitmachen.webp)

Hier geht es nicht darum, dass Software entscheidet. Entscheidungen bleiben bei Menschen – aber sie sollen informierter fallen.

- **Have your say** (in *Ledger of Life*) sammelt Pro und Contra zu einem Thema und zeigt sie als Sunburst, ergänzt um ein Meinungsbild. Themen können Städte verbinden.
- **@city-ai** verweist auf Quellen, statt für die Stadt zu sprechen.
- **Mitmachen** war eine Beteiligungsseite für Strausberg mit Wohnsitz-Nachweis über Zero-Knowledge (aus *ZK Residency*): Man kann zeigen, dass man hier wohnt, ohne seine Adresse offenzulegen.

> **Stand & Grenzen:** Beteiligung bei Stadtstack ist beratend und ersetzt keine amtlichen Verfahren. Die Teilnahme bei Mitmachen ist geschlossen; die Seite bleibt zur Ansicht online.

### Ebene 4 · Handeln & umsetzen
*Wie wird daraus ein sichtbares Ergebnis?*

![Ebene 04 im Modell: Umsetzung](/blog/der-stack/ebene-4.webp)
![Ledger of Life (Testnetz)](/blog/der-stack/ledger.webp)
![Ladenrunde: Treue für lokale Läden (Sepolia-Testnetz)](/blog/der-stack/ladenrunde.webp)
![Das Spiel mit Mecky (Röbel) und Strausi (Strausberg)](/blog/der-stack/spiel.webp)

- **Ledger of Life** verbindet Wohnen, Mietkaution und gemeinsames Abwägen, dazu eine Kartenebene für lokale Orte und einen Home Node für die Nutzung offline (Solana-Testnetz).
- **ZK Loyalty / Ladenrunde:** Treue für lokale Läden, damit Kundschaft und Geschäfte zusammenfinden – ohne dass Kundendaten gesammelt werden müssen (Sepolia-Testnetz).
- **Das Spiel:** Stadt als Spiel, ein Zugang zu Stadtstack, ohne zuerst Blockchain verstehen zu müssen.
- **Maskottchen:** In Japan und Korea zeigen *Yuru-Charas*, wie sehr Figuren helfen, sich mit einem Ort zu identifizieren und Botschaften zu transportieren. Mit Mecky und Strausi probiere ich das im Kleinen aus.

> **Stand & Grenzen:** Prototypen und Piloten. Alle Blockchain-Funktionen laufen auf Testnetzen; Testeinheiten haben keinen Geldwert und begründen keine Ansprüche.

### Über alle Ebenen: Wirkung fließt zurück

Der Kern des Modells ist der Kreislauf: Was umgesetzt wird, wird gemessen und fließt zurück ins Stadtwissen. Und eine Stadt muss nicht alles selbst herausfinden – wenn sich Städte vergleichen können, sehen sie, was anderswo funktioniert hat, und können gemeinsam in eine bessere Richtung gehen. Rechte und Vertrauen gelten dabei auf allen Ebenen: Datenschutz, Quellen, klare Grenzen.

### Was ich gelernt habe

- **Die Daten sind da – aber nicht nutzbar.** Fast alles, was eine Stadtverordnete für eine Entscheidung bräuchte, ist irgendwo veröffentlicht. Das Problem ist Auffinden, Zusammenhang und Vertrauen.
- **Richtig ist nicht gleich hilfreich.** 60/60 bei der Richtigkeit, 13/60 bei der Nützlichkeit. Das hat meine Prioritäten verschoben.
- **Ehrlichkeit über Grenzen ist ein Feature.** Testnetz, Pilot, Labor-Demo – klar benannt schafft mehr Vertrauen als jedes Versprechen.
- **Kleine Städte sind kein Randfall.** Sie sind die Mehrheit.
- **Eine gemeinsame Wissensschicht trägt viele Oberflächen.** Spiel, Stadt-KI und Dashboard brauchen dasselbe Fundament.

### Wie es weitergeht

- Die belegte Wissensschicht für die 9 Kleinstädte fertigstellen und messbar nützlicher machen.
- Ratsdaten für mehr Gemeinden, neue Ratsunterlagen am selben Tag.
- Von 9 auf 50 bis 300 Gemeinden wachsen – ohne jedes Mal alles neu zu berechnen.
- Städtevergleich: Energiewende, Planung, Haushalt, Demografie.

### Mitmachen

- **Gemeinden und Verwaltungen:** Wenn Sie wissen möchten, wie Ihre Gemeinde in den Daten aussieht, melden Sie sich.
- **Stadtverordnete und Engagierte:** Probieren Sie den MCP-Zugang mit Ihrem KI-Werkzeug aus.
- **Entwickler:innen und Forschende:** Lasst uns zusammenarbeiten.
- **Alle:** Schaut euch die Projekte an und sagt mir, was fehlt.

→ [Kontakt](https://stadtstack.eu/kontakt)

*Stadtstack ist ein unabhängiges Projekt und kein offizieller Stadtdienst.*
