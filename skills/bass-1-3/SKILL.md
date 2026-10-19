---
name: bass-1-3
description: "按和弦标记，在第 1、3 拍给吉他指弹编配加贝斯音，放在声部 2、低音区（E2 到 D#3），斜杠和弦用斜杠后的音。用户说「加贝斯」「加低音」「1、3 拍贝斯」时使用。"
description_en: "Following the chord symbols, add a bass note on beats 1 and 3 of a fingerstyle guitar arrangement, in voice 2, low register (E2 to D#3); slash chords use the note after the slash. Use when the user says 'add bass', 'add low notes' or 'bass on 1 and 3'."
compatibility: "MuseScore Studio 4.6+ 的 AI 助手插件"
metadata:
  button: "贝斯 1·3拍"
  button_en: "Bass 1\u00b73"
  requires: "arrange-tools"
---

# 第 1、3 拍加贝斯

按谱上的和弦标记，在每小节的强拍上加一个贝斯音，作为指弹编配的第一步。

## 规则

- 拍位：4/4 和 2/2 放第 1、3 拍；6/8 放第 1、4 拍；12/8 放第 1、7 拍；3/4、2/4 和其他拍号只放第 1 拍。
- 音：用那一拍生效的和弦的低音。有斜杠的和弦用斜杠后面的音，比如 C/G 放 G。
- 音高：放进 E2 到 D#3 这一个八度，也就是 6 弦空弦往上 11 个半音以内。拼写和和弦标记一致。
- 声部：声部 2（voice 1），时值默认八分音符，后面的格子留给以后加和弦音。
- 范围：有选区就只处理选区；什么都没选就处理全谱。五线谱加 TAB 时只写五线谱，TAB 自动跟着变。
- 不覆盖：声部 2 在那一拍已经有音，就跳过。所以重复运行不会叠出两个贝斯。
- 和弦标记要先写好：没有和弦标记的地方会跳过。

## 函数（scripts/lib.js）

- `addBassOnBeats(h, opts)`：执行上面的规则，返回一句结果说明。opts 可以覆盖默认值：
  - `lowPitch`：音域下限的 MIDI 音高，默认 40（E2）。比如 43 就是 G2 到 F#3。
  - `duration`：贝斯时值 `[分子, 分母]`，默认 `[1, 8]`。四分音符写 `[1, 4]`，二分写 `[1, 2]`。
  - `voice`：放在哪个声部，默认 1（界面上的声部 2）。
  - `beats`：自定义拍位，函数 `(num, den) → [相对小节开头的 tick…]`，比如只放第 1 拍：`function () { return [0]; }`。
- `bassBeatOffsets(num, den)`：默认的拍位规则。

## 示例

```
return addBassOnBeats(h, { duration: [1, 4] });
```

用户要求改默认值时，用 run_script 调用 `addBassOnBeats` 并传 opts，不要改技能文件。
