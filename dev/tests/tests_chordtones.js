// chord-tones-eighths，以及 arrange-tools 里的和弦音函数（atChordTones、atAddChord 等）

function toneNames(text) {
    return libEval(new FakeScore(1, 1), "return atChordTones(atParseChord(" + JSON.stringify(text) + ")).map(function (t) { return t.tpc; });")
        .map(function (tpc) { return Theory.tpcName(tpc); });
}
function v2chords(s) {
    return s.tracks[1].filter(function (cr) { return cr.isChord; }).map(function (cr) {
        return [cr.tick, cr.len, cr.notes.map(function (n) { return n.pitch; })];
    });
}
function quarters(p, n) { var a = []; for (var i = 0; i < n; i++) { a.push(q(p)); } return a; }

// ---------------------------------------------------------------- 和弦音
test("chordtones: 三和弦、七和弦，拼写按音程", function () {
    eq(toneNames("C"), ["C", "E", "G"]);
    eq(toneNames("Am"), ["A", "C", "E"]);
    eq(toneNames("Ebm"), ["Eb", "Gb", "Bb"]);
    eq(toneNames("Bb"), ["Bb", "D", "F"]);
    eq(toneNames("G7"), ["G", "B", "D", "F"]);
    eq(toneNames("Dm7"), ["D", "F", "A", "C"]);
    eq(toneNames("Cmaj7"), ["C", "E", "G", "B"]);
    eq(toneNames("CM7"), ["C", "E", "G", "B"]);
    eq(toneNames("CΔ7"), ["C", "E", "G", "B"]);
    eq(toneNames("CmMaj7"), ["C", "Eb", "G", "B"]);
    eq(toneNames("F#m7b5"), ["F#", "A", "C", "E"]);
    eq(toneNames("Bdim7"), ["B", "D", "F", "Ab"]);
    eq(toneNames("Cdim"), ["C", "Eb", "Gb"]);
    eq(toneNames("Caug"), ["C", "E", "G#"]);
    eq(toneNames("C+"), ["C", "E", "G#"]);
    eq(toneNames("C7b5"), ["C", "E", "Gb", "Bb"]);
});
test("chordtones: 挂留、加音、延伸音、斜杠", function () {
    eq(toneNames("Csus4"), ["C", "F", "G"]);
    eq(toneNames("Dsus2"), ["D", "E", "A"]);
    eq(toneNames("G7sus4"), ["G", "C", "D", "F"]);
    eq(toneNames("Gadd9"), ["G", "B", "D", "A"]);
    eq(toneNames("C6"), ["C", "E", "G", "A"]);
    eq(toneNames("Cm6"), ["C", "Eb", "G", "A"]);
    eq(toneNames("C69"), ["C", "E", "G", "A", "D"]);
    eq(toneNames("C9"), ["C", "E", "G", "Bb", "D"]);
    eq(toneNames("Cmaj9"), ["C", "E", "G", "B", "D"]);
    eq(toneNames("Cm9"), ["C", "Eb", "G", "Bb", "D"]);
    eq(toneNames("C7b9"), ["C", "E", "G", "Bb", "Db"]);
    eq(toneNames("E7#9"), ["E", "G#", "B", "D", "G"]);
    eq(toneNames("C11"), ["C", "E", "G", "Bb", "F"]);
    eq(toneNames("C13"), ["C", "E", "G", "Bb", "A"]);
    eq(toneNames("C5"), ["C", "G"]);
    eq(toneNames("D/F#"), ["D", "F#", "A"]);
    eq(toneNames("G/F"), ["G", "B", "D"], "斜杠后不是和弦音的低音不算");
});
test("chordtones: 音区里的全部和弦音 / 每个音名一个", function () {
    var all = libEval(new FakeScore(1, 1), "return atChordTonePitches(atParseChord('C'), 52, 65, false).map(function (n) { return [n.pitch, n.tpc]; });");
    eq(all, [[52, 18], [55, 15], [60, 14], [64, 18]]);
    var one = libEval(new FakeScore(1, 1), "return atChordTonePitches(atParseChord('C'), 52, 65, true).map(function (n) { return n.pitch; });");
    eq(one, [55, 60, 64]);
    eq(libEval(new FakeScore(1, 1), "return atChordTonePitches(atParseChord('C'), 52, 51, false).length;"), 0);
});

// ---------------------------------------------------------------- 铺八分
test("chord-tones: 空声部也能铺，旋律下方叠出全部和弦音，第 1、3 拍留给贝斯", function () {
    var s = synth([4, 4], 1, quarters(72, 4), [[0, "C"]]);
    var mel = s.dumpTrack(0);
    var r = runSkillOn(s, "chord-tones-eighths");
    ok(r.ok, JSON.stringify(r));
    eq(v2chords(s), [240, 480, 720, 1200, 1440, 1680].map(function (t) { return [t, 240, [52, 55, 60, 64, 67]]; }));
    eq(s.tracks[1].filter(function (cr) { return cr.isChord; })[0].notes.map(function (n) { return n.tpc1; }), [18, 15, 14, 18, 15]);
    contiguous(s, 1, 0, 1920);
    eq(s.dumpTrack(0), mel, "旋律不能动");
    eq(s.log, []);
    ok(r.result.indexOf("在 6 个位置叠了和弦音，共 30 个音") >= 0, r.result);
    ok(r.result.indexOf("2 个强拍位置留给贝斯") >= 0, r.result);
});
test("chord-tones: 先贝斯后和弦音，和反过来的结果一样", function () {
    function build() { return synth([4, 4], 1, quarters(72, 4), [[0, "C"], [960, "G7"]]); }
    var a = build();
    runSkillOn(a, "bass-1-3");
    var r = runSkillOn(a, "chord-tones-eighths");
    ok(r.result.indexOf("2 个位置声部 2 已经有音") >= 0, r.result);
    eq(v2chords(a), [
        [0, 240, [48]], [240, 240, [52, 55, 60, 64, 67]], [480, 240, [52, 55, 60, 64, 67]], [720, 240, [52, 55, 60, 64, 67]],
        [960, 240, [43]], [1200, 240, [50, 53, 55, 59, 62, 65, 67]], [1440, 240, [50, 53, 55, 59, 62, 65, 67]], [1680, 240, [50, 53, 55, 59, 62, 65, 67]]
    ]);
    contiguous(a, 1, 0, 1920);
    var b = build();
    runSkillOn(b, "chord-tones-eighths");
    runSkillOn(b, "bass-1-3");
    eq(b.dumpTrack(1), a.dumpTrack(1));
    eq([a.log, b.log], [[], []]);
});
test("chord-tones: 旋律低了就少放，太低就不放；重复运行不叠第二份", function () {
    var s = synth([4, 4], 1, [q(64), q(64), q(50), q(50)], [[0, "C"]]);
    var r = runSkillOn(s, "chord-tones-eighths");
    eq(v2chords(s).map(function (x) { return [x[0], x[2]]; }), [[240, [52, 55, 60]], [480, [52, 55, 60]], [720, [52, 55, 60]]]);
    ok(r.result.indexOf("3 处旋律太低") >= 0, r.result);
    var before = s.dumpTrack(1);
    var r2 = runSkillOn(s, "chord-tones-eighths");
    eq(s.dumpTrack(1), before);
    ok(r2.result.indexOf("在 0 个位置") >= 0, r2.result);
});
test("chord-tones: 旋律休止时只受音区上限限制；小节中间换和弦", function () {
    var s = synth([4, 4], 1, [q(72), [null, 480], q(72), q(72)], [[0, "C"], [960, "F"]]);
    runSkillOn(s, "chord-tones-eighths");
    var c = v2chords(s);
    eq(c.filter(function (x) { return x[0] === 480; })[0][2], [52, 55, 60, 64, 67]);
    eq(c.filter(function (x) { return x[0] === 1200; })[0][2], [53, 57, 60, 65], "F 和弦：F3 A3 C4 F4");
});
test("chord-tones: 每个音名一个、3/4 拍只给第 1 拍留贝斯", function () {
    var s = synth([3, 4], 2, quarters(72, 6), [[0, "Am"]]);
    var api = makeApi(s);
    var libs = Skills.libChain(ALL, skill("chord-tones-eighths"), []);
    var r = ScoreIO.runScript(api, "return addChordTonesEighths(h, { oneEach: true });", libs, ScoreIO.makeHelpers(api));
    ok(r.ok, JSON.stringify(r));
    var c = v2chords(s);
    eq(c.map(function (x) { return x[0]; }), [240, 480, 720, 960, 1200, 1680, 1920, 2160, 2400, 2640]);
    eq(c[0][2], [57, 60, 64], "Am：A3 C4 E4，每个一个");
    eq(s.log, []);
});
test("chord-tones: 技能能解析，依赖 arrange-tools，有按钮", function () {
    var sk = skill("chord-tones-eighths");
    eq([sk.button, sk.requires], ["和弦音 八分", ["arrange-tools"]]);
    ok(Skills.runnable(sk));
    eq(Skills.searchDetailed(ALL, "和弦音")[0].skill.name, "chord-tones-eighths");
});

// ---------------------------------------------------------------- 真实曲子：先贝斯再和弦音，看用户原来选的音在不在候选里
function chordTonesCheck(name) {
    var spec = FIXTURES[name];
    var s = FakeScore.fromSpec(spec);
    var mel = s.dumpTrack(0);
    runSkillOn(s, "bass-1-3");
    var r = runSkillOn(s, "chord-tones-eighths");
    ok(r.ok, name + " " + JSON.stringify(r));
    eq(s.dumpTrack(0), mel, name + " 旋律不能动");
    ok(s.log.length === 0, name + " 假谱报告: " + s.log.slice(0, 5).join("; "));
    ok(!/没加上|一部分/.test(r.result), name + "：" + r.result);

    // 旋律在每个 tick 的最低音
    function melodyLow(t) {
        var low = null;
        s.tracks[0].forEach(function (cr) {
            if (cr.isChord && cr.tick <= t && t < cr.tick + cr.len) {
                cr.notes.forEach(function (n) { if (low === null || n.pitch < low) { low = n.pitch; } });
            }
        });
        return low;
    }
    var mlen = s.mlen;
    var bassOffs = mlen === 1920 ? [0, 960] : [0];
    var cands = {};
    var chords = s.tracks[1].filter(function (cr) { return cr.isChord && bassOffs.indexOf(cr.tick % mlen) < 0; });
    var tones = libEval(s, "var hs = atCollectHarmonies(); return " + JSON.stringify(chords.map(function (cr) { return cr.tick; })) +
        ".map(function (t) { var c = atChordAt(hs, t, 0); return c && c.chord ? atChordTones(c.chord).map(function (x) { return x.pc; }) : []; });");
    chords.forEach(function (cr, i) {
        var m = melodyLow(cr.tick);
        cr.notes.forEach(function (n) {
            ok(n.pitch >= 50 && n.pitch <= 67, name + " 音区外 @" + cr.tick + ": " + n.pitch);
            ok(m === null || n.pitch < m, name + " 不在旋律下方 @" + cr.tick + ": " + n.pitch + " / 旋律 " + m);
            ok(tones[i].indexOf(n.pitch % 12) >= 0, name + " 不是和弦音 @" + cr.tick + ": " + n.pitch);
        });
        cands[cr.tick] = cr.notes.map(function (n) { return n.pitch; });
    });
    // 和用户原来的编配比：贝斯以外、落在八分格子上的音
    var total = 0, samePitch = 0, samePc = 0, slotHad = 0;
    (spec.orig_upper || []).forEach(function (o) {
        if (o[0] % 240 !== 0 || bassOffs.indexOf(o[0] % mlen) >= 0) { return; }
        var c = cands[o[0]];
        if (c) { slotHad++; }
        o[1].forEach(function (p) {
            total++;
            if (!c) { return; }
            if (c.indexOf(p) >= 0) { samePitch++; }
            if (c.some(function (x) { return x % 12 === p % 12; })) { samePc++; }
        });
    });
    var pct = function (a) { return Math.round(100 * a / Math.max(total, 1)) + "%"; };
    var line = name + "：" + r.result.split("\n")[0].replace("全谱：", "") +
        (total ? "；原编配在这些位置上有 " + total + " 个音，候选里有同一个音 " + pct(samePitch) + "，有同音名 " + pct(samePc) : "");
    info(line);
    return { total: total, samePitch: samePitch, samePc: samePc };
}

Object.keys(FIXTURES).forEach(function (name) {
    if (!FIXTURES[name].harmonies.length || !FIXTURES[name].orig_upper) { return; }
    test("chord-tones: 真实曲子 " + name, function () {
        var c = chordTonesCheck(name);
        // 2026-10-14 的基线：同一个音 68%–82%，同音名 81%–88%
        if (c.total) {
            ok(c.samePitch / c.total >= 0.6, name + " 候选里有原编配同一个音的比例太低：" + JSON.stringify(c));
            ok(c.samePc / c.total >= 0.75, name + " 同音名覆盖率太低：" + JSON.stringify(c));
        }
    });
});
