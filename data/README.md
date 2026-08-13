# 数据目录

此目录用于保存可公开提交到 GitHub 的初始数据、字段示例与人工导出的脱敏备份。

- `collection.example.json`：收藏记录结构示例。
- 真实用户记录保存在 Supabase Postgres，不提交到 GitHub。
- 用户上传的图片保存在 Supabase Storage，不提交到 GitHub。
- `supabase/` 中是数据库初始化与 RLS 安全策略。

不要把 Supabase `service_role` 密钥、用户密码、访问令牌或私人数据提交到仓库。
