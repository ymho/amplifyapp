const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  GetCommand,
  PutCommand,
  QueryCommand,
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

// GET /inquiries - 一覧取得（META）
app.get("/inquiries", async (req, res) => {
  try {
    const result = await ddbDocClient.send(new QueryCommand({
      TableName: tableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1pk = :pk and GSI1sk = :sk",
      ExpressionAttributeValues: {
        ":pk": "INQUIRY",
        ":sk": "META"
      }
    }));
    res.json(result.Items);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch inquiries: " + err.message });
  }
});

// POST /inquiries - 新規作成（META + MESSAGE#...）
app.post("/inquiries", async (req, res) => {
  const { id, status, created_at, updated_at, messages = [] } = req.body;

  const metaItem = {
    pk: `INQUIRY#${id}`,
    sk: "META",
    id,
    status,
    // approval_id,
    created_at,
    updated_at,
    GSI1pk: "INQUIRY",
    GSI1sk: "META"
  };

  try {
    await ddbDocClient.send(new PutCommand({ TableName: tableName, Item: metaItem }));

    for (const message of messages) {
      await ddbDocClient.send(new PutCommand({
        TableName: tableName,
        Item: {
          pk: `INQUIRY#${id}`,
          sk: `MESSAGE#${message.timestamp}`,
          ...message
        }
      }));
    }

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
    const result = await ddbDocClient.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": `INQUIRY#${id}` }
    }));

    const meta = result.Items.find(item => item.sk === "META");
    const messages = result.Items.filter(item => item.sk.startsWith("MESSAGE#"));
    res.json({ ...meta, messages });
  } catch (err) {
    res.status(500).json({ error: "Failed to get inquiry: " + err.message });
  }
});

// POST /inquiries/:id/messages - メッセージ追加
app.post("/inquiries/:id/messages", async (req, res) => {
  const id = req.params.id;
  const message = req.body;
  try {
    await ddbDocClient.send(new PutCommand({
      TableName: tableName,
      Item: {
        pk: `INQUIRY#${id}`,
        sk: `MESSAGE#${message.timestamp}`,
        ...message
      }
    }));
    res.status(201).json({ message: "Message added" });
  } catch (err) {
    res.status(500).json({ error: "Failed to add message: " + err.message });
  }
});

app.listen(3000, () => console.log("Inquiry API started"));
module.exports = app;