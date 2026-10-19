"""在 V8 里跑插件的 JS 模块：假的 MuseScore 谱面 + 真实的 core/*.js 和 skills/ 里的技能。

准备一次：  python -m pip install --target <某个目录> mini-racer
运行：      python -I dev/tests/run_tests.py <那个目录> <插件目录> [假谱数据目录]

假谱数据目录可选：里面放 mscx_to_fixture.py 生成的 *.json，tests_bass.js 会拿真实曲子来跑。
"""
import json
import os
import re
import sys

sys.path.insert(0, sys.argv[1])
from py_mini_racer import MiniRacer  # noqa: E402

PLUGIN = sys.argv[2]
FIXTURES = sys.argv[3] if len(sys.argv) > 3 else None
HERE = os.path.dirname(os.path.abspath(__file__))


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def as_module(name, path):
    """把 QML 的 JS 模块包成 var Name = (function(){ ...; return {...}; })();"""
    src = read(path)
    src = re.sub(r"^\.(pragma|import) .*$", "", src, flags=re.M)
    names = re.findall(r"^function (\w+)", src, flags=re.M) + re.findall(r"^var (\w+)", src, flags=re.M)
    exports = ", ".join(f"{n}: {n}" for n in names)
    return f"var {name} = (function () {{\n{src}\nreturn {{ {exports} }};\n}})();\n"


ctx = MiniRacer()
ctx.eval(read(os.path.join(HERE, "fake_musescore.js")))
for mod, rel in [("I18n", "core/i18n.js"), ("Theory", "core/theory.js"), ("Skills", "core/skills.js"),
                 ("Prompt", "core/prompt.js"), ("ScoreIO", "core/scoreio.js"),
                 ("Agent", "core/agent.js"), ("Session", "core/session.js"),
                 ("Docs", "core/docs.js"), ("Remote", "core/remote.js"), ("Bridge", "core/bridge.js")]:
    ctx.eval(as_module(mod, os.path.join(PLUGIN, rel)))

files = {}
for dirpath, _, names in [w for d in ("skills", "docs") for w in os.walk(os.path.join(PLUGIN, d))]:
    for n in names:
        full = os.path.join(dirpath, n)
        rel = os.path.relpath(full, PLUGIN).replace("\\", "/")
        files[rel] = read(full)
ctx.eval("var FILES = " + json.dumps(files, ensure_ascii=False) + ";")

fixtures = {}
if FIXTURES and os.path.isdir(FIXTURES):
    for n in sorted(os.listdir(FIXTURES)):
        if n.endswith(".json"):
            fixtures[n[:-5]] = json.loads(read(os.path.join(FIXTURES, n)))
ctx.eval("var FIXTURES = " + json.dumps(fixtures, ensure_ascii=False) + ";")

ctx.eval(read(os.path.join(HERE, "tests.js")))
for extra in sorted(f for f in os.listdir(HERE) if f.startswith("tests_") and f.endswith(".js")):
    ctx.eval(read(os.path.join(HERE, extra)))
out = json.loads(ctx.eval("JSON.stringify(runAll())"))
info = json.loads(ctx.eval("JSON.stringify(typeof INFO === 'undefined' ? [] : INFO)"))
fails = [r for r in out if not r["ok"]]
for r in out:
    print(("PASS " if r["ok"] else "FAIL ") + r["name"] + ("" if r["ok"] else "\n     " + r["msg"]))
if info:
    print("\nINFO")
    for line in info:
        print("  " + line)
print(f"\n{len(out) - len(fails)}/{len(out)} passed" + ("" if fixtures else "（没有给假谱数据目录，真实曲子的测试跳过了）"))
sys.exit(1 if fails else 0)
