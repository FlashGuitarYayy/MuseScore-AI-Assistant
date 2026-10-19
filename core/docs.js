.import "i18n.js" as I18n
// 插件接口清单（docs/api-<版本>.json，由 dev/tools/build_api_docs.py 从 MuseScore 源码生成）的查询。
// 给 search_api_docs 工具用：模型不用凭记忆猜接口，查这份按用户所装版本生成的清单。
.pragma library

// 显示给用户的文字过字典（core/i18n.js）；语言由 QML 设定
function T(s) { return I18n.tr(s); }

function kindLabel(k) {
    var m = { "class": "类", prop: "属性", method: "方法", "enum": "枚举", action: "动作" };
    return T(m[k] || k);
}

function parse(text) {
    var d = JSON.parse(text);
    if (!d || !Array.isArray(d.entries)) { throw new Error(T("不是接口清单")); }
    d.entries.forEach(function (e) {
        e._n = String(e.n || "").toLowerCase();
        e._c = String(e.c || "").toLowerCase();
        e._s = String(e.s || "").toLowerCase();
        e._d = String(e.d || "").toLowerCase();
        e._zh = String(e.zh || "");
        e._m = String(e.m || "").toLowerCase();
    });
    return d;
}

function isCjk(t) { return /[㐀-鿿]/.test(t); }

// 一个词在一条记录里的得分；0 表示没匹配上
function tokenScore(e, t) {
    var s = 0;
    if (e._n === t) { s += 30; } else if (e._n.indexOf(t) >= 0) { s += 12; }
    if (e._c === t) { s += 6; } else if (e._c.indexOf(t) >= 0) { s += 3; }
    if (e._zh.indexOf(t) >= 0) { s += 10; }
    if (e._d.indexOf(t) >= 0) { s += 4; }
    if (e._s.indexOf(t) >= 0) { s += 2; }
    if (e._m) {
        if ((" " + e._m + " ").indexOf(" " + t + " ") >= 0) { s += 25; }   // 正好是某个枚举值
        else if (e._m.indexOf(t) >= 0) { s += 3; }
    }
    return s;
}

// 中文没有空格：按字算覆盖率
function fuzzyScore(e, q) {
    var chars = q.replace(/\s+/g, "").split("").filter(isCjk);
    if (chars.length < 2) { return 0; }
    var hay = e._zh + e._d;
    var hit = chars.filter(function (ch) { return hay.indexOf(ch) >= 0; }).length;
    return hit / chars.length >= 0.6 ? hit : 0;
}

function search(doc, query, limit) {
    var q = String(query || "").trim().toLowerCase();
    if (!q) { return { results: [], fuzzy: false }; }
    var tokens = q.split(/[\s,，、]+/).filter(function (x) { return x.length > 0; });
    var out = [];
    doc.entries.forEach(function (e) {
        var total = 0;
        for (var i = 0; i < tokens.length; i++) {
            var s = tokenScore(e, tokens[i]);
            if (!s) { return; }
            total += s;
        }
        out.push({ e: e, score: total });
    });
    var fuzzy = false;
    if (!out.length) {
        fuzzy = true;
        doc.entries.forEach(function (e) {
            var s = fuzzyScore(e, q);
            if (s) { out.push({ e: e, score: s }); }
        });
    }
    out.sort(function (a, b) { return (b.score - a.score) || a.e.n.localeCompare(b.e.n); });
    return { results: out.slice(0, limit || 12), total: out.length, fuzzy: fuzzy, tokens: tokens };
}

function fileRef(e) {
    return e.f ? " [" + e.f + ":" + e.l + "]" : "";
}

function line(e, tokens) {
    var since = e.since ? T("（") + e.since + T(" 起）") : "";
    if (e.k === "action") {
        return T("[动作] ") + e.s + (e.zh ? T(" 「") + e.zh + T("」") : "") + (e.d ? " — " + e.d : "");
    }
    if (e.k === "enum") {
        var members = String(e.m || "").split(" ");
        var hit = members.filter(function (m) {
            var low = m.toLowerCase();
            return (tokens || []).some(function (t) { return low.indexOf(t) >= 0; });
        });
        var show = hit.length ? hit.slice(0, 30) : members.slice(0, 12);
        return T("[枚举] ") + e.s + T("：") + show.join(", ") + (members.length > show.length ? " …" : "") + fileRef(e);
    }
    if (e.k === "class") {
        return T("[类] ") + e.s + since + (e.d ? " — " + e.d : "") + fileRef(e);
    }
    var owner = e.c ? e.c + "." : "";
    var sig = e.s;
    if (e.k === "prop") {
        // "int keySignature（只读）" → "keySignature：int（只读）"
        var at = e.s.lastIndexOf(" " + e.n);
        sig = at > 0 ? e.n + T("：") + e.s.substring(0, at) + e.s.substring(at + 1 + e.n.length) + (e.w ? T("（可写）") : "") : e.s;
    }
    return "[" + kindLabel(e.k) + "] " + owner + sig + since + (e.d ? " — " + e.d : "") + fileRef(e);
}

// 查一个类的全部成员
function classSummary(doc, name) {
    var low = name.toLowerCase();
    var cls = doc.entries.filter(function (e) { return e.k === "class" && e._n === low; })[0];
    if (!cls) { return ""; }
    var members = doc.entries.filter(function (e) { return (e.k === "prop" || e.k === "method") && e._c === low; });
    var methods = members.filter(function (e) { return e.k === "method"; }).map(function (e) { return e.s + (e.since ? T("（") + e.since + T("）") : ""); });
    var props = members.filter(function (e) { return e.k === "prop"; }).map(function (e) { return e.s; });
    var out = [line(cls), T("方法（") + methods.length + T("）："), "  " + (methods.join("\n  ") || T("无")),
               T("属性（") + props.length + T("）："), "  " + (props.join("; ") || T("无"))];
    if (/^(chord|note|rest|chordrest|durationelement|measure|segment|staff|part|instrument)$/.test(low)) {
        out.push(T("（父类的成员没有列出：用 search_api_docs 查父类名，比如 EngravingItem）"));
    }
    return out.join("\n");
}

function searchText(doc, query, limit) {
    if (!doc) { return T("ERROR: 没有加载接口清单（docs/ 里没有 api-*.json）。用 inspect_api 查运行时接口。"); }
    var head = T("接口清单：MuseScore ") + doc.version + T("（源码 ") + doc.source + T("）\n");
    var q = String(query || "").trim();
    if (/^[A-Za-z]\w*$/.test(q)) {
        var cs = classSummary(doc, q);
        if (cs) { return head + cs; }
    }
    var r = search(doc, q, limit || 12);
    if (!r.results.length) {
        return head + T("没有找到「") + q + T("」。换英文接口名或中文菜单名再试；动作代码也可以按中文名搜，比如「拼写」「全选」。");
    }
    var lines = r.results.map(function (x) { return line(x.e, r.tokens); });
    return head + (r.fuzzy ? T("没有完全匹配，下面是相近的：") : T("找到 ") + r.total + T(" 条") + (r.total > r.results.length ? T("，显示前 ") + r.results.length + T(" 条") : "") + T("：")) +
           "\n" + lines.join("\n") +
           T("\n（方括号里是源码文件和行号，需要细节时用 fetch_source 读）");
}
