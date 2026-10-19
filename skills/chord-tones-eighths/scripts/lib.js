// chord-tones-eighths：在每个空着的八分音符位置，把能选的和弦音全部叠出来，方便一眼挑音。
// 依赖 arrange-tools（at* 函数）。只定义函数。

function addChordTonesEighths(h, opts) {
    opts = opts || {};
    // 默认音区按用户 5 首编配量出来：D3–G4 能覆盖原编配里 68%–82% 的和弦音，每个位置平均 3 个多音
    var low = (opts.lowPitch === undefined) ? 50 : opts.lowPitch;       // D3，4 弦空弦
    var high = (opts.highPitch === undefined) ? 67 : opts.highPitch;    // G4，1 弦 3 品
    var voice = (opts.voice === undefined) ? 1 : opts.voice;            // 声部 2
    var melodyVoice = (opts.melodyVoice === undefined) ? 0 : opts.melodyVoice;
    var dur = opts.duration || [1, 8];
    var step = Math.round(division * 4 * dur[0] / dur[1]);              // 格子间距 = 时值
    var oneEach = !!opts.oneEach;
    var leaveBass = opts.leaveBassBeats !== false;

    var harmonies = atCollectHarmonies();
    if (!harmonies.length) {
        return "谱里没有和弦标记。先给要加和弦音的地方写上和弦（选中音符按 Ctrl+K），再运行。";
    }
    var scope = atScope(h);
    var measures = atMeasures();
    var stat = { added: 0, notes: 0, occupied: 0, bassBeat: 0, noChord: 0, tooLow: 0, blocked: 0, noslot: 0, failed: 0, partial: 0 };
    var where = { noChord: [], tooLow: [], blocked: [], noslot: [], failed: [], partial: [] };
    var firstM = 0;
    var lastM = 0;

    measures.forEach(function (m) {
        if (m.endTick <= scope.fromTick || m.startTick >= scope.toTick) { return; }
        if (!firstM) { firstM = m.index; }
        lastM = m.index;
        var bassOffs = leaveBass ? atBassBeatOffsets(m.num, m.den) : [];
        scope.staves.forEach(function (staffIdx) {
            for (var tick = m.startTick; tick < m.endTick; tick += step) {
                if (tick < scope.fromTick || tick >= scope.toTick) { continue; }
                var label = atBeatLabel(m, tick);
                var st = atVoiceState(staffIdx, voice, tick, m.startTick);
                if (st.isChord && st.state !== "gap") { stat.occupied++; continue; }
                if (bassOffs.indexOf(tick - m.startTick) >= 0) { stat.bassBeat++; continue; }
                var hm = atChordAt(harmonies, tick, staffIdx);
                if (!hm || !hm.chord) { stat.noChord++; where.noChord.push(label); continue; }
                // 待在旋律下面：上限取旋律最低音再低半音
                var mel = atLowestPitchAt(staffIdx, melodyVoice, tick, m.startTick);
                var top = (mel === null) ? high : Math.min(high, mel - 1);
                var notes = atChordTonePitches(hm.chord, low, top, oneEach);
                if (!notes.length) { stat.tooLow++; where.tooLow.push(label + "（" + hm.text + "）"); continue; }
                var r = atAddChord(staffIdx, voice, tick, m.startTick, notes, dur[0], dur[1]);
                if (r === "added") { stat.added++; stat.notes += notes.length; continue; }
                stat[r] = (stat[r] || 0) + 1;
                if (where[r]) { where[r].push(label + "（" + hm.text + "）"); }
            }
        });
    });

    function list(a) { return a.slice(0, 6).join("、") + (a.length > 6 ? " 等 " + a.length + " 处" : ""); }
    function pname(p) { return ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"][p % 12] + (Math.floor(p / 12) - 1); }
    var range = scope.whole ? "全谱" : ("第 " + firstM + (lastM !== firstM ? "-" + lastM : "") + " 小节");
    var s = range + "：在 " + stat.added + " 个位置叠了和弦音，共 " + stat.notes + " 个音。";
    if (stat.added) {
        s += "\n每个位置是 " + pname(low) + "–" + pname(high) + " 之间、旋律下方能放的" + (oneEach ? "每个和弦音各一个" : "全部和弦音") +
             "（实际音高），挑想要的留下，其余删掉。" + (oneEach ? "" : "嫌太密可以让 AI「每个和弦音只放一个」。");
    }
    if (stat.bassBeat) { s += "\n" + stat.bassBeat + " 个强拍位置留给贝斯，没放（要放贝斯点「贝斯 1·3拍」）。"; }
    if (stat.occupied) { s += "\n" + stat.occupied + " 个位置声部 2 已经有音，没动。"; }
    if (stat.tooLow) { s += "\n" + stat.tooLow + " 处旋律太低，下面放不下和弦音：" + list(where.tooLow); }
    if (stat.noChord) { s += "\n" + stat.noChord + " 处没有和弦标记，跳过：" + list(where.noChord); }
    if (stat.blocked) { s += "\n" + stat.blocked + " 处声部 2 被拆不开的元素盖着，跳过：" + list(where.blocked); }
    if (stat.noslot) { s += "\n" + stat.noslot + " 处找不到可以放音的位置，跳过：" + list(where.noslot); }
    if (stat.partial) { s += "\n" + stat.partial + " 处只加上了一部分音：" + list(where.partial); }
    if (stat.failed) { s += "\n" + stat.failed + " 处没加上：" + list(where.failed); }
    return s;
}
