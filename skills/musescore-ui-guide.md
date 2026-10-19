---
name: musescore-ui-guide
description: "插件做不到、要在 MuseScore 4.6 界面里手动做的操作：加联动六线谱（TAB）、替换乐器、只改调号不改音高、改谱表类型。界面文字按 4.6.3 源码和中文翻译核对过。用户要做这些，或者你查过接口确认做不到时，按这里的步骤告诉用户。"
description_en: "Things the plugin cannot do and that must be done by hand in the MuseScore 4.6 UI: add a linked TAB staff, replace an instrument, change the key signature without transposing, change the staff type. UI wording checked against the 4.6.3 sources. When the user asks for these, or you have confirmed the API cannot do it, give the user these steps."
compatibility: "MuseScore Studio 4.6+ 的 AI 助手插件"
---

# MuseScore 4.6 界面操作指南

下面这些操作，4.6 的插件接口做不到。4.7 起 curScore 上才有 replaceInstrument、appendLinkedStaff、setStaffType。
先用 inspect_api 查 curScore：查到这几个方法，说明是 4.7 或更新的版本，可以试着用脚本直接做。查不到，就把下面的步骤原样告诉用户。
不要改菜单名和按钮名，它们和中文界面一致（按 MuseScore 4.6.3 核对，2026-10）。

## 给五线谱加联动六线谱（TAB）

做完以后五线谱还是主谱，六线谱和它内容相同、自动同步。

1. **乐器不是吉他时先替换**。MusicXML 导入的旋律常常是 Voice（人声），没有弦的信息，做不出六线谱。
   - 打开左侧的「版面」面板。看不到的话，用菜单「视图 → 版面」打开。
   - 把鼠标移到乐器那一行，点右边的齿轮按钮（设置），再点「替换乐器」。
   - 选「原音吉他」或「古典吉他」。选普通的那个，不要选名字里带指法谱的。
2. 点乐器名左边的展开箭头，下面会列出这个乐器的谱表。点谱表那一行右边的齿轮，再点「创建联动谱表」。
3. 点新出现的那个谱表右边的齿轮，「谱表类型」选「6弦常用指法谱」。想在六线谱上也显示时值，就选「6弦完整指法谱」。

注意：

- 吉他谱按惯例比实际音高高一个八度记谱。人声换成吉他后，实际音高不变，所以五线谱上整体会高一个八度显示。
  - 旋律原来在 C5 到 B5 附近（实际音高）时，吉他上要按 8 到 19 品，偏高。
  - 指弹一般把旋律降一个八度。做完上面几步后，可以问用户要不要全选后降八度：用 cmd `notation-select-all pitch-down-octave`，或者让用户按 Ctrl+↓。
- 六线谱上的弦和品由 MuseScore 自动分配。

## 替换乐器

同上面第 1 步。实际音高不变，记谱会按新乐器的移调重新显示。

## 只改调号、不改音高

插件改不了调号。手动做法：

1. 单击要开始换调的那个小节的空白处，选中这一小节。
2. 在左侧「符号面板」里找到「调号」，点目标调号。

调号从这一小节起生效，音高不变。

如果要连音高一起换调（比如 F 大调整体改成 E 大调），不用手动：
用 cmd `notation-select-all transpose-down pitch-spell`，降几个半音就写几遍 transpose-down，升调用 transpose-up。

## 改谱表类型（五线谱 ↔ 六线谱）

在「版面」面板里点乐器左边的展开箭头，再点谱表右边的齿轮，然后在「谱表类型」里选。
只有吉他这类有弦的乐器才有指法谱选项。不是的话，先按上面的步骤替换乐器。
