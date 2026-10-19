//=============================================================================
//  AI 助手  v0.5
//
//  把 AI agent 接进 MuseScore：说人话，模型通过工具读谱、改谱；本地技能可以新建、调用、分享。
//  模型只能调用 core/prompt.js 里定义的工具；谱面修改都由 core/scoreio.js 在 startCmd/endCmd
//  事务里完成，出错回滚。
//
//  注意：这里故意不设 pluginType。MuseScore 会把插件当作「直接运行」类型，插件自己开一个普通窗口。
//  如果设成 dialog，窗口开着时 MuseScore 认为当前界面不是乐谱页，会拒绝插件派发的大部分动作代码。
//  插件信息那几行必须放在最前面：MuseScore 读到第一个以 { 结尾的行就不往下读了。
//
//  v0.5：控件改用 QtQuick.Controls.Basic 样式（可定制、认调色板；系统原生样式会无视自定义背景，
//  勾选框还会压字），按钮和勾选框套成圆角扁平的；窗口改成横向面板，第一次弹出贴到 MuseScore 主窗口底部。
//
//  core/agent.js     DeepSeek 客户端 + 工具调用循环
//  core/scoreio.js   读谱、序列化、辅助函数 h.*、脚本执行、谱面指纹
//  core/prompt.js    system prompt 和工具定义
//  core/skills.js    本地技能（Agent Skills 格式）
//  core/session.js   对话记录、复盘总结、对话压缩
//  core/docs.js      插件接口清单的查询（docs/api-<版本>.json，由 dev/tools/build_api_docs.py 生成）
//  core/remote.js    联网：读 MuseScore 源码、GitHub 代码搜索、从网址获取技能
//  core/instance.js  单例，避免重复开窗口
//  config.json       API key 等设置（不要分享；模板见 config.example.json）
//  logs/             每次对话的记录（.json）和复盘（-总结.md）
//=============================================================================

import QtQuick
import QtQuick.Controls.Basic
import QtQuick.Layouts
import QtQuick.Window
import MuseScore 3.0
import FileIO 3.0

import "core/theory.js"   as Theory
import "core/scoreio.js"  as ScoreIO
import "core/agent.js"    as Agent
import "core/prompt.js"   as Prompt
import "core/skills.js"   as Skills
import "core/session.js"  as Session
import "core/docs.js"     as Docs
import "core/remote.js"   as Remote
import "core/instance.js" as Instance
import "core/bridge.js"   as Bridge
import "core/i18n.js"     as I18n

MuseScore {
    title: "AI 助手"
    description: "用自然语言指挥 MuseScore：读谱、改谱，新建和调用本地技能。"
    version: "0.5"
    requiresScore: true
    categoryCode: "composing-arranging-tools"

    id: root

    // ---- 配色 -----------------------------------------------------------
    readonly property color cBg:      "#1e1e1e"
    readonly property color cPanel:   "#252526"
    readonly property color cLine:    "#3c3c3c"
    readonly property color cText:    "#d4d4d4"
    readonly property color cDim:     "#9d9d9d"
    readonly property color cUser:    "#264f78"
    readonly property color cAssist:  "#2d2d30"
    readonly property color cTool:    "#23302a"
    readonly property color cError:   "#4a2b2b"
    readonly property color cInfo:    "#2d2d3a"
    readonly property color cIdea:    "#36321f"
    readonly property color cAccent:  "#3794ff"
    readonly property color cBtn:     "#3a3d41"
    readonly property color cBtnHi:   "#45494e"
    readonly property color cPrimary: "#0e639c"
    readonly property color cPrimaryHi: "#1177bb"

    // ---- 状态 -----------------------------------------------------------
    property var cfg: ({ apiKey: "", baseUrl: "https://api.deepseek.com", model: "deepseek-flash", reasoningEffort: "none", maxIterations: 15, maxTokens: 4096,
                         compactChars: 80000, keepLogs: true,
                         githubToken: "", githubSearchRepo: "musescore/MuseScore", sourceRepo: "musescore/MuseScore", sourceRef: "",
                         bridge: false })
    property var messages: []           // 发给模型的完整对话（含 system）
    property bool busy: false
    property var turn: null
    property int turnSeq: 0
    property int undoSteps: 0           // 当前这一轮产生的可撤销步数
    property int lastTurnSteps: 0
    property bool canContinue: false
    property string selSummary: "—"
    property string page: "chat"        // chat | skills | editor | settings
    property bool pinned: true
    property bool placed: false         // 第一次弹出时已经贴到主窗口底部了
    // 界面语言："zh-Hans" | "zh-Hant" | "en"。config.json 里 lang 为 auto 或没写时跟系统
    property string lang: (cfg && cfg.lang && cfg.lang !== "auto") ? cfg.lang : I18n.detect(Qt.locale().name)

    property var skills: []
    property var skillProblems: []
    property var loadedSkills: ({})
    property var buttonSkills: skills.filter(function (s) { return s.button && Skills.runnable(s); })
    property var suggestions: []        // "/" 提示：搜索结果 [{skill, snippet, fuzzy}]
    property string skillQuery: ""
    property var skillResults: Skills.searchDetailed(skills, skillQuery)
    property var folderModel: null
    property bool folderScan: false
    property var editingSkill: null
    property string editorNote: ""
    property string deleteArmed: ""

    property var sessionLog: null       // 这次对话的记录，见 core/session.js
    property var proposals: []          // 总结里提议的技能草稿，对话里的提议卡片按下标引用
    property bool bumpyHinted: false    // 「这一轮绕了路，可以总结」只提醒一次

    property var apiDocs: null          // 插件接口清单，见 core/docs.js
    property bool installing: false     // 正在从网址获取技能
    property string installNote: ""

    property bool bridgeBusy: false     // 本地桥正在等一个联网工具的结果，见 core/bridge.js
    property int bridgeTicks: 0

    FileIO { id: fio }
    ListModel { id: chatModel }

    // 4.x 里 onScoreStateChanged 不会触发，所以定时刷新选区摘要
    Timer {
        interval: 1200
        repeat: true
        running: win.visible && !busy
        onTriggered: refreshSelection()
    }

    Timer {
        id: rescanTimer
        interval: 200
        onTriggered: loadSkills()
    }

    // 本地桥：每半秒看一眼 bridge/job.json
    Timer {
        interval: 500
        repeat: true
        running: cfg.bridge === true && win.visible
        onTriggered: bridgeTick()
    }

    // ---- 深色输入控件 ---------------------------------------------------
    // 所有输入控件都在 ShortcutOverride 阶段接受按键，否则 Backspace、方向键、Ctrl+Z 会被 MuseScore 的全局快捷键抢走。
    component DarkField: TextField {
        color: cText
        placeholderTextColor: cDim
        selectByMouse: true
        background: Rectangle {
            implicitHeight: 30
            color: cBg
            border.color: parent.activeFocus ? cAccent : cLine
            radius: 4
        }
        Keys.onShortcutOverride: function (event) { event.accepted = true; }
    }

    component TextBox: ScrollView {
        property alias text: ta.text
        property alias placeholderText: ta.placeholderText
        property bool mono: false
        clip: true
        background: Rectangle {
            color: cBg
            border.color: ta.activeFocus ? cAccent : cLine
            radius: 4
        }
        TextArea {
            id: ta
            color: cText
            placeholderTextColor: cDim
            selectByMouse: true
            wrapMode: mono ? TextEdit.NoWrap : TextEdit.Wrap
            font.family: mono ? "Consolas" : Qt.application.font.family
            font.pixelSize: mono ? 12 : 13
            background: null
            Keys.onShortcutOverride: function (event) { event.accepted = true; }
            Keys.onPressed: function (event) {
                if (mono && event.key === Qt.Key_Tab) {
                    ta.insert(ta.cursorPosition, "    ");
                    event.accepted = true;
                }
            }
        }
    }

    // =====================================================================
    //  文件与配置
    // =====================================================================

    // 界面文字查字典（core/i18n.js）。绑定里读了 lang，切换语言会自动重算
    function tr(s) { return I18n.t(s, lang); }
    // core/*.js 里的 T() 用的是 i18n.js 的模块级语言，这里同步过去
    onLangChanged: I18n.setLang(lang)
    Component.onCompleted: I18n.setLang(lang)
    // 技能的按钮和描述：英文界面下优先用 SKILL.md 里的 button_en / description_en
    function skButton(sk) { return Skills.skButton(sk); }
    function skDesc(sk) { return Skills.skDesc(sk); }

    // 语言一选就记住：只改 config.json 里的 lang，别的字段原样保留，不用点「保存」
    function setLang(code) {
        var merged = {};
        for (var k in cfg) { merged[k] = cfg[k]; }
        merged.lang = code;
        cfg = merged;
        writeFile("config.json", JSON.stringify(cfg, null, 2));
    }

    // Qt.resolvedUrl 给的是 file:///C:/...，FileIO 要纯路径
    function localPath(rel) {
        var u = Qt.resolvedUrl(rel).toString();
        var p = decodeURIComponent(u.replace(/^file:\/\//, ""));
        if (/^\/[A-Za-z]:/.test(p)) { p = p.substring(1); }
        return p;
    }

    function readFile(rel) {
        fio.source = localPath(rel);
        if (!fio.exists()) { return ""; }
        return fio.read();
    }

    function writeFile(rel, text) {
        fio.source = localPath(rel);
        return fio.write(text);
    }

    function removeFile(rel) {
        fio.source = localPath(rel);
        return fio.remove();
    }

    function loadConfig() {
        var t = readFile("config.json");
        if (!t) { return; }
        try {
            var o = JSON.parse(t);
            var merged = {};
            for (var k in cfg) { merged[k] = cfg[k]; }
            for (var k2 in o) { merged[k2] = o[k2]; }
            cfg = merged;
        } catch (e) {
            addMsg("error", tr("config.json 解析失败: ") + e);
        }
    }

    function syncSettingsFields() {
        apiKeyField.text = cfg.apiKey || "";
        baseUrlField.text = cfg.baseUrl || "";
        modelBox.currentIndex = modelBox.find(cfg.model);
        effortBox.currentIndex = Math.max(0, effortBox.find(cfg.reasoningEffort));
        langBox.currentIndex = (lang === "en") ? 0 : 1;
        iterBox.value = cfg.maxIterations || 15;
        compactBox.value = Math.round((cfg.compactChars === undefined ? 80000 : cfg.compactChars) / 10000);
        keepLogsBox.checked = cfg.keepLogs !== false;
        githubTokenField.text = cfg.githubToken || "";
        searchRepoField.text = cfg.githubSearchRepo || "musescore/MuseScore";
        bridgeBox.checked = cfg.bridge === true;
    }

    // ---- 版本、接口清单、源码 ----

    function mscoreVersionString() {
        try { return root.mscoreMajorVersion + "." + root.mscoreMinorVersion + "." + root.mscoreUpdateVersion; } catch (e) { return ""; }
    }

    // 先找和正在运行的 MuseScore 同版本的清单，没有就按 docs/index.json 里的顺序找
    function loadApiDocs() {
        var names = ["docs/api-" + mscoreVersionString() + ".json"];
        try {
            (JSON.parse(readFile("docs/index.json") || "[]")).forEach(function (v) { names.push("docs/api-" + v + ".json"); });
        } catch (e) { }
        for (var i = 0; i < names.length; i++) {
            var t = readFile(names[i]);
            if (!t) { continue; }
            try { apiDocs = Docs.parse(t); return; } catch (e2) { addMsg("error", names[i] + tr(" 解析失败: ") + e2); }
        }
        apiDocs = null;
    }

    // 读源码用的版本：默认和正在运行的 MuseScore 一致
    function sourceCfg() {
        var v = mscoreVersionString();
        return {
            sourceRepo: cfg.sourceRepo || "musescore/MuseScore",
            sourceRef: cfg.sourceRef || (v ? "v" + v : "v4.6.3"),
            githubToken: cfg.githubToken || "",
            githubSearchRepo: cfg.githubSearchRepo || "musescore/MuseScore"
        };
    }

    function environmentText() {
        var v = mscoreVersionString();
        var lines = ["", "", tr("运行环境：MuseScore ") + (v || tr("未知版本")) + tr("。")];
        if (apiDocs) {
            lines.push(tr("search_api_docs 查的接口清单按 MuseScore ") + apiDocs.version + tr(" 的源码生成") +
                       (v && apiDocs.version !== v ? tr("，和正在运行的版本不一样，以 inspect_api 查到的为准") : "") + tr("。"));
        } else {
            lines.push(tr("没有接口清单，search_api_docs 不可用，用 inspect_api。"));
        }
        lines.push(tr("fetch_source 读的源码版本：") + sourceCfg().sourceRef + tr("。search_source ") + (cfg.githubToken ? tr("可用，搜 ") + sourceCfg().githubSearchRepo : tr("不可用（没有 GitHub token）")) + tr("。"));
        return lines.join("\n");
    }

    function saveConfig() {
        var merged = {};
        for (var k in cfg) { merged[k] = cfg[k]; }
        merged.apiKey = apiKeyField.text.trim();
        merged.baseUrl = baseUrlField.text.trim() || "https://api.deepseek.com";
        // 下拉框里没有的模型名（手改 config.json 填的）保持不变
        merged.model = modelBox.currentIndex >= 0 ? modelBox.currentText : (cfg.model || "deepseek-flash");
        merged.reasoningEffort = effortBox.currentText;
        merged.maxIterations = iterBox.value;
        merged.compactChars = compactBox.value * 10000;
        merged.keepLogs = keepLogsBox.checked;
        merged.githubToken = githubTokenField.text.trim();
        merged.githubSearchRepo = searchRepoField.text.trim() || "musescore/MuseScore";
        merged.lang = langBox.currentIndex === 0 ? "en" : "zh-Hant";
        cfg = merged;
        if (writeFile("config.json", JSON.stringify(cfg, null, 2))) {
            addMsg("info", tr("设置已保存。"));
        } else {
            addMsg("error", tr("设置写入失败（") + localPath("config.json") + tr("）。本次会话仍可使用。"));
        }
    }

    // =====================================================================
    //  和 MuseScore 打交道
    // =====================================================================

    function makeApi() {
        return {
            curScore: curScore,
            division: division,
            newElement: function (t) { return root.newElement(t); },
            removeElement: function (e) { root.removeElement(e); },
            fraction: function (n, d) { return root.fraction(n, d); },
            fractionFromTicks: function (t) { return root.fractionFromTicks(t); },
            Element: Element,
            Segment: Segment,
            NoteHeadGroup: NoteHeadGroup,
            SymId: SymId,
            Accidental: Accidental,
            DurationType: DurationType
        };
    }

    function refreshSelection() {
        try {
            selSummary = curScore ? ScoreIO.selectionSummary(makeApi()) : tr("没有打开的谱子");
        } catch (e) {
            selSummary = tr("(读取选区失败: ") + e + ")";
        }
    }

    function truncate(s, n) {
        s = String(s);
        return s.length > n ? s.substring(0, n) + tr(" …(共 ") + s.length + tr(" 字)") : s;
    }

    function changeNote(before, after) {
        if (before === "skip" || after === "skip") {
            undoSteps++;
            return tr("（谱子较大，没有检查谱面是否改变）");
        }
        if (before !== after) {
            undoSteps++;
            return tr("谱面已改变。");
        }
        return tr("谱面没有变化。");
    }

    function runScriptTracked(code, prelude) {
        var api = makeApi();
        var before = ScoreIO.scoreHash(api);
        var r = ScoreIO.runScript(api, code, prelude, ScoreIO.makeHelpers(api));
        var text = ScoreIO.formatRunResult(r);
        if (r.ok) { text += "\n" + changeNote(before, ScoreIO.scoreHash(api)); }
        refreshSelection();
        return { ok: r.ok, text: text };
    }

    // 派发一个动作代码，如实汇报它有没有效果：changed | selection | none | unknown
    function dispatchOne(api, code) {
        var before = ScoreIO.scoreHash(api);
        var selBefore = ScoreIO.selectionSummary(api);
        root.cmd(code);
        var after = ScoreIO.scoreHash(api);
        var selAfter = ScoreIO.selectionSummary(api);
        if (before === "skip") { undoSteps++; return { effect: "unknown", sel: selAfter }; }
        if (before !== after) { undoSteps++; return { effect: "changed", sel: selAfter }; }
        if (selBefore !== selAfter) { return { effect: "selection", sel: selAfter }; }
        return { effect: "none", sel: selAfter };
    }

    // 一个或多个动作代码（空格隔开），按顺序派发
    function doCmd(code) {
        var codes = Prompt.splitCmds(code);
        if (!codes.length) { return tr("ERROR: 缺少动作代码"); }
        if (!Prompt.cmdAllowed(code)) { return tr("ERROR: 不允许执行动作 ") + codes.join(" ") + tr("（文件类动作不允许，一次最多 ") + Prompt.MAX_CMDS + tr(" 个）"); }
        var api = makeApi();
        var said = { changed: tr("谱面已改变"), selection: tr("谱面没变，选区变了"), none: tr("没有任何变化"), unknown: tr("谱子较大，没有检查是否生效") };
        var lines = [];
        var dead = [];
        var last = null;
        codes.forEach(function (c, i) {
            last = dispatchOne(api, c);
            if (last.effect === "none") { dead.push(c); }
            lines.push((codes.length > 1 ? (i + 1) + ". " : "") + c + tr("：") + said[last.effect]);
        });
        refreshSelection();
        var text = (codes.length > 1 ? tr("已依次执行 ") + codes.length + tr(" 个动作：\n") : tr("已执行 ")) + lines.join("\n") + tr("\n当前选区: ") + last.sel;
        if (dead.length) {
            text = "WARNING: " + dead.join(", ") + tr(" 派发后谱面和选区都没有变化。可能是 MuseScore 不认识这个动作代码、在当前状态下拒绝执行，") +
                   tr("或者它对当前选区不起作用（比如拼写本来就对时 pitch-spell 不会改动）。不要重复无效的动作，必要时改用 run_script 和 h.* 辅助函数。\n") + text;
        }
        return text;
    }

    // 要联网的工具：交给 Agent.runTurn 等结果。start(done) 返回可以 abort 的句柄，或者已经同步调过 done 时返回 null。
    function networkTool(start) {
        var handle = null;
        return {
            pending: function (done) { handle = start(done); },
            abort: function () { if (handle) { handle.abort(); } }
        };
    }

    // 模型调用的工具都从这里走
    function execTool(name, args) {
        if (!curScore) { return tr("ERROR: 没有打开的谱子"); }
        args = args || {};
        var api = makeApi();
        switch (name) {
        case "get_score_info":
            return ScoreIO.scoreInfo(api);
        case "read_score":
            return ScoreIO.readScore(api, args);
        case "select_range": {
            var ok = ScoreIO.selectRange(api, args.from_measure, args.to_measure, args.staff_from, args.staff_to);
            refreshSelection();
            return ok ? (tr("已选中。当前选区: ") + selSummary) : tr("ERROR: 选择失败（范围或谱表不合法）");
        }
        case "run_script":
            if (!args.code) { return tr("ERROR: 缺少 code"); }
            return runScriptTracked(args.code, Skills.prelude(loadedSkills)).text;
        case "cmd":
            return doCmd(args.code);
        case "inspect_api":
            return ScoreIO.inspectApi(api, args.path);
        case "search_api_docs":
            return Docs.searchText(apiDocs, String(args.query || ""), 12);
        case "fetch_source":
            return networkTool(function (done) { return Remote.fetchSource(sourceCfg(), args, done); });
        case "search_source":
            return networkTool(function (done) { return Remote.searchSource(sourceCfg(), args.query, done); });
        case "load_skill": {
            var sk = Skills.resolve(skills, String(args.name || ""));
            if (!sk) { return tr("ERROR: 没有叫 ") + args.name + tr(" 的技能。现有技能: ") + skills.map(function (s) { return s.name; }).join(", "); }
            activateSkill(sk);
            return skillLoadText(sk);
        }
        case "run_skill": {
            var sk2 = Skills.resolve(skills, String(args.name || ""));
            if (!sk2) { return tr("ERROR: 没有叫 ") + args.name + tr(" 的技能"); }
            return runSkill(sk2);
        }
        case "save_skill":
            return saveSkillFromTool(args);
        case "search_skills":
            return Skills.searchText(skills, String(args.query || ""), 8);
        default:
            return tr("ERROR: 未知工具 ") + name;
        }
    }

    function toolLabel(name, args) {
        if (name === "run_script") { return "run_script" + (args.purpose ? tr("：") + args.purpose : "") + "\n" + truncate(args.code, 400); }
        if (name === "cmd") { return "cmd " + args.code; }
        if (name === "read_score" || name === "select_range") { return name + " " + JSON.stringify(args); }
        if (name === "load_skill" || name === "run_skill") { return name + " " + args.name; }
        if (name === "save_skill") { return "save_skill " + args.name; }
        if (name === "search_skills") { return "search_skills " + args.query; }
        if (name === "inspect_api") { return "inspect_api " + args.path; }
        if (name === "search_api_docs" || name === "search_source") { return name + " " + args.query; }
        if (name === "fetch_source") { return "fetch_source " + args.path + (args.grep ? " grep=" + args.grep : "") + (args.from_line ? tr(" 行 ") + args.from_line + "-" + (args.to_line || "") : ""); }
        return name;
    }

    // =====================================================================
    //  技能
    // =====================================================================

    // 用 Qt 自带的 FolderListModel 扫描 skills/。动态创建，万一这个模块加载不了也不影响插件本身。
    function initFolderScan() {
        try {
            folderModel = Qt.createQmlObject(
                "import QtQuick\nimport Qt.labs.folderlistmodel\n" +
                "FolderListModel { showDirs: true; showFiles: true; showDotAndDotDot: false; showHidden: false; nameFilters: [\"*.md\"] }",
                root, "skillsFolderModel");
            folderModel.countChanged.connect(function () { rescanTimer.restart(); });
            folderModel.statusChanged.connect(function () { rescanTimer.restart(); });
            folderModel.folder = Qt.resolvedUrl("skills/");
            folderScan = true;
        } catch (e) {
            folderModel = null;
            folderScan = false;
            addMsg("info", tr("这个 MuseScore 不支持扫描文件夹，技能列表改用 skills/index.json。(") + e + ")");
        }
    }

    function readIndex() {
        try {
            var a = JSON.parse(readFile("skills/index.json") || "[]");
            return Array.isArray(a) ? a : [];
        } catch (e) {
            return [];
        }
    }

    function indexAdd(id) {
        if (!id) { return; }
        var a = readIndex();
        if (a.indexOf(id) < 0) { a.push(id); writeFile("skills/index.json", JSON.stringify(a, null, 2)); }
    }

    function indexRemove(id) {
        if (!id) { return; }
        var a = readIndex();
        var i = a.indexOf(id);
        if (i >= 0) { a.splice(i, 1); writeFile("skills/index.json", JSON.stringify(a, null, 2)); }
    }

    function skillEntries() {
        var out = [];
        if (folderModel && folderScan) {
            for (var i = 0; i < folderModel.count; i++) {
                var fname = String(folderModel.get(i, "fileName"));
                if (folderModel.get(i, "fileIsDir")) {
                    out.push({ kind: "folder", id: fname, rel: "skills/" + fname + "/SKILL.md", dir: "skills/" + fname + "/" });
                } else if (/\.md$/i.test(fname) && fname.toLowerCase() !== "readme.md") {
                    out.push({ kind: "file", id: fname.replace(/\.md$/i, ""), rel: "skills/" + fname, dir: "" });
                }
            }
        } else {
            readIndex().forEach(function (id) {
                if (readFile("skills/" + id + "/SKILL.md")) {
                    out.push({ kind: "folder", id: id, rel: "skills/" + id + "/SKILL.md", dir: "skills/" + id + "/" });
                } else {
                    out.push({ kind: "file", id: id, rel: "skills/" + id + ".md", dir: "" });
                }
            });
        }
        return out;
    }

    function loadSkills() {
        var list = [];
        var problems = [];
        var seen = {};
        skillEntries().forEach(function (en) {
            var text = readFile(en.rel);
            if (!text) {
                if (en.kind === "file") { problems.push(en.rel + tr("：读不到内容")); }
                return;   // 没有 SKILL.md 的文件夹直接跳过
            }
            var sk = Skills.parse(en, text, readFile);
            if (sk.error) { problems.push(en.rel + tr("：") + sk.error); return; }
            if (seen[sk.name]) { problems.push(en.rel + tr("：和 ") + seen[sk.name] + tr(" 重名，已跳过")); return; }
            seen[sk.name] = en.rel;
            if (sk.warning) { problems.push(en.rel + tr("：") + sk.warning); }
            list.push(sk);
        });
        list.sort(function (a, b) { return a.name.localeCompare(b.name); });
        list.forEach(function (sk) {
            var missing = [];
            Skills.withDeps(list, sk, missing);
            if (missing.length) { problems.push(sk.path + tr("：依赖的技能不存在 ") + missing.join(", ")); }
        });
        skills = list;
        skillProblems = problems;
        var copy = {};
        for (var k in loadedSkills) {
            var s = Skills.find(list, k);
            if (s) { copy[k] = s; }
        }
        loadedSkills = copy;
        updateSuggestions();
    }

    // 连同依赖一起加载；依赖排在前面，函数库按这个顺序拼进 run_script
    function activateSkill(sk) {
        var copy = {};
        for (var k in loadedSkills) { copy[k] = loadedSkills[k]; }
        Skills.withDeps(skills, sk, null).forEach(function (s) { copy[s.name] = s; });
        loadedSkills = copy;
    }

    function skillLoadText(sk) {
        var s = tr("# 技能 ") + sk.name + "\n" + (sk.instructions || sk.description);
        var deps = Skills.withDeps(skills, sk, null).filter(function (d) { return d !== sk; });
        if (deps.length) {
            s += tr("\n\n[依赖的技能已一并加载：") + deps.map(function (d) { return d.name; }).join(", ") + "]";
            deps.forEach(function (d) { s += tr("\n\n# 依赖 ") + d.name + "\n" + (d.instructions || d.description); });
        }
        if (sk.lib) { s += tr("\n\n[函数库已加载，下面这些函数可以在 run_script 里直接调用]\n") + sk.lib; }
        if (Skills.runnable(sk)) { s += tr("\n\n[这个技能可以用 run_skill 直接运行，作用于当前选区]"); }
        return s;
    }

    function runSkill(sk) {
        if (!curScore) { return tr("ERROR: 没有打开的谱子"); }
        var missing = [];
        var libs = Skills.libChain(skills, sk, missing);
        if (missing.length) { return tr("ERROR: 技能 ") + sk.name + tr(" 依赖的技能不存在: ") + missing.join(", "); }
        if (sk.run) { return runScriptTracked(sk.run, libs).text; }
        if (sk.cmd) { return doCmd(sk.cmd); }
        return tr("ERROR: 技能 ") + sk.name + tr(" 没有可直接运行的脚本或动作代码");
    }

    // 按钮、/名称（不带参数）、技能页的「运行」：不经过模型
    function runSkillFromUi(sk) {
        if (busy) { return; }
        undoSteps = 0;
        var lt = logBegin("button", "[" + (skButton(sk) ? tr("按钮 ") + skButton(sk) : "/" + sk.name) + "]");
        var res = runSkill(sk);
        lastTurnSteps = undoSteps;
        logTool(lt, "run_skill", { name: sk.name }, res);
        logEnd(lt, {});
        addMsg(/^(ERROR|WARNING)/.test(res) ? "error" : "info", "[" + (skButton(sk) || sk.name) + "] " + res);
    }

    // ---- 本地桥：把 bridge/job.json 里的工具调用执行掉，结果写回 bridge/result.json ----

    function bridgeState(on) {
        writeFile(Bridge.STATE_FILE, Bridge.formatState(on, {
            score: scoreTitle(), selection: selSummary, version: mscoreVersionString(), busy: busy || bridgeBusy
        }));
    }

    function bridgeTick() {
        if (++bridgeTicks % 10 === 0) { bridgeState(true); }
        if (busy || bridgeBusy) { return; }
        var text = readFile(Bridge.JOB_FILE);
        if (!text) { return; }
        removeFile(Bridge.JOB_FILE);
        var p = Bridge.parseJob(text);
        if (!p.ok) {
            writeFile(Bridge.RESULT_FILE, Bridge.formatResult(null, "ERROR: " + p.error, 0));
            addMsg("error", tr("[桥] ") + p.error);
            return;
        }
        var job = p.job;
        undoSteps = 0;
        var lt = logBegin("bridge", tr("[桥] ") + Bridge.describe(job));
        var finish = function (res) {
            res = String(res);
            lastTurnSteps = undoSteps;
            logTool(lt, job.tool, job.args, res);
            logEnd(lt, {});
            writeFile(Bridge.RESULT_FILE, Bridge.formatResult(job, res, undoSteps));
            addMsg(/^(ERROR|WARNING)/.test(res) ? "error" : "info", tr("[桥 ") + Bridge.describe(job) + "] " + Bridge.short(res));
            bridgeBusy = false;
            bridgeState(true);
        };
        var r;
        try {
            r = job.tool === "ping"
                ? (tr("在线。MuseScore ") + (mscoreVersionString() || "?") + tr("，谱：") + (scoreTitle() || tr("没有打开的谱子")) + tr("，选区：") + selSummary)
                : execTool(job.tool, job.args);
        } catch (e) {
            r = "ERROR: " + e;
        }
        if (r && typeof r === "object" && r.pending) {
            bridgeBusy = true;
            r.pending(finish);
        } else {
            finish(r);
        }
    }

    // original：被编辑的原技能；新建时为 null
    function saveSkill(s, original) {
        s.name = String(s.name || "").trim();
        s.description = String(s.description || "").trim();
        s.button = String(s.button || "").trim();
        s.cmd = String(s.cmd || "").trim();
        s.lib = String(s.lib || "");
        s.run = String(s.run || "");
        s.instructions = String(s.instructions || "");
        s.requires = Skills.splitNames(s.requires);
        // 英文版的按钮/描述（SKILL.md 里的 button_en / description_en）编辑器里没有字段，编辑时原样带过去
        if (original) {
            if (!s.description_en) { s.description_en = original.description_en || ""; }
            if (!s.button_en) { s.button_en = original.button_en || ""; }
        }
        var err = Skills.validate(s, Prompt.cmdAllowed);
        if (!err) {
            var unknown = s.requires.filter(function (n) { return n === s.name || !Skills.find(skills, n); });
            if (unknown.length) { err = tr("依赖的技能不存在或依赖了自己: ") + unknown.join(", "); }
        }
        if (err) { return { ok: false, error: err }; }
        err = ScoreIO.compileCheck(s.lib, tr("函数库")) || ScoreIO.compileCheck(s.run, tr("直接运行的脚本"));
        if (err) { return { ok: false, error: err }; }
        if (original && original.kind === "folder" && s.name !== original.name) {
            return { ok: false, error: tr("文件夹格式的技能不能在这里改名。要改名请到文件夹里手动改。") };
        }
        var clash = Skills.find(skills, s.name);
        if (clash && !(original && clash.path === original.path)) {
            if (!s.overwrite) { return { ok: false, error: tr("已经有叫 ") + s.name + tr(" 的技能。换个名字，或者确认覆盖。") }; }
            if (!original) { original = clash; }
        }
        var p = Skills.plan(s, original);
        for (var i = 0; i < p.files.length; i++) {
            if (!writeFile(p.files[i].rel, p.files[i].text)) {
                return { ok: false, error: tr("写入失败: ") + localPath(p.files[i].rel) };
            }
        }
        p.remove.forEach(function (rel) { removeFile(rel); });
        if (!folderScan) {
            if (original) { indexRemove(original.id); }
            indexAdd(original && original.kind === "folder" ? original.id : s.name);
        }
        loadSkills();
        return { ok: true, path: p.path };
    }

    function saveSkillFromTool(a) {
        var s = {
            name: a.name, description: a.description, instructions: a.instructions,
            run: a.run_script, lib: a.lib_script, button: a.button, cmd: a.cmd, requires: a.requires, overwrite: !!a.overwrite
        };
        var r = saveSkill(s, null);
        if (!r.ok) { return "ERROR: " + r.error; }
        addMsg("info", tr("已保存技能 /") + s.name + (s.button ? tr("，窗口顶部多了按钮「") + s.button + tr("」") : "") + tr("。文件：") + localPath(r.path));
        return tr("已保存到 ") + r.path + tr("。用户以后输入 /") + s.name + tr(" 就能调用") + (s.button ? tr("，也可以点按钮「") + s.button + tr("」") : "") + tr("。");
    }

    function deleteSkill(sk) {
        var ok;
        if (sk.kind === "file") {
            ok = removeFile(sk.path);
        } else {
            ok = removeFile(sk.dir + "SKILL.md");
            if (sk.libFile) { removeFile(sk.dir + "scripts/lib.js"); }
            if (sk.runFile) { removeFile(sk.dir + "scripts/run.js"); }
        }
        if (!folderScan) { indexRemove(sk.id); }
        loadSkills();
        if (ok) {
            addMsg("info", tr("已删除技能 ") + sk.name + (sk.kind === "folder" ? tr("。空文件夹 ") + localPath(sk.dir) + tr(" 还在，可以手动删掉。") : tr("。")));
        } else {
            addMsg("error", tr("删除失败: ") + localPath(sk.path));
        }
    }

    function openEditor(sk) {
        editingSkill = sk || null;
        edName.text = sk ? sk.name : "";
        edName.readOnly = !!(sk && sk.kind === "folder");
        edDesc.text = sk ? sk.description : "";
        edButton.text = sk ? sk.button : "";
        edCmd.text = sk ? sk.cmd : "";
        edRequires.text = sk ? (sk.requires || []).join(" ") : "";
        edInstr.text = sk ? sk.instructions : "";
        edRun.text = sk ? sk.run : "";
        edLib.text = sk ? sk.lib : "";
        editorNote = "";
        page = "editor";
    }

    // 总结里提议的技能：放进编辑器，用户看过、试运行过再决定存不存
    function openDraft(ref) {
        var p = proposals[ref];
        if (!p) { return; }
        var clash = Skills.find(skills, p.name);
        openEditor(clash || null);
        edName.text = p.name;
        edDesc.text = p.description;
        edButton.text = p.button;
        edCmd.text = p.cmd;
        edRequires.text = p.requires;
        edInstr.text = p.instructions;
        edRun.text = p.run;
        edLib.text = p.lib;
        editorNote = clash ? tr("这是 AI 提议的改进版，保存会覆盖现有的 /") + p.name + tr("。先试运行看看。")
                           : tr("这是 AI 提议的草稿，还没保存。先试运行看看，没问题再保存。");
    }

    // 从网址获取技能：下载后放进编辑器当草稿，用户看过脚本再决定存不存。存成单文件 skills/<名称>.md，脚本内嵌。
    function installFromUrl(url) {
        url = String(url || "").trim();
        if (!url || installing) { return; }
        installing = true;
        installNote = tr("正在获取……");
        Remote.fetchSkill(url, cfg.githubToken, function (r) {
            installing = false;
            if (r.error) { installNote = tr("获取失败：") + r.error; return; }
            var sk = Skills.parse({ kind: "folder", id: "", rel: r.from, dir: "" }, r.text, function (rel) {
                if (/scripts\/lib\.js$/.test(rel)) { return r.lib; }
                if (/scripts\/run\.js$/.test(rel)) { return r.run; }
                return "";
            });
            if (sk.error) { installNote = tr("这不是有效的技能文件：") + sk.error; return; }
            installNote = "";
            var clash = Skills.find(skills, sk.name);
            openEditor(clash || null);
            edName.text = sk.name;
            edDesc.text = sk.description;
            edButton.text = sk.button;
            edCmd.text = sk.cmd;
            edRequires.text = (sk.requires || []).join(" ");
            edInstr.text = sk.instructions;
            edRun.text = sk.run;
            edLib.text = sk.lib;
            editorNote = tr("这是从网上获取的技能，还没保存（来源：") + r.from + tr("）。") +
                         (clash ? tr("保存会覆盖现有的 /") + sk.name + tr("。") : "") +
                         tr("先读一遍脚本，确认没问题再试运行、保存。") +
                         (sk.requires.length ? tr("它依赖 ") + sk.requires.join(", ") + tr("，要先装好。") : "");
        });
    }

    function saveEditor() {
        var r = saveSkill({
            name: edName.text, description: edDesc.text, button: edButton.text, cmd: edCmd.text, requires: edRequires.text,
            instructions: edInstr.text, lib: edLib.text, run: edRun.text, overwrite: false
        }, editingSkill);
        if (!r.ok) { editorNote = r.error; return; }
        addMsg("info", tr("已保存技能 /") + edName.text.trim() + tr("：") + localPath(r.path));
        page = "skills";
    }

    // 不保存，直接拿编辑器里的脚本在当前选区上跑一次
    function tryEditor() {
        if (!curScore) { editorNote = tr("没有打开的谱子"); return; }
        var err = ScoreIO.compileCheck(edLib.text, tr("函数库")) || ScoreIO.compileCheck(edRun.text, tr("直接运行的脚本"));
        if (err) { editorNote = err; return; }
        undoSteps = 0;
        var deps = Skills.splitNames(edRequires.text).map(function (n) { return Skills.find(skills, n); });
        if (deps.some(function (d) { return !d; })) { editorNote = tr("依赖的技能不存在: ") + edRequires.text; return; }
        var libs = deps.map(function (d) { return Skills.libChain(skills, d, null); }).join("\n") + "\n" + edLib.text;
        var lt = logBegin("button", tr("[试运行技能草稿 ") + (edName.text.trim() || tr("未命名")) + "]");
        var res = edRun.text.trim() ? runScriptTracked(edRun.text, libs).text : doCmd(edCmd.text);
        lastTurnSteps = undoSteps;
        if (edRun.text.trim()) { logTool(lt, "run_script", { code: edRun.text, purpose: tr("试运行") }, res); }
        else { logTool(lt, "cmd", { code: edCmd.text }, res); }
        logEnd(lt, {});
        addMsg(/^(ERROR|WARNING)/.test(res) ? "error" : "info", tr("[试运行] ") + res);
        editorNote = tr("试运行结果：") + truncate(res, 300);
    }

    function updateSuggestions() {
        var m = /^\/(\S*)$/.exec(input.text);
        // 只输入 / 时列出全部技能，继续打字逐步缩小
        suggestions = m ? Skills.searchDetailed(skills, m[1]) : [];
    }

    // item 可以是搜索结果 {skill, …}，也可以直接是技能
    function applySuggestion(item) {
        var sk = item.skill || item;
        input.text = "/" + sk.name + " ";
        input.cursorPosition = input.length;
        input.forceActiveFocus();
        suggestions = [];
    }

    function askAiToFindSkill(q) {
        if (!q) { return; }
        page = "chat";
        startTurn(tr("帮我找技能：") + q,
                  tr("我记不清技能叫什么了，想找的是：") + q + tr("。用 search_skills 搜，可以换几种说法多搜几次。") +
                  tr("然后告诉我最可能是哪个、它做什么、怎么调用。"));
    }

    function prefillInput(text) {
        input.text = text;
        page = "chat";
        input.forceActiveFocus();
        input.cursorPosition = input.length;
    }

    // =====================================================================
    //  对话
    // =====================================================================

    // ref：提议卡片指向 proposals 的下标，其他消息为 -1
    function addMsg(kind, text, ref) {
        chatModel.append({ kind: kind, text: String(text), ref: ref === undefined ? -1 : ref });
        chatView.positionViewAtEnd();
    }

    function systemPrompt() {
        return Prompt.SYSTEM + environmentText() + Skills.catalogText(skills);
    }

    function needApiKey() {
        if (cfg.apiKey) { return false; }
        addMsg("error", tr("请先在「设置」里填 DeepSeek API key。"));
        syncSettingsFields();
        page = "settings";
        return true;
    }

    // ---- 对话记录（logs/<id>.json），每轮结束自动保存 ----

    function scoreTitle() {
        try { return curScore ? (curScore.scoreName || curScore.title || "") : ""; } catch (e) { return ""; }
    }

    function logBegin(kind, prompt) {
        if (!sessionLog) { sessionLog = Session.newLog(scoreTitle()); }
        return Session.beginTurn(sessionLog, kind, prompt, selSummary);
    }

    function logTool(lt, name, args, result) { if (lt) { Session.addTool(lt, name, args, result); } }

    function logEnd(lt, info) {
        if (!lt) { return; }
        info.undoSteps = undoSteps;
        Session.endTurn(lt, info);
        saveLog();
    }

    function logRel(suffix) { return "logs/" + sessionLog.id + suffix; }

    function saveLog() {
        if (!sessionLog || !sessionLog.turns.length || cfg.keepLogs === false) { return; }
        if (!writeFile(logRel(".json"), JSON.stringify(sessionLog, null, 1))) {
            if (!sessionLog.writeFailed) { addMsg("error", tr("对话记录写不进 ") + localPath("logs") + tr("。这个文件夹被删掉的话，手动建一个空的就行。")); }
            sessionLog.writeFailed = true;
        }
    }

    function resetConversation() {
        turnSeq++;
        if (turn) { turn.abort(); }
        turn = null;
        busy = false;
        messages = [];
        loadedSkills = {};
        canContinue = false;
        sessionLog = null;
        proposals = [];
        bumpyHinted = false;
        chatModel.clear();
        addMsg("info", tr("新对话。当前选区：") + selSummary);
    }

    function finishTurn() {
        busy = false;
        turn = null;
        lastTurnSteps = undoSteps;
        refreshSelection();
    }

    // display：显示在对话里的文字；content：真正发给模型的内容
    function startTurn(display, content) {
        if (busy) { return false; }
        if (needApiKey()) { return false; }
        if (!curScore) { addMsg("error", tr("没有打开的谱子。")); return false; }
        if (display) { addMsg("user", display); }
        // 上下文太长就先压缩，压完再接着发
        if (Session.needsCompact(messages, cfg.compactChars === undefined ? 80000 : cfg.compactChars)) {
            compactConversation(true, function () { runAgentTurn(display, content); });
        } else {
            runAgentTurn(display, content);
        }
        return true;
    }

    function runAgentTurn(display, content) {
        refreshSelection();
        var sys = { role: "system", content: systemPrompt() };
        if (messages.length === 0) { messages = [sys]; } else { messages[0] = sys; }
        messages.push({ role: "user", content: tr("[当前选区: ") + selSummary + "]\n" + content });
        busy = true;
        canContinue = false;
        undoSteps = 0;
        var lt = logBegin("chat", display || content);
        var myId = ++turnSeq;
        turn = Agent.runTurn(cfg, messages, Prompt.TOOLS, execTool, {
            assistant: function (t) {
                if (myId !== turnSeq) { return; }
                addMsg("assistant", t);
                Session.addReply(lt, t);
            },
            tool: function (name, args, result) {
                if (myId !== turnSeq) { return; }
                addMsg("tool", toolLabel(name, args) + "\n→ " + truncate(result, 800));
                logTool(lt, name, args, result);
            },
            error: function (e) {
                if (myId !== turnSeq) { return; }
                addMsg("error", e);
                finishTurn();
                logEnd(lt, { error: e });
            },
            done: function (info) {
                if (myId !== turnSeq) { return; }
                if (info && info.note) { addMsg("info", info.note); }
                canContinue = !!(info && info.capped);
                finishTurn();
                logEnd(lt, { note: info ? info.note : "", capped: !!(info && info.capped) });
                if (!bumpyHinted && Session.bumpy(lt)) {
                    bumpyHinted = true;
                    var st = Session.stats(lt);
                    addMsg("info", tr("这一轮绕了些路（调用工具 ") + st.tools + tr(" 次，") + st.failed + tr(" 次没成功）。") +
                           tr("事情办完以后点「总结」，可以整理出最后的做法和踩过的坑，顺便提议存成技能。"));
                }
            }
        });
    }

    // ---- 压缩：把发给模型的上下文换成一份交接说明 ----
    // auto：发消息前发现太长自动触发；then：压完（或失败）后接着做的事。用户点「停止」就不再接着做。
    function compactConversation(auto, then) {
        if (busy) { return; }
        if (messages.length <= 3) {
            if (then) { then(); } else { addMsg("info", tr("对话还很短，不需要压缩。")); }
            return;
        }
        if (needApiKey()) { return; }
        var before = Session.size(messages);
        addMsg("info", (auto ? tr("上下文已经有 ") + before + tr(" 字，先自动压缩一下……") : tr("正在压缩对话……")));
        busy = true;
        var myId = ++turnSeq;
        var req = Session.compactRequest(systemPrompt(), messages, Object.keys(loadedSkills));
        turn = Agent.ask(cfg, req, function (r) {
            if (myId !== turnSeq) { return; }
            busy = false;
            turn = null;
            if (r.aborted) { addMsg("info", tr("已中止。")); return; }
            if (r.error) {
                addMsg("error", tr("压缩失败：") + r.error + (then ? tr("。先不压缩，接着发。") : ""));
            } else {
                messages = Session.compactedMessages(systemPrompt(), r.text);
                var after = Session.size(messages);
                addMsg("info", tr("已压缩：") + before + tr(" 字 → ") + after + tr(" 字。模型之后只看得到这份交接说明（上面的对话记录还在，完整记录也照常保存）：\n\n") + r.text);
                if (!sessionLog) { sessionLog = Session.newLog(scoreTitle()); }
                sessionLog.compactions.push({ time: new Date().toISOString(), before: before, after: after, auto: !!auto, summary: r.text });
                saveLog();
            }
            if (then) { then(); }
        }, { maxTokens: 4096 });
    }

    // ---- 总结：复盘这次对话，并提议可以存成技能的操作 ----
    function summarizeSession() {
        if (busy) { return; }
        if (!sessionLog || !sessionLog.turns.some(function (t) { return t.kind === "chat"; })) {
            addMsg("info", tr("这次对话还没有和 AI 的往来，没什么可总结的。"));
            return;
        }
        if (needApiKey()) { return; }
        addMsg("info", tr("正在复盘这次对话（") + sessionLog.turns.length + tr(" 轮）……"));
        busy = true;
        var myId = ++turnSeq;
        var req = Session.summaryRequest(systemPrompt(), sessionLog);
        turn = Agent.ask(cfg, req, function (r) {
            if (myId !== turnSeq) { return; }
            busy = false;
            turn = null;
            if (r.aborted) { addMsg("info", tr("已中止。")); return; }
            if (r.error) { addMsg("error", tr("总结失败：") + r.error); return; }
            var parsed = Session.parseSummary(r.text);
            addMsg("assistant", parsed.summary + (r.truncated ? tr("\n\n（回复太长被截断了，提议可能不完整）") : ""));
            var list = proposals.slice();
            parsed.proposals.forEach(function (p) {
                list.push(p);
                addMsg("proposal", Session.proposalText(p), list.length - 1);
            });
            proposals = list;
            if (cfg.keepLogs !== false) {
                var rel = logRel(tr("-总结.md"));
                if (writeFile(rel, Session.summaryMarkdown(sessionLog, parsed.summary, parsed.proposals))) {
                    sessionLog.summaries.push({ time: new Date().toISOString(), file: rel, proposals: parsed.proposals.length });
                    saveLog();
                    addMsg("info", tr("复盘已保存：") + localPath(rel) + (parsed.proposals.length ? tr("。提议的技能还没保存，点卡片上的按钮打开编辑器看看。") : ""));
                }
            }
        }, { maxTokens: 8192 });
    }

    function sendMessage() {
        var text = input.text.trim();
        if (!text || busy) { return; }
        if (text[0] === "/") {
            input.text = "";
            handleSlash(text);
            return;
        }
        if (startTurn(text, text)) { input.text = ""; }
    }

    // /名称 [指令]
    function handleSlash(text) {
        var m = /^\/(\S+)\s*([\s\S]*)$/.exec(text);
        if (!m) { page = "skills"; return; }
        var sk = Skills.resolve(skills, m[1]);
        if (!sk) {
            var cands = Skills.searchDetailed(skills, m[1]).slice(0, 5);
            if (cands.length) {
                addMsg("info", tr("没有叫 /") + m[1] + tr(" 的技能，是不是想找：\n") +
                       cands.map(function (r) { return "/" + r.skill.name + "  " + skDesc(r.skill); }).join("\n"));
            } else {
                addMsg("error", tr("没有找到和 /") + m[1] + tr(" 相关的技能。可以到技能页搜索，或者直接问 AI。"));
            }
            input.text = text;
            input.cursorPosition = input.length;
            return;
        }
        var args = m[2].trim();
        if (!args && Skills.runnable(sk)) {
            addMsg("user", text);
            runSkillFromUi(sk);
            return;
        }
        activateSkill(sk);
        var content = tr("[我用 /") + sk.name + tr(" 调用了技能，下面是它的说明]\n") + skillLoadText(sk) +
                      tr("\n\n[我的指令]\n") + (args || tr("按技能说明执行。"));
        startTurn(text, content);
    }

    function continueTurn() {
        startTurn(tr("继续"), tr("继续。接着把刚才没做完的部分做完；如果卡住了，换一种方法，或者直接告诉我原因。"));
    }

    function stopTurn() {
        if (turn) { turn.abort(); }
    }

    function undoLastTurn() {
        var n = lastTurnSteps;
        if (n <= 0) { addMsg("info", tr("上一轮没有改谱。")); return; }
        var api = makeApi();
        var done = 0;
        for (var i = 0; i < n; i++) {
            var before = ScoreIO.scoreHash(api);
            root.cmd("undo");
            var after = ScoreIO.scoreHash(api);
            if (before === after && before !== "skip") { break; }
            done++;
        }
        lastTurnSteps = 0;
        refreshSelection();
        if (done > 0 && sessionLog) {
            Session.markUndone(sessionLog);
            saveLog();
        }
        if (done === 0) {
            addMsg("error", tr("撤销没有生效。请在乐谱窗口里按 Ctrl+Z 撤销 ") + n + tr(" 步。"));
        } else if (done < n) {
            addMsg("info", tr("撤销了 ") + done + tr(" 步，后面的步骤没有可撤销的修改。"));
        } else {
            addMsg("info", tr("已撤销上一轮的 ") + done + tr(" 步修改。"));
        }
    }

    // =====================================================================
    //  生命周期
    // =====================================================================

    // 贴到 MuseScore 主窗口底部，宽度跟主窗口一样（留 8 px 边）。
    // 插件引擎的根上下文里有 ui（主程序的 UiEngine），ui.rootItem 是主窗口的根 Item。
    function snapToBottom() {
        try {
            var r = ui.rootItem;
            if (!r || !r.width) { return false; }
            var g = r.mapToGlobal(0, 0);
            var margin = 8;
            // 不改宽度：按现在的宽度在主窗口底部居中；比主窗口还宽才缩到主窗口的宽度
            if (win.width > r.width - 2 * margin) { win.width = Math.max(win.minimumWidth, r.width - 2 * margin); }
            win.x = Math.round(g.x + (r.width - win.width) / 2);
            win.y = Math.round(g.y + r.height - win.height - margin);
            return true;
        } catch (e) {
            return false;
        }
    }

    function showWindow() {
        if (!placed) { placed = snapToBottom(); }
        win.show();
        win.raise();
        win.requestActivate();
        refreshSelection();
    }

    onRun: {
        // 已经有一个窗口开着（或被关掉藏起来了），就把它叫出来，不再开新的
        var prev = Instance.plugin;
        if (prev && prev !== root) {
            try { prev.showWindow(); return; } catch (e) { }
        }
        Instance.plugin = root;
        loadConfig();
        syncSettingsFields();
        initFolderScan();
        loadSkills();
        loadApiDocs();
        refreshSelection();
        resetConversation();
        if (!cfg.apiKey) {
            page = "settings";
            addMsg("info", tr("还没有 API key。在「设置」里填好保存后就可以开始。"));
        }
        showWindow();
    }

    // =====================================================================
    //  界面
    // =====================================================================

    // ---- 圆角扁平控件：Basic 样式允许自定义 background / indicator ----
    component FlatButton: Button {
        id: fbtn
        implicitHeight: 26
        leftPadding: 10
        rightPadding: 10
        hoverEnabled: true
        background: Rectangle {
            radius: 6
            color: !fbtn.enabled ? "#2d2d30"
                   : fbtn.highlighted ? (fbtn.down ? "#0b4f7d" : (fbtn.hovered ? cPrimaryHi : cPrimary))
                                      : (fbtn.down ? "#2f3237" : (fbtn.hovered ? cBtnHi : cBtn))
        }
        contentItem: Text {
            text: fbtn.text
            color: fbtn.enabled ? "#ffffff" : cDim
            font.pixelSize: 12
            horizontalAlignment: Text.AlignHCenter
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
        }
    }

    component FlatCheck: CheckBox {
        id: fchk
        spacing: 6
        indicator: Rectangle {
            implicitWidth: 16
            implicitHeight: 16
            radius: 4
            x: fchk.leftPadding
            y: (fchk.height - height) / 2
            color: fchk.checked ? cPrimary : "transparent"
            border.color: fchk.checked ? cPrimary : "#6b6f76"
            border.width: 1
            Text {
                anchors.centerIn: parent
                visible: fchk.checked
                text: "✓"; color: "#ffffff"; font.pixelSize: 11; font.bold: true
            }
        }
    }

    Window {
        id: win
        title: tr("AI 助手")
        width: 1180
        height: 320
        minimumWidth: 720
        minimumHeight: 220
        visible: false
        color: cBg
        // Basic 样式的下拉框、数字框、滚动条、输入区、提示框都按这套调色板画
        palette {
            window: cBg; windowText: cText; base: cBg; alternateBase: cPanel; text: cText
            button: cBtn; buttonText: "#ffffff"; highlight: cPrimary; highlightedText: "#ffffff"
            mid: cLine; dark: "#161616"; light: cLine; placeholderText: cDim
            toolTipBase: cPanel; toolTipText: cText
        }
        // 标题栏、最小化、最大化、关闭按钮要明确写上：在 Windows 上，flags 只要不是单纯的 Qt.Window，
        // Qt 就不会自动加标题栏，窗口会变成只能拉伸、不能拖动。
        // 置顶只在 MuseScore 是当前应用时生效：切到别的应用就取消置顶，切回 MuseScore 再恢复。
        flags: Qt.Window | Qt.WindowTitleHint | Qt.WindowSystemMenuHint
               | Qt.WindowMinimizeButtonHint | Qt.WindowMaximizeButtonHint | Qt.WindowCloseButtonHint
               | ((pinned && Qt.application.state === Qt.ApplicationActive) ? Qt.WindowStaysOnTopHint : 0)

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 10
            spacing: 8

            // ---- 顶栏：空白处可以按住拖动窗口 ----
            Item {
                Layout.fillWidth: true
                implicitHeight: headerRow.implicitHeight

                MouseArea {
                    anchors.fill: parent
                    property bool manualDrag: false
                    property real lastX: 0
                    property real lastY: 0
                    onPressed: function (mouse) {
                        // 优先交给系统拖动；不支持时自己算位移
                        try { manualDrag = !win.startSystemMove(); } catch (e) { manualDrag = true; }
                        lastX = mouse.x;
                        lastY = mouse.y;
                    }
                    onPositionChanged: function (mouse) {
                        if (!manualDrag) { return; }
                        win.x += mouse.x - lastX;
                        win.y += mouse.y - lastY;
                    }
                    onReleased: manualDrag = false
                }

                RowLayout {
                    id: headerRow
                    anchors.fill: parent
                    spacing: 4
                    Label { text: tr("AI 助手"); color: cText; font.pixelSize: 16; font.bold: true }
                    Label { text: busy ? tr("● 思考中…") : ""; color: cAccent; font.pixelSize: 12 }
                    Label {
                        visible: cfg.bridge === true
                        text: bridgeBusy ? tr("桥 ●") : tr("桥 ○")
                        color: cAccent
                        font.pixelSize: 12
                        ToolTip.visible: bridgeHover.hovered
                        ToolTip.delay: 600
                        ToolTip.text: tr("本地桥已打开：会执行 bridge/job.json 里的任务。在「设置」里关")
                        HoverHandler { id: bridgeHover }
                    }
                    Item { Layout.fillWidth: true }
                    FlatButton { text: tr("对话"); highlighted: page === "chat"; onClicked: page = "chat" }
                    FlatButton {
                        text: tr("技能 ") + skills.length
                        highlighted: page === "skills" || page === "editor"
                        onClicked: { deleteArmed = ""; page = "skills"; }
                    }
                    FlatButton { text: tr("设置"); highlighted: page === "settings"; onClicked: { syncSettingsFields(); page = "settings"; } }
                    FlatButton { text: tr("贴底"); onClicked: snapToBottom() }
                    FlatButton {
                        text: pinned ? tr("置顶 ✓") : tr("置顶")
                        onClicked: { pinned = !pinned; win.show(); }
                        ToolTip.visible: hovered
                        ToolTip.delay: 600
                        ToolTip.text: pinned ? tr("现在浮在 MuseScore 上面，切到别的应用时不会挡着。点一下取消")
                                             : tr("点一下让窗口浮在 MuseScore 上面，切到别的应用时不会挡着")
                    }
                }
            }

            StackLayout {
                Layout.fillWidth: true
                Layout.fillHeight: true
                currentIndex: ["chat", "skills", "editor", "settings"].indexOf(page)

                // =========================== 对话页 ===========================
                // 横向三栏：左边技能按钮和选区，中间对话，右边输入。整体是贴在谱面底部的一条面板。
                RowLayout {
                    spacing: 10

                    // ---- 左：技能按钮 + 选区 ----
                    ColumnLayout {
                        Layout.fillWidth: false
                        Layout.preferredWidth: 170
                        Layout.fillHeight: true
                        spacing: 6
                        Flow {
                            Layout.fillWidth: true
                            spacing: 6
                            visible: buttonSkills.length > 0
                            Repeater {
                                model: buttonSkills
                                delegate: FlatButton {
                                    text: skButton(modelData)
                                    enabled: !busy
                                    onClicked: runSkillFromUi(modelData)
                                    ToolTip.visible: hovered
                                    ToolTip.delay: 600
                                    ToolTip.text: "/" + modelData.name + tr("：") + skDesc(modelData)
                                }
                            }
                        }
                        Item { Layout.fillHeight: true }
                        Rectangle {
                            Layout.fillWidth: true
                            color: cPanel
                            border.color: cLine
                            radius: 4
                            implicitHeight: selLabel.implicitHeight + 10
                            Label {
                                id: selLabel
                                anchors.fill: parent
                                anchors.margins: 5
                                text: tr("选区：") + selSummary
                                color: cDim
                                font.pixelSize: 11
                                wrapMode: Text.WordWrap
                                maximumLineCount: 4
                                elide: Text.ElideRight
                            }
                        }
                    }

                    // ---- 中：对话 ----
                    Rectangle {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        color: cPanel
                        border.color: cLine
                        radius: 6
                        clip: true

                        ListView {
                            id: chatView
                            anchors.fill: parent
                            anchors.margins: 8
                            model: chatModel
                            spacing: 6
                            clip: true
                            boundsBehavior: Flickable.StopAtBounds
                            ScrollBar.vertical: ScrollBar { }
                            onCountChanged: positionViewAtEnd()

                            delegate: Item {
                                id: row
                                property string mKind: model.kind
                                property string mText: model.text
                                property int mRef: model.ref
                                width: ListView.view.width
                                height: bubble.height

                                Rectangle {
                                    id: bubble
                                    width: Math.min(row.width, Math.max(bubbleText.implicitWidth, draftRow.visible ? draftRow.implicitWidth : 0) + 20)
                                    height: bubbleText.implicitHeight + (draftRow.visible ? draftRow.implicitHeight + 6 : 0) + 14
                                    radius: 6
                                    anchors.right: row.mKind === "user" ? row.right : undefined
                                    anchors.left: row.mKind === "user" ? undefined : row.left
                                    color: row.mKind === "user" ? cUser
                                         : row.mKind === "assistant" ? cAssist
                                         : row.mKind === "tool" ? cTool
                                         : row.mKind === "error" ? cError
                                         : row.mKind === "proposal" ? cIdea
                                         : cInfo

                                    // 提议卡片：打开编辑器看草稿，保存与否由用户决定
                                    Row {
                                        id: draftRow
                                        visible: row.mKind === "proposal"
                                        anchors.left: parent.left
                                        anchors.bottom: parent.bottom
                                        anchors.margins: 7
                                        spacing: 6
                                        FlatButton {
                                            text: tr("打开编辑器，看看再存")
                                            enabled: !busy
                                            onClicked: openDraft(row.mRef)
                                        }
                                    }

                                    TextEdit {
                                        id: bubbleText
                                        anchors.left: parent.left
                                        anchors.right: parent.right
                                        anchors.top: parent.top
                                        anchors.margins: 7
                                        text: row.mKind === "tool" ? "🔧 " + row.mText : row.mText
                                        color: (row.mKind === "tool" || row.mKind === "info") ? cDim : cText
                                        font.pixelSize: row.mKind === "tool" ? 11 : 13
                                        font.family: row.mKind === "tool" ? "Consolas" : Qt.application.font.family
                                        wrapMode: TextEdit.Wrap
                                        readOnly: true
                                        selectByMouse: true
                                        textFormat: TextEdit.PlainText
                                        Keys.onShortcutOverride: function (event) {
                                            if (event.matches(StandardKey.Copy) || event.matches(StandardKey.SelectAll)) {
                                                event.accepted = true;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // ---- 右：输入 ----
                    ColumnLayout {
                        Layout.fillWidth: false
                        Layout.preferredWidth: 340
                        Layout.fillHeight: true
                        spacing: 6
                        // ---- / 技能提示 ----
                        Rectangle {
                            Layout.fillWidth: true
                            visible: suggestions.length > 0
                            color: cPanel
                            border.color: cAccent
                            radius: 4
                            // 最多露出 8 行，更多的滚动查看
                            implicitHeight: Math.min(suggestions.length, 8) * 26 + 8

                            ListView {
                                id: sugCol
                                anchors.fill: parent
                                anchors.margins: 4
                                clip: true
                                boundsBehavior: Flickable.StopAtBounds
                                ScrollBar.vertical: ScrollBar { policy: suggestions.length > 8 ? ScrollBar.AlwaysOn : ScrollBar.AsNeeded }
                                model: suggestions
                                delegate: Rectangle {
                                        width: sugCol.width
                                        height: 26
                                        color: sugMouse.containsMouse ? cAssist : "transparent"
                                        radius: 3
                                        Label {
                                            anchors.verticalCenter: parent.verticalCenter
                                            x: 6
                                            width: parent.width - 12
                                            elide: Text.ElideRight
                                            color: cText
                                            font.pixelSize: 12
                                            text: "/" + modelData.skill.name + (skButton(modelData.skill) ? "  [" + skButton(modelData.skill) + "]" : "") +
                                                  "   " + (modelData.snippet ? modelData.snippet : skDesc(modelData.skill))
                                        }
                                        MouseArea {
                                            id: sugMouse
                                            anchors.fill: parent
                                            hoverEnabled: true
                                            onClicked: applySuggestion(modelData)
                                        }
                                    }
                            }
                        }
                        // ---- 输入 ----
                        Rectangle {
                            Layout.fillWidth: true
                            Layout.fillHeight: true
                            Layout.minimumHeight: 56
                            color: cPanel
                            border.color: input.activeFocus ? cAccent : cLine
                            radius: 6

                            ScrollView {
                                anchors.fill: parent
                                anchors.margins: 2
                                TextArea {
                                    id: input
                                    placeholderText: tr("说点什么，或者输入 / 调用技能。Enter 发送，Shift+Enter 换行")
                                    placeholderTextColor: cDim
                                    wrapMode: TextEdit.Wrap
                                    color: cText
                                    selectByMouse: true
                                    background: null
                                    enabled: !busy
                                    onTextChanged: updateSuggestions()
                                    Keys.onShortcutOverride: function (event) { event.accepted = true; }
                                    Keys.onPressed: function (event) {
                                        if (event.key === Qt.Key_Tab && suggestions.length > 0) {
                                            applySuggestion(suggestions[0]);
                                            event.accepted = true;
                                            return;
                                        }
                                        if ((event.key === Qt.Key_Return || event.key === Qt.Key_Enter) && !(event.modifiers & Qt.ShiftModifier)) {
                                            sendMessage();
                                            event.accepted = true;
                                        }
                                    }
                                }
                            }
                        }
                        Flow {
                            Layout.fillWidth: true
                            spacing: 6
                            FlatButton {
                                text: busy ? tr("停止") : tr("发送")
                                highlighted: !busy
                                onClicked: busy ? stopTurn() : sendMessage()
                            }
                            FlatButton {
                                text: tr("继续")
                                visible: canContinue && !busy
                                onClicked: continueTurn()
                            }
                            FlatButton {
                                text: tr("撤销本轮")
                                enabled: !busy && lastTurnSteps > 0
                                onClicked: undoLastTurn()
                            }
                            FlatButton {
                                text: tr("总结")
                                enabled: !busy
                                onClicked: summarizeSession()
                                ToolTip.visible: hovered
                                ToolTip.delay: 600
                                ToolTip.text: tr("复盘这次对话：最后是怎么做成的、踩了哪些坑，并提议可以存成技能的操作。保存到 logs/")
                            }
                            FlatButton {
                                text: tr("压缩")
                                enabled: !busy && messages.length > 3
                                onClicked: compactConversation(false, null)
                                ToolTip.visible: hovered
                                ToolTip.delay: 600
                                ToolTip.text: tr("把之前的对话浓缩成一份交接说明再接着聊，省 token。太长时发消息前会自动压缩")
                            }
                            FlatButton {
                                text: tr("新对话")
                                enabled: !busy
                                onClicked: resetConversation()
                            }
                        }
                    }
                }

                // =========================== 技能页 ===========================
                ColumnLayout {
                    spacing: 8

                    RowLayout {
                        Layout.fillWidth: true
                        FlatButton { text: tr("新建技能"); highlighted: true; onClicked: openEditor(null) }
                        FlatButton { text: tr("用对话新建"); onClicked: prefillInput(tr("帮我新建一个技能：")) }
                        Item { Layout.fillWidth: true }
                        FlatButton { text: tr("刷新"); onClicked: loadSkills() }
                    }

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 6
                        DarkField {
                            id: skillSearch
                            Layout.fillWidth: true
                            placeholderText: tr("搜索技能：名字、按钮、描述、说明里的词都行，多个词用空格隔开")
                            onTextChanged: skillQuery = text
                        }
                        FlatButton { text: tr("清除"); visible: skillQuery !== ""; onClicked: skillSearch.text = "" }
                    }

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 6
                        DarkField {
                            id: installUrl
                            Layout.fillWidth: true
                            placeholderText: tr("从网址安装：粘贴 SKILL.md、技能文件夹或 gist 的链接")
                            onAccepted: installFromUrl(text)
                        }
                        FlatButton {
                            text: installing ? tr("获取中…") : tr("获取")
                            enabled: !installing && installUrl.text.trim() !== ""
                            onClicked: installFromUrl(installUrl.text)
                        }
                    }

                    Label {
                        Layout.fillWidth: true
                        visible: installNote !== ""
                        text: installNote
                        color: /^获取失败|^这不是/.test(installNote) ? "#ff8a80" : cDim
                        font.pixelSize: 11
                        wrapMode: Text.Wrap
                    }

                    Label {
                        Layout.fillWidth: true
                        visible: skillQuery.trim() !== ""
                        color: cDim
                        font.pixelSize: 11
                        wrapMode: Text.Wrap
                        text: skillResults.length === 0 ? tr("没有找到。换个说法试试，或者让 AI 帮你找。")
                              : skillResults[0].fuzzy ? tr("没有完全匹配，下面是相近的 ") + skillResults.length + tr(" 个：")
                              : tr("找到 ") + skillResults.length + tr(" 个：")
                    }

                    FlatButton {
                        visible: skillQuery.trim() !== "" && (skillResults.length === 0 || skillResults[0].fuzzy)
                        text: tr("让 AI 帮我找「") + skillQuery.trim() + tr("」")
                        enabled: !busy
                        onClicked: askAiToFindSkill(skillQuery.trim())
                    }

                    Label {
                        Layout.fillWidth: true
                        visible: skillQuery === ""
                        wrapMode: Text.Wrap
                        color: cDim
                        font.pixelSize: 11
                        text: tr("技能文件夹：") + localPath("skills") +
                              tr("\n下载来的技能文件夹（里面有 SKILL.md）直接放进去就行。对话里输入 / 可以搜索和调用技能。") +
                              (folderScan ? "" : tr("\n这个 MuseScore 不支持扫描文件夹：手动放进来的技能，要把文件夹名加进 skills/index.json。"))
                    }

                    Label {
                        Layout.fillWidth: true
                        visible: skillProblems.length > 0
                        wrapMode: Text.Wrap
                        color: "#e8a0a0"
                        font.pixelSize: 11
                        text: tr("有问题的技能文件：\n") + skillProblems.join("\n")
                    }

                    Label {
                        Layout.fillWidth: true
                        visible: skills.length === 0
                        color: cDim
                        text: tr("还没有技能。点「新建技能」，或者在对话里让 AI 把刚做过的操作存成技能。")
                        wrapMode: Text.Wrap
                    }

                    ListView {
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        clip: true
                        spacing: 6
                        model: skillResults
                        ScrollBar.vertical: ScrollBar { }

                        delegate: Rectangle {
                            id: card
                            property var sk: modelData.skill
                            property string snip: modelData.snippet
                            width: ListView.view.width
                            height: skCol.implicitHeight + 16
                            color: cPanel
                            border.color: cLine
                            radius: 6

                            ColumnLayout {
                                id: skCol
                                anchors.left: parent.left
                                anchors.right: parent.right
                                anchors.top: parent.top
                                anchors.margins: 8
                                spacing: 4

                                RowLayout {
                                    Layout.fillWidth: true
                                    Label { text: "/" + card.sk.name; color: cText; font.bold: true }
                                    Label {
                                        Layout.fillWidth: true
                                        elide: Text.ElideRight
                                        color: cDim
                                        font.pixelSize: 11
                                        text: (skButton(card.sk) ? tr("按钮「") + skButton(card.sk) + tr("」 · ") : "") +
                                              (card.sk.kind === "folder" ? tr("文件夹") : tr("单文件")) +
                                              (card.sk.lib ? tr(" · 函数库") : "") +
                                              (card.sk.requires && card.sk.requires.length ? tr(" · 依赖 ") + card.sk.requires.join(", ") : "") +
                                              (Skills.runnable(card.sk) ? tr(" · 可直接运行") : "")
                                    }
                                }
                                Label {
                                    Layout.fillWidth: true
                                    text: skDesc(card.sk)
                                    color: cDim
                                    wrapMode: Text.Wrap
                                    font.pixelSize: 12
                                }
                                Label {
                                    Layout.fillWidth: true
                                    visible: card.snip !== ""
                                    text: tr("匹配处：") + card.snip
                                    color: cAccent
                                    wrapMode: Text.Wrap
                                    font.pixelSize: 11
                                }
                                RowLayout {
                                    Layout.fillWidth: true
                                    FlatButton {
                                        text: tr("运行")
                                        visible: Skills.runnable(card.sk)
                                        enabled: !busy
                                        onClicked: { page = "chat"; addMsg("user", "/" + card.sk.name); runSkillFromUi(card.sk); }
                                    }
                                    FlatButton {
                                        text: tr("交给 AI")
                                        enabled: !busy
                                        onClicked: prefillInput("/" + card.sk.name + " ")
                                    }
                                    FlatButton { text: tr("编辑"); onClicked: openEditor(card.sk) }
                                    FlatButton {
                                        text: deleteArmed === card.sk.path ? tr("确认删除") : tr("删除")
                                        onClicked: {
                                            if (deleteArmed === card.sk.path) { deleteArmed = ""; deleteSkill(card.sk); }
                                            else { deleteArmed = card.sk.path; }
                                        }
                                    }
                                    Item { Layout.fillWidth: true }
                                }
                            }
                        }
                    }
                }

                // =========================== 编辑页 ===========================
                ScrollView {
                    id: editorScroll
                    clip: true
                    contentWidth: availableWidth

                    ColumnLayout {
                        width: editorScroll.availableWidth
                        spacing: 6

                        Label {
                            text: editingSkill ? tr("编辑技能") : tr("新建技能")
                            color: cText
                            font.bold: true
                            font.pixelSize: 14
                        }

                        Label { text: tr("名称：小写字母、数字、连字符，例如 strum-pattern。对话里用 /名称 调用"); color: cDim; font.pixelSize: 11; wrapMode: Text.Wrap; Layout.fillWidth: true }
                        DarkField { id: edName; Layout.fillWidth: true; placeholderText: "my-skill" }

                        Label { text: tr("描述：做什么、什么时候用。模型靠它判断要不要用这个技能"); color: cDim; font.pixelSize: 11; wrapMode: Text.Wrap; Layout.fillWidth: true }
                        DarkField { id: edDesc; Layout.fillWidth: true; placeholderText: tr("把选区里的和弦改成 x 符头，用来表示闷音") }

                        RowLayout {
                            Layout.fillWidth: true
                            spacing: 8
                            ColumnLayout {
                                Layout.fillWidth: true
                                Label { text: tr("按钮文字（可选）"); color: cDim; font.pixelSize: 11 }
                                DarkField { id: edButton; Layout.fillWidth: true; placeholderText: tr("x 闷音") }
                            }
                            ColumnLayout {
                                Layout.fillWidth: true
                                Label { text: tr("动作代码（可选）"); color: cDim; font.pixelSize: 11 }
                                DarkField { id: edCmd; Layout.fillWidth: true; placeholderText: "pad-note-8" }
                            }
                        }

                        Label { text: tr("依赖的技能（可选）：写技能名，空格隔开。运行前会先载入它们的函数库"); color: cDim; font.pixelSize: 11; wrapMode: Text.Wrap; Layout.fillWidth: true }
                        DarkField { id: edRequires; Layout.fillWidth: true; placeholderText: "arrange-tools" }

                        Label { text: tr("使用说明（Markdown）：给模型看的步骤、注意事项、示例"); color: cDim; font.pixelSize: 11; wrapMode: Text.Wrap; Layout.fillWidth: true }
                        TextBox { id: edInstr; Layout.fillWidth: true; Layout.preferredHeight: 150 }

                        Label { text: tr("直接运行的脚本（可选）：点按钮或输入 /名称 时执行，作用于当前选区。可以用 h、curScore 等，可以 return 一句话"); color: cDim; font.pixelSize: 11; wrapMode: Text.Wrap; Layout.fillWidth: true }
                        TextBox { id: edRun; mono: true; Layout.fillWidth: true; Layout.preferredHeight: 150 }

                        Label { text: tr("函数库（可选）：只写函数定义。模型加载技能后，可以在自己的脚本里调用这些函数"); color: cDim; font.pixelSize: 11; wrapMode: Text.Wrap; Layout.fillWidth: true }
                        TextBox { id: edLib; mono: true; Layout.fillWidth: true; Layout.preferredHeight: 120 }

                        Label {
                            Layout.fillWidth: true
                            visible: editorNote !== ""
                            text: editorNote
                            color: /^(试运行结果：(OK|已执行)|这是 AI|这是从网上)/.test(editorNote) ? cDim : "#ff8a80"
                            textFormat: Text.PlainText
                            wrapMode: Text.Wrap
                        }

                        RowLayout {
                            FlatButton { text: tr("保存"); highlighted: true; onClicked: saveEditor() }
                            FlatButton {
                                text: tr("试运行")
                                enabled: !busy && (edRun.text.trim() !== "" || edCmd.text.trim() !== "")
                                onClicked: tryEditor()
                            }
                            FlatButton { text: tr("取消"); onClicked: page = "skills" }
                        }
                    }
                }

                // =========================== 设置页 ===========================
                ScrollView {
                    id: settingsScroll
                    clip: true
                    contentWidth: availableWidth

                  ColumnLayout {
                    width: settingsScroll.availableWidth
                    spacing: 8

                    Label { text: tr("DeepSeek 设置"); color: cText; font.bold: true; font.pixelSize: 14 }

                    GridLayout {
                        Layout.fillWidth: true
                        columns: 2
                        columnSpacing: 8
                        rowSpacing: 6

                        Label { text: "API key"; color: cDim }
                        DarkField { id: apiKeyField; Layout.fillWidth: true; echoMode: TextInput.Password; placeholderText: "sk-…" }

                        Label { text: "Base URL"; color: cDim }
                        DarkField { id: baseUrlField; Layout.fillWidth: true }

                        Label { text: tr("模型"); color: cDim }
                        ComboBox { id: modelBox; Layout.fillWidth: true; model: ["deepseek-flash", "deepseek-v4-pro"] }

                        Label { text: tr("思考强度"); color: cDim }
                        ComboBox { id: effortBox; Layout.fillWidth: true; model: ["none", "low", "high"] }

                        Label { text: tr("语言"); color: cDim }
                        // 只给 English / 中文 两档，"中文"是繁体；config.json 里手写 zh-Hans 仍然生效，只是不在这里列
                        ComboBox {
                            id: langBox
                            Layout.fillWidth: true
                            model: ["English", "中文"]
                            onActivated: function (index) { setLang(index === 0 ? "en" : "zh-Hant"); }
                        }

                        Label { text: tr("每轮最多调用工具"); color: cDim }
                        SpinBox { id: iterBox; from: 4; to: 60; value: 15 }

                        Label { text: tr("自动压缩（万字）"); color: cDim }
                        RowLayout {
                            SpinBox { id: compactBox; from: 0; to: 50; value: 8 }
                            Label {
                                Layout.fillWidth: true
                                text: compactBox.value === 0 ? tr("关闭") : tr("上下文超过 ") + compactBox.value + tr(" 万字时，发消息前先压缩")
                                color: cDim
                                font.pixelSize: 11
                                wrapMode: Text.Wrap
                            }
                        }

                        Label { text: "GitHub token"; color: cDim }
                        DarkField { id: githubTokenField; Layout.fillWidth: true; echoMode: TextInput.Password; placeholderText: tr("可选。github_pat_…") }

                        Label { text: tr("代码搜索仓库"); color: cDim }
                        DarkField { id: searchRepoField; Layout.fillWidth: true; placeholderText: "musescore/MuseScore" }

                        Label { text: tr("对话记录"); color: cDim }
                        FlatCheck {
                            id: keepLogsBox
                            checked: true
                            text: tr("每轮结束后保存到 logs/")
                            contentItem: Text {
                                text: keepLogsBox.text
                                color: cText
                                leftPadding: keepLogsBox.indicator.width + keepLogsBox.spacing
                                verticalAlignment: Text.AlignVCenter
                            }
                        }

                        Label { text: tr("本地桥"); color: cDim }
                        FlatCheck {
                            id: bridgeBox
                            checked: false
                            enabled: false   // 只显示状态；开关要手动改 config.json 里的 bridge，再点「重新读取 config.json」
                            text: checked ? tr("已打开（config.json 里把 bridge 改成 false 可关闭）")
                                          : tr("关闭。要打开：config.json 里加 \"bridge\": true，再点「重新读取 config.json」")
                            contentItem: Text {
                                text: bridgeBox.text
                                color: cText
                                leftPadding: bridgeBox.indicator.width + bridgeBox.spacing
                                verticalAlignment: Text.AlignVCenter
                            }
                        }
                    }

                    RowLayout {
                        FlatButton { text: tr("保存"); highlighted: true; onClicked: { saveConfig(); page = "chat"; } }
                        FlatButton { text: tr("取消"); onClicked: page = "chat" }
                    }

                    Label {
                        Layout.fillWidth: true
                        wrapMode: Text.Wrap
                        color: cDim
                        font.pixelSize: 11
                        text: tr("设置保存在 ") + localPath("config.json") + tr("。这个文件夹在 OneDrive 里的话，key 会以明文同步到云端。分享插件时不要带上这个文件。") +
                              tr("\n对话记录和复盘在 ") + localPath("logs") + tr("（不含 API key 和 token）。") +
                              tr("\n\nGitHub token 是可选的，有两个用处：让 AI 搜 MuseScore 源码（GitHub 的代码搜索必须登录），") +
                              tr("以及从 GitHub 安装技能时不受匿名每小时 60 次的限制。") +
                              tr("在 GitHub 的 Settings → Developer settings → Fine-grained tokens 新建一个，") +
                              tr("Repository access 选「Public repositories」，不用勾任何权限。只读、只能看公开仓库，泄露了也改不了你的东西。") +
                              tr("\n代码搜索只搜仓库的默认分支。MuseScore 官方仓库的默认分支是开发中的新版本；") +
                              tr("想搜 4.6.3，要把 4.6.3 的源码推到你自己的一个新仓库（不能是 fork，fork 不会被索引），填在上面。") +
                              tr("\n\n当前：MuseScore ") + (mscoreVersionString() || "?") +
                              tr("，接口清单 ") + (apiDocs ? apiDocs.version + tr("（") + apiDocs.entries.length + tr(" 条）") : tr("没有")) +
                              tr("，读源码用 ") + sourceCfg().sourceRef + tr("。") +
                              tr("\n\n本地桥打开后，插件每半秒读一次 ") + localPath(Bridge.JOB_FILE) + tr("，执行里面的工具调用（和 AI 用的同一套工具），") +
                              tr("结果写到 bridge/result.json，对话里也会显示一条。只读插件自己文件夹里的文件，用完可以关掉。用法见 dev/tools/bridge_client.py。")
                    }

                    RowLayout {
                        FlatButton {
                            text: tr("打开记录文件夹")
                            onClicked: Qt.openUrlExternally(Qt.resolvedUrl("logs/"))
                        }
                        FlatButton {
                            text: tr("重新读取 config.json")
                            onClicked: {
                                var bridgeWas = cfg.bridge === true;
                                loadConfig();
                                syncSettingsFields();
                                if ((cfg.bridge === true) !== bridgeWas) {
                                    bridgeState(cfg.bridge === true);
                                    addMsg("info", cfg.bridge === true
                                           ? tr("本地桥已打开。任务文件：") + localPath(Bridge.JOB_FILE) + tr("。执行过的任务会显示在这里，Ctrl+Z 可撤销。")
                                           : tr("本地桥已关闭。"));
                                } else {
                                    addMsg("info", tr("已重新读取 config.json。"));
                                }
                            }
                        }
                    }
                  }
                }
            }
        }
    }
}
