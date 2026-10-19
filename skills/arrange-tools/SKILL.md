---
name: arrange-tools
description: "吉他指弹编配用的函数库：解析和弦标记、查某一拍生效的和弦、把音放进指定音域、在指定声部的某个拍位安全地加音。加贝斯、加和弦音这类编配技能都依赖它；自己写编配脚本时也可以加载它。"
description_en: "Function library for fingerstyle guitar arranging: parse chord symbols, find the chord in effect at a beat, fit a pitch into a register, and safely add a note at a given beat in a given voice. Arranging skills such as adding bass or chord tones depend on it; load it when writing your own arranging scripts."
compatibility: "MuseScore Studio 4.6+ 的 AI 助手插件"
---

# 指弹编配工具库

只提供函数，不会直接改谱。其他技能在 metadata 里写 `requires: "arrange-tools"` 就能用这些函数。
函数名都以 `at` 开头，免得和别的脚本重名。

## 函数（scripts/lib.js）

和弦标记

- `atParseChord(text)`：解析 "F#m7b5"、"C/G"、"B♭maj7" 这样的和弦名，返回 `{ text, root, bass, quality }`。
  `root` 和 `bass` 都是 `{ pc, tpc, name }`：pc 是音级 0–11，tpc 是 MuseScore 的拼写编号。没有斜杠时 bass 等于 root。
  认不出来（比如 N.C.、罗马数字）返回 null。
- `atCollectHarmonies()`：收集全谱的和弦标记，按位置排好：`[{ tick, staffIdx, text, chord }]`。
- `atChordAt(harmonies, tick, staffIdx)`：tick 处生效的和弦，也就是这个谱表上 tick 及之前最近的一个。
  这个谱表上一个和弦标记都没有时，用其他谱表的。
- `atChordTones(chord)`：和弦的组成音 `[{ pc, tpc, iv }]`，从根音开始。iv 是音程名，比如 P1、M3、P5、m7。
  认得的写法有：m、dim、ø、aug、+、sus2、sus4、maj7、M7、Δ、7、6、69、add9、9、11、13，以及 b5、#5、b9、#9、#11、b13、no3、no5。
  拼写按音程算，比如 Bdim7 的七音是 Ab。斜杠后的低音不算在内。
- `atChordTonePitches(chord, low, high, oneEach)`：`[low, high]` 之间的全部和弦音 `[{ pitch, tpc }]`，从低到高。
  oneEach 为 true 时，每个音名只取最靠近音区中间的一个八度。

位置与范围

- `atMeasures()`：全部小节 `[{ index, startTick, endTick, num, den }]`，num/den 是拍号。
- `atScope(h)`：要处理的范围 `{ fromTick, toTick, staves, whole }`。有范围选区就用选区，点选了音符就用它们所在的小节，什么都没选就是全谱。
  staves 只取每个乐器的第一行谱表：五线谱加 TAB 的吉他只处理五线谱，TAB 会自动跟着变。
- `atBassBeatOffsets(num, den)`：贝斯一般放的拍位（相对小节开头的 tick）。4/4、2/2 是第 1、3 拍，6/8 是第 1、4 拍，12/8 是第 1、7 拍，其他拍号只放第 1 拍。
- `atBeatLabel(m, tick)`：给结果说明用的位置名，比如「第3小节第2拍」「第3小节第2拍后半」。

加音

- `atPitchInRange(pc, low)`：把音级放进 `[low, low + 11]`。默认 low = 40，也就是 E2，6 弦空弦。
- `atVoiceState(staffIdx, voice, tick, measureStart)`：这个声部在 tick 处的情况：
  `start` 有音或休止符正好从这里开始，`cover` 被前面一个更长的音或休止符盖着，`gap` 这里是空的。
- `atAddNote(staffIdx, voice, tick, measureStart, pitch, tpc, n, d)`：在这个声部的 tick 处加一个时值 n/d 的音。
  不覆盖已有的音。返回 `added`、`occupied`（已经有音）、`blocked`（被长休止符盖着）、`noslot`（这个拍位上没有任何音可以借来定位）或 `failed`。
  tpc 不为空时，按它设置拼写，让音名和和弦标记一致。
- `atAddChord(staffIdx, voice, tick, measureStart, notes, n, d)`：在 tick 处加一个和弦，`notes = [{ pitch, tpc }]`。
  不覆盖已有的音。被长休止符盖着时先把休止符拆开；这个声部整段是空的时，先补休止符开出位置。
  返回值和 atAddNote 一样，另外 `partial` 表示只加上了一部分音。
- `atLowestPitchAt(staffIdx, voice, tick, measureStart)`：这个声部在 tick 处响着的最低音（MIDI），休止或空着返回 null。
  用来让伴奏待在旋律下面。
- `atSplitRestAt(…)`、`atOpenVoice(…)`、`atHasSegment(staffIdx, tick)`、`atSetTpc(chord, pitch, tpc)`：atAddChord 用的底层函数。

## 约定

- voice 从 0 起：0 是界面上的「声部 1」，放旋律；1 是「声部 2」，放贝斯和伴奏。
- tick 以四分音符 = division（480）计。
- 音高用实际发音的 MIDI 音高，吉他的 E2 = 40，记谱上显示为高八度的 E3。
