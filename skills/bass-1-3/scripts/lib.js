// bass-1-3：按和弦标记在强拍加贝斯。依赖 arrange-tools（at* 函数）。只定义函数。

// 拍号 → 放贝斯的位置（相对小节开头的 tick）。规则在 arrange-tools 里，和弦音技能也按它给贝斯留位置。
function bassBeatOffsets(num, den) {
    return atBassBeatOffsets(num, den);
}

function addBassOnBeats(h, opts) {
    opts = opts || {};
    var low = (opts.lowPitch === undefined) ? 40 : opts.lowPitch;      // E2，6 弦空弦
    var dur = opts.duration || [1, 8];
    var voice = (opts.voice === undefined) ? 1 : opts.voice;           // 声部 2
    var beats = opts.beats || bassBeatOffsets;

    var harmonies = atCollectHarmonies();
    if (!harmonies.length) {
        return "谱里没有和弦标记。先给要加贝斯的地方写上和弦（选中音符按 Ctrl+K），再运行。";
    }
    var scope = atScope(h);
    var measures = atMeasures();
    var stat = { added: 0, occupied: 0, blocked: 0, noChord: 0, noslot: 0, failed: 0 };
    var where = { noChord: [], noslot: [], blocked: [], failed: [] };
    var firstM = 0;
    var lastM = 0;

    measures.forEach(function (m) {
        if (m.endTick <= scope.fromTick || m.startTick >= scope.toTick) { return; }
        if (!firstM) { firstM = m.index; }
        lastM = m.index;
        var offs = beats(m.num, m.den);
        scope.staves.forEach(function (staffIdx) {
            offs.forEach(function (off) {
                var tick = m.startTick + off;
                if (tick < scope.fromTick || tick >= scope.toTick || tick >= m.endTick) { return; }
                var label = atBeatLabel(m, tick);
                var hm = atChordAt(harmonies, tick, staffIdx);
                if (!hm || !hm.chord) { stat.noChord++; where.noChord.push(label); return; }
                var b = hm.chord.bass;
                var r = atAddNote(staffIdx, voice, tick, m.startTick, atPitchInRange(b.pc, low), b.tpc, dur[0], dur[1]);
                stat[r]++;
                if (where[r]) { where[r].push(label + "（" + hm.text + "）"); }
            });
        });
    });

    function list(a) { return a.slice(0, 6).join("、") + (a.length > 6 ? " 等 " + a.length + " 处" : ""); }
    var range = scope.whole ? "全谱" : ("第 " + firstM + (lastM !== firstM ? "-" + lastM : "") + " 小节");
    var s = range + "：加了 " + stat.added + " 个贝斯音。";
    if (stat.occupied) { s += "\n" + stat.occupied + " 处声部 2 已经有音，没动。"; }
    if (stat.noChord) { s += "\n" + stat.noChord + " 处没有和弦标记，跳过：" + list(where.noChord); }
    if (stat.noslot) { s += "\n" + stat.noslot + " 处那一拍上没有任何音或休止符可以对齐，跳过：" + list(where.noslot); }
    if (stat.blocked) { s += "\n" + stat.blocked + " 处声部 2 被一个长休止符盖着，跳过：" + list(where.blocked); }
    if (stat.failed) { s += "\n" + stat.failed + " 处没加上：" + list(where.failed); }
    return s;
}
