// 移调相关的小改动 + core/session.js（对话记录、总结、压缩）

// ---------------------------------------------------------------- 移调与调号
test("theory: keyName", function () {
    eq(Theory.keyName(-1), "F 大调 / D 小调（1 个降号）");
    eq(Theory.keyName(4), "E 大调 / C# 小调（4 个升号）");
    eq(Theory.keyName(0), "C 大调 / A 小调（没有升降号）");
});
test("scoreInfo: 调号带调名", function () {
    var t = setup();
    t.s.keysig = 4;
    ok(ScoreIO.scoreInfo(t.api).indexOf("调号(五度圈): 4 = E 大调") >= 0, ScoreIO.scoreInfo(t.api));
});
test("respell: 按调号把 Fb/Ab 这类写法改回来，音高不变", function () {
    var t = setup(1, 1);
    // 模拟 transpose-down（增一度）之后的样子：F→Fb，E→Eb，D→Db，C→Cb
    var its = t.h.selectionItems();
    var before = its.map(function (x) { return x.notes[0].pitch; });
    its.forEach(function (x) { var n = x.notes[0]; n.pitch -= 1; n.tpc1 -= 7; n.tpc2 -= 7; });
    eq(its.map(function (x) { return t.h.noteName(x.notes[0]); }), ["Cb4", "Db4", "Eb4", "Fb4"]);
    t.s.keysig = 4;
    eq(t.h.respell(its), "重新拼写了 4 个音（共检查 4 个）");
    eq(its.map(function (x) { return t.h.noteName(x.notes[0]); }), ["B3", "C#4", "D#4", "E4"]);
    eq(its.map(function (x) { return x.notes[0].pitch; }), before.map(function (p) { return p - 1; }));
});
test("prompt: cmd 支持一串动作代码，黑名单逐个检查", function () {
    eq(Prompt.splitCmds("notation-select-all  transpose-down,pitch-spell"), ["notation-select-all", "transpose-down", "pitch-spell"]);
    ok(Prompt.cmdAllowed("notation-select-all transpose-down pitch-spell"));
    ok(!Prompt.cmdAllowed("notation-select-all file-save"), "混进文件动作要拒绝");
    ok(!Prompt.cmdAllowed(""));
    ok(!Prompt.cmdAllowed(new Array(Prompt.MAX_CMDS + 2).join("undo ")), "太多");
    eq(Skills.validate({ name: "x", description: "d", button: "降半音", cmd: "notation-select-all transpose-down pitch-spell" }, Prompt.cmdAllowed), "");
});
test("prompt: 换调走 MuseScore 自带的移调，不用 h.transpose", function () {
    ok(Prompt.SYSTEM.indexOf("notation-select-all transpose-down pitch-spell") >= 0);
    ok(/h\.transpose[^\n]*不改调号/.test(Prompt.SYSTEM));
});
test("scoreHash: 调号变了也算谱面改变", function () {
    var t = setup();
    var ks = { type: 25, actualKey: -1 };
    var api = makeApi(t.s);
    api.Element = Object.assign({}, api.Element, { KEYSIG: 25 });
    var origAt = t.s.segmentAt;
    t.s.segmentAt = function (tick) {
        var seg = origAt.call(t.s, tick);
        if (tick === 0) {
            var ea = seg.elementAt;
            seg.elementAt = function (tr) { return tr === 1 ? ks : ea.call(seg, tr); };
        }
        return seg;
    };
    var h1 = ScoreIO.scoreHash(api);
    ks.actualKey = 4;
    var h2 = ScoreIO.scoreHash(api);
    t.s.segmentAt = origAt;
    ok(h1 !== h2, h1 + " / " + h2);
});

// ---------------------------------------------------------------- 对话记录
var T0 = new Date(2026, 9, 10, 21, 41, 5);

function sampleLog() {
    var log = Session.newLog("丢了你", T0);
    var t1 = Session.beginTurn(log, "chat", "把 F 大调改成 E 大调", "没有选区", T0);
    Session.addTool(t1, "get_score_info", {}, "标题: 丢了你 …");
    Session.addTool(t1, "run_script", { code: "curScore.keysig.setKeySig(4)", purpose: "改调号" }, "ERROR: TypeError: setKeySig is not a function");
    Session.addTool(t1, "run_script", { code: "return h.transpose(h.items(1, 47, -1, -1), -1);", purpose: "整曲降半音" }, "OK\n337 个音移动了 -1 个半音\n谱面已改变。");
    Session.addTool(t1, "cmd", { code: "notation-select-all transpose-down pitch-spell" }, "已依次执行 3 个动作：\n1. notation-select-all：谱面没变，选区变了\n2. transpose-down：谱面已改变\n3. pitch-spell：谱面已改变");
    Session.addReply(t1, "已经改成 E 大调。");
    Session.endTurn(t1, { undoSteps: 3 });
    var t2 = Session.beginTurn(log, "button", "[按钮 x 闷音]", "", T0);
    Session.addTool(t2, "run_skill", { name: "mute-x" }, "WARNING: 没有选区");
    Session.endTurn(t2, {});
    return log;
}

test("session: 记录结构和状态分类", function () {
    var log = sampleLog();
    eq(log.id, "2026-10-10_214105");
    eq(log.turns.length, 2);
    eq(log.turns[0].tools.map(function (x) { return x.status; }), ["ok", "error", "changed", "changed"]);
    eq(log.turns[1].tools[0].status, "warning");
    eq(Session.classify("已执行 notation-select-all：谱面没变，选区变了\n当前选区: …"), "selection");
    eq(Session.classify("OK\n（谱子较大，没有检查谱面是否改变）"), "changed");
    eq(Session.classify("OK\n谱面没有变化。"), "nochange");
    eq(Session.stats(log.turns[0]), { tools: 4, failed: 1, changed: 2 });
    ok(!Session.bumpy(log.turns[0]));
    var t3 = Session.beginTurn(log, "chat", "x", "", T0);
    for (var i = 0; i < 2; i++) { Session.addTool(t3, "cmd", { code: "pad-note-8" }, "WARNING: 没变化"); }
    Session.endTurn(t3, {});
    ok(Session.bumpy(t3), "两次失败算绕路");
    ok(JSON.parse(JSON.stringify(log)).turns.length === 3, "能存成 JSON");
});
test("session: 撤销标记最近一轮改过谱的", function () {
    var log = sampleLog();
    eq(Session.markUndone(log).n, 1);
    ok(log.turns[0].undone && !log.turns[1].undone);
    ok(Session.transcript(log).indexOf("被用户撤销") >= 0);
});
test("session: 复盘文本——成功的脚本给全，失败的标出来", function () {
    var log = sampleLog();
    var tx = Session.transcript(log);
    ok(tx.indexOf("用户：把 F 大调改成 E 大调") >= 0, tx);
    ok(tx.indexOf("run_script（改调号）  → ✗ 出错") >= 0, tx);
    ok(tx.indexOf("| return h.transpose(h.items(1, 47, -1, -1), -1);") >= 0, tx);
    ok(tx.indexOf("cmd notation-select-all transpose-down pitch-spell  → ✓ 改了谱") >= 0, tx);
    ok(tx.indexOf("按钮/直接运行，没经过模型") >= 0, tx);
    ok(tx.indexOf("助手：已经改成 E 大调。") >= 0, tx);
});
test("session: 复盘文本太长时逐级缩短", function () {
    var log = Session.newLog("x", T0);
    for (var i = 0; i < 40; i++) {
        var t = Session.beginTurn(log, "chat", "第 " + i + " 次", "", T0);
        Session.addTool(t, "run_script", { code: new Array(500).join("x;\n") }, "OK\n谱面已改变。" + new Array(400).join("结果"));
        Session.endTurn(t, {});
    }
    var tx = Session.transcript(log, 20000);
    ok(tx.length <= 20000 + 20, "长度 " + tx.length);
    ok(tx.indexOf("第 39 次") >= 0, "最近的轮次要保留");
});
test("session: 记录里的脚本和结果有长度上限", function () {
    var log = Session.newLog("x", T0);
    var t = Session.beginTurn(log, "chat", "p", "", T0);
    Session.addTool(t, "run_script", { code: new Array(10000).join("a") }, new Array(5000).join("b"));
    ok(t.tools[0].args.code.length < 6100 && t.tools[0].result.length < 1600);
});

// ---------------------------------------------------------------- 压缩
function chatMessages(n) {
    var m = [{ role: "system", content: "SYS" }];
    for (var i = 0; i < n; i++) {
        m.push({ role: "user", content: "第 " + i + " 个问题" });
        m.push({ role: "assistant", content: "", tool_calls: [{ id: "c" + i, type: "function", "function": { name: "read_score", arguments: "{\"scope\":\"measures\"}" } }] });
        m.push({ role: "tool", tool_call_id: "c" + i, content: new Array(2000).join("音") });
        m.push({ role: "assistant", content: "回答 " + i });
    }
    return m;
}
test("compact: 大小和触发条件", function () {
    var m = chatMessages(3);
    ok(Session.size(m) > 6000);
    ok(Session.needsCompact(m, 5000));
    ok(!Session.needsCompact(m, 0), "0 = 关闭");
    ok(!Session.needsCompact(m.slice(0, 3), 1), "太短不压");
});
test("compact: 请求和压缩后的上下文", function () {
    var m = chatMessages(30);
    var req = Session.compactRequest("SYS2", m, ["arrange-tools"]);
    eq(req.length, 2);
    eq(req[0], { role: "system", content: "SYS2" });
    ok(req[1].content.indexOf("arrange-tools") >= 0);
    ok(req[1].content.indexOf("调用 read_score") >= 0);
    ok(req[1].content.length < 41000 + Session.COMPACT_TASK.length, "长度 " + req[1].content.length);
    var c = Session.compactedMessages("SYS2", "交接说明");
    eq(c.map(function (x) { return x.role; }), ["system", "user", "assistant"]);
    ok(c[1].content.indexOf("交接说明") >= 0);
    ok(!Session.needsCompact(c, 1), "压缩后不会马上又压");
});

// ---------------------------------------------------------------- 总结和技能提议
var REPLY = [
    "## 目标", "把 F 大调改成 E 大调。", "", "## 最后是怎么做成的", "cmd notation-select-all transpose-down pitch-spell", "",
    "## 踩过的坑", "- curScore.keysig 是数字，不能改。", "", "## 可以存成技能的", "",
    "```json",
    JSON.stringify({ proposals: [
        { name: "Transpose Whole Score", kind: "script", description: "整曲降半音，连调号一起改", button: "整曲降半音", cmd: "notation-select-all transpose-down pitch-spell", why: "常用" },
        { name: "key-change", description: "按目标调换调", instructions: "# 换调\n算半音数……", requires: ["arrange-tools"] },
        { name: "bad" },
        { name: "btn-only", description: "没有脚本的按钮", button: "点我" }
    ] }),
    "```"
].join("\n");

test("summary: 解析复盘和提议", function () {
    var r = Session.parseSummary(REPLY);
    ok(r.summary.indexOf("## 踩过的坑") >= 0 && r.summary.indexOf("```") < 0, r.summary);
    eq(r.proposals.map(function (p) { return p.name; }), ["transpose-whole-score", "key-change", "btn-only"]);
    eq(r.proposals.map(function (p) { return p.kind; }), ["script", "ai", "ai"]);
    eq(r.proposals[1].requires, "arrange-tools");
    eq(r.proposals[2].button, "", "没有可运行的东西就不做按钮");
    var p0 = r.proposals[0];
    eq(Skills.validate({ name: p0.name, description: p0.description, button: p0.button, cmd: p0.cmd }, Prompt.cmdAllowed), "");
});
test("summary: 没有 json 块或 json 坏了也不崩", function () {
    eq(Session.parseSummary("只有正文").proposals, []);
    eq(Session.parseSummary("正文\n```json\n{坏的\n```").proposals, []);
    var r = Session.parseSummary("正文\n```json\n好的：{\"proposals\":[{\"name\":\"a\",\"description\":\"d\",\"run_script\":\"return 1;\"}]}\n```");
    eq([r.proposals.length, r.proposals[0].kind], [1, "script"]);
});
test("summary: 提议卡片文字和 markdown 文件", function () {
    var log = sampleLog();
    var r = Session.parseSummary(REPLY);
    var card = Session.proposalText(r.proposals[0]);
    ok(card.indexOf("/transpose-whole-score（一键脚本）") >= 0 && card.indexOf("按钮「整曲降半音」") >= 0, card);
    var md = Session.summaryMarkdown(log, r.summary, r.proposals, T0);
    ok(md.indexOf("# 对话复盘 2026-10-10_214105") >= 0 && md.indexOf("### /key-change（AI 技能）") >= 0, md);
    var req = Session.summaryRequest("SYS", log);
    ok(req[1].content.indexOf("```json") >= 0 && req[1].content.indexOf("把 F 大调改成 E 大调") >= 0);
});
test("agent: 不带工具的请求", function () {
    ok(typeof Agent.ask === "function");
});
