// 技能搜索
test("search: 按描述里的词", function () {
    var r = Skills.searchDetailed(loadAll(), "闷音");
    eq([r[0].skill.name, r[0].fuzzy], ["mute-x", false]);
});
test("search: 按说明正文里的词，并给出匹配片段", function () {
    var r = Skills.searchDetailed(loadAll(), "stringsDownBow");
    eq(r.length, 1);
    eq(r[0].skill.name, "strum-pattern");
    ok(r[0].snippet.indexOf("stringsDownBow") >= 0, r[0].snippet);
});
test("search: 多个词要同时出现", function () {
    var r = Skills.searchDetailed(loadAll(), "八分 休止符");
    eq(r.map(function (x) { return x.skill.name; }), ["eighth-notes"]);
});
test("search: 词对不上时按字模糊匹配", function () {
    var r = Skills.searchDetailed(loadAll(), "叉叉符头");
    ok(r.length > 0 && r[0].fuzzy && r[0].skill.name === "mute-x", JSON.stringify(r.map(function (x) { return [x.skill.name, x.score]; })));
    var r2 = Skills.searchDetailed(loadAll(), "改成八分的按钮");
    ok(r2[0].fuzzy && r2[0].skill.name === "eighth-notes", JSON.stringify(r2.map(function (x) { return [x.skill.name, x.score]; })));
    var r3 = Skills.searchDetailed(loadAll(), "八分 扫弦");
    eq([r3[0].skill.name, r3[0].fuzzy], ["strum-pattern", false], "两个词都在扫弦技能里");
    eq(Skills.searchDetailed(loadAll(), "完全无关的东西").length, 0);
});
test("search: 英文缩写按字母顺序匹配名字", function () {
    eq(Skills.search(loadAll(), "strm")[0].name, "strum-pattern");
});
test("search: 空查询列出全部", function () {
    eq(Skills.search(loadAll(), "").map(function (s) { return s.name; }), ["eighth-notes", "mute-x", "strum-pattern"]);
});
test("search: / 解析不做模糊匹配", function () {
    eq(Skills.resolve(loadAll(), "闷音").name, "mute-x");
    eq(Skills.resolve(loadAll(), "叉叉符头"), null);
});
test("search: 给模型的文本", function () {
    var t = Skills.searchText(loadAll(), "闷音");
    ok(t.indexOf("找到 1 个") >= 0 && t.indexOf("mute-x") >= 0 && t.indexOf("x 闷音") >= 0, t);
    ok(Skills.searchText(loadAll(), "完全无关的东西").indexOf("没有找到") >= 0);
});
test("prompt: search_skills 工具已注册", function () {
    ok(Prompt.TOOLS.some(function (t) { return t["function"].name === "search_skills"; }));
});
