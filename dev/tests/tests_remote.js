// 接口清单查询、读源码、代码搜索、从网址装技能、联网工具的异步回合

// ---------------------------------------------------------------- 假的 XMLHttpRequest
// XHR_ROUTE(req) 返回 {status, text} 就立刻应答；返回 null 就挂起，之后用 xhrRespond(req, …) 手动应答
var XHR_LOG = [];
var XHR_ROUTE = function () { return { status: 404, text: "" }; };
function XMLHttpRequest() { this.readyState = 0; this.status = 0; this.responseText = ""; this.headers = {}; }
XMLHttpRequest.prototype.open = function (m, u) { this.method = m; this.url = u; this.readyState = 1; };
XMLHttpRequest.prototype.setRequestHeader = function (k, v) { this.headers[k] = v; };
XMLHttpRequest.prototype.send = function (body) {
    this.body = body;
    XHR_LOG.push(this);
    var r = XHR_ROUTE(this);
    if (r) { xhrRespond(this, r.status, r.text); }
};
XMLHttpRequest.prototype.abort = function () {
    if (this.readyState === 4) { return; }
    this.aborted = true;
    xhrRespond(this, 0, "");
};
function xhrRespond(x, status, text) {
    if (x.readyState === 4) { return; }
    x.readyState = 4;
    x.status = status;
    x.responseText = text;
    if (x.onreadystatechange) { x.onreadystatechange(); }
}
function resetXhr(route) { XHR_LOG = []; XHR_ROUTE = route; }

var DOC = null;
function apiDoc() { if (!DOC) { DOC = Docs.parse(readFile("docs/api-4.6.3.json")); } return DOC; }

// ---------------------------------------------------------------- 接口清单
test("docs: 清单能加载，版本对", function () {
    var d = apiDoc();
    eq(d.version, "4.6.3");
    ok(d.entries.length > 1000, "条数 " + d.entries.length);
    eq(JSON.parse(readFile("docs/index.json")), ["4.6.3"]);
});
test("docs: 按中文菜单名找动作代码", function () {
    var r = Docs.searchText(apiDoc(), "拼写");
    ok(r.indexOf("cmd(\"pitch-spell\")") >= 0 && r.indexOf("优化等音拼写") >= 0, r);
    ok(Docs.searchText(apiDoc(), "全选").indexOf("notation-select-all") >= 0);
    ok(Docs.searchText(apiDoc(), "品格图").indexOf("add-fretboard-diagram") >= 0);
});
test("docs: 按接口名找，并给出源码位置", function () {
    var r = Docs.searchText(apiDoc(), "appendPart");
    ok(r.indexOf("[方法] Score.appendPart(QString instrumentId) → void") >= 0, r);
    ok(r.indexOf("[src/engraving/api/v1/score.h:") >= 0, r);
    var k = Docs.searchText(apiDoc(), "actualKey");
    ok(k.indexOf("4.6 起") >= 0 && k.indexOf("（可写）") >= 0, k);
});
test("docs: 4.6.3 里没有 4.7 才加的接口", function () {
    ok(Docs.searchText(apiDoc(), "appendLinkedStaff").indexOf("没有找到") >= 0);
    ok(Docs.searchText(apiDoc(), "replaceInstrument").indexOf("没有找到") >= 0);
});
test("docs: 只写类名列出全部成员；枚举只显示匹配的值", function () {
    var r = Docs.searchText(apiDoc(), "Cursor");
    ok(r.indexOf("[类] class Cursor") >= 0 && r.indexOf("rewindToTick(") >= 0 && r.indexOf("keySignature") >= 0, r);
    var e = Docs.searchText(apiDoc(), "HARMONY");
    ok(/\[枚举\] Element = enum ElementType（\d+ 个值）：HARMONY/.test(e), e);
});
test("docs: 没清单时给出替代办法", function () {
    ok(/^ERROR/.test(Docs.searchText(null, "x")));
});

// ---------------------------------------------------------------- 读源码
var SRC = ["// line 1", "void a() {}", "void transposeSemitone(int step)", "{", "    step = 1;", "}", "// end"].join("\n");

test("source: 路径校验", function () {
    eq(Remote.cleanPath("/src/a.h"), "src/a.h");
    eq(Remote.cleanPath("src\\a.h"), "src/a.h");
    eq(Remote.cleanPath("../etc/passwd"), "");
    eq(Remote.cleanPath("src/../x"), "");
    eq(Remote.cleanPath("https://evil.com/x"), "");
});
test("source: grep 带行号和上下文", function () {
    var r = Remote.formatSource(SRC, "a.cpp @ v4.6.3", { grep: "transposesemitone", around: 1 });
    ok(r.indexOf("a.cpp @ v4.6.3（共 7 行），匹配「transposesemitone」1 处") === 0, r);
    ok(r.indexOf("    2| void a() {}") >= 0 && r.indexOf("    3| void transposeSemitone") >= 0 && r.indexOf("    4| {") >= 0, r);
    ok(r.indexOf("    5|") < 0, "上下文只有 1 行");
    ok(Remote.formatSource(SRC, "a", { grep: "/step\\s*=/" }).indexOf("    5|     step = 1;") >= 0);
    ok(Remote.formatSource(SRC, "a", { grep: "nothing" }).indexOf("没有匹配") >= 0);
});
test("source: 行范围和长文件", function () {
    ok(Remote.formatSource(SRC, "a", { from_line: 3, to_line: 4 }).indexOf("第 3-4 行") >= 0);
    var long = [];
    for (var i = 0; i < 500; i++) { long.push("x" + i); }
    var r = Remote.formatSource(long.join("\n"), "big", {});
    ok(r.indexOf("第 1-120 行") >= 0 && r.indexOf("后面还有 380 行") >= 0, r.slice(0, 80));
});
test("source: fetch_source 按版本下载，第二次走缓存", function () {
    resetXhr(function (x) { return { status: 200, text: SRC }; });
    var got = null;
    Remote.fetchSource({ sourceRef: "v4.6.3" }, { path: "src/x/a.cpp", grep: "step =" }, function (t) { got = t; });
    eq(XHR_LOG[0].url, "https://raw.githubusercontent.com/musescore/MuseScore/v4.6.3/src/x/a.cpp");
    ok(got.indexOf("    5|     step = 1;") >= 0, got);
    Remote.fetchSource({ sourceRef: "v4.6.3" }, { path: "src/x/a.cpp" }, function (t) { got = t; });
    eq(XHR_LOG.length, 1, "缓存");
    resetXhr(function () { return { status: 404, text: "" }; });
    Remote.fetchSource({ sourceRef: "v4.6.3" }, { path: "src/nope.h" }, function (t) { got = t; });
    ok(/^ERROR: v4.6.3 里没有 src\/nope.h/.test(got), got);
});
test("source: 代码搜索没 token 时说明替代办法，有 token 时带上认证", function () {
    var got = null;
    resetXhr(function () { return null; });
    Remote.searchSource({}, "transposeSemitone", function (t) { got = t; });
    ok(/^ERROR: 没有设置 GitHub token/.test(got) && XHR_LOG.length === 0, got);
    resetXhr(function (x) {
        return { status: 200, text: JSON.stringify({ total_count: 1, items: [{ path: "src/engraving/dom/transpose.cpp", text_matches: [{ fragment: "void Score::transposeSemitone(int step)" }] }] }) };
    });
    Remote.searchSource({ githubToken: "tok", githubSearchRepo: "me/ms463", sourceRef: "v4.6.3" }, "transposeSemitone", function (t) { got = t; });
    var x = XHR_LOG[0];
    eq(x.headers["Authorization"], "Bearer tok");
    ok(x.url.indexOf("q=transposeSemitone%20repo%3Ame%2Fms463") >= 0, x.url);
    ok(got.indexOf("- src/engraving/dom/transpose.cpp") >= 0 && got.indexOf("注意") < 0, got);
    resetXhr(function () { return { status: 401, text: "{\"message\":\"Bad credentials\"}" }; });
    Remote.searchSource({ githubToken: "bad" }, "x", function (t) { got = t; });
    ok(got.indexOf("token 无效") >= 0, got);
});

// ---------------------------------------------------------------- 从网址装技能
test("install: 各种链接整理成能下载的形式", function () {
    eq(Remote.skillSource("https://github.com/me/skills/blob/main/mute-x.md"), { kind: "file", url: "https://raw.githubusercontent.com/me/skills/main/mute-x.md" });
    eq(Remote.skillSource("https://github.com/me/skills/tree/main/skills/bass-1-3/"),
       { kind: "folder", api: "https://api.github.com/repos/me/skills/contents/skills/bass-1-3?ref=main" });
    eq(Remote.skillSource("https://gist.github.com/me/abc123"), { kind: "gist", api: "https://api.github.com/gists/abc123" });
    eq(Remote.skillSource("https://example.com/x.md"), { kind: "file", url: "https://example.com/x.md" });
    ok(Remote.skillSource("http://example.com/x.md").error);
    ok(Remote.skillSource("https://github.com/me/skills").error);
});
test("install: 文件夹技能连同 scripts/ 一起下载，存成单文件后能读回来", function () {
    var md = readFile("skills/bass-1-3/SKILL.md");
    var lib = readFile("skills/bass-1-3/scripts/lib.js");
    var run = readFile("skills/bass-1-3/scripts/run.js");
    resetXhr(function (x) {
        var u = x.url;
        if (u === "https://api.github.com/repos/me/s/contents/bass-1-3?ref=main") {
            return { status: 200, text: JSON.stringify([
                { type: "file", name: "SKILL.md", download_url: "https://raw/SKILL.md" },
                { type: "dir", name: "scripts", url: "https://api/scripts" }]) };
        }
        if (u === "https://api/scripts") {
            return { status: 200, text: JSON.stringify([{ name: "lib.js", download_url: "https://raw/lib.js" }, { name: "run.js", download_url: "https://raw/run.js" }]) };
        }
        return { status: 200, text: { "https://raw/SKILL.md": md, "https://raw/lib.js": lib, "https://raw/run.js": run }[u] };
    });
    var got = null;
    Remote.fetchSkill("https://github.com/me/s/tree/main/bass-1-3", "", function (r) { got = r; });
    ok(!got.error, JSON.stringify(got.error));
    eq([got.lib === lib, got.run === run], [true, true]);
    eq(XHR_LOG[0].headers["Authorization"], undefined, "没 token 就匿名");
    // 和插件里 installFromUrl 一样解析，再按单文件格式保存、读回
    var sk = Skills.parse({ kind: "folder", id: "", rel: got.from, dir: "" }, got.text, function (rel) {
        return /scripts\/lib\.js$/.test(rel) ? got.lib : /scripts\/run\.js$/.test(rel) ? got.run : "";
    });
    eq([sk.name, sk.button, sk.requires], ["bass-1-3", "贝斯 1·3拍", ["arrange-tools"]]);
    var plan = Skills.plan({ name: sk.name, description: sk.description, instructions: sk.instructions, lib: sk.lib, run: sk.run,
                             button: sk.button, cmd: sk.cmd, requires: sk.requires }, null);
    eq(plan.path, "skills/bass-1-3.md");
    var back = Skills.parse({ kind: "file", id: "bass-1-3", rel: plan.path, dir: "" }, plan.files[0].text, readFile);
    eq([back.lib.trim() === lib.trim(), back.run.trim() === run.trim()], [true, true]);
});
test("install: gist 和出错的情况", function () {
    resetXhr(function () {
        return { status: 200, text: JSON.stringify({ files: { "SKILL.md": { content: "---\nname: g\ndescription: d\n---\n说明" }, "run.js": { content: "return 1;" } } }) };
    });
    var got = null;
    Remote.fetchSkill("https://gist.github.com/me/abc123", "tok", function (r) { got = r; });
    eq([got.run, XHR_LOG[0].headers["Authorization"]], ["return 1;", "Bearer tok"]);
    resetXhr(function () { return { status: 200, text: "[]" }; });
    Remote.fetchSkill("https://github.com/me/s/tree/main/empty", "", function (r) { got = r; });
    ok(/没有 SKILL\.md/.test(got.error), JSON.stringify(got));
    resetXhr(function () { return { status: 403, text: "{\"message\":\"rate limit\"}" }; });
    Remote.fetchSkill("https://github.com/me/s/tree/main/x", "", function (r) { got = r; });
    ok(got.error.indexOf("60 次") >= 0, got.error);
});

// ---------------------------------------------------------------- 联网工具的异步回合
function modelReply(msg) { return { status: 200, text: JSON.stringify({ choices: [{ message: msg, finish_reason: "stop" }] }) }; }
function toolCall(id, name, args) { return { id: id, type: "function", "function": { name: name, arguments: JSON.stringify(args) } }; }

test("agent: 联网工具等结果回来再继续，结果按顺序回传", function () {
    var turn = 0;
    resetXhr(function (x) {
        if (x.url.indexOf("/chat/completions") < 0) { return null; }
        turn++;
        if (turn === 1) { return modelReply({ content: "", tool_calls: [toolCall("a", "fetch_source", { path: "x" }), toolCall("b", "get_score_info", {})] }); }
        return modelReply({ content: "好了" });
    });
    var waiting = null;
    var execTool = function (name) {
        if (name === "fetch_source") { return { pending: function (cb) { waiting = cb; }, abort: function () { } }; }
        return "INFO";
    };
    var events = [];
    var messages = [{ role: "system", content: "s" }, { role: "user", content: "u" }];
    Agent.runTurn({ apiKey: "k" }, messages, [], execTool, {
        assistant: function (t) { events.push("A:" + t); },
        tool: function (n, a, r) { events.push("T:" + n + "=" + r); },
        error: function (e) { events.push("E:" + e); },
        done: function () { events.push("D"); }
    });
    eq(events, [], "还在等 fetch_source");
    waiting("SRC");
    eq(events, ["T:fetch_source=SRC", "T:get_score_info=INFO", "A:好了", "D"]);
    eq(messages.filter(function (m) { return m.role === "tool"; }).map(function (m) { return [m.tool_call_id, m.content]; }), [["a", "SRC"], ["b", "INFO"]]);
});
test("agent: 等联网工具时中止，补上占位结果，下一轮对话仍然完整", function () {
    resetXhr(function (x) {
        return modelReply({ content: "", tool_calls: [toolCall("a", "fetch_source", { path: "x" }), toolCall("b", "get_score_info", {})] });
    });
    var aborted = false;
    var late = null;
    var execTool = function () { return { pending: function (cb) { late = cb; }, abort: function () { aborted = true; } }; };
    var events = [];
    var messages = [{ role: "system", content: "s" }, { role: "user", content: "u" }];
    var t = Agent.runTurn({ apiKey: "k" }, messages, [], execTool, {
        assistant: function () { }, tool: function (n) { events.push("T:" + n); },
        error: function (e) { events.push("E:" + e); }, done: function (i) { events.push("D:" + (i && i.note)); }
    });
    t.abort();
    eq([aborted, events], [true, ["D:已中止"]]);
    late("迟到的结果");
    t.abort();
    eq(events, ["D:已中止"], "迟到的结果和重复中止都忽略");
    var toolMsgs = messages.filter(function (m) { return m.role === "tool"; });
    eq(toolMsgs.map(function (m) { return m.tool_call_id; }), ["a", "b"]);
    ok(/^ERROR: 用户中止了/.test(toolMsgs[0].content));
});
test("agent: 一条回复里多个工具，每个都真的执行（2026-10-10 真实记录里第二个拿到了第一个的结果）", function () {
    var turn = 0;
    resetXhr(function () {
        turn++;
        if (turn === 1) { return modelReply({ content: "", tool_calls: [toolCall("a", "get_score_info", {}), toolCall("b", "read_score", { scope: "measures" })] }); }
        return modelReply({ content: "好" });
    });
    var calls = [];
    var messages = [{ role: "user", content: "u" }];
    Agent.runTurn({ apiKey: "k" }, messages, [], function (name) { calls.push(name); return "结果:" + name; }, {
        assistant: function () { }, tool: function () { }, error: function () { }, done: function () { }
    });
    eq(calls, ["get_score_info", "read_score"]);
    eq(messages.filter(function (m) { return m.role === "tool"; }).map(function (m) { return m.content; }), ["结果:get_score_info", "结果:read_score"]);
});
test("agent: 同步工具照旧；模型请求中途中止只报一次", function () {
    resetXhr(function () { return null; });
    var events = [];
    var t = Agent.runTurn({ apiKey: "k" }, [{ role: "user", content: "u" }], [], function () { return "x"; }, {
        assistant: function () { }, tool: function () { }, error: function (e) { events.push("E:" + e); },
        done: function (i) { events.push("D:" + i.note); }
    });
    t.abort();
    eq(events, ["D:已中止"]);
});
test("agent: 总结、压缩这类请求不带工具字段", function () {
    resetXhr(function () { return modelReply({ content: "总结" }); });
    var got = null;
    Agent.ask({ apiKey: "k" }, [{ role: "user", content: "u" }], function (r) { got = r; }, { maxTokens: 100 });
    var body = JSON.parse(XHR_LOG[0].body);
    eq([got.text, body.tools, body.tool_choice, body.max_tokens], ["总结", undefined, undefined, 100]);
});
test("prompt: 查接口的三个工具已注册，顺序写进了规则", function () {
    var names = Prompt.TOOLS.map(function (t) { return t["function"].name; });
    ok(["search_api_docs", "fetch_source", "search_source"].every(function (n) { return names.indexOf(n) >= 0; }), names.join(","));
    ok(Prompt.SYSTEM.indexOf("search_api_docs：按用户所装版本的源码生成的接口清单") >= 0);
});
