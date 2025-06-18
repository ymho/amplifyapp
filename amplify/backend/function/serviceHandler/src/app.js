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
Amplify Params - DO NOT EDIT */ /* Amplify Params - DO NOT EDIT
	ENV
	REGION
Amplify Params - DO NOT EDIT */ // amplify/backend/function/serviceHandler/src/app.js

const express = require("express");
const {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");
const awsServerlessExpressMiddleware = require("aws-serverless-express/middleware");
const bodyParser = require("body-parser");
const XLSX = require("xlsx");

const s3Client = new S3Client({ region: process.env.REGION });
const ddbClient = new DynamoDBClient({ region: process.env.REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const bucketName = process.env.STORAGE_S3ACCOUNTMANAGER_BUCKETNAME;

const prefix = "service-masters/";
const uploadsPrefix = `${prefix}uploads/`;
const latestPrefix = `${prefix}latest/`;
const archivePrefix = `${prefix}archive/`;
const tableName = process.env.STORAGE_SERVICEMASTER_NAME; 

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

app.get("/services/master/uploads", async (req, res) => {
  console.log("📂 サービスマスタ（アップロード）一覧取得リクエスト");
  const s3Client = new S3Client({ region: process.env.REGION });

  try {
    const result = await s3Client.send(
      new ListObjectsV2Command({ Bucket: bucketName, Prefix: uploadsPrefix })
    );

    const files = (result.Contents || [])
      .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
      .map((item) => ({
        key: item.Key,
        lastModified: item.LastModified,
        size: item.Size,
      }));
    console.log("✅ サービスマスタ（アップロード）一覧取得成功:", files.length, "件");
    res.json({ files });
  } catch (err) {
    console.error("🔥 サービスマスタ（アップロード）一覧取得失敗:", err);
    res.status(500).json({ error: "サービスマスタ（アップロード）一覧取得に失敗しました。" });
  }
});

app.get("/services/master/latest", async (req, res) => {
  console.log("📂 サービスマスタ（最新）一覧取得リクエスト");
  const s3Client = new S3Client({ region: process.env.REGION });

  try {
    const result = await s3Client.send(
      new ListObjectsV2Command({ Bucket: bucketName, Prefix: latestPrefix })
    );

    const files = (result.Contents || [])
      .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
      .map((item) => ({
        key: item.Key,
        lastModified: item.LastModified,
        size: item.Size,
      }));
    console.log("✅ サービスマスタ（最新）一覧取得成功:", files.length, "件");
    res.json({ files });
  } catch (err) {
    console.error("🔥 サービスマスタ（最新）一覧取得失敗:", err);
    res.status(500).json({ error: "サービスマスタ（最新）一覧取得に失敗しました。" });
  }
});

app.get("/services/master", async (req, res) => {
  const { key } = req.query;
  if (!key || !key.startsWith(prefix)) {
    console.error("🔥 不正なキー:", key);
    return res.status(400).json({ error: "不正なキーです。" });
  }
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5分間有効
    console.log("✅ 署名付きURL発行成功:", url);
    res.json({ url });
  } catch (err) {
    console.error("🔥 署名付きURL発行失敗:", err);
    res.status(500).json({ error: "ダウンロードURLの生成に失敗しました。" });
  }
});

app.post("/services/master", async (req, res) => {
  console.log("🔄 マスタ適用リクエスト:", req.body);
  const { key } = req.body;
  if (!key || !key.startsWith(uploadsPrefix)) {
    console.error("🔥 不正なキー:", key);
    return res.status(400).json({ error: "不正なキーです。" });
  }

  const uploadsKey = key;
  const originalFilename = key.split("/").pop();
  const now = new Date();
  const latestKey = `${latestPrefix}${originalFilename}`;

  try {
    await s3Client.send(new CopyObjectCommand({
      Bucket: bucketName,
      CopySource: `${bucketName}/${encodeURIComponent(uploadsKey)}`,
      Key: latestKey,
    }));
    console.log(`✅ latest/${originalFilename} にコピー完了`);

    const existing = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: latestPrefix,
    }));

    for (const file of existing.Contents || []) {
      if (file.Key !== latestKey) {
        const oldName = file.Key.split("/").pop();
        const archiveKey = `${archivePrefix}${now}_${oldName}`;

        await s3Client.send(new CopyObjectCommand({
          Bucket: bucketName,
          CopySource: `${bucketName}/${encodeURIComponent(file.Key)}`,
          Key: archiveKey,
        }));

        await s3Client.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: file.Key,
        }));
      }
    }
    console.log("✅ 最新ファイルをアーカイブしました");

    const getObj = await s3Client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: uploadsKey,
    }));

    const buffer = await getObj.Body.transformToByteArray();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    const csvData = jsonData.map(row => ({
      pk: "SERVICE_MASTER",
      sk: `SERVICE#${row.name}`,
      name: row.name,
      display_name: row.display_name || row.name,
      description: row.description || "",
      url: row.url || "",
      uploaded_at: now.toISOString(),
    })).filter(item => item.name && item.name.length <= 50);

    const oldItems = await ddbDocClient.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": "SERVICE_MASTER" },
    }));

    for (const item of oldItems.Items || []) {
      await ddbDocClient.send(new DeleteCommand({
        TableName: tableName,
        Key: { pk: item.pk, sk: item.sk },
      }));
    }

    for (const item of csvData) {
      await ddbDocClient.send(new PutCommand({
        TableName: tableName,
        Item: item,
      }));
    }

    console.log(`✅ DynamoDB更新完了: ${csvData.length}件`);
    res.json({ message: "マスタを更新しました", count: csvData.length, appliedKey: latestKey });
  } catch (err) {
    console.error("🔥 マスタ適用エラー:", err);
    res.status(500).json({ error: "マスタ更新に失敗しました。" });
  }
});

app.get("/services", async (req, res) => {
  console.log("📦 サービス一覧取得リクエスト");

  try {
    const result = await ddbDocClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": "SERVICE_MASTER" },
      })
    );

    const services = (result.Items || []).map((item) => ({
      name: item.name,
      display_name: item.display_name,
      description: item.description,
      url: item.url,
    }));

    console.log(`✅ サービス一覧取得成功: ${services.length}件`);
    res.json(services);
  } catch (err) {
    console.error("🔥 サービス一覧取得失敗:", err);
    res.status(500).json({ error: "サービス一覧取得に失敗しました。" });
  }
});

app.listen(3000, () => console.log("Ledger API (META-style) started"));
module.exports = app;
