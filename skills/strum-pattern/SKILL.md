---
name: strum-pattern
description: "按节奏型给选区里的和弦批量加扫弦方向记号（下扫 / 上扫）。用户说「打扫弦」「节奏型」「1 n 2 n 3 n 4 n」「down up - up」之类时使用。"
description_en: "Add strum direction marks (down / up) to the chords in the selection following a pattern. Use when the user says 'strumming', 'strum pattern', '1 n 2 n 3 n 4 n', 'down up - up' and the like."
compatibility: "MuseScore Studio 4.6+ 的 AI 助手插件"
---

# 扫弦节奏型

给选区里的和弦按节奏型加上扫弦方向记号：下扫用 stringsDownBow，上扫用 stringsUpBow。

## 函数库（scripts/lib.js）

加载这个技能后，下面两个函数可以在 run_script 里直接调用：

- `parseStrumPattern(text)`：把口语节奏型解析成槽位数组，元素是 `"D"`、`"U"` 或 `null`（这一格不扫）。
- `strumPattern(h, items, slots, opts)`：把槽位套到和弦上，返回一句结果说明。
  - `opts.mode` 为 `"order"`（默认）时，按和弦出现的顺序套槽位，用完从头循环。
  - `opts.mode` 为 `"grid"` 时，按和弦在小节里的拍位套槽位，一格是一个八分音符。和弦时值不全是八分音符时用这个。

## 怎么把用户的说法变成槽位

1. 「down up - up down down up -」这种：down / D / 下 是下扫，up / U / 上 是上扫，- / x / 0 是空拍。
2. 「1 n 2 n 3 n 4 n」这种计数法：一个 4/4 小节分 8 个八分音符格子，数字是正拍，n 是反拍。
   只念计数时，默认正拍下扫、反拍上扫。只念到的格子才扫，比如「1 2n 3 4n」只在 1、2 的反拍、3、4 的反拍扫。
3. 拿不准时，先把解析出来的槽位列给用户确认，再执行。

## 示例

```
var slots = parseStrumPattern("down up - up down down up -");
var its = h.selectionItems();
return strumPattern(h, its, slots, { mode: "grid" });
```

执行前先 read_score 看清选区里有几个和弦，执行后再 read_score 复查记号有没有加上。
已有同样记号的和弦不会重复加。要清掉重来，用 `h.removeArticulations(item, "down")` 和 `h.removeArticulations(item, "up")`。
