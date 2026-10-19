.import "i18n.js" as I18n
// 对话记录、复盘总结、对话压缩。只处理数据和文本，不碰谱面，也不联网：
// QML 侧负责把请求发出去、把结果写进 logs/。
//
// 记录（log）：每次「新对话」开一份，记下每一轮用户说了什么、调用了哪些工具、结果如何、最后回复了什么。
//   自动保存成 logs/<id>.json，不花 token。
// 总结：把记录交给模型复盘——最后是怎么做成的、踩了哪些坑——并提议可以存成技能的操作。
// 压缩：对话太长时，把发给模型的上下文换成一份交接说明，接着聊。记录本身不受影响。
.pragma library

// 显示给用户的文字过字典（core/i18n.js）；语言由 QML 设定
function T(s) { return I18n.tr(s); }

var LIMITS = {
    code: 6000,          // 记录里每段脚本最多存多少字
    result: 1500,        // 每个工具结果最多存多少字
    reply: 3000,
    transcript: 40000    // 交给模型的文本最多多少字
};

function clip(s, n) {
    s = (s === undefined || s === null) ? "" : String(s);
    return s.length > n ? s.substring(0, n) + T(" …(截断，共 ") + s.length + T(" 字)") : s;
}

function pad2(n) { return (n < 10 ? "0" : "") + n; }

function stamp(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + "_" +
           pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
}

function clock(d) { return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }

// ---------------------------------------------------------------- 记录

function newLog(scoreTitle, now) {
    now = now || new Date();
    return { version: 1, id: stamp(now), started: now.toISOString(), score: String(scoreTitle || ""), turns: [], compactions: [], summaries: [] };
}

// kind: chat（发给模型的一轮）| button（按钮、/名称直接运行、试运行，不经过模型）
function beginTurn(log, kind, prompt, selection, now) {
    now = now || new Date();
    var t = { n: log.turns.length + 1, kind: kind, time: clock(now), prompt: String(prompt || ""), selection: String(selection || ""), tools: [], replies: [], end: null, undone: false };
    log.turns.push(t);
    return t;
}

// 工具结果的效果：error | warning | changed | selection | nochange | ok
function classify(result) {
    var r = String(result || "");
    if (/^ERROR/.test(r)) { return "error"; }
    if (/^WARNING/.test(r)) { return "warning"; }
    if (/谱面已改变|没有检查/.test(r)) { return "changed"; }
    if (/谱面没有变化/.test(r)) { return "nochange"; }
    if (/选区变了|已选中/.test(r)) { return "selection"; }
    return "ok";
}

function addTool(turn, name, args, result) {
    args = args || {};
    var a = {};
    for (var k in args) {
        var v = args[k];
        a[k] = (typeof v === "string") ? clip(v, k === "code" || /script$/.test(k) ? LIMITS.code : 500) : v;
    }
    turn.tools.push({ name: String(name), args: a, result: clip(result, LIMITS.result), status: classify(result) });
}

function addReply(turn, text) {
    if (text) { turn.replies.push(clip(text, LIMITS.reply)); }
}

function endTurn(turn, info) {
    info = info || {};
    turn.end = { note: info.note || "", error: info.error || "", capped: !!info.capped, undoSteps: info.undoSteps || 0 };
}

// 「撤销本轮」：标记最近一轮改过谱的
function markUndone(log) {
    for (var i = log.turns.length - 1; i >= 0; i--) {
        var t = log.turns[i];
        if (t.end && t.end.undoSteps > 0) { t.undone = true; return t; }
    }
    return null;
}

function stats(turn) {
    var s = { tools: turn.tools.length, failed: 0, changed: 0 };
    turn.tools.forEach(function (x) {
        if (x.status === "error" || x.status === "warning" || x.status === "nochange") { s.failed++; }
        if (x.status === "changed") { s.changed++; }
    });
    return s;
}

// 这一轮是不是绕了路：值得提醒用户做个总结
function bumpy(turn) {
    var s = stats(turn);
    return s.failed >= 2 || s.tools >= 6 || !!(turn.end && (turn.end.capped || turn.end.error));
}

var STATUS_MARK = { error: T("✗ 出错"), warning: T("✗ 没效果"), nochange: T("✗ 谱面没变"), changed: T("✓ 改了谱"), selection: T("选区变了"), ok: "" };

function argsText(name, a) {
    if (name === "run_script") { return a.purpose ? T("（") + a.purpose + T("）") : ""; }
    if (name === "cmd") { return " " + (a.code || ""); }
    var parts = [];
    for (var k in a) { parts.push(k + "=" + (typeof a[k] === "string" ? a[k] : JSON.stringify(a[k]))); }
    return parts.length ? " " + parts.join(", ") : "";
}

function indent(text, pre) {
    return String(text).split("\n").map(function (l) { return pre + l; }).join("\n");
}

// 交给模型复盘的文本。改了谱的脚本原样给全，失败的只给开头和报错。
function transcript(log, maxChars) {
    maxChars = maxChars || LIMITS.transcript;
    function render(codeFull, codeShort, resultLen) {
        var out = [T("谱子：") + (log.score || T("（未命名）")) + T("，开始于 ") + log.started, ""];
        log.turns.forEach(function (t) {
            out.push(T("第 %1 轮 [").replace("%1", t.n) + t.time + "]" + (t.kind === "button" ? T("（按钮/直接运行，没经过模型）") : "") + (t.undone ? T("【这一轮的修改后来被用户撤销了】") : ""));
            out.push(T("用户：") + t.prompt);
            if (t.selection) { out.push(T("当时选区：") + t.selection); }
            t.tools.forEach(function (x, i) {
                var mark = STATUS_MARK[x.status] || "";
                out.push("  " + (i + 1) + ". " + x.name + argsText(x.name, x.args) + (mark ? "  → " + mark : ""));
                if (x.args.code && x.name === "run_script") {
                    var good = x.status === "changed" || x.status === "ok";
                    out.push(indent(clip(x.args.code, good ? codeFull : codeShort), "       | "));
                }
                if (x.args.run_script) { out.push(indent(clip(x.args.run_script, codeShort), "       run| ")); }
                out.push(indent(clip(x.result, resultLen), T("       结果: ")));
            });
            t.replies.forEach(function (r) { out.push(T("助手：") + r); });
            if (t.end) {
                var e = [];
                if (t.end.error) { e.push(T("出错：") + t.end.error); }
                if (t.end.capped) { e.push(T("工具调用次数到上限")); }
                if (t.end.note) { e.push(t.end.note); }
                if (t.end.undoSteps) { e.push(T("可撤销步数 ") + t.end.undoSteps); }
                if (e.length) { out.push(T("（") + e.join(T("；")) + T("）")); }
            } else {
                out.push(T("（这一轮还没结束）"));
            }
            out.push("");
        });
        return out.join("\n");
    }
    // 太长就逐级缩短
    var tiers = [[4000, 600, 600], [2000, 300, 300], [1200, 160, 160], [600, 80, 100]];
    var text = "";
    for (var i = 0; i < tiers.length; i++) {
        text = render(tiers[i][0], tiers[i][1], tiers[i][2]);
        if (text.length <= maxChars) { return text; }
    }
    return T("…(前面太长，省略)\n") + text.substring(text.length - maxChars);
}

// ---------------------------------------------------------------- 压缩

// 发给模型的上下文有多大（字数）
function size(messages) {
    var n = 0;
    (messages || []).forEach(function (m) {
        n += String(m.content || "").length;
        (m.tool_calls || []).forEach(function (tc) {
            var f = tc["function"] || {};
            n += String(f.name || "").length + String(f.arguments || "").length;
        });
    });
    return n;
}

function needsCompact(messages, limit) {
    return limit > 0 && (messages || []).length > 3 && size(messages) > limit;
}

// API 对话（不含 system）转成文字，工具结果截短
function messagesTranscript(messages, maxChars) {
    maxChars = maxChars || LIMITS.transcript;
    function render(argLen, resLen) {
        var out = [];
        (messages || []).forEach(function (m, i) {
            if (m.role === "system") { return; }
            if (m.role === "user") { out.push(T("用户：") + clip(m.content, 3000)); }
            else if (m.role === "assistant") {
                if (m.content) { out.push(T("助手：") + clip(m.content, 3000)); }
                (m.tool_calls || []).forEach(function (tc) {
                    var f = tc["function"] || {};
                    out.push(T("  调用 ") + f.name + " " + clip(f.arguments, argLen));
                });
            } else if (m.role === "tool") {
                out.push(indent(clip(m.content, resLen), T("    结果: ")));
            }
        });
        return out.join("\n");
    }
    var tiers = [[3000, 800], [1200, 300], [400, 120]];
    var text = "";
    for (var i = 0; i < tiers.length; i++) {
        text = render(tiers[i][0], tiers[i][1]);
        if (text.length <= maxChars) { return text; }
    }
    return T("…(前面太长，省略)\n") + text.substring(text.length - maxChars);
}

var COMPACT_TASK = [
T("对话太长了，要压缩。请把下面的对话记录写成一份交接说明。之后你只能看到这份说明，看不到原来的对话，所以该留的要写全，用中文，只写事实，不要寒暄："),
T("1. 用户的目标和偏好，包括用户纠正过你的地方；"),
T("2. 已经完成的修改：具体位置（小节、谱表、声部）和用的方法；后来被撤销的不算；"),
T("3. 谱面现在和任务有关的状态；"),
T("4. 管用的做法和踩过的坑：哪些方法不行、为什么；"),
T("5. 还没做完的事和下一步。")
].join("\n");

function compactRequest(systemText, messages, loadedSkillNames) {
    var extra = (loadedSkillNames && loadedSkillNames.length) ? T("\n\n已经加载的技能（函数库在 run_script 里仍然可用）：") + loadedSkillNames.join(", ") : "";
    return [
        { role: "system", content: systemText },
        { role: "user", content: COMPACT_TASK + extra + T("\n\n===== 对话记录 =====\n") + messagesTranscript(messages) }
    ];
}

function compactedMessages(systemText, summary) {
    return [
        { role: "system", content: systemText },
        { role: "user", content: T("[之前的对话太长，已经压缩。下面是交接说明，接下来的对话从这里接着进行]\n") + summary },
        { role: "assistant", content: T("明白，我按这份说明接着做。") }
    ];
}

// ---------------------------------------------------------------- 总结与技能提议

// 用函数而不是顶层常量：顶层常量在载入时就把 T() 求值了，那时语言还没设定
function summaryTask() {
    return [
T("下面是这次对话的完整记录：用户的每句话、每次调用的工具和结果。请用中文写一份复盘，格式如下："),
"",
T("## 目标"),
T("用户想做什么，一两句。"),
"",
T("## 最后是怎么做成的"),
T("按顺序列出真正起作用的操作：用了哪个工具、什么参数；关键脚本原样贴出来。被撤销的轮次不算。没做成就写卡在哪里。"),
"",
T("## 踩过的坑"),
T("哪些尝试失败了、原因、后来怎么绕过去的。一条一句。没有就写「无」。"),
"",
T("## 可以存成技能的"),
T("判断哪些操作以后还会反复用，最多提 3 个，没有值得存的就写「无」。每个技能选一种形式："),
T("- script：步骤固定、不需要看情况判断。写成 run_script（或 cmd 动作代码序列），配按钮一键运行，不花 token。"),
T("- ai：每次情况不同，要看谱子再决定。写 instructions（步骤、判断规则、注意事项），可复用的计算写成 lib_script 函数给模型调用。"),
T("- both：按钮跑默认做法；交给 AI（/名称 加一句话）时按说明灵活调整参数。"),
T("脚本必须能在 run_script 环境里直接运行，只用 system prompt 里列出的 h.* 和 API，优先复用记录里已经跑通的代码。"),
T("不要和已有技能重复；已有技能可以改进的，用同样的名字，并在 why 里说明改了什么。"),
"",
T("最后输出一个 ```json 代码块，格式："),
T("{\"proposals\": [{\"name\": \"小写字母数字连字符\", \"kind\": \"script|ai|both\", \"description\": \"做什么、什么时候用\", \"button\": \"按钮文字，可空\","),
T(" \"instructions\": \"Markdown 说明\", \"run_script\": \"\", \"lib_script\": \"\", \"cmd\": \"\", \"requires\": \"依赖的技能名，空格隔开\", \"why\": \"为什么值得存\"}]}"),
T("没有提议就输出 {\"proposals\": []}。")
].join("\n");
}

function summaryRequest(systemText, log) {
    return [
        { role: "system", content: systemText },
        { role: "user", content: summaryTask() + T("\n\n===== 对话记录 =====\n") + transcript(log) }
    ];
}

var KIND_KEYS = { script: "一键脚本", ai: "AI 技能", both: "脚本 + AI 说明" };
function kindLabel(k) { return KIND_KEYS[k] ? T(KIND_KEYS[k]) : ""; }

function slug(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").substring(0, 64).replace(/-$/, "");
}

function str(v) {
    if (v === undefined || v === null) { return ""; }
    if (Array.isArray(v)) { return v.join(" "); }
    return String(v);
}

function normalizeProposal(p, i) {
    if (!p || typeof p !== "object") { return null; }
    var out = {
        name: slug(p.name) || ("new-skill-" + (i + 1)),
        kind: KIND_KEYS[p.kind] ? p.kind : "",
        description: str(p.description).trim(),
        button: str(p.button).trim(),
        instructions: str(p.instructions),
        run: str(p.run_script || p.run),
        lib: str(p.lib_script || p.lib),
        cmd: str(p.cmd).trim(),
        requires: str(p.requires).trim(),
        why: str(p.why).trim()
    };
    if (!out.description) { return null; }
    if (!out.kind) { out.kind = (out.run.trim() || out.cmd) ? (out.instructions.trim() ? "both" : "script") : "ai"; }
    if (out.button && !out.run.trim() && !out.cmd) { out.button = ""; }   // 没有可直接运行的东西就不能做按钮
    return out;
}

// 模型的回复 → { summary: 去掉 json 块的正文, proposals: [...] }
function parseSummary(text) {
    text = String(text || "");
    var re = /```json\s*([\s\S]*?)```/gi;
    var m;
    var last = null;
    while ((m = re.exec(text)) !== null) { last = m; }
    var body = last ? last[1] : "";
    var summary = last ? (text.substring(0, last.index) + text.substring(last.index + last[0].length)).trim() : text.trim();
    var proposals = [];
    if (body) {
        var obj = null;
        try { obj = JSON.parse(body); } catch (e) {
            var a = body.indexOf("{");
            var b = body.lastIndexOf("}");
            if (a >= 0 && b > a) { try { obj = JSON.parse(body.substring(a, b + 1)); } catch (e2) { obj = null; } }
        }
        var list = obj ? (Array.isArray(obj) ? obj : obj.proposals) : null;
        if (Array.isArray(list)) {
            list.forEach(function (p, i) { var q = normalizeProposal(p, i); if (q) { proposals.push(q); } });
        }
    }
    return { summary: summary.replace(/\n*##\s*可以存成技能的\s*$/, "").trim(), proposals: proposals };
}

function proposalText(p) {
    var lines = [T("💡 提议技能 /") + p.name + T("（") + kindLabel(p.kind) + T("）"), p.description];
    if (p.why) { lines.push(T("理由：") + p.why); }
    var parts = [];
    if (p.button) { parts.push(T("按钮「") + p.button + T("」")); }
    if (p.run.trim()) { parts.push(T("直接运行的脚本 ") + p.run.split("\n").length + T(" 行")); }
    if (p.cmd) { parts.push(T("动作代码 ") + p.cmd); }
    if (p.lib.trim()) { parts.push(T("函数库 ") + p.lib.split("\n").length + T(" 行")); }
    if (p.instructions.trim()) { parts.push(T("使用说明")); }
    if (p.requires) { parts.push(T("依赖 ") + p.requires); }
    if (parts.length) { lines.push(T("包含：") + parts.join(T("，"))); }
    return lines.join("\n");
}

function summaryMarkdown(log, summary, proposals, now) {
    now = now || new Date();
    var out = [T("# 对话复盘 ") + log.id, "", T("- 谱子：") + (log.score || T("（未命名）")), T("- 总结时间：") + now.toISOString(), T("- 轮数：") + log.turns.length, "", summary, ""];
    if (proposals.length) {
        out.push(T("## 提议的技能（草稿，还没保存）"), "");
        proposals.forEach(function (p) {
            out.push("### /" + p.name + T("（") + kindLabel(p.kind) + T("）"), "", p.description, "");
            if (p.why) { out.push(T("理由：") + p.why, ""); }
            if (p.button) { out.push(T("按钮：") + p.button, ""); }
            if (p.cmd) { out.push(T("动作代码：`") + p.cmd + "`", ""); }
            if (p.requires) { out.push(T("依赖：") + p.requires, ""); }
            if (p.instructions.trim()) { out.push(p.instructions.trim(), ""); }
            if (p.run.trim()) { out.push("```js run", p.run.trim(), "```", ""); }
            if (p.lib.trim()) { out.push("```js lib", p.lib.trim(), "```", ""); }
        });
    }
    return out.join("\n");
}
