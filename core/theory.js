.import "i18n.js" as I18n
// 乐理小工具：音名 <-> MIDI / tpc。纯函数，不依赖 MuseScore。
.pragma library

// 显示给用户的文字过字典（core/i18n.js）；语言由 QML 设定
function T(s) { return I18n.tr(s); }

var SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
var FIFTHS = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, F: -1 };
var FIFTHS_LETTERS = "CGDAEBF";
var SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// tpc（tonal pitch class）：14 = C，+1 为上行纯五度，+7 为升一个半音
function tpcFrom(letter, alter) { return 14 + FIFTHS[letter] + 7 * alter; }
function tpcLetter(tpc) { return FIFTHS_LETTERS[(((tpc - 14) % 7) + 7) % 7]; }
function tpcAlter(tpc) { return Math.floor((tpc + 1) / 7) - 2; }
function tpcIsValid(tpc) { return typeof tpc === "number" && tpc >= -1 && tpc <= 33; }

function accidentalText(alter) {
    if (alter > 0) { return "#".repeat(alter); }
    if (alter < 0) { return "b".repeat(-alter); }
    return "";
}

function tpcName(tpc) { return tpcLetter(tpc) + accidentalText(tpcAlter(tpc)); }

// 按升号拼写给一个 MIDI 音高找 tpc
function tpcFromPitchSharp(pitch) {
    var name = SHARP_NAMES[((pitch % 12) + 12) % 12];
    return tpcFrom(name[0], name.length > 1 ? 1 : 0);
}

// 科学音高记号：C4 = 中央 C = MIDI 60
function noteName(pitch, tpc) {
    if (!tpcIsValid(tpc)) {
        return SHARP_NAMES[((pitch % 12) + 12) % 12] + (Math.floor(pitch / 12) - 1);
    }
    var alter = tpcAlter(tpc);
    var natural = pitch - alter;
    return tpcLetter(tpc) + accidentalText(alter) + (Math.floor(natural / 12) - 1);
}

// 解析 "D", "F#4", "Bb3", "Cx5"。没给八度时取离 refPitch 最近的那个。
function parseNote(text, refPitch) {
    var m = /^\s*([A-Ga-g])\s*(##|x|#|bb|b)?\s*(-?\d)?\s*$/.exec(String(text));
    if (!m) { return null; }
    var letter = m[1].toUpperCase();
    var acc = m[2] || "";
    var alter = (acc === "x" || acc === "##") ? 2 : acc === "#" ? 1 : acc === "bb" ? -2 : acc === "b" ? -1 : 0;
    var tpc = tpcFrom(letter, alter);
    var pc = SEMITONE[letter] + alter;
    var pitch;
    if (m[3] !== undefined && m[3] !== null && m[3] !== "") {
        pitch = (parseInt(m[3], 10) + 1) * 12 + pc;
    } else {
        var ref = (typeof refPitch === "number") ? refPitch : 60;
        var base = Math.floor(ref / 12) * 12 + pc;
        var cands = [base - 12, base, base + 12];
        pitch = cands[0];
        for (var i = 1; i < cands.length; i++) {
            if (Math.abs(cands[i] - ref) < Math.abs(pitch - ref)) { pitch = cands[i]; }
        }
    }
    return { pitch: pitch, tpc: tpc, name: noteName(pitch, tpc) };
}

// 和 MuseScore 的 pitch2tpc(pitch, key, prefer) 完全一致：prefer 取 FLATS=8, NEAREST=11, SHARPS=13。
// key 是调号的五度圈数（C 大调 0，G 大调 1，F 大调 -1）。
var PREFER = { flats: 8, nearest: 11, sharps: 13 };

function tpcForPitch(pitch, key, prefer) {
    var p = PREFER[prefer || "nearest"] + (key || 0);
    return ((((pitch * 7 + 26 - p) % 12) + 12) % 12) + p;
}

// 调号五度圈数 → "E 大调 / C# 小调（4 个升号）"
function keyName(fifths) {
    var k = Number(fifths) || 0;
    var count = k > 0 ? k + T(" 个升号") : k < 0 ? (-k) + T(" 个降号") : T("没有升降号");
    return tpcName(14 + k) + T(" 大调 / ") + tpcName(17 + k) + T(" 小调（") + count + T("）");
}

// tpc 只在 -1..33 有效；超出时换成同音异名
function clampTpc(tpc) {
    while (tpc > 33) { tpc -= 12; }
    while (tpc < -1) { tpc += 12; }
    return tpc;
}
