.import "i18n.js" as I18n
// 本地技能。格式遵循 Agent Skills 开放标准（https://agentskills.io/specification）：
//
//   skills/<name>/SKILL.md          标准文件夹格式，下载来的技能直接放进来
//   skills/<name>/scripts/lib.js    可选：函数库，load_skill 之后在 run_script 里可直接调用
//   skills/<name>/scripts/run.js    可选：直接运行的脚本，按钮、/name、run_skill 会执行它
//   skills/<name>.md                单文件格式。插件没法新建文件夹，所以自己创建的技能存成这种
//
// SKILL.md 的 YAML 头：name、description 必填；本插件额外读 metadata.button（按钮文字）、
// metadata.cmd（按钮直接派发的 MuseScore 动作代码）和 metadata.requires（依赖的技能名，空格隔开：
// 运行前会先载入那些技能的函数库）。
// 脚本也可以直接写在 SKILL.md 正文里：```js lib … ``` 是函数库，```js run … ``` 是直接运行的脚本。
.pragma library

// 显示给用户的文字过字典（core/i18n.js）；语言由 QML 设定
function T(s) { return I18n.tr(s); }

// 英文界面下优先用 SKILL.md 里的 description_en / button_en
function skDesc(s) { return (I18n.currentLang() === "en" && s.description_en) ? s.description_en : (s.description || ""); }
function skButton(s) { return (I18n.currentLang() === "en" && s.button_en) ? s.button_en : (s.button || ""); }

var NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
var BLOCK_RE = /```(?:js|javascript)[ \t]+(lib|run)[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*/g;

// ---------------------------------------------------------------- 解析

function unquote(s) {
    s = String(s).trim();
    if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
        try { return JSON.parse(s); } catch (e) { return s.substring(1, s.length - 1); }
    }
    if (s.length >= 2 && s[0] === "'" && s[s.length - 1] === "'") {
        return s.substring(1, s.length - 1).replace(/''/g, "'");
    }
    return s.replace(/\s+#.*$/, "");
}

// 只支持 SKILL.md 用得到的那部分 YAML：顶层 key: value、一层嵌套的 map、| 和 > 多行文本
function parseFrontmatter(text) {
    text = String(text || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
    var m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
    if (!m) { return { meta: null, body: text }; }
    var meta = {};
    var lines = m[1].split("\n");
    var i = 0;
    while (i < lines.length) {
        var line = lines[i];
        if (!line.trim() || /^\s*#/.test(line)) { i++; continue; }
        var km = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/.exec(line);
        if (!km) { i++; continue; }
        var key = km[1];
        var rest = km[2];
        if (rest.trim() === "") {
            var map = {};
            i++;
            while (i < lines.length && (/^\s+\S/.test(lines[i]) || !lines[i].trim())) {
                var sm = /^\s+([A-Za-z0-9_.-]+):[ \t]*(.*)$/.exec(lines[i]);
                if (sm) { map[sm[1]] = unquote(sm[2]); }
                i++;
            }
            meta[key] = map;
            continue;
        }
        if (/^[|>][+-]?$/.test(rest.trim())) {
            var folded = rest.trim()[0] === ">";
            var buf = [];
            i++;
            while (i < lines.length && (/^\s+/.test(lines[i]) || !lines[i].trim())) {
                buf.push(lines[i].trim());
                i++;
            }
            meta[key] = folded ? buf.join(" ").replace(/\s+/g, " ").trim() : buf.join("\n").trim();
            continue;
        }
        meta[key] = unquote(rest);
        i++;
    }
    return { meta: meta, body: text.substring(m[0].length) };
}

// serialize() 在脚本块前面自动加的小标题。读回来时去掉，否则每编辑一次就多一份。
var LIB_HEAD_RE = /(^|\n)## 函数库\n+(?:加载这个技能后，下面的函数可以在 run_script 里直接调用。\n+)?(?=```(?:js|javascript)[ \t]+lib)/g;
var RUN_HEAD_RE = /(^|\n)## 直接运行的脚本\n+(?:点按钮、输入 \/\S+ 或模型调用 run_skill 时执行，作用于当前选区。\n+)?(?=```(?:js|javascript)[ \t]+run)/g;

function extractBlocks(body) {
    var out = { lib: "", run: "", instructions: "" };
    var text = String(body || "").replace(LIB_HEAD_RE, "$1").replace(RUN_HEAD_RE, "$1");
    out.instructions = text.replace(BLOCK_RE, function (all, kind, code) {
        out[kind] += (out[kind] ? "\n" : "") + code;
        return "";
    }).replace(/\n{3,}/g, "\n\n").trim();
    return out;
}

// entry: { kind: "folder" | "file", id, rel, dir }
function parse(entry, text, readFile) {
    var fm = parseFrontmatter(text);
    if (!fm.meta) { return { error: T("开头没有用 --- 包起来的 YAML 头") }; }
    var meta = fm.meta;
    var md = (meta.metadata && typeof meta.metadata === "object") ? meta.metadata : {};
    var blocks = extractBlocks(fm.body);
    var sk = {
        id: entry.id,
        kind: entry.kind,
        path: entry.rel,
        dir: entry.dir || "",
        name: String(meta.name || "").trim(),
        description: String(meta.description || "").trim(),
        description_en: String(meta.description_en || "").trim(),
        compatibility: String(meta.compatibility || ""),
        button: String(md.button || "").trim(),
        button_en: String(md.button_en || "").trim(),
        cmd: String(md.cmd || "").trim(),
        requires: splitNames(md.requires),
        instructions: blocks.instructions,
        lib: blocks.lib,
        run: blocks.run,
        libFile: false,
        runFile: false,
        warning: ""
    };
    if (!sk.name) { return { error: T("YAML 头里没有 name") }; }
    if (!sk.description) { return { error: T("YAML 头里没有 description") }; }
    if (entry.kind === "folder") {
        var lib = readFile(entry.dir + "scripts/lib.js");
        if (lib) { sk.lib = (sk.lib ? sk.lib + "\n" : "") + lib; sk.libFile = true; }
        var run = readFile(entry.dir + "scripts/run.js");
        if (run) { sk.run = run; sk.runFile = true; }
    }
    if (sk.name !== entry.id) {
        sk.warning = T("name（") + sk.name + T("）和") + (entry.kind === "folder" ? T("文件夹名") : T("文件名")) + T("（") + entry.id + T("）不一致");
    }
    return sk;
}

// ---------------------------------------------------------------- 校验与保存

function splitNames(v) {
    if (Array.isArray(v)) { return v.map(function (x) { return String(x).trim(); }).filter(function (x) { return x.length > 0; }); }
    return String(v || "").split(/[\s,，、]+/).filter(function (x) { return x.length > 0; });
}

function validate(s, cmdAllowed) {
    if (!s.name) { return T("名称不能为空"); }
    if (s.name.length > 64 || !NAME_RE.test(s.name)) {
        return T("名称只能用小写字母、数字和连字符，不能以连字符开头或结尾，最长 64 个字符，例如 strum-pattern");
    }
    if (!s.description) { return T("描述不能为空：写清楚这个技能做什么、什么时候用"); }
    if (s.description.length > 1024) { return T("描述最长 1024 个字符"); }
    if (s.button && !s.run && !s.cmd) { return T("要显示成按钮，需要有直接运行的脚本或动作代码"); }
    if (s.cmd && cmdAllowed && !cmdAllowed(s.cmd)) { return T("不允许的动作代码: ") + s.cmd; }
    return "";
}

function yamlStr(v) {
    return JSON.stringify(String(v).replace(/\r?\n/g, " "));
}

function serialize(s, opts) {
    opts = opts || {};
    var lines = ["---", "name: " + s.name, "description: " + yamlStr(s.description)];
    if (s.description_en) { lines.push("description_en: " + yamlStr(s.description_en)); }
    lines.push("compatibility: " + yamlStr(s.compatibility || T("MuseScore Studio 4.6+ 的 AI 助手插件")));
    var md = [];
    if (s.button) { md.push("  button: " + yamlStr(s.button)); }
    if (s.button_en) { md.push("  button_en: " + yamlStr(s.button_en)); }
    if (s.cmd) { md.push("  cmd: " + yamlStr(s.cmd)); }
    var req = splitNames(s.requires);
    if (req.length) { md.push("  requires: " + yamlStr(req.join(" "))); }
    if (md.length) { lines.push("metadata:"); lines = lines.concat(md); }
    lines.push("---", "");
    var body = String(s.instructions || "").trim();
    if (!body) { body = "# " + s.name + "\n\n" + s.description; }
    var text = lines.join("\n") + body + "\n";
    if (s.lib && s.lib.trim() && opts.embedLib !== false) {
        text += T("\n## 函数库\n\n加载这个技能后，下面的函数可以在 run_script 里直接调用。\n\n```js lib\n") + s.lib.trim() + "\n```\n";
    }
    if (s.run && s.run.trim() && opts.embedRun !== false) {
        text += T("\n## 直接运行的脚本\n\n点按钮、输入 /") + s.name + T(" 或模型调用 run_skill 时执行，作用于当前选区。\n\n```js run\n") + s.run.trim() + "\n```\n";
    }
    return text;
}

// 保存时要写哪些文件。target 是被编辑的原技能，新建时为 null。
function plan(s, target) {
    if (target && target.kind === "folder") {
        var files = [{ rel: target.dir + "SKILL.md", text: serialize(s, { embedLib: !target.libFile, embedRun: !target.runFile }) }];
        if (target.libFile) { files.push({ rel: target.dir + "scripts/lib.js", text: s.lib || "" }); }
        if (target.runFile) { files.push({ rel: target.dir + "scripts/run.js", text: s.run || "" }); }
        return { files: files, remove: [], path: target.dir + "SKILL.md" };
    }
    var rel = "skills/" + s.name + ".md";
    var remove = (target && target.kind === "file" && target.path !== rel) ? [target.path] : [];
    return { files: [{ rel: rel, text: serialize(s) }], remove: remove, path: rel };
}

// ---------------------------------------------------------------- 查找

function find(skills, name) {
    for (var i = 0; i < skills.length; i++) {
        if (skills[i].name === name || skills[i].id === name) { return skills[i]; }
    }
    return null;
}

// ---------------------------------------------------------------- 搜索
//
// 记不清名字也能找：名字、按钮文字、描述、使用说明、脚本都搜。
// 1. 先按词搜：空格隔开的每个词都要在某处出现，命中名字的排在最前。
// 2. 一个都没搜到时模糊匹配：中文按字算，记得一半以上的字就算；英文按字母顺序匹配名字，比如 strm 能找到 strum-pattern。

var STOP_CHARS = "的了把将成为和与给我你一个这那吗呢吧啊是要用让帮找有没哪什么技能";

function byName(a, b) { return a.skill.name.localeCompare(b.skill.name); }

function fieldsOf(s, only) {
    var fs = [
        { key: "name", raw: s.name || "", w: 8 },
        { key: "button", raw: s.button || "", w: 6 },
        { key: "description", raw: s.description || "", w: 4 },
        { key: "instructions", raw: s.instructions || "", w: 2 },
        { key: "script", raw: (s.run || "") + "\n" + (s.lib || ""), w: 1 }
    ];
    fs.forEach(function (f) { f.text = f.raw.toLowerCase(); });
    return only ? fs.filter(function (f) { return only.indexOf(f.key) >= 0; }) : fs;
}

function snippetAt(raw, idx, len) {
    var start = Math.max(0, idx - 18);
    var end = Math.min(raw.length, idx + len + 18);
    var s = raw.substring(start, end).replace(/\s+/g, " ").trim();
    return (start > 0 ? "…" : "") + s + (end < raw.length ? "…" : "");
}

function isSubsequence(needle, hay) {
    var j = 0;
    for (var i = 0; i < hay.length && j < needle.length; i++) {
        if (hay[i] === needle[j]) { j++; }
    }
    return j === needle.length;
}

// 返回 [{ skill, score, fuzzy, field, snippet }]，按相关度排序。
// opts.fields 限定搜哪些字段；opts.fuzzy === false 关掉模糊匹配。
function searchDetailed(skills, q, opts) {
    opts = opts || {};
    var query = String(q || "").toLowerCase().trim();
    if (!query) {
        return skills.map(function (s) { return { skill: s, score: 0, fuzzy: false, field: "", snippet: "" }; }).sort(byName);
    }
    var tokens = query.split(/\s+/).filter(function (t) { return t.length > 0; });

    var exact = [];
    skills.forEach(function (s) {
        var fs = fieldsOf(s, opts.fields);
        var total = 0;
        var weakest = null;
        var allHit = tokens.every(function (t) {
            var best = null;
            fs.forEach(function (f) {
                var i = f.text.indexOf(t);
                if (i < 0) { return; }
                var w = f.w + ((f.key === "name" && i === 0) ? 4 : 0);
                if (!best || w > best.w) { best = { w: w, f: f, i: i, t: t }; }
            });
            if (!best) { return false; }
            total += best.w;
            if (!weakest || best.f.w < weakest.f.w) { weakest = best; }
            return true;
        });
        if (!allHit) { return; }
        // 只有命中在说明或脚本里时才给片段，名字和描述卡片上本来就看得到
        var snip = (weakest.f.key === "instructions" || weakest.f.key === "script") ? snippetAt(weakest.f.raw, weakest.i, weakest.t.length) : "";
        exact.push({ skill: s, score: total, fuzzy: false, field: weakest.f.key, snippet: snip });
    });
    if (exact.length || opts.fuzzy === false) {
        return exact.sort(function (a, b) { return (b.score - a.score) || byName(a, b); });
    }

    // 模糊匹配
    var units = [];
    tokens.forEach(function (t) {
        var ascii = t.replace(/[^a-z0-9-]/g, "");
        if (ascii.length >= 2) { units.push({ kind: "word", v: ascii }); }
        t.split("").forEach(function (c) {
            if (!/[㐀-鿿]/.test(c) || STOP_CHARS.indexOf(c) >= 0) { return; }
            if (!units.some(function (u) { return u.v === c; })) { units.push({ kind: "char", v: c }); }
        });
    });
    if (!units.length) { return []; }
    var fuzzy = [];
    skills.forEach(function (s) {
        var fs = fieldsOf(s, opts.fields);
        var all = fs.map(function (f) { return f.text; }).join("\n");
        var short = fs.filter(function (f) { return f.key === "name" || f.key === "button"; }).map(function (f) { return f.text; });
        var hit = units.filter(function (u) {
            if (u.kind === "char") { return all.indexOf(u.v) >= 0; }
            return all.indexOf(u.v) >= 0 || short.some(function (x) { return isSubsequence(u.v, x); });
        }).length;
        var ratio = hit / units.length;
        if (hit > 0 && ratio >= 0.5) {
            fuzzy.push({ skill: s, score: ratio * 10, fuzzy: true, field: "", snippet: "" });
        }
    });
    return fuzzy.sort(function (a, b) { return (b.score - a.score) || byName(a, b); });
}

function search(skills, q, opts) {
    return searchDetailed(skills, q, opts).map(function (r) { return r.skill; });
}

// 给模型看的搜索结果
function searchText(skills, q, limit) {
    var rs = searchDetailed(skills, q).slice(0, limit || 8);
    if (!rs.length) { return T("没有找到和「") + q + T("」相关的技能。现有技能：") + (skills.map(function (s) { return s.name; }).join(", ") || T("无")); }
    var lines = [(rs[0].fuzzy ? T("没有完全匹配，下面是相近的") : T("找到 ") + rs.length + T(" 个")) + T("：")];
    rs.forEach(function (r) {
        var s = r.skill;
        lines.push("- " + s.name + (skButton(s) ? T("（按钮「") + skButton(s) + T("」）") : "") + T("：") + skDesc(s) +
                   (r.snippet ? T("  匹配处：") + r.snippet : "") + (runnable(s) ? T(" [可直接运行]") : ""));
    });
    return lines.join("\n");
}

// /xxx 里的 xxx：先精确匹配名字或按钮文字，再看名字、按钮、描述里是否只有一个命中。不做模糊匹配，免得跑错技能。
function resolve(skills, token) {
    var exact = find(skills, token);
    if (exact) { return exact; }
    for (var i = 0; i < skills.length; i++) {
        if (skills[i].button === token || (skills[i].button_en && skills[i].button_en === token)) { return skills[i]; }
    }
    var hits = search(skills, token, { fields: ["name", "button", "description"], fuzzy: false });
    return hits.length === 1 ? hits[0] : null;
}

function runnable(s) { return !!(s.run || s.cmd); }

function catalogText(skills) {
    if (!skills || !skills.length) { return T("\n\n（用户还没有本地技能。）"); }
    var lines = ["", "", T("用户的本地技能（name：描述）：")];
    skills.forEach(function (s) {
        lines.push("- " + s.name + T("：") + skDesc(s) + (runnable(s) ? T(" [可直接运行]") : (s.lib ? T(" [函数库]") : "")) +
                   (s.requires && s.requires.length ? T(" [依赖 ") + s.requires.join(", ") + "]" : ""));
    });
    return lines.join("\n");
}

// 技能连同它依赖的技能，依赖排在前面。missing 收集找不到的依赖名。
function withDeps(skills, sk, missing) {
    var out = [];
    var seen = {};
    function visit(s) {
        if (seen[s.name]) { return; }
        seen[s.name] = true;
        (s.requires || []).forEach(function (n) {
            var d = find(skills, n);
            if (d) { visit(d); } else if (missing && missing.indexOf(n) < 0) { missing.push(n); }
        });
        out.push(s);
    }
    visit(sk);
    return out;
}

// 直接运行一个技能时要拼在前面的函数库：依赖的在前，自己的在后
function libChain(skills, sk, missing) {
    return withDeps(skills, sk, missing).filter(function (s) { return s.lib; }).map(function (s) {
        return "// ---- skill: " + s.name + " ----\n" + s.lib;
    }).join("\n");
}

function prelude(loaded) {
    var parts = [];
    Object.keys(loaded).forEach(function (k) {
        if (loaded[k].lib) { parts.push("// ---- skill: " + k + " ----\n" + loaded[k].lib); }
    });
    return parts.join("\n");
}
