# Loot Ledger｜瑪奇分贓帳本

靜態的瑪奇戰利品分帳工具。輸入掉落物、玩家與價格後，會依清單中的玩家數量平均計算；資料與近期玩家名稱皆保存在瀏覽器中。

## 本機執行

```bash
npm install
npm run dev
```

## 部署 GitHub Pages

推送至 `main` 後，`.github/workflows/deploy-pages.yml` 會自動建置及部署。首次使用時，請到儲存庫的 **Settings → Pages**，將 Source 設為 **GitHub Actions**。

若儲存庫名稱不是 `SharetheSpoils`，請將 `vite.config.js` 中的 `base` 改為 `/<儲存庫名稱>/`。
