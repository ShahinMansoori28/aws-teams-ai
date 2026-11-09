import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Created once per Lambda container (outside the handler), reused by every warm invoke.
// No endpoint here: on Floci, Floci injects AWS_ENDPOINT_URL into the Lambda; on AWS it's unset.
export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export function tableName(): string {
  const t = process.env.TABLE_NAME;
  if (!t) throw new Error("TABLE_NAME is not set");
  return t;
}
