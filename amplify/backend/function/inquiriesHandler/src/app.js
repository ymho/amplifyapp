const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  GetCommand,
  PutCommand,
  QueryCommand,
  DynamoDBDocumentClient,
} = require("@aws-sdk/lib-dynamodb");

const awsServerlessExpressMiddleware = require("aws-serverless-express/middleware");
const bodyParser = require("body-parser");
const express = require("express");

const ddbClient = new DynamoDBClient({ region: process.env.TABLE_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

let tableName = "dynamodbaccountmanager";
if (process.env.ENV && process.env.ENV !== "NONE") {
  tableName = tableName + "-" + process.env.ENV;
}

const app = express();

app.use(bodyParser.json());
app.use(awsServerlessExpressMiddleware.eventContext());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-username"
  );
  if (req.method === "OPTIONS") {
    return res.status(200).json({
      message: "CORS preflight passed",
    });
  }
  next();
});

app.use((req, res, next) => {
  const claims =
    req.apiGateway?.event?.requestContext?.authorizer?.claims || {};
  const groups = claims["cognito:groups"]?.split(",") || [];
  console.log("📜 requestContext:", req.apiGateway?.event?.requestContext);
  console.log("🔐 userclaims:", claims);

  req.user = {
    email: claims.email,
    given_name: claims.given_name,
    family_name: claims.family_name,
    groups,
    username: claims["cognito:username"],
    isAdmin: groups.includes("admin"),
  };

  req.isAdmin = req.user.isAdmin;
  req.userRole = req.isAdmin ? "admin" : "user";

  console.log("✅ 認証済ユーザー:", req.user);

  next();
});

// GET /inquiries - Inquiry一覧取得（METAのみ）
app.get("/inquiries", async (req, res) => {
  console.log("🔍 GET /inquiries-  Inquiry一覧取得（METAのみ）");
  if (req.isAdmin) {
    try {
      const result = await ddbDocClient.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: "gsi1",
          KeyConditionExpression: "gsi1pk = :pk and gsi1sk = :sk",
          ExpressionAttributeValues: {
            ":pk": "INQUIRY",
            ":sk": "META",
          },
        })
      );
      console.log("📦 Inquiry一覧の読み込み結果:", result.Items);
      res.json(result.Items);
    } catch (err) {
      console.error("🔥 Inquiry一覧の読み込み失敗:", err);
      res
        .status(500)
        .json({ error: "Failed to fetch inquiries: " + err.message });
    }
  } else {
    // 一般ユーザー: 関与している問い合わせを取得
    try {
      const result = await ddbDocClient.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: "gsi4",
          KeyConditionExpression: "gsi4pk = :email and gsi4sk = :sk",
          ExpressionAttributeValues: {
            ":email": `USER#${req.user.email}`,
            ":sk": "META",
          },
        })
      );
      console.log(
        "📦 Inquiry一覧の読み込み結果（一般ユーザー）:",
        result.Items
      );
      res.json(result.Items);
    } catch (err) {
      console.error("🔥 Inquiry一覧の読み込み失敗（一般ユーザー）:", err);
      res
        .status(500)
        .json({ error: "Failed to fetch managed ledgers: " + err.message });
    }
  }
});

// POST /inquiries - 新規作成（META + MESSAGE#...）
app.post("/inquiries", async (req, res) => {
  const { id, status, title, created_at, updated_at, messages = [] } = req.body;

  const metaItem = {
    pk: `INQUIRY#${id}`,
    sk: "META",
    id,
    status,
    title,
    // approval_id,
    created_at,
    updated_at,
    gsi1pk: "INQUIRY",
    gsi1sk: "META",
    gsi4pk: `USER#${req.user.email}`,
    gsi4sk: "META",
  };

  try {
    await ddbDocClient.send(
      new PutCommand({ TableName: tableName, Item: metaItem })
    );

    for (const message of messages) {
      await ddbDocClient.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            pk: `INQUIRY#${id}`,
            sk: `MESSAGE#${message.created_at}`,
            ...message,
            gsi1pk: "INQUIRY",
            gsi1sk: "MESSAGE",
          },
        })
      );
    }
    console.log("📦 DynamoDBへの書き込み成功:", metaItem);
    res.status(201).json({ message: "Inquiry created" });
  } catch (err) {
    console.error("🔥 DynamoDB書き込み失敗:", err);
    res.status(500).json({ error: "Failed to create inquiry: " + err.message });
  }
});

// GET /inquiries/:id - 詳細取得（META + MESSAGES）
app.get("/inquiries/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const result = await ddbDocClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `INQUIRY#${id}` },
      })
    );

    const meta = result.Items.find((item) => item.sk === "META");
    const messages = result.Items.filter((item) =>
      item.sk.startsWith("MESSAGE#")
    );

    console.log("📦 DynamoDBからの読み込み結果:", { ...meta, messages });
    res.json({ ...meta, messages });
  } catch (err) {
    console.error("🔥 DynamoDBからの読み込み失敗:", err);
    res.status(500).json({ error: "Failed to get inquiry: " + err.message });
  }
});

// POST /inquiries/:id - ステータス更新など
app.post("/inquiries/:id", async (req, res) => {
  const id = req.params.id;
  const { status, updated_at } = req.body;

  const result = await ddbDocClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { pk: `INQUIRY#${id}`, sk: "META" },
    })
  );

  const existing = result.Item;

  try {
    await ddbDocClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          ...existing,
          status,
          updated_at,
        },
        ConditionExpression: "attribute_exists(pk)",
      })
    );

    console.log("✅ ステータス更新成功:", { id, status });
    res.json({ message: "Status updated" });
  } catch (err) {
    console.error("🔥 ステータス更新失敗:", err);
    res.status(500).json({ error: "Failed to update status: " + err.message });
  }
});

// POST /inquiries/:id/messages - メッセージ追加
app.post("/inquiries/:id/messages", async (req, res) => {
  console.log("📨 POST /inquiries/:id/messages reached", req.params.id);
  const id = req.params.id;
  const message = req.body;

  try {
    const now = new Date().toISOString();

    // ① メッセージ追加
    await ddbDocClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          pk: `INQUIRY#${id}`,
          sk: `MESSAGE#${message.created_at}`,
          ...message,
          gsi1pk: "INQUIRY",
          gsi1sk: "MESSAGE",
          gsi4pk: `USER#${req.user.email}`,
          gsi4sk: "MESSAGE",
        },
      })
    );

    // ② METAのupdated_at更新
    const metaResult = await ddbDocClient.send(
      new GetCommand({
        TableName: tableName,
        Key: { pk: `INQUIRY#${id}`, sk: "META" },
      })
    );

    const existingMeta = metaResult.Item;
    if (existingMeta) {
      existingMeta.updated_at = now;

      await ddbDocClient.send(
        new PutCommand({
          TableName: tableName,
          Item: existingMeta,
        })
      );
    }

    console.log("📦 メッセージ追加およびMETA更新成功");
    res.status(201).json({ message: "Message added and updated_at updated" });
  } catch (err) {
    console.error("🔥 メッセージ追加またはMETA更新失敗:", err);
    res.status(500).json({ error: "Failed to add message: " + err.message });
  }
});


app.listen(3000, () => console.log("Inquiry API started"));
module.exports = app;
