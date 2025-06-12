import React, { useEffect, useState } from "react";
import { get } from "aws-amplify/api";
import {
  View,
  Heading,
  Text,
  Loader,
  Alert,
  Badge,
  Card,
  Divider,
  TextAreaField,
  Button,
} from "@aws-amplify/ui-react";
import { useParams } from "react-router-dom";

const API_NAME = "apiaccountmanager";

const InquiryDetail = () => {
  const { id } = useParams();
  const [inquiry, setInquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchInquiry = async () => {
      try {
        const restOperation = get({
          apiName: API_NAME,
          path: `/inquiries/${id}`,
        });
        const { body } = await restOperation.response;
        const data = await body.json();
        setInquiry(data);
      } catch (err) {
        setError("詳細の取得に失敗しました");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchInquiry();
  }, [id]);

  if (loading) return <Loader variation="linear" />;
  if (error) return <Alert variation="error">{error}</Alert>;
  if (!inquiry) return <Text>問い合わせが見つかりません。</Text>;

  return (
    <View padding="1rem" maxWidth="800px" margin="0 auto">
      <Heading level={5} marginBottom="0.5rem">
        {inquiry.title || "（無題）"}
        <Badge variation="info">{inquiry.status}</Badge>
      </Heading>
      <Text fontSize="0.9rem" color="gray">
        作成日時: {new Date(inquiry.created_at).toLocaleString()}
      </Text>
      <Text fontSize="0.9rem" color="gray">
        最終更新: {new Date(inquiry.updated_at).toLocaleString()}
      </Text>

      <Divider marginTop="1rem" marginBottom="1rem" />

      <Heading level={6}>メッセージ</Heading>
      {inquiry.messages?.length > 0 ? (
        inquiry.messages.map((msg, idx) => (
          <Card key={idx} marginTop="0.5rem">
            <Text fontWeight="bold">{msg.sender}</Text>
            <Text whiteSpace="pre-wrap">{msg.content}</Text>
            <Text fontSize="0.8rem" color="gray">
              {new Date(msg.timestamp).toLocaleString()}
            </Text>
          </Card>
        ))
      ) : (
        <Text>メッセージはありません。</Text>
      )}

      <Divider marginTop="2rem" marginBottom="1rem" />
      <Heading level={6}>返信する</Heading>
      <TextAreaField
        label="メッセージ"
        descriptiveText="問い合わせへの返信内容を入力してください。"
        rows={5}
      />
      <Button variation="primary" marginTop="1rem">
        送信
      </Button>
    </View>
  );
};

export default InquiryDetail;
