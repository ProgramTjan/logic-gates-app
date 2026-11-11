# UX-roadmap — Van druk dashboard naar zelfsprekende leerapp

**Doel:** Forge Logic zo inrichten dat het gebruik voor zich spreekt. Leren en bouwen zijn gescheiden schermen; de leerling wordt waar nodig stap voor stap meegenomen.

**Voor wie is dit document:** een coding-LLM die zelfstandig stappen uitvoert. Elke stap is self-contained en laat de app werkend achter. Volg de uitvoeringsregels onderaan.

---

## Uitgangssituatie (gecontroleerd 2026-11-04)

Inhoudelijk is de app ver (40 lessen, unlock-gating, quiz, walkthrough les 1, klok-runner, ROM/Screen). Het probleem is de presentatie:

1. **Drie lagen tegelijk zichtbaar.** Leren (cursus, 40-lessenlijst, theorie, quiz), bouwen (canvas) en beheer (export/import/back-up/links/thema/taal, sheets, klok) staan permanent naast elkaar: ±25 knoppen vóór de eerste actie.
2. **Course/Workshop scheidt niets.** `.workspace-frame { display:flex }` overschrijft `[hidden]`, dus het canvas staat in cursusweergave gewoon onder de cursus.
3. **Lesinhoud begraven.** Doel, theorie en quiz staan onder de 40-lessenlijst in het rechterpaneel (~1700px scrollen op desktop).
4. **Irrelevante bediening.** Klokknoppen zichtbaar bij combinatorische lessen; twee concurrerende Start-knoppen; elke Start maakt een nieuwe draft-sheet aan.
5. **Begeleiding dun.** Onboarding is een tekstmuur met sneltoetsen; walkthrough alleen voor les 1.
6. **Tablet/mobiel.** Lessenpaneel valt op tablet buiten beeld; mobiel loopt horizontaal over.
7. **Kleinigheden.** Hardcoded NL-string in EN (`Nog geen eigen oplossing opgeslagen`), legacy-label "Project 1" in les-kicker.

## Ontwerpbesluiten (vastgesteld met eigenaar)

- **Drie schermen:** `home` (cursuskaart), `lesson` (les + canvas), `sandbox` (vrij bouwen). Navigatie via één app-balk.
- **Vrij bouwen is vergrendeld tot les 0 voltooid is** (tot les 0 bestaat: de eerste les van het curriculum). Vrije modus (`learner.unlockedAll`) ontgrendelt ook.
- **Lespaneel:** links op brede schermen (≥ 1024px én liggend), als inklapbaar onderpaneel op staande tablet en mobiel.
- **Beheer in één ⚙-menu:** export, import, back-up, links, taal, thema.

---

## FASE A — Schermindeling (fundament) ✅ gedaan 2026-11-04

### Stap A.1: App-views home / lesson / sandbox

**Bestanden:** `index.html`, `script.js`, `src/ui/course.js`, `src/ui/panels.js`, `src/ui/boot.js`, `src/ui/render.js`, `styles.css`.

**Taken:**
1. Vervang de drie-koloms `.shell` door `.app[data-view]` met: app-balk, `#course-view` (home), lespaneel, sandbox-paneel (sheets + chips), `.workspace-frame`.
2. `state.appView ∈ {home, lesson, sandbox}`; CSS bepaalt per view wat zichtbaar is. Repareer het `[hidden]`-lek generiek (`[hidden] { display:none !important }`).
3. Lesson-view: het lespaneel toont alléén het detail van de actieve les (geen 40-lessenlijst, geen voortgangsbalk). Lessenlijst en vrije modus horen op home.
4. Les openen hervat de bestaande draft-sheet van die les (meest recente); "Opnieuw beginnen" maakt een verse.
5. Sandbox-view: sheetlijst toont alleen niet-les-sheets; naar sandbox gaan vanuit een les schakelt naar de laatst gebruikte sandbox-sheet (of maakt "Main Workspace").
6. Sandbox vergrendeld volgens de besluiten; home toont dat met uitleg.
7. Boot: altijd starten op home, behalve bij een gedeelde link (dan sandbox).

**Acceptatiecriteria:**
- Op home is geen canvas zichtbaar; in lesson/sandbox geen cursuskaart.
- Les openen → canvas + lespaneel; tweede keer openen hervat dezelfde sheet.
- Verse gebruiker: sandbox-knop toont slot; na voltooien eerste les niet meer.
- `npm test`, `npm run check` groen; e2e bijgewerkt naar de nieuwe flow.

### Stap A.2: ⚙-menu en contextuele werkbalk

**Taken:**
1. App-balk: [Forge Logic/home] [context: lestitel of sheetnaam] [undo/redo] [Vrij bouwen] [⚙].
2. ⚙-menu (`<details>`-popover): export, import, back-up herstellen, link kopiëren, link importeren, taal, thema.
3. Simulatiebediening (klok, step, play, Hz, reset) alleen zichtbaar als de actieve les sequentieel is of de sheet (direct of via chips) een klok/register/ROM/screen/keyboard bevat.
4. Inspector als zwevende kaart op het canvas, alleen bij selectie; checks alleen bij fouten; statusregel als subtiele melding onderin het canvas.
5. Dubbele Start/Submit-knoppen bovenin het lessenpaneel verdwijnen; het lespaneel heeft één primaire actie.

**Acceptatiecriteria:**
- Lesson-view bij les 1: de werkbalk boven het canvas toont alleen "Parts"; undo/redo en zoom zweven rechtsonder in het canvas.
- Klokknoppen verschijnen bij een sequentiële les en bij een sheet met een klok.

---

### Bevindingen tijdens fase A (meenemen in latere fases)
- ~~Nieuwe onderdelen landen op een vaste positie, soms buiten beeld~~ → opgelost in B.2.
- ~~Elke "Controleer" maakt een nieuwe chipversie~~ → opgelost in E.
- ~~NL-strings in EN-modus~~ → opgelost in E.

---

## FASE B — Lesmodus als stappenflow ✅ gedaan 2026-11-04

### Stap B.1: Lespaneel in stappen
Vervang tabs (Theorie/Hints/Tests) door een verticale flow: **Doel → Snap het (theorie, kort) → Bouw → Controleer → Begrepen? (quiz) → Volgende les**. Eén primaire knop per stap. Theorie inklapbaar na de eerste keer. Na geslaagd: "Volgende les →" + "Terug naar overzicht".

### Stap B.2: Gefilterd onderdelenpalet
Lesson-view toont alleen relevante onderdelen; sandbox toont alles. Uitgewerkt in `src/model/lesson-palette.js` (pure functie, getest in `scripts/verify.js`):
- Altijd: Input, Output, NAND (tenzij `gateConstraint` anders zegt).
- Ingebouwde poorten komen vrij zodra je de les hebt afgerond die ze bouwt (NOT na "not", AND na "and", OR/NOR na "or", XOR na "xor"); de poort die je in de les zelf bouwt nooit. Vrije modus biedt alles. Nog niet beschikbare poorten staan als "Leer je later" in het palet.
- Splitter/Joiner bij brede pins, Clock/Register bij sequentiële lessen, plus node-types uit `template.nodes` (ROM/Screen in de computer-les).
- Chips: alleen je eigen chips; starter-chips (NAND/Half/Full Adder) alleen in Vrij bouwen.
- Nieuwe onderdelen landen op een vrije plek binnen het zichtbare canvas.

### Stap B.3: Live controle
"Controleer" toont de testtabel inline (groen/rood per rij) in de Controleer-stap; geen aparte Tests-tab. Bij falen: eerste falende rij uitgelicht + bijbehorende hint.

**Acceptatie:** les 1–3 doorlopen zonder ooit de pagina te scrollen op 1440×900 (lespaneel scrollt intern); geen tabs meer.

### Bevindingen tijdens fase B (meenemen in latere fases)
- ~~Inspector-kaart is op staande tablet te groot~~ → inklapbaar sinds C, standaard dicht op smalle schermen sinds D.
- ~~NL-beschrijvingen van onderdelen in EN-modus~~ → opgelost in E.
- ~~Starter-chips als oplossing van hun eigen les~~ → verificatie weigert dit sinds E.

---

## FASE C — Begeleiding ✅ gedaan 2026-11-05

### Stap C.1: Coach-engine data-gedreven
Generaliseer `src/ui/tutorial.js`: stappen komen uit `challenge.coach: [{ textKey, target, until }]` met een kleine set predicaten (`hasNode(type)`, `hasWire(from,to)`, `toggled(label)`, `submitted`). Les 1-walkthrough herschrijven als data.

### Stap C.2: Les 0 — casus "Licht aan"
Nieuwe eerste les (`intro-light`): schakelaar → AND → lamp, met verhaal ("de lamp mag alleen aan als de deur dicht is én het alarm aan staat"). Volledig begeleid, ±2 minuten, leert plaatsen/verbinden/schakelen. Voltooien ontgrendelt vrij bouwen. Vervangt de onboarding-overlay; sneltoetsen verhuizen naar een `?`-hulpkaart.

### Stap C.3: Afbouwende hulp
Les 0–5: volledige coach. Daarna een hintladder (hint 1 → hint 2 → aanwijzing op canvas), alleen op verzoek. Instelling "Begeleiding: veel / weinig" in ⚙.

**Acceptatie:** verse gebruiker komt zonder tekstmuur in les 0 en voltooit die zonder voorkennis; e2e dekt les 0.

**Uitgevoerd (afwijkingen/aanvullingen):**
- Coach-scripts in `src/data/coach-scripts.js` voor les 0 t/m 5 (intro-light, nand, not, and, or, xor); engine in `src/ui/tutorial.js`. Bij draadstappen wijst de coach eerst de bron-pin aan en na het kiezen een vrije ingang van het doel.
- Overslaan geldt per les (`learner.coachDismissed`); "Laat zien hoe" in de Bouw-stap start de coach altijd opnieuw; ⚙ → Begeleiding zet de coach aan/uit.
- Les 0 krijgt een eigen module "0. Start"; bestaande voortgang krijgt les 0 automatisch (migratie in `normalizeLearner`). Vrij bouwen gaat open na les 0.
- Welkomst-overlay verwijderd; het startscherm verwelkomt nieuwe gebruikers. Hulp en sneltoetsen in een `?`-menu in de app-balk (teksten herschreven voor de nieuwe flow).
- Inspector in lessen standaard ingeklapt tot een label, zodat hij geen pins afdekt.
- Les-sheets krijgen de (vertaalde) lestitel als naam.

### Bevindingen tijdens fase C (meenemen in latere fases)
- ~~Telefoon: Parts-menu loopt rechts buiten beeld; canvas is erg klein~~ → opgelost in D.

---

## FASE D — Tablet eerst ✅ gedaan 2026-11-05

1. Onderpaneel (bottom sheet) met drie standen: ingeklapt (titel + primaire actie), half, vol; sleepbaar.
2. Pin-hitboxen ≥ 32px op touch (`@media (pointer: coarse)`), pinch-zoom op canvas, geen hover-afhankelijke bediening.
3. Onderdelenpalet als horizontale strip onderin het canvas op smalle schermen.
4. E2E-viewports 1180×820 en 820×1180 toegevoegd.

**Acceptatie:** geen horizontale overflow ≤ 390px; les 0 volledig op touch-viewport te doorlopen.

**Uitgevoerd:**
- `@media (pointer: coarse)`: nodes 124px breed, pins ≥ 26px met onzichtbare tikzone van 32px die van de node af wijst, grotere toggles, bredere draad-tikzone, 40px canvasknoppen.
- Eigen gebaren op het canvas (`touch-action: none`): één vinger pant, twee vingers pinchen rond het middelpunt en pannen mee; Ctrl/⌘ + scroll (trackpad) zoomt rond de cursor. Knop ⤢ maakt passend.
- Onderpaneel (< 1024px) met drie standen — opgevouwen (titel, live-status, Controleer), half, vol — tik op de greep vouwt, slepen kiest de dichtstbijzijnde stand. Ook voor het sandbox-paneel ("Sheets & chips", standaard opgevouwen). Op een telefoon vouwt het lespaneel op zodra je een onderdeel plaatst.
- Onderdelenstrip (< 1024px) onder het canvas i.p.v. het Parts-menu; de coach wijst daar de knop aan.
- Plaatsing van onderdelen rekent met echte node-maten, ontwijkt zwevende kaarten, kiest de vrije plek het dichtst bij de vorige node en scrollt mee als het zichtbare deel vol is.
- Lessen op een smal canvas krijgen een compactere indeling en passen zich bij openen in beeld (niet kleiner dan 60%).
- Inspector ook in Vrij bouwen ingeklapt op smalle schermen.
- E2E `e2e/touch.spec.js`: 820×1180, 1180×820 en 390×844 met touch-emulatie.

---

## FASE E — Afwerking ✅ gedaan 2026-11-08

- Hardcoded strings naar i18n (o.a. `Nog geen eigen oplossing opgeslagen`, `poorten:`/`verboden:` in de kicker).
- Legacy "Project N"-label vervangen door module + lesnummer ("Poorten · les 1/19").
- Lege staten met één concrete actie; consistente knophiërarchie (één primaire knop per scherm).

**Uitgevoerd:**
- Alle hardcoded NL-teksten naar `src/i18n/en.js` + `nl.js`: verbindingsfouten, simulatiefouten (`src/sim/evaluate.js`), chip-interfacefouten, verificatie-samenvattingen, deel-dialogen, beschrijvingen van onderdelen (`partCopy.*`) en starter-chips (weergave in de huidige taal). Controle: een scan van alle schermen in EN vindt geen Nederlands meer.
- Nieuwe chipversie alleen bij een gewijzigde schakeling (`src/model/circuit-signature.js`: verplaatsen en schakelen tellen niet mee).
- Verificatie weigert de starter-chip als oplossing van de les die die chip bouwt (`checkStarterShortcut`).
- Lege staten: chipbibliotheek met knop "Sla deze sheet op als chip"; palet-tekst verschilt tussen les en Vrij bouwen.
- Knophiërarchie: één primaire knop per scherm — "Ga verder/Start" op het overzicht (module met de volgende les krijgt een accentrand), "Controleer" in de les; Parts is een sterke secundaire knop.
- Legacy "Project N"-label was al in fase B verdwenen.

---

# RONDE 2 — Van werkende structuur naar prettig gereedschap (fase F t/m J)

**Status:** gepland 2026-11-10, nog niets uitgevoerd.

**Voor wie:** een kleiner coding-model dat zelfstandig werkt. Daarom zijn de stappen klein, staan bestanden, selectors en waarden erbij en heeft elke stap een "Niet doen". Lees eerst "Uitvoeringsregels ronde 2" onderaan dit hoofdstuk.

## Uitgangssituatie (gecontroleerd 2026-11-10, schermafdrukken op 1440×900, 1180×820 en 820×1180)

Fase A–E hebben de structuur goed gezet (drie schermen, les 0, coach, gefilterd palet). Wat nog wringt:

1. **Canvas onleesbaar klein.** `.node` is 82px breed, labels 0.42–0.52rem (±7px). Op desktop is ±90% van het canvas leeg.
2. **Uit = rood.** `--pin-low-bg` en `--wire-low` zijn rood; een 0-signaal leest als fout.
3. **Nieuwe onderdelen landen verkeerd.** In les 0 komt de AND rechtsonder, voorbij de LAMP; draden lopen terug.
4. **Verbinden alleen klik-klik.** Geen meebewegende draad, niet slepen (`handlePinClick` in `src/actions/circuit-mutations.js`).
5. **Les toont alles tegelijk.** Zes stappen open; "Doel" en "Snap het" zijn hardcoded `is-done` (`renderChallengeDetail` in `src/ui/panels.js`); "Controleer" staat onder de vouw; theorie verklapt soms de oplossing (XOR).
6. **Coachballon ligt over de lestekst** (stap 1 van les 0).
7. **Ruis.** Kop "Huidige sheet", twee statusregels linksonder, Inspector-chip in lessen, palet achter een dropdown rechtsboven, kader in kader in kader, bruine lespaneeltint (`--challenge-card-bg`).
8. **Startscherm is een dashboard.** Twee Start-knoppen + leslink voor dezelfde actie, zes ringen op 0%, vijf keer "Vergrendeld".
9. **Engels in NL.** Parts, toggle, Sheets, Snapshot, Duplicate, Delete, Inspector, Checks, Reset State, en 39 lestitels "Build …".
10. **Geen typografisch systeem.** 40 verschillende `font-size`-waarden in `styles.css`.

## Ontwerpbesluiten ronde 2

- **Signaalkleur:** uit = neutraal grijs, aan = groen (bestaande `--signal-high`). Rood alleen voor fouten (`--wire-invalid`, `--warning`).
- **Onderdelen** minimaal 132px breed; kleinste tekst op het canvas 0.62rem.
- **Draad:** slepen van uitgang naar ingang; klik-klik blijft werken.
- **Les:** vier stappen (Intro → Bouw → Begrepen? → Verder), één stap tegelijk open, één vaste actiebalk onderaan het lespaneel.
- **Palet:** altijd zichtbare strook (`#parts-strip`), op elk schermformaat. De Parts-dropdown verdwijnt.
- **Start:** één "Ga verder"-kaart en daaronder het leerpad als één kolom.
- **Thema's** donker/licht/neon blijven bestaan. Elke kleurwijziging in alle drie de themablokken (`:root,[data-theme="dark"]`, `[data-theme="light"]`, `[data-theme="neon"]`).
- **Functionaliteit blijft volledig.** Niets wordt verwijderd, alleen verplaatst of pas getoond wanneer nodig.

## Volgorde

F.1 → F.2 → F.3 → F.4 → F.5 → F.6 → G.1 → G.2 → G.3 → G.4 → G.5 → H.0 → H.1 → H.2 → H.3 → H.4 → I.1 → I.2 → I.3 → J.1 → J.2 → J.3.
Eén branch per fase (`ux/fase-f-canvas`, `ux/fase-g-les`, …), één commit per stap.

---

## FASE F — Canvas leesbaar en direct ✅ gedaan 2026-11-11

### Stap F.1: Uit is grijs, niet rood

**Bestanden:** `styles.css` (alleen de drie themablokken bovenaan).

**Taken:**
1. Zet in elk themablok:

   | Variabele | dark | light | neon |
   |---|---|---|---|
   | `--pin-low-bg` | `#484f58` | `#afb8c1` | `#16402a` |
   | `--pin-low-border` | `#6e7681` | `#8c959f` | `#1f5c3a` |
   | `--wire-low` | `rgba(110, 118, 129, 0.75)` | `rgba(140, 149, 159, 0.85)` | `rgba(31, 92, 58, 0.9)` |

2. Controleer dat `--wire-invalid` en `--warning` rood blijven.

**Niet doen:** geen andere variabelen wijzigen; geen JS.

**Acceptatie:** in les 0 met alles uit is er geen rood op het canvas. Een ongeldige draad is nog wel rood.

### Stap F.2: Grotere onderdelen

**Bestanden:** `styles.css` (blok rond `.node {`, ±regel 1422–1720, en `@media (pointer: coarse)` ±regel 3656), `src/actions/workspace-mutations.js` (`populateChallengeWorkspace`).

**Taken:**
1. `.node`: `width: 132px; min-height: 64px; padding: 0.4rem 0.45rem`.
2. Tekst: `.node-label` 0.74rem, `.node-state-pill` 0.62rem, `.pin-label` 0.66rem, `.gate-symbol` 1rem, `.gate-meta` 0.7rem, `.node-mini-button` 0.7rem. `.pin-badge` 10×10px.
3. `@media (pointer: coarse)`: node 148px breed; pins blijven ≥ 26px met tikzone 32px (niet verkleinen).
4. `populateChallengeWorkspace`: `inputStep` en `outputStep` minimaal 120 (was 90).
5. Open een les met veel pins (bijv. een 16-bit les in module 4) en controleer dat niets overlapt; verhoog zo nodig alleen de stapgrootte.

**Niet doen:** geen wijziging in `src/ui/canvas.js` (draden meten de pinpositie uit de DOM en volgen vanzelf).

**Acceptatie:** op 1440×900 bij 100% zoom is elk label op een onderdeel leesbaar zonder in te zoomen; `npm run e2e` groen.

### Stap F.3: Rustiger onderdelen

**Bestanden:** `src/ui/canvas.js` (`renderNode`, `renderNodeBody`, `getNodeTag`, `getNodeSymbol`), `styles.css`, `src/i18n/en.js`, `src/i18n/nl.js`.

**Taken:**
1. Toon `.node-state-pill` niet als de tekst gelijk is aan de titel, en niet voor `input-pin`, `output-pin`, `switch` en `lamp` (nu staat er "AND AND" en "DOOR IN").
2. Poortsymbolen in `getNodeSymbol`: NOT `1`, AND `&`, OR `≥1`, XOR `=1`, NAND `&`, NOR `≥1`. Voor NOT, NAND en NOR een klein inversiebolletje rechts van het vlak: extra class `is-inverting` op `.gate-face` + CSS `::after` (cirkel 8px, rand in tekstkleur).
3. Schakelbare onderdelen (`switch`, `input-pin`, `clock`): vervang de tekstknop "toggle" door een schakelaar. Houd **hetzelfde `<button>` met dezelfde `data-node-action` en `data-node-id`**; geef het class `node-switch-toggle`, `aria-pressed="true|false"` en als tekst de waarde (`0` of `1`). Stijl: pilvorm 44×24px, uit = grijs, aan = `--signal-high`. Bij een brede pin (width > 1) blijft de huidige weergave.
4. De i18n-sleutel `toggle` wordt de `aria-label` ("Omschakelen" / "Toggle").

**Niet doen:** `data-node-action`-waarden hernoemen (e2e gebruikt `[data-node-action="toggle-input-pin"]`).

**Acceptatie:** AND-poort toont één keer "AND"; schakelaar is met één tik om te zetten en toont 0/1; e2e groen.

### Stap F.4: Nieuw onderdeel landt tussen in- en uitgangen

**Bestanden:** `src/actions/workspace-mutations.js` (`getSuggestedNodePosition`), `e2e/nand-flow.spec.js` of `e2e/smoke-check.spec.js` (één extra assert).

**Taken:**
1. Als er géén geselecteerde node is én het werkblad heeft minstens één `input-pin` en één `output-pin`: zet `preferred` op
   - `x` = midden tussen (grootste rechterrand van de input-pins) en (kleinste `x` van de output-pins), min de halve breedte van de nieuwe node;
   - `y` = gemiddelde `y` van de input-pins.
2. De bestaande `search` kiest daarna de dichtstbijzijnde vrije plek; die logica niet aanpassen.
3. Is er wel een geselecteerde node: huidig gedrag (rechts ernaast) blijft.
4. E2E: plaats in les 0 een AND en controleer `DOOR.x < AND.x < LAMP.x`.

**Niet doen:** obstakel- en `pendingReveal`-logica herschrijven.

**Acceptatie:** in les 0 landt de eerste AND tussen de schakelaars en de lamp; een tweede onderdeel overlapt niet.

### Stap F.5: Draad slepen met voorbeeldlijn

**Bestanden:** `src/ui/events.js` (pin-afhandeling rond regel 85 en 130), `src/actions/circuit-mutations.js` (`handlePinClick`), `src/ui/canvas.js` (draadlaag, rond regel 320), `script.js` (`bindTouchGestures`, alleen de uitzondering in taak 5), `styles.css`.

**Taken:**
1. `pointerdown` op een uitgangspin: zet `state.pendingConnection` (zoals nu) en onthoud het startpunt.
2. `pointermove` terwijl `state.pendingConnection` bestaat (ook na een gewone klik, dus zonder ingedrukte knop): teken één `<path class="wire-preview">` in `#wire-layer` van het midden van de bronpin naar de aanwijzer, zelfde curvevorm als bestaande draden. Werk alleen dit pad bij; **geen** `renderWorkspace()` per beweging.
3. `pointerup` boven een ingangspin (`document.elementFromPoint` → `closest('[data-pin-direction="input"]')`): roep dezelfde code aan als de bestaande klik op een ingang (`connectPins` + `setStatus`).
4. `pointerup` ergens anders: minder dan 8px bewogen → behandel als klik (pending blijft, klik-klik werkt nog); anders annuleren.
5. Terwijl er een pending verbinding is: class `is-wiring` op `#workspace-canvas`. CSS: `.is-wiring .pin.direction-input` krijgt een accentring; uitgangen dimmen. In `bindTouchGestures`: een `pointerdown` op een pin start geen pan.
6. `Escape` en een klik op leeg canvas annuleren (bestaat al; controleer dat het voorbeeldpad dan verdwijnt).
7. E2E: één test die met `page.mouse` van een uitgang naar een ingang sleept en controleert dat er een draad bij is gekomen.

**Niet doen:** `connectPins` of validatie wijzigen; de tikzones van fase D verkleinen.

**Acceptatie:** slepen én klik-klik maken een draad, met muis en met touch (viewport 820×1180 met touch-emulatie); bestaande e2e groen.

### Stap F.6: Les opent passend in beeld

**Bestanden:** `script.js` (`fitToContent`, `openLesson`).

**Taken:**
1. Roep bij het openen van elke les `fitToContent({ minZoom: 0.6, maxZoom: 1.25 })` aan, op elk schermformaat (nu alleen op smal canvas).
2. Houd rekening met de palet-strook en zwevende kaarten via de bestaande `getReservedStageRects`.

**Acceptatie:** les 0 op 1440×900: de schakeling beslaat minstens de helft van de canvasbreedte en staat niet tegen een rand.

---

## FASE G — Les: één stap tegelijk ✅ gedaan 2026-11-11

### Stap G.1: Vier eerlijke stappen

**Bestanden:** `src/ui/panels.js` (`renderChallengeDetail`, `renderStep`), `script.js` (state), `src/i18n/en.js`, `src/i18n/nl.js`.

**Taken:**
1. Voeg samen tot vier stappen met keys `intro`, `build`, `quiz`, `next`:
   - **intro** = huidig "Doel" + "Snap het";
   - **build** = huidig "Bouw" + "Controleer" (hints, "Laat zien hoe", live-tabel, feedback);
   - **quiz** en **next** ongewijzigd.
2. Nieuwe state `state.introSeen = {}` (per `challenge.id`, niet opslaan). Intro geldt als gezien wanneer: de gebruiker op "Aan de slag" klikt (`data-intro-done="<id>"`), óf het werkblad meer nodes heeft dan het lessjabloon, óf de les al voltooid is.
3. Huidige stap: `intro` (niet gezien) → `build` (tot geslaagd) → `quiz` (als er een quiz is en die niet af is) → `next`.
4. Alleen stappen vóór de huidige zijn `is-done`. Verwijder de hardcoded `"is-done"` bij doel en theorie.
5. Nieuwe sleutels: `stepIntro` ("Intro" / "Intro"), `introStart` ("Aan de slag" / "Let's build"). `stepBuild` blijft.

**Niet doen:** `data-submit-challenge`, `data-next-lesson`, `data-live-check`, `data-reveal-hint`, `data-coach-start`, `data-quiz-*` hernoemen.

**Acceptatie:** nieuwe les opent op Intro zonder vinkjes; na "Aan de slag" is Intro afgevinkt en Bouw actief.

### Stap G.2: Alleen de huidige stap open

**Bestanden:** `src/ui/panels.js`, `styles.css`.

**Taken:**
1. Bovenaan het lespaneel een voortgangsrij `.lesson-progress`: per stap een bolletje + korte titel (done / current / upcoming).
2. Alleen de huidige stap toont zijn inhoud. Afgeronde stappen zijn één regel (✓ + titel) en klappen open bij een klik (`state.expandedStep[challengeId]`); komende stappen zijn één gedimde regel zonder inhoud.
3. Verwijder de statuschip "Open/Needs Work" in `.challenge-head` (de voortgangsrij vervangt hem); "Verified" blijft als ✓ bij de titel.

**Acceptatie:** les 1 t/m 5 op 1440×900: het lespaneel hoeft in geen enkele stap te scrollen, behalve bij een uitgeklapte lange theorie.

### Stap G.3: Vaste actiebalk

**Bestanden:** `src/ui/panels.js`, `index.html` (alleen als er een container bij moet), `styles.css`, `e2e/*.spec.js`.

**Taken:**
1. Onderaan `#lesson-panel` een vaste balk `.lesson-actionbar` (`position: sticky; bottom: 0`) met links een korte status en rechts precies één primaire knop:

   | Stap | Status | Knop |
   |---|---|---|
   | intro | — | "Aan de slag" (`data-intro-done`) |
   | build | "2 van 4 rijen kloppen" (uit de live-check) | "Controleer" (`data-submit-challenge`) |
   | quiz | "Beantwoord de vraag" | geen |
   | next | "✓ Les afgerond" | "Volgende les →" (`data-next-lesson`) |

2. Verwijder de losse knoppen "Controleer mijn schakeling" en "Volgende les" uit de stapinhoud, zodat er per stap één primaire knop is.
3. Het opgevouwen onderpaneel (< 1024px, `data-peek-check`) blijft werken en toont dezelfde status.
4. Pas e2e-selectors aan waar ze op de oude knoppositie leunen.

**Acceptatie:** "Controleer" is in de bouwstap altijd zichtbaar zonder scrollen, op alle drie de testviewports.

### Stap G.4: Korte intro, geen verklapte oplossing

**Bestanden:** `src/ui/panels.js`, `src/i18n/*.js`, `AGENT_LOG.md`.

**Taken:**
1. Intro toont: doel, de begrippen-chips en alléén de eerste theorie-alinea (`localized.theory[0]`).
2. Overige alinea's achter een ingeklapte `<details>` "Meer uitleg" (sleutel `theoryMore`; "Meer uitleg" / "More background"), standaard dicht.
3. Verwijder de regel `A, B → OUT` (`.lesson-interface`) uit de bouwstap; de pins staan al op het canvas.
4. Loop alle lessen langs in NL en noteer in `AGENT_LOG.md` de les-id's waarvan `theory[0]` zelf de bouwwijze verklapt (noemt welke poorten je hoe verbindt). **Alleen noteren, niet herschrijven**: lesinhoud is aan de eigenaar.

**Acceptatie:** bij XOR staat de NAND-formule niet meer in beeld tenzij je "Meer uitleg" opent.

### Stap G.5: Coachballon nooit over de tekst

**Bestanden:** `src/ui/tutorial.js` (`positionCoach`), `styles.css`.

**Taken:**
1. Ligt het doel ín `#lesson-panel` (brede schermen): plaats de ballon rechts naast het paneel, verticaal op hoogte van het doel, met het pijltje naar links.
2. Stap zonder doel (welkom): ballon gecentreerd op het canvas.
3. Ballon mag het doel en de primaire knop in `.lesson-actionbar` nooit overlappen; schuif anders naar boven.
4. Smalle schermen: ballon boven het onderpaneel.

**Acceptatie:** loop alle 9 stappen van les 0 door op 1440×900 en 820×1180; in geen stap ligt de ballon over lestekst of over het aangewezen element.

---

## FASE H — Rust op het scherm ✅ gedaan 2026-11-11

### Stap H.0: Voortgangsrij weg, quiz overslaan mag (besluit eigenaar 2026-11-11)

**Bestanden:** `src/ui/panels.js`, `script.js` (state), `styles.css`, `src/i18n/nl.js`, `src/i18n/en.js`, e2e waar nodig.

**Taken:**
1. Verwijder de horizontale voortgangsrij `.lesson-progress` bovenaan het lespaneel (markup + CSS). De verticale staplijst blijft de enige stapweergave.
2. Quiz overslaan: in de quiz-stap toont de actiebalk een secundaire (ghost) knop "Sla over" / "Skip" (`data-quiz-skip="<challengeId>"`). Daarna is de huidige stap `next` en is "Volgende les →" bereikbaar.
3. De quiz blijft aangeboden: een overgeslagen quiz-stap is NIET afgevinkt; hij blijft als regel in de staplijst staan met het label "Nog te doen" / "Still open" en klapt open bij een klik, zodat de vraag alsnog beantwoord kan worden. Na beantwoorden krijgt hij zijn vinkje.
4. State: `state.quizSkipped = {}` per `challenge.id`, in het geheugen (niet opslaan). Bij het heropenen van een voltooide les met onbeantwoorde quiz: huidige stap is `next`, quiz-regel toont "Nog te doen".
5. "Opnieuw beginnen" (`data-open-challenge` met fresh) zet `state.introSeen` en `state.quizSkipped` voor die les terug, zodat de les weer bij Intro opent.
6. E2E: de helper `answerQuiz` blijft; één test slaat de quiz over, gaat naar de volgende les en ziet dat de quiz-regel "Nog te doen" toont.

**Acceptatie:** geen dubbele stapweergave meer; met "Sla over" kom je bij "Volgende les"; de quiz is daarna nog te openen en te beantwoorden.

### Stap H.1: Palet als vaste strook op elk scherm

**Bestanden:** `src/ui/panels.js` (`renderBuiltinPalette`, het `dom.partsStrip`-deel), `styles.css`, `index.html`, `src/ui/tutorial.js` (`partButton`), `e2e/helpers.js` (`placePart`), `src/i18n/*.js`.

**Taken:**
1. Toon `#parts-strip` op elk formaat: ≥ 1024px liggend als verticale strook van ±96px aan de linkerrand van het canvas; daaronder horizontaal onderin (bestaand).
2. Elke knop: label + het symbool uit `getNodeSymbol`; `title` = de beschrijving (`partCopy.*`).
3. Groepen met een dunne scheidingslijn: in/uit · poorten · bus/klok/geheugen · eigen chips. De strook scrollt als hij niet past.
4. "Leer je later"-onderdelen als uitgeschakelde knoppen met 🔒 achteraan (titel = `paletteLockedTitle`).
5. Verberg `.parts-dropdown` met CSS (`display: none`); laat de DOM en `#builtin-palette` staan zodat bestaande code niet breekt.
6. `placePart` in `e2e/helpers.js` klikt voortaan `#parts-strip [data-strip-part="<type>"]`. De coach (`partButton`) wijst altijd de strook aan.

**Niet doen:** de `data-strip-part` / `data-strip-chip`-attributen hernoemen.

**Acceptatie:** onderdeel plaatsen kost één tik op elk schermformaat; in Vrij bouwen zijn alle onderdelen en chips via de strook bereikbaar; e2e groen.

### Stap H.2: Kop "Huidige sheet" weg

**Bestanden:** `index.html`, `styles.css`, `script.js` (waar `#sim-controls` zichtbaar wordt gemaakt).

**Taken:**
1. Verberg `.workspace-heading` (laat `#workspace-title` in de DOM; code schrijft ernaar).
2. `.workspace-header` is alleen zichtbaar als `#sim-controls` zichtbaar is; anders `display: none` (class `has-sim` zetten op dezelfde plek waar `sim-controls.hidden` wordt gezet).
3. In Vrij bouwen staat de naam van het actieve werkblad in de app-balk naast de tabs.

**Acceptatie:** bij een combinatorische les is er geen balk boven het canvas; bij een sequentiële les staan daar alleen de klokknoppen.

### Stap H.3: Eén statusmelding

**Bestanden:** `script.js` (`setStatus`, regel ±219), `src/ui/canvas.js` (verbindingsstatus rond regel 381), `styles.css`, `src/i18n/*.js`.

**Taken:**
1. `#status-line` wordt een toast: `setStatus` zet de tekst en class `is-visible`; na 4 seconden gaat de class eraf (CSS-fade via `opacity`). De tekst blijft in de DOM staan (e2e leest hem).
2. Geen standaardtekst meer bij het laden (`statusDefault` leeg laten tonen = onzichtbaar).
3. `#connection-status` is alleen zichtbaar terwijl `state.pendingConnection` bestaat.

**Acceptatie:** in rust staat er linksonder in het canvas niets; een actie toont kort één melding.

### Stap H.4: Eigenschappen alleen wanneer nuttig

**Bestanden:** `src/ui/inspector.js` of waar `#inspector-card` wordt getoond, `styles.css`.

**Taken:**
1. In een les: toon `#inspector-card` alleen als het geselecteerde onderdeel een type heeft buiten `gate`, `switch`, `lamp`, `input-pin`, `output-pin`, `chip-instance` (dus wel bij splitter, joiner, clock, register, rom, screen, keyboard).
2. In Vrij bouwen: ongewijzigd.

**Acceptatie:** een poort selecteren in les 1 toont geen Inspector-chip; een splitter in een bus-les wel.

---

## FASE I — Startscherm als pad

### Stap I.1: Eén "Ga verder"-kaart

**Bestanden:** `src/ui/course.js` (`renderCourse`), `styles.css`, `src/i18n/*.js`.

**Taken:**
1. De hero wordt één kaart: kleine kop (module + "les x van y"), lestitel groot, één regel beschrijving, totaalbalk ("3 van 41 lessen") en de primaire knop (`data-course-continue` blijft).
2. Nieuwe gebruiker: zelfde kaart met de welkomsttekst; geen aparte tweede titel.

**Acceptatie:** precies één `.primary-button` op het startscherm.

### Stap I.2: Modules als één kolom

**Bestanden:** `src/ui/course.js`, `styles.css`.

**Taken:**
1. `.course-modules`: één kolom, max-breedte 720px, gecentreerd.
2. Per module één rij: nummer, titel, "x/y" en een dunne voortgangsbalk (vervangt `renderProgressRing`).
3. De module met de volgende les is opengeklapt met haar lessen; de volgende les heeft class `next` en een "→".
4. Vergrendelde modules: één gedimde rij met 🔒, zonder de tekst "Vergrendeld" en zonder lessenlijst.
5. Verwijder de knop `.course-module-start` (de lesrij is de actie). `data-course-lesson` op de lesrijen blijft.

**Niet doen:** `openLessonFromHome` in `e2e/helpers.js` breken: `.course-lessons` met `summary` en `.course-lesson[data-course-lesson]` moeten blijven bestaan voor ontgrendelde modules.

**Acceptatie:** verse gebruiker ziet op 1440×900 de kaart en alle moduleregels zonder scrollen.

### Stap I.3: Vrije modus naar ⚙

**Bestanden:** `index.html` (⚙-menu, onder "Begeleiding"), `src/ui/course.js`, `src/ui/workspace-actions.js` (bestaande handler rond regel 280), `e2e/helpers.js` (`enableFreeMode`).

**Taken:**
1. Verplaats het vinkje `data-toggle-free-mode` naar het ⚙-menu; houd het attribuut. Zorg dat één handler het afhandelt en dat de stand bij elke render klopt.
2. `enableFreeMode` opent eerst `#settings-menu` en gebruikt `#settings-menu [data-toggle-free-mode]`.
3. De kaart "Vrij bouwen" op het startscherm: vergrendeld = één gedimde regel; ontgrendeld = gewone rij met knop.

**Acceptatie:** e2e groen; het startscherm heeft geen losse checkbox meer.

---

## FASE J — Stijl en taal

### Stap J.1: Typografie- en radiusschaal

**Bestanden:** `styles.css`.

**Taken:**
1. Tokens in `:root`: `--fs-xs: 0.75rem; --fs-sm: 0.875rem; --fs-md: 1rem; --fs-lg: 1.25rem; --fs-xl: 1.75rem;` en `--radius-sm: 8px; --radius: 12px; --radius-pill: 999px;`.
2. Vervang elke `font-size` buiten de canvas-selectors (`.node*`, `.pin*`, `.gate*`, `.wire*`) door het dichtstbijzijnde token. Niets in de interface kleiner dan `--fs-xs`.
3. `--font-display` en `--font-body`: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (geen webfonts; de app werkt offline).
4. Eyebrow-teksten in hoofdletters: maximaal één per scherm; de rest gewone kleine tekst.

**Acceptatie:** `grep -o "font-size: [^;]*" styles.css | sort -u | wc -l` geeft ≤ 14 (was 40); schermafdrukken tonen geen afgebroken of overlopende tekst.

### Stap J.2: Eén oppervlak, minder kaders

**Bestanden:** `styles.css`.

**Taken:**
1. `--challenge-card-bg` in alle drie de thema's gelijk aan het paneeloppervlak (geen bruine tint); `.challenge-detail-card` binnen `#lesson-panel` zonder eigen rand en achtergrond.
2. App-balk: geen eigen kader; alleen een onderlijn.
3. Maximaal twee niveaus: pagina → paneel. Geen paneel in een paneel (ook in het sandbox-paneel: werkbladkaarten zonder dubbele rand).
4. Eén accentkleur (`--accent`) voor de primaire actie en de huidige stap; groen alleen voor "aan" en "klopt".

**Acceptatie:** op het lesscherm zijn er hooguit twee geneste randen zichtbaar rond lestekst.

### Stap J.3: Nederlands in NL

**Bestanden:** `src/i18n/nl.js`, `src/i18n/en.js` (alleen de twee gewijzigde zinnen), `src/data/locales/challenges-nl.js`, `src/ui/panels.js` (hardcoded restanten).

**Taken:**
1. `nl.js`:

   | Sleutel | Nieuw |
   |---|---|
   | `parts` | Onderdelen |
   | `sheets` | Werkbladen |
   | `sheetsAndChips` | Werkbladen & chips |
   | `snapshot` | Opslaan als chip |
   | `inspector` | Eigenschappen |
   | `checks` | Meldingen |
   | `workspaceOpen` | Openen |
   | `workspaceDuplicate` | Dupliceren |
   | `workspaceDelete` | Verwijderen |
   | `toggleClocks` | Klok omzetten |
   | `stepRegisters` | Eén stap |
   | `play` | ▶ Afspelen |
   | `resetState` | Reset |
   | `connectionHint` | Sleep van een uitgang naar een ingang. |
   | `buildInstruction` | Tik een onderdeel in de strook aan en sleep draden van uitgang naar ingang. |

2. `en.js`: `connectionHint` → "Drag from an output to an input."; `buildInstruction` → "Tap a part in the strip and drag wires from output to input."
3. `challenges-nl.js`: titels "Build X" → "Bouw X" (39 stuks). Alleen het veld `title`; id's en `challenges.js` niet aanraken. Controleer eerst in `scripts/extract-challenge-locales.js` of het bestand gegenereerd wordt en pas dan de bron aan in plaats van de uitvoer.
4. Zoek in `src/ui/panels.js` en `index.html` naar resterende Engelse zichtbare tekst in NL-modus ("Saved chips", "Basic parts", "nodes • wires") en zet die om naar i18n-sleutels in beide talen.
5. Herhaal de scan uit fase E: alle schermen in NL, noteer wat Engels blijft (vaktermen als NAND, chip, ROM mogen).

**Acceptatie:** in NL staat er op start-, les- en bouwscherm geen Engels meer buiten vaktermen; in EN geen Nederlands.

---

## Uitvoeringsregels ronde 2 (aanvulling op de regels hieronder)

1. **Eén stap, één commit.** Voer alleen de taken van die stap uit. Zie je iets anders dat beter kan: noteer het onder "Bevindingen" in `AGENT_LOG.md` en laat het staan.
2. **Na elke stap:** `npm test`, `npm run check`, `npm run e2e`. Alle drie groen vóór de commit.
3. **Kijk zelf.** Maak na elke stap schermafdrukken op 1440×900, 1180×820 en 820×1180 (touch) van start, les 0 en Vrij bouwen, en bekijk ze. Een stap is pas klaar als de acceptatie zichtbaar klopt.
4. **Tests nooit verwijderen of overslaan** om groen te krijgen. Verandert een selector, pas dan `e2e/helpers.js` aan in dezelfde stap.
5. **Twee pogingen.** Lukt de acceptatie na twee pogingen niet: stop, zet de wijziging terug, beschrijf in `AGENT_LOG.md` wat er misging en ga niet door naar de volgende stap.
6. **Niet aanraken:** `src/sim/`, `src/challenges/`, `src/data/challenges.js`, `src/state/project.js` (opslagformaat). Geen nieuwe dependencies, geen build-stap, geen framework.
7. **Bestaande `data-*`-attributen en id's blijven**, tenzij de stap uitdrukkelijk iets anders zegt.
8. **Alle drie de thema's** controleren bij elke kleur- of stijlwijziging.
9. **Nieuwe bestanden:** daarna `npm run build:sw` zodat de offline-cache klopt.
10. **Na elke fase:** zet "✅ gedaan <datum>" achter de fasekop, schrijf "Uitgevoerd" en "Bevindingen" zoals bij fase A–E, en open een pull request voor de fasebranch.

---

## Uitvoeringsregels

- Eén stap per keer; na elke stap `npm test`, `npm run check` en (waar relevant) `npm run e2e`.
- Simulatie- en verificatiemodules (`src/sim/`, `src/challenges/`) niet aanraken voor UI-werk.
- Nieuwe UI-teksten altijd in `src/i18n/en.js` én `nl.js`.
- Log per stap in `AGENT_LOG.md`: wat, aannames, resultaat.
