"""录 demo 用：把一个技能暂时挪出 skills/，演示"从零用对话建技能"，录完再放回去。
用法：
  python dev/tools/demo_stash.py stash bass-1-3     # 挪到 dev/demo_stash/，并从 skills/index.json 去掉
  python dev/tools/demo_stash.py restore bass-1-3   # 放回去
挪走之后在插件里点「刷新」（技能页）或重开窗口，技能列表才会更新。
演示过程中 AI 新建的同名技能，restore 前要先删掉或改名，不然会撞名。
"""
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN = os.path.dirname(os.path.dirname(HERE))
SKILLS = os.path.join(PLUGIN, "skills")
STASH = os.path.join(PLUGIN, "dev", "demo_stash")
INDEX = os.path.join(SKILLS, "index.json")


def read_index():
    if not os.path.exists(INDEX):
        return []
    with open(INDEX, encoding="utf-8") as f:
        return json.load(f)


def write_index(names):
    with open(INDEX, "w", encoding="utf-8", newline="\n") as f:
        json.dump(names, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ("stash", "restore"):
        print(__doc__)
        sys.exit(2)
    action, name = sys.argv[1], sys.argv[2]
    folder = os.path.join(SKILLS, name)
    single = os.path.join(SKILLS, name + ".md")
    src = folder if os.path.isdir(folder) else single
    dst_dir = os.path.join(STASH, name)
    if action == "stash":
        if not os.path.exists(src):
            sys.exit("skills/ 里没有 " + name)
        os.makedirs(STASH, exist_ok=True)
        if os.path.exists(dst_dir):
            sys.exit("dev/demo_stash/ 里已经有 " + name + "，先 restore")
        shutil.move(src, dst_dir if os.path.isdir(src) else os.path.join(STASH, name + ".md"))
        names = [n for n in read_index() if n != name]
        write_index(names)
        print("已挪走 %s；index.json 现在有 %d 个技能。插件里点「刷新」。" % (name, len(names)))
    else:
        stashed = dst_dir if os.path.isdir(dst_dir) else os.path.join(STASH, name + ".md")
        if not os.path.exists(stashed):
            sys.exit("dev/demo_stash/ 里没有 " + name)
        if os.path.exists(folder) or os.path.exists(single):
            sys.exit("skills/ 里已经有 " + name + "（演示时新建的？），先删掉或改名")
        shutil.move(stashed, folder if os.path.isdir(stashed) else single)
        names = read_index()
        if name not in names:
            names.append(name)
            names.sort()
        write_index(names)
        print("已放回 %s；index.json 现在有 %d 个技能。插件里点「刷新」。" % (name, len(names)))


if __name__ == "__main__":
    main()
