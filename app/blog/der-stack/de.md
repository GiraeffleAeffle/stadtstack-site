![Das Stadtmodell von stadtstack.eu: derselbe Platz auf vier Ebenen](/blog/der-stack/modell.webp)

**Kurz gesagt:** Stadtstack ist ein unabhängiges Stadtlabor aus Strausberg. Ich möchte, dass Entscheidungen über eine Stadt auf Fakten beruhen, die alle nachprüfen können. Dafür sammle ich öffentliche Daten für 319 Gemeinden, mache sie vergleichbar und probiere aus, wie sie bei Beteiligung, im Alltag und im Krisenfall helfen. Einiges läuft, vieles ist Prototyp, manches hat nicht funktioniert. Hier steht alles davon.

### Eine Frage an der Haustür

Im Februar 2026 stand jemand an meiner Tür und fragte, wen ich bei der Bürgermeisterwahl in Strausberg wählen will. Ich wusste es nicht. Ehrlich gesagt kannte ich meine Stadt damals noch nicht besonders gut.

Also habe ich angefangen zu recherchieren: Wer kandidiert, was wollen die Kandidierenden, welche Probleme haben die Menschen hier wirklich? Ich habe viel mit KI recherchiert und mit vielen Menschen gesprochen, mit Kandidierenden, mit Mitgliedern der Stadtverordnetenversammlung, mit Leuten aus der Stadt.

Ein Satz ist mir dabei hängen geblieben: Viele Entscheidungen würden am Ende aus dem Bauch heraus getroffen. Ich verstehe, woher das kommt. Die Unterlagen sind verstreut, die Zeit ist knapp, und im Stadtparlament sitzen Ehrenamtliche, die nach Feierabend entscheiden. Trotzdem finde ich: Entscheidungen über unsere Stadt sollten auf Fakten beruhen.

### Die Fakten gibt es. Man findet sie nur nicht.

Zwei Beispiele aus Strausberg.

Hat die Stadt einen Wärmeplan? Ja. Die Stadtverordnetenversammlung hat ihn am 21. Mai 2026 beschlossen. Das steht im [Amtsblatt 04/2026](https://www.stadt-strausberg.de/wp-content/uploads/2026/06/2026_04_Amtsblatt_SRB.pdf) auf Seite 4. Wer das nicht weiß, sucht lange.

Wie gut ist das Internet? Für 82 Prozent der Haushalte ist Gigabit-Festnetz verfügbar. In der Gruppe der 15 ähnlich großen Orte liegt der mittlere Wert bei 97 Prozent (Bundesnetzagentur, Breitbandatlas, Stand Juni 2026).

![Stadtkompass, Profil Strausberg: Wo weicht die Stadt von ähnlich großen Orten ab? Quellen: BBSR (INKAR), Bundesnetzagentur. Strukturierte Quellen, nicht unabhängig geprüft.](/blog/der-stack/abweichungen.webp)

Solche Angaben sind öffentlich. Sie liegen bei der Bundesnetzagentur, bei den Statistischen Ämtern, in Ratsinformationssystemen und Amtsblättern. Aber sie sind über Dutzende Portale, Tabellen und PDF-Anhänge verteilt. Niemand, der ehrenamtlich im Stadtparlament sitzt, hat die Zeit, das zusammenzusuchen.

Ob 82 Prozent ein Problem sind, entscheidet keine Software. Das beurteilen die Menschen in der Stadt und ihr Rat. Aber die Zahl gehört auf den Tisch, bevor entschieden wird. Daraus wurde Stadtstack.

### Warum kleine Städte

Ich lebe in Strausberg. In Röbel an der Müritz wohnt ein Freund. Und ich komme aus Stimpfach, einem Ort, der noch viel kleiner ist. Auch dort möchte ich das später machen.

Große Städte haben Datenportale, Digitalabteilungen und Beratungsbudgets. Kleine Gemeinden haben oft nichts davon, aber dieselben Fragen: Wärmeplanung, Solar und Wind, Wohnen, Schulen, Verkehr, Haushalt. Und sie sind die Mehrheit. In den drei Landkreisen, die ich bisher erfasse, liegen 319 Gemeinden. Die Hälfte hat weniger als rund 630 Einwohnerinnen und Einwohner, nur 17 haben mehr als 10.000.

### Der Weg: Umwege, die sich gelohnt haben

Stadtstack ist nicht am Reißbrett entstanden, sondern aus Versuchen. Manche sind älter als das Projekt.

- **ZK Loyalty** stammt von einem Hackathon vor ein paar Jahren: ein Treueprogramm für lokale Läden, bei dem Kundinnen und Kunden selbst entscheiden, was sie offenlegen. Im Stadtkontext bekam es einen neuen Sinn und heißt jetzt *Ladenrunde*.
- **Die Mietkaution** war ebenfalls eine ältere Idee. In *Ledger of Life* lebt sie in anderer Form weiter.
- **ZK Residency** war die erste App, die ich nach dem Einstieg in dieses Thema gebaut habe. Die Frage dahinter: Wie weist man nach, dass man in einer Stadt wohnt, ohne seine Adresse offenzulegen? Daraus wurde die Beteiligungsseite *Mitmachen*.
- **Die Röbel-App** stammt ursprünglich von einem Freund. Ich habe ihn als einen der Gewinner eines Hackathons kennengelernt, wir haben ähnliche Ziele und haben uns zusammengetan. Ich habe seine App geforkt und daran weitergebaut. Der Ausgangspunkt: Menschen beschweren sich auf Facebook über ihre Stadt, aber bei wem eigentlich? Das löst nichts. Die Idee ist ein soziales Netz für die Stadt. Man meldet ein Problem und markiert die *Stadt-KI*. Sie bereitet daraus einen Vorschlag mit Quellen vor, der an die Stadtverordneten und die zuständigen Fachbereiche geht, und die Menschen bekommen schneller eine Rückmeldung. Diese Oberfläche soll künftig in *Ledger of Life* und *Mitmachen* aufgehen.
- **3D-Karten und ein Spiel** aus OpenStreetMap und anderen offenen Daten zeigen, was in der Stadt passiert, anschaulich statt in PDF-Anhängen.

Irgendwann wurde klar: All diese Oberflächen brauchen dasselbe, nämlich verlässliches Wissen über die Stadt. Daraus entstand der Gedanke eines Stapels mit vier Ebenen.

{{timeline}}

### Der Stack: vier Ebenen, ein Kreislauf

Das Modell auf der Startseite zeigt denselben Platz viermal: gebaut, gemessen, beraten, verändert. Die Ebenen bauen aufeinander auf, und was umgesetzt wird, fließt als neues Wissen zurück. Eine Stadt muss außerdem nicht alles selbst herausfinden. Wenn Städte sich vergleichen können, sehen sie, was anderswo funktioniert hat.

{{stack}}

### Ebene 1 · Infrastruktur: Was trägt, auch wenn etwas ausfällt?

Alles läuft auf eigener Infrastruktur statt bei einem großen Cloud-Anbieter: gemietete Server in der EU, ein privates Netz und ein Heimserver. Wenn Städte ihre Daten und Werkzeuge nicht selbst kontrollieren, hängt ihre Handlungsfähigkeit an anderen.

Der zweite Teil ist Vorsorge für den Ausfall. Das ist keine Theorie mehr: Anfang November 2026 fielen nach mutmaßlichen Cyberangriffen in Supermärkten in mehreren europäischen Ländern Kühl- und Gefriertruhen aus ([Reuters](https://www.reuters.com/business/retail-consumer/temperature-soars-swedish-grocery-store-freezers-one-store-blames-hackers-2026-11-02), [BBC](https://www.bbc.co.uk/news/articles/cwy8lm1m59mvo)). Im September wurden 5,8 Terabyte gestohlener Daten der Berliner Verwaltung veröffentlicht, möglicherweise auch Daten zur kritischen Infrastruktur ([ZEIT](https://www.zeit.de/politik/deutschland/2026-09/cyberangriff-berlin-rhysida-hackergruppe-senatsverwaltung-datenleck), [taz](https://taz.de/Fiasko-nach-Hackerangriff-in-Berlin/!6210542)). Solches Material kann weitere Angriffe erleichtern.

Ich habe deshalb getestet, wie kurze Nachrichten und Zahlungen ganz ohne Internet von Gerät zu Gerät kommen, über Funk mit großer Reichweite (LoRa und Reticulum). Für jede der 319 Gemeinden gibt es außerdem ein Stadtpaket zum Herunterladen, das offline funktioniert. Langfristig denke ich an Funkverbindungen zwischen Städten und an lokale KI, die auch ohne Netz hilft.

> **Stand & Grenzen:** Server und Netz laufen im Betrieb. Die Funkstrecke ist ein Laborversuch über eine einzige Etappe, kein stadtweites Netz und kein einsatzbereites Zahlungssystem. Testeinheiten haben keinen Geldwert.

### Ebene 2 · Wissen: Was passiert vor Ort?

Das ist inzwischen das Herzstück. Ich sammle öffentliche kommunale Quellen und bereite sie so auf, dass jede Angabe ihre Quelle und ihr Datum behält.

- **Der Stadtkompass** zeigt für alle 319 Gemeinden der drei Landkreise ein Profil: Bevölkerung, Finanzen, Energie, Versorgung, Erreichbarkeit. Er vergleicht jeden Ort mit ähnlich großen Orten und zeigt die größten Abweichungen.
- **Energie:** rund 78.000 Anlagen aus dem Marktstammdatenregister, wöchentlich aktualisiert.
- **Ratsdaten:** gut 5.500 Vorlagen aus 33 Gemeinden, mit Beschlüssen, wo sie ausgewiesen sind.
- **Wärmeplanung:** Ich habe für alle 319 Gemeinden nach Belegen gesucht. Gefunden habe ich einen beschlossenen Plan (Strausberg), sechs Planungen in Arbeit und 22 Gemeinden, in denen das Thema bisher nur beraten wurde. Für 290 gibt es keinen Beleg. Das heißt nicht, dass dort nichts geschieht. Es zeigt, wie wenig auffindbar ist.
- **Ein Zugang für KI-Assistenten:** Über eine offene Schnittstelle (MCP) können Werkzeuge wie Claude oder ChatGPT diese Daten abfragen und mit Quelle antworten, statt zu raten. Dieselbe Schnittstelle versorgt später das Spiel, die Stadt-KI und die Beteiligung.

Daneben gibt es eine kleinere, strenger geprüfte Wissensschicht für neun Kleinstädte in Brandenburg, Schleswig-Holstein und Mecklenburg-Vorpommern. Sie soll jede Aussage bis zum Originaldokument belegen.

> **Stand & Grenzen:** Der KI-Zugang läuft, nur lesend und mit persönlichem Zugangsschlüssel. Der Stadtkompass ist ein interner Prototyp und noch nicht öffentlich. Seine Daten sind als „strukturierte Quelle, nicht unabhängig geprüft“ gekennzeichnet. Ein Rang ist keine Bewertung der Lebensqualität.

### Ebene 3 · Entscheidungen: Wer wägt ab?

Hier entscheidet keine Software. Entscheidungen bleiben bei Menschen. Sie sollen nur besser informiert fallen.

- **Have your say** (in *Ledger of Life*) sammelt zu einem Thema Pro und Contra, zeigt sie als Grafik und ergänzt ein Meinungsbild. Themen können mehrere Städte verbinden.
- **Die Stadt-KI** verweist auf Quellen, statt für die Stadt zu sprechen.
- **Mitmachen** ist eine anonyme, beratende Umfrage für Strausberg. Wer teilnimmt, lässt einmal bestätigen, dass er hier wohnt. Die Abstimmung selbst lässt sich danach nicht mehr mit der Person verbinden.

![Ledger of Life: Wohnen, Kaution und gemeinsames Abwägen (Testnetz)](/blog/der-stack/ledger.webp)
![Mitmachen: beratende, anonyme Umfrage](/blog/der-stack/mitmachen.webp)

> **Stand & Grenzen:** Beteiligung bei Stadtstack ist beratend und ersetzt keine amtlichen Verfahren. Mitmachen ist noch geschlossen: Es fehlen die Menschen, die Wohnsitze bestätigen.

### Ebene 4 · Umsetzung: Was kommt bei den Menschen an?

- **Ledger of Life** verbindet Wohnen, Mietkaution und gemeinsames Abwägen. Dazu kommen eine Karte lokaler Orte und ein Home Node für zu Hause, mit dem die App auch offline nutzbar bleibt.
- **Ladenrunde:** Treuepunkte für lokale Läden. Kundschaft und Geschäfte finden zusammen, und die Punkte bleiben verschlüsselt.
- **Das Spiel:** Mit den Maskottchen Mecky in Röbel und Strausi in Strausberg erkundet man echte Straßen und echte Themen, mit Quellenangaben.
- **Maskottchen:** Japan und Korea zeigen mit ihren *Yuru-Charas*, wie sehr Figuren helfen, sich mit einem Ort zu verbinden und Botschaften zu vermitteln. Mecky und Strausi sind mein Versuch im Kleinen.

![Das Spiel mit Mecky (Röbel) und Strausi (Strausberg)](/blog/der-stack/spiel.webp)
![Ladenrunde: Treuepunkte für lokale Läden (Testbetrieb)](/blog/der-stack/ladenrunde.webp)

> **Stand & Grenzen:** Prototypen und Piloten. Alle Blockchain-Funktionen laufen auf Testnetzen. Testeinheiten haben keinen Geldwert und begründen keine Ansprüche. In der Ladenrunde sind Transaktionen derzeit pausiert.

### Was nicht funktioniert hat

- **Richtig ist noch nicht hilfreich.** Die Wissensschicht für die neun Kleinstädte messe ich mit 30 festen Fragen. Bei der Richtigkeit erreicht sie 60 von 60 Punkten, bei den Quellenbelegen 46 von 60, bei der Nützlichkeit nur 13 von 60. Die Antworten stimmen, helfen aber zu selten weiter.
- **Der erste Neubau ist gescheitert.** Einen ersten Anlauf, die Datenaufbereitung gründlicher zu bauen, habe ich Ende Oktober ohne Veröffentlichung beendet. Er stieß an eine Grenze der Architektur. Der zweite Anlauf läuft.
- **Ratsdaten sind schwer zu bekommen.** 33 von 319 Gemeinden sind wenig. Bei 13 Quellen ist der automatische Abruf derzeit gesperrt, der Zugang ist dort noch nicht geklärt.
- **Noch kein Alltagstest.** Die Funkstrecke ist ein Laborversuch, die Beteiligung ist geschlossen, das Treueprogramm pausiert. Mit echten Nutzerinnen und Nutzern muss sich das meiste erst bewähren.

### Wie es weitergeht

- Die geprüfte Wissensschicht für die neun Kleinstädte fertigstellen, mit Beschlüssen, Einwendungen, Förderungen und Betreibern, und sie am selben Test messen.
- Zu jeder Abweichung zeigen, was ähnliche Orte beschlossen und gefördert haben.
- Mehr Ratsdaten, und neue Vorlagen noch am selben Tag einordnen.
- Von neun Kleinstädten auf 50 bis 300 Gemeinden wachsen.

### Mitmachen

- **Sie arbeiten in einer Gemeinde oder Verwaltung?** Ich zeige Ihnen gern das Profil Ihres Ortes und höre, was daran falsch ist oder fehlt.
- **Sie sitzen in einem Rat oder engagieren sich vor Ort?** Sagen Sie mir, welche Frage Sie vor der letzten Entscheidung gern beantwortet gehabt hätten.
- **Sie entwickeln oder forschen?** Den KI-Zugang können Sie mit einem persönlichen Schlüssel ausprobieren.

→ [Kontakt](/kontakt)

*Stadtstack ist ein unabhängiges Projekt und kein offizieller Stadtdienst.*
