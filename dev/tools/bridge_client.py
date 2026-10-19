"""本地桥客户端：把一个工具调用交给开着的 MuseScore 插件执行，等结果打印出来。

先在插件「设置」里打开「本地桥」（插件窗口要开着）。用法：

  python dev/tools/bridge_client.py <插件目录> ping
  python dev/tools/bridge_client.py <插件目录> get_score_info
  python dev/tools/bridge_client.py <插件目录> run_skill '{"name": "lyrics-to-tab"}'
  python dev/tools/bridge_client.py <插件目录> load_skill '{"name": "arrange-tools"}'
  python dev/tools/bridge_client.py <插件目录> run_script --code-file 脚本.js
  python dev/tools/bridge_client.py <插件目录> cmd '{"code": "notation-select-all transpose-down pitch-spell"}'

run_script 里能用的东西和 AI 一样：curScore、h.*、已 load_skill 的技能函数库。改动在 MuseScore 里立刻可见，Ctrl+Z 撤销。
退出码：0 成功，1 插件返回 ERROR，2 桥没开，3 上一个任务没被取走，4 超时。
"""
import argparse
import json
import os
import sys
import time
import uuid


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("plugin_dir", help="AIAssistant 插件目录")
    ap.add_argument("tool", help="工具名，见 bridge/README.md")
    ap.add_argument("args_json", nargs="?", default="{}", help="工具参数，JSON")
    ap.add_argument("--code-file", help="run_script 用：从文件读脚本")
    ap.add_argument("--timeout", type=float, default=120, help="等结果的秒数")
    a = ap.parse_args()

    args = json.loads(a.args_json)
    if a.code_file:
        with open(a.code_file, encoding="utf-8") as f:
            args["code"] = f.read()

    bdir = os.path.join(a.plugin_dir, "bridge")
    job_p = os.path.join(bdir, "job.json")
    res_p = os.path.join(bdir, "result.json")
    st_p = os.path.join(bdir, "state.json")

    try:
        with open(st_p, encoding="utf-8") as f:
            st = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        print("桥没开：没有 state.json。在插件「设置」里打开「本地桥」，插件窗口要开着。", file=sys.stderr)
        return 2
    age = time.time() * 1000 - st.get("ts", 0)
    if not st.get("on") or age > 15000:
        print(f"桥没开（state.json: on={st.get('on')}，{age / 1000:.0f} 秒前更新）。在插件「设置」里打开「本地桥」，插件窗口要开着。",
              file=sys.stderr)
        return 2
    if os.path.exists(job_p):
        print("上一个任务还没被插件取走，等一下再试。", file=sys.stderr)
        return 3

    jid = uuid.uuid4().hex[:8]
    if os.path.exists(res_p):
        os.remove(res_p)
    tmp = job_p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"id": jid, "tool": a.tool, "args": args}, f, ensure_ascii=False)
    os.replace(tmp, job_p)   # 原子换名，插件不会读到半个文件

    t0 = time.time()
    while time.time() - t0 < a.timeout:
        if os.path.exists(res_p):
            try:
                with open(res_p, encoding="utf-8") as f:
                    r = json.load(f)
            except (json.JSONDecodeError, OSError):
                time.sleep(0.1)
                continue
            if r.get("id") == jid:
                print(r.get("text", ""))
                return 0 if r.get("ok") else 1
        time.sleep(0.2)
    print("超时：插件没有返回结果。MuseScore 是不是弹了对话框，或者插件窗口关了？", file=sys.stderr)
    return 4


if __name__ == "__main__":
    sys.exit(main())
