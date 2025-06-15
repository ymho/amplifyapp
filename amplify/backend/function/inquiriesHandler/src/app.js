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

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

// GET /inquiries - 一覧取得（META）
app.get("/inquiries", async (req, res) => {
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
    console.log("🔍 gsi1pk = :pk and gsi1sk = :sk", {
      ":pk": "INQUIRY",
      ":sk": "META",
    });
    console.log("📦 DynamoDBからの読み込み結果:", result.Items);
    res.json(result.Items);
  } catch (err) {
    console.error("🔥 DynamoDBからの読み込み失敗:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch inquiries: " + err.message });
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
    console.log("📦 DynamoDBへの書き込み成功:", {
      pk: `INQUIRY#${id}`,
      sk: `MESSAGE#${message.created_at}`,
      ...message,
    });
    res.status(201).json({ message: "Message added" });
  } catch (err) {
    console.error("🔥 DynamoDB書き込み失敗:", err);
    res.status(500).json({ error: "Failed to add message: " + err.message });
  }
});

app.listen(3000, () => console.log("Inquiry API started"));
module.exports = app;
