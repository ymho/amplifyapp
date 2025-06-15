import React, { useRef, useState } from "react";
import {
  View,
  TextField,
  TextAreaField,
  DropZone,
  Button,
  Text,
  Alert,
  Flex,
} from "@aws-amplify/ui-react";
import { post } from "@aws-amplify/api-rest";
import { MdCheckCircle, MdFileUpload, MdRemoveCircle } from "react-icons/md";
import { getFileIcon } from "../utils/getFileIcon";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { uploadFilesToS3 } from "../utils/uploadFilesToS3";

const API_NAME = "apiaccountmanager"; // Amplifyで設定したAPI名
const PATH = "/inquiries";

const Inquiries = ({ user }) => {
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState(""); 
  const [question, setQuestion] = useState("");
  const [files, setFiles] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const hiddenInput = useRef(null);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("タイトルを入力してください。");
      return;
    }

    if (!question.trim()) {
      setError("質問内容を入力してください。");
      return;
    }

    setUploading(true);
    try {
      const attachments = await uploadFilesToS3(files, "uploads");

      const timestamp = new Date().toISOString();
      const inquiryId = crypto.randomUUID();

      const payload = {
        id: inquiryId,
        status: "open",
        title: title,
        department: department,
        created_at: timestamp,
        updated_at: timestamp,
        messages: [
          {
            created_at: timestamp,
            sender:
              (user?.family_name && user?.given_name
                ? `${user.family_name} ${user.given_name}`
                : user?.email) || "Unknown User",
            sender_email: user?.email,
            sender_role: user?.groups?.includes("admin")
              ? "admin"
              : user?.groups?.includes("user")
              ? "user"
              : "undefined",
            content: question,
            attachments,
          },
        ],
      };

      const response = await post({
        apiName: API_NAME,
        path: PATH,
        options: { body: payload },
      }).response;
      console.log("送信成功:", response);

      setSubmitted(true);
      setFiles([]);
      setTitle("");
      setDepartment("");
      setQuestion("");
      setError("");
    } catch (err) {
      console.error("送信失敗:", err);
      setError("送信に失敗しました。もう一度お試しください。");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View maxWidth="1200px" margin="0 auto" padding="1rem">
      <Text fontSize="1.25rem" fontWeight="bold" marginBottom="1rem">
        問い合わせフォーム
      </Text>

      {submitted && (
        <Alert variation="success" marginBottom="1rem">
          問い合わせを送信しました。
        </Alert>
      )}

      {error && (
        <Alert variation="error" marginBottom="1rem">
          {error}
        </Alert>
      )}
      <Text as="label">タイトル</Text>
      <TextField
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="例）Googleアカウントの初期設定方法について"
        marginBottom="1rem"
      />
      <Text as="label">あなたの部署</Text>
<TextField
  value={department}
  onChange={(e) => setDepartment(e.target.value)}
  placeholder="例）システムマネジメント部"
  marginBottom="1rem"
/>
      <View marginBottom="1rem">
        <Flex justifyContent="space-between" alignItems="center">
          <Text as="label">質問内容</Text>
          <Button
            size="small"
            variation="link"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? "編集に戻る" : "プレビュー表示"}
          </Button>
        </Flex>

        {showPreview ? (
          <View
            padding="1rem"
            border="1px solid #ccc"
            borderRadius="0.5rem"
            backgroundColor="#ffffff"
            minHeight="15rem"
            marginTop="0.5rem"
          >
            <ReactMarkdown rehypePlugins={[rehypeSanitize, remarkGfm]}>
              {question || "*（質問内容がありません）*"}
            </ReactMarkdown>
          </View>
        ) : (
          <TextAreaField
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={10}
            placeholder="ここに質問内容を入力してください（Markdownが使えます）"
            style={{ minHeight: "15rem" }}
          />
        )}
      </View>

      <DropZone
        acceptedFileTypes={[
          "image/*",
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ".xls",
          ".xlsx",
          ".doc",
          ".docx",
        ]}
        onDropComplete={({ acceptedFiles }) => setFiles(acceptedFiles)}
      >
        <Flex
          direction="row"
          justifyContent="center"
          alignItems="center"
          gap="0.5rem"
        >
          <DropZone.Accepted>
            <MdCheckCircle fontSize="2rem" />
          </DropZone.Accepted>
          <DropZone.Rejected>
            <MdRemoveCircle fontSize="2rem" />
          </DropZone.Rejected>
          <DropZone.Default>
            <MdFileUpload fontSize="2rem" />
          </DropZone.Default>
          <Text>ファイルをドロップまたは</Text>
          <Button size="small" onClick={() => hiddenInput.current.click()}>
            ファイルを選択
          </Button>
        </Flex>
      </DropZone>

      <input
        type="file"
        multiple
        ref={hiddenInput}
        style={{ display: "none" }}
        onChange={(e) => {
          const newFiles = Array.from(e.target.files);
          setFiles((prevFiles) => {
            const existingNames = new Set(prevFiles.map((f) => f.name));
            const filtered = newFiles.filter((f) => !existingNames.has(f.name));
            return [...prevFiles, ...filtered];
          });
        }}
      />

      <View marginTop="1rem" marginBottom="1rem">
        {files.map((file, index) => (
          <Flex
            key={file.name}
            alignItems="center"
            justifyContent="space-between"
            padding="0.25rem 0"
          >
            <Flex alignItems="center" gap="0.5rem">
              {getFileIcon(file.name)}
              <Text fontSize="0.875rem">{file.name}</Text>
            </Flex>
            <Button
              size="small"
              variation="link"
              colorTheme="error"
              onClick={() => {
                setFiles((prev) => prev.filter((_, i) => i !== index));
              }}
            >
              削除
            </Button>
          </Flex>
        ))}
      </View>

      <Flex justifyContent="flex-end">
        <Button
          variation="primary"
          onClick={handleSubmit}
          isLoading={uploading}
        >
          送信する
        </Button>
      </Flex>
    </View>
  );
};

export default Inquiries;
