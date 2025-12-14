# Remote backend configuration
# Bootstrapで作成されたS3バケットとDynamoDBテーブルを使用
#
# 注意: このファイルは変数を使用できないため、bootstrap実行後に手動で更新してください
#
# 手順:
# 1. bootstrap/variables.tfのs3_bucket_nameのデフォルト値を確認
# 2. 以下のbucket とdynamodb_tableの値を更新
# 3. terraform init を実行

terraform {
  backend "s3" {
    bucket         = "my-project-terraform-state" # ← bootstrap/variables.tfと同じ値に変更
    key            = "dev/terraform.tfstate"
    region         = "ap-northeast-1"
    dynamodb_table = "terraform-state-lock" # ← bootstrap/variables.tfと同じ値に変更
    encrypt        = true
  }
}
