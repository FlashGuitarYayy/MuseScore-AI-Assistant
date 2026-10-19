---
name: eighth-notes
description: "把选区里的音符全部改成八分音符：每个音起点不变，空出来的地方补休止符。用户说「改成八分」时使用。"
description_en: "Turn every note in the selection into an eighth note: each note keeps its start and the freed space is filled with rests. Use when the user says 'make them eighths'."
compatibility: "MuseScore Studio 4.6+ 的 AI 助手插件"
metadata:
  button: "改八分"
  button_en: "To 8ths"
---

# 改八分

把选区里的和弦全部改成八分音符，效果和在 MuseScore 里选中后按数字键 4 一样。
休止符不改。要连休止符一起改，用 `h.setDurations(its, 1, 8, { includeRests: true })`。
照这个样子换掉 1, 8 就能做四分、十六分的按钮。

## 直接运行的脚本

```js run
var its = h.selectionItems();
if (!its.length) { return "先选中要改的音"; }
return h.setDurations(its, 1, 8);
```
