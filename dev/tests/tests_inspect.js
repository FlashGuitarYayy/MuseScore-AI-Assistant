// inspect_api：说「做不到」之前先查接口；以及界面操作指南技能

test("inspect: 列出对象的方法和属性", function () {
    var t = setup();
    var r = ScoreIO.inspectApi(t.api, "curScore");
    ok(/^curScore /.test(r), r);
    ok(r.indexOf("newCursor()") >= 0, r);
    ok(/属性（\d+）: .*nstaves=1/.test(r), r);
});
test("inspect: 不存在的成员如实说没有", function () {
    var t = setup();
    eq(ScoreIO.inspectApi(t.api, "curScore.appendLinkedStaff"), "curScore.appendLinkedStaff 是 undefined。当前版本的插件接口里没有它（或者下标超出范围）。");
    ok(ScoreIO.inspectApi(t.api, "curScore.nothing[0].x").indexOf("curScore.nothing 是 undefined") === 0);
});
test("inspect: 标量和下标", function () {
    var t = setup();
    eq(ScoreIO.inspectApi(t.api, "curScore.nstaves"), "curScore.nstaves = 1");
    eq(ScoreIO.inspectApi(t.api, " curScore . title "), "curScore.title = \"测试谱\"");
    t.s.parts = [{ partName: "Voice", instruments: [{ instrumentId: "voice" }] }];
    eq(ScoreIO.inspectApi(t.api, "curScore.parts[0].instruments[0].instrumentId"), "curScore.parts[0].instruments[0].instrumentId = \"voice\"");
    ok(ScoreIO.inspectApi(t.api, "curScore.parts").indexOf("[列表 1 项]") >= 0);
});
test("inspect: 只接受安全的路径", function () {
    var t = setup();
    ok(/^ERROR/.test(ScoreIO.inspectApi(t.api, "curScore.startCmd()")));
    ok(/^ERROR/.test(ScoreIO.inspectApi(t.api, "curScore[\"x\"]")));
    ok(/^ERROR: 只能从这些对象开始查/.test(ScoreIO.inspectApi(t.api, "window")));
});
test("prompt: inspect_api 已注册，且要求先查再说做不到", function () {
    ok(Prompt.TOOLS.some(function (x) { return x["function"].name === "inspect_api"; }));
    ok(Prompt.SYSTEM.indexOf("不要凭印象说「做不到」") >= 0);
    ok(Prompt.SYSTEM.indexOf("简体中文") >= 0);
});
test("skill: 界面操作指南能解析、能搜到", function () {
    var sk = Skills.parse({ kind: "file", id: "musescore-ui-guide", rel: "skills/musescore-ui-guide.md", dir: "" },
                          readFile("skills/musescore-ui-guide.md"), readFile);
    ok(!sk.error && !sk.warning, JSON.stringify(sk.error || sk.warning));
    ok(!Skills.runnable(sk), "只有说明，不能直接运行");
    ok(sk.instructions.indexOf("创建联动谱表") >= 0 && sk.instructions.indexOf("视图 → 版面") >= 0);
    eq(Skills.searchDetailed([sk], "六线谱")[0].skill.name, "musescore-ui-guide");
    eq(Skills.searchDetailed([sk], "TAB 联动")[0].skill.name, "musescore-ui-guide");
});
