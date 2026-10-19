.import "i18n.js" as I18n
// 本地桥：让这台电脑上的其他程序（比如 Claude Code）通过文件把工具调用交给插件执行，MuseScore 里实时看到结果。
// 协议（都在插件目录的 bridge/ 里）：
//   对方把 {id, tool, args} 写进 job.json → 插件读到后先删掉它，再执行，把 {id, tool, ok, text, undoSteps, ts} 写进 result.json。
//   插件每 5 秒把 {on, ts, score, selection, version, busy} 写进 state.json，对方用它判断桥开没开。
// 这里只有纯函数；文件读写和执行在 AIAssistant.qml 的 bridgeTick() 里，执行走的是和模型一样的 execTool()。
.pragma library

// 显示给用户的文字过字典（core/i18n.js）；语言由 QML 设定
function T(s) { return I18n.tr(s); }

var JOB_FILE = "bridge/job.json";
var RESULT_FILE = "bridge/result.json";
var STATE_FILE = "bridge/state.json";

// 允许的工具：和模型能用的一样，再加 ping。save_skill 不开放，本地程序自己写文件就行。
var TOOLS = ["ping", "get_score_info", "read_score", "select_range", "run_script", "cmd", "inspect_api",
             "search_api_docs", "fetch_source", "search_source", "load_skill", "run_skill", "search_skills"];

function parseJob(text) {
    var o;
    try { o = JSON.parse(text); } catch (e) { return { ok: false, error: T("job.json 不是合法 JSON：") + e }; }
    if (!o || typeof o !== "object") { return { ok: false, error: T("job.json 应当是一个对象 {id, tool, args}") }; }
    var tool = String(o.tool || "");
    if (TOOLS.indexOf(tool) < 0) {
        return { ok: false, error: T("不认识的工具 ") + JSON.stringify(tool) + T("。可用：") + TOOLS.join(", ") };
    }
    var args = (o.args && typeof o.args === "object") ? o.args : {};
    return { ok: true, job: { id: String(o.id || ""), tool: tool, args: args } };
}

function formatResult(job, text, undoSteps) {
    text = String(text);
    return JSON.stringify({
        id: job ? job.id : "",
        tool: job ? job.tool : "",
        ok: !/^ERROR/.test(text),
        text: text,
        undoSteps: undoSteps || 0,
        ts: Date.now()
    }, null, 1);
}

function formatState(on, info) {
    info = info || {};
    return JSON.stringify({
        on: !!on,
        ts: Date.now(),
        score: info.score || "",
        selection: info.selection || "",
        version: info.version || "",
        busy: !!info.busy
    }, null, 1);
}

// 对话里显示用的一句话
function describe(job) {
    var a = job.args || {};
    if (job.tool === "run_script") { return T("run_script（") + String(a.code || "").length + T(" 字）"); }
    if (job.tool === "run_skill" || job.tool === "load_skill") { return job.tool + " " + (a.name || ""); }
    if (job.tool === "cmd") { return "cmd " + (a.code || ""); }
    return job.tool;
}

function short(text, n) {
    text = String(text);
    n = n || 400;
    return text.length > n ? text.substring(0, n) + T("…（共 ") + text.length + T(" 字，完整结果在 bridge/result.json）") : text;
}
