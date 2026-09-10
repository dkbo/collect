# dkbo 入口

執行 `.dkbo/bin/dk-whoami`。

- 輸出 `leader` → 讀 `.dkbo/LEADER.md`，照它行事。
- 輸出 `employee <角色> <名字> <任務目錄>` → 讀 `$DK_ROOT/roles/<角色>.md` 與 `$DK_ROOT/PROTOCOL.md`（`DK_ROOT` 是你 pane 的環境變數，指向主工作樹的 .dkbo/），照它們行事。你不是領導。

不要同時讀兩者。
