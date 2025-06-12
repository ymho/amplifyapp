import React, { useEffect, useState } from "react";
import { get } from "aws-amplify/api"; // v6でのREST API呼び出し方法
import {
  View,
  Heading,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Loader,
  Alert,
  Text,
  Badge,
  Link,
} from "@aws-amplify/ui-react";

const API_NAME = "apiaccountmanager";
const API_PATH = "/inquiries";

const Inquiries = () => {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchInquiries = async () => {
      try {
        const restOperation = get({ apiName: API_NAME, path: API_PATH });
        const { body } = await restOperation.response;
        const data = await body.json(); // ← v6ではここで明示的に `.json()` が必要です
        setInquiries(data);
      } catch (err) {
        console.error("問い合わせ一覧取得エラー:", err);
        setError("問い合わせ一覧の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    fetchInquiries();
  }, []);

  return (
    <View padding="1rem" maxWidth="1200px" margin="0 auto">
      <Heading level={5} marginBottom="1rem">
        問い合わせ一覧
      </Heading>

      {loading && <Loader variation="linear" />}
      {error && <Alert variation="error">{error}</Alert>}

      {!loading && !error && inquiries.length === 0 && (
        <Text>問い合わせはありません。</Text>
      )}

      {!loading && inquiries.length > 0 && (
        <Table highlightOnHover>
          <TableHead>
            <TableRow>
              <TableCell>件名</TableCell> {/* ← ID → タイトルへ */}
              <TableCell>ステータス</TableCell>
              <TableCell>作成日時</TableCell>
              <TableCell>更新日時</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {inquiries.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Link to={`/inquiries/${item.id}`}>{item.title}</Link>
                </TableCell>
                <TableCell>
                  <Badge
                    size="small"
                    variation={
                      item.status === "open"
                        ? "info"
                        : item.status === "closed"
                        ? "success"
                        : "warning"
                    }
                  >
                    {item.status === "open"
                      ? "オープン"
                      : item.status === "closed"
                      ? "クローズ"
                      : item.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(item.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  {new Date(item.updated_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </View>
  );
};

export default Inquiries;
