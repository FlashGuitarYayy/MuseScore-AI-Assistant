# AI 助手插件 · 开发说明（给 coding agent 和开发者）

这是一个 MuseScore Studio 4.6+ 的 QML 插件（plugin API v1），作用是把一个兼容 OpenAI 接口的大模型（默认 DeepSeek）接进 MuseScore，用自然语言改谱。
用户说明见 README.md。这份文件记的是改代码前要知道的事，大多是踩过的坑。

## 结构

| 文件 | 作用 |
|---|---|
| `AIAssistant.qml` | 界面，以及和 MuseScore 的衔接：工具分发 `execTool`、文件读写、技能保存、设置 |
| `core/agent.js` | 模型客户端和工具调用循环。工具可以同步返回，也可以返回 `{pending, abort}` 异步返回 |
| `core/prompt.js` | system prompt 和工具定义。改助手的行为主要改这里 |
| `core/scoreio.js` | 读谱、`h.*` 辅助函数、脚本执行（startCmd/endCmd 事务）、谱面指纹、`inspectApi` |
| `core/skills.js` | 技能（Agent Skills 格式）的解析、保存、搜索、依赖 |
| `core/session.js` | 对话记录、复盘总结、对话压缩 |
| `core/docs.js` | 查接口清单 `docs/api-<版本>.json` |
| `core/remote.js` | 联网：读 MuseScore 源码、GitHub 代码搜索、从网址获取技能 |
| `core/bridge.js` | 本地桥：本机程序把工具调用写进 `bridge/job.json`，插件执行后写 `bridge/result.json`（见下文） |
| `core/theory.js` | 音名、tpc、调号换算 |
| `skills/` | 技能。新功能优先写成技能，不要往核心里塞 |
| `dev/tests/` | 测试：假的 MuseScore 加真实的 core/*.js 和技能，在 V8 里跑 |
| `dev/tools/build_api_docs.py` | 从 MuseScore 源码生成接口清单 |

## 验证接口，不要凭记忆

- 网上的插件教程和示例大多是 MuseScore 3 的。4.x 的接口变化很大，4.6 和 4.7 之间也不一样。
- 查接口：先看 `docs/api-4.6.3.json`（用 `dev/tools/build_api_docs.py` 生成），再到 GitHub 上对应的 tag 读源码，比如 https://github.com/musescore/MuseScore/tree/v4.6.3/src/engraving/api/v1 。
  不要看 master，master 是开发中的 5.0。
- 动作代码（`cmd("…")`）只认 `src/notation/internal/notationactioncontroller.cpp` 里注册过的名字。
  比如全选是 `notation-select-all`，不是 `select-all`。
- 4.7 才有的接口（例如 `replaceInstrument`、`appendLinkedStaff`、`setStaffType`）要先在运行时检查 `typeof curScore.xxx === "function"` 再用。

## 坑

- **插件类型**：不要设 `pluginType: "dialog"`。对话框开着时，MuseScore 认为当前不是乐谱页，`cmd()` 会被拒绝。
  现在的做法是不设 pluginType，插件自己开一个 QML `Window`。`core/instance.js` 保证只开一个窗口。
- **插件头**：`title`、`version` 这些属性必须写在 `MuseScore {` 后面最前面。旧的加载器读到第一个以 `{` 结尾的行就停。
- **`onScoreStateChanged` 在 4.x 不会触发**，选区要用 Timer 轮询。
- **输入框**：每个 TextField/TextArea 都要加 `Keys.onShortcutOverride: function (e) { e.accepted = true }`，
  否则 Backspace、方向键、Ctrl+Z 会被 MuseScore 的全局快捷键抢走。
- **Windows 上的窗口**：flags 只要不是单纯的 `Qt.Window`，Qt 就不会自动加标题栏，窗口也就拖不动。
  所以标题栏和按钮的 hint 要写全；置顶只在 `Qt.application.state === Qt.ApplicationActive` 时加。
- **FileIO**：只能读、写、删文件，不能列目录，也不能建目录。`logs/`、`docs/` 这些文件夹要事先存在。
  插件自己保存的技能是单个文件 `skills/<名称>.md`，脚本内嵌在里面。
- **XMLHttpRequest** 只能异步。要联网的工具返回 `{pending(cb), abort()}`，由 `agent.js` 等结果。
- **JS 的 `var` 是函数作用域**：在循环里写 `var x;` 不会把 x 清空。
  v0.1 到 v0.3 的工具循环因为这个，同一条回复里的第二个工具拿到的是第一个工具的结果。循环体要拆成函数。
- **调号**：插件改不了调号。改 `concertKey`/`actualKey` 不会更新谱表的调号表，`Cursor.add(KEYSIG)` 会覆盖已有的调号元素。
  换调要用 `notation-select-all transpose-down pitch-spell`。4.6.3 的 transpose-up/down 固定按增一度移，音会拼成 Fb、Cb，所以最后要 pitch-spell。
- **和弦标记**：4.6 没有 Harmony 包装类。从 `segment.annotations` 里取 `type === Element.HARMONY` 的元素，用 `.text` 读和弦名。
- **改了插件代码要完全重启 MuseScore**。插件对象和窗口会一直留在内存里。

## 测试

```
python -m pip install --target <目录A> mini-racer
python -I -X utf8 dev/tests/run_tests.py <目录A> . [假谱数据目录]
```

- QML 语法检查用 PySide6 自带的 qmllint：`pip install --target <目录B> PySide6-Essentials`。
  检查前要把 `import MuseScore`、`import FileIO` 去掉，把根元素换成 `Item`。
  `Qt.application.font`/`state` 和 `cmd` 会报找不到，这是误报。
- 新加的工具、辅助函数和技能都要在 `dev/tests/tests_*.js` 里加测试。假谱在 `dev/tests/fake_musescore.js`。
- 用户的 .mscz 文件只能当参考：复制出来，用 `dev/tests/mscx_to_fixture.py` 转成假谱数据。不要改原文件。

## 本地桥（coding agent 直接操作开着的 MuseScore）

用户在 `config.json` 里把 `bridge` 设为 true（设置页「重新读取 config.json」即可生效）后，可以不经过模型，直接让插件执行工具调用，谱面实时更新：

```
python dev/tools/bridge_client.py <插件目录> ping                      # 桥开没开、当前谱和选区
python dev/tools/bridge_client.py <插件目录> get_score_info
python dev/tools/bridge_client.py <插件目录> load_skill '{"name": "arrange-tools"}'   # 之后 run_script 里能用 at* 函数
python dev/tools/bridge_client.py <插件目录> run_script --code-file 脚本.js
python dev/tools/bridge_client.py <插件目录> run_skill '{"name": "lyrics-to-tab"}'
```

- 脚本环境和模型的 run_script 完全一样（`core/scoreio.js` 的 runScript：参数 curScore、h、newElement……，一步撤销）。
- 结果在 `bridge/result.json`，`ok` 为 false 就是插件返回了 ERROR。exit code 2 = 桥没开。
- 验证谱面可以让用户保存后用命令行渲染：`"C:\Program Files\MuseScore 4\bin\MuseScore4.exe" 谱.mscz -o 输出.png`（每页一张图，4 秒左右，GUI 开着也能跑）。
- 协议在 `core/bridge.js` 和 `bridge/README.md`。桥只读插件自己文件夹里的文件，不执行任意程序。

## 约定

- 界面文字、注释、给模型的提示都用简体中文。
- 不要提交 `config.json`（里面有 API key 和 token）和 `logs/`，`.gitignore` 已经排除了。
