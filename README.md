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

## Struttura

```
index.html        pagina unica (percorsi relativi, funziona da file:// e su GitHub Pages)
css/style.css     stile
js/engine.js      regole del gioco (logica pura, testabile in Node)
js/art.js         illustrazioni SVG (fiori, bruco, Brucaliffo)
js/fx.js          petali e coriandoli su canvas
js/game.js        interfaccia, input touch/mouse, animazioni
tests/            test automatici (motore, bilanciamento, UI nel browser, layout)
```

## Test

Servono solo Node 20+ (nessuna dipendenza da installare).

```bash
npm test            # test delle meccaniche + bilanciamento dei livelli (pochi secondi)
npm run balance     # statistiche di vittoria con 200 partite simulate per livello
npm run test:ui     # (opzionale) test nel browser: richiede Playwright con Chromium
```

**`npm test`** verifica, tra l'altro: griglia iniziale senza combinazioni e con mosse disponibili, gravità e cascate, mosse non valide che non consumano mosse, nascita del Brucaliffo, scambio libero del Brucaliffo, esplosione finale, vittoria/sconfitta, rimescolamento anti-blocco, garanzia di completabilità (600 partite casuali con controllo degli invarianti) e curva di difficoltà con due giocatori simulati (esperto e distratto).

**`npm run test:ui`** apre il gioco in Chromium e gioca davvero con mouse e tocchi: scenari costruiti ad hoc (esplosione, spostamenti liberi del Brucaliffo, rimescolamento, sconfitta e ripartenza), una partita completa fino alla schermata finale e un controllo del layout su 9 dimensioni di schermo (da 320×568 a 1920×1080, anche in orizzontale).

Risultati di bilanciamento (200 partite simulate per livello):

| Livello | Mosse | Giocatore esperto | Giocatore distratto |
|---|---|---|---|
| 1 | 22 | ~100% | ~100% |
| 2 | 18 | ~95% | ~80% |
| 3 | 16 | ~80% | ~50% |

La difficoltà cresce riducendo bruchi iniziali, bruchi generati e "quasi-combinazioni" già pronte; il motore però garantisce sempre che ci siano abbastanza bruchi in griglia per completare l'obiettivo.

## Pubblicazione su GitHub Pages

1. Unisci la pull request in `main`.
2. Su GitHub: **Settings → Pages**.
3. In *Build and deployment* scegli **Source: Deploy from a branch**, branch **main**, cartella **/ (root)**, poi **Save**.
4. Dopo circa un minuto il gioco è online su `https://<utente>.github.io/flos-design-match/`.

Non vengono usati font, script o immagini esterne: nessuna richiesta a terze parti, nessun cookie, nessun salvataggio sul dispositivo.
