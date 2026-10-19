---
name: mute-x
description: "把选区里所有和弦改成 x 符头，表示闷音。用户说「闷音」「x 符头」「打叉」时使用。"
description_en: "Change every chord in the selection to x noteheads for muted strums. Use when the user says 'mute', 'x noteheads' or 'cross them out'."
compatibility: "MuseScore Studio 4.6+ 的 AI 助手插件"
metadata:
  button: "x 闷音"
  button_en: "x mute"
---

# x 符头闷音

把当前选区里每个和弦的所有音改成 x 符头（NoteHeadGroup.HEAD_CROSS）。
改回普通符头用 `h.setNoteheads(item, "normal")`。

## 直接运行的脚本

点按钮、输入 /mute-x 或模型调用 run_skill 时执行，作用于当前选区。

```js run
var its = h.selectionItems();
var n = 0;
its.forEach(function (it) {
    if (it.isChord) {
        h.setNoteheads(it, "cross");
        n++;
    }
});
if (n === 0) { return "选区里没有和弦"; }
return n + " 个和弦改成了 x 符头";
```
