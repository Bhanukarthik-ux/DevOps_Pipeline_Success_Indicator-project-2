"""
CodePipeline EventBridge -> Lambda -> S3 status.json
Environment variable: STATUS_BUCKET
Optional environment variable: STATUS_KEY (default: status.json)
"""
import json
import os
import boto3
from datetime import datetime, timezone

s3 = boto3.client("s3")
BUCKET = os.environ["STATUS_BUCKET"]
KEY = os.environ.get("STATUS_KEY", "status.json")

def lambda_handler(event, context):
    detail = event.get("detail", {})
    state = detail.get("state", "UNKNOWN")
    allowed = {"SUCCEEDED", "FAILED", "CANCELED", "STOPPED", "IN_PROGRESS"}
    if state not in allowed:
        state = "UNKNOWN"

    payload = {
        "pipelineName": detail.get("pipeline", "student-app-pipeline"),
        "executionId": detail.get("execution-id", "not-provided"),
        "status": state if state in {"SUCCEEDED", "FAILED", "IN_PROGRESS"} else "FAILED",
        "stage": detail.get("stage", "Pipeline"),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "AWS CodePipeline"
    }

    s3.put_object(
        Bucket=BUCKET,
        Key=KEY,
        Body=json.dumps(payload).encode("utf-8"),
        ContentType="application/json",
        CacheControl="no-store"
    )
    return {"statusCode": 200, "body": json.dumps({"message": "Pipeline status updated", "status": payload["status"]})}
