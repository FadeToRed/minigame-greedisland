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
var CARD_BACK = GREED.CARD_BACK; // retro carta, per l'animazione di pesca

// Icona SVG del bottone "Pesca carta" (simbolo Greed Island).
// fill:currentColor -> eredita il colore del testo del bottone.
var DRAW_ICON_SVG = '<svg viewBox="0 0 151.6 150.2" width="28" height="28" style="display:block;fill:currentColor;" xmlns="http://www.w3.org/2000/svg"><polygon points="75.7,0.2 65.2,22.6 86.1,22.6"/><polygon points="86.2,127.7 75.8,150.2 65.3,127.7"/><polygon points="129.1,64.7 151.6,75 129.1,85.5"/><polygon points="22.4,64.7 0,75 22.4,85.5"/><path d="M75.8,26.9c-26.6,0-48.2,21.6-48.2,48.2c0,26.6,21.6,48.2,48.2,48.2c26.6,0,48.2-21.6,48.2-48.2C123.9,48.5,102.4,26.9,75.8,26.9z M75.8,115.8c-22.5,0-40.7-18.2-40.7-40.7c0-22.5,18.2-40.7,40.7-40.7c22.5,0,40.7,18.2,40.7,40.7C116.5,97.6,98.3,115.8,75.8,115.8z"/><path d="M75.5,40.9c-18.8,0-34.1,15.3-34.1,34.1s15.3,34.1,34.1,34.1c18.8,0,34.1-15.3,34.1-34.1S94.3,40.9,75.5,40.9z M75.7,102C60.8,102,48.7,89.9,48.7,75s12.1-27.1,27.1-27.1c14.9,0,27.1,12.1,27.1,27.1S90.7,102,75.7,102z"/><circle cx="75.4" cy="75" r="17.4"/></svg>';
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

// -- Nomi ufficiali (inglese) delle 100 carte collezionabili. --
var NAMES = {
    0: "Ruler's Blessing",
    1: "Patch of Forest",
    2: "Plot of Beach",
    3: "Pitcher of Eternal Water",
    4: "Skin Care Hot Springs",
    5: "Spirited Away Hollow",
    6: "Liquor Spring",
    7: "Pregnancy Stones",
    8: "Mystery Pond",
    9: "Tree of Plenty",
    10: "Golden Guidebook",
    11: "Golden Scales",
    12: "Golden Dictionary",
    13: "Luck Bankbook",
    14: "Connection Severing Scissors",
    15: "Fickle Genie",
    16: "Fairy King's Advice",
    17: "Angel's Breath",
    18: "Imp's Wink",
    19: "Poltergeist Pillow",
    20: "Mood Clock",
    21: "X-Ray Goggles",
    22: "Toraemon",
    23: "Tome of a Thousand Tales",
    24: "Hypothetical T.V.",
    25: "Risky Dice",
    26: "Night Shift Dwarves",
    27: "Book of V.I.P Passes",
    28: "Capricious Remote",
    29: "Pre-Order Vouchers",
    30: "Favor Cushion",
    31: "Double Postcard to the Dead",
    32: "Parrot Candy",
    33: "Hormone Cookies",
    34: "Universal Survey",
    35: "Chameleon Cat",
    36: "Recycling Room",
    37: "Fledgling Athlete",
    38: "Fledgling Artist",
    39: "Fledgling Politician",
    40: "Fledgling Musician",
    41: "Fledgling Pilot",
    42: "Fledgling Novelist",
    43: "Fledgling Gambler",
    44: "Fledgling Actor",
    45: "Fledgling CEO",
    46: "Gold Dust Girl",
    47: "Sleeping Girl",
    48: "Aromatherapy Girl",
    49: "Miniature Mermaid",
    50: "Miniature Dino",
    51: "Miniature Dragon",
    52: "Pearl Locusts",
    53: "King White Stag Beetle",
    54: "Millennium Butterfly",
    55: "Revenge Shop",
    56: "Perfect Memory Studio",
    57: "Hideout Realtor",
    58: "Secrets Video Rental",
    59: "Instant Foreign Language School",
    60: "Long Lost Delivery",
    61: "Vending Check-Up",
    62: 'Club "You Rule"',
    63: "Virtual Restaurant",
    64: "Witch's Love Potion",
    65: "Witch's Rejuvenation Potion",
    66: "Witch's Diet Pills",
    67: "Doyen's Growth Pills",
    68: "Doyen's Virility Pills",
    69: "Doyen's Hair Restorer",
    70: "Mad Scientist's Steroids",
    71: "Mad Scientist's Pheromones",
    72: "Mad Scientist's Plastic Surgery",
    73: "Night Jade",
    74: "Sage's Aquamarine",
    75: "Wild Luck Alexandrite",
    76: "Roaming Ruby",
    77: "Beauty Magnet Emerald",
    78: "Lonely Sapphire",
    79: "Rainbow Diamond",
    80: "Levitation Stone",
    81: "Blue Planet",
    82: "Staff of Judgment",
    83: "Sword of Truth",
    84: "Paladin's Necklace",
    85: "Sacrifice Armor",
    86: "Quiver of Frustration",
    87: "Shield of Faith",
    88: "Eternal Hammer",
    89: "Tax Collector's Gauntlet",
    90: "Memory Helmet",
    91: "Plastic King",
    92: "Swap Ticket",
    93: "Book of Life",
    94: "Bandit's Blade",
    95: "Secret Cape",
    96: "Clairvoyant Snake",
    97: "3-D Camera",
    98: "Silver Dog",
    99: "Panda Maid"
};


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
 * Nome di una carta. Le collezionabili lo prendono da NAMES;
 * il malus (-003) ha nome fisso "Eliminate".
 */
function cardName(card) {
    if (card.id < 0) return 'Eliminate';
    var nm = NAMES[card.id];
    return nm ? nm : ('Carta ' + cardNum(card));
}

/**
 * Rank leggibile: le carte usano il loro rank; il malus non ha un
 * vero rank e mostra "Game Master".
 */
function cardRankLabel(card) {
    return card.rank ? card.rank : 'Game Master';
}

/**
 * Etichetta testuale completa di una carta:
 *   "Carta #005 - Nome - [Rank B]"
 *   "Carta #-003 - Eliminate - [Rank Game Master]"
 */
function cardLabel(card) {
    return 'Carta #' + cardNum(card) +
        ' - ' + cardName(card) +
        ' - [Rank ' + cardRankLabel(card) + ']';
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
                    var owned = countOwned(player);

                    // 7. Post e animazione IN PARALLELO:
                    //    - il post parte subito, così ForumFree ha tutto il
                    //      tempo dell'animazione per registrarlo (altrimenti
                    //      #lastpost punterebbe al post precedente al nostro);
                    //    - l'animazione scorre;
                    //    - a fine ANIMAZIONE si completa (-> reload), a
                    //      prescindere dall'esito del post: la carta e' gia'
                    //      salvata su Firebase, quindi non si perde nulla.
                    announceDrawInTopic(card, owned, isMalus, function() {
                        // post concluso (o loggato): nessuna azione, il reload
                        // e' guidato dalla fine dell'animazione qui sotto.
                    });

                    playDrawAnimation(card, isMalus, function() {
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
    var label = cardLabel(card); // "Carta #NNN - Nome - [Rank X]"

    if (isMalus) {
        // Post speciale per la carta -003 Eliminate: espulsione, nessuna carta.
        return '' +
            '<div style="border:1px solid #a03030;background:#2a1414;padding:14px;max-width:400px;font-family:montserrat,sans-serif;color:#f2c4c4;">' +
                '<div style="font-family:\'Alegreya Sans SC\',sans-serif;font-size:16px;color:#ff8080;margin-bottom:8px;text-align:center;letter-spacing:1px;">' +
                    'Hai pescato la carta:' +
                '</div>' +
                '<div style="text-align:center;margin:8px 0;">' +
                    '<img src="' + card.img + '" alt="' + escapeHTML(label) + '"' +
                    ' style="max-width:100%;height:auto;border:2px solid #a03030;border-radius:4px;">' +
                '</div>' +
                '<div style="text-align:center;font-size:14px;color:#f2c4c4;">' +
                    '<b>' + escapeHTML(label) + '</b>' +
                '</div>' +
                '<div style="text-align:center;font-size:13px;color:#ff8080;margin-top:8px;">' +
                    'Sei stato espulso da Greed Island! Nessuna carta ottenuta.' +
                '</div>' +
            '</div>';
    }

    // Post normale. Immagine a dimensione naturale, limitata dal div (400px).
    var img = '<img src="' + card.img + '" alt="' + escapeHTML(label) + '"' +
        ' style="max-width:100%;height:auto;border:2px solid #79BD9A;border-radius:4px;">';

    return '' +
        '<div style="border:1px solid #3B8686;background:#292354;padding:14px;max-width:400px;font-family:montserrat,sans-serif;color:#E2F7C4;">' +
            '<div style="font-family:\'Alegreya Sans SC\',sans-serif;font-size:16px;color:#CFF09E;margin-bottom:8px;text-align:center;letter-spacing:1px;">' +
                'Hai pescato la carta:' +
            '</div>' +
            '<div style="text-align:center;margin:8px 0;">' +
                img +
            '</div>' +
            '<div style="text-align:center;font-size:14px;color:#E2F7C4;">' +
                '<b>' + escapeHTML(label) + '</b>' +
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

    el.drawBtn       = makeButton('Pesca carta', DRAW_ICON_SVG,   '#79BD9A', '#292354');
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
 * Crea un bottone con icona + etichetta testuale.
 * L'icona può essere:
 *   - una stringa SVG inline (se inizia con "<svg")
 *   - una classe Font Awesome (altrimenti)
 * L'etichetta è in uno <span> separato (el._label) così possiamo
 * cambiarne il testo senza cancellare l'icona.
 */
function makeButton(label, iconSpec, bg, fg) {
    var b = document.createElement('button');
    b.style.cssText = 'cursor:pointer;border:1px solid #3B8686;border-radius:5px;' +
        'padding:8px 14px;font-size:13px;font-weight:bold;background:' + bg +
        ';color:' + fg + ';min-width:150px;font-family:montserrat,sans-serif;' +
        'display:flex;align-items:center;justify-content:center;gap:8px;';

    var icon;
    if (iconSpec.indexOf('<svg') === 0) {
        // Icona SVG inline: la mettiamo in uno <span> contenitore.
        icon = document.createElement('span');
        icon.style.cssText = 'display:inline-flex;align-items:center;';
        icon.innerHTML = iconSpec;
    } else {
        // Icona Font Awesome, ingrandita.
        icon = document.createElement('i');
        icon.className = 'fa-solid ' + iconSpec;
        icon.style.cssText = 'font-size:18px;';
    }

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

        // Successo. Il post è partito all'inizio dell'animazione, quindi
        // ForumFree ha già avuto tutta la durata dell'animazione (~5s) per
        // registrarlo: ora #lastpost punta correttamente al nostro post.
        // Ricarichiamo subito alla #lastpost.
        el.drawBtn._label.textContent = 'Fatto!';
        var topicUrl = 'https://' + location.hostname + '/?t=' + CONFIG.TOPIC_ID + '#lastpost';
        location.replace(topicUrl);
        // Fallback: se replace() non ricarica (stesso URL + stesso hash),
        // forziamo comunque il reload.
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
            (function(c) {
                var has = !!owned[c.id];

                var cell = document.createElement('div');
                cell.style.cssText = 'width:110px;text-align:center;font-size:11px;color:#E2F7C4;' +
                    (has ? '' : 'opacity:.4;filter:grayscale(1);');

                var img = document.createElement('img');
                img.src = c.img;
                img.alt = cardLabel(c);
                img.style.cssText = 'width:100px;border:2px solid ' +
                    (has ? '#79BD9A' : '#8FBEBA') + ';border-radius:4px;' +
                    (has ? 'cursor:pointer;' : '');

                // Solo le carte possedute sono cliccabili per l'ingrandimento.
                if (has) {
                    img.addEventListener('click', function() { openCardZoom(c); });
                }

                var nm = document.createElement('div');
                nm.textContent = has ? ('#' + cardNum(c) + ' - ' + cardName(c)) : '???';
                nm.style.cssText = 'margin-top:4px;color:#E2F7C4;';

                cell.appendChild(img);
                cell.appendChild(nm);
                grid.appendChild(cell);
            })(CARDS[i]);
        }

        wrap.appendChild(grid);
        replaceModalBody(wrap);
    });
}

/**
 * Overlay che mostra una carta ingrandita. Cliccando fuori si chiude.
 * È indipendente dal modale collezione (ci si sovrappone).
 */
function openCardZoom(card) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;' +
        'background:rgba(0,0,0,.8);display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;font-family:montserrat,sans-serif;';

    var img = document.createElement('img');
    img.src = card.img;
    img.alt = cardLabel(card);
    img.style.cssText = 'max-width:90%;max-height:80vh;height:auto;' +
        'border:3px solid #79BD9A;border-radius:6px;box-shadow:0 4px 24px rgba(0,0,0,.6);';

    var caption = document.createElement('div');
    caption.textContent = cardLabel(card);
    caption.style.cssText = 'margin-top:12px;color:#E2F7C4;font-size:14px;text-align:center;';

    overlay.appendChild(img);
    overlay.appendChild(caption);
    overlay.addEventListener('click', function() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    });

    document.body.appendChild(overlay);
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

        // Colori del podio per i primi 3 (oro, argento, bronzo).
        var podium = [
            { bg: '#4a3b0a', accent: '#ffd447', icon: 'fa-trophy' },       // 1°
            { bg: '#3a3f45', accent: '#d4dbe2', icon: 'fa-medal' },        // 2°
            { bg: '#40301c', accent: '#e0a066', icon: 'fa-medal' }         // 3°
        ];

        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            var isMe = String(r.id) === String(USER.id);
            var isPodium = i < 3;
            var p = isPodium ? podium[i] : null;

            var tr = document.createElement('tr');
            var rowBg = isPodium ? p.bg : (isMe ? '#0B486B' : 'transparent');
            tr.style.cssText = 'border-bottom:1px solid #3B8686;background:' + rowBg + ';' +
                (isMe ? 'outline:2px solid #79BD9A;outline-offset:-2px;' : '');

            var pos = document.createElement('td');
            pos.style.cssText = 'padding:10px 8px;width:44px;text-align:center;font-weight:bold;' +
                'font-size:15px;color:' + (isPodium ? p.accent : '#CFF09E') + ';';
            if (isPodium) {
                // Medaglia + numero.
                var medal = document.createElement('i');
                medal.className = 'fa-solid ' + p.icon;
                medal.style.cssText = 'margin-right:4px;';
                pos.appendChild(medal);
                pos.appendChild(document.createTextNode(String(i + 1)));
            } else {
                pos.textContent = (i + 1);
            }

            var nm = document.createElement('td');
            nm.textContent = r.name;
            nm.style.cssText = 'padding:10px 8px;color:' +
                (isPodium ? '#ffffff' : '#E2F7C4') + ';' +
                (isPodium ? 'font-weight:bold;' : '');

            var cnt = document.createElement('td');
            cnt.textContent = r.count + '/' + TOTAL_CARDS;
            cnt.style.cssText = 'padding:10px 8px;width:80px;text-align:right;color:' +
                (isPodium ? p.accent : '#8FBEBA') + ';font-weight:' +
                (isPodium ? 'bold' : 'normal') + ';';

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

// ANIMAZIONE DI PESCA  —  flip carta + ingrandimento + coriandoli
// ----------------------------------------

/**
 * Inietta una sola volta i keyframes usati dall'animazione di pesca.
 */
function ensureDrawAnimStyle() {
    if (document.getElementById('gi-draw-style')) return;
    var st = document.createElement('style');
    st.id = 'gi-draw-style';
    st.textContent =
        '@keyframes gi-fade-out { to { opacity:0; visibility:hidden; } }' +
        // Il "flip": ruota su Y più volte, poi si ferma sul fronte (360deg finali).
        '@keyframes gi-flip {' +
        '  0%   { transform: rotateY(0deg); }' +
        '  100% { transform: rotateY(1800deg); }' +   // 5 giri completi in ~2s
        '}' +
        // Dopo il flip: piccolo ingrandimento "pop".
        '@keyframes gi-pop {' +
        '  0%   { transform: scale(1); }' +
        '  60%  { transform: scale(1.25); }' +
        '  100% { transform: scale(1.15); }' +
        '}' +
        // Coriandoli: volano verso l\'alto/lati e svaniscono. Impostati via JS.
        '@keyframes gi-confetti {' +
        '  0%   { opacity:1; transform: translate(0,0) rotate(0deg); }' +
        '  100% { opacity:0; transform: translate(var(--dx), var(--dy)) rotate(var(--dr)); }' +
        '}';
    document.head.appendChild(st);
}

/**
 * Mostra l'animazione della carta pescata e, al termine, chiama done().
 *   - la carta gira fronte/retro per ~2s
 *   - si ferma sul fronte e si ingrandisce
 *   - se NON è il malus, spara coriandoli attorno
 * Se manca CARD_BACK, salta l'animazione e chiama subito done().
 *
 * @param {object} card    la carta pescata (ha .img del fronte)
 * @param {boolean} isMalus se true, niente coriandoli
 * @param {function} done   callback di fine animazione
 */
function playDrawAnimation(card, isMalus, done) {
    if (!CARD_BACK) { done(); return; }
    ensureDrawAnimStyle();

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;' +
        'background:rgba(10,8,20,.78);display:flex;align-items:center;' +
        'justify-content:center;overflow:hidden;';

    // Contenitore con prospettiva 3D per il flip.
    var stage = document.createElement('div');
    stage.style.cssText = 'perspective:1200px;width:280px;height:392px;position:relative;';

    // La carta: un contenitore che ruota, con due facce (fronte/retro).
    var flipper = document.createElement('div');
    flipper.style.cssText = 'position:relative;width:100%;height:100%;' +
        'transform-style:preserve-3d;' +
        'animation:gi-flip 2s ease-out forwards;';

    var faceStyle = 'position:absolute;top:0;left:0;width:100%;height:100%;' +
        'backface-visibility:hidden;-webkit-backface-visibility:hidden;' +
        'border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.6);' +
        'background-size:cover;background-position:center;';

    // Fronte: la carta pescata. Parte "davanti" (rotateY 0).
    var front = document.createElement('div');
    front.style.cssText = faceStyle + 'background-image:url(' + card.img + ');';

    // Retro: dietro, ruotato di 180deg così appare durante i giri.
    var back = document.createElement('div');
    back.style.cssText = faceStyle + 'background-image:url(' + CARD_BACK + ');' +
        'transform:rotateY(180deg);';

    flipper.appendChild(front);
    flipper.appendChild(back);
    stage.appendChild(flipper);
    overlay.appendChild(stage);
    document.body.appendChild(overlay);

    // Fase 2 (dopo il flip, ~2s): ferma la rotazione sul fronte, ingrandisci,
    // e (se non malus) spara i coriandoli.
    setTimeout(function() {
        flipper.style.animation = 'none';
        flipper.style.transform = 'rotateY(0deg)';
        stage.style.animation = 'gi-pop .5s ease-out forwards';
        if (!isMalus) {
            spawnConfetti(overlay);
        }
    }, 2000);

    // Fase 3: dopo che l'utente ha visto la carta ingrandita (~2.3s),
    // dissolvi l'overlay e chiama done() (che farà partire post + reload).
    setTimeout(function() {
        overlay.style.animation = 'gi-fade-out .5s ease-in forwards';
    }, 4300);
    setTimeout(function() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        done();
    }, 4800);
}

/**
 * Genera un burst di coriandoli colorati attorno al centro dell'overlay.
 */
function spawnConfetti(overlay) {
    var colors = ['#CFF09E', '#79BD9A', '#3B8686', '#E2F7C4', '#ffd447', '#ff8080', '#8FBEBA'];
    var N = 40;
    for (var i = 0; i < N; i++) {
        var piece = document.createElement('div');
        var size = 6 + Math.floor(Math.random() * 8);
        var color = colors[Math.floor(Math.random() * colors.length)];

        // Direzione casuale (angolo + distanza).
        var angle = Math.random() * Math.PI * 2;
        var dist = 120 + Math.random() * 220;
        var dx = Math.cos(angle) * dist;
        var dy = Math.sin(angle) * dist;
        var dr = (Math.random() * 720 - 360);
        var dur = 0.8 + Math.random() * 0.7;

        piece.style.cssText = 'position:absolute;top:50%;left:50%;' +
            'width:' + size + 'px;height:' + (size * 0.6) + 'px;' +
            'background:' + color + ';border-radius:2px;' +
            '--dx:' + dx.toFixed(0) + 'px;--dy:' + dy.toFixed(0) + 'px;' +
            '--dr:' + dr.toFixed(0) + 'deg;' +
            'animation:gi-confetti ' + dur.toFixed(2) + 's ease-out forwards;';
        overlay.appendChild(piece);
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
