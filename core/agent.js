.import "i18n.js" as I18n
// DeepSeek（OpenAI 兼容 chat/completions）客户端 + 工具调用循环。
// 只负责网络和循环，不碰谱面；工具由 QML 侧通过 execTool(name, args) 同步执行。
.pragma library

// 显示给用户的文字过字典（core/i18n.js）；语言由 QML 设定
function T(s) { return I18n.tr(s); }

function chat(cfg, messages, tools, done, opts) {
    opts = opts || {};
    var xhr = new XMLHttpRequest();
    var url = (cfg.baseUrl || "https://api.deepseek.com").replace(/\/+$/, "") + "/chat/completions";
    var finished = false;
    function finish(r) {
        if (finished) { return; }
        finished = true;
        done(r);
    }
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Authorization", "Bearer " + (cfg.apiKey || ""));
    xhr.timeout = cfg.timeoutMs || 180000;
    xhr.ontimeout = function () { finish({ error: T("请求超时") }); };
    xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) { return; }
        if (xhr.status === 0) { finish({ error: T("网络错误或请求被中止（status 0）") }); return; }
        var body = null;
        try { body = JSON.parse(xhr.responseText); } catch (e) { }
        if (xhr.status >= 400) {
            var detail = (body && body.error) ? (body.error.message || JSON.stringify(body.error)) : String(xhr.responseText).slice(0, 300);
            finish({ error: "HTTP " + xhr.status + ": " + detail });
            return;
        }
        if (!body) { finish({ error: T("响应不是 JSON: ") + String(xhr.responseText).slice(0, 300) }); return; }
        var choice = body.choices && body.choices[0];
        if (!choice || !choice.message) { finish({ error: T("响应里没有 choices[0].message") }); return; }
        finish({ message: choice.message, finishReason: choice.finish_reason, usage: body.usage });
    };
    var payload = {
        model: cfg.model || "deepseek-flash",
        messages: messages,
        stream: false,
        max_tokens: opts.maxTokens || cfg.maxTokens || 4096
    };
    // 总结、压缩这类请求不带工具
    if (tools && tools.length) {
        payload.tools = tools;
        payload.tool_choice = opts.toolChoice || "auto";
    }
    if (cfg.reasoningEffort) { payload.reasoning_effort = cfg.reasoningEffort; }
    xhr.send(JSON.stringify(payload));
    return xhr;
}

// 不带工具问一次，只要文字回复。done({text} | {error})；返回 { abort() }
function ask(cfg, messages, done, opts) {
    var aborted = false;
    var xhr = chat(cfg, messages, null, function (r) {
        if (aborted) { done({ error: T("已中止"), aborted: true }); return; }
        if (r.error) { done({ error: r.error }); return; }
        var text = r.message.content || "";
        if (!text) { done({ error: T("模型没有返回内容") + (r.finishReason ? T("（finish_reason: ") + r.finishReason + T("）") : "") }); return; }
        done({ text: text, truncated: r.finishReason === "length" });
    }, opts);
    return {
        abort: function () {
            aborted = true;
            try { xhr.abort(); } catch (e) { }
        }
    };
}

function assistantMessage(msg) {
    var m = { role: "assistant", content: (msg.content === undefined || msg.content === null) ? "" : msg.content };
    if (msg.reasoning_content) { m.reasoning_content = msg.reasoning_content; }
    if (msg.tool_calls && msg.tool_calls.length) { m.tool_calls = msg.tool_calls; }
    return m;
}

function asText(result) {
    if (typeof result === "string") { return result; }
    try { return JSON.stringify(result); } catch (e) { return String(result); }
}

// 跑完一轮：发消息 -> 有 tool_calls 就逐个执行并回传 -> 直到模型给出最终回复。
// messages 是完整对话数组（含 system），本函数原地 push。
// execTool(name, args) 返回字符串；要联网的工具返回 { pending: function (cb) {...}, abort: function () {...} }，结果出来后调 cb(字符串)。
// ev: { assistant(text), tool(name, args, result), error(msg), done({note, capped}) }
function runTurn(cfg, messages, tools, execTool, ev) {
    var state = { xhr: null, pending: null, aborted: false, iterations: 0, ended: false, openCalls: null };
    var maxIter = cfg.maxIterations || 15;
    var userDone = ev.done;
    var userError = ev.error;
    // done / error 只报一次
    ev = {
        assistant: ev.assistant, tool: ev.tool,
        done: function (info) { if (state.ended) { return; } state.ended = true; userDone(info); },
        error: function (e) { if (state.ended) { return; } state.ended = true; userError(e); }
    };

    // 中止时还没回传结果的工具调用补上占位结果，否则下一轮发给模型的对话不完整，接口会报错
    function closeOpenCalls() {
        var oc = state.openCalls;
        if (!oc) { return; }
        for (var i = oc.next; i < oc.calls.length; i++) {
            messages.push({ role: "tool", tool_call_id: oc.calls[i].id, content: T("ERROR: 用户中止了，这个工具没有执行完") });
        }
        state.openCalls = null;
    }

    function runCalls(calls, i) {
        if (state.aborted) { return; }
        if (i >= calls.length) { state.openCalls = null; step(); return; }
        state.openCalls = { calls: calls, next: i };
        var tc = calls[i];
        var fn = tc["function"] || {};
        var name = fn.name || "?";
        var args = {};
        var settled = false;
        function finish(result) {
            if (settled || state.aborted) { return; }
            settled = true;
            state.pending = null;
            result = asText(result);
            ev.tool(name, args, result);
            messages.push({ role: "tool", tool_call_id: tc.id, content: result });
            state.openCalls.next = i + 1;
            runCalls(calls, i + 1);
        }
        try {
            args = JSON.parse(fn.arguments ? fn.arguments : "{}");
        } catch (e) {
            finish(T("ERROR: 参数不是合法 JSON: ") + e);
            return;
        }
        var r;
        try { r = execTool(name, args); } catch (e2) { finish(T("ERROR: 工具执行异常: ") + e2); return; }
        if (r && typeof r === "object" && typeof r.pending === "function") {
            state.pending = r;
            try { r.pending(finish); } catch (e3) { finish(T("ERROR: 工具执行异常: ") + e3); }
        } else {
            finish(r);
        }
    }

    // 到上限时不直接停：让模型不带工具地说清楚做到哪一步、卡在哪里
    function summarize() {
        messages.push({
            role: "user",
            content: T("[插件提示] 这一轮的工具调用已经到上限（") + maxIter + T(" 次）。现在不要再调用工具。") +
                     T("请用中文简短说明：已经完成了什么、卡在哪里、建议我下一步怎么做。")
        });
        state.xhr = chat(cfg, messages, tools, function (r) {
            state.xhr = null;
            if (state.aborted) { ev.done({ note: T("已中止") }); return; }
            if (r.error) { ev.error(r.error); return; }
            var m = assistantMessage(r.message);
            delete m.tool_calls;
            messages.push(m);
            if (m.content) { ev.assistant(m.content); }
            ev.done({ capped: true, note: T("这一轮的工具调用到上限了（") + maxIter + T(" 次）。点「继续」可以让它接着做。") });
        }, { toolChoice: "none" });
    }

    function step() {
        if (state.aborted) { ev.done({ note: T("已中止") }); return; }
        if (state.iterations >= maxIter) { summarize(); return; }
        state.iterations++;
        state.xhr = chat(cfg, messages, tools, function (r) {
            state.xhr = null;
            if (state.aborted) { ev.done({ note: T("已中止") }); return; }
            if (r.error) { ev.error(r.error); return; }
            var assistant = assistantMessage(r.message);
            messages.push(assistant);
            if (assistant.content) { ev.assistant(assistant.content); }
            if (!assistant.tool_calls) { ev.done({}); return; }
            runCalls(assistant.tool_calls, 0);
        });
    }

    step();
    return {
        abort: function () {
            if (state.aborted) { return; }
            state.aborted = true;
            if (state.xhr) { try { state.xhr.abort(); } catch (e) { } }
            if (state.pending) {
                // 正在等联网工具：它的回调会被忽略，这里直接收尾
                try { if (state.pending.abort) { state.pending.abort(); } } catch (e2) { }
                state.pending = null;
            }
            closeOpenCalls();
            ev.done({ note: T("已中止") });
        }
    };
}
