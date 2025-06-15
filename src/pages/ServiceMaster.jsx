import React, { useRef, useState, useEffect } from "react";
import {
  View,
  DropZone,
  Button,
  Text,
  Heading,
  Alert,
  Flex,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Loader,
  Link,
} from "@aws-amplify/ui-react";
import { post, get } from "aws-amplify/api";
import {
  MdCheckCircle,
  MdFileUpload,
  MdRemoveCircle,
  MdDownload,
} from "react-icons/md";
import { uploadFilesToS3 } from "../utils/uploadFilesToS3";
import { getFileIcon } from "../utils/getFileIcon";

const API_NAME = "apiaccountmanager";
const API_BASE_PATH = "/services/master";
const API_UPLOADS_PATH = `${API_BASE_PATH}/uploads`;
const API_LATEST_PATH = `${API_BASE_PATH}/latest`;
const S3_UPLOADS_PATH = "service-masters/uploads";

const ServiceMaster = ({ user }) => {
  const [loadingList, setLoadingList] = useState(false);
  const [files, setFiles] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [latestList, setLatestList] = useState([]);
  const [uploadsList, setUploadsList] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [appliedKeys, setAppliedKeys] = useState(new Set());

  const hiddenInput = useRef(null);

  const fetchXlsxLists = async () => {
    setLoadingList(true);
    try {
      const [latestRes, uploadsRes] = await Promise.all([
        get({ apiName: API_NAME, path: API_LATEST_PATH }).response,
        get({ apiName: API_NAME, path: API_UPLOADS_PATH }).response,
      ]);
      const latestData = await latestRes.body.json();
      const uploadsData = await uploadsRes.body.json();
      setLatestList(latestData.files || []);
      setUploadsList(uploadsData.files || []);

      const keys = new Set(
        (latestData.files || []).map((file) => {
          const parts = file.key.split("/");
          return parts[parts.length - 1];
        })
      );
      setAppliedKeys(keys);
    } catch (err) {
      console.error("一覧取得失敗:", err);
    } finally {
      setLoadingList(false);
    }
  };
  useEffect(() => {
    fetchXlsxLists();
  }, []);

  const handleSubmit = async () => {
    if (files.length !== 1 || !files[0].name.endsWith(".xlsx")) {
      setError("Excelファイルを1つだけ選択してください。");
      return;
    }

    setUploading(true);
    try {
      await uploadFilesToS3(files, S3_UPLOADS_PATH);
      setSubmitted(true);
      setMessage("アップロードが完了しました。");
      setFiles([]);
      setError("");
      await fetchXlsxLists();
    } catch (err) {
      console.error("アップロード失敗:", err);
      setError("アップロードに失敗しました。もう一度お試しください。");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (key) => {
    try {
      const res = await get({
        apiName: API_NAME,
        path: API_BASE_PATH,
        options: { queryParams: { key } },
      }).response;
      const { url } = await res.body.json();
      window.open(url, "_blank");
    } catch (err) {
      console.error("ダウンロード失敗:", err);
      setError("ファイルのダウンロードに失敗しました。");
    }
  };

  const handleApply = async (key) => {
    try {
      setError("");
      setUploading(true);
      await post({
        apiName: API_NAME,
        path: API_BASE_PATH,
        options: { body: { key } },
      }).response;
      setSubmitted(true);
      setMessage("マスタ適用が完了しました。");
      await fetchXlsxLists();
    } catch (err) {
      console.error("マスタ適用失敗:", err);
      setError("マスタ適用に失敗しました。");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View maxWidth="1200px" width="100%" margin="0 auto" padding="1rem">
      <Heading level={5}>サービスマスタ登録</Heading>
      <Text marginTop="0.5rem" fontSize="0.875rem">
        サービスマスタのXLSXファイルをアップロードして、システムに適用します。アップロード後、最新のマスタを適用すると、台帳登録時に選択できるようになります。
      </Text>

      <View marginTop="1rem" marginBottom="1rem">
        {submitted && message && <Alert variation="success">{message}</Alert>}
        {error && <Alert variation="error">{error}</Alert>}
      </View>

      <DropZone
        acceptedFileTypes={[".xlsx"]}
        onDropComplete={({ acceptedFiles }) =>
          setFiles(acceptedFiles.slice(0, 1))
        }
      >
        <Flex
          justifyContent="center"
          alignItems="center"
          gap="0.5rem"
          wrap="wrap"
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
          <Text>XLSXファイルをドロップまたは</Text>
          <Button size="small" onClick={() => hiddenInput.current.click()}>
            ファイルを選択
          </Button>
        </Flex>
      </DropZone>

      <input
        type="file"
        accept=".xlsx"
        ref={hiddenInput}
        style={{ display: "none" }}
        onChange={(e) => {
          const selected = e.target.files[0];
          if (selected?.name.endsWith(".xlsx")) {
            setFiles([selected]);
          } else {
            alert("XLSXファイルを選択してください。");
          }
        }}
      />

      <View marginTop="1rem" marginBottom="1rem">
        {files.map((file) => (
          <Flex
            key={file.name}
            alignItems="center"
            justifyContent="space-between"
          >
            <Flex alignItems="center" gap="0.5rem">
              {getFileIcon(file.name)}
              <Text fontSize="0.875rem">{file.name}</Text>
            </Flex>
            <Button
              size="small"
              variation="link"
              colorTheme="error"
              onClick={() => setFiles([])}
            >
              削除
            </Button>
          </Flex>
        ))}
      </View>

      <Flex justifyContent="flex-end" marginBottom="2rem">
        <Button
          variation="primary"
          onClick={handleSubmit}
          isLoading={uploading}
        >
          アップロード
        </Button>
      </Flex>

      <View marginTop="1rem">
        <Heading level={6} marginBottom="0.5rem">
          適用中マスタ
        </Heading>
        {loadingList ? (
          <Loader variation="linear" />
        ) : (
          <View overflowX="auto">
            <Table highlightOnHover variation="striped" size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ファイル名</TableCell>
                  <TableCell>更新日時</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {latestList.map((file) => (
                  <TableRow key={file.key}>
                    <TableCell>
                      <Flex alignItems="center" gap="0.5rem">
                        <Link
                          as="button"
                          onClick={() => handleDownload(file.key)}
                          variation="primary"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                        >
                          <MdDownload />
                          {file.key}
                        </Link>
                      </Flex>
                    </TableCell>
                    <TableCell>
                      {new Date(file.lastModified).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </View>
        )}
      </View>

      <View marginTop="1rem">
        <Heading level={6} marginBottom="0.5rem">
          アップロード済みXLSX一覧
        </Heading>
        {loadingList ? (
          <Loader variation="linear" />
        ) : (
          <View overflowX="auto">
            <Table highlightOnHover variation="striped" size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ファイル名</TableCell>
                  <TableCell>更新日時</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {uploadsList.map((file) => {
                  const filename = file.key.split("/").pop(); // ファイル名だけ
                  const isApplied = appliedKeys.has(filename);
                  return (
                    <TableRow key={file.key}>
                      <TableCell>
                        <Flex alignItems="center" gap="0.5rem">
                          <Link
                            as="button"
                            onClick={() => handleDownload(file.key)}
                            variation="primary"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem",
                            }}
                          >
                            <MdDownload />
                            {file.key}
                          </Link>
                        </Flex>
                      </TableCell>
                      <TableCell>
                        {new Date(file.lastModified).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {isApplied ? (
                          <Button size="small" disabled variation="link">
                            マスタ適用中
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            onClick={() => {
                              setSelectedKey(file.key);
                              setIsModalOpen(true);
                            }}
                            isLoading={uploading}
                          >
                            マスタに適用
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </View>
        )}
      </View>
      {isModalOpen && (
        <View
          position="fixed"
          top="0"
          left="0"
          right="0"
          bottom="0"
          backgroundColor="rgba(0,0,0,0.3)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex="999"
        >
          <View
            backgroundColor="white"
            padding="2rem"
            borderRadius="0.5rem"
            width="90%"
            maxWidth="500px"
          >
            <Heading level={6} marginBottom="1rem">
              マスタ適用の確認
            </Heading>
            <Text>
              以下の点にご注意ください：
              <ul
                style={{
                  paddingLeft: "1.25rem",
                  marginTop: "0.5rem",
                  marginBottom: "1rem",
                }}
              >
                <li>現在のマスタは上書きされます。</li>
                <li>
                  外字やShift-JIS依存の内容は正しく反映されない可能性があります。
                </li>
                <li>一度適用すると元に戻せません。</li>
              </ul>
            </Text>
            <Flex justifyContent="flex-end" gap="1rem">
              <Button variation="link" onClick={() => setIsModalOpen(false)}>
                キャンセル
              </Button>
              <Button
                variation="primary"
                onClick={async () => {
                  await handleApply(selectedKey);
                  setIsModalOpen(false);
                  setSelectedKey(null);
                }}
                isLoading={uploading}
              >
                適用する
              </Button>
            </Flex>
          </View>
        </View>
      )}
    </View>
  );
};

export default ServiceMaster;
