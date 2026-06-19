import { useEffect } from "react";
import { ConfigProvider, Layout, Menu, Typography, theme } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { antdLocaleFor } from "./i18n/languages";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { LanguagePrompt } from "./components/LanguagePrompt";

const { Header, Content } = Layout;
const { Title } = Typography;

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = `EVE Echoes — ${t("nav.calculator")}`;
  }, [t, i18n.language]);

  return (
    <ConfigProvider locale={antdLocaleFor(i18n.language)} theme={{ algorithm: theme.defaultAlgorithm }}>
      <LanguagePrompt />
      <Layout style={{ minHeight: "100vh" }}>
        <Header style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Title level={4} style={{ color: "#fff", margin: 0, whiteSpace: "nowrap" }}>
            EVE Echoes
          </Title>
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={[location.pathname === "/rating" ? "/rating" : "/"]}
            onClick={(e) => navigate(e.key)}
            items={[
              { key: "/", label: t("nav.calculator") },
              { key: "/rating", label: t("nav.rating") },
            ]}
            style={{ flex: 1, minWidth: 0 }}
          />
          <LanguageSwitcher />
        </Header>
        <Content style={{ padding: 24, width: "100%" }}>
          <Outlet />
        </Content>
      </Layout>
    </ConfigProvider>
  );
}
