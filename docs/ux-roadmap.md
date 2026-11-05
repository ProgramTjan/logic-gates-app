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
- Elke "Controleer" maakt een nieuwe chipversie; de chipbibliotheek groeit snel → **E**: alleen een nieuwe versie bij een gewijzigde schakeling.
- NL-strings in EN-modus: `Nog geen eigen oplossing opgeslagen`, `functionele tests geslaagd` (verificatiesamenvatting) → **E**.

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
- NL-beschrijvingen van onderdelen in EN-modus ("Publieke chipinput" e.d. in `builtinParts.js`) → **E**.
- Starter-chips zijn in een les-sheet nog wel via oude sheets/plakken bruikbaar en tellen dan mee in de verificatie → **E** (verificatie laten weigeren).

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

## FASE E — Afwerking

- Hardcoded strings naar i18n (o.a. `Nog geen eigen oplossing opgeslagen`, `poorten:`/`verboden:` in de kicker).
- Legacy "Project N"-label vervangen door module + lesnummer ("Poorten · les 1/19").
- Lege staten met één concrete actie; consistente knophiërarchie (één primaire knop per scherm).

---

## Uitvoeringsregels

- Eén stap per keer; na elke stap `npm test`, `npm run check` en (waar relevant) `npm run e2e`.
- Simulatie- en verificatiemodules (`src/sim/`, `src/challenges/`) niet aanraken voor UI-werk.
- Nieuwe UI-teksten altijd in `src/i18n/en.js` én `nl.js`.
- Log per stap in `AGENT_LOG.md`: wat, aannames, resultaat.
