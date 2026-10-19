// 技能 lyrics-to-tab：歌词在五线谱和联动六线谱之间搬动

// 两条谱表（0 五线、1 联动六线），音轨 0 和 4 放同样的旋律：2 小节 8 个四分音符，后 2 小节休止
function ltScore(opts) {
    opts = opts || {};
    var s = new FakeScore(4, 2);
    s.setStaffTypes(["pitched", "tab"], { 1: 0 });
    var mel = [q(60), q(62), q(64), q(65), q(67), q(69), q(71), q(72)];
    s.fill(0, mel);
    s.fill(4, opts.tabRestAt === undefined ? mel : mel.map(function (x, i) { return i === opts.tabRestAt ? [null, 480] : x; }));
    var words = ["空", "气", "中", "只", "剩", "呼", "吸", "啊"];
    words.forEach(function (w, i) { s.addLyric(0, i * 480, w, 0, i === 2 ? 1 : 0); });
    return s;
}

// 在带 lyrics-to-tab 函数库的环境里跑一段代码
function ltEval(score, code) {
    var api = makeApi(score);
    var r = ScoreIO.runScript(api, "return JSON.stringify((function(){" + code + "})());",
                              Skills.libChain(ALL, skill("lyrics-to-tab"), []), ScoreIO.makeHelpers(api));
    if (!r.ok) { throw new Error(r.error); }
    return JSON.parse(r.result);
}

test("lyrics-to-tab: 技能元数据", function () {
    var sk = skill("lyrics-to-tab");
    ok(sk, "技能存在");
    eq(sk.button, "歌词→六线谱");
    eq(sk.requires, ["arrange-tools"]);
    ok(Skills.runnable(sk));
});

test("lyrics-to-tab: 配对识别", function () {
    eq(ltEval(ltScore(), "return ltStaffPairs();"), [{ std: 0, tab: 1 }]);
    var noTab = new FakeScore(2, 2);
    eq(ltEval(noTab, "return ltStaffPairs();"), []);
    var unlinked = new FakeScore(2, 2);
    unlinked.setStaffTypes(["pitched", "tab"], {});
    eq(ltEval(unlinked, "return ltStaffPairs();"), [], "没联动的六线谱不算");
    var three = new FakeScore(2, 3);
    three.setStaffTypes(["pitched", "tab", "pitched"], { 1: 0 });
    eq(ltEval(three, "return ltStaffPairs();"), [{ std: 0, tab: 1 }]);
});

test("lyrics-to-tab: 搬到六线谱，文字和属性都保留", function () {
    var s = ltScore();
    var before = s.dumpLyrics(0);
    eq(before.length, 8);
    var r = runSkillOn(s, "lyrics-to-tab");
    ok(r.ok, r.error);
    ok(r.result.indexOf("把 8 个歌词从五线谱搬到六线谱下面") >= 0, r.result);
    eq(s.dumpLyrics(0), [], "五线谱上没有歌词了");
    eq(s.dumpLyrics(4), before, "六线谱上的歌词位置和文字一样");
    var third = s.tracks[4][2].lyrics[0];
    eq(third.syllabic, 1, "音节属性保留");
    ok(third.parent === s.tracks[4][2], "挂在六线谱的和弦上");
    eq(s.dumpTrack(0), s.dumpTrack(4), "音符没动");
});

test("lyrics-to-tab: 再运行一次没有改动", function () {
    var s = ltScore();
    runSkillOn(s, "lyrics-to-tab");
    var r = runSkillOn(s, "lyrics-to-tab");
    ok(r.ok && r.result.indexOf("没有改动") >= 0, r.result);
    eq(s.dumpLyrics(4).length, 8);
});

test("lyrics-to-tab: 搬回五线谱", function () {
    var s = ltScore();
    runSkillOn(s, "lyrics-to-tab");
    var api = makeApi(s);
    var r = ScoreIO.runScript(api, "return moveLyrics(h, { to: 'standard' });",
                              Skills.libChain(ALL, skill("lyrics-to-tab"), []), ScoreIO.makeHelpers(api));
    ok(r.ok && r.result.indexOf("从六线谱搬回五线谱") >= 0, r.result);
    eq(s.dumpLyrics(4), []);
    eq(s.dumpLyrics(0).length, 8);
});

test("lyrics-to-tab: 只处理选区", function () {
    var s = ltScore();
    s.selection.selectRange(0, 1920, 0, 2);   // 第 1 小节，两条谱表
    var r = runSkillOn(s, "lyrics-to-tab");
    ok(r.ok && r.result.indexOf("选区：把 4 个歌词") >= 0, r.result);
    eq(s.dumpLyrics(0).map(function (l) { return l[1]; }), ["剩", "呼", "吸", "啊"]);
    eq(s.dumpLyrics(4).map(function (l) { return l[1]; }), ["空", "气", "中", "只"]);
});

test("lyrics-to-tab: 目标是休止符也能挂，目标没有元素就跳过并报出来", function () {
    var s = ltScore({ tabRestAt: 3 });
    var r = runSkillOn(s, "lyrics-to-tab");
    ok(r.ok, r.error);
    eq(s.dumpLyrics(4).length, 8, "休止符上也挂了");
    ok(!s.tracks[4][3].isChord && s.tracks[4][3].lyrics.length === 1);
    // 声部 2 只有前两拍有音：第 2 拍的歌词能挂，第 3 拍的位置什么都没有
    var s2 = ltScore();
    s2.fill(1, [[[[64, 18]], 480], [[[64, 18]], 480]]);
    s2.fill(5, [[[[64, 18]], 480], [null, 480]]);
    s2.tracks[5].splice(1, 1);                    // 六线谱声部 2 第 2 拍没有元素（同小节后面也没有）
    s2.addLyric(1, 0, "一");
    s2.addLyric(1, 480, "二");
    var r2 = runSkillOn(s2, "lyrics-to-tab");
    ok(r2.ok, r2.error);
    ok(r2.result.indexOf("把 9 个歌词") >= 0 && r2.result.indexOf("1 个没搬") >= 0 && r2.result.indexOf("第 1 小节「二」") >= 0, r2.result);
    eq(s2.dumpLyrics(1), [[480, "二", 0]], "没搬动的留在原处");
});

test("lyrics-to-tab: 没有联动六线谱时给出提示，不改谱", function () {
    var s = new FakeScore(2, 1);
    s.fill(0, [q(60), q(62), q(64), q(65)]);
    s.addLyric(0, 0, "啦");
    var r = runSkillOn(s, "lyrics-to-tab");
    ok(r.ok && r.result.indexOf("没有找到") >= 0, r.result);
    eq(s.dumpLyrics(0), [[0, "啦", 0]]);
});

test("lyrics-to-tab: 脚本出错时整体回滚", function () {
    var s = ltScore();
    var api = makeApi(s);
    var r = ScoreIO.runScript(api, "moveLyrics(h, {}); throw new Error('boom');",
                              Skills.libChain(ALL, skill("lyrics-to-tab"), []), ScoreIO.makeHelpers(api));
    ok(!r.ok);
    eq(s.dumpLyrics(0).length, 8, "回滚后歌词还在五线谱上");
    eq(s.dumpLyrics(4), []);
});
