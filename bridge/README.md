# 本地桥

这个文件夹是插件和本机其他程序（比如 Claude Code）之间的信箱。在插件「设置」里打开「本地桥」后：

- 对方把 `{"id": "...", "tool": "run_script", "args": {"code": "..."}}` 写进 `job.json`。
- 插件每半秒检查一次，读到就删掉 `job.json`，执行，把 `{"id", "tool", "ok", "text", "undoSteps", "ts"}` 写进 `result.json`。
- 插件每 5 秒更新 `state.json`（`on`、`ts`、当前谱名、选区）。`ts` 超过 15 秒没动就说明桥没开。

可用的 tool 和 AI 的一样：`get_score_info`、`read_score`、`select_range`、`run_script`、`cmd`、`inspect_api`、
`search_api_docs`、`fetch_source`、`search_source`、`load_skill`、`run_skill`、`search_skills`，另加 `ping`。

命令行客户端：`python dev/tools/bridge_client.py <插件目录> run_skill '{"name": "lyrics-to-tab"}'`。

这里的 json 文件都是临时的，不要提交。文件夹本身要存在（插件不能建文件夹）。
