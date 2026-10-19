// arrange-tools：指弹编配函数库。只定义函数和常量，不改谱。
// 会拼在 run_script 的前面执行，可以直接用脚本环境里的 curScore、Element、division。

var AT_LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
var AT_LETTER_FIFTHS = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5 };

// ---------------------------------------------------------------- 和弦标记

function atNote(letter, acc) {
    var L = letter.toUpperCase();
    var alter = { "#": 1, "##": 2, "b": -1, "bb": -2 }[acc || ""] || 0;
    return {
        pc: (((AT_LETTER_PC[L] + alter) % 12) + 12) % 12,
        tpc: 14 + AT_LETTER_FIFTHS[L] + 7 * alter,
        name: L + (acc || "")
    };
}

// "F#m7b5" / "C/G" / "B♭maj7" → { text, root, bass, quality }；认不出返回 null
function atParseChord(text) {
    var t = String(text || "")
        .replace(/<[^>]*>/g, "")
        .replace(/♭/g, "b").replace(/♯/g, "#")
        .replace(/\s+/g, "");
    var m = /^([A-Ga-g])(##|#|bb|b)?(.*)$/.exec(t);
    if (!m) { return null; }
    var root = atNote(m[1], m[2]);
    var rest = m[3];
    var bass = root;
    var sm = /\/([A-Ga-g])(##|#|bb|b)?$/.exec(rest);
    if (sm) {
        bass = atNote(sm[1], sm[2]);
        rest = rest.substring(0, rest.length - sm[0].length);
    }
    return { text: String(text), root: root, bass: bass, quality: rest };
}

function atHarmonyText(a) {
    var cands = [a.text, a.plainText, a.harmonyName];
    for (var i = 0; i < cands.length; i++) {
        if (cands[i] !== undefined && cands[i] !== null && String(cands[i]).length) { return String(cands[i]); }
    }
    return "";
}

// 全谱的和弦标记，按 tick 排序
function atCollectHarmonies() {
    var out = [];
    var seg = curScore.firstSegment();
    var guard = 0;
    while (seg && guard++ < 1000000) {
        var anns = seg.annotations;
        if (anns) {
            for (var i = 0; i < anns.length; i++) {
                var a = anns[i];
                if (!a || a.type !== Element.HARMONY) { continue; }
                var text = atHarmonyText(a);
                out.push({ tick: seg.tick, staffIdx: a.staffIdx, text: text, chord: atParseChord(text) });
            }
        }
        seg = seg.next;
    }
    out.sort(function (x, y) { return x.tick - y.tick; });
    return out;
}

// tick 处生效的和弦：这个谱表上 tick 及之前最近的一个；这个谱表没有和弦标记时用其他谱表的
function atChordAt(harmonies, tick, staffIdx) {
    var own = harmonies.filter(function (x) { return x.staffIdx === staffIdx; });
    var list = own.length ? own : harmonies;
    var cur = null;
    for (var i = 0; i < list.length; i++) {
        if (list[i].tick <= tick) { cur = list[i]; } else { break; }
    }
    return cur;
}

// ---------------------------------------------------------------- 和弦音

// 音程：[半音数, tpc 差]。tpc 差决定拼写，比如减七度拼成 Bbb 而不是 A。
var AT_IV = {
    P1: [0, 0], m2: [1, -5], M2: [2, 2], m3: [3, -3], M3: [4, 4], P4: [5, -1], A4: [6, 6], d5: [6, -6],
    P5: [7, 1], A5: [8, 8], m6: [8, -4], M6: [9, 3], d7: [9, -9], m7: [10, -2], M7: [11, 5],
    s9: [3, -3]   // #9：按吉他手习惯拼成小三度的写法，E7#9 里写 G 而不是 F##
};

// 和弦名里根音后面那部分 → 音程名列表（含根音）。认不出的写法按大三和弦处理。
function atQualityIntervals(quality) {
    var q = String(quality || "").replace(/[\s()]/g, "").replace(/♭/g, "b").replace(/♯/g, "#");
    if (/^5$/.test(q)) { return ["P1", "P5"]; }
    var third = "M3";
    var fifth = "P5";
    var seventh = null;
    var rest = q;
    var m;
    if ((m = /^(m7b5|mi7b5|min7b5|-7b5|ø7?)/.exec(rest))) {
        third = "m3"; fifth = "d5"; seventh = "m7"; rest = rest.substring(m[0].length);
    } else if ((m = /^(dim|o|°)(7?)/.exec(rest))) {
        third = "m3"; fifth = "d5"; if (m[2]) { seventh = "d7"; } rest = rest.substring(m[0].length);
    } else if ((m = /^(aug|\+)/.exec(rest))) {
        fifth = "A5"; rest = rest.substring(m[0].length);
    } else if ((m = /^(min|mi|m)(?!aj|a\d)|^-/.exec(rest))) {
        third = "m3"; rest = rest.substring(m[0].length);
    }
    if (/sus2/.test(rest)) { third = "M2"; } else if (/sus4?/.test(rest)) { third = "P4"; }
    if (!seventh) {
        if (/(maj|Maj|ma|M|Δ|△)(7|9|11|13)/.test(rest) || /^(Δ|△)$/.test(rest)) { seventh = "M7"; }
        else if (/(^|[^#b\d])(7|9|11|13)/.test(rest.replace(/add\d+|69|6\/9/g, ""))) { seventh = "m7"; }
    }
    if (/b5/.test(rest)) { fifth = "d5"; } else if (/#5|\+5/.test(rest)) { fifth = "A5"; }
    var ivs = ["P1", third, fifth];
    if (seventh) { ivs.push(seventh); }
    if (/(^|[^\d])6/.test(rest)) { ivs.push("M6"); }                                   // 6、m6、69、6/9
    if (/b9/.test(rest)) { ivs.push("m2"); }
    if (/#9/.test(rest)) { ivs.push("s9"); }
    if (/(^|[^#b\d])9|69|6\/9|add2|^2$/.test(rest)) { ivs.push("M2"); }               // 9、add9、69、6/9、add2、C2
    if (/#11/.test(rest)) { ivs.push("A4"); } else if (/11/.test(rest)) { ivs.push("P4"); }
    if (/b13/.test(rest)) { ivs.push("m6"); } else if (/13/.test(rest)) { ivs.push("M6"); }
    if (/no3/.test(rest)) { ivs = ivs.filter(function (x) { return x !== "m3" && x !== "M3"; }); }
    if (/no5/.test(rest)) { ivs = ivs.filter(function (x) { return x !== "P5"; }); }
    return ivs;
}

function atClampTpc(tpc) {
    while (tpc > 33) { tpc -= 12; }
    while (tpc < -1) { tpc += 12; }
    return tpc;
}

// 和弦的组成音 [{ pc, tpc, iv }]，从根音开始，不含斜杠后的低音（除非它本来就是和弦音）
function atChordTones(chord) {
    if (!chord) { return []; }
    var out = [];
    var seen = {};
    atQualityIntervals(chord.quality).forEach(function (name) {
        var iv = AT_IV[name];
        if (!iv) { return; }
        var pc = (chord.root.pc + iv[0]) % 12;
        if (seen[pc]) { return; }
        seen[pc] = true;
        out.push({ pc: pc, tpc: atClampTpc(chord.root.tpc + iv[1]), iv: name });
    });
    return out;
}

// [low, high] 之间的和弦音 [{ pitch, tpc }]，从低到高。oneEach 时每个音名只取最靠近音区中间的一个八度。
function atChordTonePitches(chord, low, high, oneEach) {
    var out = [];
    atChordTones(chord).forEach(function (t) {
        var cands = [];
        for (var p = atPitchInRange(t.pc, low); p <= high; p += 12) { cands.push(p); }
        if (oneEach && cands.length > 1) {
            var mid = (low + high) / 2;
            cands.sort(function (a, b) { return Math.abs(a - mid) - Math.abs(b - mid); });
            cands = [cands[0]];
        }
        cands.forEach(function (p) { out.push({ pitch: p, tpc: t.tpc }); });
    });
    return out.sort(function (a, b) { return a.pitch - b.pitch; });
}

// ---------------------------------------------------------------- 位置与范围

function atMeasures() {
    var out = [];
    var m = curScore.firstMeasure;
    var i = 1;
    var guard = 0;
    while (m && guard++ < 100000) {
        var start = m.firstSegment ? m.firstSegment.tick : 0;
        var next = m.nextMeasure;
        var end = (next && next.firstSegment) ? next.firstSegment.tick : (curScore.lastSegment ? curScore.lastSegment.tick : start);
        var num = 0;
        var den = 0;
        try {
            var ts = m.timesigNominal;
            if (ts) { num = ts.numerator; den = ts.denominator; }
        } catch (e) { }
        if (!num || !den) {
            // 读不到拍号时按小节长度猜：只能分出 4/4、3/4、2/4
            var q = Math.round((end - start) / division);
            num = q > 0 ? q : 4;
            den = 4;
        }
        out.push({ index: i, startTick: start, endTick: end, num: num, den: den });
        m = next;
        i++;
    }
    return out;
}

// 每个乐器的第一行谱表（和 [s0, s1) 有交集的乐器）
function atMainStaves(s0, s1) {
    var out = [];
    var parts = curScore.parts;
    for (var i = 0; parts && i < parts.length; i++) {
        var first = Math.floor(parts[i].startTrack / 4);
        var last = Math.floor(parts[i].endTrack / 4);   // 不含
        if (first < s1 && last > s0 && out.indexOf(first) < 0) { out.push(first); }
    }
    if (!out.length) {
        for (var s = s0; s < s1; s++) { out.push(s); }
    }
    return out.sort(function (a, b) { return a - b; });
}

// 要处理的范围：范围选区 > 点选音符所在的小节 > 全谱
function atScope(h) {
    var ms = atMeasures();
    var end = ms.length ? ms[ms.length - 1].endTick : 0;
    var sel = curScore.selection;
    if (sel && sel.isRange && sel.startSegment) {
        return {
            fromTick: sel.startSegment.tick,
            toTick: sel.endSegment ? sel.endSegment.tick : end,
            staves: atMainStaves(sel.startStaff, sel.endStaff),
            whole: false
        };
    }
    var its = h ? h.selectionItems() : [];
    if (its.length) {
        var from = end;
        var to = 0;
        var staves = {};
        its.forEach(function (it) {
            var m = ms[it.measure - 1];
            if (m) { from = Math.min(from, m.startTick); to = Math.max(to, m.endTick); }
            staves[it.staffIdx] = true;
        });
        var keys = Object.keys(staves).map(Number);
        return { fromTick: from, toTick: to, staves: atMainStaves(Math.min.apply(null, keys), Math.max.apply(null, keys) + 1), whole: false };
    }
    return { fromTick: 0, toTick: end, staves: atMainStaves(0, curScore.nstaves), whole: true };
}

// ---------------------------------------------------------------- 加音

function atPitchInRange(pc, low) {
    if (low === undefined || low === null) { low = 40; }
    return low + ((((pc - low) % 12) + 12) % 12);
}

function atLength(e) {
    var f = null;
    try { f = e.actualDuration || e.duration; } catch (x) { }
    return f ? f.ticks : 0;
}

// 这个声部在 tick 处：start 正好有元素开头；cover 被前面更长的元素盖着；gap 空着
function atVoiceState(staffIdx, voice, tick, measureStart) {
    var c = curScore.newCursor();
    c.staffIdx = staffIdx;
    c.voice = voice;
    c.rewindToTick(measureStart);
    var guard = 0;
    while (c.segment && c.tick <= tick && guard++ < 10000) {
        var e = c.element;
        if (e) {
            var isChord = e.type === Element.CHORD;
            if (c.tick === tick) { return { state: "start", element: e, isChord: isChord, tick: c.tick }; }
            if (c.tick < tick && c.tick + atLength(e) > tick) { return { state: "cover", element: e, isChord: isChord, tick: c.tick }; }
        }
        if (!c.next()) { break; }
    }
    return { state: "gap", element: null, isChord: false, tick: tick };
}

// 这个声部在 tick 处响着的最低音；没有音（休止或空）返回 null。用来让伴奏待在旋律下面。
function atLowestPitchAt(staffIdx, voice, tick, measureStart) {
    var st = atVoiceState(staffIdx, voice, tick, measureStart);
    if (!st.isChord || st.state === "gap") { return null; }
    var low = null;
    var notes = st.element.notes;
    for (var i = 0; i < notes.length; i++) {
        if (low === null || notes[i].pitch < low) { low = notes[i].pitch; }
    }
    return low;
}

// 贝斯一般放的拍位（相对小节开头的 tick）：4/4、2/2 第 1、3 拍；6/8 第 1、4 拍；12/8 第 1、7 拍；其他只放第 1 拍
function atBassBeatOffsets(num, den) {
    var q = division;
    var sig = num + "/" + den;
    if (sig === "4/4" || sig === "2/2") { return [0, 2 * q]; }
    if (sig === "6/8") { return [0, 3 * q / 2]; }
    if (sig === "12/8") { return [0, 3 * q]; }
    return [0];
}

// "第3小节第2拍" / "第3小节第2拍后半"
function atBeatLabel(m, tick) {
    var unit = (m.den === 8) ? division / 2 : division * 4 / m.den;
    var off = tick - m.startTick;
    var beat = Math.floor(off / unit) + 1;
    var rem = off % unit;
    return "第" + m.index + "小节第" + beat + "拍" + (rem === 0 ? "" : rem * 2 === unit ? "后半" : "+" + rem);
}

function atGcd(a, b) { return b ? atGcd(b, a % b) : a; }

// tick 数 → 约分后的 [分子, 分母]（以全音符为 1）
function atTicksToNd(ticks) {
    var whole = division * 4;
    var g = atGcd(ticks, whole);
    return [ticks / g, whole / g];
}

// 在 staffIdx 的 voice 声部、tick 处加一个时值 n/d 的音，不覆盖已有的音
function atAddNote(staffIdx, voice, tick, measureStart, pitch, tpc, n, d) {
    var st = atVoiceState(staffIdx, voice, tick, measureStart);
    if (st.state === "start" && st.isChord) { return "occupied"; }
    if (st.state === "cover") { return st.isChord ? "occupied" : "blocked"; }

    var c = curScore.newCursor();
    c.staffIdx = staffIdx;
    if (st.state === "start") {
        // 这里正好是一个休止符：直接换成音
        c.voice = voice;
        c.rewindToTick(tick);
    } else {
        // 这个声部在 tick 处是空的：借本谱表其他声部在 tick 处的拍位定位，再切回目标声部。
        // MuseScore 会先用休止符把这一小节的空声部补满，再放进音。
        var found = false;
        for (var v = 0; v < 4 && !found; v++) {
            if (v === voice) { continue; }
            c.voice = v;
            c.rewindToTick(tick);
            found = !!(c.segment && c.tick === tick);
        }
        if (!found) { return "noslot"; }
        c.voice = voice;
    }
    c.setDuration(n, d);
    c.addNote(pitch, false);

    var after = atVoiceState(staffIdx, voice, tick, measureStart);
    if (after.state !== "start" || !after.isChord) { return "failed"; }
    atSetTpc(after.element, pitch, tpc);
    return "added";
}

// 把和弦里音高为 pitch 的那个音拼成 tpc；移调乐器保留书面谱和实际音高之间的 tpc 差
function atSetTpc(chord, pitch, tpc) {
    if (tpc === undefined || tpc === null || !chord) { return; }
    var notes = chord.notes;
    for (var i = 0; i < notes.length; i++) {
        var note = notes[i];
        if (note.pitch !== pitch) { continue; }
        var delta = 0;
        try { delta = note.tpc2 - note.tpc1; } catch (x) { }
        if (isNaN(delta)) { delta = 0; }
        note.tpc1 = atClampTpc(tpc);
        note.tpc2 = atClampTpc(tpc + delta);
        return;
    }
}

// 这个谱表上有没有任何声部在 tick 处起头（光标只能停在这样的位置）
function atHasSegment(staffIdx, tick) {
    var c = curScore.newCursor();
    c.staffIdx = staffIdx;
    for (var v = 0; v < 4; v++) {
        c.voice = v;
        c.rewindToTick(tick);
        if (c.segment && c.tick === tick) { return true; }
    }
    return false;
}

// tick 被这个声部前面一个更长的休止符盖着时，把休止符缩短到 tick 为止，MuseScore 会从 tick 起补上休止符。
// 返回 tick 处现在是不是一个元素的开头。
function atSplitRestAt(staffIdx, voice, tick, measureStart) {
    var st = atVoiceState(staffIdx, voice, tick, measureStart);
    if (st.state === "start") { return true; }
    if (st.state !== "cover" || st.isChord) { return false; }
    var nd = atTicksToNd(tick - st.tick);
    st.element.duration = fraction(nd[0], nd[1]);
    return atVoiceState(staffIdx, voice, tick, measureStart).state === "start";
}

// 这个声部从小节开头到 tick 都是空的、tick 处又没有可以停光标的位置时：
// 在小节开头放一个八分休止符，MuseScore 会把这个声部的整小节补满休止符，之后 tick 处就能放音了。
function atOpenVoice(staffIdx, voice, measureStart, tick) {
    var probe = curScore.newCursor();
    probe.staffIdx = staffIdx;
    probe.voice = voice;
    probe.rewindToTick(measureStart);
    if (probe.segment && probe.tick < tick) { return false; }   // 这个声部前面已经有东西
    var c = curScore.newCursor();
    c.staffIdx = staffIdx;
    for (var v = 0; v < 4; v++) {
        if (v === voice) { continue; }
        c.voice = v;
        c.rewindToTick(measureStart);
        if (c.segment && c.tick === measureStart) {
            c.voice = voice;
            c.setDuration(1, 8);
            c.addRest();
            return true;
        }
    }
    return false;
}

// 在 tick 处加一个和弦：notes = [{ pitch, tpc }]，几个音同时响，时值 n/d。不覆盖已有的音。
// 被长休止符盖着时先把休止符拆开；声部是空的时先补休止符开出位置。
// 返回 added、occupied、blocked、noslot、failed，或者 partial（只加上了一部分音）。
function atAddChord(staffIdx, voice, tick, measureStart, notes, n, d) {
    if (!notes.length) { return "failed"; }
    var st = atVoiceState(staffIdx, voice, tick, measureStart);
    if (st.isChord && st.state !== "gap") { return "occupied"; }
    if (st.state === "gap" && !atHasSegment(staffIdx, tick)) {
        atOpenVoice(staffIdx, voice, measureStart, tick);
        st = atVoiceState(staffIdx, voice, tick, measureStart);
    }
    if (st.state === "cover" && !atSplitRestAt(staffIdx, voice, tick, measureStart)) { return "blocked"; }
    var r = atAddNote(staffIdx, voice, tick, measureStart, notes[0].pitch, notes[0].tpc, n, d);
    if (r !== "added") { return r; }
    // 其余的音加进同一个和弦：光标定位到 tick 后，addNote(音高, true) 会加到这个位置的和弦里
    var c = curScore.newCursor();
    c.staffIdx = staffIdx;
    c.voice = voice;
    for (var i = 1; i < notes.length; i++) {
        c.rewindToTick(tick);
        if (!c.segment || c.tick !== tick) { return "partial"; }
        c.addNote(notes[i].pitch, true);
        atSetTpc(atVoiceState(staffIdx, voice, tick, measureStart).element, notes[i].pitch, notes[i].tpc);
    }
    var fin = atVoiceState(staffIdx, voice, tick, measureStart);
    return (fin.isChord && fin.element.notes.length >= notes.length) ? "added" : "partial";
}
