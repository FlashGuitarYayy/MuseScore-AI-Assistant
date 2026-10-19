# AI 助手 · MuseScore 插件 v0.5

[English README](README.md)

在 MuseScore Studio 4.6+ 里开一个独立窗口，用自然语言让 DeepSeek 读谱、改谱。
模型只能调用几个固定工具；所有谱面修改都由插件代码在一次可撤销事务里完成。
常用操作可以存成「技能」，格式遵循 Agent Skills 开放标准，能一键运行，也能分享。

## 从 v0.1 升级

v0.2 改成了插件自己开的普通窗口，不再用 MuseScore 的对话框。**升级后要完全退出并重启一次 MuseScore**，
它才会按新的类型加载插件。

原因：对话框类型的插件窗口开着时，MuseScore 认为当前界面不是乐谱页，会拒绝插件派发的大部分动作代码。

## 用法

- 插件 → AI 助手。窗口关掉后再运行一次插件，会找回原来的窗口和对话。
- 第一次在「设置」里填 DeepSeek API key。
- 对话页直接打字，Enter 发送。例如：
  - 「把选中部分全改成八分音符」
  - 「把第 3 小节第 2 个音改成 D」
  - 「选中的降一个半音」
  - 「整首从 F 大调改成 E 大调」（会连调号、和弦符号一起改）
  - 「给选区打 down up - up down down up - 的扫弦」
- 输入 `/` 会列出全部技能，继续打字逐步缩小，Tab 补全。`/技能名` 直接运行；`/技能名 补充说明` 交给 AI 按技能说明去做。
  名字打错时会列出可能的技能。
- 窗口顶部的按钮是带按钮的技能，点了直接运行，不经过模型。
- 「撤销本轮」按步数撤销上一轮的修改。撤销被 MuseScore 拒绝时会提示你在乐谱窗口按 Ctrl+Z。
- 工具调用到上限时，AI 会先说明做到了哪一步，然后可以点「继续」。
- 「总结」：复盘这次对话，内容包括目标、最后是怎么做成的、中间踩了哪些坑，并提议最多 3 个可以存成技能的操作。
  提议以卡片形式出现，点「打开编辑器，看看再存」后可以试运行，确认没问题再保存。不点保存就不会改动技能。
- 「压缩」：把之前的对话浓缩成一份交接说明再接着聊，省 token。上下文超过设置里的字数（默认 8 万字）时，
  发消息前会自动压缩。压缩只影响发给模型的内容，窗口里的对话和完整记录都还在。
- 每轮结束会自动把记录存进 `logs/`，不花 token。每轮记下你说了什么、AI 调了哪些工具、参数、结果和最后的回复。
  设置里可以关掉记录，也可以打开记录文件夹。
- 窗口是一条横向面板，第一次打开会贴到 MuseScore 主窗口底部、和它一样宽；拖走之后点「贴底」可以回去。
- 界面语言有 English / 中文（繁體）两档，默认跟系统；在「设置 → 语言」里可以改。字典在 core/i18n.js，简体条目也在，只是暂时不放出来。
- 「置顶」让窗口浮在 MuseScore 上面；切到别的应用时自动取消，不会挡着别的程序。拖标题栏或顶栏的空白处可以移动窗口。

## 技能

### 自带的技能

| 技能 | 按钮 | 做什么 |
|---|---|---|
| bass-1-3 | 贝斯 1·3拍 | 按和弦标记在第 1、3 拍加贝斯，放声部 2、E2 到 D#3。3/4 只放第 1 拍 |
| chord-tones-eighths | 和弦音 八分 | 每个空着的八分位置叠出全部可选的和弦音（D3–G4、旋律下方），一眼看到能选什么，再删成想要的 |
| lyrics-to-tab | 歌词→六线谱 | 把歌词从五线谱搬到联动六线谱下面（吉他谱常见排法），也能搬回来 |
| arrange-tools | | 编配用的函数库：解析和弦和和弦音、查某拍的和弦、安全地加音和叠和弦。bass-1-3 和 chord-tones-eighths 依赖它 |
| strum-pattern | | 按节奏型批量加扫弦方向记号 |
| mute-x | x 闷音 | 选区改成 x 符头 |
| eighth-notes | 改八分 | 选区改成八分音符 |
| musescore-ui-guide | | 插件做不到的操作的界面步骤，比如加联动六线谱、替换乐器、只改调号。界面文字按 4.6.3 核对过 |

bass-1-3 的使用：先给曲子写好和弦标记（选中音符按 Ctrl+K），选中要处理的小节，点「贝斯 1·3拍」。
什么都不选就处理全谱。声部 2 已经有音的拍位不会被覆盖，所以可以放心重复点。

chord-tones-eighths 是第二步：点「和弦音 八分」，每个空着的八分位置会叠出那一刻和弦的全部组成音。
第 1、3 拍留给贝斯，两个按钮先点哪个都行。叠出来的是候选，挑想要的留下，其余删掉。
嫌太密，可以在对话里说「/chord-tones-eighths 每个和弦音只放一个」。
默认音区是拿你编好的 5 份谱量出来的：你原来在这些位置上用的音，有 68%–82% 会出现在候选里。

### 找技能

- 技能页顶部的搜索框：空着时列出全部，打字后按名字、按钮文字、描述、使用说明、脚本里的词逐步缩小。
  多个词用空格隔开。完整匹配不到时按记得的几个字模糊匹配，比如「叉叉符头」能找到 x 闷音。
- 找不到时点「让 AI 帮我找」，或者直接在对话里问「有没有一个把音符变成叉的技能」。

### 新建

四种方式：

1. **从网址安装**：技能页的「从网址安装」框里，粘贴 SKILL.md 文件、技能文件夹（GitHub 上的 …/tree/… 链接）或 gist 的链接，点「获取」。
   技能会先在编辑器里打开，脚本也能看到。读一遍、试运行，没问题再保存。
2. **技能页 →「新建技能」**：填名称、描述、使用说明，可选一段直接运行的脚本、函数库、按钮文字。可以先「试运行」再保存。
3. **对话里说**：「把刚才这个操作存成技能，加个按钮叫 xxx」。AI 会调用 save_skill 存下来。
4. **手写文件**：照下面的格式在 `skills/` 里建文件。

插件自己存的技能是单个文件 `skills/<名称>.md`，因为插件接口没法新建文件夹。

### 格式

和 Claude、Codex、Gemini CLI 等用的 Agent Skills 标准一致：

```
skills/
  strum-pattern/            标准文件夹格式，下载来的技能直接放这里
    SKILL.md
    scripts/lib.js          可选：函数库
    scripts/run.js          可选：直接运行的脚本
  mute-x.md                 单文件格式，插件自己创建的
```

SKILL.md 开头是 YAML 头：

```yaml
---
name: mute-x                          # 小写字母、数字、连字符，和文件夹名或文件名一致
description: "做什么、什么时候用"       # 模型靠它判断要不要用
compatibility: "MuseScore Studio 4.6+ 的 AI 助手插件"
metadata:
  button: "x 闷音"                     # 可选：显示成按钮
  cmd: "pad-note-8"                    # 可选：按钮直接派发的动作代码
  requires: "arrange-tools"            # 可选：依赖的技能，运行前先载入它们的函数库
---
```

正文是给模型看的说明。脚本可以写在正文的代码块里，用 `js run` 标记直接运行的脚本，用 `js lib` 标记函数库：

````
```js run
var its = h.selectionItems();
return h.setDurations(its, 1, 8);
```
````

脚本环境和 AI 的 run_script 一样，可以用 `h.*` 辅助函数、`curScore` 等，完整列表见 `core/prompt.js`。

### 技能、脚本，还是两者搭配

技能本身就可以两者兼有：

- **一键脚本**：步骤固定、不用判断的操作，比如改八分、x 闷音、整曲降半音。写成直接运行的脚本，
  或者一串动作代码（比如 `cmd: "notation-select-all transpose-down pitch-spell"`），配上按钮，点一下就做完，不经过模型，也不花 token。
- **AI 技能**：每次情况不一样、需要看谱子判断的操作。写清楚使用说明，包括步骤、判断规则和注意事项，
  把可复用的计算写成函数库，让模型按情况调用。
- **两者搭配**：按钮执行默认做法；输入 `/名称 补充要求` 时，交给 AI 按说明调整。比如 bass-1-3 可以直接点，也可以说「/bass-1-3 用四分音符」。

「总结」提议技能时会标明属于哪一种。

### 模块化

通用的函数放进只有函数库的技能，比如 arrange-tools；具体的操作写成另一个技能，在 metadata 里用 `requires` 声明依赖。
这样每个技能都能单独拿走、单独修改，插件核心不用跟着改。

### 分享

- **最简单的方式**：把单文件技能 `skills/<名称>.md` 贴到一个 GitHub gist（或者任何能直接下载的网址），对方在「从网址安装」里粘贴链接就行。脚本已经内嵌在文件里了。
- 也可以把技能文件夹打包发给别人，对方放进自己的 `skills/` 就能用。
- 网上的技能目录有 Anthropic 的 anthropics/skills、Vercel 的 skills.sh、SkillsMP 等。那里的技能大多是给编程助手用的，脚本是 Python 或 shell，在这里跑不了；说明文字可以参考。
- 装别人的技能之前先读一遍 SKILL.md 和脚本。

## 查接口和源码

AI 下结论之前会按顺序查（规则写在 `core/prompt.js`）：

1. **search_api_docs**：插件自带的接口清单 `docs/api-4.6.3.json`，按 MuseScore 4.6.3 的源码生成。
   里面有类、属性、方法、枚举，以及全部动作代码和它们的中文菜单名。离线可用，不需要账号。
2. **inspect_api**：在运行中的 MuseScore 里看某个对象实际有哪些成员。
3. **fetch_source**：从 GitHub 读同一版本的 MuseScore 源码（按文件路径，可以只看匹配的几行）。不需要账号。
4. **search_source**：全文搜源码。GitHub 的代码搜索必须登录，所以要在设置里填一个 GitHub token。

关于 GitHub token：
- 在 GitHub 的 Settings → Developer settings → Fine-grained tokens 新建。Repository access 选「Public repositories」，不用勾任何权限。
  这样的 token 只能读公开仓库，泄露了也改不了你的东西。
- 代码搜索只搜仓库的默认分支。MuseScore 官方仓库的默认分支是开发中的新版本，不是 4.6.3。
  想搜 4.6.3，可以把 4.6.3 的源码推到你自己的一个**新仓库**（不要 fork，fork 不会被 GitHub 索引），然后在设置里把「代码搜索仓库」改成它。
- token 只存在自己电脑的 config.json 里。分享插件时不要带上 config.json，每个人用自己的 token。

升级 MuseScore 以后，用 `python dev/tools/build_api_docs.py v<新版本>` 重新生成接口清单，见 `docs/README.md`。

## 本地桥：让 Claude Code 这类本地程序直接操作谱面

在 `config.json` 里加 `"bridge": true`（设置页有「重新读取 config.json」按钮，不用重启），插件就每半秒读一次 `bridge/job.json`，
执行里面的工具调用（和 AI 用的同一套：run_script、run_skill、cmd……），结果写到 `bridge/result.json`，对话里也显示一条，
谱面在 MuseScore 里实时更新，Ctrl+Z 可撤销。

这样可以让电脑上更强的 coding agent 直接写脚本改谱，而不经过 DeepSeek：

```
python dev/tools/bridge_client.py <插件目录> ping
python dev/tools/bridge_client.py <插件目录> run_skill '{"name": "lyrics-to-tab"}'
python dev/tools/bridge_client.py <插件目录> run_script --code-file 脚本.js
```

协议细节见 `bridge/README.md`。桥只读插件自己文件夹里的文件；不用时把 `bridge` 改回 false。

## 给别人用

- 把整个 `AIAssistant` 文件夹给对方就行，**不要带 `config.json`（里面有你的 API key）和 `logs/` 里的记录**。
  对方第一次打开时在「设置」里填自己的 key，模板见 `config.example.json`。
- 不需要编程，也不需要本地装 coding agent：用插件、加技能（对话里让 AI 写、从网址安装、在编辑器里改）都在插件里完成，只要一个模型的 API key。
- Base URL 和模型名可以改成任何兼容 OpenAI 接口的服务，不限于 DeepSeek。
- 想改插件本身的人，可以用 Claude Code、Codex、Cursor 这类 coding agent 打开这个文件夹。
  `AGENTS.md`（`CLAUDE.md` 指向它）里记了结构、坑和测试方法，coding agent 会自动读。
- 放到 GitHub 上时，`.gitignore` 已经排除了 config.json 和 logs。

## 目录

```
AIAssistant.qml      界面 + 和 MuseScore 的衔接
core/agent.js        DeepSeek 客户端 + 工具调用循环
core/scoreio.js      读谱、序列化、辅助函数 h.*、脚本执行、谱面指纹
core/prompt.js       system prompt 和工具定义
core/skills.js       技能解析、保存、搜索
core/session.js      对话记录、复盘总结、对话压缩
core/docs.js         查接口清单
core/remote.js       读 MuseScore 源码、GitHub 代码搜索、从网址获取技能
core/bridge.js       本地桥：本机程序通过 bridge/ 里的文件调用插件
core/theory.js       音名、MIDI、tpc 换算
core/instance.js     单例
skills/              本地技能
bridge/              本地桥的信箱（job.json / result.json / state.json），文件夹要留着
dev/tests/           测试：假的 MuseScore + 真实的插件代码，在 V8 里跑。用法见 run_tests.py 开头
dev/tools/           build_api_docs.py：从 MuseScore 源码生成接口清单
docs/                接口清单 api-<版本>.json
skills/index.json    只在 MuseScore 不支持扫描文件夹时使用的技能列表
config.json          设置，含 API key 和 GitHub token。不要分享
config.example.json  设置模板
AGENTS.md            给 coding agent 和开发者的说明（CLAUDE.md 指向它）
logs/                对话记录（.json）和复盘（-总结.md）。文件夹要留着，插件没法自己新建
```

## 已知限制

- 小节号按位置数，弱起小节算第 1 小节。
- 改时值、加记号直接走插件 API。连音组里的音不改时值。
- 4.6 的插件接口不能加联动谱表（六线谱）、替换乐器、改谱表类型，这些接口 4.7 才有。
  AI 在说「做不到」之前会先用 inspect_api 查当前版本实际有哪些接口；确认做不到时，按 musescore-ui-guide 里的步骤告诉你怎么手动做。
- 插件接口改不了调号。换调用的是 MuseScore 自带的「升/降半音」和「优化等音拼写」，所以会连音高一起改。
  只想换调号、不改音高时，请从调号面板拖。
- 「优化等音拼写」（pitch-spell）作用于整首。只移调一段时，AI 会改用 h.respell 只重新拼写那一段。
- 谱子很大时（小节数 × 谱表数超过 4000）不检查每一步是否真的改了谱，「撤销本轮」可能多退一步。
- TAB 谱上新增音符需要弦号，辅助函数还没处理。
- 改了插件代码要重启 MuseScore 才生效，因为插件窗口会一直留在内存里。
- `config.json` 在 OneDrive 里时，API key 会以明文同步到云端。

## 安装

1. 下载本仓库（Code → Download ZIP，或 `git clone`），把文件夹放进 MuseScore 的插件目录：
   Windows 是 `文档\MuseScore4\Plugins\`，mac 是 `~/Documents/MuseScore4/Plugins/`。文件夹名随意。
2. MuseScore 里 插件 → 管理插件，启用「AI 助手」。
3. 插件 → AI 助手，在「设置」里填 DeepSeek（或其他 OpenAI 兼容服务）的 API key。

更新：重新下载覆盖，或者 `git pull`。`config.json`、`logs/`、`bridge/` 里的个人文件和你自己加的技能都不会被动。

## 许可证

MIT，见 `LICENSE`。例外：`docs/api-*.json` 是从 MuseScore 源码抽取的接口说明，按 MuseScore 的 GPL-3.0 分发。
MuseScore 本身不在仓库里。
