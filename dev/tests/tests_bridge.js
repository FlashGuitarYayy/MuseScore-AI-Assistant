// core/bridge.js：本地桥的任务解析和结果格式

test("bridge: parseJob", function () {
    var p = Bridge.parseJob('{"id":"a1","tool":"run_script","args":{"code":"return 1;"}}');
    ok(p.ok, p.error);
    eq(p.job, { id: "a1", tool: "run_script", args: { code: "return 1;" } });
    ok(!Bridge.parseJob("{").ok, "坏 JSON");
    ok(!Bridge.parseJob("null").ok);
    ok(/不认识的工具/.test(Bridge.parseJob('{"tool":"save_skill"}').error), "save_skill 不开放");
    ok(/不认识的工具/.test(Bridge.parseJob('{"args":{}}').error), "缺 tool");
    var q = Bridge.parseJob('{"tool":"ping","args":"x"}');
    ok(q.ok);
    eq(q.job.args, {}, "args 不是对象就当空");
    eq(q.job.id, "");
});

test("bridge: formatResult / formatState", function () {
    var r = JSON.parse(Bridge.formatResult({ id: "x", tool: "cmd", args: {} }, "ERROR: 没有打开的谱子", 0));
    eq([r.id, r.tool, r.ok, r.text, r.undoSteps], ["x", "cmd", false, "ERROR: 没有打开的谱子", 0]);
    var r2 = JSON.parse(Bridge.formatResult({ id: "y", tool: "run_script", args: {} }, "谱面已改变。", 2));
    ok(r2.ok && r2.undoSteps === 2 && r2.ts > 0);
    var r3 = JSON.parse(Bridge.formatResult(null, "ERROR: 坏任务", 0));
    eq([r3.id, r3.tool, r3.ok], ["", "", false]);
    var s = JSON.parse(Bridge.formatState(true, { score: "丢了你", selection: "全谱", version: "4.6.3", busy: false }));
    eq([s.on, s.score, s.selection, s.version, s.busy], [true, "丢了你", "全谱", "4.6.3", false]);
    ok(s.ts > 0);
    eq(JSON.parse(Bridge.formatState(false)).on, false);
});

test("bridge: describe / short", function () {
    eq(Bridge.describe({ tool: "run_script", args: { code: "abc" } }), "run_script（3 字）");
    eq(Bridge.describe({ tool: "run_skill", args: { name: "bass-1-3" } }), "run_skill bass-1-3");
    eq(Bridge.describe({ tool: "cmd", args: { code: "undo" } }), "cmd undo");
    eq(Bridge.describe({ tool: "ping" }), "ping");
    var long = new Array(12).join("x");
    ok(Bridge.short(long, 4).indexOf("xxxx…") === 0 && Bridge.short(long, 4).indexOf("共 11 字") > 0);
    eq(Bridge.short("短"), "短");
});
