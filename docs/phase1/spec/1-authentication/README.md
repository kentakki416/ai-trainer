# ユーザー認証機能

## 概要
Google OAuth 2.0 を唯一のサインイン手段として提供し、初回ログイン画面からログイン/サインアップを統合的に行う。認証完了後は JWT によりフロント/バックエンド間でセッションを管理し、ユーザープロフィールを自動生成する。

## Google OAuth
- 認証方式: Google OAuth 2.0 のみ
- セッション管理:
  - Access Token: 有効期限1時間
  - Refresh Token: 有効期限30日

## ユーザープロフィール
ログイン後に自動作成するプロフィールに以下を保存する:
- Google ID
- 名前
- メールアドレス
- プロフィール画像URL

## 関連ドキュメント
- [API仕様書](../api/api-specification.md)
- [データベーススキーマ](../database/database-schema.md)

