'use strict';
// Serviço TizenBrew: injeta o Better xCloud no INÍCIO de cada documento da página do TizenBrew,
// via DevTools local (Page.addScriptToEvaluateOnNewDocument). Contorna o caminho
// evaluateScriptOnDocumentStart do TizenBrew 2.0.5, que não chega a abrir o site.
// Escrito em ES5 porque o Node dos serviços do Tizen pode ser antigo.
var http = require('http');
var https = require('https');
var net = require('net');
var crypto = require('crypto');
var fs = require('fs');

var HOST = (typeof process !== 'undefined' && process.env && process.env.BX_HOST) || '127.0.0.1';
var WRAPPER_URL = 'https://raw.githubusercontent.com/marcusvitalesilva-dot/tizenbrew-better-xcloud/main/bx-wrapper.js';
var source = null;
var busy = false;
var attachedId = null;

function log(msg) {
    if (typeof process !== 'undefined' && process.env && process.env.BX_DEBUG) console.log('[bx-service] ' + msg);
}

function fetchSource(cb) {
    if (process.env && process.env.BX_SRC_FILE) { source = fs.readFileSync(process.env.BX_SRC_FILE, 'utf8'); return cb(); }
    https.get(WRAPPER_URL, function (res) {
        var chunks = [];
        res.on('data', function (c) { chunks.push(c); });
        res.on('end', function () {
            if (res.statusCode !== 200) return setTimeout(function () { fetchSource(cb); }, 5000);
            source = Buffer.concat(chunks).toString('utf8');
            log('script baixado: ' + source.length + ' chars');
            cb();
        });
    }).on('error', function () { setTimeout(function () { fetchSource(cb); }, 5000); });
}

// Portas em LISTEN lidas de /proc/net/tcp(6); se não houver /proc, varre a faixa alta.
function listenPorts(cb) {
    var ports = [];
    if (process.env && process.env.BX_PORT) return cb([parseInt(process.env.BX_PORT, 10)]);
    ['/proc/net/tcp', '/proc/net/tcp6'].forEach(function (f) {
        try {
            fs.readFileSync(f, 'utf8').split('\n').slice(1).forEach(function (line) {
                var p = line.trim().split(/\s+/);
                if (p.length > 3 && p[3] === '0A') {
                    var port = parseInt(p[1].split(':').pop(), 16);
                    if (port >= 1024 && ports.indexOf(port) < 0) ports.push(port);
                }
            });
        } catch (e) {}
    });
    if (ports.length) return cb(ports);
    var found = [], next = 30000, active = 0, END = 65535;
    function pump() {
        while (active < 300 && next <= END) {
            (function (p) {
                active++;
                var s = net.connect({ host: HOST, port: p });
                var done = function (ok) { if (ok) found.push(p); s.destroy(); active--; if (next > END && active === 0) cb(found); else pump(); };
                s.setTimeout(400, function () { done(false); });
                s.on('connect', function () { done(true); });
                s.on('error', function () { done(false); });
            })(next++);
        }
    }
    pump();
}

function getJson(port, cb) {
    var req = http.get({ host: HOST, port: port, path: '/json', timeout: 1500 }, function (res) {
        var body = '';
        res.on('data', function (c) { body += c; });
        res.on('end', function () { try { cb(JSON.parse(body)); } catch (e) { cb(null); } });
    });
    req.on('error', function () { cb(null); });
    req.on('timeout', function () { req.abort(); cb(null); });
}

function findTarget(cb) {
    listenPorts(function (ports) {
        var i = 0;
        (function tryNext() {
            if (i >= ports.length) return cb(null);
            var port = ports[i++];
            getJson(port, function (list) {
                if (Object.prototype.toString.call(list) === '[object Array]') {
                    for (var k = 0; k < list.length; k++) {
                        if (list[k].type === 'page') return cb({ port: port, id: list[k].id, url: list[k].url });
                    }
                }
                tryNext();
            });
        })();
    });
}

// Cliente WebSocket mínimo (só texto), suficiente para o protocolo DevTools.
function wsConnect(port, path, onOpen, onMessage, onClose, onSender) {
    var key = crypto.randomBytes(16).toString('base64');
    var req = http.request({
        host: HOST, port: port, path: path,
        headers: { 'Connection': 'Upgrade', 'Upgrade': 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': key }
    });
    req.on('upgrade', function (res, socket, head) {
        var buf = head && head.length ? head : new Buffer(0);
        var frag = [];
        function send(text, opcode) {
            var payload = new Buffer(text, 'utf8');
            var len = payload.length, header;
            if (len < 126) { header = new Buffer(2); header[1] = 0x80 | len; }
            else if (len < 65536) { header = new Buffer(4); header[1] = 0x80 | 126; header.writeUInt16BE(len, 2); }
            else { header = new Buffer(10); header[1] = 0x80 | 127; header.writeUInt32BE(0, 2); header.writeUInt32BE(len, 6); }
            header[0] = 0x80 | (opcode || 0x1);
            var mask = crypto.randomBytes(4);
            for (var i = 0; i < len; i++) payload[i] ^= mask[i % 4];
            socket.write(Buffer.concat([header, mask, payload]));
        }
        socket.on('data', function (d) {
            buf = Buffer.concat([buf, d]);
            while (buf.length >= 2) {
                var op = buf[0] & 0x0f, fin = (buf[0] & 0x80) !== 0, len = buf[1] & 0x7f, off = 2;
                if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
                else if (len === 127) { if (buf.length < 10) return; len = buf.readUInt32BE(6); off = 10; }
                if (buf.length < off + len) return;
                var data = buf.slice(off, off + len);
                buf = buf.slice(off + len);
                if (op === 0x9) { send(data.toString('utf8'), 0xA); continue; }
                if (op === 0x8) { socket.end(); continue; }
                frag.push(data);
                if (fin) { var msg = Buffer.concat(frag).toString('utf8'); frag = []; try { onMessage(JSON.parse(msg)); } catch (e) {} }
            }
        });
        socket.on('close', onClose);
        socket.on('error', function () {});
        onOpen(send);
        if (typeof onSender === 'function') onSender(send);
    });
    req.on('error', onClose);
    req.end();
}

function attach(target) {
    busy = true;
    var id = 0, checkId = -1;
    wsConnect(target.port, '/devtools/page/' + target.id, function (send) {
        attachedId = target.id;
        busy = false;
        var call = function (method, params) { send(JSON.stringify({ id: ++id, method: method, params: params || {} })); return id; };
        call('Page.enable');
        call('Page.addScriptToEvaluateOnNewDocument', { source: source });
        // A sessão de depuração do TizenBrew liga o Debugger; páginas com "debugger;" (ex.: login da Microsoft)
        // ficariam pausadas para sempre. Esta sessão retoma qualquer pausa e libera páginas à espera do depurador.
        call('Debugger.enable');
        call('Debugger.resume');
        call('Runtime.runIfWaitingForDebugger');
        log('script registrado em ' + target.url);
        // Se a página do Xbox abriu antes do registro (script atrasado ou ausente), recarrega uma vez.
        if (/xbox\.com\//.test(target.url)) checkId = call('Runtime.evaluate', { expression: 'window.__bxEarly === true', returnByValue: true });
    }, function (msg) {
        if (msg.method === 'Debugger.paused') { send2(target, 'Debugger.resume'); return; }
        if (msg.id === checkId && msg.result && msg.result.result && msg.result.result.value !== true) {
            log('script entrou tarde ou não entrou: recarregando');
            send2(target, 'Page.reload');
        }
    }, function () {
        if (attachedId === target.id) attachedId = null;
        delete senders[target.id];
        busy = false;
        log('sessão encerrada');
    }, function (send) {
        var n = 100000;
        senders[target.id] = function (method) { send(JSON.stringify({ id: ++n, method: method, params: {} })); };
    });
}

var senders = {};
function send2(target, method) { if (senders[target.id]) senders[target.id](method); }

function loop() {
    if (!busy && source) {
        busy = true;
        findTarget(function (t) {
            busy = false;
            // Reconecta quando a página troca de alvo (ex.: troca de processo ao voltar do login).
            if (t && t.id !== attachedId) attach(t);
        });
    }
    setTimeout(loop, 3000);
}

fetchSource(loop);
