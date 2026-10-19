"""把一份 .mscx 的第一行谱表转成测试用的假谱数据（JSON），给 run_tests.py 用。只读原文件。

用法: python -I mscx_to_fixture.py <file.mscx> <out.json> [--strip]
  --strip  去掉声部 2 及以上（只留旋律和和弦标记），并把原来声部 2 在第 1、3 拍的最低音记到 orig_bass 里，
           其余的音（贝斯以外的和弦音）记到 orig_upper 里，用来比对。
"""
import json
import sys
import xml.etree.ElementTree as ET
from fractions import Fraction

DUR = {"breve": Fraction(2), "whole": Fraction(1), "half": Fraction(1, 2), "quarter": Fraction(1, 4),
       "eighth": Fraction(1, 8), "16th": Fraction(1, 16), "32nd": Fraction(1, 32), "64th": Fraction(1, 64)}
GRACE = {"acciaccatura", "appoggiatura", "grace4", "grace16", "grace32", "grace8after", "grace16after", "grace32after"}
FIFTHS = "FCGDAEB"


def tpc_name(t):
    t = int(t)
    alter = (t + 1) // 7 - 2
    return FIFTHS[(t + 1) % 7] + ("#" * alter if alter > 0 else "b" * (-alter))


def frac(s):
    n, d = s.split("/")
    return Fraction(int(n), int(d))


def length(el, ratio):
    dt = el.findtext("durationType")
    if dt == "measure":
        return frac(el.findtext("duration"))
    base = DUR.get(dt, Fraction(0))
    dots = int(el.findtext("dots") or 0)
    return base * (2 - Fraction(1, 2 ** dots)) * ratio


def harmony_text(h):
    root = h.find(".//root")
    if root is None:
        return None
    s = tpc_name(root.text) + (h.findtext(".//name") or "")
    base = h.find(".//base")
    if base is not None:
        s += "/" + tpc_name(base.text)
    return s


def ticks(f):
    v = f * 1920
    assert v.denominator == 1, f"非整数 tick: {f}"
    return int(v)


def convert(path, strip):
    score = ET.parse(path).getroot().find("Score")
    staff = [s for s in score.findall("Staff") if s.get("id") == "1"][0]
    tracks = {0: [], 1: [], 2: [], 3: []}
    harmonies = []
    tick = Fraction(0)
    timesig = None
    nmeasures = 0
    for m in staff.findall("Measure"):
        if m.get("len"):
            raise SystemExit("有不完整小节（弱起），这个假谱不支持")
        for vi, v in enumerate(m.findall("voice")):
            pos = Fraction(0)
            ratio = Fraction(1)
            for el in v:
                tag = el.tag
                if tag == "TimeSig":
                    sig = (int(el.findtext("sigN")), int(el.findtext("sigD")))
                    if timesig and sig != timesig:
                        raise SystemExit("拍号有变化，这个假谱不支持")
                    timesig = sig
                elif tag == "location" and el.findtext("fractions"):
                    pos += frac(el.findtext("fractions"))
                elif tag == "Tuplet":
                    ratio = Fraction(int(el.findtext("normalNotes")), int(el.findtext("actualNotes")))
                elif tag == "endTuplet":
                    ratio = Fraction(1)
                elif tag == "Harmony":
                    txt = harmony_text(el)
                    if txt:
                        harmonies.append([ticks(tick + pos), 0, txt])
                elif tag in ("Chord", "Rest"):
                    if tag == "Chord" and any(el.find(g) is not None for g in GRACE):
                        continue
                    L = length(el, ratio)
                    if tag == "Chord":
                        notes = el.findall("Note")
                        tracks[vi].append([ticks(tick + pos), ticks(L), [int(n.findtext("pitch")) for n in notes],
                                           [int(n.findtext("tpc")) for n in notes]])
                    else:
                        tracks[vi].append([ticks(tick + pos), ticks(L), None, None])
                    pos += L
        nmeasures += 1
        tick += Fraction(*timesig)
    mlen = ticks(Fraction(*timesig))
    beat_offsets = [0, mlen // 2] if timesig in ((4, 4), (2, 2)) else [0]
    orig_bass = []
    orig_upper = []
    if strip:
        for t, L, pitches, tpcs in tracks[1]:
            if not pitches:
                continue
            ups = sorted(pitches)
            if (t % mlen) in beat_offsets:
                orig_bass.append([t, ups[0]])
                ups = ups[1:]
            if ups:
                orig_upper.append([t, ups])
        tracks = {0: tracks[0]}
    harmonies.sort(key=lambda h: h[0])
    return {"nmeasures": nmeasures, "timesig": list(timesig), "nstaves": 1,
            "tracks": {str(k): v for k, v in tracks.items() if v}, "harmonies": harmonies,
            "orig_bass": orig_bass, "orig_upper": orig_upper}


if __name__ == "__main__":
    spec = convert(sys.argv[1], "--strip" in sys.argv)
    with open(sys.argv[2], "w", encoding="utf-8") as f:
        json.dump(spec, f, ensure_ascii=False)
    print(f"{sys.argv[2]}: {spec['nmeasures']} 小节 {spec['timesig']}，和弦标记 {len(spec['harmonies'])} 个，"
          f"声部 {list(spec['tracks'])}，原贝斯 {len(spec['orig_bass'])} 个")
