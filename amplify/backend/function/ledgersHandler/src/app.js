const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  DynamoDBDocumentClient
} = require('@aws-sdk/lib-dynamodb');
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware');
const bodyParser = require('body-parser');
const express = require('express');

const ddbClient = new DynamoDBClient({ region: process.env.TABLE_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

let tableName = "dynamodbaccountmanager";
if (process.env.ENV && process.env.ENV !== "NONE") {
  tableName = tableName + '-' + process.env.ENV;
}

const app = express();
app.use(bodyParser.json());
app.use(awsServerlessExpressMiddleware.eventContext());

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

// GET /ledgers - 一覧取得（METAのみ）
app.get("/ledgers", async (req, res) => {
  const params = {
    TableName: tableName,
    IndexName: "GSI1", // GSIが必要（PK begins_with 'LEDGER#', SK = 'META'）
    KeyConditionExpression: "SK = :sk",
    ExpressionAttributeValues: {
      ":sk": "META"
    }
  };
  try {
    const data = await ddbDocClient.send(new QueryCommand(params));
    res.json(data.Items);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch ledgers: " + err.message });
  }
});

// POST /ledgers - 作成
app.post("/ledgers", async (req, res) => {
  const { approval_id, created_at, updated_at } = req.body;
  const item = {
    PK: `LEDGER#${approval_id}`,
    SK: "META",
    approval_id,
    created_at,
    updated_at
  };
  try {
    await ddbDocClient.send(new PutCommand({ TableName: tableName, Item: item }));
    res.status(201).json({ message: "Ledger created" });
  } catch (err) {
    res.status(500).json({ error: "Failed to create ledger: " + err.message });
  }
});

// GET /ledgers/:approval_id - 詳細取得（META + USERS + SERVICES）
app.get("/ledgers/:approval_id", async (req, res) => {
  const approval_id = req.params.approval_id;
  const pk = `LEDGER#${approval_id}`;
  try {
    const data = await ddbDocClient.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": pk }
    }));

    const meta = data.Items.find(item => item.SK === "META");
    const users = data.Items.filter(item => item.SK.startsWith("USER#"));
    const services = data.Items.filter(item => item.SK.startsWith("SERVICE#"));

    res.json({ ...meta, users, allowed_services: services });
  } catch (err) {
    res.status(500).json({ error: "Failed to get ledger: " + err.message });
  }
});

// POST /ledgers/:approval_id/users - ユーザ追加
app.post("/ledgers/:approval_id/users", async (req, res) => {
  const approval_id = req.params.approval_id;
  const user = req.body;
  const item = {
    PK: `LEDGER#${approval_id}`,
    SK: `USER#${user.email}`,
    ...user
  };
  try {
    await ddbDocClient.send(new PutCommand({ TableName: tableName, Item: item }));
    res.status(201).json({ message: "User added to ledger" });
  } catch (err) {
    res.status(500).json({ error: "Failed to add user: " + err.message });
  }
});

// POST /ledgers/:approval_id/services - サービス追加
app.post("/ledgers/:approval_id/services", async (req, res) => {
  const approval_id = req.params.approval_id;
  const service = req.body;
  const item = {
    PK: `LEDGER#${approval_id}`,
    SK: `SERVICE#${service.name}`,
    ...service
  };
  try {
    await ddbDocClient.send(new PutCommand({ TableName: tableName, Item: item }));
    res.status(201).json({ message: "Service added to ledger" });
  } catch (err) {
    res.status(500).json({ error: "Failed to add service: " + err.message });
  }
});

app.listen(3000, () => console.log("Ledger API (META-style) started"));
module.exports = app;