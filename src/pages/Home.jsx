import React, { useEffect, useState } from "react";
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
  Flex,
  Button,
  Card,
} from "@aws-amplify/ui-react";
import { get } from "aws-amplify/api";
import { fetchAuthSession } from "aws-amplify/auth";
import { Link as RouterLink } from "react-router-dom";

const API_NAME = "apiaccountmanager";

const isNew = (item) => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  return new Date(item.updated_at) >= oneWeekAgo;
};

const Home = ({ user }) => {
  const [ledgers, setLedgers] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [loadingLedgers, setLoadingLedgers] = useState(true);
  const [loadingInquiries, setLoadingInquiries] = useState(true);
  const [ledgerError, setLedgerError] = useState("");
  const [inquiryError, setInquiryError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();

        // 台帳の取得
        try {
          const res = await get({
            apiName: API_NAME,
            path: "/ledgers",
            options: { headers: { Authorization: `Bearer ${token}` } },
          }).response;
          const data = await res.body.json();
          setLedgers(data);
        } catch (err) {
          console.error("台帳取得失敗:", err);
          setLedgerError("台帳の取得に失敗しました。");
        } finally {
          setLoadingLedgers(false);
        }

        // 問い合わせの取得
        try {
          const res = await get({
            apiName: API_NAME,
            path: "/inquiries",
            options: { headers: { Authorization: `Bearer ${token}` } },
          }).response;
          const data = await res.body.json();
          setInquiries(data);
        } catch (err) {
          console.error("問い合わせ取得失敗:", err);
          setInquiryError("問い合わせ一覧の取得に失敗しました。");
        } finally {
          setLoadingInquiries(false);
        }
      } catch (err) {
        console.error("認証エラー:", err);
      }
    };

    fetchData();
  }, [user]);

  return (
    <View maxWidth="1500px" margin="0 auto" padding="1rem">
      <Flex
        direction={{ base: "column", large: "row" }}
        gap="2rem"
        wrap="wrap"
        alignItems="flex-start"
      >
        {/* 台帳一覧 */}
        <Card flex="2" width="100%" maxWidth="100%">
          <Flex
            justifyContent="space-between"
            alignItems="center"
            marginBottom="1rem"
          >
            <Heading level={5}>台帳</Heading>
            {user?.groups?.includes("admin") && (
              <RouterLink to="/ledger/new">
                <Button variation="primary" size="small">
                  新規作成
                </Button>
              </RouterLink>
            )}
          </Flex>

          {loadingLedgers && <Loader variation="linear" />}
          {ledgerError && <Alert variation="error">{ledgerError}</Alert>}
          {!loadingLedgers && ledgers.length === 0 && (
            <Text color="#666">台帳が登録されていません。</Text>
          )}
          {ledgers.length > 0 && (
            <Table highlightOnHover size="small">
              <TableHead>
                <TableRow>
                  <TableCell>受付番号</TableCell>
                  <TableCell>名称</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {ledgers.map((ledger) => (
                  <TableRow key={ledger.approval_id}>
                    <TableCell>{ledger.approval_id}</TableCell>
                    <TableCell>{ledger.title}</TableCell>
                    <TableCell>
                      <RouterLink to={`/ledgers/${ledger.approval_id}`}>
                        <Button size="small" variation="link">
                          変更申請
                        </Button>
                      </RouterLink>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* 問い合わせ一覧 */}
        <Card flex="3" width="100%" maxWidth="100%">
          <Flex
            justifyContent="space-between"
            alignItems="center"
            marginBottom="1rem"
          >
            <Heading level={5}>問い合わせ</Heading>
            <RouterLink to="/inquiry/new">
              <Button variation="primary" size="small">
                新規作成
              </Button>
            </RouterLink>
          </Flex>

          {loadingInquiries && <Loader variation="linear" />}
          {inquiryError && <Alert variation="error">{inquiryError}</Alert>}
          {!loadingInquiries && inquiries.length === 0 && (
            <Text color="#666">問い合わせはありません。</Text>
          )}
          {inquiries.length > 0 && (
            <Table highlightOnHover size="small">
              <TableHead>
                <TableRow>
                  <TableCell>件名</TableCell>
                  <TableCell>ステータス</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inquiries.map((item) => (
                  <TableRow
                    as={RouterLink}
                    to={`/inquiries/${item.id}`}
                    key={item.id}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    <TableCell>
                      {item.title || "（無題）"}
                      {isNew(item) && (
                        <Badge
                          size="small"
                          variation="info"
                          marginLeft="0.5rem"
                        >
                          NEW
                        </Badge>
                      )}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </Flex>
    </View>
  );
};

export default Home;
