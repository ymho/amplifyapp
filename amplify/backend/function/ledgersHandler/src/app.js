/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_DYNAMODBACCOUNTMANAGER_ARN
	STORAGE_DYNAMODBACCOUNTMANAGER_NAME
	STORAGE_DYNAMODBACCOUNTMANAGER_STREAMARN
	STORAGE_S3ACCOUNTMANAGER_BUCKETNAME
	STORAGE_SERVICEMASTER_ARN
	STORAGE_SERVICEMASTER_NAME
	STORAGE_SERVICEMASTER_STREAMARN
Amplify Params - DO NOT EDIT */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  PutCommand,
  QueryCommand,
  DynamoDBDocumentClient,
} = require("@aws-sdk/lib-dynamodb");
const awsServerlessExpressMiddleware = require("aws-serverless-express/middleware");
const bodyParser = require("body-parser");
const express = require("express");

const ddbClient = new DynamoDBClient({ region: process.env.TABLE_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const tableName = process.env.STORAGE_DYNAMODBACCOUNTMANAGER_NAME;

const app = express();

app.use(bodyParser.json());
app.use(awsServerlessExpressMiddleware.eventContext());

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

// GET /ledgers - Ledger一覧取得（METAのみ）
app.get("/ledgers", async (req, res) => {
  console.log("🔍 GET /ledgers - 一覧取得（METAのみ）");
  try {
    const result = await ddbDocClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "gsi2",
        KeyConditionExpression: "gsi2pk = :pk and gsi2sk = :sk",
        ExpressionAttributeValues: {
          ":pk": "LEDGER",
          ":sk": "META",
        },
      })
    );
    console.log("📦 DynamoDBからの読み込み結果:", result.Items);
    res.json(result.Items);
  } catch (err) {
    console.error("🔥 DynamoDBからの読み込み失敗:", err);
    res.status(500).json({ error: "Failed to fetch ledgers: " + err.message });
  }
});

// POST /ledgers - Ledger登録（META + USERS + SERVICES）
app.post("/ledgers", async (req, res) => {
  console.log("📦 POST /ledgers - Ledger登録");
  const {
    approval_id,
    created_at,
    updated_at,
    users = [],
    allowed_services = [],
  } = req.body;

  const metaItem = {
    pk: `LEDGER#${approval_id}`,
    sk: "META",
    approval_id,
    created_at,
    updated_at,
    gsi2pk: "LEDGER",
    gsi2sk: "META",
  };

  try {
    await ddbDocClient.send(
      new PutCommand({ TableName: tableName, Item: metaItem })
    );

    for (const user of users) {
      const userItem = {
        pk: `LEDGER#${approval_id}`,
        sk: `USER#${user.email}`,
        ...user,
        gsi3pk: `USER#${user.email}`,
      };
      await ddbDocClient.send(
        new PutCommand({ TableName: tableName, Item: userItem })
      );
    }

    for (const service of allowed_services) {
      const serviceItem = {
        pk: `LEDGER#${approval_id}`,
        sk: `SERVICE#${service.name}`,
        ...service,
      };
      await ddbDocClient.send(
        new PutCommand({ TableName: tableName, Item: serviceItem })
      );
    }
    console.log("📦 Ledger 登録成功");
    res.status(201).json({ message: "Ledger and users created" });
  } catch (err) {
    console.error("🔥 Ledger作成失敗:", err);
    res.status(500).json({ error: "Failed to create ledger: " + err.message });
  }
});

app.get("/ledgers/managed-by", async (req, res) => {
  console.log("🔍 GET /ledgers/managed-by");
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  try {
    const result = await ddbDocClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "gsi3",
        KeyConditionExpression: "gsi3pk = :email",
        FilterExpression: "is_manager = :trueVal",
        ExpressionAttributeValues: {
          ":email": `USER#${email}`,
          ":trueVal": true,
        },
      })
    );

    const approvalIds = result.Items.map((item) =>
      item.pk.replace("LEDGER#", "")
    );

    res.json({ approval_ids: approvalIds });
  } catch (err) {
    console.error("🔥 管理台帳取得失敗:", err);
    res.status(500).json({ error: "Failed to fetch ledgers for user" });
  }
});

// GET /ledgers/:approval_id - 詳細取得（META + USERS + SERVICES）
app.get("/ledgers/:approval_id", async (req, res) => {
  console.log("🔍 GET /ledgers/:approval_id - 詳細取得（META + USERS + SERVICES）");
  const approval_id = req.params.approval_id;
  const pk = `LEDGER#${approval_id}`;
  try {
    const data = await ddbDocClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": pk },
      })
    );

    const meta = data.Items.find((item) => item.sk === "META");
    const users = data.Items.filter((item) => item.sk.startsWith("USER#"));
    const services = data.Items.filter((item) =>
      item.sk.startsWith("SERVICE#")
    );
    console.log("📦 詳細取得結果:", { meta, users, services });
    res.json({ ...meta, users, allowed_services: services });
  } catch (err) {
    console.error("🔥 詳細取得失敗:", err);
    res.status(500).json({ error: "Failed to get ledger: " + err.message });
  }
});

// POST /ledgers/:approval_id/users - ユーザ追加
app.post("/ledgers/:approval_id/users", async (req, res) => {
  console.log("📦 POST /ledgers/:approval_id/users - ユーザ追加");
  const approval_id = req.params.approval_id;
  const user = req.body;
  const item = {
    pk: `LEDGER#${approval_id}`,
    sk: `USER#${user.email}`,
    ...user,
    gsi3pk: `USER#${user.email}`,
  };
  try {
    await ddbDocClient.send(
      new PutCommand({ TableName: tableName, Item: item })
    );
    console.log("📦 ユーザ追加成功:", item);
    res.status(201).json({ message: "User added to ledger" });
  } catch (err) {
    console.error("🔥 ユーザ追加失敗:", err);
    res.status(500).json({ error: "Failed to add user: " + err.message });
  }
});

// POST /ledgers/:approval_id/services - サービス追加
app.post("/ledgers/:approval_id/services", async (req, res) => {
  console.log("📦 POST /ledgers/:approval_id/services - サービス追加");
  const approval_id = req.params.approval_id;
  const service = req.body;
  const item = {
    pk: `LEDGER#${approval_id}`,
    sk: `SERVICE#${service.display_name}`,
    ...service,
  };
  try {
    await ddbDocClient.send(
      new PutCommand({ TableName: tableName, Item: item })
    );
    console.log("📦 サービス追加成功:", item);
    res.status(201).json({ message: "Service added to ledger" });
  } catch (err) {
    console.error("🔥 サービス追加失敗:", err);
    res.status(500).json({ error: "Failed to add service: " + err.message });
  }
});


app.listen(3000, () => console.log("Ledger API (META-style) started"));
module.exports = app;
