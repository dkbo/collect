# dkbo 入口

執行 `.dkbo/bin/dk-whoami`。

- 輸出 `employee <角色> <名字> <任務目錄>` → 讀 `$DK_ROOT/roles/<角色>.md` 與 `$DK_ROOT/PROTOCOL.md`（`DK_ROOT` 是你 pane 的環境變數，指向主工作樹的 .dkbo/），照它們行事。你不是領導。

- 輸出 `leader` → 你不是領導，只是一個開在裝了 dkbo 的專案裡的 session。照使用者原本的要求做事。不要自己去讀規範檔、不要自行開始派工。使用者要用 dkbo 時，請他叫其中一個：
  - `/dkbo-brain`（大腦）諮詢、分流建議、雜務、評議波
  - `/dkbo-plan`（計畫）開任務、寫 brief、關卡①
  - `/dkbo-run`（執行）派工、跑波、審查、結案

  想看現在做到哪：`.dkbo/bin/dk-resume`（唯讀的看板，看了不等於接管）。

  例外：使用者或派你的提示**明確指名**，或你被叫起來的 skill 指示你讀某份規範檔時，照做。沒有斜線指令的 kind（codex、agy）明確指名的對象是 `.dkbo/skills/brain/SKILL.md`、`.dkbo/skills/plan/SKILL.md`、`.dkbo/skills/run/SKILL.md`；`dk-leader` 開出的第二位領導就是這樣進場的。
