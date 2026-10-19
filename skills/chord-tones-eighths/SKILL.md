---
name: chord-tones-eighths
description: "吉他指弹编配：按和弦标记，在声部 2 每个空着的八分音符位置叠出所有可选的和弦音（D3 到 G4、旋律下方），让用户一眼看到能选哪些音，再删成想要的。用户说「铺和弦音」「和弦音铺八分」「加和弦音」「看看有哪些音可以选」时使用。"
description_en: "Fingerstyle guitar arranging: following the chord symbols, stack every available chord tone (D3 to G4, below the melody) on each empty eighth-note slot in voice 2, so the user can see the options and delete down to what they want. Use when the user says 'lay out chord tones', 'chord tones on eighths', 'add chord tones' or 'show me which notes I can pick'."
compatibility: "MuseScore Studio 4.6+ 的 AI 助手插件"
metadata:
  button: "和弦音 八分"
  button_en: "Chord tones 8ths"
  requires: "arrange-tools"
---

# 和弦音铺八分

指弹编配的第二步，在「贝斯 1·3拍」之后用。每个八分音符位置上，把能放的和弦音全部叠成一个和弦，方便一眼看到所有选择，
然后删到只剩想要的那一个（或几个）。

## 规则

- 位置：每小节的每个八分音符位置。
  - 第 1、3 拍（3/4 只有第 1 拍）留给贝斯，不放。和「贝斯 1·3拍」先后顺序随意。
  - 声部 2 在那个位置已经有音的跳过，不覆盖。所以重复运行不会叠出两份。
- 音：那个位置生效的和弦标记的全部组成音。
  - 七和弦、挂留、add9、6、9、11、13、b5、#5、b9、#9 等都认。
  - 斜杠和弦只用斜杠前面那个和弦的音，比如 G/F 不放 F。
  - 拼写和和弦标记一致，比如 E 大调里写 G# 不写 Ab。
- 音区：D3 到 G4（实际音高，吉他谱上显示高八度；4 弦空弦到 1 弦 3 品），而且要在旋律下方：上限是那一刻旋律最低音再低半音。
  旋律是休止的时候只受 G4 限制。同一个音名在这个范围里有两个八度，就两个都放，比如 C 和弦是 E3、G3、C4、E4、G4。
- 声部：声部 2（voice 1），八分音符。被长休止符盖着的位置会把休止符拆开再放。
- 范围：有选区就只处理选区；什么都没选就处理全谱。五线谱加 TAB 时只写五线谱，TAB 自动跟着变。
  一个位置叠好几个音时，TAB 上可能显示弦冲突（红色）。这只是候选，删成一两个音以后就正常了。嫌太密用 `oneEach`。

这些默认值来自用户自己编好的曲子（瑪麗两版、月亮粑粑、不搖滾、Svag）。声部 2 里贝斯以外的音：

- 81%–90% 是和弦音，88%–98% 在旋律下方，八个八分位置都会用到；
- 音区 D3–G4 时，原编配里这些位置上的音有 68%–82% 出现在候选里，每个位置平均 3 个多音；
- 没覆盖到的主要是不属于和弦的经过音，以及偶尔更低的 B2、C3。

## 函数（scripts/lib.js）

- `addChordTonesEighths(h, opts)`：执行上面的规则，返回一句结果说明。opts 可以覆盖默认值：
  - `lowPitch` / `highPitch`：音区上下限（MIDI 实际音高），默认 50（D3）和 67（G4）。
  - `oneEach`：true 时每个和弦音只放一个，取最靠近音区中间的八度，比较清爽。默认 false，全部放。
  - `leaveBassBeats`：false 时第 1、3 拍也放和弦音（贝斯位置已经有音的照样跳过）。
  - `duration`：时值和格子间距 `[分子, 分母]`，默认 `[1, 8]`。十六分音符写 `[1, 16]`。
  - `voice`：放在哪个声部，默认 1；`melodyVoice`：旋律在哪个声部，默认 0。

arrange-tools 里新加的通用函数，写别的伴奏技能（比如分解和弦的指法型）时可以直接用：
`atChordTones`、`atChordTonePitches`、`atAddChord`、`atLowestPitchAt`、`atBassBeatOffsets`、`atBeatLabel`。

## 示例

```
return addChordTonesEighths(h, { oneEach: true, highPitch: 64 });
```

用户要求改默认值时，用 run_script 调用 `addChordTonesEighths` 并传 opts，不要改技能文件。
