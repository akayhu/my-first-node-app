# 好物選物 STORE — 後端 API

好物選物電商專案的後端服務。提供商品 CRUD、會員註冊登入（JWT 認證）、訂單建立等 RESTful API，搭配 [前端專案](../my-vue-shop) 組成完整的全端電商應用。

## 技術棧

| 分類 | 技術 |
|---|---|
| 執行環境 | Node.js |
| 框架 | Express |
| 資料庫 | SQLite |
| ORM | Prisma |
| 認證 | JWT（jsonwebtoken）+ bcrypt 密碼雜湊 |
| 開發工具 | nodemon |

## 專案結構

.
├── index.js # 伺服器入口、所有路由
├── db.js # Prisma Client 實例
├── prisma/
│ ├── schema.prisma # 資料庫設計（Product / User / Order）
│ └── migrations/ # 資料庫遷移歷史
└── .env # 環境變數（不進版控）


## 資料模型

```prisma
model Product {
  id        Int      @id @default(autoincrement())
  name      String
  price     Int
  createdAt DateTime @default(now())
}

model User {
  id       Int    @id @default(autoincrement())
  email    String @unique
  password String
  orders   Order[]
}

model Order {
  id        Int      @id @default(autoincrement())
  userId    Int
  items     String   # JSON 字串
  total     Int
  createdAt DateTime @default(now())
}
```

## API 端點

### 商品

| 方法 | 路徑 | 說明 | 需要登入 |
|---|---|---|---|
| GET | `/products` | 取得商品列表，支援 `?search=關鍵字` | 否 |
| GET | `/products/:id` | 取得單一商品 | 否 |
| POST | `/products` | 新增商品 | ✅ |
| PUT | `/products/:id` | 修改商品 | 否 |
| DELETE | `/products/:id` | 刪除商品 | 否* |

\* 前端目前只在已登入時顯示刪除按鈕，若要在 API 層一併強制驗證，可加上 `authenticateToken` 中間件。

### 會員

| 方法 | 路徑 | 說明 |
|---|---|---|
| POST | `/register` | 註冊新帳號（密碼以 bcrypt 雜湊儲存） |
| POST | `/login` | 登入，成功回傳 JWT |

### 訂單

| 方法 | 路徑 | 說明 | 需要登入 |
|---|---|---|---|
| POST | `/orders` | 建立訂單 | ✅ |
| GET | `/orders` | 查詢自己的訂單 | ✅ |

需要登入的端點，請在 Header 帶上： 
Authorization: Bearer <token>

## 開始使用

### 安裝

```bash
npm install
```

### 環境變數

在根目錄建立 `.env`：

DATABASE_URL="file:./dev.db"
JWT_SECRET="換成你自己的一串複雜亂碼"


### 建立資料庫

```bash
npx prisma migrate dev --name init
```

### 啟動開發伺服器

```bash
npm run dev
```

伺服器會跑在 `http://localhost:3000`。

### 檢視資料庫（選用）

```bash
npx prisma studio
```

## 錯誤處理

所有路由統一透過 `try...catch` + `next(err)` 轉交給全域錯誤處理中間件，未預期的錯誤會回傳：

```json
{ "message": "伺服器發生錯誤，請稍後再試" }
```

完整錯誤堆疊會印在伺服器端的終端機（`console.error`），方便除錯但不會外洩給客戶端。

## 已知限制 / 未來可優化方向

- `Order.items` 目前用 JSON 字串儲存，正式專案建議拆成獨立的 `OrderItem` 資料表，方便查詢統計
- `PUT` / `DELETE /products/:id` 尚未加上 `authenticateToken` 保護，目前僅靠前端 UI 隱藏按鈕
- 資料庫使用 SQLite，正式上線建議換成 PostgreSQL / MySQL
- `cors()` 目前開放所有來源，正式部署前應收緊為只允許前端的正式網址

## License

MIT