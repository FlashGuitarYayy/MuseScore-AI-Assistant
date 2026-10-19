// 界面文字的英文和繁体中文。键是简体原文；没翻到的条目回落到原文。
// 每一条是 [英文, 繁体]。繁体按台湾用法（復原、設定、儲存、資料夾、選取範圍、函式庫）。
// 只覆盖 AIAssistant.qml 里的界面文字；core/*.js 产生的工具结果和 system prompt 还是简体。
.pragma library

var STRINGS = {
    "AI 助手": ["AI Assistant", "AI 助手"],

    // ---- 顶栏、对话页 ----
    "● 思考中…": ["● Thinking…", "● 思考中…"],
    "桥 ●": ["Bridge ●", "橋接 ●"],
    "桥 ○": ["Bridge ○", "橋接 ○"],
    "本地桥已打开：会执行 bridge/job.json 里的任务。在「设置」里关":
        ["Local bridge is on: jobs in bridge/job.json will be executed. Turn it off in Settings",
         "本機橋接已開啟：會執行 bridge/job.json 裡的任務。在「設定」裡關"],
    "对话": ["Chat", "對話"],
    "技能 ": ["Skills ", "技能 "],
    "设置": ["Settings", "設定"],
    "贴底": ["Dock bottom", "貼底"],
    "置顶 ✓": ["On top ✓", "置頂 ✓"],
    "置顶": ["On top", "置頂"],
    "现在浮在 MuseScore 上面，切到别的应用时不会挡着。点一下取消":
        ["Floating above MuseScore; it won't cover other apps. Click to turn off",
         "現在浮在 MuseScore 上面，切到別的應用程式時不會擋著。點一下取消"],
    "点一下让窗口浮在 MuseScore 上面，切到别的应用时不会挡着":
        ["Click to keep this window above MuseScore; it won't cover other apps",
         "點一下讓視窗浮在 MuseScore 上面，切到別的應用程式時不會擋著"],
    "选区：": ["Selection: ", "選取範圍："],
    "打开编辑器，看看再存": ["Open in editor before saving", "開啟編輯器，看看再存"],
    "说点什么，或者输入 / 调用技能。Enter 发送，Shift+Enter 换行":
        ["Say something, or type / to call a skill. Enter sends, Shift+Enter adds a line",
         "說點什麼，或者輸入 / 呼叫技能。Enter 送出，Shift+Enter 換行"],
    "停止": ["Stop", "停止"],
    "发送": ["Send", "送出"],
    "继续": ["Continue", "繼續"],
    "撤销本轮": ["Undo turn", "復原本輪"],
    "总结": ["Summary", "總結"],
    "复盘这次对话：最后是怎么做成的、踩了哪些坑，并提议可以存成技能的操作。保存到 logs/":
        ["Review this chat: how it got done, what went wrong, and propose steps worth saving as skills. Saved to logs/",
         "回顧這次對話：最後是怎麼做成的、踩了哪些坑，並提議可以存成技能的操作。儲存到 logs/"],
    "压缩": ["Compact", "壓縮"],
    "把之前的对话浓缩成一份交接说明再接着聊，省 token。太长时发消息前会自动压缩":
        ["Condense the chat so far into a handover note and continue, saving tokens. Happens automatically when the chat gets long",
         "把之前的對話濃縮成一份交接說明再接著聊，省 token。太長時送出前會自動壓縮"],
    "新对话": ["New chat", "新對話"],

    // ---- 技能页 ----
    "新建技能": ["New skill", "新增技能"],
    "用对话新建": ["New via chat", "用對話新增"],
    "帮我新建一个技能：": ["Help me create a skill: ", "幫我新增一個技能："],
    "刷新": ["Refresh", "重新整理"],
    "搜索技能：名字、按钮、描述、说明里的词都行，多个词用空格隔开":
        ["Search skills: name, button, description or instructions; separate words with spaces",
         "搜尋技能：名字、按鈕、描述、說明裡的詞都行，多個詞用空格隔開"],
    "清除": ["Clear", "清除"],
    "从网址安装：粘贴 SKILL.md、技能文件夹或 gist 的链接":
        ["Install from URL: paste a link to a SKILL.md, a skill folder or a gist",
         "從網址安裝：貼上 SKILL.md、技能資料夾或 gist 的連結"],
    "获取中…": ["Fetching…", "取得中…"],
    "获取": ["Fetch", "取得"],
    "没有找到。换个说法试试，或者让 AI 帮你找。":
        ["Nothing found. Try other words, or let the AI find it.", "沒有找到。換個說法試試，或者讓 AI 幫你找。"],
    "没有完全匹配，下面是相近的 ": ["No exact match; ", "沒有完全符合，下面是相近的 "],
    " 个：": [" close ones:", " 個："],
    "找到 ": ["Found ", "找到 "],
    "让 AI 帮我找「": ["Ask the AI to find “", "讓 AI 幫我找「"],
    "技能文件夹：": ["Skills folder: ", "技能資料夾："],
    "\n下载来的技能文件夹（里面有 SKILL.md）直接放进去就行。对话里输入 / 可以搜索和调用技能。":
        ["\nDrop downloaded skill folders (containing SKILL.md) straight in. Type / in chat to search and call skills.",
         "\n下載來的技能資料夾（裡面有 SKILL.md）直接放進去就行。對話裡輸入 / 可以搜尋和呼叫技能。"],
    "\n这个 MuseScore 不支持扫描文件夹：手动放进来的技能，要把文件夹名加进 skills/index.json。":
        ["\nThis MuseScore can't scan folders: add the folder name of any manually added skill to skills/index.json.",
         "\n這個 MuseScore 不支援掃描資料夾：手動放進來的技能，要把資料夾名加進 skills/index.json。"],
    "有问题的技能文件：\n": ["Skill files with problems:\n", "有問題的技能檔案：\n"],
    "还没有技能。点「新建技能」，或者在对话里让 AI 把刚做过的操作存成技能。":
        ["No skills yet. Click “New skill”, or ask the AI in chat to save what it just did as a skill.",
         "還沒有技能。點「新增技能」，或者在對話裡讓 AI 把剛做過的操作存成技能。"],
    "按钮「": ["Button “", "按鈕「"],
    "文件夹": ["folder", "資料夾"],
    "单文件": ["single file", "單一檔案"],
    " · 函数库": [" · library", " · 函式庫"],
    " · 依赖 ": [" · requires ", " · 相依 "],
    " · 可直接运行": [" · runnable", " · 可直接執行"],
    "匹配处：": ["Match: ", "符合處："],
    "运行": ["Run", "執行"],
    "交给 AI": ["Hand to AI", "交給 AI"],
    "编辑": ["Edit", "編輯"],
    "确认删除": ["Confirm delete", "確認刪除"],
    "删除": ["Delete", "刪除"],

    // ---- 技能编辑器 ----
    "编辑技能": ["Edit skill", "編輯技能"],
    "名称：小写字母、数字、连字符，例如 strum-pattern。对话里用 /名称 调用":
        ["Name: lowercase letters, digits, hyphens, e.g. strum-pattern. Call it in chat with /name",
         "名稱：小寫字母、數字、連字號，例如 strum-pattern。對話裡用 /名稱 呼叫"],
    "描述：做什么、什么时候用。模型靠它判断要不要用这个技能":
        ["Description: what it does and when to use it. The model relies on this to pick the skill",
         "描述：做什麼、什麼時候用。模型靠它判斷要不要用這個技能"],
    "把选区里的和弦改成 x 符头，用来表示闷音":
        ["Change the chords in the selection to x noteheads for muted strums", "把選取範圍裡的和弦改成 x 符頭，用來表示悶音"],
    "按钮文字（可选）": ["Button label (optional)", "按鈕文字（選填）"],
    "x 闷音": ["x mute", "x 悶音"],
    "动作代码（可选）": ["Action code (optional)", "動作代碼（選填）"],
    "依赖的技能（可选）：写技能名，空格隔开。运行前会先载入它们的函数库":
        ["Required skills (optional): skill names separated by spaces. Their libraries load before running",
         "相依的技能（選填）：寫技能名，空格隔開。執行前會先載入它們的函式庫"],
    "使用说明（Markdown）：给模型看的步骤、注意事项、示例":
        ["Instructions (Markdown): steps, caveats and examples for the model", "使用說明（Markdown）：給模型看的步驟、注意事項、範例"],
    "直接运行的脚本（可选）：点按钮或输入 /名称 时执行，作用于当前选区。可以用 h、curScore 等，可以 return 一句话":
        ["Runnable script (optional): runs on the current selection when the button is clicked or /name is typed. May use h, curScore, etc., and may return a message",
         "直接執行的腳本（選填）：點按鈕或輸入 /名稱 時執行，作用於目前選取範圍。可以用 h、curScore 等，可以 return 一句話"],
    "函数库（可选）：只写函数定义。模型加载技能后，可以在自己的脚本里调用这些函数":
        ["Library (optional): function definitions only. After loading the skill, the model can call them from its own scripts",
         "函式庫（選填）：只寫函式定義。模型載入技能後，可以在自己的腳本裡呼叫這些函式"],
    "保存": ["Save", "儲存"],
    "取消": ["Cancel", "取消"],
    "函数库": ["library", "函式庫"],
    "直接运行的脚本": ["runnable script", "直接執行的腳本"],
    "文件夹格式的技能不能在这里改名。要改名请到文件夹里手动改。":
        ["Folder skills cannot be renamed here. Rename the folder manually.", "資料夾格式的技能不能在這裡改名。要改名請到資料夾裡手動改。"],
    "已经有叫 ": ["A skill named ", "已經有叫 "],
    " 的技能。换个名字，或者确认覆盖。": [" already exists. Pick another name or confirm overwrite.", " 的技能。換個名字，或者確認覆蓋。"],
    "写入失败: ": ["Write failed: ", "寫入失敗: "],
    "已保存技能 /": ["Saved skill /", "已儲存技能 /"],
    "，窗口顶部多了按钮「": [". A button “", "，視窗頂端多了按鈕「"],
    "。文件：": [". File: ", "。檔案："],
    "已保存到 ": ["Saved to ", "已儲存到 "],
    "。用户以后输入 /": [". Type /", "。使用者以後輸入 /"],
    " 就能调用": [" to call it", " 就能呼叫"],
    "，也可以点按钮「": [", or click the button “", "，也可以點按鈕「"],
    "已删除技能 ": ["Deleted skill ", "已刪除技能 "],
    "。空文件夹 ": [". The empty folder ", "。空資料夾 "],
    " 还在，可以手动删掉。": [" remains; delete it manually if you like.", " 還在，可以手動刪掉。"],
    "删除失败: ": ["Delete failed: ", "刪除失敗: "],
    "这是 AI 提议的改进版，保存会覆盖现有的 /":
        ["This is the AI's proposed revision; saving overwrites the existing /", "這是 AI 提議的改進版，儲存會覆蓋現有的 /"],
    "。先试运行看看。": [". Try it first.", "。先試跑看看。"],
    "这是 AI 提议的草稿，还没保存。先试运行看看，没问题再保存。":
        ["This is a draft proposed by the AI, not saved yet. Try it first, then save.", "這是 AI 提議的草稿，還沒儲存。先試跑看看，沒問題再儲存。"],
    "正在获取……": ["Fetching…", "正在取得……"],
    "获取失败：": ["Fetch failed: ", "取得失敗："],
    "这不是有效的技能文件：": ["Not a valid skill file: ", "這不是有效的技能檔案："],
    "这是从网上获取的技能，还没保存（来源：":
        ["This skill was fetched from the web and is not saved yet (source: ", "這是從網路上取得的技能，還沒儲存（來源："],
    "保存会覆盖现有的 /": ["Saving overwrites the existing /", "儲存會覆蓋現有的 /"],
    "先读一遍脚本，确认没问题再试运行、保存。":
        ["Read the script first; try it and save only if it looks right.", "先讀一遍腳本，確認沒問題再試跑、儲存。"],
    "它依赖 ": ["It requires ", "它相依 "],
    "，要先装好。": [", which must be installed first.", "，要先裝好。"],
    "依赖的技能不存在: ": ["Required skill missing: ", "相依的技能不存在: "],
    "依赖的技能不存在或依赖了自己: ": ["Required skill missing or depends on itself: ", "相依的技能不存在或相依了自己: "],
    "[试运行技能草稿 ": ["[Trying skill draft ", "[試跑技能草稿 "],
    "未命名": ["untitled", "未命名"],
    "试运行": ["Try", "試跑"],
    "[试运行] ": ["[Trial] ", "[試跑] "],
    "试运行结果：": ["Trial result: ", "試跑結果："],
    "帮我找技能：": ["Find a skill for me: ", "幫我找技能："],
    "我记不清技能叫什么了，想找的是：": ["I don't remember the skill's name. I'm looking for: ", "我記不清技能叫什麼了，想找的是："],
    "。用 search_skills 搜，可以换几种说法多搜几次。":
        [". Use search_skills, trying a few different phrasings.", "。用 search_skills 搜尋，可以換幾種說法多搜幾次。"],
    "然后告诉我最可能是哪个、它做什么、怎么调用。":
        ["Then tell me the most likely one, what it does, and how to call it.", "然後告訴我最可能是哪個、它做什麼、怎麼呼叫。"],

    // ---- 对话流程里的提示 ----
    "请先在「设置」里填 DeepSeek API key。": ["Enter your DeepSeek API key in Settings first.", "請先在「設定」裡填 DeepSeek API key。"],
    "还没有 API key。在「设置」里填好保存后就可以开始。":
        ["No API key yet. Enter and save one in Settings to start.", "還沒有 API key。在「設定」裡填好儲存後就可以開始。"],
    "对话记录写不进 ": ["Cannot write the chat log to ", "對話記錄寫不進 "],
    "。这个文件夹被删掉的话，手动建一个空的就行。":
        [". If that folder was deleted, just create an empty one.", "。這個資料夾被刪掉的話，手動建一個空的就行。"],
    "新对话。当前选区：": ["New chat. Current selection: ", "新對話。目前選取範圍："],
    "没有打开的谱子。": ["No score is open.", "沒有開啟的樂譜。"],
    "没有打开的谱子": ["No score is open", "沒有開啟的樂譜"],
    "[当前选区: ": ["[Current selection: ", "[目前選取範圍: "],
    "这一轮绕了些路（调用工具 ": ["This turn took some detours (", "這一輪繞了些路（呼叫工具 "],
    " 次，": [" tool calls, ", " 次，"],
    " 次没成功）。": [" failed).", " 次沒成功）。"],
    "事情办完以后点「总结」，可以整理出最后的做法和踩过的坑，顺便提议存成技能。":
        ["When done, click “Summary” to write up what worked, what went wrong, and propose saving it as a skill.",
         "事情辦完以後點「總結」，可以整理出最後的做法和踩過的坑，順便提議存成技能。"],
    "对话还很短，不需要压缩。": ["The chat is still short; no need to compact.", "對話還很短，不需要壓縮。"],
    "上下文已经有 ": ["The context is already ", "上下文已經有 "],
    " 字，先自动压缩一下……": [" chars; compacting first…", " 字，先自動壓縮一下……"],
    "正在压缩对话……": ["Compacting the chat…", "正在壓縮對話……"],
    "已中止。": ["Stopped.", "已中止。"],
    "压缩失败：": ["Compact failed: ", "壓縮失敗："],
    "。先不压缩，接着发。": [". Sending without compacting.", "。先不壓縮，接著送出。"],
    "已压缩：": ["Compacted: ", "已壓縮："],
    " 字 → ": [" → ", " 字 → "],
    " 字。模型之后只看得到这份交接说明（上面的对话记录还在，完整记录也照常保存）：\n\n":
        [" chars. From now on the model only sees this handover note (the chat above stays, and the full log is still saved):\n\n",
         " 字。模型之後只看得到這份交接說明（上面的對話記錄還在，完整記錄也照常儲存）：\n\n"],
    "这次对话还没有和 AI 的往来，没什么可总结的。":
        ["No exchange with the AI yet; nothing to summarize.", "這次對話還沒有和 AI 的往來，沒什麼可總結的。"],
    "正在复盘这次对话（": ["Reviewing this chat (", "正在回顧這次對話（"],
    " 轮）……": [" turns)…", " 輪）……"],
    "总结失败：": ["Summary failed: ", "總結失敗："],
    "\n\n（回复太长被截断了，提议可能不完整）":
        ["\n\n(The reply was cut off; proposals may be incomplete)", "\n\n（回覆太長被截斷了，提議可能不完整）"],
    "复盘已保存：": ["Review saved: ", "回顧已儲存："],
    "。提议的技能还没保存，点卡片上的按钮打开编辑器看看。":
        [". Proposed skills are not saved yet; click the card button to open them in the editor.",
         "。提議的技能還沒儲存，點卡片上的按鈕開啟編輯器看看。"],
    "-总结.md": ["-总结.md", "-总结.md"],
    "没有叫 /": ["No skill named /", "沒有叫 /"],
    " 的技能，是不是想找：\n": [". Did you mean:\n", " 的技能，是不是想找：\n"],
    "没有找到和 /": ["Nothing found for /", "沒有找到和 /"],
    " 相关的技能。可以到技能页搜索，或者直接问 AI。":
        [". Search on the Skills page, or just ask the AI.", " 相關的技能。可以到技能頁搜尋，或者直接問 AI。"],
    "[我用 /": ["[I invoked the skill /", "[我用 /"],
    " 调用了技能，下面是它的说明]\n": ["; its instructions follow]\n", " 呼叫了技能，下面是它的說明]\n"],
    "\n\n[我的指令]\n": ["\n\n[My instruction]\n", "\n\n[我的指令]\n"],
    "按技能说明执行。": ["Follow the skill instructions.", "按技能說明執行。"],
    "继续。接着把刚才没做完的部分做完；如果卡住了，换一种方法，或者直接告诉我原因。":
        ["Continue. Finish what was left; if stuck, try another approach or tell me why.",
         "繼續。接著把剛才沒做完的部分做完；如果卡住了，換一種方法，或者直接告訴我原因。"],
    "上一轮没有改谱。": ["The last turn did not change the score.", "上一輪沒有改譜。"],
    "撤销没有生效。请在乐谱窗口里按 Ctrl+Z 撤销 ": ["Undo had no effect. Press Ctrl+Z in the score window ", "復原沒有生效。請在樂譜視窗裡按 Ctrl+Z 復原 "],
    " 步。": [" time(s).", " 步。"],
    "撤销了 ": ["Undid ", "復原了 "],
    " 步，后面的步骤没有可撤销的修改。": [" step(s); the remaining steps had nothing to undo.", " 步，後面的步驟沒有可復原的修改。"],
    "已撤销上一轮的 ": ["Undid the last turn's ", "已復原上一輪的 "],
    " 步修改。": [" change(s).", " 步修改。"],

    // ---- 工具结果（显示在对话里） ----
    " 解析失败: ": [" parse failed: ", " 解析失敗: "],
    "config.json 解析失败: ": ["config.json parse failed: ", "config.json 解析失敗: "],
    "运行环境：MuseScore ": ["Runtime: MuseScore ", "執行環境：MuseScore "],
    "未知版本": ["unknown version", "未知版本"],
    "search_api_docs 查的接口清单按 MuseScore ": ["The API list used by search_api_docs was built from MuseScore ", "search_api_docs 查的介面清單按 MuseScore "],
    " 的源码生成": [" sources", " 的原始碼產生"],
    "，和正在运行的版本不一样，以 inspect_api 查到的为准":
        [", which differs from the running version; trust inspect_api results", "，和正在執行的版本不一樣，以 inspect_api 查到的為準"],
    "没有接口清单，search_api_docs 不可用，用 inspect_api。":
        ["No API list; search_api_docs is unavailable, use inspect_api.", "沒有介面清單，search_api_docs 無法使用，請用 inspect_api。"],
    "fetch_source 读的源码版本：": ["fetch_source reads source version: ", "fetch_source 讀的原始碼版本："],
    "。search_source ": [". search_source ", "。search_source "],
    "可用，搜 ": ["available, searching ", "可用，搜尋 "],
    "不可用（没有 GitHub token）": ["unavailable (no GitHub token)", "無法使用（沒有 GitHub token）"],
    "这个 MuseScore 不支持扫描文件夹，技能列表改用 skills/index.json。(":
        ["This MuseScore can't scan folders; the skill list uses skills/index.json instead. (",
         "這個 MuseScore 不支援掃描資料夾，技能列表改用 skills/index.json。("],
    "设置已保存。": ["Settings saved.", "設定已儲存。"],
    "设置写入失败（": ["Could not write settings (", "設定寫入失敗（"],
    "）。本次会话仍可使用。": ["). They still apply for this session.", "）。本次工作階段仍可使用。"],
    "(读取选区失败: ": ["(failed to read selection: ", "(讀取選取範圍失敗: "],
    " …(共 ": [" …(total ", " …(共 "],
    " 字)": [" chars)", " 字)"],
    "（谱子较大，没有检查谱面是否改变）": ["(large score; did not check whether it changed)", "（樂譜較大，沒有檢查譜面是否改變）"],
    "谱面已改变。": ["Score changed.", "譜面已改變。"],
    "谱面没有变化。": ["Score unchanged.", "譜面沒有變化。"],
    "ERROR: 缺少动作代码": ["ERROR: missing action code", "ERROR: 缺少動作代碼"],
    "ERROR: 不允许执行动作 ": ["ERROR: action not allowed: ", "ERROR: 不允許執行動作 "],
    "（文件类动作不允许，一次最多 ": ["(file actions are not allowed; at most ", "（檔案類動作不允許，一次最多 "],
    " 个）": [" per call)", " 個）"],
    "谱面已改变": ["score changed", "譜面已改變"],
    "谱面没变，选区变了": ["score unchanged, selection changed", "譜面沒變，選取範圍變了"],
    "没有任何变化": ["nothing changed", "沒有任何變化"],
    "谱子较大，没有检查是否生效": ["large score; did not check the effect", "樂譜較大，沒有檢查是否生效"],
    "已依次执行 ": ["Executed ", "已依序執行 "],
    " 个动作：\n": [" actions in order:\n", " 個動作：\n"],
    "已执行 ": ["Executed ", "已執行 "],
    "\n当前选区: ": ["\nCurrent selection: ", "\n目前選取範圍: "],
    " 派发后谱面和选区都没有变化。可能是 MuseScore 不认识这个动作代码、在当前状态下拒绝执行，":
        [" was dispatched but neither the score nor the selection changed. MuseScore may not know this action code, may refuse it in the current state,",
         " 派送後譜面和選取範圍都沒有變化。可能是 MuseScore 不認識這個動作代碼、在目前狀態下拒絕執行，"],
    "或者它对当前选区不起作用（比如拼写本来就对时 pitch-spell 不会改动）。不要重复无效的动作，必要时改用 run_script 和 h.* 辅助函数。\n":
        [" or it has no effect on the current selection (e.g. pitch-spell changes nothing when the spelling is already right). Do not repeat ineffective actions; use run_script with the h.* helpers instead if needed.\n",
         "或者它對目前選取範圍不起作用（比如拼寫本來就對時 pitch-spell 不會改動）。不要重複無效的動作，必要時改用 run_script 和 h.* 輔助函式。\n"],
    "ERROR: 没有打开的谱子": ["ERROR: no score is open", "ERROR: 沒有開啟的樂譜"],
    "已选中。当前选区: ": ["Selected. Current selection: ", "已選取。目前選取範圍: "],
    "ERROR: 选择失败（范围或谱表不合法）": ["ERROR: selection failed (invalid range or staff)", "ERROR: 選取失敗（範圍或譜表無效）"],
    "ERROR: 缺少 code": ["ERROR: missing code", "ERROR: 缺少 code"],
    "ERROR: 没有叫 ": ["ERROR: no skill named ", "ERROR: 沒有叫 "],
    " 的技能。现有技能: ": [". Available skills: ", " 的技能。現有技能: "],
    " 的技能": ["", " 的技能"],
    "ERROR: 未知工具 ": ["ERROR: unknown tool ", "ERROR: 未知工具 "],
    " 行 ": [" line ", " 行 "],
    "：读不到内容": [": cannot read content", "：讀不到內容"],
    "：和 ": [": same name as ", "：和 "],
    " 重名，已跳过": [", skipped", " 同名，已略過"],
    "：依赖的技能不存在 ": [": missing required skill ", "：相依的技能不存在 "],
    "# 技能 ": ["# Skill ", "# 技能 "],
    "\n\n[依赖的技能已一并加载：": ["\n\n[Required skills loaded too: ", "\n\n[相依的技能已一併載入："],
    "\n\n# 依赖 ": ["\n\n# Dependency ", "\n\n# 相依 "],
    "\n\n[函数库已加载，下面这些函数可以在 run_script 里直接调用]\n":
        ["\n\n[Library loaded; these functions can be called directly in run_script]\n", "\n\n[函式庫已載入，下面這些函式可以在 run_script 裡直接呼叫]\n"],
    "\n\n[这个技能可以用 run_skill 直接运行，作用于当前选区]":
        ["\n\n[This skill can be run directly with run_skill on the current selection]", "\n\n[這個技能可以用 run_skill 直接執行，作用於目前選取範圍]"],
    "ERROR: 技能 ": ["ERROR: skill ", "ERROR: 技能 "],
    " 依赖的技能不存在: ": [" requires a missing skill: ", " 相依的技能不存在: "],
    " 没有可直接运行的脚本或动作代码": [" has no runnable script or action code", " 沒有可直接執行的腳本或動作代碼"],
    "按钮 ": ["Button ", "按鈕 "],
    "[桥] ": ["[bridge] ", "[橋接] "],
    "[桥 ": ["[bridge ", "[橋接 "],
    "在线。MuseScore ": ["Online. MuseScore ", "上線。MuseScore "],
    "，谱：": [", score: ", "，譜："],
    "，选区：": [", selection: ", "，選取範圍："],

    // ---- 设置页 ----
    "DeepSeek 设置": ["DeepSeek settings", "DeepSeek 設定"],
    "模型": ["Model", "模型"],
    "思考强度": ["Reasoning effort", "思考強度"],
    "语言": ["Language", "語言"],
    "每轮最多调用工具": ["Max tool calls per turn", "每輪最多呼叫工具"],
    "自动压缩（万字）": ["Auto-compact (×10k chars)", "自動壓縮（萬字）"],
    "关闭": ["Off", "關閉"],
    "上下文超过 ": ["Compact before sending when the context exceeds ", "上下文超過 "],
    " 万字时，发消息前先压缩": ["0,000 chars", " 萬字時，送出前先壓縮"],
    "可选。github_pat_…": ["Optional. github_pat_…", "選填。github_pat_…"],
    "代码搜索仓库": ["Code search repo", "程式碼搜尋儲存庫"],
    "对话记录": ["Chat logs", "對話記錄"],
    "每轮结束后保存到 logs/": ["Save to logs/ after each turn", "每輪結束後儲存到 logs/"],
    "本地桥": ["Local bridge", "本機橋接"],
    "已打开（config.json 里把 bridge 改成 false 可关闭）":
        ["On (set bridge to false in config.json to turn off)", "已開啟（config.json 裡把 bridge 改成 false 可關閉）"],
    "关闭。要打开：config.json 里加 \"bridge\": true，再点「重新读取 config.json」":
        ["Off. To turn on: add \"bridge\": true to config.json, then click “Reload config.json”",
         "關閉。要開啟：config.json 裡加 \"bridge\": true，再點「重新讀取 config.json」"],
    "打开记录文件夹": ["Open logs folder", "開啟記錄資料夾"],
    "重新读取 config.json": ["Reload config.json", "重新讀取 config.json"],
    "已重新读取 config.json。": ["Reloaded config.json.", "已重新讀取 config.json。"],
    "本地桥已打开。任务文件：": ["Local bridge is on. Job file: ", "本機橋接已開啟。任務檔案："],
    "。执行过的任务会显示在这里，Ctrl+Z 可撤销。": [". Executed jobs show up here; Ctrl+Z undoes them.", "。執行過的任務會顯示在這裡，Ctrl+Z 可復原。"],
    "本地桥已关闭。": ["Local bridge is off.", "本機橋接已關閉。"],
    "设置保存在 ": ["Settings are stored in ", "設定儲存在 "],
    "。这个文件夹在 OneDrive 里的话，key 会以明文同步到云端。分享插件时不要带上这个文件。":
        [". If this folder is inside OneDrive, the key syncs to the cloud in plain text. Don't include this file when sharing the plugin.",
         "。這個資料夾在 OneDrive 裡的話，key 會以明文同步到雲端。分享外掛時不要帶上這個檔案。"],
    "\n对话记录和复盘在 ": ["\nChat logs and reviews are in ", "\n對話記錄和回顧在 "],
    "（不含 API key 和 token）。": ["(without API key or token).", "（不含 API key 和 token）。"],
    "\n\nGitHub token 是可选的，有两个用处：让 AI 搜 MuseScore 源码（GitHub 的代码搜索必须登录），":
        ["\n\nThe GitHub token is optional and serves two purposes: letting the AI search MuseScore sources (GitHub code search requires login),",
         "\n\nGitHub token 是選填的，有兩個用處：讓 AI 搜尋 MuseScore 原始碼（GitHub 的程式碼搜尋必須登入），"],
    "以及从 GitHub 安装技能时不受匿名每小时 60 次的限制。":
        [" and installing skills from GitHub without the anonymous limit of 60 requests per hour.", "以及從 GitHub 安裝技能時不受匿名每小時 60 次的限制。"],
    "在 GitHub 的 Settings → Developer settings → Fine-grained tokens 新建一个，":
        [" Create one under GitHub Settings → Developer settings → Fine-grained tokens,", "在 GitHub 的 Settings → Developer settings → Fine-grained tokens 新增一個，"],
    "Repository access 选「Public repositories」，不用勾任何权限。只读、只能看公开仓库，泄露了也改不了你的东西。":
        [" set Repository access to “Public repositories” and grant no permissions. It is read-only for public repos, so a leak can't change anything of yours.",
         "Repository access 選「Public repositories」，不用勾任何權限。唯讀、只能看公開儲存庫，外洩了也改不了你的東西。"],
    "\n代码搜索只搜仓库的默认分支。MuseScore 官方仓库的默认分支是开发中的新版本；":
        ["\nCode search only covers the repo's default branch. The official MuseScore repo's default branch is the in-development version;",
         "\n程式碼搜尋只搜儲存庫的預設分支。MuseScore 官方儲存庫的預設分支是開發中的新版本；"],
    "想搜 4.6.3，要把 4.6.3 的源码推到你自己的一个新仓库（不能是 fork，fork 不会被索引），填在上面。":
        [" to search 4.6.3, push its sources to a new repo of your own (not a fork; forks aren't indexed) and enter it above.",
         "想搜 4.6.3，要把 4.6.3 的原始碼推到你自己的一個新儲存庫（不能是 fork，fork 不會被索引），填在上面。"],
    "\n\n当前：MuseScore ": ["\n\nCurrent: MuseScore ", "\n\n目前：MuseScore "],
    "，接口清单 ": [", API list ", "，介面清單 "],
    " 条）": [" entries)", " 條）"],
    "没有": ["none", "沒有"],
    "，读源码用 ": [", source reads use ", "，讀原始碼用 "],
    "\n\n本地桥打开后，插件每半秒读一次 ": ["\n\nWith the local bridge on, the plugin reads ", "\n\n本機橋接開啟後，外掛每半秒讀一次 "],
    "，执行里面的工具调用（和 AI 用的同一套工具），":
        [" every half second and runs the tool calls in it (the same tools the AI uses);", "，執行裡面的工具呼叫（和 AI 用的同一套工具），"],
    "结果写到 bridge/result.json，对话里也会显示一条。只读插件自己文件夹里的文件，用完可以关掉。用法见 dev/tools/bridge_client.py。":
        [" results go to bridge/result.json and also appear in the chat. It only reads files inside the plugin folder; turn it off when done. See dev/tools/bridge_client.py for usage.",
         "結果寫到 bridge/result.json，對話裡也會顯示一條。只讀外掛自己資料夾裡的檔案，用完可以關掉。用法見 dev/tools/bridge_client.py。"],

    // ---- 标点片段（拼接消息时单独出现） ----
    "。": [".", "。"],
    "：": [": ", "："],
    "」": ["”", "」"],
    "」 · ": ["” · ", "」 · "],
    "）。": [").", "）。"],
    "（": [" (", "（"],

    // =====================================================================
    //  core/*.js 产生的文字（工具结果、对话记录、复盘、接口清单、联网、桥）
    //  这些由 core 文件里的 T() 查，语言由 QML 调 setLang() 设定
    // =====================================================================

    // ---- scoreio.js ----
    "无": ["none", "無"],
    "）": [")", "）"],
    "；": ["; ", "；"],
    " 和弦 ": [" chord ", " 和弦 "],
    " 记号:": [" marks:", " 記號:"],
    " (连音组内)": [" (in tuplet)", " (連音組內)"],
    " 休止 ": [" rest ", " 休止 "],
    "(范围内没有和弦或休止符)": ["(no chords or rests in range)", "(範圍內沒有和弦或休止符)"],
    "第 ": ["Bar ", "第 "],
    " 小节 · 谱表": [" · staff", " 小節 · 譜表"],
    " 声部": [" voice", " 聲部"],
    "谱表": ["staff", "譜表"],
    "范围选择：第 ": ["Range: bars ", "範圍選取：第 "],
    " 小节，": [", ", " 小節，"],
    "（tick ": [" (tick ", "（tick "],
    "无选区": ["no selection", "無選取範圍"],
    "点选了 ": ["Selected ", "點選了 "],
    " 个元素（不是音符/休止符）": [" element(s) (not notes/rests)", " 個元素（不是音符/休止符）"],
    "点选 ": ["Selected ", "點選 "],
    " 个和弦/休止符，位于第 ": [" chord(s)/rest(s) in bar ", " 個和弦/休止符，位於第 "],
    " 小节": ["", " 小節"],
    "标题: ": ["Title: ", "標題: "],
    "(无)": ["(none)", "(無)"],
    "谱表数: ": ["Staves: ", "譜表數: "],
    "，小节数: ": [", bars: ", "，小節數: "],
    "，调号(五度圈): ": [", key (fifths): ", "，調號(五度圈): "],
    "鼓": ["drums", "鼓"],
    "分谱": ["part", "分譜"],
    "  谱表 ": ["  staff ", "  譜表 "],
    "(分谱信息读取失败: ": ["(failed to read part info: ", "(分譜資訊讀取失敗: "],
    "当前选区: ": ["Current selection: ", "目前選取範圍: "],
    "选区内容（": ["Selection contents (", "選取範圍內容（"],
    " 小节（共 ": [" bar(s) (of ", " 小節（共 "],
    " 小节）": [")", " 小節）"],
    "无法解析音名: ": ["Cannot parse note name: ", "無法解析音名: "],
    "音高超出范围: ": ["Pitch out of range: ", "音高超出範圍: "],
    "移动 0 个半音，没有改动": ["Moved by 0 semitones; nothing changed", "移動 0 個半音，沒有改動"],
    "移调后音高超出范围: ": ["Pitch out of range after transposing: ", "移調後音高超出範圍: "],
    " 个音移动了 ": [" note(s) moved by ", " 個音移動了 "],
    " 个半音": [" semitone(s)", " 個半音"],
    "（只改了音符，调号和和弦符号没变）": [" (notes only; key and chord symbols unchanged)", "（只改了音符，調號和和弦符號沒變）"],
    "重新拼写了 ": ["Respelled ", "重新拼寫了 "],
    " 个音（共检查 ": [" note(s) (checked ", " 個音（共檢查 "],
    " 个）": [")", " 個）"],
    " 个改成了 ": [" changed to ", " 個改成了 "],
    " 个已经被前面变长的音盖住": [" covered by an earlier lengthened note", " 個已經被前面變長的音蓋住"],
    " 个在连音组里，没有改": [" in tuplets, left unchanged", " 個在連音組裡，沒有改"],
    "未知记号: ": ["Unknown mark: ", "未知記號: "],
    "。用 SymId 里的名字，比如 articStaccatoAbove": [". Use a SymId name such as articStaccatoAbove", "。用 SymId 裡的名字，比如 articStaccatoAbove"],
    "只能给和弦加记号，这里是休止符 @": ["Marks can only go on chords; this is a rest @", "只能給和弦加記號，這裡是休止符 @"],
    " 处找不到这个和弦": [": chord not found", " 處找不到這個和弦"],
    "[列表 ": ["[list ", "[列表 "],
    " 项]": [" items]", " 項]"],
    "对象": ["object", "物件"],
    "ERROR: path 只能写成 curScore.parts[0].instruments[0] 这种形式（点号和数字下标）":
        ["ERROR: path must look like curScore.parts[0].instruments[0] (dots and numeric indexes only)",
         "ERROR: path 只能寫成 curScore.parts[0].instruments[0] 這種形式（點號和數字下標）"],
    "ERROR: 只能从这些对象开始查: ": ["ERROR: only these root objects can be inspected: ", "ERROR: 只能從這些物件開始查: "],
    "ERROR: 读取 ": ["ERROR: reading ", "ERROR: 讀取 "],
    " 出错: ": [" failed: ", " 出錯: "],
    " 是 ": [" is ", " 是 "],
    "。当前版本的插件接口里没有它（或者下标超出范围）。":
        [". It does not exist in this version's plugin API (or the index is out of range).", "。目前版本的外掛介面裡沒有它（或者下標超出範圍）。"],
    "=<读取出错>": ["=<read error>", "=<讀取出錯>"],
    "方法（": ["methods (", "方法（"],
    "）: ": ["): ", "）: "],
    "属性（": ["properties (", "屬性（"],
    "脚本": ["script", "腳本"],
    "语法错误: ": ["syntax error: ", "語法錯誤: "],
    "脚本语法错误: ": ["Script syntax error: ", "腳本語法錯誤: "],
    "\n返回: ": ["\nReturned: ", "\n返回: "],
    "ERROR（已回滚）: ": ["ERROR (rolled back): ", "ERROR（已回滾）: "],
    "\n日志:\n": ["\nLog:\n", "\n日誌:\n"],

    // ---- session.js ----
    " …(截断，共 ": [" …(truncated, total ", " …(截斷，共 "],
    "✗ 出错": ["✗ error", "✗ 出錯"],
    "✗ 没效果": ["✗ no effect", "✗ 沒效果"],
    "✗ 谱面没变": ["✗ score unchanged", "✗ 譜面沒變"],
    "✓ 改了谱": ["✓ score changed", "✓ 改了譜"],
    "选区变了": ["selection changed", "選取範圍變了"],
    "谱子：": ["Score: ", "樂譜："],
    "（未命名）": ["(untitled)", "（未命名）"],
    "，开始于 ": [", started ", "，開始於 "],
    "第 %1 轮 [": ["Turn %1 [", "第 %1 輪 ["],
    "（按钮/直接运行，没经过模型）": ["(button / direct run, no model)", "（按鈕/直接執行，沒經過模型）"],
    "【这一轮的修改后来被用户撤销了】": ["[The user later undid this turn's changes]", "【這一輪的修改後來被使用者復原了】"],
    "用户：": ["User: ", "使用者："],
    "当时选区：": ["Selection then: ", "當時選取範圍："],
    "       结果: ": ["       result: ", "       結果: "],
    "助手：": ["Assistant: ", "助手："],
    "出错：": ["Error: ", "出錯："],
    "工具调用次数到上限": ["tool call limit reached", "工具呼叫次數到上限"],
    "可撤销步数 ": ["undo steps ", "可復原步數 "],
    "（这一轮还没结束）": ["(this turn is not finished)", "（這一輪還沒結束）"],
    "…(前面太长，省略)\n": ["…(earlier part omitted)\n", "…(前面太長，省略)\n"],
    "  调用 ": ["  call ", "  呼叫 "],
    "    结果: ": ["    result: ", "    結果: "],
    "对话太长了，要压缩。请把下面的对话记录写成一份交接说明。之后你只能看到这份说明，看不到原来的对话，所以该留的要写全，用中文，只写事实，不要寒暄：":
        ["The conversation is too long and must be compacted. Rewrite the chat log below as a handover note. Afterwards you will only see this note, not the original chat, so keep everything that matters. Write in English, facts only, no pleasantries:",
         "對話太長了，要壓縮。請把下面的對話記錄寫成一份交接說明。之後你只能看到這份說明，看不到原來的對話，所以該留的要寫全，用繁體中文，只寫事實，不要寒暄："],
    "1. 用户的目标和偏好，包括用户纠正过你的地方；": ["1. The user's goals and preferences, including anything they corrected you on;", "1. 使用者的目標和偏好，包括使用者糾正過你的地方；"],
    "2. 已经完成的修改：具体位置（小节、谱表、声部）和用的方法；后来被撤销的不算；":
        ["2. Changes already made: exact places (bar, staff, voice) and the method used; changes later undone don't count;", "2. 已經完成的修改：具體位置（小節、譜表、聲部）和用的方法；後來被復原的不算；"],
    "3. 谱面现在和任务有关的状态；": ["3. The current state of the score as far as the task is concerned;", "3. 譜面現在和任務有關的狀態；"],
    "4. 管用的做法和踩过的坑：哪些方法不行、为什么；": ["4. What worked and what went wrong: which approaches failed and why;", "4. 管用的做法和踩過的坑：哪些方法不行、為什麼；"],
    "5. 还没做完的事和下一步。": ["5. Unfinished work and next steps.", "5. 還沒做完的事和下一步。"],
    "\n\n已经加载的技能（函数库在 run_script 里仍然可用）：": ["\n\nSkills already loaded (their libraries remain available in run_script): ", "\n\n已經載入的技能（函式庫在 run_script 裡仍然可用）："],
    "\n\n===== 对话记录 =====\n": ["\n\n===== Chat log =====\n", "\n\n===== 對話記錄 =====\n"],
    "[之前的对话太长，已经压缩。下面是交接说明，接下来的对话从这里接着进行]\n":
        ["[The earlier conversation was too long and has been compacted. Below is the handover note; the conversation continues from here]\n", "[之前的對話太長，已經壓縮。下面是交接說明，接下來的對話從這裡接著進行]\n"],
    "明白，我按这份说明接着做。": ["Understood, I'll continue from this note.", "明白，我按這份說明接著做。"],
    "下面是这次对话的完整记录：用户的每句话、每次调用的工具和结果。请用中文写一份复盘，格式如下：":
        ["Below is the full record of this conversation: everything the user said, every tool call and its result. Write a review in English in the following format:",
         "下面是這次對話的完整記錄：使用者的每句話、每次呼叫的工具和結果。請用繁體中文寫一份回顧，格式如下："],
    "## 目标": ["## Goal", "## 目標"],
    "用户想做什么，一两句。": ["What the user wanted, in a sentence or two.", "使用者想做什麼，一兩句。"],
    "## 最后是怎么做成的": ["## How it got done", "## 最後是怎麼做成的"],
    "按顺序列出真正起作用的操作：用了哪个工具、什么参数；关键脚本原样贴出来。被撤销的轮次不算。没做成就写卡在哪里。":
        ["List, in order, the operations that actually worked: which tool, which arguments; paste key scripts verbatim. Undone turns don't count. If it wasn't achieved, say where it got stuck.",
         "按順序列出真正起作用的操作：用了哪個工具、什麼參數；關鍵腳本原樣貼出來。被復原的輪次不算。沒做成就寫卡在哪裡。"],
    "## 踩过的坑": ["## What went wrong", "## 踩過的坑"],
    "哪些尝试失败了、原因、后来怎么绕过去的。一条一句。没有就写「无」。":
        ["Which attempts failed, why, and how they were worked around. One line each. Write “none” if nothing.", "哪些嘗試失敗了、原因、後來怎麼繞過去的。一條一句。沒有就寫「無」。"],
    "## 可以存成技能的": ["## Worth saving as skills", "## 可以存成技能的"],
    "判断哪些操作以后还会反复用，最多提 3 个，没有值得存的就写「无」。每个技能选一种形式：":
        ["Judge which operations will be reused; propose at most 3, or write “none”. Pick one form for each skill:", "判斷哪些操作以後還會反覆用，最多提 3 個，沒有值得存的就寫「無」。每個技能選一種形式："],
    "- script：步骤固定、不需要看情况判断。写成 run_script（或 cmd 动作代码序列），配按钮一键运行，不花 token。":
        ["- script: fixed steps, no judgement needed. Write it as run_script (or a cmd action sequence) with a button for one-click use; costs no tokens.",
         "- script：步驟固定、不需要看情況判斷。寫成 run_script（或 cmd 動作代碼序列），配按鈕一鍵執行，不花 token。"],
    "- ai：每次情况不同，要看谱子再决定。写 instructions（步骤、判断规则、注意事项），可复用的计算写成 lib_script 函数给模型调用。":
        ["- ai: differs each time and needs a look at the score. Write instructions (steps, rules, caveats); put reusable computations in lib_script functions for the model to call.",
         "- ai：每次情況不同，要看樂譜再決定。寫 instructions（步驟、判斷規則、注意事項），可重用的計算寫成 lib_script 函式給模型呼叫。"],
    "- both：按钮跑默认做法；交给 AI（/名称 加一句话）时按说明灵活调整参数。":
        ["- both: the button runs the default; when handed to the AI (/name plus a sentence) it adapts parameters per the instructions.",
         "- both：按鈕跑預設做法；交給 AI（/名稱 加一句話）時按說明靈活調整參數。"],
    "脚本必须能在 run_script 环境里直接运行，只用 system prompt 里列出的 h.* 和 API，优先复用记录里已经跑通的代码。":
        ["Scripts must run as-is in the run_script environment, using only the h.* helpers and APIs listed in the system prompt; prefer reusing code that already worked in the log.",
         "腳本必須能在 run_script 環境裡直接執行，只用 system prompt 裡列出的 h.* 和 API，優先重用記錄裡已經跑通的程式碼。"],
    "不要和已有技能重复；已有技能可以改进的，用同样的名字，并在 why 里说明改了什么。":
        ["Don't duplicate existing skills; to improve one, reuse its name and say what changed in why.", "不要和已有技能重複；已有技能可以改進的，用同樣的名字，並在 why 裡說明改了什麼。"],
    "最后输出一个 ```json 代码块，格式：": ["Finally output one ```json code block in this format:", "最後輸出一個 ```json 程式碼區塊，格式："],
    "{\"proposals\": [{\"name\": \"小写字母数字连字符\", \"kind\": \"script|ai|both\", \"description\": \"做什么、什么时候用\", \"button\": \"按钮文字，可空\",":
        ["{\"proposals\": [{\"name\": \"lowercase-letters-digits-hyphens\", \"kind\": \"script|ai|both\", \"description\": \"what it does and when to use it\", \"button\": \"button label, may be empty\",",
         "{\"proposals\": [{\"name\": \"小寫字母數字連字號\", \"kind\": \"script|ai|both\", \"description\": \"做什麼、什麼時候用\", \"button\": \"按鈕文字，可空\","],
    " \"instructions\": \"Markdown 说明\", \"run_script\": \"\", \"lib_script\": \"\", \"cmd\": \"\", \"requires\": \"依赖的技能名，空格隔开\", \"why\": \"为什么值得存\"}]}":
        [" \"instructions\": \"Markdown instructions\", \"run_script\": \"\", \"lib_script\": \"\", \"cmd\": \"\", \"requires\": \"required skill names separated by spaces\", \"why\": \"why it is worth saving\"}]}",
         " \"instructions\": \"Markdown 說明\", \"run_script\": \"\", \"lib_script\": \"\", \"cmd\": \"\", \"requires\": \"相依的技能名，空格隔開\", \"why\": \"為什麼值得存\"}]}"],
    "没有提议就输出 {\"proposals\": []}。": ["If there is nothing to propose, output {\"proposals\": []}.", "沒有提議就輸出 {\"proposals\": []}。"],
    "一键脚本": ["one-click script", "一鍵腳本"],
    "AI 技能": ["AI skill", "AI 技能"],
    "脚本 + AI 说明": ["script + AI instructions", "腳本 + AI 說明"],
    "💡 提议技能 /": ["💡 Proposed skill /", "💡 提議技能 /"],
    "理由：": ["Why: ", "理由："],
    "直接运行的脚本 ": ["runnable script ", "直接執行的腳本 "],
    " 行": [" lines", " 行"],
    "动作代码 ": ["action code ", "動作代碼 "],
    "函数库 ": ["library ", "函式庫 "],
    "使用说明": ["instructions", "使用說明"],
    "依赖 ": ["requires ", "相依 "],
    "包含：": ["Contains: ", "包含："],
    "，": [", ", "，"],
    "# 对话复盘 ": ["# Chat review ", "# 對話回顧 "],
    "- 谱子：": ["- Score: ", "- 樂譜："],
    "- 总结时间：": ["- Summarized at: ", "- 總結時間："],
    "- 轮数：": ["- Turns: ", "- 輪數："],
    "## 提议的技能（草稿，还没保存）": ["## Proposed skills (drafts, not saved)", "## 提議的技能（草稿，還沒儲存）"],
    "按钮：": ["Button: ", "按鈕："],
    "动作代码：`": ["Action code: `", "動作代碼：`"],
    "依赖：": ["Requires: ", "相依："],

    // ---- skills.js ----
    "开头没有用 --- 包起来的 YAML 头": ["No YAML front matter wrapped in --- at the top", "開頭沒有用 --- 包起來的 YAML 頭"],
    "YAML 头里没有 name": ["No name in the YAML front matter", "YAML 頭裡沒有 name"],
    "YAML 头里没有 description": ["No description in the YAML front matter", "YAML 頭裡沒有 description"],
    "name（": ["name (", "name（"],
    "）和": [") and the ", "）和"],
    "文件夹名": ["folder name", "資料夾名"],
    "文件名": ["file name", "檔案名"],
    "）不一致": [") don't match", "）不一致"],
    "名称不能为空": ["Name can't be empty", "名稱不能為空"],
    "名称只能用小写字母、数字和连字符，不能以连字符开头或结尾，最长 64 个字符，例如 strum-pattern":
        ["Name may only use lowercase letters, digits and hyphens, can't start or end with a hyphen, max 64 characters, e.g. strum-pattern",
         "名稱只能用小寫字母、數字和連字號，不能以連字號開頭或結尾，最長 64 個字元，例如 strum-pattern"],
    "描述不能为空：写清楚这个技能做什么、什么时候用": ["Description can't be empty: say what the skill does and when to use it", "描述不能為空：寫清楚這個技能做什麼、什麼時候用"],
    "描述最长 1024 个字符": ["Description is limited to 1024 characters", "描述最長 1024 個字元"],
    "要显示成按钮，需要有直接运行的脚本或动作代码": ["A button needs a runnable script or an action code", "要顯示成按鈕，需要有直接執行的腳本或動作代碼"],
    "不允许的动作代码: ": ["Action code not allowed: ", "不允許的動作代碼: "],
    "MuseScore Studio 4.6+ 的 AI 助手插件": ["AI Assistant plugin for MuseScore Studio 4.6+", "MuseScore Studio 4.6+ 的 AI 助手外掛"],
    "\n## 函数库\n\n加载这个技能后，下面的函数可以在 run_script 里直接调用。\n\n```js lib\n":
        ["\n## Library\n\nAfter loading this skill, the functions below can be called directly in run_script.\n\n```js lib\n",
         "\n## 函式庫\n\n載入這個技能後，下面的函式可以在 run_script 裡直接呼叫。\n\n```js lib\n"],
    "\n## 直接运行的脚本\n\n点按钮、输入 /": ["\n## Runnable script\n\nRuns on the current selection when the button is clicked, /", "\n## 直接執行的腳本\n\n點按鈕、輸入 /"],
    " 或模型调用 run_skill 时执行，作用于当前选区。\n\n```js run\n": [" is typed, or the model calls run_skill.\n\n```js run\n", " 或模型呼叫 run_skill 時執行，作用於目前選取範圍。\n\n```js run\n"],
    "没有找到和「": ["No skill related to “", "沒有找到和「"],
    "」相关的技能。现有技能：": ["”. Existing skills: ", "」相關的技能。現有技能："],
    "没有完全匹配，下面是相近的": ["No exact match; close ones:", "沒有完全符合，下面是相近的"],
    " 个": ["", " 個"],
    "（按钮「": [" (button “", "（按鈕「"],
    "」）": ["”)", "」）"],
    "  匹配处：": ["  match: ", "  符合處："],
    " [可直接运行]": [" [runnable]", " [可直接執行]"],
    "\n\n（用户还没有本地技能。）": ["\n\n(The user has no local skills yet.)", "\n\n（使用者還沒有本地技能。）"],
    "用户的本地技能（name：描述）：": ["The user's local skills (name: description):", "使用者的本地技能（name：描述）："],
    " [函数库]": [" [library]", " [函式庫]"],
    " [依赖 ": [" [requires ", " [相依 "],

    // ---- docs.js ----
    "类": ["class", "類"],
    "属性": ["property", "屬性"],
    "方法": ["method", "方法"],
    "枚举": ["enum", "列舉"],
    "动作": ["action", "動作"],
    "不是接口清单": ["Not an API list", "不是介面清單"],
    " 起）": [" and later)", " 起）"],
    "[动作] ": ["[action] ", "[動作] "],
    " 「": [" “", " 「"],
    "[枚举] ": ["[enum] ", "[列舉] "],
    "[类] ": ["[class] ", "[類] "],
    "（可写）": [" (writable)", "（可寫）"],
    "）：": ["): ", "）："],
    "（父类的成员没有列出：用 search_api_docs 查父类名，比如 EngravingItem）":
        ["(inherited members not listed: search_api_docs the parent class, e.g. EngravingItem)", "（父類別的成員沒有列出：用 search_api_docs 查父類別名，比如 EngravingItem）"],
    "ERROR: 没有加载接口清单（docs/ 里没有 api-*.json）。用 inspect_api 查运行时接口。":
        ["ERROR: no API list loaded (no api-*.json in docs/). Use inspect_api to inspect the runtime API.", "ERROR: 沒有載入介面清單（docs/ 裡沒有 api-*.json）。用 inspect_api 查執行期介面。"],
    "接口清单：MuseScore ": ["API list: MuseScore ", "介面清單：MuseScore "],
    "（源码 ": [" (sources ", "（原始碼 "],
    "）\n": [")\n", "）\n"],
    "没有找到「": ["Nothing found for “", "沒有找到「"],
    "」。换英文接口名或中文菜单名再试；动作代码也可以按中文名搜，比如「拼写」「全选」。":
        ["”. Try the English API name or the Chinese menu name; action codes can also be searched by their Chinese names, e.g. “拼写”, “全选”.",
         "」。換英文介面名或中文選單名再試；動作代碼也可以按中文名搜，比如「拼寫」「全選」。"],
    "没有完全匹配，下面是相近的：": ["No exact match; close ones:", "沒有完全符合，下面是相近的："],
    " 条": [" entries", " 條"],
    "，显示前 ": [", showing the first ", "，顯示前 "],
    "\n（方括号里是源码文件和行号，需要细节时用 fetch_source 读）":
        ["\n(Square brackets give the source file and line; use fetch_source for details)", "\n（方括號裡是原始碼檔案和行號，需要細節時用 fetch_source 讀）"],

    // ---- remote.js ----
    "请求超时": ["request timed out", "請求逾時"],
    "网络错误或请求被中止": ["network error or request aborted", "網路錯誤或請求被中止"],
    "返回的不是 JSON": ["response is not JSON", "回傳的不是 JSON"],
    "\n…(太长，截断了。用 grep 或 from_line/to_line 缩小范围)": ["\n…(too long, truncated. Narrow it down with grep or from_line/to_line)", "\n…(太長，截斷了。用 grep 或 from_line/to_line 縮小範圍)"],
    "（共 ": [" (", "（共 "],
    " 行）": [" lines)", " 行）"],
    "ERROR: grep 不是合法的正则: ": ["ERROR: grep is not a valid regex: ", "ERROR: grep 不是合法的正規表示式: "],
    "，没有匹配「": [", no lines match “", "，沒有符合「"],
    "」的行。": ["”.", "」的行。"],
    "，匹配「": [", matching “", "，符合「"],
    " 处": [" place(s)", " 處"],
    "（只显示前 ": [" (showing the first ", "（只顯示前 "],
    " 处）": [")", " 處）"],
    "：\n": [":\n", "：\n"],
    "\n…(后面还有 ": ["\n…(", "\n…(後面還有 "],
    " 行，用 from_line/to_line 或 grep 看)": [" more lines; use from_line/to_line or grep)", " 行，用 from_line/to_line 或 grep 看)"],
    "，第 ": [", line ", "，第 "],
    " 行：\n": [":\n", " 行：\n"],
    "ERROR: path 要写成仓库里的相对路径，例如 src/engraving/api/v1/score.h": ["ERROR: path must be a repo-relative path such as src/engraving/api/v1/score.h", "ERROR: path 要寫成儲存庫裡的相對路徑，例如 src/engraving/api/v1/score.h"],
    " 里没有 ": [" has no ", " 裡沒有 "],
    "。文件可能在别的目录（4.x 和 5.0 的目录结构不同）；用 search_api_docs 看接口所在的文件，或者 search_source 搜。":
        [". The file may live elsewhere (4.x and 5.0 have different layouts); use search_api_docs to find the file for an API, or search_source.",
         "。檔案可能在別的目錄（4.x 和 5.0 的目錄結構不同）；用 search_api_docs 看介面所在的檔案，或者 search_source 搜。"],
    "ERROR: 缺少 query": ["ERROR: missing query", "ERROR: 缺少 query"],
    "ERROR: 没有设置 GitHub token，搜不了代码（GitHub 的代码搜索必须登录）。可以先用 search_api_docs 查接口清单，":
        ["ERROR: no GitHub token set, so code search is unavailable (GitHub code search requires login). Use search_api_docs for the API list first,",
         "ERROR: 沒有設定 GitHub token，搜不了程式碼（GitHub 的程式碼搜尋必須登入）。可以先用 search_api_docs 查介面清單，"],
    "或者用 fetch_source 按文件路径读源码。用户想开这个功能的话，请他在「设置」里填 GitHub token。":
        [" or read sources by path with fetch_source. If the user wants this feature, ask them to enter a GitHub token in Settings.",
         "或者用 fetch_source 按檔案路徑讀原始碼。使用者想開這個功能的話，請他在「設定」裡填 GitHub token。"],
    "（token 无效或过期）": [" (token invalid or expired)", "（token 無效或過期）"],
    "（超过频率限制：代码搜索每分钟最多 10 次，稍等再试）": [" (rate limited: code search allows 10 requests per minute; try again shortly)", "（超過頻率限制：程式碼搜尋每分鐘最多 10 次，稍等再試）"],
    "（查询写法不对，或者这个仓库还没被 GitHub 索引）": [" (bad query, or the repo is not indexed by GitHub yet)", "（查詢寫法不對，或者這個儲存庫還沒被 GitHub 索引）"],
    "ERROR: GitHub 代码搜索失败: ": ["ERROR: GitHub code search failed: ", "ERROR: GitHub 程式碼搜尋失敗: "],
    "在 ": ["Nothing found in ", "在 "],
    " 里没有搜到。换个关键词，或者用 search_api_docs。": [". Try other keywords, or use search_api_docs.", " 裡沒有搜到。換個關鍵詞，或者用 search_api_docs。"],
    " 的默认分支里找到 ": ["'s default branch: found ", " 的預設分支裡找到 "],
    " 个文件": [" file(s)", " 個檔案"],
    "（显示前 ": [" (showing the first ", "（顯示前 "],
    "注意：搜的是 MuseScore 官方仓库的默认分支（开发中的新版本），不一定和 ":
        ["Note: this searched the official MuseScore repo's default branch (the in-development version), which may differ from ", "注意：搜的是 MuseScore 官方儲存庫的預設分支（開發中的新版本），不一定和 "],
    " 一样。用 fetch_source 读 ": [". Use fetch_source to read ", " 一樣。用 fetch_source 讀 "],
    " 的同名文件确认；文件不存在就说明 ": ["'s file of the same name to confirm; if it doesn't exist, ", " 的同名檔案確認；檔案不存在就說明 "],
    " 里在别的位置。": [" keeps it elsewhere.", " 裡在別的位置。"],
    "GitHub 链接要指向 SKILL.md 文件（…/blob/…）或技能文件夹（…/tree/…）": ["The GitHub link must point to a SKILL.md file (…/blob/…) or a skill folder (…/tree/…)", "GitHub 連結要指向 SKILL.md 檔案（…/blob/…）或技能資料夾（…/tree/…）"],
    "gist 里没有 .md 文件": ["The gist has no .md file", "gist 裡沒有 .md 檔案"],
    "（GitHub 匿名访问每小时 60 次，填了 token 会多很多）": [" (anonymous GitHub access is limited to 60 requests per hour; a token raises it a lot)", "（GitHub 匿名存取每小時 60 次，填了 token 會多很多）"],
    "这个文件夹里没有 SKILL.md": ["This folder has no SKILL.md", "這個資料夾裡沒有 SKILL.md"],

    // ---- agent.js ----
    "网络错误或请求被中止（status 0）": ["network error or request aborted (status 0)", "網路錯誤或請求被中止（status 0）"],
    "响应不是 JSON: ": ["response is not JSON: ", "回應不是 JSON: "],
    "响应里没有 choices[0].message": ["response has no choices[0].message", "回應裡沒有 choices[0].message"],
    "已中止": ["stopped", "已中止"],
    "模型没有返回内容": ["the model returned no content", "模型沒有回傳內容"],
    "（finish_reason: ": [" (finish_reason: ", "（finish_reason: "],
    "ERROR: 用户中止了，这个工具没有执行完": ["ERROR: the user stopped; this tool did not finish", "ERROR: 使用者中止了，這個工具沒有執行完"],
    "ERROR: 参数不是合法 JSON: ": ["ERROR: arguments are not valid JSON: ", "ERROR: 參數不是合法 JSON: "],
    "ERROR: 工具执行异常: ": ["ERROR: tool threw an exception: ", "ERROR: 工具執行異常: "],
    "[插件提示] 这一轮的工具调用已经到上限（": ["[Plugin note] This turn has reached the tool call limit (", "[外掛提示] 這一輪的工具呼叫已經到上限（"],
    " 次）。现在不要再调用工具。": ["). Do not call any more tools now.", " 次）。現在不要再呼叫工具。"],
    "请用中文简短说明：已经完成了什么、卡在哪里、建议我下一步怎么做。":
        ["Briefly explain in English: what has been done, where it is stuck, and what you suggest I do next.", "請用繁體中文簡短說明：已經完成了什麼、卡在哪裡、建議我下一步怎麼做。"],
    "这一轮的工具调用到上限了（": ["This turn hit the tool call limit (", "這一輪的工具呼叫到上限了（"],
    " 次）。点「继续」可以让它接着做。": ["). Click “Continue” to let it carry on.", " 次）。點「繼續」可以讓它接著做。"],

    // ---- bridge.js ----
    "job.json 不是合法 JSON：": ["job.json is not valid JSON: ", "job.json 不是合法 JSON："],
    "job.json 应当是一个对象 {id, tool, args}": ["job.json must be an object {id, tool, args}", "job.json 應當是一個物件 {id, tool, args}"],
    "不认识的工具 ": ["Unknown tool ", "不認識的工具 "],
    "。可用：": [". Available: ", "。可用："],
    "run_script（": ["run_script (", "run_script（"],
    " 字）": [" chars)", " 字）"],
    "…（共 ": ["…(total ", "…（共 "],
    " 字，完整结果在 bridge/result.json）": [" chars; full result in bridge/result.json)", " 字，完整結果在 bridge/result.json）"],

    // ---- theory.js ----
    " 个升号": [" sharp(s)", " 個升號"],
    " 个降号": [" flat(s)", " 個降號"],
    "没有升降号": ["no sharps or flats", "沒有升降號"],
    " 大调 / ": [" major / ", " 大調 / "],
    " 小调（": [" minor (", " 小調（"]
};

// 系统区域设置 → 界面语言。目前设置里只提供 English / 中文 两档，"中文"就是繁体；
// 简体（zh-Hans）的字典和 t() 都还在，config.json 里手写 "lang": "zh-Hans" 仍然生效，只是下拉框里不列。
function detect(localeName) {
    var n = String(localeName || "").replace(/-/g, "_");
    if (n.indexOf("zh") === 0) { return "zh-Hant"; }
    return "en";
}

// core/*.js 里的 T() 用这个：语言由 QML 在 lang 变化时通过 setLang 设定（.pragma library，全插件共用一份）
var current = "zh-Hans";
function setLang(l) { current = l || "zh-Hans"; }
function currentLang() { return current; }
function tr(key) { return t(key, current); }

function t(key, lang) {
    if (!lang || lang === "zh-Hans") { return key; }
    var e = STRINGS[key];
    if (!e) { return key; }
    var v = lang === "en" ? e[0] : e[1];
    return (v === undefined || v === null) ? key : v;
}
