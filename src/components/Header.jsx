import {
  Flex,
  Link,
  Text,
  Button,
  Icon,
  View,
  Divider,
} from "@aws-amplify/ui-react";
import { NavLink } from "react-router-dom";
import { useState } from "react";
import { MdMenu, MdClose } from "react-icons/md";

const Header = ({ user, signOut }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = user?.groups?.includes("admin");
  const isManaged = user?.groups?.includes("user");

  const navItems = [
    { label: "ホーム", path: "/" },
    { label: "問い合わせ", path: "/inquiries" },
    ...(isManaged ? [{ label: "自分の台帳", path: "/ledgers" }] : []),
    ...(isAdmin
      ? [
          { label: "全台帳管理", path: "/admin/ledgers" },
          { label: "問い合わせ管理", path: "/admin/inquiries" },
        ]
      : []),
  ];

  const navLinkStyle = ({ isActive }) => ({
    padding: "0.5rem 0.75rem",
    borderRadius: "0.375rem",
    fontWeight: 500,
    color: isActive ? "#000" : "#4B5563",
    backgroundColor: isActive ? "#F3F4F6" : "transparent",
    textDecoration: "none",
    transition: "background-color 0.2s",
  });

  return (
    <View as="header" backgroundColor="#ffffff" borderBottom="1px solid #E5E7EB">
      {/* ヘッダー上部 */}
      <Flex
        padding="1rem 2rem"
        justifyContent="space-between"
        alignItems="center"
        wrap="wrap"
      >
        {/* ロゴとナビゲーション */}
        <Flex alignItems="center" gap="1rem">
          <Text fontWeight="600" fontSize="1.125rem">
            Google Account Manager
          </Text>

          {/* ハンバーガーアイコン（スマホのみ） */}
          <Button
            size="small"
            onClick={() => setMenuOpen(!menuOpen)}
            display={{ base: "flex", medium: "none" }}
            variation="link"
          >
            <Icon
              as={menuOpen ? MdClose : MdMenu}
              fontSize="1.5rem"
              color="gray"
            />
          </Button>

          {/* PC用ナビゲーション */}
          <Flex
            gap="1rem"
            alignItems="center"
            display={{ base: "none", medium: "flex" }}
          >
            {navItems.map((item) => (
              <Link
                key={item.path}
                as={NavLink}
                to={item.path}
                style={navLinkStyle}
              >
                {item.label}
              </Link>
            ))}
          </Flex>
        </Flex>

        {/* ユーザー情報（PCのみ右端） */}
        <Flex
          alignItems="center"
          gap="0.75rem"
          display={{ base: "none", medium: "flex" }}
        >
          <Text fontSize="0.875rem" color="#6B7280">
            {user?.email}
          </Text>
          <Button size="small" variation="primary" onClick={signOut}>
            サインアウト
          </Button>
        </Flex>
      </Flex>

      {/* モバイルメニュー展開部 */}
      {menuOpen && (
        <>
          <Divider />
          <Flex
            direction="column"
            gap="0.5rem"
            padding="1rem 2rem"
            display={{ base: "flex", medium: "none" }}
          >
            {navItems.map((item) => (
              <Link
                key={item.path}
                as={NavLink}
                to={item.path}
                style={navLinkStyle}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Divider marginTop="0.5rem" />
            <Text fontSize="0.875rem" color="#6B7280">
              {user?.email}
            </Text>
            <Button size="small" variation="primary" onClick={signOut}>
              サインアウト
            </Button>
          </Flex>
        </>
      )}
    </View>
  );
};

export default Header;
