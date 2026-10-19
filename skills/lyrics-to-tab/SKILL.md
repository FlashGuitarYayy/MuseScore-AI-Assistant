---
name: lyrics-to-tab
description: "把歌词从五线谱搬到联动六线谱下面，或者搬回来。用户说「歌词移到六线谱」「歌词放到 TAB 下面」「歌词显示在六线谱下面」「歌词搬回五线谱」时使用。"
description_en: "Move lyrics from the standard staff to below the linked TAB staff, or back. Use when the user says 'move lyrics to the TAB', 'lyrics under the tablature' or 'move lyrics back to the staff'."
compatibility: "MuseScore Studio 4.6+ 的 AI 助手插件"
metadata:
  button: "歌词→六线谱"
  button_en: "Lyrics\u2192TAB"
  requires: "arrange-tools"
---

# 歌词搬到六线谱下面

吉他谱常见的排法是：五线谱在上、联动六线谱在下、歌词在最下面。
MuseScore 里歌词是挂在某一条谱表的音符上的，联动谱表之间不会互相复制歌词，
所以"歌词显示在六线谱下面"就是"把每个歌词挂到六线谱上同一位置的音符上"。

## 规则

- 只处理"五线谱 + 联动六线谱"的组合（六线谱的 `primaryStaff` 是一条五线谱）。没有联动六线谱的谱表不动。
- 按 tick 一一对应：五线谱第 N 个声部某位置的歌词，挂到六线谱同一声部同一位置的和弦或休止符上。
  联动谱表的音符完全对应，所以正常情况下一个都不会漏；目标位置没有元素的会跳过并报出来。
- 文字、段数（verse）、音节属性、延长线长度都原样保留。
- 范围：有选区就只处理选区里的小节；什么都没选就处理全谱。
- 重复运行不会出错：第二次运行时五线谱上已经没有歌词，会报"没有改动"。
- 整个操作是一步撤销（Ctrl+Z）。分谱会自动跟着变。

## 函数（scripts/lib.js）

- `moveLyrics(h, opts)`：执行搬动，返回一句结果说明。
  - `to`：`"tab"`（默认）五线谱 → 六线谱；`"standard"` 六线谱 → 五线谱。
- `ltStaffPairs()`：找出配对 `[{std, tab}]`（谱表下标，0 起）。
- `ltCollect(track, fromTick, toTick)`、`ltPlace(track, item)`：收集和放置单条歌词，给别的脚本复用。

## 示例

```
return moveLyrics(h, { to: "standard" });
```

用户要搬回去时，用 run_script 调用 `moveLyrics(h, { to: "standard" })`，不要改技能文件。

## 不用插件的做法（4.6.3 界面，已对照源码确认）

右键任意歌词 → 选择 → 本谱表上的相似元素 → Ctrl+X → 点六线谱上**第一个歌词正下方的那个音** → Ctrl+V。
粘贴是按"从点的那个音开始往后数音符"定位的，起点点错整篇会错位。
