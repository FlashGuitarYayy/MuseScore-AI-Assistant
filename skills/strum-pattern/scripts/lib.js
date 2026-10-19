// 扫弦节奏型函数库。load_skill 之后，这些函数在 run_script 里可以直接调用。
// 只定义函数，不要有顶层副作用：它会拼在每段 run_script 的前面。

// 把口语节奏型解析成槽位数组，元素是 "D"、"U" 或 null（这一格不扫）。
//   "down up - up down down up -"  →  ["D","U",null,"U","D","D","U",null]
//   "D U x U" / "下 上 - 上"        →  ["D","U",null,"U"]
//   "1 n 2 n 3 n 4 n"              →  正拍下扫、反拍上扫，8 格全扫
//   "1 2n 3 4n"                    →  只念到的格子才扫：["D",null,null,"U","D",null,null,"U"]
function parseStrumPattern(text) {
    var tokens = String(text || "").trim().toLowerCase().split(/[\s,，、|]+/).filter(function (x) { return x.length > 0; });
    if (!tokens.length) { throw new Error("节奏型是空的"); }

    var isCount = tokens.every(function (x) { return /^([1-4])?(n|&|and)?$/.test(x); });
    if (isCount) {
        var slots = [null, null, null, null, null, null, null, null];
        var beat = 0;
        tokens.forEach(function (x) {
            var m = /^([1-4])?(n|&|and)?$/.exec(x);
            if (m[1] && !m[2]) { beat = parseInt(m[1], 10); slots[(beat - 1) * 2] = "D"; }
            else if (m[1] && m[2]) { beat = parseInt(m[1], 10); slots[(beat - 1) * 2 + 1] = "U"; }
            else if (m[2] && beat >= 1) { slots[(beat - 1) * 2 + 1] = "U"; }
        });
        return slots;
    }

    return tokens.map(function (x) {
        if (x === "d" || x === "down" || x === "下" || x === "↓") { return "D"; }
        if (x === "u" || x === "up" || x === "上" || x === "↑") { return "U"; }
        if (x === "-" || x === "x" || x === "0" || x === "_" || x === "·" || x === "空") { return null; }
        throw new Error("看不懂节奏型里的「" + x + "」。用 down / up / -，或者 1 n 2 n 这种计数");
    });
}

// 把槽位套到和弦上。opts.mode："order"（默认）按和弦顺序循环套用；"grid" 按小节内拍位，一格一个八分音符。
function strumPattern(h, items, slots, opts) {
    opts = opts || {};
    if (!slots || !slots.length) { throw new Error("slots 为空"); }
    var grid = opts.mode === "grid";
    var unit = opts.unitTicks || ((typeof division !== "undefined" && division) ? division / 2 : 240);
    var ms = grid ? h.measures() : null;
    var k = 0;
    var marked = 0;
    var chords = 0;
    items.forEach(function (it) {
        if (!it.isChord) { return; }
        chords++;
        var idx;
        if (grid) {
            var start = ms[it.measure - 1].startTick;
            idx = Math.floor((it.tick - start) / unit) % slots.length;
        } else {
            idx = k % slots.length;
            k++;
        }
        var s = slots[idx];
        if (s === "D" || s === "U") {
            if (h.addArticulation(it, s === "D" ? "down" : "up")) { marked++; }
        }
    });
    return chords + " 个和弦里新加了 " + marked + " 个扫弦记号（" + (grid ? "按拍位" : "按顺序") + "）";
}
