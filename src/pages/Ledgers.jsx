import React, { useEffect, useState } from "react";
import {
  View,
  Heading,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Flex,
  Text,
  Loader,
  Alert,
} from "@aws-amplify/ui-react";
import { get } from "aws-amplify/api";
import { Link } from "react-router-dom";

const API_NAME = "apiaccountmanager";

const LedgerList = ({ user }) => {
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const isAdmin = user?.groups?.includes("admin");

  useEffect(() => {
    const fetchLedgers = async () => {
      try {
        // 全台帳を取得
        const res = await get({ apiName: API_NAME, path: "/ledgers" });
        const { body } = await res.response;
        const data = await body.json();

        let filtered = data;
        // 一般ユーザーの場合、管理者の台帳のみ表示
        if (!isAdmin) {
          const managedRes = await get({
            apiName: API_NAME,
            path: `/ledgers/managed-by?email=${encodeURIComponent(user.email)}`,
          });
          const { body: managedBody } = await managedRes.response;
          const managedApprovalIds = await managedBody.json(); // 形式: { approval_ids: [...] }
          console.log(managedApprovalIds)
          filtered = data.filter((ledger) =>
            managedApprovalIds.approval_ids.includes(ledger.approval_id)
          );
          console.log(managedApprovalIds)
        }

        setLedgers(filtered);
      } catch (err) {
        console.error("台帳一覧の取得に失敗:", err);
        setLoadError("台帳の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchLedgers();
  }, [user, isAdmin]);

  return (
    <View maxWidth="1200px" margin="0 auto" padding="1rem">
      <Flex justifyContent="space-between" alignItems="center" marginBottom="1rem">
        <Heading level={5}>台帳一覧</Heading>
        <Link to="/ledger/new">
          <Button variation="primary">新規作成</Button>
        </Link>
      </Flex>

      {loading && <Loader variation="linear" />}
      {loadError && (
        <Alert variation="error" marginBottom="1rem">
          {loadError}
        </Alert>
      )}

      {!loading && ledgers.length === 0 && (
        <Text color="#666">台帳が登録されていません。</Text>
      )}

      {ledgers.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>受付番号</TableCell>
              <TableCell>作成日</TableCell>
              <TableCell>更新日</TableCell>
              <TableCell>ユーザー数</TableCell>
              <TableCell>サービス数</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {ledgers.map((ledger) => (
              <TableRow key={ledger.approval_id}>
                <TableCell>{ledger.approval_id}</TableCell>
                <TableCell>{ledger.created_at}</TableCell>
                <TableCell>{ledger.updated_at}</TableCell>
                <TableCell>{ledger.users?.length ?? 0}</TableCell>
                <TableCell>{ledger.allowed_services?.length ?? 0}</TableCell>
                <TableCell>
                  <Link to={`/ledgers/${ledger.approval_id}`}>
                    <Button size="small" variation="link">
                      詳細・変更申請
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </View>
  );
};

export default LedgerList;
