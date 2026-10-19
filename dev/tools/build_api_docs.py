"""从 MuseScore 源码生成插件自带的接口清单 docs/api-<版本>.json。

插件里的 AI 用 search_api_docs 工具查这份清单：插件接口有哪些类、属性、方法、枚举，有哪些动作代码（cmd）及其中文名。
清单按指定版本的源码生成，所以和用户装的 MuseScore 对得上；升级 MuseScore 后换个版本号重新生成一次即可。

用法（只需要 Python 3，不用装别的）：
    python dev/tools/build_api_docs.py v4.6.3
    python dev/tools/build_api_docs.py v4.7.5 --cache 某个目录      # 下载过的文件放在这里，重跑不再下载

源码从 https://github.com/musescore/MuseScore 的对应标签下载，不需要 GitHub 账号。
"""
import argparse
import json
import os
import re
import sys
import urllib.request

REPO = "musescore/MuseScore"
API_DIR = "src/engraving/api/v1"
API_HEADERS = ["qmlpluginapi.h", "score.h", "cursor.h", "elements.h", "part.h", "instrument.h", "selection.h",
               "excerpt.h", "scoreelement.h", "playevent.h", "apistructs.h", "util.h", "style.h", "enums.h"]
ENUM_HEADER = "apitypes.h"
# 动作代码在 4.x 里在 src/notation，5.0 起搬到了 src/notationscene
ACTION_CANDIDATES = [
    ("src/notation/internal/notationactioncontroller.cpp", "src/notation/internal/notationuiactions.cpp"),
    ("src/notationscene/internal/notationactioncontroller.cpp", "src/notationscene/internal/notationuiactions.cpp"),
]
ZH_TS = "share/locale/musescore_zh_CN.ts"


def fetch(ref, path, cache):
    local = os.path.join(cache, ref, path) if cache else None
    if local and os.path.exists(local):
        with open(local, encoding="utf-8") as f:
            return f.read()
    url = f"https://raw.githubusercontent.com/{REPO}/{ref}/{path}"
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            text = r.read().decode("utf-8")
    except Exception as e:  # noqa: BLE001
        print(f"  下载失败 {path}: {e}", file=sys.stderr)
        return None
    if local:
        os.makedirs(os.path.dirname(local), exist_ok=True)
        with open(local, "w", encoding="utf-8") as f:
            f.write(text)
    return text


# ---------------------------------------------------------------- 注释

def clean_comment(lines):
    text = " ".join(lines)
    since = ""
    m = re.search(r"[\\@]since\s+(?:MuseScore\s+)?([\d.]+)", text)
    if m:
        since = m.group(1)
    text = re.sub(r"[\\@]since\s+(?:MuseScore\s+)?[\d.]+", "", text)
    text = re.sub(r"\bAPIDOC\b|@method|@property|@q_property|\{[^}]*\}|[\\@](p|ref|c|a|returns?|see|brief|deprecated)\b", " ", text)
    text = re.sub(r"[\\@]param\s+", "参数 ", text)
    text = re.sub(r"\\cond\s+\w+|\\class\s+\w+|\\\\|\\\w+", " ", text)   # 其余 Doxygen 命令
    text = re.sub(r"\s+", " ", text).strip(" *")
    if len(text) > 220:
        text = text[:220] + "…"
    return text, since


def comment_text(line):
    s = line.strip()
    if s.startswith("///"):
        return s[3:].strip()
    return None


# ---------------------------------------------------------------- 头文件

PROP_PATTERNS = [
    (re.compile(r"^API_PROPERTY_READ_ONLY_T\(\s*([^,]+?)\s*,\s*(\w+)\s*,"), "ro_t"),
    (re.compile(r"^API_PROPERTY_READ_ONLY\(\s*(\w+)\s*,"), "ro"),
    (re.compile(r"^API_PROPERTY_ENUM\(\s*([^,]+?)\s*,\s*(\w+)\s*,"), "enum"),
    (re.compile(r"^API_PROPERTY_T\(\s*([^,]+?)\s*,\s*(\w+)\s*,"), "t"),
    (re.compile(r"^API_PROPERTY\(\s*(\w+)\s*,"), "plain"),
]


def short_type(t):
    t = re.sub(r"(mu::engraving::)?apiv1::(enums::)?|mu::engraving::|QQmlListProperty<([^>]+)>", lambda m: ("[" + m.group(3) + "]") if m.group(3) else "", t)
    return re.sub(r"\s*\*\s*$", "", t.replace("const ", "").replace("&", "")).strip()


def parse_header(path, text, entries, enum_props):
    cls = ""
    pending = []
    in_block = False
    block = []
    in_macro = False
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        raw = lines[i]
        line = raw.strip()
        lineno = i + 1
        i += 1
        if in_macro:
            in_macro = raw.rstrip().endswith("\\")
            continue
        if line.startswith("#define"):
            in_macro = raw.rstrip().endswith("\\")
            continue
        if in_block:
            end = "*/" in line
            block.append(line.replace("*/", "").lstrip("*").strip())
            if end:
                in_block = False
                pending = [b for b in block if b]
                block = []
            continue
        if line.startswith("/**") or line.startswith("/*!"):
            body = line[3:]
            if "*/" in body:
                pending = [body.replace("*/", "").strip()]
            else:
                in_block = True
                block = [body.strip()]
            continue
        c = comment_text(line)
        if c is not None:
            pending.append(c)
            continue
        if not line or line.startswith("//"):
            continue
        m = re.match(r"^class\s+(\w+)\s*(?:final\s*)?:\s*public\s+([\w:]+)", line)
        if m:
            cls = m.group(1)
            desc, since = clean_comment(pending)
            entries.append({"k": "class", "c": cls, "n": cls, "s": "class " + cls + " : " + short_type(m.group(2)),
                            "d": desc, "since": since, "f": path, "l": lineno})
            pending = []
            continue
        m = re.match(r"^DECLARE_API_ENUM2?\(\s*(\w+)\s*,\s*\w+\s*,\s*([\w:]+)", line)
        if m:
            enum_props[m.group(2).split("::")[-1]] = m.group(1)
            entries.append({"k": "prop", "c": cls, "n": m.group(1), "s": m.group(1) + ".值（枚举 " + m.group(2).split("::")[-1] + "）",
                            "d": "枚举，用 " + m.group(1) + ".名字 取值", "since": "", "f": path, "l": lineno, "w": False})
            pending = []
            continue
        if line.startswith("Q_PROPERTY("):
            m = re.match(r"^Q_PROPERTY\(\s*(.+?)\s+(\w+)\s+READ\b(.*)\)", line)
            if m:
                desc, since = clean_comment(pending)
                writable = " WRITE " in " " + m.group(3) + " "
                entries.append({"k": "prop", "c": cls, "n": m.group(2), "s": short_type(m.group(1)) + " " + m.group(2) + ("" if writable else "（只读）"),
                                "d": desc, "since": since, "f": path, "l": lineno, "w": writable})
            pending = []
            continue
        matched = False
        for rx, kind in PROP_PATTERNS:
            m = rx.match(line)
            if m:
                if kind in ("plain", "ro"):
                    typ, name = "var", m.group(1)
                else:
                    typ, name = short_type(m.group(1)), m.group(2)
                writable = kind not in ("ro", "ro_t")
                desc, since = clean_comment(pending)
                entries.append({"k": "prop", "c": cls, "n": name, "s": typ + " " + name + ("" if writable else "（只读）"),
                                "d": desc, "since": since, "f": path, "l": lineno, "w": writable})
                matched = True
                break
        if matched:
            pending = []
            continue
        if line.startswith("Q_INVOKABLE"):
            decl = line
            while ")" not in decl and i < len(lines):
                decl += " " + lines[i].strip()
                i += 1
            m = re.match(r"^Q_INVOKABLE\s+(.+?)\s*\b(\w+)\s*\((.*?)\)", decl)
            if m:
                ret = short_type(m.group(1))
                args = ", ".join(short_type(a.strip()) for a in m.group(3).split(",") if a.strip())
                desc, since = clean_comment(pending)
                entries.append({"k": "method", "c": cls, "n": m.group(2), "s": m.group(2) + "(" + args + ") → " + (ret or "void"),
                                "d": desc, "since": since, "f": path, "l": lineno})
            pending = []
            continue
        pending = []


def parse_enums(path, text, entries, enum_props):
    for m in re.finditer(r"enum class (\w+)\s*(?::\s*\w+\s*)?\{(.*?)\};", text, re.S):
        name = m.group(1)
        members = re.findall(r"^\s*(\w+)\s*(?:=|,|$)", m.group(2), re.M)
        qml = enum_props.get(name, "")
        lineno = text[:m.start()].count("\n") + 1
        entries.append({"k": "enum", "c": qml or name, "n": name, "s": (qml + " = " if qml else "") + "enum " + name + "（" + str(len(members)) + " 个值）",
                        "d": "", "since": "", "f": path, "l": lineno, "m": " ".join(members)})


# ---------------------------------------------------------------- 动作代码

def parse_ts(text):
    out = {}
    for ctx in re.finditer(r"<context>\s*<name>action</name>(.*?)</context>", text, re.S):
        for m in re.finditer(r"<source>(.*?)</source>.*?<translation[^>]*>(.*?)</translation>", ctx.group(1), re.S):
            src = unescape(m.group(1))
            tr = unescape(m.group(2))
            if tr and src not in out:
                out[src] = tr
    return out


def unescape(s):
    return s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&apos;", "'")


def strip_amp(s):
    s = re.sub(r"&(?=\S)", "", s)
    return re.sub(r"\s*\([A-Z0-9]\)", "", s)      # 中文菜单里的快捷键标记，如「全选 (A)」


def parse_actions(ctrl_path, ctrl, ui, zh, entries):
    codes = []
    for m in re.finditer(r"register\w*\(\s*\"([a-z0-9][a-z0-9-]*)\"", ctrl):
        codes.append((m.group(1), ctrl[:m.start()].count("\n") + 1))
    for m in re.finditer(r"register\w*\(\s*\"([a-z0-9-]+-)\"\s*\+\s*std::to_string", ctrl):
        codes.append((m.group(1) + "N", ctrl[:m.start()].count("\n") + 1))
    titles = {}
    parts = re.split(r"UiAction\(\s*\"", ui)
    for p in parts[1:]:
        code = p.split("\"", 1)[0]
        strs = re.findall(r"TranslatableString\(\s*\"action\"\s*,\s*\"((?:[^\"\\]|\\.)*)\"", p)
        if strs and code not in titles:
            titles[code] = strs
    seen = set()
    for code, lineno in codes:
        if code in seen:
            continue
        seen.add(code)
        t = titles.get(code, [])
        title = strip_amp(t[0]) if t else ""
        desc = strip_amp(t[1]) if len(t) > 1 else ""
        zh_t = zh.get(t[0], "") if t else ""
        zh_d = zh.get(t[1], "") if len(t) > 1 else ""
        entries.append({"k": "action", "c": "cmd", "n": code, "s": "cmd(\"" + code + "\")",
                        "d": " / ".join(x for x in [title, desc if desc != title else ""] if x),
                        "zh": " / ".join(x for x in [strip_amp(zh_t), strip_amp(zh_d) if strip_amp(zh_d) != strip_amp(zh_t) else ""] if x),
                        "since": "", "f": ctrl_path, "l": lineno})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ref", help="MuseScore 的 git 标签，例如 v4.6.3")
    ap.add_argument("--cache", default=None)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    here = os.path.dirname(os.path.abspath(__file__))
    plugin = os.path.dirname(os.path.dirname(here))
    version = a.ref.lstrip("v")
    out = a.out or os.path.join(plugin, "docs", f"api-{version}.json")

    entries = []
    enum_props = {}
    for h in API_HEADERS:
        text = fetch(a.ref, f"{API_DIR}/{h}", a.cache)
        if text:
            parse_header(f"{API_DIR}/{h}", text, entries, enum_props)
    text = fetch(a.ref, f"{API_DIR}/{ENUM_HEADER}", a.cache)
    if text:
        parse_enums(f"{API_DIR}/{ENUM_HEADER}", text, entries, enum_props)
    zh = {}
    ts = fetch(a.ref, ZH_TS, a.cache)
    if ts:
        zh = parse_ts(ts)
    for ctrl_path, ui_path in ACTION_CANDIDATES:
        ctrl = fetch(a.ref, ctrl_path, a.cache)
        if not ctrl:
            continue
        ui = fetch(a.ref, ui_path, a.cache) or ""
        parse_actions(ctrl_path, ctrl, ui, zh, entries)
        break

    for e in entries:
        for k in [k for k, v in e.items() if v in ("", None)]:
            del e[k]
    doc = {"version": version, "ref": a.ref, "repo": REPO,
           "source": f"https://github.com/{REPO}/tree/{a.ref}", "entries": entries}
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    kinds = {}
    for e in entries:
        kinds[e["k"]] = kinds.get(e["k"], 0) + 1
    print(f"写入 {out}：{len(entries)} 条 {kinds}，{os.path.getsize(out) // 1024} KB")


if __name__ == "__main__":
    main()
