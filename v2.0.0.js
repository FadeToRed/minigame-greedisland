/**
 *  GREED ISLAND - Minigame gatcha  |  CORE / LOGICA (su GitHub)
 *
 *  Questo file contiene tutta la logica del minigame.
 *  I dati (ID topic/sezione, carte, percentuali) arrivano da
 *  window.GREED, definito nel blocco config incollato nel forum.
 *
 *  Caricato via jsDelivr:
 *    https://cdn.jsdelivr.net/gh/UTENTE/REPO@main/greedisland-core.js
 *
 *  Vanilla JS, niente template literals (compatibile ForumFree).
 */
;(function() {

// -- Recupera i dati dal blocco config del forum --
var GREED = window.GREED;
if (!GREED) {
    console.warn('[GreedIsland] window.GREED non trovato: il blocco config nel forum manca o e\' caricato dopo. Script non avviato.');
    return;
}

// Le variabili che la logica usa, ricavate dalla config globale.
var CONFIG = {
    TOPIC_ID: GREED.TOPIC_ID,
    SECTION_ID: GREED.SECTION_ID,
    FIREBASE_DB_URL: GREED.FIREBASE_DB_URL,
    ENFORCE_TURN_RULE: GREED.ENFORCE_TURN_RULE,
    POST_TO_TOPIC: GREED.POST_TO_TOPIC
};

var IMG_BASE = GREED.IMG_BASE;
var RANK_WEIGHTS = GREED.RANK_WEIGHTS;

// Costruisce l'URL immagine di una carta dal suo numero.
//   5 -> IMG_BASE + '005.png' ;  -3 -> IMG_BASE + '-003.png'
function imgUrl(id) {
    var s;
    if (id < 0) {
        s = '-' + ('00' + Math.abs(id)).slice(-3);
    } else {
        s = ('00' + id).slice(-3);
    }
    return IMG_BASE + s + '.png';
}

// Ricostruisce l'array carte aggiungendo il campo img (URL) a ciascuna.
var CARDS = [];
(function() {
    var src = GREED.CARDS || [];
    for (var i = 0; i < src.length; i++) {
        CARDS.push({ id: src[i].id, rank: src[i].rank, img: imgUrl(src[i].id) });
    }
})();

// Carta malus: id dalla config, immagine costruita, rank null.
var MALUS_CARD = { id: GREED.MALUS_ID, rank: null, img: imgUrl(GREED.MALUS_ID) };

var TOTAL_CARDS = CARDS.length;


// GUARD  —  attivo solo nel topic scelto
// ----------------------------------------

var FW = window.HxHFramework;

if (!FW) {
    console.warn('[GreedIsland] HxHFramework non trovato. Script non avviato.');
    return;
}

if (!FW.location.isTopic() || FW.location.getTopicId() !== String(CONFIG.TOPIC_ID)) {
    return; // non siamo nel topic del minigame: esci silenziosamente
}

// UTENTE LOGGATO  —  letto dal DOM
// ----------------------------------------

/**
 * Ricava { id, name } dell'utente loggato dal link profilo nella barra utente.
 * Su ForumFree/ForumCommunity il link ha forma ?act=Profile&MID=12345.
 * Usa più selettori di fallback per robustezza.
 *
 * @returns {{id: string, name: string}|null}
 */
function getCurrentUser() {
    // Cerca un qualsiasi link a un profilo utente nell'area di intestazione.
    // NB: variabile chiamata 'anchors' e non con nomi tipo l-i-n-k-s
    //     seguiti da parentesi quadra, perché ForumFree censura quel
    //     pattern inserendo un '*' che rompe lo script.
    var anchors = document.querySelectorAll('a[href*="act=Profile"], a[href*="showuser="]');
    for (var i = 0; i < anchors.length; i++) {
        var node = anchors[i];
        var href = node.getAttribute('href') || '';
        var mid = href.match(/MID=(\d+)/) || href.match(/showuser=(\d+)/);
        var name = (node.textContent || '').replace(/\s+/g, ' ').trim();
        // Prendiamo il primo link col nome non vuoto (di solito è "Benvenuto Nome")
        if (mid && name) {
            return { id: mid[1], name: name };
        }
    }
    return null;
}

var USER = getCurrentUser();

if (!USER) {
    // Ospite o struttura DOM diversa: niente pannello.
    console.warn('[GreedIsland] Utente non identificato. Pannello non mostrato.');
    return;
}

// FIREBASE  —  REST API (niente SDK)
// ----------------------------------------
//
// Struttura dati:
//   /greedisland/players/<userId> = { name: "...", cards: { "3": true, "7": true } }
//   /greedisland/meta/lastDrawUserId = "<userId>"

var DB = CONFIG.FIREBASE_DB_URL.replace(/\/+$/, '');

function fbGet(path, callback) {
    fetch(DB + path + '.json')
        .then(function(r) { return r.json(); })
        .then(function(data) { callback(null, data); })
        .catch(function(e) { callback(e, null); });
}

function fbPut(path, value, callback) {
    fetch(DB + path + '.json', {
        method: 'PUT',
        body: JSON.stringify(value)
    })
        .then(function(r) { return r.json(); })
        .then(function(data) { callback(null, data); })
        .catch(function(e) { callback(e, null); });
}

// LOGICA DI GIOCO
// ----------------------------------------

function getCardById(id) {
    for (var i = 0; i < CARDS.length; i++) {
        if (CARDS[i].id === id) return CARDS[i];
    }
    return null;
}

/**
 * Numero carta formattato a 3 cifre: 5 -> "005", 62 -> "062".
 * Il malus (-3) diventa "-003".
 */
function cardNum(card) {
    if (card.id < 0) {
        return '-' + ('00' + Math.abs(card.id)).slice(-3);
    }
    return ('00' + card.id).slice(-3);
}

/**
 * Etichetta testuale di una carta: "Carta #005".
 * I nomi veri sono dentro le immagini, quindi qui usiamo il numero.
 */
function cardLabel(card) {
    return 'Carta #' + cardNum(card);
}

/**
 * Restituisce tutte le carte collezionabili di un dato rank.
 */
function cardsOfRank(rank) {
    var out = [];
    for (var i = 0; i < CARDS.length; i++) {
        if (CARDS[i].rank === rank) out.push(CARDS[i]);
    }
    return out;
}

/**
 * Sorteggia una carta secondo RANK_WEIGHTS.
 * 1) Sceglie un "esito" (un rank, oppure MALUS) pesato sulle percentuali.
 * 2) Se è MALUS, restituisce la carta -003. Altrimenti pesca a caso una
 *    carta collezionabile dentro il rank scelto.
 *
 * @returns {{card: object, isMalus: boolean}}
 */
function pickCard() {
    // Somma dei pesi (di norma 100, ma calcolata per robustezza).
    var total = 0;
    var key;
    for (key in RANK_WEIGHTS) {
        if (RANK_WEIGHTS.hasOwnProperty(key)) total += RANK_WEIGHTS[key];
    }

    // Estrazione pesata dell'esito.
    var roll = Math.random() * total;
    var acc = 0;
    var chosen = null;
    for (key in RANK_WEIGHTS) {
        if (!RANK_WEIGHTS.hasOwnProperty(key)) continue;
        acc += RANK_WEIGHTS[key];
        if (roll < acc) { chosen = key; break; }
    }
    if (chosen === null) chosen = 'B'; // fallback difensivo

    // Malus: nessuna carta collezionabile.
    if (chosen === 'MALUS') {
        return { card: MALUS_CARD, isMalus: true };
    }

    // Pesca una carta a caso nel rank scelto.
    var pool = cardsOfRank(chosen);
    if (pool.length === 0) {
        // Rank senza carte (non dovrebbe capitare): ripiega su tutta la lista.
        pool = CARDS;
    }
    var card = pool[Math.floor(Math.random() * pool.length)];
    return { card: card, isMalus: false };
}

/**
 * Esegue una pesca: controlla la regola dei turni, sorteggia una carta
 * secondo i pesi per rank, salva su Firebase (se non è il malus),
 * posta nel topic.
 */
function drawCard(onDone) {
    // 1. Regola dei turni: non due pesche consecutive dallo stesso utente.
    fbGet('/greedisland/meta/lastDrawUserId', function(err, lastId) {
        if (!err && CONFIG.ENFORCE_TURN_RULE && lastId && String(lastId) === String(USER.id)) {
            onDone({ ok: false, reason: 'turn' });
            return;
        }

        // 2. Sorteggia la carta (o il malus) secondo RANK_WEIGHTS.
        var pick = pickCard();
        var card = pick.card;
        var isMalus = pick.isMalus;

        // 3. Leggi lo stato attuale del giocatore.
        fbGet('/greedisland/players/' + USER.id, function(err2, player) {
            player = player || { name: USER.name, cards: {} };
            player.name = USER.name; // aggiorna nome in caso sia cambiato
            if (!player.cards) player.cards = {};

            // 4. Se NON è il malus, aggiungi la carta alla collezione.
            var isNew = false;
            if (!isMalus) {
                isNew = !player.cards[card.id];
                player.cards[card.id] = true;
            }

            // 5. Salva il giocatore (sempre, così il nome resta aggiornato;
            //    col malus la collezione resta invariata).
            fbPut('/greedisland/players/' + USER.id, player, function(err3) {
                if (err3) { onDone({ ok: false, reason: 'db' }); return; }

                // 6. Aggiorna lastDrawUserId (anche il malus "consuma" il turno).
                fbPut('/greedisland/meta/lastDrawUserId', USER.id, function() {
                    // 7. Posta nel topic.
                    var owned = countOwned(player);
                    announceDrawInTopic(card, owned, isMalus, function() {
                        onDone({ ok: true, card: card, isNew: isNew, owned: owned, isMalus: isMalus });
                    });
                });
            });
        });
    });
}

function countOwned(player) {
    if (!player || !player.cards) return 0;
    var n = 0;
    for (var i = 0; i < CARDS.length; i++) {
        if (player.cards[CARDS[i].id]) n++;
    }
    return n;
}

/**
 * Posta il risultato della pesca nel topic tramite il framework.
 */
function announceDrawInTopic(card, owned, isMalus, cb) {
    if (!CONFIG.POST_TO_TOPIC) {
        console.log('[GreedIsland] (post disattivato) ' + USER.name + ' -> ' + cardLabel(card));
        cb();
        return;
    }

    var html = buildDrawPostHTML(card, owned, isMalus);

    FW.requests.fetchToken(function(token) {
        if (!token) { console.error('[GreedIsland] token non recuperato'); cb(); return; }
        FW.requests.postComment(token, CONFIG.SECTION_ID, CONFIG.TOPIC_ID, html, function(ok) {
            if (!ok) console.warn('[GreedIsland] post non confermato');
            cb();
        });
    });
}

// HTML DEI POST  —  tutto inline (vincolo ForumFree)
// ----------------------------------------

function buildDrawPostHTML(card, owned, isMalus) {
    var label = cardLabel(card); // "Carta #NNN"

    if (isMalus) {
        // Post speciale per la carta -003 Eliminate: espulsione, nessuna carta.
        return '' +
            '<div style="border:1px solid #a03030;background:#2a1414;padding:14px;max-width:450px;font-family:montserrat,sans-serif;color:#f2c4c4;">' +
                '<div style="font-family:\'Alegreya Sans SC\',sans-serif;font-size:16px;color:#ff8080;margin-bottom:8px;text-align:center;letter-spacing:1px;">' +
                    'Hai pescato la carta:' +
                '</div>' +
                '<div style="text-align:center;margin:8px 0;">' +
                    '<img src="' + card.img + '" alt="' + escapeHTML(label) + '"' +
                    ' style="width:50%;height:auto;border:2px solid #a03030;border-radius:4px;">' +
                '</div>' +
                '<div style="text-align:center;font-size:13px;color:#ff8080;margin-top:8px;">' +
                    'Sei stato espulso da Greed Island! Nessuna carta ottenuta.' +
                '</div>' +
            '</div>';
    }

    // Post normale.  Immagine al 50% della sua larghezza naturale.
    var img = '<img src="' + card.img + '" alt="' + escapeHTML(label) + '"' +
        ' style="width:50%;height:auto;border:2px solid #79BD9A;border-radius:4px;">';

    return '' +
        '<div style="border:1px solid #3B8686;background:#292354;padding:14px;max-width:450px;font-family:montserrat,sans-serif;color:#E2F7C4;">' +
            '<div style="font-family:\'Alegreya Sans SC\',sans-serif;font-size:16px;color:#CFF09E;margin-bottom:8px;text-align:center;letter-spacing:1px;">' +
                'Hai pescato la carta:' +
            '</div>' +
            '<div style="text-align:center;margin:8px 0;">' +
                img +
            '</div>' +
            '<div style="text-align:center;font-size:14px;color:#E2F7C4;">' +
                '<b>' + escapeHTML(label) + '</b> &nbsp;<span style="color:#8FBEBA;">[Rank ' + escapeHTML(card.rank) + ']</span>' +
            '</div>' +
            '<div style="text-align:center;font-size:12px;color:#8FBEBA;margin-top:8px;">' +
                'Collezione: ' + owned + '/' + TOTAL_CARDS +
            '</div>' +
        '</div>';
}

function escapeHTML(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// UI  —  pannello laterale + modali (tutto inline)
// ----------------------------------------

var el = {}; // riferimenti agli elementi

function buildPanel() {
    var panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;top:120px;right:25px;z-index:9998;' +
        'display:flex;flex-direction:column;gap:8px;padding:10px;' +
        'background:#292354;border:2px solid #3B8686;' +
        'border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.4);' +
        'font-family:montserrat,sans-serif;';

    var title = document.createElement('div');
    title.textContent = 'GREED ISLAND';
    title.style.cssText = "font-family:'Alegreya Sans SC',sans-serif;" +
        'color:#CFF09E;font-weight:bold;font-size:14px;' +
        'letter-spacing:2px;text-align:center;margin-bottom:2px;';
    panel.appendChild(title);

    el.drawBtn       = makeButton('Pesca carta', 'fa-dice-d20',     '#79BD9A', '#292354');
    el.collectionBtn = makeButton('Collezione',  'fa-layer-group',  '#3B8686', '#E2F7C4');
    el.rankingBtn    = makeButton('Classifica',  'fa-ranking-star', '#3B8686', '#E2F7C4');

    panel.appendChild(el.drawBtn);
    panel.appendChild(el.collectionBtn);
    panel.appendChild(el.rankingBtn);

    document.body.appendChild(panel);

    el.drawBtn.addEventListener('click', onDrawClick);
    el.collectionBtn.addEventListener('click', openCollection);
    el.rankingBtn.addEventListener('click', openRanking);
}

/**
 * Crea un bottone con icona Font Awesome + etichetta testuale.
 * L'etichetta è in uno <span> separato (el._label) così possiamo
 * cambiarne il testo senza cancellare l'icona.
 */
function makeButton(label, iconClass, bg, fg) {
    var b = document.createElement('button');
    b.style.cssText = 'cursor:pointer;border:1px solid #3B8686;border-radius:5px;' +
        'padding:8px 14px;font-size:13px;font-weight:bold;background:' + bg +
        ';color:' + fg + ';min-width:150px;font-family:montserrat,sans-serif;' +
        'display:flex;align-items:center;justify-content:center;gap:8px;';

    var icon = document.createElement('i');
    icon.className = 'fa-solid ' + iconClass;

    var span = document.createElement('span');
    span.textContent = label;

    b.appendChild(icon);
    b.appendChild(span);
    b._label = span; // riferimento per cambiare testo senza toccare l'icona
    return b;
}

function onDrawClick() {
    el.drawBtn.disabled = true;
    el.drawBtn._label.textContent = 'Pesco...';

    drawCard(function(res) {
        if (!res.ok) {
            el.drawBtn.disabled = false;
            el.drawBtn._label.textContent = 'Pesca carta';
            if (res.reason === 'turn') {
                alert('Devi aspettare che peschi un altro giocatore prima di pescare di nuovo!');
            } else {
                alert('Errore durante la pesca. Riprova.');
            }
            return;
        }

        // Successo: il post è stato pubblicato. Ricostruiamo l'URL pulito
        // del topic con l'anchor #lastpost e forziamo una navigazione
        // completa con replace(), così si viene portati all'ultimo post
        // anche se l'URL corrente aveva già un hash.
        el.drawBtn._label.textContent = 'Fatto!';
        var topicUrl = 'https://' + location.hostname + '/?t=' + CONFIG.TOPIC_ID + '#lastpost';
        location.replace(topicUrl);
        // Fallback: se per qualche motivo replace() non ricarica
        // (stesso URL + stesso hash), forziamo comunque il reload.
        location.reload();
    });
}

// ── Modale generico ──────────────────────────────────────────────

function openModal(titleText, contentNode) {
    closeModal(); // eventuale modale aperto

    var overlay = document.createElement('div');
    overlay.id = 'gi-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;' +
        'background:rgba(0,0,0,.6);display:flex;align-items:center;' +
        'justify-content:center;font-family:montserrat,sans-serif;';

    var box = document.createElement('div');
    box.style.cssText = 'background:#292354;border:2px solid #3B8686;' +
        'border-radius:8px;max-width:560px;width:90%;max-height:80vh;' +
        'overflow:auto;box-shadow:0 4px 20px rgba(0,0,0,.5);';

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;' +
        'align-items:center;padding:12px 16px;background:#0B486B;' +
        'border-radius:6px 6px 0 0;';

    var h = document.createElement('div');
    h.textContent = titleText;
    h.style.cssText = "font-family:'Alegreya Sans SC',sans-serif;" +
        'color:#CFF09E;font-weight:bold;font-size:17px;letter-spacing:1px;';

    var x = document.createElement('button');
    x.className = 'fa-solid fa-xmark';
    x.style.cssText = 'cursor:pointer;background:transparent;border:none;' +
        'color:#CFF09E;font-size:18px;font-weight:bold;';
    x.addEventListener('click', closeModal);

    header.appendChild(h);
    header.appendChild(x);

    var body = document.createElement('div');
    body.style.cssText = 'padding:16px;';
    body.appendChild(contentNode);

    box.appendChild(header);
    box.appendChild(body);
    overlay.appendChild(box);

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeModal();
    });

    document.body.appendChild(overlay);
}

function closeModal() {
    var ex = document.getElementById('gi-modal-overlay');
    if (ex) ex.parentNode.removeChild(ex);
}

// ── Modale collezione ────────────────────────────────────────────

function openCollection() {
    var loading = document.createElement('div');
    loading.textContent = 'Caricamento...';
    loading.style.cssText = 'text-align:center;color:#8FBEBA;';
    openModal('La tua collezione', loading);

    fbGet('/greedisland/players/' + USER.id, function(err, player) {
        var owned = (player && player.cards) ? player.cards : {};
        var ownedCount = countOwned(player);

        var wrap = document.createElement('div');

        var summary = document.createElement('div');
        summary.style.cssText = 'text-align:center;font-size:14px;color:#CFF09E;margin-bottom:12px;';
        summary.innerHTML = '<b>' + ownedCount + '</b> / ' + TOTAL_CARDS + ' carte collezionate';
        wrap.appendChild(summary);

        var grid = document.createElement('div');
        grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;justify-content:center;';

        for (var i = 0; i < CARDS.length; i++) {
            var c = CARDS[i];
            var has = !!owned[c.id];

            var cell = document.createElement('div');
            cell.style.cssText = 'width:110px;text-align:center;font-size:11px;color:#E2F7C4;' +
                (has ? '' : 'opacity:.4;filter:grayscale(1);');

            var img = document.createElement('img');
            img.src = c.img;
            img.alt = cardLabel(c);
            img.style.cssText = 'width:100px;border:2px solid ' +
                (has ? '#79BD9A' : '#8FBEBA') + ';border-radius:4px;';

            var nm = document.createElement('div');
            nm.textContent = has ? cardLabel(c) : '???';
            nm.style.cssText = 'margin-top:4px;color:#E2F7C4;';

            cell.appendChild(img);
            cell.appendChild(nm);
            grid.appendChild(cell);
        }

        wrap.appendChild(grid);
        replaceModalBody(wrap);
    });
}

// ── Modale classifica ────────────────────────────────────────────

function openRanking() {
    var loading = document.createElement('div');
    loading.textContent = 'Caricamento...';
    loading.style.cssText = 'text-align:center;color:#8FBEBA;';
    openModal('Classifica collezionisti', loading);

    fbGet('/greedisland/players', function(err, players) {
        players = players || {};

        var rows = [];
        for (var uid in players) {
            if (!players.hasOwnProperty(uid)) continue;
            rows.push({
                id: uid,
                name: players[uid].name || ('Utente ' + uid),
                count: countOwned(players[uid])
            });
        }

        rows.sort(function(a, b) { return b.count - a.count; });

        var wrap = document.createElement('div');

        if (rows.length === 0) {
            wrap.textContent = 'Ancora nessun collezionista. Sii il primo a pescare!';
            wrap.style.cssText = 'text-align:center;color:#8FBEBA;';
            replaceModalBody(wrap);
            return;
        }

        var table = document.createElement('table');
        table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;';

        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            var tr = document.createElement('tr');
            tr.style.cssText = 'border-bottom:1px solid #3B8686;' +
                (String(r.id) === String(USER.id) ? 'background:#0B486B;' : '');

            var pos = document.createElement('td');
            pos.textContent = (i + 1);
            pos.style.cssText = 'padding:8px;width:36px;text-align:center;font-weight:bold;color:#CFF09E;';

            var nm = document.createElement('td');
            nm.textContent = r.name;
            nm.style.cssText = 'padding:8px;color:#E2F7C4;';

            var cnt = document.createElement('td');
            cnt.textContent = r.count + '/' + TOTAL_CARDS;
            cnt.style.cssText = 'padding:8px;width:80px;text-align:right;color:#8FBEBA;';

            tr.appendChild(pos);
            tr.appendChild(nm);
            tr.appendChild(cnt);
            table.appendChild(tr);
        }

        wrap.appendChild(table);
        replaceModalBody(wrap);
    });
}

function replaceModalBody(node) {
    var overlay = document.getElementById('gi-modal-overlay');
    if (!overlay) return;
    var body = overlay.querySelector('div > div:last-child');
    // il body è il secondo figlio del box
    var box = overlay.firstChild;
    var b = box.childNodes[1];
    if (b) {
        b.innerHTML = '';
        b.appendChild(node);
    }
}

// AVVIO
// ----------------------------------------

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildPanel);
} else {
    buildPanel();
}

console.log('[GreedIsland] Prototipo v0.1.0 avviato per ' + USER.name + ' (id ' + USER.id + ')');


})();
