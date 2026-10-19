// 技能依赖、arrange-tools、bass-1-3
var INFO = [];
function info(s) { INFO.push(s); }

function skillsFromFiles() {
    var out = [];
    Object.keys(FILES).forEach(function (rel) {
        var m = /^skills\/([^\/]+)\/SKILL\.md$/.exec(rel);
        var f = /^skills\/([^\/]+)\.md$/.exec(rel);
        var entry = m ? { kind: "folder", id: m[1], rel: rel, dir: "skills/" + m[1] + "/" }
                  : f ? { kind: "file", id: f[1], rel: rel, dir: "" } : null;
        if (!entry) { return; }
        var sk = Skills.parse(entry, FILES[rel], readFile);
        if (sk.error) { throw new Error(rel + ": " + sk.error); }
        out.push(sk);
    });
    return out;
}
var ALL = skillsFromFiles();
function skill(name) { return Skills.find(ALL, name); }

function runSkillOn(score, name) {
    var sk = skill(name);
    var missing = [];
    var libs = Skills.libChain(ALL, sk, missing);
    if (missing.length) { throw new Error("缺依赖 " + missing.join(",")); }
    var api = makeApi(score);
    return ScoreIO.runScript(api, sk.run, libs, ScoreIO.makeHelpers(api));
}

// 在带 arrange-tools 的环境里跑一段代码（return 的值用 JSON 带回来）
function libEval(score, code) {
    var api = makeApi(score);
    var r = ScoreIO.runScript(api, "return JSON.stringify((function(){" + code + "})());",
                              Skills.libChain(ALL, skill("bass-1-3"), []), ScoreIO.makeHelpers(api));
    if (!r.ok) { throw new Error(r.error); }
    return JSON.parse(r.result);
}

function synth(timesig, nmeas, melody, harmonies) {
    var s = new FakeScore(nmeas, 1, timesig);
    s.fill(0, melody);
    s.harmonies = harmonies.map(function (h) { return { tick: h[0], staffIdx: 0, text: h[1] }; });
    return s;
}
function q(p) { return [[[p, Theory.tpcForPitch(p, 0)]], 480]; }
function v2(score) {
    return score.tracks[1].filter(function (cr) { return cr.isChord; }).map(function (cr) { return [cr.tick, cr.len, cr.notes[0].pitch, cr.notes[0].tpc1]; });
}
function contiguous(score, t, from, to) {
    var pos = from;
    score.tracks[t].forEach(function (cr) {
        if (cr.tick < from || cr.tick >= to) { return; }
        if (cr.tick !== pos) { throw new Error("声部在 " + pos + " 处断开，下一个元素在 " + cr.tick); }
        pos = cr.tick + cr.len;
    });
    if (pos !== to) { throw new Error("声部只到 " + pos + "，应到 " + to); }
}
function melody2() { return [q(60), q(62), q(64), q(65), q(67), q(69), q(71), q(72)]; }

// ---------------------------------------------------------------- 依赖
test("requires: 解析、依赖链和序列化", function () {
    eq(skill("bass-1-3").requires, ["arrange-tools"]);
    eq(skill("bass-1-3").button, "贝斯 1·3拍");
    eq(Skills.withDeps(ALL, skill("bass-1-3"), []).map(function (s) { return s.name; }), ["arrange-tools", "bass-1-3"]);
    var chain = Skills.libChain(ALL, skill("bass-1-3"), []);
    ok(chain.indexOf("function atAddNote") >= 0 && chain.indexOf("function atAddNote") < chain.indexOf("function addBassOnBeats"), "依赖的函数库应当排在前面");
    var missing = [];
    Skills.withDeps(ALL, { name: "x", requires: ["nope", "arrange-tools"] }, missing);
    eq(missing, ["nope"]);
    var s = { name: "with-dep", description: "d", instructions: "i", requires: "arrange-tools  mute-x", run: "return 1;" };
    var p = Skills.parse({ kind: "file", id: "with-dep", rel: "skills/with-dep.md", dir: "" }, Skills.serialize(s), readFile);
    eq(p.requires, ["arrange-tools", "mute-x"]);
    ok(Skills.catalogText(ALL).indexOf("arrange-tools：") >= 0 && Skills.catalogText(ALL).indexOf("[依赖 arrange-tools]") >= 0);
});

// ---------------------------------------------------------------- arrange-tools
test("arrange-tools: 解析和弦名", function () {
    var r = libEval(new FakeScore(1, 1), "return ['C/G','Bbmaj7','F#m7b5','N.C.','B♭','Am/C','ebm','G7(b9)'].map(atParseChord);");
    eq([r[0].root.pc, r[0].bass.pc, r[0].bass.tpc, r[0].quality], [0, 7, 15, ""]);
    eq([r[1].root.pc, r[1].root.tpc, r[1].quality], [10, 12, "maj7"]);
    eq([r[2].root.pc, r[2].root.tpc, r[2].quality], [6, 20, "m7b5"]);
    eq(r[3], null);
    eq(r[4].root.pc, 10);
    eq([r[5].root.pc, r[5].bass.pc], [9, 0]);
    eq([r[6].root.name, r[6].root.pc], ["Eb", 3]);
    eq([r[7].root.pc, r[7].quality], [7, "7(b9)"]);
});
test("arrange-tools: 音域", function () {
    eq(libEval(new FakeScore(1, 1), "return [atPitchInRange(7), atPitchInRange(4), atPitchInRange(3), atPitchInRange(4, 43), atPitchInRange(0)];"),
       [43, 40, 51, 52, 48]);
});
test("arrange-tools: 和弦按位置生效", function () {
    var s = synth([4, 4], 2, melody2(), [[0, "C"], [960, "G/B"], [1920, "Am"]]);
    eq(libEval(s, "var hs = atCollectHarmonies(); return [0, 480, 960, 1440, 1920, 3500].map(function (t) { var c = atChordAt(hs, t, 0); return c ? c.text : null; });"),
       ["C", "C", "G/B", "G/B", "Am", "Am"]);
    eq(libEval(synth([4, 4], 1, [q(60)], []), "return atCollectHarmonies().length;"), 0);
});
test("bass: 默认拍位", function () {
    eq(libEval(new FakeScore(1, 1), "return [bassBeatOffsets(4,4), bassBeatOffsets(3,4), bassBeatOffsets(6,8), bassBeatOffsets(2,2), bassBeatOffsets(12,8), bassBeatOffsets(5,4)];"),
       [[0, 960], [0], [0, 720], [0, 960], [0, 1440], [0]]);
});

// ---------------------------------------------------------------- bass-1-3 手工小谱
test("bass: 4/4 第 1、3 拍按和弦低音放在 E2–D#3", function () {
    var s = synth([4, 4], 2, melody2(), [[0, "C"], [960, "G/B"], [1920, "Am"], [2880, "F"]]);
    var mel = s.dumpTrack(0);
    var r = runSkillOn(s, "bass-1-3");
    ok(r.ok, JSON.stringify(r));
    ok(r.result.indexOf("全谱：加了 4 个贝斯音") === 0, r.result);
    eq(v2(s), [[0, 240, 48, 14], [960, 240, 47, 19], [1920, 240, 45, 17], [2880, 240, 41, 13]]);
    eq(s.dumpTrack(0), mel, "旋律不能动");
    contiguous(s, 1, 0, 3840);
});
test("bass: 重复运行不叠加", function () {
    var s = synth([4, 4], 2, melody2(), [[0, "C"], [1920, "Am"]]);
    runSkillOn(s, "bass-1-3");
    var before = s.dumpTrack(1);
    var r = runSkillOn(s, "bass-1-3");
    ok(r.result.indexOf("加了 0 个") >= 0 && r.result.indexOf("4 处声部 2 已经有音") >= 0, r.result);
    eq(s.dumpTrack(1), before);
});
test("bass: 拼写跟和弦标记一致", function () {
    var s = synth([4, 4], 1, [q(61), q(63), q(65), q(66)], [[0, "Db"], [960, "Gb/Bb"]]);
    runSkillOn(s, "bass-1-3");
    eq(v2(s).map(function (x) { return [x[2], x[3]]; }), [[49, 9], [46, 12]]);
});
test("bass: 3/4 只放第 1 拍", function () {
    var s = synth([3, 4], 2, [q(67), q(64), q(64), q(65), q(62), q(62)], [[0, "C"], [1440, "G7"]]);
    var r = runSkillOn(s, "bass-1-3");
    ok(r.result.indexOf("加了 2 个") >= 0, r.result);
    eq(v2(s).map(function (x) { return [x[0], x[2]]; }), [[0, 48], [1440, 43]]);
    contiguous(s, 1, 0, 2880);
});
test("bass: 只处理选区", function () {
    var mel = [];
    for (var i = 0; i < 16; i++) { mel.push(q(60 + (i % 5))); }
    var s = synth([4, 4], 4, mel, [[0, "C"], [1920, "D"], [3840, "E"], [5760, "F"]]);
    s.selection.selectRange(1920, 5760, 0, 1);
    var r = runSkillOn(s, "bass-1-3");
    ok(r.result.indexOf("第 2-3 小节：加了 4 个") === 0, r.result);
    eq(v2(s).map(function (x) { return x[0]; }), [1920, 2880, 3840, 4800]);
});
test("bass: 点选一个音时处理它所在的小节", function () {
    var s = synth([4, 4], 2, melody2(), [[0, "C"], [1920, "G"]]);
    s.selection.select(s.tracks[0][5].notes[0], false);
    var r = runSkillOn(s, "bass-1-3");
    ok(r.result.indexOf("第 2 小节：加了 2 个") === 0, r.result);
});
test("bass: 没有和弦标记时提示", function () {
    var s = synth([4, 4], 1, [q(60), q(62), q(64), q(65)], []);
    var r = runSkillOn(s, "bass-1-3");
    ok(r.ok && r.result.indexOf("没有和弦标记") >= 0, r.result);
    eq(v2(s), []);
});
test("bass: N.C. 处跳过并说明位置", function () {
    var s = synth([4, 4], 1, [q(60), q(62), q(64), q(65)], [[0, "N.C."], [960, "C"]]);
    var r = runSkillOn(s, "bass-1-3");
    ok(r.result.indexOf("加了 1 个") >= 0 && r.result.indexOf("第1小节第1拍") >= 0, r.result);
});
test("bass: 声部 2 已有的音不覆盖", function () {
    var s = synth([4, 4], 1, [q(60), q(62), q(64), q(65)], [[0, "C"], [960, "G"]]);
    s.tracks[1].push(s.wrapCR({ tick: 0, len: 960, isChord: true, notes: [{ pitch: 50, tpc1: 16, tpc2: 16, headGroup: 0 }] }, 1));
    s.tracks[1].push(s.wrapCR({ tick: 960, len: 960, isChord: false }, 1));
    var r = runSkillOn(s, "bass-1-3");
    ok(r.result.indexOf("加了 1 个") >= 0 && r.result.indexOf("1 处声部 2 已经有音") >= 0, r.result);
    eq(v2(s).map(function (x) { return [x[0], x[2]]; }), [[0, 50], [960, 43]]);
});
test("bass: 被长休止符盖住、没有拍位可对齐时跳过", function () {
    var s = synth([4, 4], 1, [q(60), q(62), q(64), q(65)], [[0, "C"]]);
    s.tracks[1].push(s.wrapCR({ tick: 0, len: 480, isChord: true, notes: [{ pitch: 48, tpc1: 14, tpc2: 14, headGroup: 0 }] }, 1));
    s.tracks[1].push(s.wrapCR({ tick: 480, len: 960, isChord: false }, 1));
    var r = runSkillOn(s, "bass-1-3");
    ok(r.result.indexOf("1 处声部 2 被一个长休止符盖着") >= 0, r.result);

    var s2 = synth([4, 4], 1, [[[[72, 14]], 1920]], [[0, "C"]]);
    s2.tracks[1].push(s2.wrapCR({ tick: 0, len: 480, isChord: true, notes: [{ pitch: 48, tpc1: 14, tpc2: 14, headGroup: 0 }] }, 1));
    var r2 = runSkillOn(s2, "bass-1-3");
    ok(r2.result.indexOf("1 处那一拍上没有任何音或休止符可以对齐") >= 0, r2.result);
});

// ---------------------------------------------------------------- 真实曲子（需要假谱数据目录）
function bassCheck(name) {
    var spec = FIXTURES[name];
    var s = FakeScore.fromSpec(spec);
    var mel = s.dumpTrack(0);
    var before = {};
    s.tracks[1].forEach(function (cr) { before[cr.tick + ":" + (cr.isChord ? cr.notes[0].pitch : "R")] = true; });
    var r = runSkillOn(s, "bass-1-3");
    ok(r.ok, name + " " + JSON.stringify(r));
    eq(s.dumpTrack(0), mel, name + " 旋律不能动");
    ok(r.result.indexOf("没加上") < 0, name + "：" + r.result);
    ok(s.log.length === 0, name + " 假谱报告: " + s.log.join("; "));
    var added = s.tracks[1].filter(function (cr) { return cr.isChord && !before[cr.tick + ":" + cr.notes[0].pitch]; });
    // 每个新加的音：音域、和弦低音
    var chk = libEval(s, "var hs = atCollectHarmonies(); return " + JSON.stringify(added.map(function (cr) { return [cr.tick, cr.notes[0].pitch]; })) +
        ".map(function (x) { var c = atChordAt(hs, x[0], 0); return [x[1] >= 40 && x[1] <= 51, c && c.chord ? c.chord.bass.pc === x[1] % 12 : false]; });");
    chk.forEach(function (c, i) { ok(c[0] && c[1], name + " 第 " + i + " 个新音不对：" + JSON.stringify(added[i].tick)); });
    var mlen = s.mlen;
    added.forEach(function (cr) {
        var off = cr.tick % mlen;
        ok(off === 0 || (mlen === 1920 && off === 960), name + " 拍位不对: " + cr.tick);
    });
    var firstLine = r.result.split("\n")[0];
    var agree = "";
    if (spec.orig_bass.length) {
        var byTick = {};
        added.forEach(function (cr) { byTick[cr.tick] = cr.notes[0].pitch; });
        var placed = 0, samePc = 0, samePitch = 0;
        spec.orig_bass.forEach(function (o) {
            if (byTick[o[0]] === undefined) { return; }
            placed++;
            if (byTick[o[0]] % 12 === o[1] % 12) { samePc++; }
            if (byTick[o[0]] === o[1]) { samePitch++; }
        });
        agree = "；和原编配比：原来第1/3拍有贝斯 " + spec.orig_bass.length + " 处，本技能在其中 " + placed + " 处放了音，音名一致 " +
                Math.round(100 * samePc / Math.max(placed, 1)) + "%，八度也一致 " + Math.round(100 * samePitch / Math.max(placed, 1)) + "%";
        ok(samePc / Math.max(placed, 1) >= 0.6, name + agree);
    }
    info(name + "：" + firstLine.replace("全谱：", "") + agree);
    return r;
}

Object.keys(FIXTURES).forEach(function (name) {
    test("bass: 真实曲子 " + name, function () {
        if (!FIXTURES[name].harmonies.length) {
            var r = runSkillOn(FakeScore.fromSpec(FIXTURES[name]), "bass-1-3");
            ok(r.result.indexOf("没有和弦标记") >= 0, r.result);
            info(name + "：没有和弦标记，按预期提示先写和弦");
            return;
        }
        bassCheck(name);
    });
});
