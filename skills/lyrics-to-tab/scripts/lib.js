// lyrics-to-tab：把歌词在五线谱和它的联动六线谱之间搬动。依赖 arrange-tools（atScope、atMeasures）。只定义函数。
// 歌词是挂在某个谱表的和弦/休止符上的；联动谱表之间不会互相复制歌词（4.6.3 undoAddElement 把 LYRICS 排除在外），
// 所以"显示在六线谱下面"就等于"把歌词挂到六线谱的音符上"。

// 找出"五线谱 + 联动六线谱"的配对：[{std, tab}]，下标是谱表号（0 起）
function ltStaffPairs() {
    var out = [];
    var staves = curScore.staves;
    var t0 = fraction(0, 1);
    for (var i = 0; staves && i < staves.length; i++) {
        var st = staves[i];
        var isTab = false;
        try { isTab = !!st.isTabStaff(t0); } catch (e) { }
        if (!isTab) { continue; }
        var prim = st.primaryStaff;                       // 联动组里的主谱表；没联动时就是自己
        if (!prim || prim.idx === st.idx || prim.idx === undefined) { continue; }
        var std = staves[prim.idx];
        var isStd = false;
        try { isStd = !!std.isPitchedStaff(t0); } catch (e2) { }
        if (!isStd) { continue; }
        out.push({ std: prim.idx, tab: st.idx });
    }
    return out;
}

// 收集一条音轨上 [fromTick, toTick) 内所有歌词：[{tick, el, text, verse, syllabic, lyricTicks}]
function ltCollect(track, fromTick, toTick) {
    var out = [];
    var c = curScore.newCursor();
    c.track = track;
    c.rewindToTick(0);
    var guard = 0;
    while (c.segment && guard++ < 200000) {
        var tick = c.segment.tick;
        if (tick >= toTick) { break; }
        var e = c.element;
        if (tick >= fromTick && e && (e.type === Element.CHORD || e.type === Element.REST)) {
            var ls = e.lyrics || [];
            for (var i = 0; i < ls.length; i++) {
                var L = ls[i];
                out.push({ tick: tick, el: L, text: L.text, verse: L.verse, syllabic: L.syllabic, lyricTicks: L.lyricTicks });
            }
        }
        if (!c.next()) { break; }
    }
    return out;
}

// 把一条歌词挂到另一条音轨同一 tick 的和弦/休止符上，再删掉原来的。目标位置没有元素就返回 false。
function ltPlace(track, it) {
    var c = curScore.newCursor();
    c.track = track;
    c.rewindToTick(it.tick);
    var e = c.element;
    if (!e || !c.segment || c.segment.tick !== it.tick) { return false; }
    if (e.type !== Element.CHORD && e.type !== Element.REST) { return false; }
    var n = newElement(Element.LYRICS);
    n.text = it.text;
    try { if (it.verse !== undefined && it.verse !== null) { n.verse = it.verse; } } catch (e1) { }
    try { if (it.syllabic !== undefined && it.syllabic !== null) { n.syllabic = it.syllabic; } } catch (e2) { }
    try { if (it.lyricTicks && it.lyricTicks.ticks) { n.lyricTicks = it.lyricTicks; } } catch (e3) { }
    c.add(n);
    removeElement(it.el);
    return true;
}

function ltMeasureOf(ms, tick) {
    for (var i = 0; i < ms.length; i++) { if (tick >= ms[i].startTick && tick < ms[i].endTick) { return ms[i].index; } }
    return 0;
}

// 搬歌词。opts.to："tab"（默认，五线谱 → 六线谱）或 "standard"（六线谱 → 五线谱）。
// 有选区只处理选区里的小节；什么都没选就处理全谱。
function moveLyrics(h, opts) {
    opts = opts || {};
    var toTab = opts.to !== "standard";
    var pairs = ltStaffPairs();
    if (!pairs.length) {
        return "没有找到「五线谱 + 联动六线谱」的组合。歌词只能在联动的两条谱表之间搬；" +
               "要先给乐器加联动六线谱（谱表齿轮 → 创建联动谱表 → 谱表类型选六线谱）。";
    }
    var scope = atScope(h);
    var ms = atMeasures();
    var stat = { moved: 0, skipped: 0, pairs: 0 };
    var skippedAt = [];
    pairs.forEach(function (p) {
        if (!scope.whole && scope.staves.indexOf(p.std) < 0 && scope.staves.indexOf(p.tab) < 0) { return; }
        stat.pairs++;
        var from = toTab ? p.std : p.tab;
        var to = toTab ? p.tab : p.std;
        for (var voice = 0; voice < 4; voice++) {
            var items = ltCollect(from * 4 + voice, scope.fromTick, scope.toTick);
            items.forEach(function (it) {
                if (ltPlace(to * 4 + voice, it)) { stat.moved++; return; }
                stat.skipped++;
                if (skippedAt.length < 8) { skippedAt.push("第 " + ltMeasureOf(ms, it.tick) + " 小节「" + it.text + "」"); }
            });
        }
    });
    var range = scope.whole ? "全谱" : "选区";
    var dir = toTab ? "从五线谱搬到六线谱下面" : "从六线谱搬回五线谱下面";
    if (!stat.pairs) { return range + "里没有带联动六线谱的谱表，没有改动。"; }
    if (!stat.moved && !stat.skipped) {
        return range + "里" + (toTab ? "五线谱" : "六线谱") + "上没有歌词，没有改动。" +
               (toTab ? "" : "歌词可能已经在五线谱下面了。");
    }
    var s = range + "：把 " + stat.moved + " 个歌词" + dir + "。";
    if (stat.skipped) {
        s += "\n" + stat.skipped + " 个没搬：目标谱表在那个位置没有音符或休止符（" + skippedAt.join("、") + (stat.skipped > 8 ? " 等" : "") + "）。";
    }
    s += toTab ? "\n想搬回去，运行时传 { to: \"standard\" }，或者说「歌词搬回五线谱」。" : "";
    return s;
}
