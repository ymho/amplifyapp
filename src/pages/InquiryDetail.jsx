import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Heading,
  Text,
  Loader,
  Alert,
  Badge,
  Card,
  TextAreaField,
  Button,
  Flex,
  DropZone,
} from "@aws-amplify/ui-react";
import { get, post } from "aws-amplify/api";
import { getUrl } from "aws-amplify/storage";
import { useParams } from "react-router-dom";
import { getFileIcon } from "../utils/getFileIcon";
import { uploadFilesToS3 } from "../utils/uploadFilesToS3";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import {
  MdInsertEmoticon,
  MdCheckCircle,
  MdFileUpload,
  MdRemoveCircle,
} from "react-icons/md";

const API_NAME = "apiaccountmanager";

const InquiryDetail = ({ user }) => {
  const { id } = useParams();
  const [inquiry, setInquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reactionTarget, setReactionTarget] = useState(null);
  const [visibleReactions, setVisibleReactions] = useState({});
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [files, setFiles] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const hiddenInput = useRef(null);

  useEffect(() => {
    const fetchInquiry = async () => {
      try {
        const restOperation = get({
          apiName: API_NAME,
          path: `/inquiries/${id}`,
        }).response;
        const { body } = await restOperation;
        const rawData = await body.json();

        for (const msg of rawData.messages || []) {
          if (msg.attachments?.length) {
            for (const file of msg.attachments) {
              const result = await getUrl({
                path: file.path,
                options: { expiresIn: 300 },
              });
              file.url = result.url.href;
            }
          }
        }

        setInquiry(rawData);
      } catch (err) {
        setError("詳細の取得に失敗しました");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchInquiry();
  }, [id]);

  const handleFileDrop = ({ acceptedFiles }) => {
    setFiles(acceptedFiles);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!reply.trim()) return;
    try {
      const attachments = await uploadFilesToS3(files, "uploads");
      // ここで getUrl を適用
      for (const file of attachments) {
        const result = await getUrl({
          path: file.path,
          options: { expiresIn: 300 },
        });
        file.url = result.url.href;
      }
      const timestamp = new Date().toISOString();
      const message = {
        content: reply,
        attachments,
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
      };
      await post({
        apiName: API_NAME,
        path: `/inquiries/${id}/messages`,
        options: { body: { ...message, timestamp } },
      }).response;

      setInquiry((prev) => ({
        ...prev,
        messages: [...prev.messages, { ...message }],
      }));
      setReply("");
      setFiles([]);
    } catch (err) {
      console.error("送信失敗:", err);
      alert("返信の送信に失敗しました。");
    }
  };

  const handleReactionClick = async (messageIndex, emoji) => {
    const email = user?.email || "Unknown User";
    try {
      const updatedMessages = [...inquiry.messages];
      const targetMsg = { ...updatedMessages[messageIndex] };

      if (!targetMsg.reactions) targetMsg.reactions = {};

      // 他のリアクションを削除（1人1つ制限）
      for (const key of Object.keys(targetMsg.reactions)) {
        targetMsg.reactions[key] = targetMsg.reactions[key].filter(
          (e) => e !== email
        );
        if (targetMsg.reactions[key].length === 0)
          delete targetMsg.reactions[key];
      }

      // 新しいリアクション追加
      if (!targetMsg.reactions[emoji]) targetMsg.reactions[emoji] = [];
      targetMsg.reactions[emoji].push(email);

      updatedMessages[messageIndex] = targetMsg;

      await post({
        apiName: API_NAME,
        path: `/inquiries/${id}/messages`,
        options: { body: { ...targetMsg, timestamp: targetMsg.created_at } },
      }).response;

      setInquiry((prev) => ({
        ...prev,
        messages: updatedMessages,
      }));
    } catch (err) {
      console.error("リアクション送信失敗:", err);
      alert("リアクションの送信に失敗しました。");
    }
  };

  const toggleStatus = async () => {
    const newStatus = inquiry.status === "open" ? "closed" : "open";
    try {
      await post({
        apiName: API_NAME,
        path: `/inquiries/${id}`, // あなたのAPI設計により変更可
        options: {
          body: {
            ...inquiry,
            status: newStatus,
            timestamp: new Date().toISOString(),
          },
        },
      }).response;

      setInquiry((prev) => ({ ...prev, status: newStatus }));
    } catch (err) {
      console.error("ステータス更新失敗:", err);
      alert("ステータスの更新に失敗しました。");
    }
  };

  if (loading) return <Loader variation="linear" />;
  if (error) return <Alert variation="error">{error}</Alert>;
  if (!inquiry) return <Text>問い合わせが見つかりません。</Text>;

  return (
    <View padding="1rem" maxWidth="1200px" margin="0 auto">
      <Heading level={5} marginBottom="0.25rem">
        {inquiry.title || "（無題）"}
      </Heading>
      <Badge variation="info" marginBottom="1rem">
        {inquiry.status === "open"
          ? "オープン"
          : inquiry.status === "closed"
          ? "クローズ"
          : inquiry.status}
      </Badge>

      {inquiry.messages?.length > 0 ? (
        inquiry.messages.map((msg, idx) => (
          <Card
            key={idx}
            marginTop="0.5rem"
            variation="outlined"
            style={{
              borderColor: "#ccc",
              borderWidth: "1px",
              borderStyle: "solid",
            }}
          >
            <Text>
              <Text as="span" fontWeight="bold">
                {msg.sender}{" "}
              </Text>
              <Text as="span" fontSize="0.8rem" color="gray">
                {new Date(msg.created_at).toLocaleString()}
              </Text>
              {(() => {
                const createdAt = new Date(msg.created_at);
                const now = new Date();
                const diffInMs = now - createdAt;
                const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;

                if (diffInMs <= threeDaysInMs) {
                  return (
                    <Badge variation="success" marginLeft="0.5rem">
                      NEW
                    </Badge>
                  );
                }
                return null;
              })()}
            </Text>
            <View marginTop="0.5rem">
              <ReactMarkdown
                rehypePlugins={[rehypeSanitize]}
                remarkPlugins={[remarkGfm]}
              >
                {msg.content || "*（本文なし）*"}
              </ReactMarkdown>
            </View>
            {msg.attachments?.length > 0 &&
              msg.attachments.map((file, i) => (
                <Flex
                  key={i}
                  alignItems="center"
                  gap="0.5rem"
                  marginBottom="0.25rem"
                >
                  {getFileIcon(file.file_name)}
                  <Button
                    variation="link"
                    size="small"
                    onClick={() => window.open(file.url, "_blank")}
                  >
                    {file.file_name}
                  </Button>
                </Flex>
              ))}
            <Flex alignItems="center" gap="0.5rem" marginTop="0.5rem">
              <Button
                size="small"
                variation="link"
                onClick={() =>
                  setReactionTarget(reactionTarget === idx ? null : idx)
                }
              >
                <MdInsertEmoticon size="1.2rem" />
              </Button>

              <Flex>
                {/* 絵文字群（リアクション選択） */}
                {reactionTarget === idx &&
                  ["👍", "❤️", "😂", "😮", "🎉"].map((emoji) => (
                    <Button
                      key={emoji}
                      size="small"
                      variation="link"
                      onClick={() => {
                        handleReactionClick(idx, emoji);
                        setReactionTarget(null);
                      }}
                    >
                      {emoji}
                    </Button>
                  ))}

                {/* 現在のリアクション表示 */}
                {msg.reactions &&
                  Object.entries(msg.reactions).map(([emoji, users]) => {
                    const key = `${idx}-${emoji}`;
                    const isVisible = visibleReactions[key];

                    return (
                      <Flex key={emoji} alignItems="center" gap="0.25rem">
                        <Button
                          size="small"
                          variation="link"
                          onClick={() =>
                            setVisibleReactions((prev) => ({
                              ...prev,
                              [key]: !prev[key],
                            }))
                          }
                        >
                          {emoji} {users.length}
                        </Button>

                        {isVisible && (
                          <Text
                            fontSize="0.75rem"
                            color="gray"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            {users.join(", ")}
                          </Text>
                        )}
                      </Flex>
                    );
                  })}
              </Flex>
            </Flex>
          </Card>
        ))
      ) : (
        <Text>メッセージはありません。</Text>
      )}

      <View marginTop="2rem">
        <Flex justifyContent="space-between" alignItems="center">
          <Text as="label">返信</Text>
          <Button
            size="small"
            variation="link"
            onClick={() => setShowPreview((prev) => !prev)}
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
            minHeight="10rem"
            marginTop="0.5rem"
          >
            <ReactMarkdown
              rehypePlugins={[rehypeSanitize]}
              remarkPlugins={[remarkGfm]}
            >
              {reply || "*(入力された返信がありません)*"}
            </ReactMarkdown>
          </View>
        ) : (
          <TextAreaField
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={10}
            placeholder="ここに返信内容を入力してください（Markdownが使えます）"
            marginTop="0.5rem"
          />
        )}
      </View>

      <DropZone
        onDropComplete={handleFileDrop}
        acceptedFileTypes={["image/*", "application/pdf", ".doc", ".docx"]}
        marginTop="1rem"
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
        onChange={(e) => setFiles(Array.from(e.target.files))}
      />

      <View marginTop="1rem">
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
              onClick={() => removeFile(index)}
            >
              削除
            </Button>
          </Flex>
        ))}
      </View>

      <Flex justifyContent="flex-end" marginTop="1rem">
        <Button
          variation="primary"
          isDisabled={!reply.trim()}
          onClick={handleSubmit}
        >
          送信
        </Button>
      </Flex>
      {/* 👇 ステータス切り替えボタン */}
      <Flex justifyContent="flex-end" marginTop="1rem">
        <Button
          variation="link"
          onClick={toggleStatus}
          colorTheme={inquiry.status === "open" ? "error" : "success"}
        >
          {inquiry.status === "open" ? "クローズする" : "オープンに戻す"}
        </Button>
      </Flex>
    </View>
  );
};

export default InquiryDetail;
