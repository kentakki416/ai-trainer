# English Card Battle - Terraform Infrastructure

## 概要

English Card BattleのTerraformインフラストラクチャです。

## 🚀 **クイックスタート**

### 必要なツールをインストール
```bash
# 必要なツールのインストール
brew install terraform
brew install tfsec
python3 -m pip install checkov
brew install trivy
```
### aws認証
ローカルで実行する場合、管理者からsecret情報をもらい、aws認証情報を設定してください。
```bash
# AWS認証情報の設定
aws configure
export AWS_DEFAULT_REGION="ap-northeast-1"
```
### terraform初期化
ローカルに.terraformディレクトリが作成されます。
```bash
cd aws/env/dev
terraform init
```

## 💪 実行コマンド

### 差分検知
```bash
cd aws/env/dev/
terraform plan
```
### デプロイ
```bash
cd aws/env/dev
terraform apply
```
### 削除
```bash
cd aws/env/dev
terraform destroy
```

## ✅ 開発コマンド
### フォーマット整形
```bash
cd aws/env/dev
terraform fmt -check -recursive -diff
```
### バリデーションチェック
```bash
cd aws/env/dev
terraform validate
```
### lint
tflintによるlintチェック
```bash
tflint --init
tflint --chdir=aws/env/dev --config=$(pwd)/.tflint.hcl --recursive
```

### ポリシーチェック
checkovによるポリシーチェック
```bash
# PATHに追加（初回のみ）
export PATH="$HOME/Library/Python/3.9/bin:$PATH"
# lint実行
checkov -d . --framework terraform --config-file .checkov.yml
```

## 🛡️ セキュリティチェック

### Trivyによる脆弱性チェック

```bash
# 設定ファイルを使用
trivy config aws/env/dev -c .trivy.yml
```
