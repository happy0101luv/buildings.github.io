# Supabase 配置

1. 在 Supabase 创建项目。
2. 打开 SQL Editor，执行 [`supabase/schema.sql`](supabase/schema.sql)。
3. 在 Authentication 的 URL Configuration 中设置：
   - Site URL：`https://happy0101luv.github.io/buildings.github.io/`
   - Redirect URL：`https://happy0101luv.github.io/buildings.github.io/login/`
4. 在项目 Settings / API 中复制 Project URL 和公开的 anon/publishable key。
5. 填入根目录 `supabase-config.js`：

```js
window.WANWU_SUPABASE = Object.freeze({
  url: "https://你的项目.supabase.co",
  anonKey: "你的公开 anon 或 publishable key",
  storageBucket: "collection-images",
});
```

anon/publishable key 可以放在浏览器前端；安全边界由 RLS 保证。严禁把 `service_role` 密钥写入仓库。

邮件确认可在 Authentication / Providers / Email 中调整。配置完成前，应用会提示 Supabase 尚未配置。
