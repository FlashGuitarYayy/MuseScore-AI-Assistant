.import "i18n.js" as I18n
// 联网的几件事：读 MuseScore 源码、GitHub 代码搜索、从网址获取技能。
// 只发 GET 请求；回调风格（QML 的 XMLHttpRequest 不支持同步请求）。
.pragma library

// 显示给用户的文字过字典（core/i18n.js）；语言由 QML 设定
function T(s) { return I18n.tr(s); }

var MAX_CHARS = 8000;

function get(url, headers, cb, timeoutMs) {
    var xhr = new XMLHttpRequest();
    var finished = false;
    function finish(r) {
        if (finished) { return; }
        finished = true;
        cb(r);
    }
    xhr.open("GET", url);
    for (var k in (headers || {})) { xhr.setRequestHeader(k, headers[k]); }
    xhr.timeout = timeoutMs || 30000;
    xhr.ontimeout = function () { finish({ status: 0, error: T("请求超时") }); };
    xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) { return; }
        if (xhr.status === 0) { finish({ status: 0, error: T("网络错误或请求被中止") }); return; }
        finish({ status: xhr.status, text: xhr.responseText });
    };
    xhr.send();
    return { abort: function () { try { xhr.abort(); } catch (e) { } } };
}

function getJson(url, headers, cb) {
    return get(url, headers, function (r) {
        if (r.error) { cb({ error: r.error, status: r.status }); return; }
        var body = null;
        try { body = JSON.parse(r.text); } catch (e) { }
        if (r.status >= 400) {
            cb({ error: "HTTP " + r.status + (body && body.message ? ": " + body.message : ""), status: r.status, body: body });
            return;
        }
        if (body === null) { cb({ error: T("返回的不是 JSON"), status: r.status }); return; }
        cb({ body: body, status: r.status });
    });
}

function githubHeaders(token) {
    var h = { "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (token) { h["Authorization"] = "Bearer " + token; }
    return h;
}

// ---------------------------------------------------------------- 读源码

// 只允许仓库里的相对路径
function cleanPath(p) {
    p = String(p || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
    if (!p || /(^|\/)\.\.(\/|$)/.test(p) || !/^[\w.\/+@-]+$/.test(p)) { return ""; }
    return p;
}

function rawUrl(repo, ref, path) {
    return "https://raw.githubusercontent.com/" + repo + "/" + ref + "/" + path;
}

function numbered(lines, from, to) {
    var out = [];
    for (var i = from; i <= to && i <= lines.length; i++) {
        var t = lines[i - 1];
        if (t.length > 300) { t = t.substring(0, 300) + " …"; }
        out.push(pad(i) + "| " + t);
    }
    return out;
}

function pad(n) { var s = String(n); while (s.length < 5) { s = " " + s; } return s; }

function capText(s) {
    return s.length > MAX_CHARS ? s.substring(0, MAX_CHARS) + T("\n…(太长，截断了。用 grep 或 from_line/to_line 缩小范围)") : s;
}

// args: { grep, around, from_line, to_line }；grep 是不区分大小写的普通字符串，写成 /…/ 就当正则
function formatSource(text, label, args) {
    args = args || {};
    var lines = String(text).split("\n");
    var head = label + T("（共 ") + lines.length + T(" 行）");
    if (args.grep) {
        var rx;
        var g = String(args.grep);
        var m = /^\/(.+)\/([a-z]*)$/.exec(g);
        try {
            rx = m ? new RegExp(m[1], m[2].indexOf("i") >= 0 ? "i" : "") : new RegExp(g.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        } catch (e) { return T("ERROR: grep 不是合法的正则: ") + e; }
        var around = Math.max(0, Math.min(15, args.around === undefined ? 3 : Number(args.around) || 0));
        var hits = [];
        for (var i = 0; i < lines.length; i++) { if (rx.test(lines[i])) { hits.push(i + 1); } }
        if (!hits.length) { return head + T("，没有匹配「") + g + T("」的行。"); }
        var out = [];
        var lastEnd = 0;
        var shown = 0;
        for (var j = 0; j < hits.length && shown < 40; j++, shown++) {
            var a = Math.max(lastEnd + 1, hits[j] - around);
            var b = Math.min(lines.length, hits[j] + around);
            if (a > lastEnd + 1 && out.length) { out.push("  ..."); }
            out = out.concat(numbered(lines, a, b));
            lastEnd = Math.max(lastEnd, b);
        }
        return capText(head + T("，匹配「") + g + T("」") + hits.length + T(" 处") + (hits.length > shown ? T("（只显示前 ") + shown + T(" 处）") : "") + T("：\n") + out.join("\n"));
    }
    var from = Math.max(1, Number(args.from_line) || 1);
    var to = Number(args.to_line) || (args.from_line ? from + 199 : 0);
    if (!to) { to = lines.length <= 200 ? lines.length : 120; }
    to = Math.min(lines.length, to, from + 399);
    var tail = to < lines.length ? T("\n…(后面还有 ") + (lines.length - to) + T(" 行，用 from_line/to_line 或 grep 看)") : "";
    return capText(head + T("，第 ") + from + "-" + to + T(" 行：\n") + numbered(lines, from, to).join("\n") + tail);
}

var sourceCache = {};
var cacheKeys = [];

// done(text)；返回 { abort }
function fetchSource(cfg, args, done) {
    var path = cleanPath(args.path);
    if (!path) { done(T("ERROR: path 要写成仓库里的相对路径，例如 src/engraving/api/v1/score.h")); return null; }
    var repo = cfg.sourceRepo || "musescore/MuseScore";
    var ref = cfg.sourceRef || "v4.6.3";
    var url = rawUrl(repo, ref, path);
    var label = path + " @ " + ref;
    if (sourceCache[url] !== undefined) { done(formatSource(sourceCache[url], label, args)); return null; }
    return get(url, {}, function (r) {
        if (r.error) { done("ERROR: " + r.error); return; }
        if (r.status === 404) { done("ERROR: " + ref + T(" 里没有 ") + path + T("。文件可能在别的目录（4.x 和 5.0 的目录结构不同）；用 search_api_docs 看接口所在的文件，或者 search_source 搜。")); return; }
        if (r.status >= 400) { done("ERROR: HTTP " + r.status); return; }
        sourceCache[url] = r.text;
        cacheKeys.push(url);
        if (cacheKeys.length > 30) { delete sourceCache[cacheKeys.shift()]; }
        done(formatSource(r.text, label, args));
    });
}

// ---------------------------------------------------------------- 代码搜索（需要 GitHub token）

function searchSource(cfg, query, done) {
    query = String(query || "").trim();
    if (!query) { done(T("ERROR: 缺少 query")); return null; }
    if (!cfg.githubToken) {
        done(T("ERROR: 没有设置 GitHub token，搜不了代码（GitHub 的代码搜索必须登录）。可以先用 search_api_docs 查接口清单，") +
             T("或者用 fetch_source 按文件路径读源码。用户想开这个功能的话，请他在「设置」里填 GitHub token。"));
        return null;
    }
    var repo = cfg.githubSearchRepo || "musescore/MuseScore";
    var url = "https://api.github.com/search/code?per_page=10&q=" + encodeURIComponent(query + " repo:" + repo);
    var h = githubHeaders(cfg.githubToken);
    h["Accept"] = "application/vnd.github.text-match+json";
    return getJson(url, h, function (r) {
        if (r.error) {
            var hint = r.status === 401 ? T("（token 无效或过期）") : r.status === 403 ? T("（超过频率限制：代码搜索每分钟最多 10 次，稍等再试）") : r.status === 422 ? T("（查询写法不对，或者这个仓库还没被 GitHub 索引）") : "";
            done(T("ERROR: GitHub 代码搜索失败: ") + r.error + hint);
            return;
        }
        done(formatSearch(r.body, repo, cfg.sourceRef || "v4.6.3"));
    });
}

function formatSearch(body, repo, ref) {
    var items = (body && body.items) || [];
    if (!items.length) { return T("在 ") + repo + T(" 里没有搜到。换个关键词，或者用 search_api_docs。"); }
    var out = [T("在 ") + repo + T(" 的默认分支里找到 ") + body.total_count + T(" 个文件") + (body.total_count > items.length ? T("（显示前 ") + items.length + T(" 个）") : "") + T("：")];
    items.forEach(function (it) {
        out.push("- " + it.path);
        (it.text_matches || []).slice(0, 2).forEach(function (tm) {
            var frag = String(tm.fragment || "").replace(/\s+/g, " ").trim();
            if (frag) { out.push("    " + (frag.length > 240 ? frag.substring(0, 240) + "…" : frag)); }
        });
    });
    if (repo === "musescore/MuseScore") {
        out.push(T("注意：搜的是 MuseScore 官方仓库的默认分支（开发中的新版本），不一定和 ") + ref + T(" 一样。用 fetch_source 读 ") + ref + T(" 的同名文件确认；文件不存在就说明 ") + ref + T(" 里在别的位置。"));
    }
    return capText(out.join("\n"));
}

// ---------------------------------------------------------------- 从网址获取技能

// 把各种 GitHub 链接整理成能下载的形式
function skillSource(url) {
    url = String(url || "").trim();
    var m;
    if (!/^https:\/\//i.test(url)) { return { error: "要以 https:// 开头" }; }
    if ((m = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/i.exec(url))) {
        return { kind: "file", url: rawUrl(m[1] + "/" + m[2], m[3], m[4]) };
    }
    if ((m = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)\/(.+?)\/?$/i.exec(url))) {
        return { kind: "folder", api: "https://api.github.com/repos/" + m[1] + "/" + m[2] + "/contents/" + m[4] + "?ref=" + encodeURIComponent(m[3]) };
    }
    if ((m = /^https:\/\/gist\.github\.com\/(?:[^\/]+\/)?([0-9a-f]+)\/?$/i.exec(url))) {
        return { kind: "gist", api: "https://api.github.com/gists/" + m[1] };
    }
    if (/^https:\/\/github\.com\//i.test(url)) {
        return { error: T("GitHub 链接要指向 SKILL.md 文件（…/blob/…）或技能文件夹（…/tree/…）") };
    }
    return { kind: "file", url: url };
}

// done({ text, lib, run, from } | { error })；返回 { abort }
function fetchSkill(url, token, done) {
    var src = skillSource(url);
    if (src.error) { done({ error: src.error }); return null; }
    var current = null;
    var handle = { abort: function () { if (current) { current.abort(); } } };
    function getText(u, cb) {
        current = get(u, {}, function (r) {
            if (r.error) { done({ error: r.error }); return; }
            if (r.status >= 400) { done({ error: "HTTP " + r.status + T("：") + u }); return; }
            cb(r.text);
        });
    }
    if (src.kind === "file") {
        getText(src.url, function (t) { done({ text: t, lib: "", run: "", from: src.url }); });
        return handle;
    }
    if (src.kind === "gist") {
        current = getJson(src.api, githubHeaders(token), function (r) {
            if (r.error) { done({ error: r.error }); return; }
            var files = r.body.files || {};
            var names = Object.keys(files);
            var md = names.filter(function (n) { return /^skill\.md$/i.test(n); })[0] || names.filter(function (n) { return /\.md$/i.test(n); })[0];
            if (!md) { done({ error: T("gist 里没有 .md 文件") }); return; }
            function content(re) {
                var n = names.filter(function (x) { return re.test(x); })[0];
                return n ? String(files[n].content || "") : "";
            }
            done({ text: String(files[md].content || ""), lib: content(/(^|[-_.])lib\.js$/i), run: content(/(^|[-_.])run\.js$/i), from: url });
        });
        return handle;
    }
    // 文件夹：列出 SKILL.md 和 scripts/ 里的脚本
    current = getJson(src.api, githubHeaders(token), function (r) {
        if (r.error) { done({ error: r.error + (r.status === 403 ? T("（GitHub 匿名访问每小时 60 次，填了 token 会多很多）") : "") }); return; }
        var list = Array.isArray(r.body) ? r.body : [];
        var md = list.filter(function (x) { return x.type === "file" && /^skill\.md$/i.test(x.name); })[0];
        if (!md) { done({ error: T("这个文件夹里没有 SKILL.md") }); return; }
        var scripts = list.filter(function (x) { return x.type === "dir" && x.name === "scripts"; })[0];
        getText(md.download_url, function (text) {
            if (!scripts) { done({ text: text, lib: "", run: "", from: url }); return; }
            current = getJson(scripts.url, githubHeaders(token), function (r2) {
                var files = (r2.body && Array.isArray(r2.body)) ? r2.body : [];
                var lib = files.filter(function (x) { return x.name === "lib.js"; })[0];
                var run = files.filter(function (x) { return x.name === "run.js"; })[0];
                var result = { text: text, lib: "", run: "", from: url };
                function next() {
                    if (lib) { var l = lib; lib = null; getText(l.download_url, function (t) { result.lib = t; next(); }); return; }
                    if (run) { var u = run; run = null; getText(u.download_url, function (t) { result.run = t; next(); }); return; }
                    done(result);
                }
                next();
            });
        });
    });
    return handle;
}
