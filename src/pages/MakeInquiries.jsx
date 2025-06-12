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
import { uploadData, getUrl } from "aws-amplify/storage";
import { MdCheckCircle, MdFileUpload, MdRemoveCircle } from "react-icons/md";

const API_NAME = "apiaccountmanager"; // Amplifyで設定したAPI名
const PATH = "/inquiries";

const Inquiries = ({ user }) => {
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [files, setFiles] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const hiddenInput = useRef(null);

  const uploadFilesToS3 = async (files) => {
    const uploaded = [];

    for (const file of files) {
      const key = `uploads/${Date.now()}_${crypto.randomUUID()}_${file.name}`;
      await uploadData({
        path: key,
        data: file,
        options: {
          contentType: file.type,
        },
      }).result;

      const url = await getUrl({ path: key });

      uploaded.push({
        file_name: file.name,
        file_url: url.url.href,
        content_type: file.type,
      });
    }

    return uploaded;
  };

  const handleSubmit = async () => {
    if (!question.trim()) {
      setError("質問内容を入力してください。");
      return;
    }

    setUploading(true);
    try {
      const attachments = await uploadFilesToS3(files);

      const timestamp = new Date().toISOString();
      const inquiryId = crypto.randomUUID();

      const payload = {
        id: inquiryId,
        status: "open",
        title: title,
        created_at: timestamp,
        updated_at: timestamp,
        messages: [
          {
            timestamp,
            sender: user?.name || user?.email || "Unknown User",
            sender_email: user?.email,
            sender_role: "user",
            content: question,
            attachments,
          },
        ],
      };

      const response = await post({
        apiName: API_NAME,
        path: PATH,
        options: { body: payload },
      });
      console.log("送信成功:", response);

      setSubmitted(true);
      setFiles([]);
      setTitle("");
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
      <TextField
        label="タイトル"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="例）Googleアカウントの初期設定方法について"
        marginBottom="1rem"
      />
      <TextAreaField
        label="質問内容"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={10}
        marginBottom="1rem"
        placeholder="例）Googleアカウントの作成方法がわかりません。"
      />

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
          <Text>ファイルをドラッグ&ドロップ</Text>
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
        onChange={(e) => setFiles(Array.from(e.target.files))}
      />

      <View marginTop="1rem" marginBottom="1rem">
        {files.map((file) => (
          <Text key={file.name} fontSize="0.875rem">
            📎 {file.name}
          </Text>
        ))}
      </View>

      <Button variation="primary" onClick={handleSubmit} isLoading={uploading}>
        送信する
      </Button>
    </View>
  );
};

export default Inquiries;
