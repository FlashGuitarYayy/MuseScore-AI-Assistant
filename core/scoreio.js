.import "i18n.js" as I18n
// 和 MuseScore 谱面打交道：读取、序列化、辅助函数 h.*、脚本执行、谱面指纹。
// 每个函数的第一个参数 api 由 QML 侧的 makeApi() 构造，里面放 curScore、newElement、fraction、各枚举。
// 所有修改都直接走插件 API，不依赖 cmd()：MuseScore 在某些状态下会拒绝插件派发的动作代码。
.import "theory.js" as Theory

// 显示给用户的文字过字典（core/i18n.js）；语言由 QML 设定
function T(s) { return I18n.tr(s); }

var VOICES = 4;

// ---------------------------------------------------------------- 基础

function listToArray(l) {
    var a = [];
    if (!l) { return a; }
    for (var i = 0; i < l.length; i++) { a.push(l[i]); }
    return a;
}

function lastTick(api) {
    var seg = api.curScore.lastSegment;
    return seg ? seg.tick : 0;
}

// 按位置列出所有小节：index 从 1 起
function measures(api) {
    var out = [];
    var m = api.curScore.firstMeasure;
    var i = 1;
    var guard = 0;
    while (m && guard++ < 100000) {
        var start = m.firstSegment ? m.firstSegment.tick : 0;
        var next = m.nextMeasure;
        var end = (next && next.firstSegment) ? next.firstSegment.tick : lastTick(api);
        if (end <= start) { end = start + 1; }
        out.push({ index: i, m: m, startTick: start, endTick: end });
        m = next;
        i++;
    }
    return out;
}

function measureIndexOf(ms, tick) {
    for (var i = 0; i < ms.length; i++) {
        if (tick >= ms[i].startTick && tick < ms[i].endTick) { return ms[i].index; }
    }
    return ms.length ? ms[ms.length - 1].index : 0;
}

function durationStr(cr) {
    try {
        var d = cr.duration;
        if (d) { return d.numerator + "/" + d.denominator; }
    } catch (e) { }
    return "?";
}

// ---------------------------------------------------------------- 读谱

function makeItem(api, e, tick, staffIdx, voice, ms) {
    var isChord = e.type === api.Element.CHORD;
    return {
        cr: e,
        tick: tick,
        staffIdx: staffIdx,
        voice: voice,
        track: staffIdx * VOICES + voice,
        measure: measureIndexOf(ms, tick),
        index: 0,       // 该小节该声部里第几个和弦/休止符，1 起
        noteIndex: 0,   // 该小节该声部里第几个和弦，不数休止符，1 起
        isChord: isChord,
        isRest: !isChord,
        notes: isChord ? listToArray(e.notes) : []
    };
}

// 沿一条 track 从 startTick 走到 endTick（不含），收集和弦与休止符
function walkTrack(api, startTick, endTick, staffIdx, voice, ms) {
    var c = api.curScore.newCursor();
    c.staffIdx = staffIdx;
    c.voice = voice;
    c.rewindToTick(startTick);
    var out = [];
    var guard = 0;
    while (c.segment && c.tick < endTick && guard++ < 100000) {
        var e = c.element;
        if (e && c.tick >= startTick && (e.type === api.Element.CHORD || e.type === api.Element.REST)) {
            out.push(makeItem(api, e, c.tick, staffIdx, voice, ms));
        }
        if (!c.next()) { break; }
    }
    return out;
}

function sortItems(items) {
    items.sort(function (a, b) {
        return (a.measure - b.measure) || (a.staffIdx - b.staffIdx) || (a.voice - b.voice) || (a.tick - b.tick);
    });
    return items;
}

// 按 (小节, 谱表, 声部) 编号。要求 items 已排序，且每组是完整的小节内容。
function numberItems(items) {
    var counters = {};
    items.forEach(function (it) {
        var k = it.measure + ":" + it.staffIdx + ":" + it.voice;
        if (!counters[k]) { counters[k] = { all: 0, chords: 0 }; }
        counters[k].all++;
        it.index = counters[k].all;
        if (it.isChord) {
            counters[k].chords++;
            it.noteIndex = counters[k].chords;
        }
    });
    return items;
}

function staffList(api, staffIdx) {
    var out = [];
    if (staffIdx === undefined || staffIdx === null || staffIdx < 0) {
        for (var s = 0; s < api.curScore.nstaves; s++) { out.push(s); }
    } else {
        out.push(staffIdx);
    }
    return out;
}

function voiceList(voice) {
    return (voice === undefined || voice === null || voice < 0) ? [0, 1, 2, 3] : [voice];
}

function itemsInRange(api, startTick, endTick, staffIdx, voice, ms) {
    var all = [];
    staffList(api, staffIdx).forEach(function (s) {
        voiceList(voice).forEach(function (v) {
            all = all.concat(walkTrack(api, startTick, endTick, s, v, ms));
        });
    });
    return numberItems(sortItems(all));
}

// 第 fromM 到 toM 小节（1 起）的和弦/休止符
function items(api, fromM, toM, staffIdx, voice) {
    var ms = measures(api);
    if (!ms.length) { return []; }
    fromM = Math.max(1, Math.min(ms.length, fromM || 1));
    toM = Math.max(fromM, Math.min(ms.length, toM || fromM));
    return itemsInRange(api, ms[fromM - 1].startTick, ms[toM - 1].endTick, staffIdx, voice, ms);
}

function selectionRange(api) {
    var sel = api.curScore.selection;
    if (!sel || !sel.isRange) { return null; }
    var ss = sel.startSegment;
    if (!ss) { return null; }
    var es = sel.endSegment;
    return {
        startTick: ss.tick,
        endTick: es ? es.tick : lastTick(api),
        startStaff: sel.startStaff,
        endStaff: sel.endStaff   // 不含
    };
}

// 当前选区里的和弦/休止符。范围选择和点选都支持；编号仍按所在小节计算。
function selectionItems(api) {
    var ms = measures(api);
    var r = selectionRange(api);
    if (r) {
        var all = [];
        for (var s = r.startStaff; s < r.endStaff; s++) {
            for (var v = 0; v < VOICES; v++) {
                all = all.concat(walkTrack(api, r.startTick, r.endTick, s, v, ms));
            }
        }
        return renumberWithinMeasures(api, sortItems(all), ms);
    }
    var sel = api.curScore.selection;
    var els = listToArray(sel ? sel.elements : null);
    var picked = [];
    var seen = {};
    els.forEach(function (e) {
        var cr = null;
        if (e.type === api.Element.NOTE) { cr = e.parent; }
        else if (e.type === api.Element.CHORD || e.type === api.Element.REST) { cr = e; }
        if (!cr) { return; }
        var tick = cr.fraction ? cr.fraction.ticks : -1;
        var track = cr.track;
        var key = tick + ":" + track;
        if (seen[key]) { return; }
        seen[key] = true;
        picked.push(makeItem(api, cr, tick, Math.floor(track / VOICES), track % VOICES, ms));
    });
    return renumberWithinMeasures(api, sortItems(picked), ms);
}

function renumberWithinMeasures(api, picked, ms) {
    var wanted = {};
    var groups = {};
    picked.forEach(function (p) {
        wanted[p.tick + ":" + p.track] = true;
        groups[p.measure + ":" + p.staffIdx + ":" + p.voice] = p;
    });
    var out = [];
    Object.keys(groups).forEach(function (k) {
        var p = groups[k];
        var m = ms[p.measure - 1];
        if (!m) { return; }
        var walked = numberItems(walkTrack(api, m.startTick, m.endTick, p.staffIdx, p.voice, ms));
        walked.forEach(function (w) {
            if (wanted[w.tick + ":" + w.track]) { out.push(w); }
        });
    });
    return sortItems(out);
}

// ---------------------------------------------------------------- 序列化

function noteLabel(api, n) {
    var s = Theory.noteName(n.pitch, n.tpc);
    try {
        if (Number(n.headGroup) === Number(api.NoteHeadGroup.HEAD_CROSS)) { s += "(x)"; }
    } catch (e) { }
    return s;
}

function itemLine(api, it) {
    var s = "#" + it.index;
    if (it.isChord) {
        s += " n" + it.noteIndex + T(" 和弦 ") + durationStr(it.cr) + " [";
        s += it.notes.map(function (n) { return noteLabel(api, n); }).join(",") + "]";
        try {
            var arts = listToArray(it.cr.articulations);
            if (arts.length) {
                s += T(" 记号:") + arts.map(function (a) {
                    try { return a.userName(); } catch (e) { return "?"; }
                }).join("/");
            }
        } catch (e2) { }
        try { if (it.cr.tuplet) { s += T(" (连音组内)"); } } catch (e3) { }
    } else {
        s += T(" 休止 ") + durationStr(it.cr);
    }
    return s + " @" + it.tick;
}

function describe(api, its) {
    if (!its || !its.length) { return T("(范围内没有和弦或休止符)"); }
    var sorted = sortItems(its.slice());
    var lines = [];
    var lastHeader = "";
    sorted.forEach(function (it) {
        var header = T("第 ") + it.measure + T(" 小节 · 谱表") + it.staffIdx + T(" 声部") + it.voice;
        if (header !== lastHeader) {
            lines.push("--- " + header + " ---");
            lastHeader = header;
        }
        lines.push("  " + itemLine(api, it));
    });
    return lines.join("\n");
}

function selectionSummary(api) {
    var S = api.curScore;
    if (!S) { return T("没有打开的谱子"); }
    var ms = measures(api);
    var r = selectionRange(api);
    if (r) {
        var m1 = measureIndexOf(ms, r.startTick);
        var m2 = measureIndexOf(ms, Math.max(r.startTick, r.endTick - 1));
        var staves = (r.endStaff - r.startStaff <= 1) ? (T("谱表") + r.startStaff) : (T("谱表") + r.startStaff + "-" + (r.endStaff - 1));
        return T("范围选择：第 ") + m1 + (m2 !== m1 ? "-" + m2 : "") + T(" 小节，") + staves + T("（tick ") + r.startTick + "-" + r.endTick + T("）");
    }
    var els = listToArray(S.selection ? S.selection.elements : null);
    if (!els.length) { return T("无选区"); }
    var its = selectionItems(api);
    if (!its.length) { return T("点选了 ") + els.length + T(" 个元素（不是音符/休止符）"); }
    var mset = {};
    its.forEach(function (it) { mset[it.measure] = true; });
    var mlist = Object.keys(mset).map(Number).sort(function (a, b) { return a - b; });
    return T("点选 ") + its.length + T(" 个和弦/休止符，位于第 ") + mlist.join(",") + T(" 小节");
}

function scoreInfo(api) {
    var S = api.curScore;
    if (!S) { return T("没有打开的谱子"); }
    var ms = measures(api);
    var lines = [];
    lines.push(T("标题: ") + (S.title || T("(无)")));
    lines.push(T("谱表数: ") + S.nstaves + T("，小节数: ") + ms.length + T("，调号(五度圈): ") + S.keysig + " = " + Theory.keyName(S.keysig));
    try {
        var parts = listToArray(S.parts);
        parts.forEach(function (p, i) {
            var s0 = Math.floor(p.startTrack / VOICES);
            var s1 = Math.floor(p.endTrack / VOICES) - 1;
            var tags = [];
            if (p.hasTabStaff) { tags.push("TAB"); }
            if (p.hasDrumStaff) { tags.push(T("鼓")); }
            lines.push(T("分谱") + i + ": " + (p.partName || p.longName || p.instrumentId) + T("  谱表 ") + s0 + (s1 > s0 ? "-" + s1 : "") + (tags.length ? " [" + tags.join(",") + "]" : ""));
        });
    } catch (e) {
        lines.push(T("(分谱信息读取失败: ") + e + ")");
    }
    lines.push(T("当前选区: ") + selectionSummary(api));
    return lines.join("\n");
}

function readScore(api, args) {
    var its;
    var head;
    if (args.scope === "selection") {
        its = selectionItems(api);
        head = T("选区内容（") + selectionSummary(api) + T("）");
    } else {
        var ms = measures(api);
        var a = args.from_measure || 1;
        var b = args.to_measure || a;
        if (b - a > 32) { b = a + 32; }
        its = items(api, a, b, (args.staff === undefined ? -1 : args.staff), -1);
        head = T("第 ") + a + "-" + b + T(" 小节（共 ") + ms.length + T(" 小节）");
    }
    return head + "\n" + describe(api, its);
}

// ---------------------------------------------------------------- 选择

function selectRange(api, fromM, toM, staffFrom, staffTo) {
    var ms = measures(api);
    if (!ms.length) { return false; }
    fromM = Math.max(1, Math.min(ms.length, fromM || 1));
    toM = Math.max(fromM, Math.min(ms.length, toM || fromM));
    var s0 = (staffFrom === undefined || staffFrom === null) ? 0 : staffFrom;
    var s1 = (staffTo === undefined || staffTo === null) ? s0 : staffTo;
    return api.curScore.selection.selectRange(ms[fromM - 1].startTick, ms[toM - 1].endTick, s0, s1 + 1);
}

// 选中这些和弦的所有音（休止符选中它本身）
function selectItems(api, its) {
    var sel = api.curScore.selection;
    sel.clear();
    var n = 0;
    its.forEach(function (it) {
        var targets = it.isChord ? it.notes : [it.cr];
        targets.forEach(function (e) {
            if (sel.select(e, n > 0)) { n++; }
        });
    });
    return n;
}

// ---------------------------------------------------------------- 写谱辅助

function cursorAt(api, item) {
    var c = api.curScore.newCursor();
    c.staffIdx = item.staffIdx;
    c.voice = item.voice;
    c.rewindToTick(item.tick);
    return c;
}

function keyAt(api, item) {
    try { return cursorAt(api, item).keySignature || 0; } catch (e) { return 0; }
}

// target: "D4" / "D"（取离原音最近的八度）/ MIDI 数字（按 key 就近拼写）
function setPitch(api, note, target, key) {
    var p;
    var tpc;
    if (typeof target === "number") {
        p = Math.round(target);
        tpc = Theory.tpcForPitch(p, key || 0, "nearest");
    } else {
        var r = Theory.parseNote(target, note.pitch);
        if (!r) { throw new Error(T("无法解析音名: ") + target); }
        p = r.pitch;
        tpc = r.tpc;
    }
    if (p < 0 || p > 127) { throw new Error(T("音高超出范围: ") + p); }
    // 移调乐器：保持书面谱和实际音高之间原有的 tpc 差
    var delta = 0;
    try { delta = note.tpc2 - note.tpc1; } catch (e) { }
    if (isNaN(delta)) { delta = 0; }
    note.pitch = p;
    note.tpc1 = Theory.clampTpc(tpc);
    note.tpc2 = Theory.clampTpc(tpc + delta);
    return Theory.noteName(p, tpc);
}

function transpose(api, its, semitones) {
    var n = Math.round(Number(semitones) || 0);
    if (!n) { return T("移动 0 个半音，没有改动"); }
    var octaveOnly = (n % 12 === 0);
    var count = 0;
    its.forEach(function (it) {
        if (!it.isChord) { return; }
        var key = octaveOnly ? 0 : keyAt(api, it);
        it.notes.forEach(function (note) {
            var p = note.pitch + n;
            if (p < 0 || p > 127) { throw new Error(T("移调后音高超出范围: ") + p); }
            if (octaveOnly) { note.pitch = p; }
            else { setPitch(api, note, p, key); }
            count++;
        });
    });
    return count + T(" 个音移动了 ") + n + T(" 个半音") + (octaveOnly ? "" : T("（只改了音符，调号和和弦符号没变）"));
}

// 音高不变，按各处调号就近重新拼写
function respell(api, its) {
    var total = 0;
    var changed = 0;
    its.forEach(function (it) {
        if (!it.isChord) { return; }
        var key = keyAt(api, it);
        it.notes.forEach(function (note) {
            total++;
            var before = note.tpc1;
            setPitch(api, note, note.pitch, key);
            if (note.tpc1 !== before) { changed++; }
        });
    });
    return T("重新拼写了 ") + changed + T(" 个音（共检查 ") + total + T(" 个）");
}

// 批量改时值：每个音保持起点不变，变短的补休止符，变长的会盖住后面的音（和 MuseScore 按数字键一致）。
// 按位置重新定位每个目标，不持有可能被前面的修改删掉的元素。
function setDurations(api, its, n, d, opts) {
    opts = opts || {};
    var withRests = !!opts.includeRests;
    var targets = [];
    var inTuplet = 0;
    its.forEach(function (it) {
        if (!(it.isChord || (withRests && it.isRest))) { return; }
        var tup = false;
        try { tup = !!it.cr.tuplet; } catch (e) { }
        if (tup) { inTuplet++; return; }
        targets.push({ tick: it.tick, staffIdx: it.staffIdx, voice: it.voice });
    });
    targets.sort(function (a, b) { return (a.staffIdx - b.staffIdx) || (a.voice - b.voice) || (a.tick - b.tick); });
    var changed = 0;
    var covered = 0;
    targets.forEach(function (t) {
        var c = api.curScore.newCursor();
        c.staffIdx = t.staffIdx;
        c.voice = t.voice;
        c.rewindToTick(t.tick);
        var e = c.element;
        if (!c.segment || !e || c.tick !== t.tick) { covered++; return; }
        var ok = e.type === api.Element.CHORD || (withRests && e.type === api.Element.REST);
        if (!ok) { covered++; return; }
        e.duration = api.fraction(n, d);
        changed++;
    });
    var s = changed + T(" 个改成了 ") + n + "/" + d;
    if (covered) { s += T("；") + covered + T(" 个已经被前面变长的音盖住"); }
    if (inTuplet) { s += T("；") + inTuplet + T(" 个在连音组里，没有改"); }
    return s;
}

function symFor(api, what) {
    if (what === "down" || what === "D" || what === "d") { return api.SymId.stringsDownBow; }
    if (what === "up" || what === "U" || what === "u") { return api.SymId.stringsUpBow; }
    var s = api.SymId[what];
    if (s === undefined || s === null) { throw new Error(T("未知记号: ") + what + T("。用 SymId 里的名字，比如 articStaccatoAbove")); }
    return s;
}

function findArticulations(api, item, sym) {
    if (!item.isChord) { return []; }
    return listToArray(item.cr.articulations).filter(function (a) {
        return sym === undefined || Number(a.symbol) === Number(sym);
    });
}

// 已经有同样的记号就不重复加，返回 null
function addArticulation(api, item, what) {
    if (!item.isChord) { throw new Error(T("只能给和弦加记号，这里是休止符 @") + item.tick); }
    var sym = symFor(api, what);
    if (findArticulations(api, item, sym).length) { return null; }
    var c = cursorAt(api, item);
    if (!c.element || c.tick !== item.tick) { throw new Error("tick " + item.tick + T(" 处找不到这个和弦")); }
    var a = api.newElement(api.Element.ARTICULATION);
    a.symbol = sym;
    c.add(a);
    return a;
}

function removeArticulations(api, item, what) {
    var sym = (what === undefined || what === null || what === "") ? undefined : symFor(api, what);
    var arts = findArticulations(api, item, sym);
    arts.forEach(function (a) { api.removeElement(a); });
    return arts.length;
}

function setNoteheads(api, item, style) {
    var g = (style === "cross" || style === "x") ? api.NoteHeadGroup.HEAD_CROSS : api.NoteHeadGroup.HEAD_NORMAL;
    item.notes.forEach(function (n) { n.headGroup = g; });
    return item.notes.length;
}

function makeHelpers(api) {
    var h = {};
    h.measures = function () {
        return measures(api).map(function (x) { return { index: x.index, startTick: x.startTick, endTick: x.endTick }; });
    };
    h.items = function (fromM, toM, staffIdx, voice) { return items(api, fromM, toM, staffIdx, voice); };
    h.selectionItems = function () { return selectionItems(api); };
    h.describe = function (its) { return describe(api, its); };
    h.noteName = function (n) { return Theory.noteName(n.pitch, n.tpc); };
    h.parseNote = function (text, ref) { return Theory.parseNote(text, ref); };
    h.setPitch = function (note, target) { return setPitch(api, note, target, 0); };
    h.transpose = function (its, semitones) { return transpose(api, its, semitones); };
    h.respell = function (its) { return respell(api, its); };
    h.setDuration = function (x, n, d) { var cr = (x && x.cr) ? x.cr : x; cr.duration = api.fraction(n, d); };
    h.setDurations = function (its, n, d, opts) { return setDurations(api, its, n, d, opts); };
    h.addArticulation = function (item, what) { return addArticulation(api, item, what); };
    h.removeArticulations = function (item, what) { return removeArticulations(api, item, what); };
    h.setNoteheads = function (item, style) { return setNoteheads(api, item, style); };
    h.selectRange = function (a, b, s0, s1) { return selectRange(api, a, b, s0, s1); };
    h.selectItems = function (its) { return selectItems(api, its); };
    h.cursorAt = function (item) { return cursorAt(api, item); };
    h.keyAt = function (item) { return keyAt(api, item); };
    return h;
}

// ---------------------------------------------------------------- 谱面指纹

// 走一遍所有段落，把时值、音高、拼写、符头、记号数混成一个数。用来判断一次操作到底改没改谱。
// 谱子太大时返回 "skip"，调用方当作「不确定」处理。
function scoreHash(api) {
    var S = api.curScore;
    if (!S) { return "none"; }
    if (S.nmeasures * S.nstaves > 4000) { return "skip"; }
    var ntracks = S.ntracks;
    var h = 5381;
    function mix(v) { h = (((h << 5) + h) ^ (Number(v) | 0)) >>> 0; }
    mix(S.nmeasures);
    mix(S.nstaves);
    var seg = S.firstSegment();
    var guard = 0;
    while (seg && guard++ < 500000) {
        mix(seg.tick);
        for (var t = 0; t < ntracks; t++) {
            var e = seg.elementAt(t);
            if (!e) { continue; }
            mix(t + 1);
            mix(e.type);
            if (e.type === api.Element.CHORD || e.type === api.Element.REST) {
                var dur = e.duration;
                if (dur) { mix(dur.numerator); mix(dur.denominator); }
            }
            if (e.type === api.Element.CHORD) {
                var notes = e.notes;
                for (var i = 0; i < notes.length; i++) {
                    mix(notes[i].pitch);
                    mix(notes[i].tpc1);
                    mix(notes[i].headGroup);
                }
                mix(e.articulations.length);
            }
            if (e.type === api.Element.KEYSIG) {
                var k;
                try { k = e.actualKey; } catch (ek) { }   // 4.6 起才有
                if (k !== undefined) { mix(Number(k) + 100); }
            }
        }
        seg = seg.next;
    }
    return h.toString(16) + ":" + guard;
}

// ---------------------------------------------------------------- 查看接口

// 列出插件环境里某个对象实际有哪些方法和属性，让模型在说「做不到」之前先查一查。
// 4.6 和 4.7 的插件接口不一样，以运行时查到的为准。
// path 例：curScore、curScore.parts[0]、curScore.parts[0].instruments[0]、cursor、selection、Element
var INSPECT_SKIP = /^(objectName|objectNameChanged|destroyed|deleteLater|toString|valueOf|hasOwnProperty|constructor)$|Changed$/;

function describeValue(v) {
    if (v === null) { return "null"; }
    if (v === undefined) { return "undefined"; }
    if (typeof v === "string") { return JSON.stringify(v.length > 40 ? v.substring(0, 40) + "…" : v); }
    if (typeof v === "number" || typeof v === "boolean") { return String(v); }
    if (typeof v === "function") { return "()"; }
    var n;
    try { n = v.length; } catch (e) { }
    if (typeof n === "number") { return T("[列表 ") + n + T(" 项]"); }
    var t = "";
    try { t = String(v); } catch (e2) { }
    var m = /^(?:[\w:]*::)?(\w+)\(0x/.exec(t);
    return "{" + (m ? m[1] : T("对象")) + "}";
}

function inspectApi(api, path) {
    path = String(path || "curScore").replace(/\s+/g, "");
    if (!/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*|\[\d+\])*$/.test(path)) {
        return T("ERROR: path 只能写成 curScore.parts[0].instruments[0] 这种形式（点号和数字下标）");
    }
    var S = api.curScore;
    var roots = {
        curScore: S,
        cursor: S ? S.newCursor() : null,
        selection: S ? S.selection : null,
        Element: api.Element, Segment: api.Segment, NoteHeadGroup: api.NoteHeadGroup, SymId: api.SymId,
        Accidental: api.Accidental, DurationType: api.DurationType
    };
    var steps = path.match(/[A-Za-z_$][\w$]*|\[\d+\]/g);
    if (!(steps[0] in roots)) { return T("ERROR: 只能从这些对象开始查: ") + Object.keys(roots).join(", "); }
    var obj = roots[steps[0]];
    var walked = steps[0];
    for (var i = 1; i < steps.length; i++) {
        if (obj === null || obj === undefined) { break; }
        var key = steps[i][0] === "[" ? Number(steps[i].slice(1, -1)) : steps[i];
        walked += typeof key === "number" ? steps[i] : "." + key;
        try { obj = obj[key]; } catch (e) { return T("ERROR: 读取 ") + walked + T(" 出错: ") + e; }
    }
    if (obj === null || obj === undefined) {
        return walked + T(" 是 ") + obj + T("。当前版本的插件接口里没有它（或者下标超出范围）。");
    }
    if (typeof obj !== "object" && typeof obj !== "function") { return walked + " = " + describeValue(obj); }
    var methods = [];
    var props = [];
    for (var k in obj) {
        if (INSPECT_SKIP.test(k)) { continue; }
        var v;
        try { v = obj[k]; } catch (e3) { props.push(k + T("=<读取出错>")); continue; }
        if (typeof v === "function") { methods.push(k + "()"); } else { props.push(k + "=" + describeValue(v)); }
    }
    var out = [walked + " " + describeValue(obj)];
    out.push(T("方法（") + methods.length + T("）: ") + (methods.length ? methods.sort().join(", ") : T("无")));
    out.push(T("属性（") + props.length + T("）: ") + (props.length ? props.sort().join(", ") : T("无")));
    return out.join("\n");
}

// ---------------------------------------------------------------- 脚本执行

function safeString(x) {
    if (x === undefined) { return ""; }
    if (typeof x === "string") { return x; }
    try { return JSON.stringify(x); } catch (e) { return String(x); }
}

var SCRIPT_PARAMS = [
    "curScore", "newElement", "removeElement", "fraction", "fractionFromTicks", "division",
    "Element", "Segment", "NoteHeadGroup", "SymId", "Accidental", "DurationType",
    "h", "log"
];

// 只编译不执行，用来在保存技能前检查语法
function compileCheck(code, label) {
    if (!code || !String(code).trim()) { return ""; }
    try {
        new Function(SCRIPT_PARAMS.join(","), code);
        return "";
    } catch (e) {
        return (label || T("脚本")) + T("语法错误: ") + e;
    }
}

// 在一次 startCmd/endCmd 事务里执行脚本；出错回滚。
function runScript(api, code, prelude, helpers) {
    var logs = [];
    var log = function (x) { logs.push(safeString(x)); };
    var fn;
    try {
        fn = new Function(SCRIPT_PARAMS.join(","), (prelude || "") + "\n" + code);
    } catch (e) {
        return { ok: false, error: T("脚本语法错误: ") + e, logs: logs };
    }
    var S = api.curScore;
    S.startCmd(T("AI 助手"));
    var result;
    try {
        result = fn(S, api.newElement, api.removeElement, api.fraction, api.fractionFromTicks, api.division,
                    api.Element, api.Segment, api.NoteHeadGroup, api.SymId, api.Accidental, api.DurationType,
                    helpers, log);
    } catch (e) {
        try { S.endCmd(true); } catch (e2) { }
        var msg = String(e);
        if (e && e.stack) { msg += "\n" + String(e.stack).split("\n").slice(0, 4).join("\n"); }
        return { ok: false, error: msg, logs: logs };
    }
    S.endCmd();
    return { ok: true, result: safeString(result), logs: logs };
}

function formatRunResult(r) {
    var s;
    if (r.ok) {
        s = "OK";
        if (r.result) { s += T("\n返回: ") + r.result; }
    } else {
        s = T("ERROR（已回滚）: ") + r.error;
    }
    if (r.logs && r.logs.length) { s += T("\n日志:\n") + r.logs.join("\n"); }
    return s;
}
