# 接口清单

`api-<版本>.json` 由 `dev/tools/build_api_docs.py` 从对应版本的 MuseScore 源码生成。插件里的 AI 用 search_api_docs 工具查这份清单，不用凭记忆猜接口。
清单里有：

- 插件接口的类、属性、方法、枚举（`src/engraving/api/v1/`），带「几点几版起」的标注和源码行号；
- 全部动作代码（cmd），带英文名和中文菜单名（来自 `share/locale/musescore_zh_CN.ts`）。

插件启动时先找和正在运行的 MuseScore 同版本的清单。找不到时，按 `index.json` 里的顺序选一份。

## 升级 MuseScore 之后

需要 Python 3，不用装别的：

```
python dev/tools/build_api_docs.py v4.7.5
```

然后把 `"4.7.5"` 加到 `index.json` 的最前面。旧版本的清单可以留着。
