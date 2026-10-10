# FLOS DESIGN MATCH

Il gioco floreale interattivo di **Flos Design** — un match-3 elegante e mobile-first, pensato per far sbocciare la community del brand.

Applicazione web **statica** (HTML + CSS + JavaScript, nessuna dipendenza, nessuna compilazione, nessun backend, nessun dato raccolto).

## Come si gioca

- Griglia 8×8 con quattro fiori — **margherita, tulipano, rosellina, campanula lilla** — e il **bruco verde**.
- Scambia due elementi adiacenti (trascinando o toccando prima uno e poi l'altro) per allineare almeno tre elementi uguali. Gli elementi eliminati lasciano posto a quelli superiori e ne arrivano di nuovi; le cascate sono possibili.
- Tre o più **bruchi** uniti scompaiono e generano un **Brucaliffo** (il cerchietto con perline di Flos Design, in diverse colorazioni).
- Il Brucaliffo non partecipa alle combinazioni normali, ma si può **spostare liberamente** scambiandolo con un elemento vicino, anche senza match (conta come una mossa).
- **Scambiando due Brucaliffo** il giardino esplode e il livello è completato.
- Tre livelli: **22 / 18 / 16 mosse**. Si perde solo esaurendo le mosse senza aver completato l'obiettivo; si ricomincia dal livello 1 (tentativi illimitati). Le mosse si consumano solo per azioni valide.

## Grafica della schermata di gioco

La schermata di gioco usa i colori del brand — **verde, magenta e rosa chiaro** — ed è composta, dall'alto in basso, da:

1. l'indicatore del livello (`LIVELLO 1 / 3`);
2. il fiore/logo **Flos Design**, ridisegnato in stile illustrato (stesso linguaggio dei fiori del gioco);
3. il box dell'obiettivo (mosse + i due Brucaliffo da creare e scambiare);
4. la griglia 8×8 su una card chiara che la separa dallo sfondo.

Dietro a tutto: uno **sfondo verde dipinto** (la tua texture, schiarita per non competere con la griglia) e due **liane floreali statiche** ai lati. I petali/foglioline in movimento restano leggerissimi (solo 3 e molto discreti nel gioco; di più nella schermata iniziale e finale). Le schermate iniziale e finale sono quelle di prima, solo armonizzate nei colori; nella finale il logo sostituisce la scritta dorata.

Come è stato integrato il logo: il fiore è un SVG (`assets/flos-logo.svg`, con il fregio di rametti; `assets/flos-fiore.svg` è la versione solo fiore). La sagoma del fiore e delle foglie ricalca il logo originale, simmetrizzata e ammorbidita; la scritta FLOS DESIGN è stata **vettorializzata dall'originale** (stessi caratteri, nitidi a qualsiasi dimensione). Gradienti, riflessi e vene delle foglie seguono lo stile degli altri disegni. Nella pagina è un normale `<img>` con testo alternativo `FLOS DESIGN`.

## Struttura

```
index.html            pagina unica (percorsi relativi, funziona da file:// e su GitHub Pages)
css/style.css         stile e palette
js/engine.js          regole del gioco (logica pura, testabile in Node)
js/art.js             illustrazioni SVG (fiori, bruco, Brucaliffo)
js/fx.js              petali e coriandoli su canvas
js/game.js            interfaccia, input touch/mouse, animazioni
assets/flos-logo.svg  fiore/logo Flos Design con fregio (schermata di gioco)
assets/flos-fiore.svg fiore/logo Flos Design senza fregio (schermata finale)
assets/liane.svg      liane floreali laterali (striscia ripetibile, statica)
assets/giardino-verde.jpg  sfondo verde dipinto della schermata di gioco
assets/favicon.svg    icona della scheda del browser
tests/                test automatici (motore, bilanciamento, asset, UI nel browser, layout, grafica)
```

Dopo aver cambiato CSS, JS o asset, aumenta il numero `?v=` nei collegamenti di `index.html`: così chi ha già visitato il gioco scarica subito i file nuovi.

## Test

Servono solo Node 20+ (nessuna dipendenza da installare).

```bash
npm test            # meccaniche + bilanciamento + controlli sugli asset (pochi secondi)
npm run balance     # statistiche di vittoria con 200 partite simulate per livello
npm run test:ui     # (opzionale) test nel browser: richiede Playwright con Chromium
```

**`npm test`** verifica, tra l'altro: griglia iniziale senza combinazioni e con mosse disponibili, gravità e cascate, mosse non valide che non consumano mosse, nascita del Brucaliffo, scambio libero del Brucaliffo, esplosione finale, vittoria/sconfitta, rimescolamento anti-blocco, garanzia di completabilità (600 partite casuali con controllo degli invarianti) e curva di difficoltà con due giocatori simulati (esperto e distratto).

Lo stesso `npm test` controlla anche gli asset: percorsi relativi (necessari su GitHub Pages), file presenti, riferimenti interni degli SVG, assenza di risorse esterne e peso contenuto.

**`npm run test:ui`** apre il gioco in Chromium e gioca davvero con mouse e tocchi: scenari costruiti ad hoc (esplosione, spostamenti liberi del Brucaliffo, rimescolamento, sconfitta e ripartenza), la nuova grafica (ordine livello → logo → obiettivo → griglia, logo leggibile, liane statiche e senza interferire con il tocco, sfondo non troppo scuro, contrasto del testo, nessun 404 servendo il sito da un sottopercorso come fa GitHub Pages), un controllo del layout su 9 dimensioni di schermo (da 320×568 a 1920×1080, anche in orizzontale) e una partita completa fino alla schermata finale.

Risultati di bilanciamento (200 partite simulate per livello):

| Livello | Mosse | Giocatore esperto | Giocatore distratto |
|---|---|---|---|
| 1 | 22 | ~100% | ~100% |
| 2 | 18 | ~95% | ~80% |
| 3 | 16 | ~80% | ~50% |

La difficoltà cresce riducendo bruchi iniziali, bruchi generati e "quasi-combinazioni" già pronte; il motore però garantisce sempre che ci siano abbastanza bruchi in griglia per completare l'obiettivo.

## Pubblicazione su GitHub Pages

Finché la pull request non viene unita in `main`, la versione pubblicata **non cambia**. Per vedere le modifiche prima: scarica il branch come ZIP (**Code → Download ZIP** dal branch della pull request) e apri `index.html` — il gioco funziona anche da file locale.

1. Unisci la pull request in `main`.
2. Su GitHub: **Settings → Pages**.
3. In *Build and deployment* scegli **Source: Deploy from a branch**, branch **main**, cartella **/ (root)**, poi **Save**.
4. Dopo circa un minuto il gioco è online su `https://<utente>.github.io/flos-design-match/`.

Non vengono usati font, script o immagini esterne: nessuna richiesta a terze parti, nessun cookie, nessun salvataggio sul dispositivo.
