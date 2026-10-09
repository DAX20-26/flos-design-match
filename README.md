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
tests/            test automatici
```

## Test

Servono solo Node 20+ (nessuna dipendenza da installare).

```bash
npm test            # test delle meccaniche + bilanciamento dei livelli
npm run balance     # statistiche di vittoria con 200 partite simulate per livello
npm run test:ui     # (opzionale) test nel browser con Playwright/Chromium
```

I test verificano, tra l'altro: griglia iniziale senza combinazioni e con mosse disponibili, gravità e cascate, mosse non valide che non consumano mosse, nascita del Brucaliffo, scambio libero del Brucaliffo, esplosione finale, vittoria/sconfitta, rimescolamento anti-blocco, garanzia di completabilità (fuzz su 600 partite) e curva di difficoltà (giocatore esperto e giocatore distratto simulati).

## Pubblicazione su GitHub Pages

1. Unisci la pull request in `main`.
2. Su GitHub: **Settings → Pages**.
3. In *Build and deployment* scegli **Source: Deploy from a branch**, branch **main**, cartella **/ (root)**, poi **Save**.
4. Dopo circa un minuto il gioco è online su `https://<utente>.github.io/flos-design-match/`.

Non vengono usati font, script o immagini esterne: nessuna richiesta a terze parti, nessun cookie, nessun salvataggio sul dispositivo.
