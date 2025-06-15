import React, { useEffect, useState } from "react";
import {
  View,
  Heading,
  Text,
  TextField,
  Button,
  Flex,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Card,
  CheckboxField,
  Alert,
} from "@aws-amplify/ui-react";
import { get, post } from "aws-amplify/api";

const API_NAME = "apiaccountmanager";

const LedgerNew = ({ user }) => {
  const [formError, setFormError] = useState("");
  const [modalError, setModalError] = useState("");
  const [approvalId, setApprovalId] = useState("");
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availableServices, setAvailableServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [selectedServiceName, setSelectedServiceName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isAdmin = user?.groups?.includes("admin");

  const [newUser, setNewUser] = useState({
    section: "",
    department: "",
    last_name: "",
    first_name: "",
    email: "",
    is_manager: false,
    requested_at: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await get({ apiName: API_NAME, path: "/services" });
        const { body } = await res.response;
        const data = await body.json();
        setAvailableServices(data);
      } catch (err) {
        console.error("サービス一覧取得失敗:", err);
      }
    };
    fetchServices();
  }, []);

  const isNewUserValid = () => {
    const { last_name, first_name, section, department, email } = newUser;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return (
      last_name.trim() &&
      first_name.trim() &&
      section.trim() &&
      department.trim() &&
      emailPattern.test(email)
    );
  };

  const handleAddUser = () => {
    setUsers((prev) => [...prev, newUser]);
    setNewUser({
      section: "",
      department: "",
      last_name: "",
      first_name: "",
      email: "",
      is_manager: false,
      requested_at: new Date().toISOString().split("T")[0],
    });
    setModalError("");
    setIsModalOpen(false);
  };

  const handleAddService = () => {
    const service = availableServices.find(
      (s) => s.name === selectedServiceName
    );
    if (!service) return;

    if (selectedServices.some((s) => s.name === service.name)) {
      setModalError("同じサービスがすでに追加されています。");
      return;
    }

    setSelectedServices((prev) => [...prev, service]);
    setSelectedServiceName("");
    setModalError("");
    setIsServiceModalOpen(false);
  };

  const handleSubmit = async () => {
    const now = new Date().toISOString();
    const approvalPattern = /^\d{2}-\d{4}$/;
    if (!approvalPattern.test(approvalId)) {
      setFormError(
        "情報システム企画書の受付番号は「XX-XXXX」の形式で入力してください。"
      );
      return;
    }

    setFormError("");
    setIsSubmitting(true);
    setSubmitted(false);

    try {
      await post({
        apiName: API_NAME,
        path: "/ledgers",
        options: {
          body: {
            approval_id: approvalId,
            created_at: now,
            updated_at: now,
            users,
            allowed_services: selectedServices,
          },
        },
      }).response;
      setSubmitted(true);
      setUsers([]);
      setSelectedServices([]);
      setApprovalId("");
    } catch (err) {
      console.error("送信失敗:", err);
      alert("登録に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View maxWidth="1200px" margin="0 auto" padding="1rem">
              {submitted && (
          <Alert variation="success" marginBottom="1rem" width={"100%"}>
            台帳を登録しました。
          </Alert>
        )}
      <Flex justifyContent="space-between" alignItems="center">
        <Heading level={5}>台帳登録</Heading>
        <Flex gap="0.5rem">
          <Button onClick={() => window.history.back()}>キャンセル</Button>
          <Button
            variation="primary"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            loadingText="登録中..."
            isDisabled={isSubmitting}
          >
            登録
          </Button>
        </Flex>
      </Flex>

      <Flex gap="1rem" marginTop="1rem" alignItems="center">
        <TextField
          label={`情報システム企画書の受付番号${
            !isAdmin ? "（編集不可）" : ""
          }`}
          value={approvalId}
          onChange={(e) => setApprovalId(e.target.value)}
          width="100%"
          isReadOnly={!isAdmin}
          variation={!isAdmin ? "quiet" : undefined}
          style={!isAdmin ? { backgroundColor: "#f9f9f9", opacity: 0.8 } : {}}
          placeholder="例) 24-0035"
        />
      </Flex>

      {formError && (
        <Text color="red" fontSize="0.9rem" marginTop="0.5rem">
          {formError}
        </Text>
      )}

      <Flex justifyContent="flex-end" marginTop="2rem" marginBottom="1rem">
        <Button variation="primary" onClick={() => setIsServiceModalOpen(true)}>
          サービスを追加
        </Button>
      </Flex>

      <Table marginTop="1rem">
        <TableHead>
          <TableRow>
            <TableCell
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
            >
              サービス名
            </TableCell>
            <TableCell
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
            >
              URL
            </TableCell>
            <TableCell
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
            ></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {selectedServices.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={3}
                style={{ textAlign: "center", padding: "1rem", color: "#666" }}
              >
                サービスが追加されていません。「サービスを追加」ボタンから登録してください。
              </TableCell>
            </TableRow>
          ) : (
            selectedServices.map((service) => (
              <TableRow key={service.name}>
                <TableCell
                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
                >
                  {service.display_name}
                </TableCell>
                <TableCell
                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
                >
                  <a
                    href={service.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#007b8a", textDecoration: "underline" }}
                  >
                    {service.url}
                  </a>
                </TableCell>
                <TableCell
                  style={{
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.875rem",
                    textAlign: "right",
                  }}
                >
                  <Button
                    size="small"
                    variation="link"
                    colorTheme="error"
                    onClick={() =>
                      setSelectedServices((prev) =>
                        prev.filter((s) => s.name !== service.name)
                      )
                    }
                  >
                    削除
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Flex justifyContent="flex-end" marginTop="2rem" marginBottom="1rem">
        <Button variation="primary" onClick={() => setIsModalOpen(true)}>
          ユーザーを追加
        </Button>
      </Flex>

      <Table>
        <TableHead>
          <TableRow>
            <TableCell
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
            >
              氏名
            </TableCell>
            <TableCell
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
            >
              所属
            </TableCell>
            <TableCell
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
            >
              メール
            </TableCell>
            <TableCell
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
            >
              申請日
            </TableCell>
            <TableCell
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
            />
          </TableRow>
        </TableHead>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                style={{ textAlign: "center", padding: "1rem", color: "#666" }}
              >
                ユーザーが追加されていません。「ユーザーを追加」ボタンから登録してください。
              </TableCell>
            </TableRow>
          ) : (
            users.map((u, i) => (
              <TableRow key={i}>
                <TableCell
                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
                >
                  {u.last_name} {u.first_name}
                </TableCell>
                <TableCell
                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
                >
                  {u.section} / {u.department}
                </TableCell>
                <TableCell
                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
                >
                  {u.email}
                </TableCell>
                <TableCell
                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
                >
                  {u.requested_at}
                </TableCell>
                <TableCell
                  style={{
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.875rem",
                    textAlign: "right",
                  }}
                >
                  <Button
                    size="small"
                    variation="link"
                    colorTheme="error"
                    onClick={() =>
                      setUsers((prev) => prev.filter((_, index) => index !== i))
                    }
                  >
                    削除
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* サービス追加モーダル（選択肢式） */}
      {isServiceModalOpen && (
        <View
          position="fixed"
          top="0"
          left="0"
          width="100vw"
          height="100vh"
          backgroundColor="rgba(0, 0, 0, 0.5)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={1000}
        >
          <Card variation="outlined" width="500px" padding="2rem">
            <Heading level={5} marginBottom="1rem">
              サービスを追加
            </Heading>

            <select
              value={selectedServiceName}
              onChange={(e) => setSelectedServiceName(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem",
                fontSize: "1rem",
                marginBottom: "1.5rem",
              }}
            >
              <option value="">-- サービスを選択してください --</option>
              {availableServices.map((service) => (
                <option key={service.name} value={service.name}>
                  {service.display_name}
                </option>
              ))}
            </select>

            {modalError && (
              <Text color="red" fontSize="0.9rem" marginBottom="1rem">
                {modalError}
              </Text>
            )}

            <Flex justifyContent="flex-end" gap="0.5rem">
              <Button onClick={() => setIsServiceModalOpen(false)}>
                キャンセル
              </Button>
              <Button
                variation="primary"
                onClick={handleAddService}
                disabled={!selectedServiceName}
              >
                追加
              </Button>
            </Flex>
          </Card>
        </View>
      )}

      {/* ユーザー追加モーダル（既存のまま） */}
      {isModalOpen && (
        <View
          position="fixed"
          top="0"
          left="0"
          width="100vw"
          height="100vh"
          backgroundColor="rgba(0, 0, 0, 0.5)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={1000}
        >
          <Card variation="outlined" width="500px" padding="2rem">
            <Heading level={5} marginBottom="1rem">
              ユーザーを追加
            </Heading>

            <TextField
              label="姓"
              value={newUser.last_name}
              placeholder="例: 山田"
              onChange={(e) =>
                setNewUser({ ...newUser, last_name: e.target.value })
              }
              marginBottom="1rem"
            />
            <TextField
              label="名"
              value={newUser.first_name}
              placeholder="例: 太郎"
              onChange={(e) =>
                setNewUser({ ...newUser, first_name: e.target.value })
              }
              marginBottom="1rem"
            />
            <TextField
              label="部門"
              value={newUser.section}
              placeholder="例: 情報システム本部"
              onChange={(e) =>
                setNewUser({ ...newUser, section: e.target.value })
              }
              marginBottom="1rem"
            />
            <TextField
              label="部署"
              value={newUser.department}
              placeholder="例: クラウド推進部"
              onChange={(e) =>
                setNewUser({ ...newUser, department: e.target.value })
              }
              marginBottom="1rem"
            />
            <TextField
              label="メールアドレス"
              type="email"
              value={newUser.email}
              placeholder="例: yamada.taro@example.com"
              onChange={(e) =>
                setNewUser({ ...newUser, email: e.target.value })
              }
              marginBottom="1rem"
            />
            <CheckboxField
              label="このユーザーは管理者です"
              checked={newUser.is_manager}
              onChange={(e) =>
                setNewUser({ ...newUser, is_manager: e.target.checked })
              }
              marginBottom="1.5rem"
            />

            {modalError && (
              <Text color="red" fontSize="0.9rem" marginBottom="1rem">
                {modalError}
              </Text>
            )}

            <Flex justifyContent="flex-end" gap="0.5rem">
              <Button onClick={() => setIsModalOpen(false)}>キャンセル</Button>
              <Button
                variation="primary"
                onClick={handleAddUser}
                disabled={!isNewUserValid()}
              >
                追加
              </Button>
            </Flex>
          </Card>
        </View>
      )}
    </View>
  );
};

export default LedgerNew;
