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

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-username"
  );
  if (req.method === "OPTIONS") {
    return res.status(200).json({
      message: "CORS preflight passed"
    });
  }
  next();
});

app.use((req, res, next) => {
  const claims = req.apiGateway?.event?.requestContext?.authorizer?.claims || {};
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

// GET /ledgers - Ledger一覧取得（METAのみ）
app.get("/ledgers", async (req, res) => {
  console.log("🔍 GET /ledgers-  Ledger一覧取得（METAのみ）");
  if (req.isAdmin) {
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
      console.log("📦 Ledger一覧の読み込み結果:", result.Items);
      res.json(result.Items);
    } catch (err) {
      console.error("🔥 Ledger一覧の取得失敗:", err);
      res
        .status(500)
        .json({ error: "Failed to fetch ledgers: " + err.message });
    }
  } else {
    // 一般ユーザー: 管理している台帳を取得
    try {
      const result = await ddbDocClient.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: "gsi3",
          KeyConditionExpression: "gsi3pk = :email",
          FilterExpression: "is_manager = :trueVal",
          ExpressionAttributeValues: {
            ":email": `USER#${req.user.email}`,
            ":trueVal": true,
          },
        })
      );

      const approvalIds = result.Items.map((item) =>
        item.pk.replace("LEDGER#", "")
      );

      // 台帳のMETAを個別取得（複数回Query）
      const metas = await Promise.all(
        approvalIds.map(async (id) => {
          const metaRes = await ddbDocClient.send(
            new QueryCommand({
              TableName: tableName,
              KeyConditionExpression: "pk = :pk and sk = :sk",
              ExpressionAttributeValues: {
                ":pk": `LEDGER#${id}`,
                ":sk": "META",
              },
            })
          );
          return metaRes.Items?.[0];
        })
      );

      res.json(metas.filter(Boolean)); // null を除外
    } catch (err) {
      console.error("🔥 管理台帳取得失敗:", err);
      res
        .status(500)
        .json({ error: "Failed to fetch managed ledgers: " + err.message });
    }
  }
});

// POST /ledgers - Ledger登録（META + USERS + SERVICES）
app.post("/ledgers", async (req, res) => {
  console.log("📦 POST /ledgers - Ledger登録（META + USERS + SERVICES）");
  if (!req.isAdmin) {
    return res.status(403).json({ error: "Only admin can create ledgers." });
  }

  console.log("👤 admin:", req.user.email, "📦 Ledger作成");

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

  const resultSummary = {
    meta: null,
    users: { success: [], failed: [] },
    services: { success: [], failed: [] },
  };

  try {
    // ① META登録
    await ddbDocClient.send(
      new PutCommand({ TableName: tableName, Item: metaItem })
    );
    resultSummary.meta = "success";
  } catch (err) {
    console.error("🔥 META登録失敗:", err);
    resultSummary.meta = "failed";
    return res.status(500).json({
      message: "Ledger creation failed at META stage.",
      result: resultSummary,
    });
  }

  // ② USERS登録（失敗しても処理継続）
  for (const user of users) {
    const userItem = {
      pk: `LEDGER#${approval_id}`,
      sk: `USER#${user.email}`,
      ...user,
      gsi3pk: `USER#${user.email}`,
    };

    try {
      await ddbDocClient.send(
        new PutCommand({ TableName: tableName, Item: userItem })
      );
      resultSummary.users.success.push(user.email);
    } catch (err) {
      console.warn(`⚠️ USER登録失敗 (${user.email}):`, err.message);
      resultSummary.users.failed.push(user.email);
    }
  }

  // ③ SERVICES登録（失敗しても処理継続）
  for (const service of allowed_services) {
    const serviceItem = {
      pk: `LEDGER#${approval_id}`,
      sk: `SERVICE#${service.name}`,
      ...service,
    };

    try {
      await ddbDocClient.send(
        new PutCommand({ TableName: tableName, Item: serviceItem })
      );
      resultSummary.services.success.push(service.name);
    } catch (err) {
      console.warn(`⚠️ SERVICE登録失敗 (${service.name}):`, err.message);
      resultSummary.services.failed.push(service.name);
    }
  }

  console.log("✅ Ledger 作成処理結果:", resultSummary);

  return res.status(207).json({
    message: "Ledger creation completed with partial result",
    result: resultSummary,
  });
});

// GET /ledgers/:approval_id - 詳細取得（META + USERS + SERVICES）
app.get("/ledgers/:approval_id", async (req, res) => {
  console.log(
    "🔍 GET /ledgers/:approval_id - 詳細取得（META + USERS + SERVICES）"
  );
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
  if (!req.isAdmin) {
    return res.status(403).json({ error: "Only admin can add services." });
  }

  const approval_id = req.params.approval_id;
  const service = req.body;

  try {
    await ddbDocClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          pk: `LEDGER#${approval_id}`,
          sk: `SERVICE#${service.name}`,
          ...service,
        },
      })
    );

    console.log("✅ サービス追加成功 by", req.user.email);
    res.status(201).json({ message: "Service added to ledger" });
  } catch (err) {
    console.error("🔥 サービス追加失敗:", err);
    res.status(500).json({ error: "Failed to add service: " + err.message });
  }
});

app.listen(3000, () => console.log("Ledger API (META-style) started"));
module.exports = app;
