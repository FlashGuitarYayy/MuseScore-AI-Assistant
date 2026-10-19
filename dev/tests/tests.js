var results = [];
function test(name, fn) {
    try { fn(); results.push({ name: name, ok: true, msg: "" }); }
    catch (e) { results.push({ name: name, ok: false, msg: String((e && e.stack) || e) }); }
}
function eq(a, b, msg) {
    var sa = JSON.stringify(a), sb = JSON.stringify(b);
    if (sa !== sb) { throw new Error((msg ? msg + "：" : "") + "期望 " + sb + "，实际 " + sa); }
}
function ok(c, msg) { if (!c) { throw new Error(msg || "断言失败"); } }
function readFile(rel) { return FILES[rel] || ""; }

var C4 = [60, 14], D4 = [62, 16], E4 = [64, 18], F4 = [65, 13], G4 = [67, 15];

// 第 1 小节 4 个四分 C D E F；第 2 小节 8 个八分 G；第 3 小节二分 C 和弦 + 二分休止；第 4 小节全休止
function newScore() {
    var s = new FakeScore(4, 1);
    s.fill(0, [
        [[C4], 480], [[D4], 480], [[E4], 480], [[F4], 480],
        [[G4], 240], [[G4], 240], [[G4], 240], [[G4], 240], [[G4], 240], [[G4], 240], [[G4], 240], [[G4], 240],
        [[C4, E4, G4], 960], [null, 960],
        [null, 1920]
    ]);
    return s;
}
function setup(selFrom, selTo) {
    var s = newScore();
    var api = makeApi(s);
    if (selFrom) { s.selection.selectRange((selFrom - 1) * 1920, selTo * 1920, 0, 1); }
    return { s: s, api: api, h: ScoreIO.makeHelpers(api) };
}
function lens(api, m) { return ScoreIO.items(api, m, m, 0, 0).map(function (x) { return (x.isChord ? "C" : "R") + x.cr.len; }); }

// ---------------------------------------------------------------- 乐理
test("theory: tpcForPitch 与 MuseScore 一致", function () {
    eq([60, 61, 63, 66, 70].map(function (p) { return Theory.tpcForPitch(p, 0); }), [14, 21, 11, 20, 12]);
    eq(Theory.tpcForPitch(66, 1), 20, "G 大调的 F#");
    eq(Theory.tpcForPitch(70, -1), 12, "F 大调的 Bb");
});
test("theory: parseNote / noteName / clampTpc", function () {
    eq(Theory.parseNote("D", 64).pitch, 62);
    eq(Theory.parseNote("D", 67).pitch, 62);
    eq([Theory.parseNote("Bb3").pitch, Theory.parseNote("Bb3").tpc], [58, 12]);
    eq([Theory.parseNote("F#4").pitch, Theory.parseNote("F#4").tpc], [66, 20]);
    eq(Theory.noteName(59, 19), "B3");
    eq(Theory.noteName(60, 26), "B#3");
    eq(Theory.clampTpc(35), 23);
    eq(Theory.parseNote("H"), null);
});

// ---------------------------------------------------------------- 读谱
test("scoreio: measures / items 编号", function () {
    var t = setup();
    eq(ScoreIO.measures(t.api).map(function (m) { return m.startTick; }), [0, 1920, 3840, 5760]);
    var its = ScoreIO.items(t.api, 1, 1, 0, 0);
    eq(its.map(function (x) { return x.noteIndex; }), [1, 2, 3, 4]);
    var m3 = ScoreIO.items(t.api, 3, 3, 0, 0);
    eq(m3.map(function (x) { return [x.index, x.noteIndex, x.isChord]; }), [[1, 1, true], [2, 0, false]]);
});
test("scoreio: readScore 文本", function () {
    var t = setup();
    var txt = ScoreIO.readScore(t.api, { scope: "measures", from_measure: 1, to_measure: 1 });
    ok(txt.indexOf("#2 n2 和弦 1/4 [D4]") >= 0, txt);
    ok(txt.indexOf("--- 第 1 小节 · 谱表0 声部0 ---") >= 0, txt);
});
test("scoreio: 范围选区与摘要", function () {
    var t = setup(2, 2);
    eq(ScoreIO.selectionItems(t.api).length, 8);
    ok(ScoreIO.selectionSummary(t.api).indexOf("第 2 小节") >= 0, ScoreIO.selectionSummary(t.api));
    ok(ScoreIO.readScore(t.api, { scope: "selection" }).indexOf("#8 n8") >= 0);
});
test("scoreio: 点选音符保持小节内编号", function () {
    var t = setup();
    var third = ScoreIO.items(t.api, 1, 1, 0, 0)[2];
    t.s.selection.select(third.notes[0], false);
    var sel = ScoreIO.selectionItems(t.api);
    eq(sel.map(function (x) { return [x.measure, x.index, x.noteIndex]; }), [[1, 3, 3]]);
});
test("scoreio: h.selectItems 选中和弦的音", function () {
    var t = setup();
    var n = t.h.selectItems(ScoreIO.items(t.api, 3, 3, 0, 0));
    eq(n, 4, "3 个音 + 1 个休止符");
});

// ---------------------------------------------------------------- 写谱
test("setDurations: 四分改八分，起点不变、补休止符", function () {
    var t = setup(1, 1);
    var r = t.h.setDurations(t.h.selectionItems(), 1, 8);
    eq(r, "4 个改成了 1/8");
    eq(lens(t.api, 1), ["C240", "R240", "C240", "R240", "C240", "R240", "C240", "R240"]);
});
test("setDurations: 八分改四分，被盖住的跳过", function () {
    var t = setup(2, 2);
    var r = t.h.setDurations(t.h.selectionItems(), 1, 4);
    eq(r, "4 个改成了 1/4；4 个已经被前面变长的音盖住");
    eq(lens(t.api, 2), ["C480", "C480", "C480", "C480"]);
});
test("setDurations: 默认不改休止符", function () {
    var t = setup(3, 3);
    eq(t.h.setDurations(t.h.selectionItems(), 1, 4), "1 个改成了 1/4");
    eq(lens(t.api, 3), ["C480", "R480", "R960"]);
});
test("transpose: 降半音按调号就近拼写", function () {
    var t = setup(1, 1);
    eq(t.h.transpose(t.h.selectionItems(), -1), "4 个音移动了 -1 个半音（只改了音符，调号和和弦符号没变）");
    eq(ScoreIO.items(t.api, 1, 1, 0, 0).map(function (x) { return t.h.noteName(x.notes[0]); }), ["B3", "C#4", "Eb4", "E4"]);
});
test("transpose: 八度保持拼写", function () {
    var t = setup(1, 1);
    t.h.transpose(t.h.selectionItems(), 12);
    var n = ScoreIO.items(t.api, 1, 1, 0, 0)[3].notes[0];
    eq([n.pitch, n.tpc1], [77, 13]);
});
test("setPitch: 移调乐器保留 tpc 差", function () {
    var t = setup();
    var n = ScoreIO.items(t.api, 1, 1, 0, 0)[0].notes[0];
    n.tpc2 = n.tpc1 + 2;
    t.h.setPitch(n, "D4");
    eq([n.pitch, n.tpc1, n.tpc2], [62, 16, 18]);
});
test("articulations: 不重复加、可删除", function () {
    var t = setup();
    var it = ScoreIO.items(t.api, 1, 1, 0, 0)[0];
    ok(t.h.addArticulation(it, "down"), "第一次应当加上");
    eq(t.h.addArticulation(it, "down"), null, "第二次不应重复");
    t.h.addArticulation(it, "up");
    eq(it.cr.articulations.length, 2);
    eq(t.h.removeArticulations(it, "down"), 1);
    eq(t.h.removeArticulations(it), 1);
    eq(it.cr.articulations.length, 0);
});
test("noteheads: x 符头显示在读谱里", function () {
    var t = setup();
    var it = ScoreIO.items(t.api, 3, 3, 0, 0)[0];
    eq(t.h.setNoteheads(it, "cross"), 3);
    ok(ScoreIO.describe(t.api, [it]).indexOf("C4(x),E4(x),G4(x)") >= 0, ScoreIO.describe(t.api, [it]));
});
test("scoreHash: 没改就相同，改了就不同", function () {
    var t = setup();
    var a = ScoreIO.scoreHash(t.api);
    eq(ScoreIO.scoreHash(t.api), a);
    ScoreIO.items(t.api, 1, 1, 0, 0)[0].notes[0].pitch = 61;
    ok(ScoreIO.scoreHash(t.api) !== a, "音高改了指纹应当变");
    var b = ScoreIO.scoreHash(t.api);
    t.h.addArticulation(ScoreIO.items(t.api, 1, 1, 0, 0)[1], "up");
    ok(ScoreIO.scoreHash(t.api) !== b, "加记号指纹应当变");
});

// ---------------------------------------------------------------- 脚本执行
test("runScript: 成功执行并返回结果", function () {
    var t = setup();
    var r = ScoreIO.runScript(t.api, "h.items(1,1,0,0)[0].notes.forEach(function(n){ h.setPitch(n, 'D'); }); log('hi'); return 'done';", "", t.h);
    eq([r.ok, r.result, r.logs], [true, "done", ["hi"]]);
    eq(ScoreIO.items(t.api, 1, 1, 0, 0)[0].notes[0].pitch, 62);
});
test("runScript: 抛异常整段回滚", function () {
    var t = setup();
    var r = ScoreIO.runScript(t.api, "h.items(1,1,0,0)[0].notes[0].pitch = 70; throw new Error('故意的');", "", t.h);
    ok(!r.ok && r.error.indexOf("故意的") >= 0, JSON.stringify(r));
    eq(ScoreIO.items(t.api, 1, 1, 0, 0)[0].notes[0].pitch, 60);
    eq(t.s.cmdDepth, 0);
});
test("runScript / compileCheck: 语法错误", function () {
    var t = setup();
    var r = ScoreIO.runScript(t.api, "function (", "", t.h);
    ok(!r.ok && r.error.indexOf("语法错误") >= 0, JSON.stringify(r));
    eq(t.s.cmdDepth, 0, "语法错误时不应开事务");
    ok(ScoreIO.compileCheck("function (", "x") !== "");
    eq(ScoreIO.compileCheck("return 1;"), "");
    eq(ScoreIO.compileCheck(""), "");
});
test("prompt 里的示例脚本都能跑", function () {
    var blocks = Prompt.SYSTEM.split("\n示例：").slice(1);
    eq(blocks.length, 3);
    blocks.forEach(function (b) {
        var code = b.split("\n").slice(1).filter(function (l) { return /^  /.test(l); }).join("\n");
        var t = setup(1, 1);
        var r = ScoreIO.runScript(t.api, code, "", t.h);
        ok(r.ok, b.split("\n")[0] + " → " + JSON.stringify(r));
    });
});

// ---------------------------------------------------------------- 技能
function entryFolder(id) { return { kind: "folder", id: id, rel: "skills/" + id + "/SKILL.md", dir: "skills/" + id + "/" }; }
function entryFile(id) { return { kind: "file", id: id, rel: "skills/" + id + ".md", dir: "" }; }
function loadAll() {
    return [
        Skills.parse(entryFolder("strum-pattern"), readFile("skills/strum-pattern/SKILL.md"), readFile),
        Skills.parse(entryFile("mute-x"), readFile("skills/mute-x.md"), readFile),
        Skills.parse(entryFile("eighth-notes"), readFile("skills/eighth-notes.md"), readFile)
    ];
}
test("skills: 解析三个样例", function () {
    var all = loadAll();
    all.forEach(function (s) { ok(!s.error, JSON.stringify(s)); eq(s.warning, "", s.name); });
    var sp = all[0], mx = all[1], en = all[2];
    eq([sp.name, sp.libFile, sp.run, sp.button], ["strum-pattern", true, "", ""]);
    ok(sp.lib.indexOf("function strumPattern") >= 0);
    ok(sp.description.indexOf("扫弦") >= 0);
    eq([mx.name, mx.button, mx.kind], ["mute-x", "x 闷音", "file"]);
    ok(mx.run.indexOf("setNoteheads") >= 0 && mx.instructions.indexOf("```js run") < 0, mx.instructions);
    eq(en.button, "改八分");
    ok(Skills.runnable(mx) && Skills.runnable(en) && !Skills.runnable(sp));
});
test("skills: 序列化后再解析不变", function () {
    var s = { name: "test-skill", description: "测试：做点事，含 \"引号\" 和 # 号", instructions: "# 标题\n\n步骤一", lib: "function f() { return 1; }", run: "return f();", button: "测试 #1", cmd: "" };
    var p = Skills.parse(entryFile("test-skill"), Skills.serialize(s), readFile);
    eq([p.name, p.description, p.instructions, p.lib, p.run, p.button, p.cmd], [s.name, s.description, s.instructions, s.lib, s.run, s.button, ""]);
    var twice = Skills.serialize(p);
    eq(twice, Skills.serialize(s), "反复保存应当稳定");
    loadAll().forEach(function (k) { ok(k.instructions.indexOf("直接运行的脚本") < 0 && k.instructions.indexOf("加载这个技能后，下面的函数") < 0, k.name + "：" + k.instructions); });
});
test("skills: YAML 多行描述和 metadata", function () {
    var txt = "---\nname: a\ndescription: >\n  line one\n  line two\nlicense: MIT\nmetadata:\n  button: \"B\"\n  cmd: pad-note-8\n---\nbody\n";
    var p = Skills.parse(entryFile("a"), txt, readFile);
    eq([p.description, p.button, p.cmd, p.instructions], ["line one line two", "B", "pad-note-8", "body"]);
    ok(Skills.parse(entryFile("b"), "no frontmatter", readFile).error);
    ok(Skills.parse(entryFile("c"), "---\nname: c\n---\nx", readFile).error, "缺 description 应当报错");
    eq(Skills.parse(entryFile("d"), "---\nname: other\ndescription: x\n---\n", readFile).warning !== "", true);
});
test("skills: 名称校验", function () {
    var base = { description: "d" };
    ["Test", "-a", "a-", "a--b", "a b", "中文"].forEach(function (n) {
        ok(Skills.validate({ name: n, description: "d" }) !== "", n + " 应当不合法");
    });
    eq(Skills.validate({ name: "ok-name-2", description: "d" }), "");
    ok(Skills.validate({ name: "x", description: "d", button: "B" }) !== "", "按钮需要脚本");
    ok(Skills.validate({ name: "x", description: "d", cmd: "file-open" }, Prompt.cmdAllowed) !== "");
});
test("skills: 搜索与 / 解析", function () {
    var all = loadAll();
    eq(Skills.search(all, "闷")[0].name, "mute-x");
    eq(Skills.resolve(all, "x 闷音").name, "mute-x");
    eq(Skills.resolve(all, "eighth").name, "eighth-notes");
    eq(Skills.resolve(all, "e"), null, "多个命中时不猜");
    eq(Skills.search(all, "").length, 3);
    ok(Skills.catalogText(all).indexOf("mute-x：") >= 0 && Skills.catalogText(all).indexOf("[可直接运行]") >= 0);
});
test("skills: 保存计划", function () {
    var all = loadAll();
    var s = { name: "new-one", description: "d", instructions: "i", lib: "", run: "return 1;" };
    var p = Skills.plan(s, null);
    eq([p.path, p.files.length, p.remove], ["skills/new-one.md", 1, []]);
    var renamed = Skills.plan(s, all[1]);
    eq(renamed.remove, ["skills/mute-x.md"]);
    var folder = Skills.plan({ name: "strum-pattern", description: "d", instructions: "i", lib: "function a(){}", run: "" }, all[0]);
    eq(folder.files.map(function (f) { return f.rel; }), ["skills/strum-pattern/SKILL.md", "skills/strum-pattern/scripts/lib.js"]);
    ok(folder.files[0].text.indexOf("```js lib") < 0, "函数库在独立文件里时不要再嵌进 SKILL.md");
});

// ---------------------------------------------------------------- 样例技能实跑
test("样例 mute-x 直接运行", function () {
    var t = setup(1, 1);
    var mx = loadAll()[1];
    var r = ScoreIO.runScript(t.api, mx.run, mx.lib, t.h);
    eq([r.ok, r.result], [true, "4 个和弦改成了 x 符头"]);
    ok(ScoreIO.items(t.api, 1, 1, 0, 0).every(function (x) { return x.notes[0].headGroup === 1; }));
});
test("样例 eighth-notes 直接运行", function () {
    var t = setup(1, 1);
    var r = ScoreIO.runScript(t.api, loadAll()[2].run, "", t.h);
    eq([r.ok, r.result], [true, "4 个改成了 1/8"]);
});
test("样例 strum-pattern: 解析节奏型", function () {
    var t = setup();
    var lib = loadAll()[0].lib;
    var r = ScoreIO.runScript(t.api,
        "return [parseStrumPattern('down up - up down down up -'), parseStrumPattern('1 n 2 n 3 n 4 n'), parseStrumPattern('1 2n 3 4n'), parseStrumPattern('下 上 - 上')];",
        lib, t.h);
    ok(r.ok, JSON.stringify(r));
    eq(JSON.parse(r.result), [
        ["D", "U", null, "U", "D", "D", "U", null],
        ["D", "U", "D", "U", "D", "U", "D", "U"],
        ["D", null, null, "U", "D", null, null, "U"],
        ["D", "U", null, "U"]
    ]);
    var bad = ScoreIO.runScript(t.api, "return parseStrumPattern('down sideways');", lib, t.h);
    ok(!bad.ok && bad.error.indexOf("sideways") >= 0, JSON.stringify(bad));
});
test("样例 strum-pattern: 按拍位和按顺序", function () {
    var t = setup(2, 2);
    var lib = loadAll()[0].lib;
    var r = ScoreIO.runScript(t.api, "return strumPattern(h, h.selectionItems(), parseStrumPattern('down up - up down down up -'), { mode: 'grid' });", lib, t.h);
    eq([r.ok, r.result], [true, "8 个和弦里新加了 6 个扫弦记号（按拍位）"]);
    eq(ScoreIO.items(t.api, 2, 2, 0, 0).map(function (x) { return x.cr.articulations.map(function (a) { return a.symbol; }); }),
       [[100], [101], [], [101], [100], [100], [101], []]);
    var t2 = setup(1, 1);
    var r2 = ScoreIO.runScript(t2.api, "return strumPattern(h, h.selectionItems(), ['D','U']);", lib, t2.h);
    eq(r2.result, "4 个和弦里新加了 4 个扫弦记号（按顺序）");
    eq(ScoreIO.items(t2.api, 1, 1, 0, 0).map(function (x) { return x.cr.articulations[0].symbol; }), [100, 101, 100, 101]);
});

// ---------------------------------------------------------------- 提示词与工具
test("prompt: 工具定义完整", function () {
    eq(Prompt.TOOLS.map(function (t) { return t["function"].name; }),
       ["get_score_info", "read_score", "select_range", "run_script", "cmd", "inspect_api", "search_api_docs", "fetch_source", "search_source", "load_skill", "search_skills", "run_skill", "save_skill"]);
    Prompt.TOOLS.forEach(function (t) { eq(t.type, "function"); eq(t["function"].parameters.type, "object"); });
    eq([Prompt.cmdAllowed("file-open"), Prompt.cmdAllowed("pad-note-8"), Prompt.cmdAllowed("undo")], [false, true, true]);
});

function runAll() { return results; }

// ---------------------------------------------------------------- 对话循环（假网络）
var XHR_QUEUE = [];
var XHR_LOG = [];
function XMLHttpRequest() { this.readyState = 0; this.status = 0; this.responseText = ""; this.headers = {}; }
XMLHttpRequest.prototype.open = function (m, u) { this.url = u; };
XMLHttpRequest.prototype.setRequestHeader = function (k, v) { this.headers[k] = v; };
XMLHttpRequest.prototype.abort = function () { };
XMLHttpRequest.prototype.send = function (body) {
    XHR_LOG.push({ url: this.url, auth: this.headers.Authorization, body: JSON.parse(body) });
    var next = XHR_QUEUE.shift();
    this.readyState = 4;
    if (next && next.httpError) {
        this.status = next.httpError;
        this.responseText = JSON.stringify({ error: { message: "bad key" } });
    } else {
        this.status = 200;
        this.responseText = JSON.stringify({ choices: [{ message: next, finish_reason: "stop" }] });
    }
    this.onreadystatechange();
};
function toolCall(id, name, args) { return { id: id, type: "function", "function": { name: name, arguments: args } }; }
function runAgent(cfg, queue) {
    XHR_QUEUE = queue.slice();
    XHR_LOG = [];
    var ev = { assistant: [], tool: [], error: [], done: [] };
    var messages = [{ role: "system", content: "sys" }, { role: "user", content: "hi" }];
    Agent.runTurn(cfg, messages, Prompt.TOOLS, function (name, args) { return "RESULT:" + name + ":" + JSON.stringify(args); }, {
        assistant: function (t) { ev.assistant.push(t); },
        tool: function (n, a, r) { ev.tool.push([n, r]); },
        error: function (e) { ev.error.push(e); },
        done: function (info) { ev.done.push(info); }
    });
    return { ev: ev, messages: messages };
}
var CFG = { apiKey: "sk-test", baseUrl: "https://api.deepseek.com/", model: "deepseek-flash", reasoningEffort: "none", maxIterations: 5 };

test("agent: 工具调用后给出最终回复", function () {
    var r = runAgent(CFG, [
        { content: "", tool_calls: [toolCall("c1", "get_score_info", "{}")] },
        { content: "完成了" }
    ]);
    eq(r.ev.done, [{}]);
    eq(r.ev.assistant, ["完成了"]);
    eq(r.ev.tool, [["get_score_info", "RESULT:get_score_info:{}"]]);
    eq(r.messages.map(function (m) { return m.role; }), ["system", "user", "assistant", "tool", "assistant"]);
    eq(r.messages[3].tool_call_id, "c1");
    eq(XHR_LOG[0].url, "https://api.deepseek.com/chat/completions");
    eq(XHR_LOG[0].auth, "Bearer sk-test");
    eq([XHR_LOG[0].body.tool_choice, XHR_LOG[0].body.reasoning_effort, XHR_LOG[0].body.model], ["auto", "none", "deepseek-flash"]);
    eq(XHR_LOG[1].body.messages[3].content, "RESULT:get_score_info:{}");
});
test("agent: 到上限时不带工具总结，并标记可继续", function () {
    var cfg = JSON.parse(JSON.stringify(CFG));
    cfg.maxIterations = 2;
    var r = runAgent(cfg, [
        { content: "", tool_calls: [toolCall("a", "read_score", "{\"scope\":\"selection\"}")] },
        { content: "", tool_calls: [toolCall("b", "read_score", "{\"scope\":\"selection\"}")] },
        { content: "做了 A，卡在 B" }
    ]);
    eq(XHR_LOG.length, 3);
    eq(XHR_LOG[2].body.tool_choice, "none");
    var last = XHR_LOG[2].body.messages[XHR_LOG[2].body.messages.length - 1];
    ok(last.role === "user" && last.content.indexOf("上限") >= 0, JSON.stringify(last));
    eq(r.ev.assistant, ["做了 A，卡在 B"]);
    eq(r.ev.done.length, 1);
    ok(r.ev.done[0].capped === true && r.ev.done[0].note.indexOf("继续") >= 0, JSON.stringify(r.ev.done));
    ok(!r.messages[r.messages.length - 1].tool_calls, "总结消息不应带 tool_calls");
});
test("agent: 参数不是 JSON 时回报错误给模型", function () {
    var r = runAgent(CFG, [
        { content: "", tool_calls: [toolCall("x", "run_script", "{oops")] },
        { content: "好的" }
    ]);
    ok(r.ev.tool[0][1].indexOf("参数不是合法 JSON") >= 0, JSON.stringify(r.ev.tool));
    eq(r.ev.done, [{}]);
});
test("agent: HTTP 错误走 error", function () {
    var r = runAgent(CFG, [{ httpError: 401 }]);
    eq(r.ev.error, ["HTTP 401: bad key"]);
    eq(r.ev.done, []);
});
