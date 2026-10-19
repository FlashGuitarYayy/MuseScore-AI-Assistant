// 一个够测试用的假 MuseScore 插件 API，只模拟插件脚本用到的部分。
// 每个 track 是一串和弦/休止符（声部 2 以上可以有空档）；小节长度由拍号决定，全音符 = 1920 tick。
// 光标的语义照 MuseScore：位置是一个 tick（段落），切换声部不改变位置；
// addNote 先像 expandVoice 那样把空声部补成休止符，再像 setNoteRest 那样放音。

var T_CHORD = 1, T_REST = 2, T_NOTE = 3, T_ART = 4, T_HARMONY = 5, T_LYRICS = 6;

function makeFraction(n, d) {
    return { numerator: n, denominator: d, ticks: Math.round(1920 * n / d), str: n + "/" + d };
}

function reduce(ticks) {
    function gcd(a, b) { return b ? gcd(b, a % b) : a; }
    var g = gcd(ticks, 1920);
    return makeFraction(ticks / g, 1920 / g);
}

function tpcNearest(pitch) { return ((pitch * 7 + 26 - 11) % 12) + 11; }

function FakeScore(nmeasures, nstaves, timesig) {
    timesig = timesig || [4, 4];
    this.num = timesig[0];
    this.den = timesig[1];
    this.mlen = 1920 * this.num / this.den;
    this.nmeasures = nmeasures;
    this.nstaves = nstaves;
    this.ntracks = nstaves * 4;
    this.tracks = [];
    for (var t = 0; t < this.ntracks; t++) { this.tracks.push([]); }
    this.harmonies = [];   // {tick, staffIdx, text}
    this.log = [];
    this.snapshot = null;
    this.cmdDepth = 0;
    this.title = "测试谱";
    this.keysig = 0;
    this.parts = [{ startTrack: 0, endTrack: nstaves * 4, partName: "吉他", hasTabStaff: false, hasDrumStaff: false }];
    this.staffKinds = [];   // 每条谱表 "pitched" | "tab"，没写的按 pitched
    this.links = {};        // 联动：{ 谱表号: 主谱表号 }
    var self = this;
    this.selection = {
        isRange: false, startSegment: null, endSegment: null, startStaff: 0, endStaff: 1, elements: [],
        clear: function () { this.isRange = false; this.elements = []; return true; },
        select: function (e, add) { if (!add) { this.elements = []; } this.isRange = false; this.elements.push(e); return true; },
        selectRange: function (a, b, s0, s1) {
            this.isRange = true; this.startSegment = { tick: a }; this.endSegment = b >= self.endTick() ? null : { tick: b };
            this.startStaff = s0; this.endStaff = s1; this.elements = []; return true;
        }
    };
}

FakeScore.fromSpec = function (spec) {
    var s = new FakeScore(spec.nmeasures, spec.nstaves || 1, spec.timesig);
    Object.keys(spec.tracks).forEach(function (k) {
        var t = Number(k);
        spec.tracks[k].forEach(function (e) {
            var cr = { tick: e[0], len: e[1], isChord: !!e[2] };
            if (e[2]) {
                cr.notes = e[2].map(function (p, i) { return { pitch: p, tpc1: e[3][i], tpc2: e[3][i], headGroup: 0 }; });
            }
            s.tracks[t].push(s.wrapCR(cr, t));
        });
        s.tracks[t].sort(function (a, b) { return a.tick - b.tick; });
    });
    s.harmonies = (spec.harmonies || []).map(function (h) { return { tick: h[0], staffIdx: h[1], text: h[2] }; });
    if (spec.staffTypes) { s.setStaffTypes(spec.staffTypes, spec.links); }
    // lyrics: [[tick, track, text, verse, syllabic], ...]，挂到那条音轨那个 tick 的和弦/休止符上
    (spec.lyrics || []).forEach(function (l) { s.addLyric(l[1], l[0], l[2], l[3], l[4]); });
    return s;
};

FakeScore.prototype.endTick = function () { return this.nmeasures * this.mlen; };

// 谱表类型和联动。kinds: ["pitched", "tab", ...]；links: { 1: 0 } 表示谱表 1 联动到谱表 0
FakeScore.prototype.setStaffTypes = function (kinds, links) {
    this.staffKinds = kinds.slice();
    this.links = links || {};
    var self = this;
    this.parts[0].hasTabStaff = kinds.some(function (k) { return k === "tab"; });
    self._staves = null;
};

// Score.staves：每条谱表的包装，照 4.6.3 的 Staff（isTabStaff/isPitchedStaff 带 tick 参数，primaryStaff 是联动组的主谱表）
Object.defineProperty(FakeScore.prototype, "staves", {
    get: function () {
        var self = this;
        var out = [];
        for (var i = 0; i < this.nstaves; i++) {
            (function (idx) {
                var kind = self.staffKinds[idx] || "pitched";
                out.push({
                    idx: idx,
                    part: self.parts[0],
                    isTabStaff: function () { return kind === "tab"; },
                    isPitchedStaff: function () { return kind === "pitched"; },
                    isDrumStaff: function () { return false; },
                    get primaryStaff() { var p = self.links[idx]; return out[p === undefined ? idx : p]; }
                });
            })(i);
        }
        return out;
    }
});

FakeScore.prototype.addLyric = function (track, tick, text, verse, syllabic) {
    var arr = this.tracks[track];
    for (var i = 0; i < arr.length; i++) {
        if (arr[i].tick === tick) {
            var L = { type: T_LYRICS, text: text, verse: verse || 0, syllabic: syllabic || 0, lyricTicks: null, parent: arr[i] };
            arr[i].lyrics.push(L);
            return L;
        }
    }
    throw new Error("addLyric: 音轨 " + track + " 在 " + tick + " 没有元素");
};

// 一条音轨上的歌词：[[tick, text, verse], ...]
FakeScore.prototype.dumpLyrics = function (t) {
    var out = [];
    this.tracks[t].forEach(function (cr) { cr.lyrics.forEach(function (l) { out.push([cr.tick, l.text, l.verse]); }); });
    return out;
};

FakeScore.prototype.wrapCR = function (cr, track) {
    var self = this;
    cr.track = track;
    cr.type = cr.isChord ? T_CHORD : T_REST;
    cr.tuplet = null;
    cr.fraction = { ticks: cr.tick };
    if (!cr.articulations) { cr.articulations = []; }
    if (!cr.lyrics) { cr.lyrics = []; }
    cr.lyrics.forEach(function (l) { l.type = T_LYRICS; l.parent = cr; });
    Object.defineProperty(cr, "duration", {
        configurable: true,
        get: function () { return reduce(cr.len); },
        set: function (f) { self.changeCRlen(cr, f.ticks); }
    });
    (cr.notes || []).forEach(function (n) {
        n.type = T_NOTE;
        n.parent = cr;
        Object.defineProperty(n, "tpc", { configurable: true, get: function () { return n.tpc1; } });
    });
    return cr;
};

FakeScore.prototype.fill = function (track, spec) {
    // spec: [[pitches 或 null, len], ...]，从 tick 0 开始首尾相接；pitches 元素是 [pitch, tpc]
    var tick = 0;
    var arr = this.tracks[track];
    for (var i = 0; i < spec.length; i++) {
        var pitches = spec[i][0];
        var len = spec[i][1];
        var cr = { tick: tick, len: len, isChord: !!pitches };
        if (pitches) {
            cr.notes = pitches.map(function (p) { return { pitch: p[0], tpc1: p[1], tpc2: p[1], headGroup: 0 }; });
        }
        arr.push(this.wrapCR(cr, track));
        tick += len;
    }
    if (tick < this.endTick()) { arr.push(this.wrapCR({ tick: tick, len: this.endTick() - tick, isChord: false }, track)); }
};

// 用对齐的休止符填 [from, to)，和 MuseScore 一样按拍位切分：8 分之后接 4 分，再接 2 分……
FakeScore.prototype.fillRests = function (track, from, to) {
    var mStart = Math.floor(from / this.mlen) * this.mlen;
    var pos = from;
    while (pos < to) {
        var rel = pos - mStart;
        var d = 1920;
        while (d > 30 && (rel % d !== 0 || pos + d > to)) { d /= 2; }
        this.tracks[track].push(this.wrapCR({ tick: pos, len: d, isChord: false }, track));
        pos += d;
    }
    this.tracks[track].sort(function (a, b) { return a.tick - b.tick; });
};

FakeScore.prototype.changeCRlen = function (cr, newLen) {
    var arr = this.tracks[cr.track];
    var i = arr.indexOf(cr);
    if (i < 0) { throw new Error("changeCRlen: 元素已不在谱里"); }
    var old = cr.len;
    if (newLen === old) { return; }
    if (newLen < old) {
        cr.len = newLen;
        arr.splice(i + 1, 0, this.wrapCR({ tick: cr.tick + newLen, len: old - newLen, isChord: false }, cr.track));
        return;
    }
    var end = cr.tick + newLen;
    cr.len = newLen;
    var j = i + 1;
    while (j < arr.length && arr[j].tick < end) {
        var nx = arr[j];
        var nxEnd = nx.tick + nx.len;
        nx.dead = true;
        arr.splice(j, 1);
        if (nxEnd > end) {
            arr.splice(j, 0, this.wrapCR({ tick: end, len: nxEnd - end, isChord: false }, cr.track));
            break;
        }
    }
};

// 段落 = 有和弦/休止符起头的位置，再加上挂着和弦标记的位置（和弦标记自己也占一个段落）。
// 按内容签名缓存：测试会直接往 tracks 里 push，所以不靠显式失效。
FakeScore.prototype.segTicks = function () {
    var n = 0;
    var sum = 0;
    this.tracks.forEach(function (arr) { n += arr.length; for (var i = 0; i < arr.length; i++) { sum = (sum * 31 + arr[i].tick) % 1000000007; } });
    var sig = n + ":" + sum + ":" + this.harmonies.length;
    if (this._segSig === sig) { return this._segCache; }
    var set = {};
    this.tracks.forEach(function (arr) { arr.forEach(function (cr) { set[cr.tick] = true; }); });
    this.harmonies.forEach(function (h) { set[h.tick] = true; });
    this._segSig = sig;
    this._segCache = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
    return this._segCache;
};

FakeScore.prototype.segTicksUncached = function () {
    var set = {};
    this.tracks.forEach(function (arr) { arr.forEach(function (cr) { set[cr.tick] = true; }); });
    this.harmonies.forEach(function (h) { set[h.tick] = true; });
    return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
};

FakeScore.prototype.segmentAt = function (tick) {
    var self = this;
    var ticks = this.segTicks();
    var idx = ticks.indexOf(tick);
    if (idx < 0) { return null; }
    return {
        tick: tick,
        elementAt: function (t) {
            var arr = self.tracks[t] || [];
            for (var i = 0; i < arr.length; i++) { if (arr[i].tick === tick) { return arr[i]; } }
            return null;
        },
        get annotations() {
            return self.harmonies.filter(function (h) { return h.tick === tick; }).map(function (h) {
                return { type: T_HARMONY, staffIdx: h.staffIdx, track: h.staffIdx * 4, text: h.text };
            });
        },
        get next() { return idx + 1 < ticks.length ? self.segmentAt(ticks[idx + 1]) : null; }
    };
};

FakeScore.prototype.firstSegment = function () { var t = this.segTicks(); return t.length ? this.segmentAt(t[0]) : null; };

Object.defineProperty(FakeScore.prototype, "firstMeasure", {
    get: function () { return this.measureObj(0); }
});
Object.defineProperty(FakeScore.prototype, "lastSegment", {
    get: function () { return { tick: this.endTick() }; }
});

FakeScore.prototype.measureObj = function (i) {
    if (i >= this.nmeasures) { return null; }
    var self = this;
    return {
        firstSegment: { tick: i * self.mlen },
        timesigNominal: { numerator: self.num, denominator: self.den },
        get nextMeasure() { return self.measureObj(i + 1); }
    };
};

FakeScore.prototype.newCursor = function () { return new FakeCursor(this); };

FakeScore.prototype.startCmd = function () {
    if (this.cmdDepth++ === 0) { this.snapshot = this.cloneTracks(); }
};
FakeScore.prototype.endCmd = function (rollback) {
    if (--this.cmdDepth === 0) {
        if (rollback) { this.tracks = this.snapshot; }
        this.snapshot = null;
    }
};
FakeScore.prototype.cloneTracks = function () {
    var self = this;
    return this.tracks.map(function (arr, t) {
        return arr.map(function (cr) {
            var c = { tick: cr.tick, len: cr.len, isChord: cr.isChord, articulations: cr.articulations.map(function (a) { return { type: a.type, symbol: a.symbol, userName: a.userName }; }),
                      lyrics: cr.lyrics.map(function (l) { return { text: l.text, verse: l.verse, syllabic: l.syllabic, lyricTicks: l.lyricTicks }; }) };
            if (cr.notes) { c.notes = cr.notes.map(function (n) { return { pitch: n.pitch, tpc1: n.tpc1, tpc2: n.tpc2, headGroup: n.headGroup }; }); }
            return self.wrapCR(c, t);
        });
    });
};

// 一个 track 的内容，便于比较前后是否变化
FakeScore.prototype.dumpTrack = function (t) {
    return this.tracks[t].map(function (cr) {
        return cr.tick + ":" + cr.len + ":" + (cr.isChord ? cr.notes.map(function (n) { return n.pitch + "/" + n.tpc1; }).join(",") : "R");
    }).join(" ");
};

function FakeCursor(score) {
    this.score = score;
    this.track = 0;
    this.curTick = null;
    this.lastTick = null;   // MuseScore InputState 的 lastSegment：rewind 时等于当前位置，放完音后是刚放音的位置
    this.dur = 480;
}
Object.defineProperty(FakeCursor.prototype, "staffIdx", {
    get: function () { return Math.floor(this.track / 4); },
    set: function (s) { this.track = s * 4 + (this.track % 4); }
});
Object.defineProperty(FakeCursor.prototype, "voice", {
    get: function () { return this.track % 4; },
    set: function (v) { this.track = Math.floor(this.track / 4) * 4 + v; }
});
FakeCursor.prototype.rewindToTick = function (t) {
    // 像 MuseScore：先找 tick+1 左边最近的段落，再向后找本 track 第一个元素
    var ticks = this.score.segTicks();
    var segTick = ticks.length ? ticks[0] : 0;
    for (var i = 0; i < ticks.length; i++) { if (ticks[i] <= t) { segTick = ticks[i]; } }
    var arr = this.score.tracks[this.track];
    this.curTick = null;
    for (var j = 0; j < arr.length; j++) { if (arr[j].tick >= segTick) { this.curTick = arr[j].tick; break; } }
    this.lastTick = this.curTick;
};
Object.defineProperty(FakeCursor.prototype, "element", {
    get: function () {
        if (this.curTick === null) { return null; }
        var arr = this.score.tracks[this.track];
        for (var i = 0; i < arr.length; i++) { if (arr[i].tick === this.curTick) { return arr[i]; } }
        return null;
    }
});
Object.defineProperty(FakeCursor.prototype, "segment", {
    get: function () { return (this.curTick !== null && this.score.segTicks().indexOf(this.curTick) >= 0) ? { tick: this.curTick } : null; }
});
Object.defineProperty(FakeCursor.prototype, "tick", { get: function () { return this.curTick !== null ? this.curTick : this.score.endTick(); } });
Object.defineProperty(FakeCursor.prototype, "keySignature", { get: function () { return this.score.keysig; } });
FakeCursor.prototype.next = function () {
    var arr = this.score.tracks[this.track];
    var cur = this.curTick;
    this.curTick = null;
    for (var i = 0; i < arr.length; i++) { if (arr[i].tick > cur) { this.curTick = arr[i].tick; break; } }
    return !!this.segment;
};
FakeCursor.prototype.setDuration = function (z, n) { this.dur = Math.round(1920 * z / n); };
FakeCursor.prototype.add = function (a) {
    var e = this.element;
    // 歌词可以挂在和弦或休止符上（4.6.3 Cursor::add 的 LYRICS 分支只要求 isChordRest）
    if (a.type === T_LYRICS) {
        if (!e) { throw new Error("cursor.add: 这里没有和弦或休止符"); }
        a.parent = e;
        e.lyrics.push(a);
        return;
    }
    if (!e || !e.isChord) { throw new Error("cursor.add: 这里没有和弦"); }
    a.parent = e;
    a.userName = function () { return a.symbol === 100 ? "下弓" : a.symbol === 101 ? "上弓" : "记号" + a.symbol; };
    e.articulations.push(a);
};
// addToChord：和 MuseScore 的 Score::addPitch 一样，加到 lastSegment 上本 track 的和弦里，光标不动
FakeCursor.prototype.addNote = function (pitch, addToChord) {
    var s = this.score;
    if (addToChord) {
        var arr0 = s.tracks[this.track];
        var cr0 = null;
        for (var k = 0; k < arr0.length; k++) { if (arr0[k].tick === this.lastTick) { cr0 = arr0[k]; } }
        if (!cr0 || !cr0.isChord) { s.log.push("addNote(addToChord): lastSegment 上没有和弦 @" + this.lastTick); return; }
        if (cr0.notes.some(function (n) { return n.pitch === pitch; })) { return; }
        var tpc0 = tpcNearest(pitch);
        var n0 = { pitch: pitch, tpc1: tpc0, tpc2: tpc0, headGroup: 0, type: T_NOTE, parent: cr0 };
        Object.defineProperty(n0, "tpc", { configurable: true, get: function () { return n0.tpc1; } });
        cr0.notes.push(n0);
        cr0.notes.sort(function (a, b) { return a.pitch - b.pitch; });
        return;
    }
    this.setNoteRest([pitch]);
};

FakeCursor.prototype.addRest = function () { this.setNoteRest(null); };

FakeCursor.prototype.setNoteRest = function (pitches) {
    var s = this.score;
    var track = this.track;
    var T = this.curTick;
    if (T === null || !this.segment) { s.log.push("addNote: 光标没有位置"); return; }
    var mStart = Math.floor(T / s.mlen) * s.mlen;
    var mEnd = mStart + s.mlen;
    var arr = s.tracks[track];
    var startsHere = arr.some(function (cr) { return cr.tick === T; });
    if (!startsHere) {
        // expandVoice
        var prev = null;
        arr.forEach(function (cr) { if (cr.tick < T && cr.tick >= mStart) { prev = cr; } });
        if (prev && prev.tick + prev.len > T) { s.log.push("expandVoice: 被前面的元素盖住 @" + T); return; }
        var gapStart = prev ? prev.tick + prev.len : mStart;
        var nexts = arr.filter(function (cr) { return cr.tick > T && cr.tick < mEnd; });
        var gapEnd = nexts.length ? nexts[0].tick : mEnd;
        s.fillRests(track, gapStart, T);
        s.fillRests(track, T, gapEnd);
        arr = s.tracks[track];
    }
    // setNoteRest
    var end = T + this.dur;
    var removedEnd = end;
    for (var i = arr.length - 1; i >= 0; i--) {
        var cr = arr[i];
        if (cr.tick >= T && cr.tick < end) {
            removedEnd = Math.max(removedEnd, cr.tick + cr.len);
            cr.dead = true;
            arr.splice(i, 1);
        }
    }
    if (pitches) {
        var notes = pitches.map(function (p) { var tpc = tpcNearest(p); return { pitch: p, tpc1: tpc, tpc2: tpc, headGroup: 0 }; });
        arr.push(s.wrapCR({ tick: T, len: this.dur, isChord: true, notes: notes }, track));
    } else {
        arr.push(s.wrapCR({ tick: T, len: this.dur, isChord: false }, track));
    }
    if (removedEnd > end) { s.fillRests(track, end, removedEnd); }
    arr.sort(function (a, b) { return a.tick - b.tick; });
    this.lastTick = T;
    this.curTick = end;
};

function makeApi(score) {
    return {
        curScore: score,
        division: 480,
        newElement: function (t) {
            if (t === T_LYRICS) { return { type: T_LYRICS, text: "", verse: 0, syllabic: 0, lyricTicks: null, placement: 1 }; }
            return { type: t, symbol: null };
        },
        removeElement: function (a) {
            var list = a.type === T_LYRICS ? a.parent.lyrics : a.parent.articulations;
            var i = list.indexOf(a);
            if (i < 0) { throw new Error("removeElement: 元素不在它的父元素里"); }
            list.splice(i, 1);
        },
        fraction: makeFraction,
        fractionFromTicks: function (t) { return reduce(t); },
        Element: { CHORD: T_CHORD, REST: T_REST, NOTE: T_NOTE, ARTICULATION: T_ART, HARMONY: T_HARMONY, LYRICS: T_LYRICS },
        Segment: {},
        NoteHeadGroup: { HEAD_NORMAL: 0, HEAD_CROSS: 1 },
        SymId: { stringsDownBow: 100, stringsUpBow: 101, articStaccatoAbove: 102 },
        Accidental: {},
        DurationType: {}
    };
}
